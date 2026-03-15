import React, { useState, useMemo } from 'react';

const RankPredictor = ({ allCutoffs, uniqueCategories, uniqueQuotas, uniquePrograms }) => {
  const [filters, setFilters] = useState({
    rank: '',
    category: '',
    quota: '',
    program: '',
    year: '2024',
    round: '1' // using Round 1 of 2024 as baseline prediction
  });
  
  const [predictions, setPredictions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const currentRank = parseInt(filters.rank);

  const fetchPredictions = () => {
    if (!filters.rank || isNaN(currentRank) || currentRank <= 0) {
      setError("Please enter a valid numeric rank.");
      return;
    }
    if (!filters.category) {
      setError("Please select a Category.");
      return;
    }
    if (!filters.quota) {
      setError("Please select a Quota.");
      return;
    }

    setLoading(true);
    setError(null);
    setPredictions([]);

    try {
      // Local filtering from static JSON
      const filtered = allCutoffs.filter(row => {
        const rCat = (row.category || "").trim();
        const rQuota = (row.quota || "").trim();
        const rProg = (row.program || "").trim().toLowerCase();

        if (String(row.year) !== String(filters.year)) return false;
        if (String(row.round) !== String(filters.round)) return false;
        if (rCat !== filters.category) return false;
        if (rQuota !== filters.quota) return false;
        if (filters.program && rProg !== filters.program.toLowerCase()) return false;
        return true;
      });

      // Classification Logic
      const classified = filtered.map(row => {
        const rawCr = (row.closing_rank || "").toString().replace(/,/g, '');
        const cr = parseInt(rawCr);
        let chance = "Unknown";
        let chanceColor = "#64748b"; // slate
        
        if (cr && !isNaN(cr)) {
          if (currentRank <= cr * 0.8) {
            chance = "Very Safe";
            chanceColor = "#10b981"; // emerald
          } else if (currentRank <= cr * 0.95) {
            chance = "Safe";
            chanceColor = "#3b82f6"; // blue
          } else if (currentRank <= cr * 1.05) {
            chance = "Moderate";
            chanceColor = "#f59e0b"; // amber
          } else if (currentRank <= cr * 1.25) {
            chance = "Risky";
            chanceColor = "#f97316"; // orange
          } else {
            chance = "Very Risky";
            chanceColor = "#ef4444"; // red
          }
        }
        
        return { ...row, numericCR: cr, chance, chanceColor };
      });

      // Only keep rows that have a valid numeric closing rank
      const validRows = classified.filter(row => row.numericCR && !isNaN(row.numericCR));
      
      // Sort by best chances first, then by institute
      validRows.sort((a, b) => {
        const chanceOrder = { "Very Safe": 1, "Safe": 2, "Moderate": 3, "Risky": 4, "Very Risky": 5 };
        const orderDiff = chanceOrder[a.chance] - chanceOrder[b.chance];
        if (orderDiff !== 0) return orderDiff;
        return a.institute.localeCompare(b.institute);
      });

      if (validRows.length === 0) {
        setError(`No cutoff historical data found for Category: ${filters.category} and Quota: ${filters.quota}.`);
      } else {
        setPredictions(validRows);
      }
    } catch (err) {
      console.error("Error predicting ranks:", err);
      setError("Failed to fetch data for prediction.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="glass-container analytics-container">
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>College Rank Predictor</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Enter your rank to see personalized admission chances based on historical counseling data.
      </p>

      <div className="filter-grid" style={{ marginBottom: '2rem' }}>
        <div className="filter-group">
          <label>Your Expected/Actual Rank</label>
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
            {uniqueCategories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Quota *</label>
          <select name="quota" value={filters.quota} onChange={handleFilterChange}>
            <option value="">Select Quota</option>
            {uniqueQuotas.map((quota, i) => <option key={i} value={quota}>{quota}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Preferred Program (Optional)</label>
          <select name="program" value={filters.program} onChange={handleFilterChange}>
            <option value="">All Programs</option>
            {uniquePrograms.map((prog, i) => <option key={i} value={prog}>{prog}</option>)}
          </select>
        </div>
      </div>

      <button className="search-btn" onClick={fetchPredictions} disabled={loading} style={{ marginBottom: '2rem' }}>
        {loading ? "Analyzing Chances..." : "Predict Colleges"}
      </button>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171', borderRadius: '8px', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {predictions.length > 0 && (
        <div style={{ marginTop: '2rem' }}>
          <h3 style={{ marginBottom: '1rem', color: 'var(--text-primary)' }}>Prediction Results ({predictions.length} found)</h3>
          <div className="table-wrapper glass-container" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Institute Name</th>
                  <th>Program</th>
                  <th>Closing Rank ({filters.year})</th>
                  <th>Admission Chance</th>
                </tr>
              </thead>
              <tbody>
                {predictions.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: '500' }}>{row.institute}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.program}</td>
                    <td style={{ fontWeight: '600' }}>{row.numericCR.toLocaleString()}</td>
                    <td>
                      <span style={{
                        background: `${row.chanceColor}20`,
                        color: row.chanceColor,
                        padding: '4px 12px',
                        borderRadius: '20px',
                        fontWeight: '600',
                        fontSize: '0.85rem',
                        border: `1px solid ${row.chanceColor}40`
                      }}>
                        {row.chance}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default RankPredictor;
