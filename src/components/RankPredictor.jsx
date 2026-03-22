import React, { useState, useEffect, useMemo } from 'react';

const normalize = (str) => String(str || "").toLowerCase().trim();

const RankPredictor = ({ uniqueCategories, uniqueQuotas, uniquePrograms }) => {
  const [allCutoffs, setAllCutoffs] = useState([]);
  
  const [filters, setFilters] = useState({
    rank: '',
    category: '',
    quota: '',
    branch: ''
  });
  
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetch('/cutoffs.min.json')
      .then(res => res.json())
      .then(data => setAllCutoffs(data))
      .catch(err => console.error("Error loading cutoffs:", err));
  }, []);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // STEP 11: PRE-NORMALIZE for heavy filtering
  const filteredBaseData = useMemo(() => {
    if (!filters.category || !filters.quota || !filters.branch) return [];

    const normCategory = normalize(filters.category);
    const normQuota = normalize(filters.quota);
    const normBranch = normalize(filters.branch);

    return allCutoffs.filter(item => {
      return (
        normalize(item.category) === normCategory &&
        normalize(item.quota) === normQuota &&
        normalize(item.program).includes(normBranch)
      );
    });
  }, [allCutoffs, filters.category, filters.quota, filters.branch]);

  const fetchPredictions = () => {
    if (!filters.rank || !filters.category || !filters.quota || !filters.branch) {
      setError("Please fill all required fields");
      return;
    }

    const currentRank = parseInt(filters.rank);
    if (isNaN(currentRank) || currentRank <= 0) {
      setError("Please enter a valid numeric rank.");
      return;
    }

    setLoading(true);
    setError(null);
    setPredictions([]);

    setTimeout(() => {
      try {
        const rounds = {
          "Round 1": [],
          "Round 2": [],
          "Round 3": [],
          "Round 4": []
        };

        filteredBaseData.forEach(item => {
          let rName = String(item.round).trim().replace(/^Round\s*/i, '');
          if (/^\d+$/.test(rName)) {
            rName = `Round ${rName}`;
          }
          if (rounds[rName]) {
            rounds[rName].push(item);
          }
        });

        const results = [];
        
        Object.keys(rounds).forEach(round => {
          const matches = rounds[round]
            .map(item => {
              const closing_str = String(item.closing_rank).replace(/,/g, '');
              const closing = parseInt(closing_str);
              if (isNaN(closing)) return null;

              // STEP 1: REPLACE STATUS LOGIC
              let status = null;
              let chanceColor = "";

              if (currentRank <= closing * 0.7) {
                status = "SAFE";
                chanceColor = "#10b981"; // green
              } else if (currentRank <= closing) {
                status = "TARGET";
                chanceColor = "#f59e0b"; // yellow
              } else {
                status = "DREAM";
                chanceColor = "#ef4444"; // red
              }

              // STEP 2: ADD SCORE SYSTEM
              const score = (closing - currentRank) * -1;
              let roundWeight = 0;
              if (round === "Round 1") roundWeight = 40;
              if (round === "Round 2") roundWeight = 30;
              if (round === "Round 3") roundWeight = 20;
              if (round === "Round 4") roundWeight = 10;
              
              const finalScore = score + roundWeight;

              // STEP 8: ADD RANK DIFFERENCE
              const gap = closing - currentRank;
              const gapText = gap > 0 ? `+${gap.toLocaleString()}` : gap.toLocaleString();

              const opening_str = String(item.opening_rank).replace(/,/g, '');
              const opening = parseInt(opening_str);

              // STEP 3: APPLY SCORING
              return {
                institute: item.institute,
                program: item.program,
                round,
                opening_rank: opening,
                closing_rank: closing,
                status,
                chanceColor,
                score: finalScore,
                gapText
              };
            })
            .filter(Boolean);
            
          results.push(...matches);
        });

        // STEP 4 & 5: SMART SORTING & LIMIT RESULTS
        const finalResults = results
          .sort((a, b) => b.score - a.score)
          .slice(0, 5);

        // STEP 12: EMPTY STATE IMPROVEMENT
        if (finalResults.length === 0) {
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
    }, 500); 
  };

  // Utility to get badge and label for UI
  const getBadgeArgs = (status) => {
    switch(status) {
      case 'SAFE': return { text: '🟢 High Chance', color: '#10b981' };
      case 'TARGET': return { text: '🟡 Good Chance', color: '#f59e0b' };
      case 'DREAM': return { text: '🔴 Low Chance', color: '#ef4444' };
      default: return { text: '', color: 'gray' };
    }
  };

  const getTopLabel = (index) => {
    if (index === 0) return '🥇 Best Choice';
    if (index === 1) return '🥈 Strong Option';
    if (index === 2) return '🥉 Good Backup';
    return null;
  };

  // STEP 6: GROUP OUTPUT (Derived for grouping mapping in UI)
  const groupedResults = {
    SAFE: predictions.filter(p => p.status === 'SAFE'),
    TARGET: predictions.filter(p => p.status === 'TARGET'),
    DREAM: predictions.filter(p => p.status === 'DREAM')
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

      {predictions.length > 0 && (
        <div style={{ marginTop: '2rem', animation: 'fadeIn 0.5s ease-in-out' }}>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
            Smart Recommendations ({predictions.length} found)
          </h3>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1.5rem' }}>
            {predictions.map((row, i) => {
              const topLabel = getTopLabel(i);
              const badge = getBadgeArgs(row.status);
              const isBest = i === 0;

              return (
                <div key={i} className={`glass-container hover-scale ${isBest ? 'best-card' : ''}`} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', borderTop: `4px solid ${row.chanceColor}` }}>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                      {topLabel && (
                        <span style={{
                          background: 'rgba(255,255,255,0.15)',
                          color: 'var(--text-primary)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '0.8rem',
                          fontWeight: '600'
                        }} >
                          {topLabel}
                        </span>
                      )}
                      <span style={{
                        background: `${badge.color}20`,
                        color: badge.color,
                        padding: '4px 10px',
                        borderRadius: '6px',
                        fontSize: '0.8rem',
                        fontWeight: '600',
                        border: `1px solid ${badge.color}40`,
                        boxShadow: `0 0 10px ${badge.color}20`
                      }}>
                        {badge.text}
                      </span>
                    </div>
                    
                    <span style={{
                      background: 'rgba(255,255,255,0.05)',
                      padding: '4px 10px',
                      borderRadius: '4px',
                      fontSize: '0.8rem',
                      color: 'var(--text-secondary)'
                    }}>
                      {row.round}
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
                        {row.closing_rank.toLocaleString()}
                      </strong>
                    </div>
                    
                    <div style={{ textAlign: 'right' }}>
                      <span style={{ display: 'block', fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                        Rank Gap
                      </span>
                      <span style={{
                        color: row.gapText.startsWith('+') ? '#10b981' : '#ef4444',
                        fontWeight: '600',
                        fontSize: '0.95rem'
                      }}>
                        {row.gapText}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default RankPredictor;
