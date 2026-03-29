import { getRoundData, loadRoundCutoffs } from './cutoffLoader.js';

const BRANCH_RELAXATION = {
    'CSE': ['IT', 'ECE', 'AI', 'ML', 'DS'],
    'IT': ['CSE', 'ECE'],
    'ECE': ['CSE', 'IT', 'ELECTRICAL'],
    'ME': ['EE', 'CIVIL', 'PRODUCTION']
};

const ROUND_SEQUENCE = [1, 2, 3, 4, 6, 7];

/**
 * Predicts college chances with multi-stage fallback logic.
 */
export const predictColleges = async (rank, category, quota, branch, round) => {
    let results = [];
    let isRelaxed = false;
    let searchStage = 'STRICT'; // STRICT, BRANCH_RELAXED, ROUND_RELAXED, CATEGORY_RELAXED

    // Helper to check for quality matches (High or Medium chance)
    const hasQualityMatches = (res) => res.some(r => r.chance === 'HIGH' || r.chance === 'MEDIUM');

    // Step 1: Strict Match
    results = await performSearch(rank, category, quota, branch, round);
    
    // Step 2: Relax Branch (Trigger if no HIGH/MEDIUM matches)
    if (!hasQualityMatches(results)) {
        isRelaxed = true;
        searchStage = 'BRANCH_RELAXED';
        const similarBranches = BRANCH_RELAXATION[branch.toUpperCase()] || [];
        for (const b of similarBranches) {
            const res = await performSearch(rank, category, quota, b, round);
            results = [...results, ...res];
        }
    }

    // Step 3: Relax Round (Trigger if still no HIGH/MEDIUM matches)
    if (!hasQualityMatches(results)) {
        isRelaxed = true;
        searchStage = 'ROUND_RELAXED';
        for (const r of ROUND_SEQUENCE) {
            if (r === Number(round)) continue;
            const res = await performSearch(rank, category, quota, branch, r);
            if (hasQualityMatches(res)) {
                results = [...results, ...res];
                // we keep going to aggregate all rounds' good matches
            }
        }
    }

    // Step 4: Relax Category (Trigger if still no results)
    if (results.length === 0 && category.toUpperCase() !== 'OPEN') {
        isRelaxed = true;
        searchStage = 'CATEGORY_RELAXED';
        results = await performSearch(rank, 'OPEN', quota, branch, round);
    }

    // Step 5: "Desperation" Search - Ignore Buffer, Get Top 10 Closest for this Category/Round
    if (results.length === 0) {
        isRelaxed = true;
        searchStage = 'MAX_RELAXED';
        const rawData = await getRoundData(round);
        results = rawData
            .filter(item => {
                const itemCat = item.category.toUpperCase();
                const searchCat = category.toUpperCase();
                return itemCat.includes(searchCat) || searchCat.includes(itemCat) || itemCat.includes('OPEN');
            })
            .map(college => ({
                ...college,
                chance: 'LOW',
                proximity: Math.abs(Number(college.closing_rank) - rank)
            }))
            .sort((a, b) => a.proximity - b.proximity)
            .slice(0, 15); // Increased to 15
    }

    // --- Finalize Prediction Output Flow ---
    
    // 1. Scoring & 50-College Priority List
    const chanceScores = { 'HIGH': 3, 'MEDIUM': 2, 'LOW': 1 };
    
    const COLLEGE_PRIORITY = [
        "INSTITUTE OF ENGINEERING AND TECHNOLOGY, LUCKNOW",
        "HARCOURT BUTLER TECHNICAL UNIVERSITY, KANPUR",
        "KAMLA NEHRU INSTITUTE OF TECHNOLOGY, SULTANPUR",
        "BUNDELKHAND INSTITUTE OF ENGINEERING AND TECHNOLOGY, JHANSI",
        "MADAN MOHAN MALAVIYA UNIVERSITY OF TECHNOLOGY, GORAKHPUR",
        "JSS ACADEMY OF TECHNICAL EDUCATION, NOIDA",
        "AJAY KUMAR GARG ENGINEERING COLLEGE, GHAZIABAD",
        "KRISHNA INSTITUTE OF ENGINEERING AND TECHNOLOGY, GHAZIABAD",
        "G.L. BAJAJ INSTITUTE OF TECHNOLOGY AND MANAGEMENT, GREATER NOIDA",
        "GALGOTIAS COLLEGE OF ENGINEERING AND TECHNOLOGY, GREATER NOIDA",
        "ABES ENGINEERING COLLEGE, GHAZIABAD",
        "ABES INSTITUTE OF TECHNOLOGY, GHAZIABAD",
        "NOIDA INSTITUTE OF ENGINEERING AND TECHNOLOGY, GREATER NOIDA",
        "IMS ENGINEERING COLLEGE, GHAZIABAD",
        "IIMT COLLEGE OF ENGINEERING, GREATER NOIDA",
        "PRANVEER SINGH INSTITUTE OF TECHNOLOGY, KANPUR",
        "RAJ KUMAR GOEL INSTITUTE OF TECHNOLOGY, GHAZIABAD",
        "GREATER NOIDA INSTITUTE OF TECHNOLOGY, GREATER NOIDA",
        "GLA UNIVERSITY, MATHURA",
        "SHARDA UNIVERSITY, GREATER NOIDA",
        "BENNETT UNIVERSITY, GREATER NOIDA",
        "SRM INSTITUTE OF SCIENCE AND TECHNOLOGY, NCR CAMPUS",
        "UNITED COLLEGE OF ENGINEERING AND RESEARCH, ALLAHABAD",
        "BBD NATIONAL INSTITUTE OF TECHNOLOGY AND MANAGEMENT, LUCKNOW",
        "BBD INSTITUTE OF TECHNOLOGY, GHAZIABAD",
        "LUCKNOW INSTITUTE OF TECHNOLOGY, LUCKNOW",
        "ACCURATE INSTITUTE OF MANAGEMENT AND TECHNOLOGY, GREATER NOIDA",
        "ITS ENGINEERING COLLEGE, GREATER NOIDA",
        "INVERTIS UNIVERSITY, BAREILLY",
        "MANGALMAY INSTITUTE OF ENGINEERING AND TECHNOLOGY, GREATER NOIDA",
        "INDERPRASTHA ENGINEERING COLLEGE, GHAZIABAD",
        "RADHA GOVIND ENGINEERING COLLEGE, MEERUT",
        "SANSKRITI UNIVERSITY, MATHURA",
        "RAJ KUMAR GOEL INSTITUTE OF MANAGEMENT, GHAZIABAD",
        "SKYLINE INSTITUTE OF ENGINEERING AND TECHNOLOGY, GREATER NOIDA",
        "VISHVESHWARYA GROUP OF INSTITUTIONS, GREATER NOIDA",
        "AXIS INSTITUTE OF TECHNOLOGY AND MANAGEMENT, KANPUR",
        "MEERUT INSTITUTE OF ENGINEERING AND TECHNOLOGY, MEERUT",
        "DEWAN V.S. INSTITUTE OF ENGINEERING AND TECHNOLOGY, MEERUT",
        "FIT GROUP OF INSTITUTIONS, MEERUT",
        "RAMA UNIVERSITY, KANPUR",
        "SUNDER DEEP ENGINEERING COLLEGE, GHAZIABAD",
        "ANAND ENGINEERING COLLEGE, AGRA",
        "BHAGWANT INSTITUTE OF TECHNOLOGY, MUZAFFARNAGAR",
        "KCMT COLLEGE OF ENGINEERING AND TECHNOLOGY, BAREILLY",
        "RAJSHREE INSTITUTE OF MANAGEMENT AND TECHNOLOGY, BAREILLY",
        "DR. RAM MANOHAR LOHIA AVADH UNIVERSITY INSTITUTE OF ENGINEERING AND TECHNOLOGY, AYODHYA",
        "UNITED INSTITUTE OF TECHNOLOGY, ALLAHABAD",
        "MAHARANA PRATAP ENGINEERING COLLEGE, KANPUR",
        "SR GROUP OF INSTITUTIONS, JHANSI"
    ];

    const getPriorityRank = (collegeName) => {
        const normalized = (collegeName || '').toUpperCase()
            .replace(/&/g, 'AND')
            .replace(/[,.]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();

        // Specific overrides for top colleges with highly variable names across rounds
        if (normalized.includes("G L BAJAJ") && !normalized.includes("MATHURA")) return 9;
        if (normalized.includes("KIET") || normalized.includes("KRISHNA INST")) return 8;
        if (normalized.includes("AJAY KUMAR GARG") || normalized.includes("AKG")) return 7;
        if (normalized.includes("JSS ACADEMY")) return 6;
        if (normalized.includes("MADAN MOHAN MALAVIYA") || normalized.includes("MMMUT")) return 5;
        if (normalized.includes("BUNDELKHAND INST") || normalized.includes("BIET")) return 4;
        if (normalized.includes("KAMLA NEHRU") || normalized.includes("KNIT")) return 3;
        if (normalized.includes("HARCOURT BUTLER") || normalized.includes("HBTU")) return 2;
        if (normalized.includes("INSTITUTE OF ENGINEERING AND TECHNOLOGY LUCKNOW") || normalized.includes("IET LUCKNOW")) return 1;

        const index = COLLEGE_PRIORITY.findIndex(p => {
            // Strip out city names commonly at the end after a comma, and normalize
            const pNorm = p.split(',')[0].toUpperCase()
                .replace(/&/g, 'AND')
                .replace(/[,.]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            return normalized.includes(pNorm);
        });
        return index !== -1 ? index + 1 : 999;
    };


    // 2. Remove Duplicates (College + Branch), keeping the best possible match
    const uniqueMap = new Map();
    results.forEach(r => {
        const key = `${r.college_name}_${r.branch}`.toUpperCase();
        const baseScore = chanceScores[r.chance] || 0;
        const priorityRank = getPriorityRank(r.college_name);
        
        // Final score for comparison: Higher base score is better.
        // If same base score, lower priorityRank (better college) is better.
        const existing = uniqueMap.get(key);
        const shouldUpdate = !existing || 
            baseScore > (chanceScores[existing.chance] || 0) ||
            (baseScore === (chanceScores[existing.chance] || 0) && priorityRank < existing.priorityRank) ||
            (baseScore === (chanceScores[existing.chance] || 0) && priorityRank === existing.priorityRank && Math.abs(Number(r.closing_rank) - rank) < Math.abs(Number(existing.closing_rank) - rank));

        if (shouldUpdate) {
            uniqueMap.set(key, { ...r, baseScore, priorityRank, isRelaxed, searchStage });
        }
    });

    // 3. Sort & Split into Final Categories
    const allProcessed = Array.from(uniqueMap.values()).sort((a, b) => {
        // Priority 1: Base Chance (HIGH > MEDIUM > LOW)
        if (a.baseScore !== b.baseScore) return b.baseScore - a.baseScore;
        // Priority 2: College Reputation/Rank (1 -> 50)
        if (a.priorityRank !== b.priorityRank) return a.priorityRank - b.priorityRank;
        // Priority 3: Competitive Margin
        return Number(a.closing_rank) - rank - (Number(b.closing_rank) - rank);
    });

    // 4. Split and Limit (Top 15 per group)
    return [
        ...allProcessed.filter(r => r.chance === 'HIGH').slice(0, 15),
        ...allProcessed.filter(r => r.chance === 'MEDIUM').slice(0, 15),
        ...allProcessed.filter(r => r.chance === 'LOW').slice(0, 15)
    ];
};

/**
 * Helper to perform a single-step search.
 */
async function performSearch(rank, category, quota, branch, round) {
    const fullRoundData = await getRoundData(round);
    if (!fullRoundData || fullRoundData.length === 0) return [];

    const searchCategory = (category || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const searchQuota = (quota || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
    const searchBranch = (branch || '').toUpperCase();
    
    // Split branch into keywords for more flexible matching (e.g., "Computer Science" -> ["COMPUTER", "SCIENCE"])
    const branchKeywords = searchBranch.split(/[\s&,/-]+/).filter(k => k.length > 2);

    const filtered = fullRoundData.filter(item => {
        const itemCategory = (item.category || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
        const itemQuota = (item.quota || '').toUpperCase().replace(/[^A-Z0-9]/g, '_');
        const itemBranch = (item.branch || '').toUpperCase();

        // 1. Category & Quota must be decent matches
        const catMatch = itemCategory.includes(searchCategory) || searchCategory.includes(itemCategory);
        const quotaMatch = itemQuota.includes(searchQuota) || searchQuota.includes(itemQuota);
        
        if (!catMatch || !quotaMatch) return false;

        // 2. Flexible Branch Match: Keyword check
        if (itemBranch.includes(searchBranch) || searchBranch.includes(itemBranch)) return true;
        
        // Check if all keywords match if search branch is long
        if (branchKeywords.length > 0) {
           return branchKeywords.every(k => itemBranch.includes(k));
        }

        return false;
    });

    return filtered.map(college => {
        let chance = 'LOW';
        const closingRank = Number(college.closing_rank);

        // Relaxed Rank Filter: 1.25x
        if (rank <= closingRank) {
            chance = 'HIGH';
        } else if (rank <= closingRank * 1.25) {
            chance = 'MEDIUM';
        }

        return {
            ...college,
            chance,
            proximity: Math.abs(closingRank - rank)
        };
    });
}
