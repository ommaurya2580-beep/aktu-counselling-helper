import React, { useState } from 'react';

const RankPredictor = ({ uniqueCategories, uniqueQuotas, uniquePrograms }) => {
  const [filters, setFilters] = useState({ rank: '', category: '', quota: '', branch: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [predictionData, setPredictionData] = useState(null);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const fetchPredictions = async () => {
    if (!filters.rank || !filters.category || !filters.quota || !filters.branch) {
      setError('Please fill all required fields');
      return;
    }
    
    const userRank = Number(filters.rank);
    if (isNaN(userRank) || userRank <= 0) { 
      setError('Please enter a valid numeric rank.'); 
      return; 
    }

    setLoading(true);
    setError(null);
    setPredictionData(null);

    try {
      const response = await fetch('/api/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userRank,
          category: filters.category,
          quota: filters.quota,
          preferredBranch: filters.branch,
        })
      });

      if (!response.ok) {
        throw new Error(`Server returned ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }
      
      setPredictionData(data);
    } catch (err) {
      console.error('Prediction error:', err);
      setError(err.message || 'Failed to fetch predictions. Make sure the backend API is running.');
    } finally {
      setLoading(false);
    }
  };

  const renderCollegeCard = (row, index) => (
    <div key={index} className="glass-container hover-scale"
      style={{ padding:'1.5rem', display:'flex', flexDirection:'column', gap:'1rem', borderTop:`4px solid ${row.chance_color || '#3b82f6'}` }}>
      
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:'.5rem' }}>
        <span style={{ background:'rgba(255,255,255,.12)', color:'var(--text-primary)', padding:'4px 10px', borderRadius:'6px', fontSize:'.8rem', fontWeight:'600' }}>
          {row.chance}
        </span>
        {row.fallback_used && (
          <span style={{ background:'rgba(239,68,68,.15)', color:'#f87171', padding:'4px 10px', borderRadius:'6px', fontSize:'.75rem', fontWeight:'600' }}>
            Fallback: OPEN
          </span>
        )}
        {row.is_priority && (
          <span style={{ background:'rgba(234,179,8,.15)', color:'#fbbf24', padding:'4px 10px', borderRadius:'6px', fontSize:'.75rem', fontWeight:'600' }}>
            Top Priority
          </span>
        )}
      </div>
      
      <div>
        <h4 style={{ color:'var(--text-primary)', margin:'.5rem 0', fontSize:'1.08rem', lineHeight:'1.4' }}>{row.college}</h4>
        <p style={{ color:'var(--text-secondary)', margin:0, fontSize:'.88rem' }}>{row.branch}</p>
        
        {/* Detail Badges Container */}
        <div style={{ display:'flex', gap:'8px', marginTop:'12px', flexWrap:'wrap' }}>
          <span style={{ display:'inline-block', background:'rgba(255,255,255,.05)', padding:'3px 8px', borderRadius:'4px', fontSize:'.7rem', color:'var(--text-secondary)' }}>
            Score: {row.score}
          </span>
          {row.is_branch_match && (
            <span style={{ display:'inline-block', background:'rgba(34,197,94,.1)', padding:'3px 8px', borderRadius:'4px', fontSize:'.7rem', color:'#4ade80' }}>
              Branch Match
            </span>
          )}
        </div>
      </div>
      
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-end', marginTop:'auto', paddingTop:'1rem', borderTop:'1px solid rgba(255,255,255,.05)' }}>
        <div>
          <span style={{ display:'block', fontSize:'.72rem', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.5px', marginBottom:'4px' }}>
            2026 Expected CR
          </span>
          <strong style={{ color:'var(--text-primary)', fontSize:'1.15rem' }}>{Number(row.adjusted_closing_2026).toLocaleString()}</strong>
          <div style={{ fontSize:'.7rem', color:'var(--text-secondary)', marginTop:'2px' }}>(2025: {row.closing_rank_2025})</div>
        </div>
        <div style={{ textAlign:'right' }}>
          <span style={{ display:'block', fontSize:'.75rem', color:'var(--text-secondary)', marginBottom:'4px' }}>Rank Margin</span>
          <span style={{ color: row.chance_color || '#3b82f6', fontWeight:'700', fontSize:'1.1rem' }}>{row.margin}</span>
        </div>
      </div>
    </div>
  );

  return (
    <div className="glass-container" style={{ padding: '2rem' }}>
      <style>{`
        @keyframes fadeIn { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
        .hover-scale { transition: transform 0.2s ease, box-shadow 0.2s ease; }
        .hover-scale:hover { transform:translateY(-3px); box-shadow: 0 8px 24px rgba(0,0,0,.4); }
      `}</style>

      <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>College Rank Predictor</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Enter your rank to see personalized admission chances based on 2025 official OR-CR data.
      </p>

      <div className="filter-grid" style={{ marginBottom: '2rem' }}>
        <div className="filter-group">
          <label>Your Expected / Actual Rank *</label>
          <input type="number" name="rank" value={filters.rank} onChange={handleFilterChange}
            placeholder="e.g. 45000"
            style={{ padding:'0.75rem', borderRadius:'8px', border:'1px solid var(--glass-border)', background:'rgba(255,255,255,.05)', color:'white', width:'100%' }}
          />
        </div>
        <div className="filter-group">
          <label>Category *</label>
          <select name="category" value={filters.category} onChange={handleFilterChange}>
            <option value="">Select Category</option>
            {uniqueCategories?.map((c, i) => <option key={i} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Quota *</label>
          <select name="quota" value={filters.quota} onChange={handleFilterChange}>
            <option value="">Select Quota</option>
            {uniqueQuotas?.map((q, i) => <option key={i} value={q}>{q}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Preferred Branch *</label>
          <select name="branch" value={filters.branch} onChange={handleFilterChange}>
            <option value="">Select Branch</option>
            {uniquePrograms?.map((p, i) => <option key={i} value={p}>{p}</option>)}
          </select>
        </div>
      </div>

      <button className="search-btn" onClick={fetchPredictions}
        disabled={loading}
        style={{ marginBottom: '2rem' }}>
        {loading ? 'Predicting colleges...' : 'Predict Colleges'}
      </button>

      {error && (
        <div style={{ padding:'1rem', background:'rgba(239,68,68,.1)', border:'1px solid rgba(239,68,68,.5)', color:'#f87171', borderRadius:'8px', marginBottom:'1.5rem', animation:'fadeIn .3s' }}>
          {error}
        </div>
      )}

      {predictionData && !loading && (
        <div style={{ marginTop:'2rem', animation:'fadeIn .5s' }}>
          
          <div style={{ padding:'1rem', background:'rgba(255,255,255,.02)', border:'1px dashed rgba(255,255,255,.1)', borderRadius:'8px', color:'var(--text-secondary)', marginBottom: '2rem' }}>
            <p style={{ margin:0, fontSize: '.9rem' }}><strong>Disclaimer:</strong> {predictionData.disclaimer || "Prediction based on previous year data. Admission not guaranteed."}</p>
            <p style={{ margin:'0.5rem 0 0 0', fontSize: '.85rem', opacity: 0.8 }}>info: {predictionData.year_adjustment_used}</p>
          </div>

          {predictionData.total_matches === 0 ? (
            <div style={{ padding:'1.5rem', background:'rgba(255,255,255,.02)', border:'1px dashed rgba(255,255,255,.15)', borderRadius:'8px', color:'var(--text-secondary)', textAlign:'center' }}>
              <p style={{ margin:0 }}>No suitable colleges found for your rank and preferences.</p>
              <p style={{ margin:'.5rem 0 0', fontSize:'.9rem', opacity:.7 }}>
                Try a different branch or category combination.
              </p>
            </div>
          ) : (
            <>
              {predictionData.dream_colleges?.length > 0 && (
                <div style={{ marginBottom:'3rem' }}>
                  <h3 style={{ marginBottom:'1.5rem', color:'var(--text-primary)', borderBottom:'1px solid rgba(255,255,255,.1)', paddingBottom:'.5rem' }}>
                    🌟 Dream & Very Safe Options
                  </h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'1.5rem' }}>
                    {predictionData.dream_colleges.map((row, i) => renderCollegeCard(row, `dream-${i}`))}
                  </div>
                </div>
              )}

              {predictionData.safe_colleges?.length > 0 && (
                <div style={{ marginBottom:'3rem' }}>
                  <h3 style={{ marginBottom:'1.5rem', color:'var(--text-primary)', borderBottom:'1px solid rgba(255,255,255,.1)', paddingBottom:'.5rem' }}>
                    👍 Safe Options
                  </h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'1.5rem' }}>
                    {predictionData.safe_colleges.map((row, i) => renderCollegeCard(row, `safe-${i}`))}
                  </div>
                </div>
              )}

              {predictionData.backup_colleges?.length > 0 && (
                <div style={{ marginBottom:'3rem' }}>
                  <h3 style={{ marginBottom:'1.5rem', color:'var(--text-primary)', borderBottom:'1px solid rgba(255,255,255,.1)', paddingBottom:'.5rem' }}>
                    🔁 Moderate / Backup Options
                  </h3>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'1.5rem' }}>
                    {predictionData.backup_colleges.map((row, i) => renderCollegeCard(row, `backup-${i}`))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default RankPredictor;
