import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function testQuery() {
    let query = db.collection('cutoffs');

    // Mimic the exact inputs that the user had in the screenshot:
    // Counselling Year: 2024
    // Round Number: 1
    // Institute Name: Bundelkhand Institute of Engineering & Technology, Jhansi
    // Program Name: Computer Science and Engineering
    // Category: OPEN
    // Quota: Home State
    // Gender: Gender-Neutral
    
    query = query.where('year', '==', 2024);
    query = query.where('round', '==', 1);
    query = query.where('institute', '==', 'Bundelkhand Institute of Engineering & Technology, Jhansi');
    query = query.where('program', '==', 'Computer Science and Engineering');
    // query = query.where('category', '==', 'OPEN');
    // query = query.where('quota', '==', 'Home State');
    // query = query.where('gender', '==', 'Gender-Neutral');
    
    const snapshot = await query.get();
    
    console.log(`Found ${snapshot.size} documents for Year=2024, Round=1`);
    
    if (snapshot.size > 0) {
        console.log("First doc:", snapshot.docs[0].data());
    }
}

testQuery().catch(console.error);
