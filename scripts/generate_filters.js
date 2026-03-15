import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const csvFilePath = path.join(__dirname, 'data.csv');

const filters = {
    institutes: new Set(),
    programs: new Set(),
    categories: new Set(),
    quotas: new Set(),
    genders: new Set(),
    years: new Set([2024]),
    rounds: new Set()
};

const extractNumber = (str) => {
    if (!str) return 0;
    const match = String(str).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
};

fs.createReadStream(csvFilePath)
    .pipe(csv({
        mapHeaders: ({ header }) => header.trim().replace(/[^a-zA-Z0-9]/g, '').toLowerCase()
    }))
    .on('data', (row) => {
        if (!row.institute) return;

        if (row.institute) filters.institutes.add(row.institute.trim());
        if (row.program) filters.programs.add(row.program.trim());
        if (row.category) filters.categories.add(row.category.trim());
        if (row.quota) filters.quotas.add(row.quota.trim());
        if (row.seatgender) filters.genders.add(row.seatgender.trim());
        if (row.round) filters.rounds.add(extractNumber(row.round));
    })
    .on('end', () => {
        const output = {
            institutes: Array.from(filters.institutes).sort(),
            programs: Array.from(filters.programs).sort(),
            categories: Array.from(filters.categories).sort(),
            quotas: Array.from(filters.quotas).sort(),
            genders: Array.from(filters.genders).sort(),
            years: Array.from(filters.years).sort(),
            rounds: Array.from(filters.rounds).sort()
        };
        
        fs.writeFileSync(
            path.join(__dirname, '..', 'src', 'data', 'filterOptions.json'), 
            JSON.stringify(output, null, 2)
        );
        console.log("filterOptions.json successfully written!");
    })
    .on('error', console.error);
