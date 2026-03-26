import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const dataDir = path.join(__dirname, '../src/data');
const inputFile = path.join(dataDir, 'all_cutoffs.json');
const outputFile = path.join(dataDir, 'cutoffs_optimized.json');

if (!fs.existsSync(inputFile)) {
    console.error(`Source file not found: ${inputFile}`);
    process.exit(1);
}

const rawData = JSON.parse(fs.readFileSync(inputFile, 'utf8'));

// Normalization mappings
const branchMap = {
    'computer science': 'CSE',
    'information technology': 'IT',
    'electronics': 'ECE',
    'mechanical': 'ME'
};

const quotaMap = {
    'home state': 'UPSTATE',
    'all india': 'ALL_INDIA'
};

const optimizedData = {};

rawData.forEach(item => {
    // 1. Normalize Branch
    let normalizedBranch = item.branch.toLowerCase();
    for (const [key, value] of Object.entries(branchMap)) {
        if (normalizedBranch.includes(key)) {
            normalizedBranch = value;
            break;
        }
    }

    // 2. Normalize Quota (optional but good for key consistency)
    let normalizedQuota = item.quota.toLowerCase();
    for (const [key, value] of Object.entries(quotaMap)) {
        if (normalizedQuota.includes(key)) {
            normalizedQuota = value;
            break;
        }
    }

    // 3. Construct Key: ${category}_${quota}_${branch}
    const category = item.category.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const quota = normalizedQuota.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const branch = normalizedBranch.toUpperCase().replace(/[^A-Z0-9]/g, '_');
    
    const key = `${category}_${quota}_${branch}`;

    if (!optimizedData[key]) {
        optimizedData[key] = [];
    }

    optimizedData[key].push({
        college_name: item.college_name,
        branch: item.branch, // Keep original branch for UI if needed
        opening_rank: item.opening_rank,
        closing_rank: item.closing_rank,
        round: item.round
    });
});

// 4. Sort each array by closing_rank ascending
Object.keys(optimizedData).forEach(key => {
    optimizedData[key].sort((a, b) => a.closing_rank - b.closing_rank);
});

// 5. Save to file
fs.writeFileSync(outputFile, JSON.stringify(optimizedData, null, 2));

console.log(`Optimization complete!`);
console.log(`Total Groups: ${Object.keys(optimizedData).length}`);
console.log(`File saved to: ${outputFile}`);
