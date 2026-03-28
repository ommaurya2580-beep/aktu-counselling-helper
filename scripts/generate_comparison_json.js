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
    const data = XLSX.utils.sheet_to_json(sheet);

    const collegeMap = {};

    data.forEach(row => {
        // Handle headers with special characters by finding the keys that contain the target string
        const keys = Object.keys(row);
        const instKey = keys.find(k => k.includes('Institute'));
        const progKey = keys.find(k => k.includes('Program'));
        const streamKey = keys.find(k => k.includes('Stream'));
        const openKey = keys.find(k => k.includes('Opening Rank'));
        const closeKey = keys.find(k => k.includes('Closing Rank'));

        const instituteName = normalize(row[instKey]);
        const program = row[progKey] || '';
        const stream = row[streamKey] || '';
        const branch = `${program} ${stream}`.trim();
        const openingRank = parseInt(row[openKey]) || null;
        const closingRank = parseInt(row[closeKey]) || null;

        if (!instituteName) return;

        if (!collegeMap[instituteName]) {
            collegeMap[instituteName] = [];
        }

        collegeMap[instituteName].push({
            branch,
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
