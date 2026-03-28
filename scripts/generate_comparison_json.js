import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';

const LIB_DIR = 'C:\\Users\\ommau\\OneDrive\\Desktop\\aktu caunciling\\lib';
const OUTPUT_FILE = 'C:\\Users\\ommau\\OneDrive\\Desktop\\aktu caunciling\\public\\data\\comparison_fast.json';

const rounds = [
    { key: 'round_1', file: 'aktu_round1.xlsx' },
    { key: 'round_2', file: 'aktu_round2.xlsx' },
    { key: 'round_3', file: 'aktu_round3.xlsx' },
    { key: 'round_4', file: 'aktu_round4.xlsx' },
    { key: 'round_6', file: 'aktu_round6.xlsx' },
    { key: 'round_7', file: 'aktu_round7.xlsx' }
];

function normalize(str) {
    if (!str) return '';
    return str
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")  // remove dots, commas, and other special characters
        .replace(/\s+/g, " ")        // collapse multiple spaces
        .trim();
}

function processRound(filePath) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    // using header: 1 to get arrays instead of objects, to handle files without headers
    const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

    const collegeMap = {};

    data.forEach(row => {
        if (!row || row.length < 8) return;
        
        let offset = 0;
        // Check if the first column is a Serial Number
        if (typeof row[0] === 'number' || (typeof row[0] === 'string' && /^\d+$/.test(row[0]))) {
            offset = 1;
        } else if (typeof row[0] === 'string' && row[0].includes('Round')) {
            // Verify if it's a header row
            if (row[1] && row[1].includes('Institute')) {
                return; // Skip header
            }
            offset = 0;
        } else {
            return; // invalid row
        }

        const rawInst = row[1 + offset];
        if (!rawInst || typeof rawInst !== 'string') return;
        
        const instituteName = normalize(rawInst);
        const program = row[2 + offset] || '';
        const stream = row[3 + offset] || '';
        const branch = `${program} ${stream}`.trim();
        const quota = row[4 + offset] || '';
        const category = row[5 + offset] || '';
        const gender = row[6 + offset] || '';
        const openingRank = parseInt(row[7 + offset]) || null;
        const closingRank = parseInt(row[8 + offset]) || null;

        if (!instituteName || !category) return;

        if (!collegeMap[instituteName]) {
            collegeMap[instituteName] = [];
        }

        collegeMap[instituteName].push({
            branch,
            quota,
            category,
            gender,
            opening_rank: openingRank,
            closing_rank: closingRank
        });
    });

    return collegeMap;
}

const finalData = {};

rounds.forEach(round => {
    const filePath = path.join(LIB_DIR, round.file);
    if (fs.existsSync(filePath)) {
        console.log(`Processing ${round.key}...`);
        finalData[round.key] = {
            college_map: processRound(filePath)
        };
    } else {
        console.warn(`File not found: ${filePath}`);
    }
});

// Create directory if it doesn't exist
const dir = path.dirname(OUTPUT_FILE);
if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}

fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));
console.log(`Successfully generated ${OUTPUT_FILE}`);
