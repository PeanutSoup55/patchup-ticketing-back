import { Router } from 'express';
import { AuthService } from '../services/authService';
import { UserRole } from '../types';
import { verifyToken, requireAdmin, AuthRequest } from '../middleware/auth';

const router = Router();

// Create user (admin only)
router.post('/users', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { email, password, displayName, role, department, phoneNumber } = req.body;

    if (!email || !password || !displayName || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!Object.values(UserRole).includes(role)) {
      return res.status(400).json({ error: 'Invalid role' });
    }

    const user = await AuthService.createUser(
      email,
      password,
      displayName,
      role,
      department,
      phoneNumber
    );

    // Set custom claims for role-based access
    await AuthService.setUserClaims(user.uid, role);

    res.status(201).json({ user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get current user profile
router.get('/profile', verifyToken, async (req: AuthRequest, res) => {
  try {
    res.json({ user: req.user });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update user profile
router.put('/profile', verifyToken, async (req: AuthRequest, res) => {
  try {
    const { displayName, phoneNumber, department } = req.body;
    const updates: any = {};

    if (displayName) updates.displayName = displayName;
    if (phoneNumber) updates.phoneNumber = phoneNumber;
    if (department) updates.department = department;

    const updatedUser = await AuthService.updateUser(req.user!.uid, updates);
    res.json({ user: updatedUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Get all employees (for assignment)
router.get('/employees', verifyToken, async (req: AuthRequest, res) => {
  try {
    // Only employees and admins can see employee list
    if (req.user!.role === UserRole.CUSTOMER) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const employees = await AuthService.getEmployees();
    res.json({ employees });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Update user by admin
router.put('/users/:uid', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { uid } = req.params;
    const updates = req.body;

    const updatedUser = await AuthService.updateUser(uid, updates);
    res.json({ user: updatedUser });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

// Deactivate user (admin only)
router.delete('/users/:uid', verifyToken, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const { uid } = req.params;
    await AuthService.deactivateUser(uid);
    res.json({ message: 'User deactivated successfully' });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;