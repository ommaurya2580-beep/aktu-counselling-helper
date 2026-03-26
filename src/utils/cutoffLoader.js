/**
 * Cutoff Data Loader Utility
 * Optimized for O(1) lookups and single-fetch caching.
 * Production-ready with robust error handling and in-memory caching.
 */

// In-memory cache for fetched data
const cache = {
    roundCutoffs: null,
    allCutoffs: null
};

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
 * Optimized with in-memory caching and production-safe error handling.
 */
export const loadRoundCutoffs = async () => {
    // Return cached data if available
    if (cache.roundCutoffs) return cache.roundCutoffs;
    
    // Return existing loading promise to avoid parallel fetches
    if (loadingPromise) return loadingPromise;

    loadingPromise = (async () => {
        try {
            console.log('Fetching round cutoffs from production-safe path...');
            const response = await fetch('/data/cutoffs_by_round.json');
            
            // Validate response
            if (!response.ok) {
                throw new Error(`Failed to load cutoff data: ${response.status} ${response.statusText}`);
            }
            
            const data = await response.json();
            
            // Validate data structure
            if (!data || typeof data !== 'object') {
                throw new Error('Invalid data format received from server');
            }

            // Cache for future use
            cache.roundCutoffs = data;
            return data;
        } catch (error) {
            console.error('CRITICAL: Error loading round cutoffs:', error.message);
            loadingPromise = null;
            // Return empty fallback object to prevent application crash
            return {}; 
        } finally {
            loadingPromise = null;
        }
    })();

    return loadingPromise;
};

/**
 * Returns data for a specific round.
 */
export const getRoundData = async (round) => {
    try {
        const data = await loadRoundCutoffs();
        const roundKey = `round_${round}`;
        return data[roundKey] || [];
    } catch (error) {
        console.error(`Error getting data for round ${round}:`, error);
        return [];
    }
};

/**
 * Returns all available keys (useful for debugging or dynamic filtering).
 */
export const getAllKeys = async () => {
    try {
        const data = await loadRoundCutoffs();
        return Object.keys(data || {});
    } catch (error) {
        console.error('Error getting all keys:', error);
        return [];
    }
};
