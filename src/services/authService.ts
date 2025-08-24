import {auth, db} from '../firebase';
import {UserRole, User} from '../types';

export class AuthService {
    static async createUser(
        email: string,
        password: string,
        displayName: string,
        role: UserRole,
        department?: string,
        phoneNumber?: string
    ): Promise<User> {
        try {
            const userRecord = await auth.createUser({
                email,
                password,
                displayName,
                phoneNumber
            });
            const userData: Omit<User, 'uid'> = {
                email,
                displayName,
                role,
                department,
                phoneNumber,
                createdAt: new Date(),
                updatedAt: new Date(),
                isActive: true
            };

            await db.collection('users').doc(userRecord.uid).set(userData);

            return {
                uid: userRecord.uid,
                ...userData
            };
        } catch (error) {
            console.error('Error creating user:', error);
            throw new Error('Failed to create user');
        }
    }

    static async getUserByUid(uid: string): Promise<User | null> {
        try {
            const userDoc = await db.collection('users').doc(uid).get();
            if (!userDoc.exists) {
                return null;
            }

            return {
                uid,
                ...userDoc.data()
            } as User;
            
        }catch (error) {
            console.error('Error fetching user: ', error);
            throw new Error('Failed to fetch user');
        }
    }
}