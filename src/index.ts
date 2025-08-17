import { db } from './firebase';

async function main() {
    try {
        const docRef = await db.collection('users').add({
            name: 'John Doe',
            email: 'john@example.com',
            createdAt: new Date(),
        });
        console.log('Document written with ID: ', docRef.id);
        const snapshot = await db.collection('users').get();
        snapshot.forEach((doc) => {
            console.log(`${doc.id} =>`, doc.data());
        })
        await db.collection('users').doc(docRef.id).update({
            name: 'oink'
        });
    } catch (error) {
        console.log('Error adding document: ', error);
    }
}

main()