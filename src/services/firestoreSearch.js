import { collection, query, where, getDocs, limit, orderBy, startAfter } from "firebase/firestore";
import { normalizeString } from "../utils/stringUtils";

export const fetchFilteredCutoffs = async (db, filters) => {
    const constraints = [];

    // 1. Dynamic equality filters
    if (filters.year && filters.year !== 'all') {
        constraints.push(where('year', '==', Number(filters.year)));
    }
    
    // Ignore "all" and "All Rounds"
    if (filters.round && filters.round !== 'all' && filters.round !== 'All Rounds') {
        const roundNumber = filters.round.replace(/round/i, "").trim();
        constraints.push(where('round', '==', Number(roundNumber)));
    }

    // Use normalized field
    if (filters.institute && filters.institute !== 'all') {
        constraints.push(where('institute_normalized', '==', normalizeString(filters.institute)));
    }

    // Use normalized field
    if (filters.program && filters.program !== 'all') {
        constraints.push(where('program_normalized', '==', normalizeString(filters.program)));
    }

    if (filters.category && filters.category !== 'all' && filters.category !== 'All Categories') {
        constraints.push(where('category', '==', filters.category));
    }

    if (filters.quota && filters.quota !== 'all' && filters.quota !== 'All Quotas') {
        constraints.push(where('quota', '==', filters.quota));
    }

    if (filters.gender && filters.gender !== 'all' && filters.gender !== 'All Genders') {
        constraints.push(where('gender', '==', filters.gender));
    }

    // Optional: Add orderBy for closing_rank if specified
    if (filters.orderByRank) {
        constraints.push(orderBy('closing_rank', 'asc'));
    }

    // Limit to prevent massive reads
    const fetchLimit = filters.limit ? filters.limit : 500;
    constraints.push(limit(fetchLimit));

    // Pagination support
    if (filters.lastDocSnapshot) {
        constraints.push(startAfter(filters.lastDocSnapshot));
    }

    const q = query(collection(db, 'cutoffs'), ...constraints);

    // 2. Fetch results
    const snapshot = await getDocs(q);
    
    let results = [];
    snapshot.forEach(doc => {
        results.push({ id: doc.id, ...doc.data() });
    });

    return {
        results,
        lastDocSnapshot: snapshot.docs.length > 0 ? snapshot.docs[snapshot.docs.length - 1] : null,
        hasMore: snapshot.docs.length === fetchLimit
    };
};
