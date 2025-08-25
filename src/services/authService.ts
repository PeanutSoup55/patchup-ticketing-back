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

    static async updateUser( uid: string, updates: Partial<User>): Promise<User | null> {
        try {
            const updateData = {
                ...updates,
                updatedAt: new Date()
            }

            await db.collection('users').doc(uid).update(updateData);
            return await this.getUserByUid(uid);
        } catch (error) {
            console.error('Error updating user:', error);
            throw new Error('Failed to update user');
        }
    }

    static async deactivateUser(uid: string): Promise<void> {
        try {
            await Promise.all([
                auth.updateUser(uid, { disabled: true}),
                db.collection('users').doc(uid).update({
                    isActive: false,
                    updatedAt: new Date()
                })
            ]);
        }catch(error) {
            console.error('Error deactivating user:', error);
            throw new Error('Failed to deactivate user');
        }
    }

    static async getEmployees(): Promise<User[]> {
        try {
            const snapshot = await db.collection('users')
                .where('role', 'in', [UserRole.EMPLOYEE, UserRole.ADMIN])
                .where('isActive', '==', true)
                .get();
            
            return snapshot.docs.map(doc => ({
                uid: doc.id,
                ...doc.data()
            })) as User[];
        } catch(error) {
            console.error('Error fetching employees:', error);
            throw new Error('Failed to fetch employees');
        }
    }

    static async setUserClaims(uid: string, role: UserRole): Promise<void> {
        try {
            await auth.setCustomUserClaims(uid, { role });
            console.log(`Successfully set custom claims for user ${uid}:`, { role });
        } catch (error) {
            console.error('Error setting custom claims:', error);
            throw new Error('Failed to set custom claims');
        }
    }
}