import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const sourceDir = path.join(__dirname, '../src');
const outputDir = path.join(__dirname, '../src/data');
const outputFile = path.join(outputDir, 'cutoffs.json');

// Ensure output directory exists
if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

// Excel files to process
const files = [
    { name: 'aktu_round1.xlsx', round: 1 },
    { name: 'aktu_round2.xlsx', round: 2 },
    { name: 'aktu_round3.xlsx', round: 3 },
    { name: 'aktu_round4.xlsx', round: 4 },
    { name: 'aktu_round6.xlsx', round: 6 },
    { name: 'aktu_round7.xlsx', round: 7 }
];

let allData = [];

files.forEach(fileInfo => {
    const filePath = path.join(sourceDir, fileInfo.name);
    
    if (!fs.existsSync(filePath)) {
        console.warn(`File not found: ${fileInfo.name}, skipping...`);
        return;
    }

    console.log(`Processing ${fileInfo.name}...`);
    
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    
    // Get raw data (header: 1 returns an array of arrays)
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rawRows.length < 2) return;

    const headers = rawRows[0].map(h => (h || '').toString().replace(/▲▼/g, '').trim());
    const dataRows = rawRows.slice(1);

    // Map headers to indices
    const colMap = {
        institute: headers.indexOf('Institute'),
        program: headers.indexOf('Program'),
        stream: headers.indexOf('Stream'),
        quota: headers.indexOf('Quota'),
        category: headers.indexOf('Category'),
        opening: headers.indexOf('Opening Rank'),
        closing: headers.indexOf('Closing Rank')
    };

    dataRows.forEach(row => {
        const getVal = (idx) => (row[idx] || '').toString().trim();

        const institute = getVal(colMap.institute);
        const openingRankStr = getVal(colMap.opening);
        const closingRankStr = getVal(colMap.closing);

        const openingRank = parseInt(openingRankStr);
        const closingRank = parseInt(closingRankStr);

        // Skip rows with invalid ranks or empty data
        if (!institute || isNaN(openingRank) || isNaN(closingRank)) {
            return;
        }

        // Combine Program and Stream for branch
        const program = getVal(colMap.program);
        const stream = getVal(colMap.stream);
        const branch = stream ? `${program} (${stream})` : program;

        const normalizedRow = {
            college_name: institute.toLowerCase(),
            branch: branch.toLowerCase(),
            category: getVal(colMap.category).toLowerCase(),
            quota: getVal(colMap.quota).toLowerCase(),
            opening_rank: openingRank,
            closing_rank: closingRank,
            round: fileInfo.round
        };

        allData.push(normalizedRow);
    });
});

// Remove duplicates
const uniqueData = Array.from(new Set(allData.map(JSON.stringify))).map(JSON.parse);

console.log(`Successfully processed ${uniqueData.length} records.`);

// Save to JSON
fs.writeFileSync(outputFile, JSON.stringify(uniqueData, null, 2));
console.log(`Data saved to ${outputFile}`);
