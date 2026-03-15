import admin from 'firebase-admin';
import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath = path.join(__dirname, 'serviceAccountKey.json');
const csvFilePath = path.join(__dirname, 'data.csv');

if (!fs.existsSync(serviceAccountPath)) {
    console.error("ERROR: serviceAccountKey.json not found in scripts/ directory.");
    process.exit(1);
}

if (!fs.existsSync(csvFilePath)) {
    console.error("ERROR: data.csv not found in scripts/ directory.");
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, 'utf8'));

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

const extractNumber = (str) => {
    if (!str) return 0;
    const match = String(str).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
};

const cleanRecord = (obj) => {
    const newObj = {};
    Object.keys(obj).forEach(key => {
        if (obj[key] !== undefined && obj[key] !== null) {
            newObj[key] = obj[key];
        }
    });
    return newObj;
};

async function importData() {
    const BATCH_SIZE = 500;
    let batch = db.batch();
    let count = 0;
    let totalImported = 0;

    console.log("Starting data import...");

    const records = [];

    // 1. Read all valid records into memory first to avoid stream vs async commit issues
    await new Promise((resolve, reject) => {
        fs.createReadStream(csvFilePath)
            .pipe(csv({
                mapHeaders: ({ header }) => header.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
            }))
            .on('data', (row) => {
                if (!row.institute) return;

                let record = {
                    year: 2024,
                    round: extractNumber(row.round),
                    institute: row.institute?.trim() || "",
                    program: row.program?.trim() || "",
                    stream: row.stream?.trim() || "",
                    quota: row.quota?.trim() || "",
                    category: row.category?.trim() || "",
                    gender: row.seatgender?.trim() || "",
                    opening_rank: parseInt(row.openingrank, 10) || 0,
                    closing_rank: parseInt(row.closingrank, 10) || 0,
                    remark: row.remark?.trim() || ""
                };

                record = cleanRecord(record);
                records.push(record);
            })
            .on('end', resolve)
            .on('error', reject);
    });

    console.log(`Parsed ${records.length} valid records from CSV. Starting batch uploads...`);

    // 2. Upload in batches synchronously
    for (let i = 0; i < records.length; i++) {
        const docRef = db.collection('cutoffs').doc();
        batch.set(docRef, records[i]);
        count++;

        if (count === BATCH_SIZE) {
            totalImported += count;
            console.log(`Committing batch... Total imported: ${totalImported}`);
            await batch.commit();
            batch = db.batch();
            count = 0;
        }
    }

    // 3. Commit remaining records
    if (count > 0) {
        totalImported += count;
        console.log(`Committing final batch... Total imported: ${totalImported}`);
        await batch.commit();
    }

    console.log('CSV data successfully uploaded to Firestore!');
}

importData().catch(console.error);
