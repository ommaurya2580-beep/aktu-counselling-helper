import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const dataDir = path.join(__dirname, '../public/data');
const inputFile = path.join(dataDir, 'all_cutoffs.json');
const outputFile = path.join(dataDir, 'cutoffs_by_round.json');

if (!fs.existsSync(inputFile)) {
    console.error(`Source file not found: ${inputFile}`);
    process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// Normalization mapping for branch
const branchMap = {
    'computer science': 'CSE',
    'information technology': 'IT',
    'electronics': 'ECE',
    'mechanical': 'ME'
};

const optimizedData = {
    "round_1": [],
    "round_2": [],
    "round_3": [],
    "round_4": [],
    "round_6": [],
    "round_7": []
};

rawData.forEach(item => {
    // 1. Normalize Branch
    let normalizedBranch = item.branch.toLowerCase();
    for (const [key, value] of Object.entries(branchMap)) {
        if (normalizedBranch.includes(key)) {
            normalizedBranch = value;
            break;
        }
    }
    
    // Ensure it matches the requested uppercase format if not mapped
    if (!Object.values(branchMap).includes(normalizedBranch)) {
        normalizedBranch = normalizedBranch.toUpperCase();
    }

    // 2. Map to round key
    const roundKey = `round_${item.round}`;
    
    if (optimizedData[roundKey]) {
        optimizedData[roundKey].push({
            college_name: item.college_name,
            branch: normalizedBranch,
            category: item.category,
            quota: item.quota,
            opening_rank: item.opening_rank,
            closing_rank: item.closing_rank,
            round: item.round
        });
    }
});

// 3. Sort each round by closing_rank ascending
Object.keys(optimizedData).forEach(key => {
    optimizedData[key].sort((a, b) => a.closing_rank - b.closing_rank);
});

// 4. Save to file
fs.writeFileSync(outputFile, JSON.stringify(optimizedData, null, 2));

console.log(`✅ Round-based optimization complete!`);
console.log(`Processed ${rawData.length} records into ${Object.keys(optimizedData).length} rounds.`);
console.log(`File saved to: ${outputFile}`);
