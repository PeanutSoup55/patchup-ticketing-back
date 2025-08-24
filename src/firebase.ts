import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

const serviceAccount = require('../sdk.json');

console.log('Service account project_id:', serviceAccount.project_id);
console.log('Service account client_email:', serviceAccount.client_email);

const initializeFirebase = () => {
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount),
            projectId: serviceAccount.project_id
        });
        console.log('Firebase initialized successfully');
    }
};

initializeFirebase();
export const db = getFirestore();
export default admin;