import fs from 'fs';
import path from 'path';

const DATA_DIR = 'C:\\Users\\ommau\\OneDrive\\Desktop\\aktu caunciling\\public\\data';
const OUTPUT_FILE = path.join(DATA_DIR, 'comparison_fast.json');

function normalize(str) {
    if (!str) return '';
    return str
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

async function updateComparisonData() {
    try {
        console.log('Reading cutoff files...');
        const cutoffsFull = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cutoffs.json'), 'utf8'));
        const cutoffsMin = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'cutoffs.min.json'), 'utf8'));
        const round1 = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'aktu_round1.json'), 'utf8'));
        const round2 = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'aktu_round2.json'), 'utf8'));
        const round3 = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'aktu_round3.json'), 'utf8'));
        const round4 = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'aktu_round4.json'), 'utf8'));
        const round6 = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'aktu_round6.json'), 'utf8'));
        const round7 = JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'aktu_round7.json'), 'utf8'));

        console.log(`Loaded ${cutoffsFull.length} records from cutoffs.json`);
        console.log(`Loaded ${cutoffsMin.length} records from cutoffs.min.json`);

        const allData = [...cutoffsFull, ...cutoffsMin, ...round1, ...round2, ...round3, ...round4, ...round6, ...round7];
        const finalData = {};

        allData.forEach(item => {
            const rawRound = item.round || '1';
            const roundKey = `round_${rawRound}`;
            
            const rawInst = item.institute || item.college_name || "";
            const instituteName = normalize(rawInst);
            
            const branch = (item.program || item.branch || "").toUpperCase();
            const quota = item.quota || '';
            const category = item.category || '';
            const gender = item.gender || '';
            const openingRank = parseInt(item.opening_rank) || null;
            const closingRank = parseInt(item.closing_rank) || null;

            if (!instituteName || !category) return;

            if (!finalData[roundKey]) {
                finalData[roundKey] = { college_map: {} };
            }

            const collegeMap = finalData[roundKey].college_map;

            if (!collegeMap[instituteName]) {
                collegeMap[instituteName] = [];
            }

            // Deduplicate logic (optional but good for performance)
            const isDuplicate = collegeMap[instituteName].some(existing => 
                existing.branch === branch &&
                existing.category === category &&
                existing.quota === quota &&
                existing.gender === gender &&
                existing.closing_rank === closingRank
            );

            if (!isDuplicate) {
                collegeMap[instituteName].push({
                    branch,
                    quota,
                    category,
                    gender,
                    opening_rank: openingRank,
                    closing_rank: closingRank
                });
            }
        });

        fs.writeFileSync(OUTPUT_FILE, JSON.stringify(finalData, null, 2));
        console.log(`Successfully generated ${OUTPUT_FILE}`);
        
        // Count institutes in round 1
        const instCount = Object.keys(finalData['round_1']?.college_map || {}).length;
        console.log(`Total unique institutes in Round 1: ${instCount}`);

    } catch (err) {
        console.error('Error updating comparison data:', err);
    }
}

updateComparisonData();
