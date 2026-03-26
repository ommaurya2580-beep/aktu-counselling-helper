import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configurations
const sourceDir = path.join(__dirname, '../src');
const outputDir = path.join(__dirname, '../public/data');
const outputFile = path.join(outputDir, 'all_cutoffs.json');

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

let finalResults = [];

files.forEach(fileInfo => {
    const filePath = path.join(sourceDir, fileInfo.name);
    
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Skipping missing file: ${fileInfo.name}`);
        return;
    }

    console.log(`🚀 Processing Round ${fileInfo.round}: ${fileInfo.name}...`);
    
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    
    // Convert to JSON with raw headers (array of arrays)
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
    if (rawRows.length < 1) return;

    // --- FIND HEADER ROW ---
    let headerRowIndex = -1;
    let colMap = {};

    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
        const row = rawRows[i].map(h => (h || '').toString().toUpperCase().replace(/[▲▼\s]/g, ''));
        
        const iInst = row.findIndex(h => h.includes('INSTITUTE'));
        const iClose = row.findIndex(h => h.includes('CLOSINGRANK'));
        
        if (iInst !== -1 && iClose !== -1) {
            headerRowIndex = i;
            colMap = {
                institute: iInst,
                program: row.findIndex(h => h.includes('PROGRAM')),
                stream: row.findIndex(h => h.includes('STREAM')),
                quota: row.findIndex(h => h.includes('QUOTA')),
                category: row.findIndex(h => h.includes('CATEGORY')),
                opening: row.findIndex(h => h.includes('OPENINGRANK')),
                closing: iClose
            };
            break;
        }
    }

    // Step 2: HEURISTIC MAPPING (If headers missing, e.g. Round 2-7)
    if (headerRowIndex === -1) {
        console.log(`⚠️ Headers missing in ${fileInfo.name}, using heuristics...`);
        const firstRow = rawRows[0];
        if (firstRow) {
            headerRowIndex = -1; // Data starts at row 0
            // Based on observed Round 2 structure: [Serial, Round, Inst, Prog, Degree, Quota, Category, Gender, OR, CR]
            colMap = {
                institute: 2,
                program: 3,
                degree: 4,
                quota: 5,
                category: 6,
                opening: 8,
                closing: 9
            };
            
            // Check if Round 7 structure [Inst, Prog, Degree, Quota, Category, Gender, OR, CR]
            if (firstRow[0] && firstRow[0].toString().includes('AKTU') || firstRow[0].toString().includes('INSTITUTE') || firstRow[0].toString().length > 20) {
                 if (!firstRow[1]?.toString().includes('Round')) {
                    colMap = {
                        institute: 0,
                        program: 1,
                        degree: 2,
                        quota: 3,
                        category: 4,
                        opening: 6,
                        closing: 7
                    };
                 }
            }
        }
    }

    if (!colMap.institute && colMap.institute !== 0) {
        console.warn(`❌ Could not determine mapping for ${fileInfo.name}. Skipping.`);
        return;
    }

    const dataRows = rawRows.slice(headerRowIndex + 1);
    let roundCount = 0;

    dataRows.forEach(row => {
        const getVal = (idx) => (idx !== undefined && idx !== -1 && row[idx] !== undefined) ? (row[idx] || '').toString().trim() : '';

        const collegeName = getVal(colMap.institute);
        const closingRankStr = getVal(colMap.closing).replace(/,/g, '');
        const closingRank = parseInt(closingRankStr);

        if (!collegeName || isNaN(closingRank) || collegeName.toUpperCase().includes('INSTITUTE')) return;

        const program = getVal(colMap.program);
        const stream = getVal(colMap.stream) || getVal(colMap.degree);
        const branch = stream ? `${program} (${stream})` : program;

        finalResults.push({
            college_name: collegeName,
            branch: branch,
            category: getVal(colMap.category),
            quota: getVal(colMap.quota),
            opening_rank: parseInt(getVal(colMap.opening).replace(/,/g, '')) || 0,
            closing_rank: closingRank,
            round: fileInfo.round
        });
        roundCount++;
    });

    console.log(`✅ Round ${fileInfo.round}: Added ${roundCount} records.`);
});

// Remove potential exact duplicates
const uniqueResults = Array.from(new Set(finalResults.map(JSON.stringify))).map(JSON.parse);

console.log(`\n🎉 FINAL SUCCESS! Total unique records: ${uniqueResults.length}`);

// Write to final file
fs.writeFileSync(outputFile, JSON.stringify(uniqueResults, null, 2));
console.log(`📦 Unified data saved at: ${outputFile}`);
