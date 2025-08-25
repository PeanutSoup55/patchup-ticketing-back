import { db } from '../firebase';
import { FieldValue } from 'firebase-admin/firestore';
import { Ticket, TicketStatus, TicketComment, CreateTicketRequest, UpdateTicketRequest, UserRole } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class TicketService {
  // Create a new ticket
  static async createTicket(
    ticketData: CreateTicketRequest,
    createdBy: string,
    customerEmail: string
  ): Promise<Ticket> {
    try {
      const ticket: Omit<Ticket, 'id'> = {
        ...ticketData,
        status: TicketStatus.OPEN,
        customerId: createdBy,
        customerEmail,
        createdBy,
        createdAt: new Date(),
        updatedAt: new Date(),
        comments: []
      };

      const docRef = await db.collection('tickets').add(ticket);
      
      return {
        id: docRef.id,
        ...ticket
      };
    } catch (error) {
      console.error('Error creating ticket:', error);
      throw new Error('Failed to create ticket');
    }
  }

  // Get ticket by ID
  static async getTicketById(ticketId: string): Promise<Ticket | null> {
    try {
      const ticketDoc = await db.collection('tickets').doc(ticketId).get();
      if (!ticketDoc.exists) {
        return null;
      }

      return {
        id: ticketDoc.id,
        ...ticketDoc.data()
      } as Ticket;
    } catch (error) {
      console.error('Error getting ticket:', error);
      return null;
    }
  }

  // Update ticket
  static async updateTicket(
    ticketId: string,
    updates: UpdateTicketRequest,
    updatedBy: string
  ): Promise<Ticket | null> {
    try {
      const updateData: any = {
        ...updates,
        updatedAt: new Date()
      };

      // If status is being changed to resolved, set resolvedAt
      if (updates.status === TicketStatus.RESOLVED) {
        updateData.resolvedAt = new Date();
      }

      await db.collection('tickets').doc(ticketId).update(updateData);
      
      // Add activity log
      await this.addActivityLog(ticketId, updatedBy, 'updated', updates);
      
      return await this.getTicketById(ticketId);
    } catch (error) {
      console.error('Error updating ticket:', error);
      throw new Error('Failed to update ticket');
    }
  }

  // Assign ticket to employee/admin
  static async assignTicket(
    ticketId: string,
    assignedTo: string,
    assignedToEmail: string,
    assignedBy: string
  ): Promise<void> {
    try {
      await db.collection('tickets').doc(ticketId).update({
        assignedTo,
        assignedToEmail,
        status: TicketStatus.IN_PROGRESS,
        updatedAt: new Date()
      });

      await this.addActivityLog(ticketId, assignedBy, 'assigned', { assignedTo: assignedToEmail });
    } catch (error) {
      console.error('Error assigning ticket:', error);
      throw new Error('Failed to assign ticket');
    }
  }

  // Get tickets for customer
  static async getCustomerTickets(customerId: string): Promise<Ticket[]> {
    try {
      const snapshot = await db.collection('tickets')
        .where('customerId', '==', customerId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];
    } catch (error) {
      console.error('Error getting customer tickets:', error);
      return [];
    }
  }

  // Get tickets assigned to employee
  static async getAssignedTickets(employeeId: string): Promise<Ticket[]> {
    try {
      const snapshot = await db.collection('tickets')
        .where('assignedTo', '==', employeeId)
        .orderBy('createdAt', 'desc')
        .get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];
    } catch (error) {
      console.error('Error getting assigned tickets:', error);
      return [];
    }
  }

  // Get all tickets (admin only)
  static async getAllTickets(filters?: {
    status?: TicketStatus;
    priority?: string;
    assignedTo?: string;
    page?: number;
    limit?: number;
  }): Promise<{ tickets: Ticket[]; total: number }> {
    try {
      let query = db.collection('tickets').orderBy('createdAt', 'desc');

      // Apply filters
      if (filters?.status) {
        query = query.where('status', '==', filters.status);
      }
      if (filters?.priority) {
        query = query.where('priority', '==', filters.priority);
      }
      if (filters?.assignedTo) {
        query = query.where('assignedTo', '==', filters.assignedTo);
      }

      // Get total count
      const countSnapshot = await query.get();
      const total = countSnapshot.size;

      // Apply pagination
      if (filters?.page && filters?.limit) {
        const offset = (filters.page - 1) * filters.limit;
        query = query.offset(offset).limit(filters.limit);
      }

      const snapshot = await query.get();
      const tickets = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Ticket[];

      return { tickets, total };
    } catch (error) {
      console.error('Error getting all tickets:', error);
      return { tickets: [], total: 0 };
    }
  }

  // Add comment to ticket
  static async addComment(
    ticketId: string,
    content: string,
    authorId: string,
    authorEmail: string,
    authorRole: UserRole,
    isInternal: boolean = false
  ): Promise<TicketComment> {
    try {
      const comment: TicketComment = {
        id: uuidv4(),
        ticketId,
        authorId,
        authorEmail,
        authorRole,
        content,
        createdAt: new Date(),
        isInternal
      };

      // Add comment to ticket's comments array
      await db.collection('tickets').doc(ticketId).update({
        comments: FieldValue.arrayUnion(comment),
        updatedAt: new Date()
      });

      return comment;
    } catch (error) {
      console.error('Error adding comment:', error);
      throw new Error('Failed to add comment');
    }
  }

  // Get ticket comments
  static async getTicketComments(ticketId: string, userRole: UserRole): Promise<TicketComment[]> {
    try {
      const ticket = await this.getTicketById(ticketId);
      if (!ticket) return [];

      // Filter internal comments for customers
      if (userRole === UserRole.CUSTOMER) {
        return ticket.comments.filter(comment => !comment.isInternal);
      }

      return ticket.comments;
    } catch (error) {
      console.error('Error getting comments:', error);
      return [];
    }
  }

  // Delete ticket (admin only)
  static async deleteTicket(ticketId: string): Promise<void> {
    try {
      await db.collection('tickets').doc(ticketId).delete();
    } catch (error) {
      console.error('Error deleting ticket:', error);
      throw new Error('Failed to delete ticket');
    }
  }

  // Add activity log
  private static async addActivityLog(
    ticketId: string,
    userId: string,
    action: string,
    details: any
  ): Promise<void> {
    try {
      await db.collection('ticket_activities').add({
        ticketId,
        userId,
        action,
        details,
        createdAt: new Date()
      });
    } catch (error) {
      console.error('Error adding activity log:', error);
    }
  }

  // Get ticket statistics (admin dashboard)
  static async getTicketStats(): Promise<{
    total: number;
    open: number;
    inProgress: number;
    resolved: number;
    closed: number;
  }> {
    try {
      const [totalSnap, openSnap, progressSnap, resolvedSnap, closedSnap] = await Promise.all([
        db.collection('tickets').get(),
        db.collection('tickets').where('status', '==', TicketStatus.OPEN).get(),
        db.collection('tickets').where('status', '==', TicketStatus.IN_PROGRESS).get(),
        db.collection('tickets').where('status', '==', TicketStatus.RESOLVED).get(),
        db.collection('tickets').where('status', '==', TicketStatus.CLOSED).get()
      ]);

      return {
        total: totalSnap.size,
        open: openSnap.size,
        inProgress: progressSnap.size,
        resolved: resolvedSnap.size,
        closed: closedSnap.size
      };
    } catch (error) {
      console.error('Error getting ticket stats:', error);
      return { total: 0, open: 0, inProgress: 0, resolved: 0, closed: 0 };
    }
  }
}