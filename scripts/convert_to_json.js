import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const csvFilePath = path.join(__dirname, 'data.csv');
const jsonFilePath = path.join(__dirname, '..', 'public', 'cutoffs.json');

if (!fs.existsSync(csvFilePath)) {
    console.error("ERROR: data.csv not found in scripts/ directory.");
    process.exit(1);
}

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

async function convertData() {
    console.log("Starting data conversion...");

    const records = [];

    // Read all valid records into memory
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

    console.log(`Parsed ${records.length} valid records from CSV.`);
    
    fs.writeFileSync(jsonFilePath, JSON.stringify(records));
    console.log(`Successfully wrote ${records.length} records to public/cutoffs.json`);
}

convertData().catch(console.error);
