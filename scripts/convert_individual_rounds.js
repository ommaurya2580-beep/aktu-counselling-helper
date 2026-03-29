import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const XLSX = require('xlsx');
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const sourceDir = path.join(__dirname, '../src');
const outputDir = path.join(__dirname, '../src/data');

if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
}

const files = [
    { name: 'aktu_round1.xlsx', out: 'aktu_round1.json', roundName: 'Round 1' },
    { name: 'aktu_round2.xlsx', out: 'aktu_round2.json', roundName: 'Round 2' },
    { name: 'aktu_round3.xlsx', out: 'aktu_round3.json', roundName: 'Round 3' },
    { name: 'aktu_round4.xlsx', out: 'aktu_round4.json', roundName: 'Round 4' },
    { name: 'aktu_round6.xlsx', out: 'aktu_round6.json', roundName: 'Round 6' },
    { name: 'aktu_round7.xlsx', out: 'aktu_round7.json', roundName: 'Round 7' }
];

const publicDataDir = path.join(__dirname, '../public/data');
if (!fs.existsSync(publicDataDir)) {
    fs.mkdirSync(publicDataDir, { recursive: true });
}

files.forEach(fileInfo => {
    const filePath = path.join(sourceDir, fileInfo.name);
    const outputPath = path.join(outputDir, fileInfo.out);
    
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Skipping missing file: ${fileInfo.name}`);
        return;
    }

    console.log(`🚀 Processing ${fileInfo.name}...`);
    
    const workbook = XLSX.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    if (rawRows.length < 1) return;

    // --- FIND HEADER ROW ---
    let headerRowIndex = -1;
    let colMap = {};

    for (let i = 0; i < Math.min(rawRows.length, 10); i++) {
        const row = rawRows[i].map(h => (h || '').toString().toUpperCase().replace(/[▲▼\s]/g, ''));
        const iInst = row.findIndex(h => h.includes('INSTITUTE'));
        const iClose = row.findIndex(h => h.includes('CLOSINGRANK') || h.includes('CLOSING_RANK'));
        
        if (iInst !== -1 && iClose !== -1) {
            headerRowIndex = i;
            colMap = {
                round: row.findIndex(h => h.includes('ROUND')),
                institute: iInst,
                program: row.findIndex(h => h.includes('PROGRAM')),
                stream: row.findIndex(h => h.includes('STREAM') || h.includes('DEGREE')),
                quota: row.findIndex(h => h.includes('QUOTA')),
                category: row.findIndex(h => h.includes('CATEGORY')),
                gender: row.findIndex(h => h.includes('GENDER')),
                opening: row.findIndex(h => h.includes('OPENING')),
                closing: iClose
            };
            break;
        }
    }

    // Heuristic Fallback for headerless files
    if (headerRowIndex === -1) {
        console.log(`⚠️ Headers missing in ${fileInfo.name}, using heuristics...`);
        const firstRow = rawRows[0];
        if (firstRow && firstRow.length >= 8) {
            // Check if first element is numeric (Serial) or "Round X"
            if (typeof firstRow[0] === 'number' || firstRow[1]?.toString().includes('Round')) {
                // Format: [Serial, Round, Inst, Prog, Stream, Quota, Cat, Gender, OR, CR, Remark]
                headerRowIndex = -1;
                colMap = {
                    round: 1,
                    institute: 2,
                    program: 3,
                    stream: 4,
                    quota: 5,
                    category: 6,
                    gender: 7,
                    opening: 8,
                    closing: 9
                };
            } else {
                // Format: [Inst, Prog, Stream, Quota, Cat, Gender, OR, CR]
                headerRowIndex = -1;
                colMap = {
                    round: -1,
                    institute: 0,
                    program: 1,
                    stream: 2,
                    quota: 3,
                    category: 4,
                    gender: 5,
                    opening: 6,
                    closing: 7
                };
            }
        }
    }

    if (colMap.institute === undefined || colMap.institute === -1) {
        console.warn(`❌ Could not determine mapping for ${fileInfo.name}. Skipping.`);
        return;
    }

    const results = [];
    const dataRows = rawRows.slice(headerRowIndex + 1);
    
    dataRows.forEach(row => {
        const getVal = (idx) => (idx !== undefined && idx !== -1 && row[idx] !== undefined) ? row[idx].toString().trim() : '';
        
        const institute = getVal(colMap.institute);
        if (!institute || institute.trim().toUpperCase() === 'INSTITUTE') return;

        results.push({
            round: colMap.round !== -1 ? getVal(colMap.round) : fileInfo.roundName,
            institute: institute,
            program: getVal(colMap.program),
            stream: getVal(colMap.stream),
            quota: getVal(colMap.quota),
            category: getVal(colMap.category),
            gender: getVal(colMap.gender),
            opening_rank: getVal(colMap.opening).replace(/,/g, ''),
            closing_rank: getVal(colMap.closing).replace(/,/g, ''),
            // Backward compatibility aliases for Predictor
            college_name: institute,
            branch: getVal(colMap.program)
        });
    });

    // Write individual JSON for Search page imports
    fs.writeFileSync(path.join(outputDir, fileInfo.out), JSON.stringify(results, null, 2));
    
    // Write to public/data as well for direct fetching
    fs.writeFileSync(path.join(publicDataDir, fileInfo.out), JSON.stringify(results, null, 2));

    console.log(`✅ Converted ${fileInfo.name} -> ${fileInfo.out} (${results.length} records)`);
});

// --- GENERATE UNIFIED DATA FOR PREDICTOR & ANALYTICS ---
console.log('📦 Generating unified files...');
const unifiedData = {};
const comparisonFast = {};
const allInstitutes = new Set();
const allPrograms = new Set();
const allCategories = new Set();
const allQuotas = new Set();
const allGenders = new Set();
const allRounds = new Set();
const allRecords = [];

function normalize(str) {
    if (!str) return '';
    return str
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

files.forEach(fileInfo => {
    const jsonPath = path.join(outputDir, fileInfo.out);
    if (fs.existsSync(jsonPath)) {
        const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
        const roundNum = fileInfo.roundName.replace(/\D/g, '');
        const roundKey = `round_${roundNum}`;
        
        unifiedData[roundKey] = data;
        allRounds.add(fileInfo.roundName);

        const collegeMap = {};

        data.forEach(item => {
            if (item.institute) allInstitutes.add(item.institute.trim());
            if (item.program) allPrograms.add(item.program.trim());
            if (item.category) allCategories.add(item.category.trim());
            if (item.quota) allQuotas.add(item.quota.trim());
            if (item.gender) allGenders.add(item.gender.trim());

            // Build comparison_fast structure
            const instKey = normalize(item.institute);
            if (!collegeMap[instKey]) collegeMap[instKey] = [];
            collegeMap[instKey].push({
                branch: item.program,
                quota: item.quota,
                category: item.category,
                gender: item.gender,
                opening_rank: parseInt(item.opening_rank) || null,
                closing_rank: parseInt(item.closing_rank) || null
            });
        });

        comparisonFast[roundKey] = {
            college_map: collegeMap
        };

        // Add to allRecords for cutoffs.min.json
        allRecords.push(...data);
    }
});

// 1. Write cutoffs_by_round.json
fs.writeFileSync(
    path.join(publicDataDir, 'cutoffs_by_round.json'),
    JSON.stringify(unifiedData, null, 2)
);

// 2. Write comparison_fast.json
fs.writeFileSync(
    path.join(publicDataDir, 'comparison_fast.json'),
    JSON.stringify(comparisonFast, null, 2)
);

// 3. Write cutoffs.min.json (Flat array of all records)
fs.writeFileSync(
    path.join(publicDataDir, 'cutoffs.min.json'),
    JSON.stringify(allRecords, null, 2)
);

// 4. Update filterOptions.json
const filterOptions = {
    institutes: Array.from(allInstitutes).sort(),
    programs: Array.from(allPrograms).sort(),
    categories: Array.from(allCategories).sort(),
    quotas: Array.from(allQuotas).sort(),
    genders: Array.from(allGenders).sort(),
    rounds: Array.from(allRounds).sort((a,b) => {
        const numA = parseInt(a.replace(/\D/g, '')) || 0;
        const numB = parseInt(b.replace(/\D/g, '')) || 0;
        return numA - numB;
    })
};

fs.writeFileSync(
    path.join(publicDataDir, 'filterOptions.json'),
    JSON.stringify(filterOptions, null, 2)
);

console.log('✨ All data files generated successfully in /public/data');
