import { Request, Response, NextFunction } from 'express';
import { auth, db } from '../firebase';
import { UserRole, User } from '../types';

export interface AuthRequest extends Request {
    user?: User;
}

export const verifyToken = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')){
            return res.status(401).json({ message: 'no token dumdum'});
        }
        const token = authHeader.split(' ')[1];
        const decodedToken = await auth.verifyIdToken(token);

        const userData = await db.collection('users').doc(decodedToken.uid).get();
        if (!userData.exists) {
            return res.status(404).json({ message: 'User not found' });
        }

        req.user = {
            uid: decodedToken.uid,
            ...userData.data()
        } as User;

        next();
    } catch (error) {
        console.error('Error verifying token:', error);
        return res.status(401).json({ message: 'Unauthorized' });
    }
}

export const checkRole = (roles: UserRole[]) => {
    return (req: AuthRequest, res: Response, next: NextFunction) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Forbidden: insufficient permissions' });
        }
        next(); 
    }
}

export const requireAdmin = checkRole([UserRole.ADMIN]);
export const requireEmployeeOrAdmin = checkRole([UserRole.ADMIN, UserRole.EMPLOYEE]);
export const requireCustomer = checkRole([UserRole.CUSTOMER, UserRole.EMPLOYEE, UserRole.ADMIN]);