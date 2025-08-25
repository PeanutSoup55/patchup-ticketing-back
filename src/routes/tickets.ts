import { Router } from 'express';
import { TicketService } from '../services/ticketService';
import { UserRole, TicketStatus, TicketPriority } from '../types';
import { verifyToken, requireAdmin, requireEmployeeOrAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Get ticket statistics (admin only)
router.get('/stats/overview', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
    try {
      const stats = await TicketService.getTicketStats();
      res.json({ stats });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

// Create ticket (customers and admins)
router.post('/', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { title, description, priority, category, dueDate, tags } = req.body;

    if (!title || !description || !priority || !category) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!Object.values(TicketPriority).includes(priority)) {
      return res.status(400).json({ error: 'Invalid priority' });
    }

    const ticket = await TicketService.createTicket(
      { title, description, priority, category, dueDate, tags },
      req.user!.uid,
      req.user!.email
    );

    res.status(201).json({ ticket });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get tickets based on user role
router.get('/', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { status, priority, assignedTo, page = '1', limit = '10' } = req.query;
    const user = req.user!;

    let tickets;

    if (user.role === UserRole.CUSTOMER) {
      // Customers can only see their own tickets
      tickets = await TicketService.getCustomerTickets(user.uid);
      res.json({ tickets });
    } else if (user.role === UserRole.EMPLOYEE) {
      // Employees see tickets assigned to them
      tickets = await TicketService.getAssignedTickets(user.uid);
      res.json({ tickets });
    } else if (user.role === UserRole.ADMIN) {
      // Admins can see all tickets with filters
      const filters = {
        status: status as TicketStatus,
        priority: priority as string,
        assignedTo: assignedTo as string,
        page: parseInt(page as string),
        limit: parseInt(limit as string)
      };

      const result = await TicketService.getAllTickets(filters);
      res.json(result);
    }
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get single ticket
router.get('/:id', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const ticket = await TicketService.getTicketById(id);

    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    const user = req.user!;

    // Check permissions
    if (user.role === UserRole.CUSTOMER && ticket.customerId !== user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    if (user.role === UserRole.EMPLOYEE && ticket.assignedTo !== user.uid) {
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json({ ticket });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update ticket
router.put('/:id', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;
    const user = req.user!;

    const ticket = await TicketService.getTicketById(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check permissions
    let canUpdate = false;

    if (user.role === UserRole.ADMIN) {
      canUpdate = true;
    } else if (user.role === UserRole.EMPLOYEE && ticket.assignedTo === user.uid) {
      canUpdate = true;
      // Employees can only update status and add comments, not reassign
      const allowedFields = ['status', 'description'];
      const filteredUpdates = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj: any, key) => {
          obj[key] = updates[key];
          return obj;
        }, {});
      Object.assign(updates, filteredUpdates);
    } else if (user.role === UserRole.CUSTOMER && ticket.customerId === user.uid) {
      // Customers can only update description and add comments if ticket is still open
      if (ticket.status !== TicketStatus.OPEN) {
        return res.status(403).json({ error: 'Cannot update closed ticket' });
      }
      const allowedFields = ['description'];
      const filteredUpdates = Object.keys(updates)
        .filter(key => allowedFields.includes(key))
        .reduce((obj: any, key) => {
          obj[key] = updates[key];
          return obj;
        }, {});
      Object.assign(updates, filteredUpdates);
      canUpdate = true;
    }

    if (!canUpdate) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const updatedTicket = await TicketService.updateTicket(id, updates, user.uid);
    res.json({ ticket: updatedTicket });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Assign ticket (admin only)
router.put('/:id/assign', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { assignedTo, assignedToEmail } = req.body;

    if (!assignedTo || !assignedToEmail) {
      return res.status(400).json({ error: 'Missing assignedTo or assignedToEmail' });
    }

    await TicketService.assignTicket(id, assignedTo, assignedToEmail, req.user!.uid);
    const updatedTicket = await TicketService.getTicketById(id);

    res.json({ ticket: updatedTicket });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Add comment to ticket
router.post('/:id/comments', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const { content, isInternal = false } = req.body;
    const user = req.user!;

    if (!content) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    const ticket = await TicketService.getTicketById(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check permissions
    let canComment = false;

    if (user.role === UserRole.ADMIN) {
      canComment = true;
    } else if (user.role === UserRole.EMPLOYEE && ticket.assignedTo === user.uid) {
      canComment = true;
    } else if (user.role === UserRole.CUSTOMER && ticket.customerId === user.uid) {
      canComment = true;
      // Customers cannot create internal comments
      if (isInternal) {
        return res.status(403).json({ error: 'Customers cannot create internal comments' });
      }
    }

    if (!canComment) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const comment = await TicketService.addComment(
      id,
      content,
      user.uid,
      user.email,
      user.role,
      isInternal
    );

    res.status(201).json({ comment });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get ticket comments
router.get('/:id/comments', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const ticket = await TicketService.getTicketById(id);
    if (!ticket) {
      return res.status(404).json({ error: 'Ticket not found' });
    }

    // Check permissions
    let canView = false;

    if (user.role === UserRole.ADMIN) {
      canView = true;
    } else if (user.role === UserRole.EMPLOYEE && ticket.assignedTo === user.uid) {
      canView = true;
    } else if (user.role === UserRole.CUSTOMER && ticket.customerId === user.uid) {
      canView = true;
    }

    if (!canView) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const comments = await TicketService.getTicketComments(id, user.role);
    res.json({ comments });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Delete ticket (admin only)
router.delete('/:id', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { id } = req.params;
    await TicketService.deleteTicket(id);
    res.json({ message: 'Ticket deleted successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});


export default router;