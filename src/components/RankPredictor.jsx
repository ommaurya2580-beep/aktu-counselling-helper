import React, { useState, useEffect, useMemo } from 'react';

// STEP 1: NORMALIZATION FUNCTION
const normalize = (str) =>
  String(str || "").toLowerCase().trim();

const COLLEGE_PRIORITY = [
  "institute of engineering and technology, lucknow",
  "harcourt butler technical university, kanpur",
  "kamla nehru institute of technology, sultanpur",
  "bundelkhand institute of engineering and technology, jhansi",
  "madan mohan malaviya university of technology, gorakhpur",
  "jss academy of technical education, noida",
  "ajay kumar garg engineering college, ghaziabad",
  "krishna institute of engineering and technology, ghaziabad",
  "g.l. bajaj institute of technology and management, greater noida",
  "galgotias college of engineering and technology, greater noida",
  "abes engineering college, ghaziabad",
  "abes institute of technology, ghaziabad",
  "noida institute of engineering and technology, greater noida",
  "ims engineering college, ghaziabad",
  "iimt college of engineering, greater noida",
  "pranveer singh institute of technology, kanpur",
  "raj kumar goel institute of technology, ghaziabad",
  "greater noida institute of technology, greater noida",
  "gla university, mathura",
  "sharda university, greater noida",
  "bennett university, greater noida",
  "srm institute of science and technology, ncr campus",
  "united college of engineering and research, allahabad",
  "bbd national institute of technology and management, lucknow",
  "bbd institute of technology, ghaziabad",
  "lucknow institute of technology, lucknow",
  "accurate institute of management and technology, greater noida",
  "its engineering college, greater noida",
  "invertis university, bareilly",
  "mangalmay institute of engineering and technology, greater noida",
  "inderprastha engineering college, ghaziabad",
  "radha govind engineering college, meerut",
  "sanskriti university, mathura",
  "raj kumar goel institute of management, ghaziabad",
  "skyline institute of engineering and technology, greater noida",
  "vishveshwarya group of institutions, greater noida",
  "axis institute of technology and management, kanpur",
  "meerut institute of engineering and technology, meerut",
  "dewan v.s. institute of engineering and technology, meerut",
  "fit group of institutions, meerut",
  "rama university, kanpur",
  "sunder deep engineering college, ghaziabad",
  "anand engineering college, agra",
  "bhagwant institute of technology, muzaffarnagar",
  "kcmt college of engineering and technology, bareilly",
  "rajshree institute of management and technology, bareilly",
  "dr. ram manohar lohia avadh university institute of engineering and technology, ayodhya",
  "united institute of technology, allahabad",
  "maharana pratap engineering college, kanpur",
  "sr group of institutions, jhansi"
];

const getCollegePriority = (instituteName) => {
  const normName = normalize(instituteName);
  const index = COLLEGE_PRIORITY.findIndex(pName => normName.includes(pName));
  return index !== -1 ? index : 9999;
};

