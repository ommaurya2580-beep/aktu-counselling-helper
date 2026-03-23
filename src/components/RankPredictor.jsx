import React, { useState, useEffect, useMemo } from 'react';

// STEP 2 — NORMALIZE FUNCTION
const normalize = (str) =>
  String(str || "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();

const RankPredictor = ({ uniqueCategories, uniqueQuotas, uniquePrograms }) => {
  // STEP 1 — LOAD DATA (LOCAL COPY FOR SPEED)
  const [allCutoffs, setAllCutoffs] = useState([]);
  
  const [filters, setFilters] = useState({
    rank: '',
    category: '',
    quota: '',
    branch: ''
  });
  
  const [predictions, setPredictions] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/cutoffs.min.json')
      .then(res => res.json())
      .then(data => {
        // pre-normalize for performance
        const normalized = data.map(item => ({
          ...item,
          institute_lower: normalize(item.institute),
          program_lower: normalize(item.program),
          category_lower: normalize(item.category),
          quota_lower: normalize(item.quota),
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
    setPredictions(null);

    // Using setTimeout to allow UI to show loading state
    setTimeout(() => {
      try {
        // STEP 3 — USER INPUT
        const selectedCategory = normalize(filters.category);
        const selectedQuota = normalize(filters.quota);
        const selectedBranch = normalize(filters.branch);

        // STEP 4 — PROGRAM MATCH (FLEXIBLE)
        const programMatch = (itemProgram) => {
          return itemProgram.includes(selectedBranch) || selectedBranch.includes(itemProgram);
        };

        // STEP 5 — BASE FILTER (FAST FILTER)
        const baseData = allCutoffs.filter(item => {
          if (selectedCategory && item.category_lower !== selectedCategory) return false;
          if (selectedQuota && item.quota_lower !== selectedQuota) return false;
          if (selectedBranch && !programMatch(item.program_lower)) return false;
          return true;
        });

        // STEP 6 — SORT BY TOP COLLEGES (IMPORTANT)
        const sortedData = [...baseData].sort(
          (a, b) => Number(a.closing_rank) - Number(b.closing_rank)
        );

        // STEP 7 — GROUP BY ROUND
        const rounds = {
          1: [],
          2: [],
          3: [],
          4: []
        };

        sortedData.forEach(item => {
          if (rounds[item.round_num]) {
            rounds[item.round_num].push(item);
          }
        });

        // STEP 8 — SAFE ZONE LOGIC (CORE ALGORITHM)
        const SAFE_GAP_MAX = 10000;

        const isGoodMatch = (uRank, closingRank) => {
          const gap = closingRank - uRank;
          if (gap < 0) return false; // too risky
          if (gap > SAFE_GAP_MAX) return false; // too far (low quality match)
          return true;
        };

        // STEP 14 — EMPTY CASE HANDLE
        const relaxedMatch = (uRank, closingRank) => {
            return closingRank >= uRank && closingRank - uRank <= 20000;
        };

        // STEP 9 & 13 — SELECT TOP COLLEGES PER ROUND & ENSURE VARIETY
        const getTopColleges = (roundData, isFallback = false) => {
          const result = [];
          const unique = new Set();

          for (let item of roundData) {
            const closing = Number(item.closing_rank);
            const gap = closing - userRank;

            const matchCondition = isFallback ? relaxedMatch(userRank, closing) : isGoodMatch(userRank, closing);

            if (matchCondition) {
              if (!unique.has(item.institute)) {
                unique.add(item.institute);
                result.push({
                  ...item,
                  gap: gap
                });
              }
            }

            if (result.length >= 5) break;
          }

          return result.slice(0, 5);
        };

        // STEP 10 — APPLY FOR ALL ROUNDS
        let finalResults = {
          1: getTopColleges(rounds[1]),
          2: getTopColleges(rounds[2]),
          3: getTopColleges(rounds[3]),
          4: getTopColleges(rounds[4])
        };

        // Check if no results were found, then apply relaxed matching
        const hasAnyResults = Object.values(finalResults).some(res => res.length > 0);
        if (!hasAnyResults) {
          finalResults = {
            1: getTopColleges(rounds[1], true),
            2: getTopColleges(rounds[2], true),
            3: getTopColleges(rounds[3], true),
            4: getTopColleges(rounds[4], true)
          };
        }

        const actuallyHasResults = Object.values(finalResults).some(res => res.length > 0);

        if (!actuallyHasResults) {
          setError("No strong matches found. Try increasing your rank range or changing branch.");
        } else {
          setPredictions(finalResults);
        }
      } catch (err) {
        console.error("Error predicting:", err);
        setError("An error occurred during prediction.");
      } finally {
        setLoading(false);
      }
    }, 50); 
  };

  // STEP 11 — STATUS TAG (SMART LABEL)
  const getStatus = (gap) => {
    if (gap <= 3000) return { text: "Best Choice", color: "#f59e0b", badgeText: "🥇 Best Choice", chanceText: "🟢 Safe Option", chanceColor: "#10b981" }; // Gold
    if (gap <= 7000) return { text: "Strong Option", color: "#60a5fa", badgeText: "🥈 Strong Option", chanceText: "🟡 Good Chance", chanceColor: "#f59e0b" }; // Blue
    return { text: "Good Backup", color: "#10b981", badgeText: "🥉 Good Backup", chanceText: "🔴 Low Chance", chanceColor: "#ef4444" }; // Green
  };

  const getChanceBadge = (gap) => {
      // Adjusted based on screenshot: gap=36041 -> chance is Best Choice? Wait. 
      // User says gap <= 3000 BEST, gap <= 7000 GOOD, else SAFE.
      // We will match the user's logic exactly.
      if (gap <= 3000) return { text: "Best", color: "#f59e0b" }; // Gold
      if (gap <= 7000) return { text: "Good", color: "#10b981" }; // Green
      return { text: "Safe", color: "#60a5fa" }; // Blue
  };

  return (
    <div className="glass-container analytics-container" style={{ animation: 'fadeIn 0.5s ease-in-out' }}>
      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
          }
          .best-card {
            border: 2px solid rgba(16, 185, 129, 0.5) !important;
            background: linear-gradient(145deg, rgba(16, 185, 129, 0.05) 0%, rgba(255,255,255,0.02) 100%) !important;
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

      {/* STEP 12 — UI OUTPUT STRUCTURE */}
      {predictions && (
        <div style={{ marginTop: '2rem', animation: 'fadeIn 0.5s ease-in-out' }}>
          {[1, 2, 3, 4].map(roundNum => {
            const roundData = predictions[roundNum];
            if (!roundData || roundData.length === 0) return null;

            return (
              <div key={`round-${roundNum}`} style={{ marginBottom: '3rem' }}>
                <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
                  👉 Round {roundNum} Recommendations
                </h3>
                
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
                  {roundData.map((row, i) => {
                    const chanceInfo = getChanceBadge(row.gap);
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
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default RankPredictor;

