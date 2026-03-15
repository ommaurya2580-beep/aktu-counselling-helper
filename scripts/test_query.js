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

admin.firestore().collection('cutoffs').get().then(snap => {
    let progs = new Set();
    snap.forEach(d => { if(d.data().program) progs.add(d.data().program); });
    fs.writeFileSync('programs.txt', Array.from(progs).sort().join('\n'));
    console.log("Wrote programs.txt");
});
