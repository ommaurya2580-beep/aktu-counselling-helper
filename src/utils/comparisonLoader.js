/**
 * Utility to load and cache comparison data for fast college lookup.
 */

let comparisonData = null;
let loadingPromise = null;

export function normalize(str) {
    if (!str) return '';
    return str
        .toString()
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .replace(/\s+/g, " ")
        .trim();
}

/**
 * Normalizes branch names to ensure consistent comparison.
 * Maps common abbreviations (e.g., "CSE") to their full names.
 * 
 * @param {string} branch - The branch name to normalize.
 * @returns {string} The normalized branch name.
 */
function normalizeBranch(branch) {
    if (!branch) return '';
    const normalized = branch.toLowerCase().trim();
    
    const branchNormalizationMap = {
        "cse": "computer science and engineering",
        "it": "information technology",
        "me": "mechanical engineering",
        "ce": "civil engineering",
        "ee": "electrical engineering",
        "ece": "electronics and communication engineering",
        "en": "electrical and electronics engineering"
    };

    return branchNormalizationMap[normalized] || normalized;
}

/**
 * Searches for a college in the map using partial matching.
 * This ensures that shorter UI names (e.g., "G.L. Bajaj Institute")
 * correctly match the full names in the Excel data.
 * 
 * @param {Object} map - The college_map from the comparison data.
 * @param {string} input - The college name input from the UI.
 * @returns {Array} The branch data for the matched college, or an empty array.
 */
function findCollege(map, input) {
    const normInput = normalize(input);
    console.log("Searching:", normInput);
    
    // First try exact match for performance
    if (map[normInput]) {
        console.log("Matched (Exact):", normInput);
        return map[normInput];
    }

    // Fallback to partial match if exact match fails
    for (let key in map) {
        if (key.includes(normInput)) {
            console.log("Matched (Partial):", key);
            return map[key];
        }
    }

    console.log("No match found for:", normInput);
    return [];
}

/**
 * Loads the comparison_fast.json data from the public data directory.
 * Implements in-memory caching to ensure the data is only fetched once.
 * 
 * @returns {Promise<Object>} The comparison data object.
 */
export async function loadComparisonData() {
    // Return cached data if available
    if (comparisonData) return comparisonData;

    // Return existing loading promise to avoid parallel fetches
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        try {
            console.log('Loading fast comparison data...');
            const response = await fetch('/data/comparison_fast.json');
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Cache for future use
            comparisonData = data;
            return data;
        } catch (error) {
            console.error('Failed to load comparison data:', error);
            loadingPromise = null;
            // Return empty object as fallback to prevent app failure
            return {};
        } finally {
            loadingPromise = null;
        }
    })();

    return loadingPromise;
}

/**
 * Helper to get data for a specific college in a specific round.
 * 
 * @param {string} roundKey - The round key (e.g., 'round_1')
 * @param {string} collegeName - Original college name (will be normalized)
 * @returns {Promise<Array|null>} Array of branch data or null if not found.
 */
export async function getCollegeComparisonData(roundKey, collegeName) {
    const data = await loadComparisonData();
    const roundData = data[roundKey]?.college_map || {};
    return findCollege(roundData, collegeName) || null;
    
    return null;
}

/**
 * Fast college lookup using map-based structure.
 * 
 * @param {Object} data - The full comparison data object.
 * @param {Array<string>} colleges - List of college names to look up.
 * @param {string|number} round - The round number or key component (e.g., 1 or 'round_1').
 * @returns {Object} Result mapping original college names to their branch data.
 */
export function getCollegeData(data, colleges, round) {
    const roundKey = typeof round === 'string' && round.startsWith('round_') ? round : `round_${round}`;
    const map = data[roundKey]?.college_map || {};

    const result = {};

    colleges.forEach(college => {
        result[college] = findCollege(map, college);
    });

    return result;
}

/**
 * Fast comparison logic using map-based lookup results.
 * Performs direct O(1) lookups without scanning the full dataset.
 * 
 * @param {Object} data - The full comparison data object.
 * @param {Array<string>} colleges - List of college names to compare.
 * @param {string|number} round - The round number or key component (e.g., 1 or 'round_1').
 * @returns {Object} Result mapping original college names to their branch data.
 */
export function compareFast(data, colleges, round) {
    const roundKey = typeof round === 'string' && round.startsWith('round_') ? round : `round_${round}`;
    const roundData = data[roundKey]?.college_map || {};

    const result = {};

    colleges.forEach(college => {
        result[college] = findCollege(roundData, college);
    });

    return result;
}

/**
 * Groups college data by branch and filters for branches present in at least 2 colleges.
 * 
 * @param {Object} collegeData - Result from compareFast or getCollegeData.
 * @returns {Object} Branch-wise mapping of college cutoff data.
 */
export function compareBranches(collegeData) {
    const branchMap = {};

    Object.entries(collegeData).forEach(([college, branches]) => {
        branches.forEach(b => {
            const normalizedBranch = normalizeBranch(b.branch);
            if (!branchMap[normalizedBranch]) {
                branchMap[normalizedBranch] = [];
            }
            branchMap[normalizedBranch].push({
                college,
                closing: b.closing_rank,
                opening_rank: b.opening_rank,
                category: b.category,
                originalBranch: b.branch // Keep original name for display
            });
        });
    });

    // Filter only common branches if more than 1 college is selected
    const numColleges = Object.keys(collegeData).length;
    if (numColleges > 1) {
        Object.keys(branchMap).forEach(branch => {
            if (branchMap[branch].length < 2) {
                delete branchMap[branch];
            }
        });
    }

    return branchMap;
}

/**
 * Identifies the winning college for a specific branch based on the lowest closing rank.
 * 
 * @param {Array} branchData - List of { college, closing } objects for a branch.
 * @returns {Object} The winning college object.
 */
export function findWinner(branchData) {
    if (!branchData || branchData.length === 0) return null;
    return [...branchData].sort((a, b) => a.closing - b.closing)[0];
}