const RankPredictor = ({ uniqueCategories, uniqueQuotas, uniquePrograms }) => {
  const [allCutoffs, setAllCutoffs] = useState([]);
  
  const [filters, setFilters] = useState({
    rank: '',
    category: '',
    quota: '',
    branch: ''
  });
  
  const [activeFilters, setActiveFilters] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/cutoffs.min.json')
      .then(res => res.json())
      .then(data => {
        const normalized = (data || []).map(item => ({
          ...item,
          priorityIndex: getCollegePriority(item.institute),
          category_lower: normalize(item.category),
          quota_lower: normalize(item.quota),
          program_lower: normalize(item.program),
          round_num: Number(String(item.round).replace(/\D/g, ""))
        }));
        setAllCutoffs(normalized);
      })
      .catch(err => console.error("Error loading cutoffs:", err));
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const fetchPredictions = () => {
    if (!filters.rank || !filters.category || !filters.quota || !filters.branch) {
      setError("Please fill all required fields");
      return;
    }

    const userRank = Number(filters.rank);
    if (isNaN(userRank) || userRank <= 0) {
      setError("Please enter a valid numeric rank.");
      return;
    }

    setLoading(true);
    setError(null);
    setActiveFilters(null);

    // Using setTimeout to allow UI to show loading state
    setTimeout(() => {
      setActiveFilters({ ...filters, userRank });
      setLoading(false);
    }, 50);
  };

  // STEP 2: BASE FILTER (CATEGORY + QUOTA + BRANCH)
  const baseFiltered = useMemo(() => {
    if (!activeFilters || !allCutoffs.length) return [];
    
    const selectedCategory = normalize(activeFilters.category);
    const selectedQuota = normalize(activeFilters.quota);
    const selectedBranch = normalize(activeFilters.branch);
    
    return allCutoffs.filter(item => {
      return (
        item.category_lower === selectedCategory &&
        item.quota_lower === selectedQuota &&
        item.program_lower.includes(selectedBranch)
      );
    });
  }, [allCutoffs, activeFilters]);

  // STEP 3: GROUP BY ROUND
  const roundsMap = useMemo(() => {
    const map = { 1: [], 2: [], 3: [], 4: [] };
    if (!baseFiltered.length) return map;

    baseFiltered.forEach(item => {
      if (map[item.round_num]) map[item.round_num].push(item);
    });

    return map;
  }, [baseFiltered]);

  // STEP 5: PROCESS EACH ROUND
  const predictions = useMemo(() => {
    // STEP 14: DEBUG (MANDATORY)
    console.log("Filtered:", baseFiltered.length);
    if (roundsMap[1]) console.log("Round1:", roundsMap[1].length);
    if (roundsMap[4]) console.log("Round4:", roundsMap[4].length);

    if (!activeFilters || !baseFiltered.length) return null;
    
    const userRank = activeFilters.userRank;

    const processRound = (roundItems, roundNumber) => {
      const candidates = [];

      for (let item of roundItems) {
        const closing = Number(item.closing_rank);
        if (isNaN(closing)) continue;
        
        const gap = closing - userRank;

        // STEP 4: STRICT CONDITIONS
        if (closing <= userRank) continue;
        if (gap < 1000 || gap > 10000) continue;

        let status = "MODERATE";
        if (gap <= 4000) status = "SAFE";
        else if (gap > 7000) status = "RISKY";

        candidates.push({
          ...item,
          gap,
          status,
          round: roundNumber
        });
      }

      // STEP 6: SORTING (TOP → BOTTOM COLLAGE CHECK)
      candidates.sort((a, b) => {
        if (a.priorityIndex !== b.priorityIndex) {
          return a.priorityIndex - b.priorityIndex;
        }
        return Number(a.closing_rank) - Number(b.closing_rank);
      });

      // STEP 7: INTERNAL CHECK LIMIT
      const topCandidates = candidates.slice(0, 50);

      // STEP 8: REMOVE DUPLICATES
      const unique = [];
      const seen = new Set();
      for (let item of topCandidates) {
        const key = item.institute;

        if (!seen.has(key)) {
          seen.add(key);
          unique.push(item);
        }

        if (unique.length === 5) break;
      }

      // STEP 12: FALLBACK (VERY IMPORTANT)
      if (unique.length === 0) {
        const fallbackItems = [...roundItems]
          .filter(item => Number(item.closing_rank) > userRank)
          .sort((a, b) => Number(a.closing_rank) - Number(b.closing_rank));

        const fbUnique = [];
        const fbSeen = new Set();
        for (let item of fallbackItems) {
          const key = item.institute;
          if (!fbSeen.has(key)) {
            fbSeen.add(key);
            fbUnique.push({
              ...item,
              gap: Number(item.closing_rank) - userRank,
              status: "RISKY", // It's a fallback so it's risky/out of range
              round: roundNumber
            });
          }
          if (fbUnique.length === 5) break;
        }

        return fbUnique;
      }

      // STEP 9: FINAL RETURN
      return unique;
    };

    // STEP 10: APPLY TO ALL ROUNDS
    return {
      1: processRound(roundsMap[1], 1),
      2: processRound(roundsMap[2], 2),
      3: processRound(roundsMap[3], 3),
      4: processRound(roundsMap[4], 4)
    };
  }, [activeFilters, baseFiltered, roundsMap]);

  // STATUS COLORS
  const getChanceBadge = (status) => {
      if (status === "SAFE") return { text: "Safe", color: "#10b981" }; // Green
      if (status === "MODERATE") return { text: "Moderate", color: "#f59e0b" }; // Yellow
      if (status === "RISKY") return { text: "Risky", color: "#ef4444" }; // Red
      return { text: "Unknown", color: "#6b7280" }; // Gray fallback
  };

  const hasAnyPredictions = predictions && [1, 2, 3, 4].some(roundNum => predictions[roundNum] && predictions[roundNum].length > 0);

  return (
    <div className="glass-container analytics-container" style={{ animation: 'fadeIn 0.5s ease-in-out' }}>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .hover-scale {
            transition: transform 0.2s ease, box-shadow 0.2s ease;
          }
          .hover-scale:hover {
            transform: translateY(-4px);
            box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.3);
          }
        `}
      </style>

      <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>College Rank Predictor</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Enter your rank to see personalized admission chances based on historical counseling data.
      </p>

      <div className="filter-grid" style={{ marginBottom: '2rem' }}>
        <div className="filter-group">
          <label>Your Expected/Actual Rank *</label>
          <input 
            type="number" 
            name="rank" 
            value={filters.rank} 
            onChange={handleFilterChange} 
            placeholder="e.g. 45000"
            style={{ padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--glass-border)', background: 'rgba(255, 255, 255, 0.05)', color: 'white', width: '100%' }}
          />
        </div>
        <div className="filter-group">
          <label>Category *</label>
          <select name="category" value={filters.category} onChange={handleFilterChange}>
            <option value="">Select Category</option>
            {uniqueCategories && uniqueCategories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Quota *</label>
          <select name="quota" value={filters.quota} onChange={handleFilterChange}>
            <option value="">Select Quota</option>
            {uniqueQuotas && uniqueQuotas.map((quota, i) => <option key={i} value={quota}>{quota}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Preferred Branch *</label>
          <select name="branch" value={filters.branch} onChange={handleFilterChange}>
            <option value="">Select Branch</option>
            {uniquePrograms && uniquePrograms.map((prog, i) => <option key={i} value={prog}>{prog}</option>)}
          </select>
        </div>
      </div>

      <button className="search-btn" onClick={fetchPredictions} disabled={loading} style={{ marginBottom: '2rem' }}>
        {loading ? "Predicting colleges..." : "Predict Colleges"}
      </button>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171', borderRadius: '8px', marginBottom: '1.5rem', animation: 'fadeIn 0.3s ease-in-out' }}>
          {error}
        </div>
      )}

      {/* STEP 13: UI RULES */}
      {predictions && (
        <div style={{ marginTop: '2rem', animation: 'fadeIn 0.5s ease-in-out' }}>
          {!hasAnyPredictions && (
            <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
              No suitable colleges found for your rank across all rounds. Try to relax your parameters.
            </div>
          )}
          
          {[1, 2, 3, 4].map(roundNum => {
            const roundData = predictions[roundNum];
            
            return (
              <div key={`round-${roundNum}`} style={{ marginBottom: '3rem' }}>
                <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                  👉 Round {roundNum} Recommendations
                </h3>
                
                {(!roundData || roundData.length === 0) ? (
                  <div style={{ padding: '1rem', background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.1)', borderRadius: '8px', color: 'var(--text-secondary)' }}>
                    No suitable colleges found in this round
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                    {roundData.map((row, i) => {
                      const chanceInfo = getChanceBadge(row.status);
                      const gapText = row.gap > 0 ? `+${row.gap.toLocaleString()}` : row.gap.toLocaleString();

                      return (
                        <div key={i} className={'glass-container hover-scale'} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: `4px solid ${chanceInfo.color}` }}>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span style={{
                                background: 'rgba(255,255,255,0.15)',
                                color: 'var(--text-primary)',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.8rem',
                                fontWeight: '600'
                              }} >
                                🏅 {chanceInfo.text} Choice
                              </span>
                            </div>
                            
                            <span style={{
                              background: 'rgba(255,255,255,0.05)',
                              padding: '4px 10px',
                              borderRadius: '4px',
                              fontSize: '0.8rem',
                              color: 'var(--text-secondary)'
                            }}>
                              Round {roundNum}
                            </span>
                          </div>

                          <div>
                            <h4 style={{ color: 'var(--text-primary)', margin: '0.5rem 0', fontSize: '1.15rem', lineHeight: '1.4' }}>{row.institute}</h4>
                            <p style={{ color: 'var(--text-secondary)', margin: 0, fontSize: '0.95rem' }}>{row.program}</p>
                          </div>
                          
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: 'auto', paddingTop: '1.2rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                            <div>
                              <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
                                Closing Rank
                              </span>
                              <strong style={{ color: 'var(--text-primary)', fontSize: '1.2rem' }}>
                                {Number(row.closing_rank).toLocaleString()}
                              </strong>
                            </div>
                            
                            <div style={{ textAlign: 'right' }}>
                              <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                                Rank Gap
                              </span>
                              <span style={{
                                color: row.gap >= 0 ? '#10b981' : '#ef4444',
                                fontWeight: '600',
                                fontSize: '0.95rem'
                              }}>
                                {gapText}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RankPredictor;
