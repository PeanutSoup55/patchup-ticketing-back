import e, { Router } from "express";
import { requireAdmin, verifyToken } from "../middleware/auth";
import { AuthRequest } from '../middleware/auth';
import { AuthService } from "../services/authService";

const router = Router();

router.get("/test", (req, res) => {
    res.json({ message: "Users route is working!" });
});

router.get("/employees", (req, res, next) => {
    console.log('Raw employees route hit before middleware');
    next();
}, verifyToken, requireAdmin, async (req: AuthRequest, res) => {
    console.log('Employees route hit after middleware');
    console.log('=== EMPLOYEES ROUTE HIT ===');
    console.log('Request headers:', req.headers.authorization);
    
    try {
        console.log('Fetching employees for admin user:', req.user?.uid);
        const users = await AuthService.getEmployees();
        
        res.json({ 
            message: 'Employees fetched successfully',
            employees: users,
            count: users.length 
        });
        
    } catch (error: any) {
        console.error('Error fetching employees:', error);
        res.status(500).json({ 
            error: 'Internal server error',
            details: error.message 
        });
    }
});

export default router;