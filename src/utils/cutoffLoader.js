/**
 * Cutoff Data Loader Utility
 * Optimized for O(1) lookups and single-fetch caching.
 */

let cutoffData = null;
let loadingPromise = null;

/**
 * Normalizes parameters to match the optimized JSON keys.
 */
const getNormalizedKey = (category, quota, branch) => {
    const clean = (str) => (str || '').toString().toUpperCase().replace(/[^A-Z0-9]/g, '_');
    
    // Simple branch normalization mapping
    let b = (branch || '').toLowerCase();
    if (b.includes('computer science')) b = 'CSE';
    else if (b.includes('information technology')) b = 'IT';
    else if (b.includes('electronics')) b = 'ECE';
    else if (b.includes('mechanical')) b = 'ME';

    // Simple quota normalization mapping
    let q = (quota || '').toLowerCase();
    if (q.includes('home state')) q = 'UPSTATE';
    else if (q.includes('all india')) q = 'ALL_INDIA';

    return `${clean(category)}_${clean(q)}_${clean(b)}`;
};

/**
 * Loads the round-based optimized cutoff data.
 */
export const loadRoundCutoffs = async () => {
    if (cutoffData) return cutoffData;
    
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        try {
            const response = await fetch('/src/data/cutoffs_by_round.json');
            if (!response.ok) throw new Error('Failed to load cutoff data');
            
            cutoffData = await response.json();
            return cutoffData;
        } catch (error) {
            console.error('Error loading round cutoffs:', error);
            loadingPromise = null;
            throw error;
        }
    })();

    return loadingPromise;
};

/**
 * Returns data for a specific round.
 */
export const getRoundData = async (round) => {
    const data = await loadRoundCutoffs();
    return data[`round_${round}`] || [];
};

/**
 * Returns all available keys (useful for debugging or dynamic filtering).
 */
export const getAllKeys = async () => {
    const data = await loadCutoffs();
    return Object.keys(data);
};
