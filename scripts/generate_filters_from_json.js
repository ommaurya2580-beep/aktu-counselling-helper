import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const inputJsonPath = path.join(__dirname, '..', 'public', 'data', 'all_cutoffs.json');

const filters = {
    institutes: new Set(),
    programs: new Set(),
    categories: new Set(),
    quotas: new Set(),
    genders: new Set(),
    years: new Set([2025]),
    rounds: new Set()
};

const rawData = fs.readFileSync(inputJsonPath, 'utf8');
const cutoffs = JSON.parse(rawData);

for (const row of cutoffs) {
    if (row.institute) filters.institutes.add(row.institute.trim());
    if (row.program) filters.programs.add(row.program.trim());
    if (row.category) filters.categories.add(row.category.trim());
    if (row.quota) filters.quotas.add(row.quota.trim());
    if (row.gender) filters.genders.add(row.gender.trim());
    if (row.round) filters.rounds.add(row.round);
}

const extractNumber = (str) => {
    if (!str) return 0;
    const match = String(str).match(/\d+/);
    return match ? parseInt(match[0], 10) : 0;
};

const output = {
    institutes: Array.from(filters.institutes).sort(),
    programs: Array.from(filters.programs).sort(),
    categories: Array.from(filters.categories).sort(),
    quotas: Array.from(filters.quotas).sort(),
    genders: Array.from(filters.genders).sort(),
    years: Array.from(filters.years).sort(),
    rounds: Array.from(filters.rounds).sort((a, b) => extractNumber(a) - extractNumber(b))
};

const outputPath = path.join(__dirname, '..', 'public', 'data', 'filterOptions.json');
fs.writeFileSync(outputPath, JSON.stringify(output, null, 2));

console.log("filterOptions.json successfully written with " + output.institutes.length + " institutes!");
