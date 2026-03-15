import React, { useEffect, useState, useMemo } from 'react';
import CutoffList from './components/CutoffList';
import CutoffTrendGraph from './components/CutoffTrendGraph';
import RankPredictor from './components/RankPredictor';
import CollegeExplorer from './components/CollegeExplorer';
import filterData from './data/filterOptions.json';

function App() {
  const [activeTab, setActiveTab] = useState('search'); // 'search', 'analytics', 'predictor', 'colleges'
  const [allCutoffs, setAllCutoffs] = useState([]); // Stores all 10k records from JSON
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  
  const [uniqueInstitutes, setUniqueInstitutes] = useState(filterData.institutes || []);
  const [uniquePrograms, setUniquePrograms] = useState(filterData.programs || []);
  const [uniqueCategories, setUniqueCategories] = useState(filterData.categories || []);
  const [uniqueQuotas, setUniqueQuotas] = useState(filterData.quotas || []);
  const [uniqueGenders, setUniqueGenders] = useState(filterData.genders || []);

  // Filter States
  const [filters, setFilters] = useState({
    year: '2024',
    round: '',
    institute: '',
    program: '',
    category: '',
    quota: '',
    gender: ''
  });

  const handleFilterChange = React.useCallback((e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleResetFilters = React.useCallback(() => {
    setFilters({
      year: '2024',
      round: '',
      institute: '',
      program: '',
      category: '',
      quota: '',
      gender: ''
    });
    setWarning(null);
    setError(null);
  }, []);

  // 1. Fetch JSON Data exactly ONCE on mount
  useEffect(() => {
    let isMounted = true;
    const loadStaticData = async () => {
      try {
        setLoading(true);
        const response = await fetch('/cutoffs.min.json');
        if (!response.ok) throw new Error('Failed to load dataset');
        const data = await response.json();
        if (isMounted) {
          setAllCutoffs(data);
          setLoading(false);
        }
      } catch (err) {
        console.error("Error loading static dataset:", err);
        if (isMounted) {
          setError("Failed to load counselling data. Please refresh.");
          setLoading(false);
        }
      }
    };
    loadStaticData();
    return () => { isMounted = false; };
  }, []); // Empty dependency array ensures it runs only ONCE

  // 2. Client-Side Search & Filtering using useMemo
  const filteredCutoffs = useMemo(() => {
    if (!allCutoffs || allCutoffs.length === 0) return [];

    const fYear = filters.year?.trim();
    const fRound = filters.round?.trim();
    const fInstitute = filters.institute?.trim().toLowerCase();
    const fProgram = filters.program?.trim().toLowerCase();
    const fCategory = filters.category?.trim();
    const fQuota = filters.quota?.trim();
    const fGender = filters.gender?.trim();

    let result = allCutoffs.filter(row => {
      // Exact Matches
      if (fYear && String(row.year) !== fYear) return false;
      if (fRound && fRound !== "All Rounds" && String(row.round) !== fRound) return false;
      if (fCategory && row.category !== fCategory) return false;
      if (fQuota && row.quota !== fQuota) return false;
      if (fGender && row.gender !== fGender) return false;

      // Partial Matches (toLowerCase includes)
      if (fInstitute && !(row.institute || "").toLowerCase().includes(fInstitute)) return false;
      if (fProgram && !(row.program || "").toLowerCase().includes(fProgram)) return false;

      return true;
    });

    // 3. Sort by closing_rank ascending
    result.sort((a, b) => {
      const rankA = parseInt(a.closing_rank) || parseInt(a.closing_rank?.toString().replace(/,/g, '')) || 9999999;
      const rankB = parseInt(b.closing_rank) || parseInt(b.closing_rank?.toString().replace(/,/g, '')) || 9999999;
      return rankA - rankB;
    });

    return result;
  }, [allCutoffs, filters]);

  // Warning for empty search results
  useEffect(() => {
    if (!loading && filteredCutoffs.length === 0 && allCutoffs.length > 0) {
      setWarning("No exact cutoff found for the selected filters. Try removing some filters.");
    } else {
      setWarning(null);
    }
  }, [filteredCutoffs, loading, allCutoffs.length]);

  return (
    <>
      <header>
        <h1>AKTU Counselling Helper</h1>
        <p className="subtitle">Official OR-CR Cutoff Analytics Platform</p>
      </header>

      <main>
        {/* Navigation Tabs */}
        <div className="tabs-container" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {['search', 'analytics', 'predictor', 'colleges'].map(tab => (
            <button 
              key={tab} 
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '0.75rem 1.5rem',
                borderRadius: '8px',
                border: '1px solid var(--glass-border)',
                background: activeTab === tab ? 'rgba(59, 130, 246, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                color: activeTab === tab ? '#60a5fa' : 'var(--text-secondary)',
                cursor: 'pointer',
                fontWeight: '600',
                textTransform: 'capitalize',
                transition: 'all 0.2s ease',
                flex: '1 1 auto',
                maxWidth: '200px'
              }}
            >
              {tab}
            </button>
          ))}
        </div>

        {activeTab === 'search' && (
          <>
            {/* Filter Controls Section */}
        <section className="glass-container filter-section">
          <h3>Search Cutoffs</h3>
          <div className="filter-grid">
            <div className="filter-group">
              <label>Counselling Year</label>
              <select name="year" value={filters.year} onChange={handleFilterChange}>
                <option value="2025">2025</option>
                <option value="2024">2024</option>
                <option value="2023">2023</option>
                <option value="2022">2022</option>
                <option value="2021">2021</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Round Number</label>
              <select name="round" value={filters.round} onChange={handleFilterChange}>
                <option value="">All Rounds</option>
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                <option value="6">6</option>
              </select>
            </div>
            <div className="filter-group">
              <label>Institute Name</label>
              <input
                list="institute-list"
                name="institute"
                placeholder="Type or select institute..."
                value={filters.institute}
                onChange={handleFilterChange}
                disabled={loading}
              />
              <datalist id="institute-list">
                {uniqueInstitutes.map((inst, index) => (
                  <option key={index} value={inst} />
                ))}
              </datalist>
            </div>
            <div className="filter-group">
              <label>Program Name</label>
              <input
                list="program-list"
                name="program"
                placeholder="Type or select program..."
                value={filters.program}
                onChange={handleFilterChange}
                disabled={loading}
              />
              <datalist id="program-list">
                {uniquePrograms.map((prog, index) => (
                  <option key={index} value={prog} />
                ))}
              </datalist>
            </div>
            <div className="filter-group">
              <label>Category</label>
              <select
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                disabled={loading}
              >
                <option value="">All Categories</option>
                {uniqueCategories.map((cat, index) => (
                  <option key={index} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Quota</label>
              <select
                name="quota"
                value={filters.quota}
                onChange={handleFilterChange}
                disabled={loading}
              >
                <option value="">All Quotas</option>
                {uniqueQuotas.map((quota, index) => (
                  <option key={index} value={quota}>{quota}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Gender</label>
              <select
                name="gender"
                value={filters.gender}
                onChange={handleFilterChange}
                disabled={loading}
              >
                <option value="">All Genders</option>
                {uniqueGenders.map((gen, index) => (
                  <option key={index} value={gen}>{gen}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="reset-btn" onClick={handleResetFilters} disabled={loading} style={{ flex: 1, backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#60a5fa' }}>
              Reset Filters
            </button>
          </div>
        </section>

        {error && (
          <div className="glass-container error-alert" style={{ margin: '2rem 0', borderColor: 'rgba(239, 68, 68, 0.5)', background: 'rgba(239, 68, 68, 0.1)' }}>
            <p style={{ color: '#f87171', fontWeight: '500' }}>{error}</p>
          </div>
        )}

        {warning && (
          <div className="glass-container warning-alert" style={{ margin: '2rem 0', borderColor: 'rgba(245, 158, 11, 0.5)', background: 'rgba(245, 158, 11, 0.1)' }}>
            <p style={{ color: '#fbbf24', fontWeight: '500' }}>{warning}</p>
          </div>
        )}

        {/* Data Table Section */}
        {activeTab === 'search' && loading ? (
          <div className="loader-container" style={{ margin: '2rem 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', fontWeight: '500' }}>Loading cutoff data...</p>
          </div>
        ) : activeTab === 'search' ? (
          <CutoffList 
             cutoffs={filteredCutoffs} 
             filters={filters} 
          />
        ) : null}
          </>
        )}

        {activeTab === 'analytics' && (
          <CutoffTrendGraph 
            allCutoffs={allCutoffs} 
            uniqueInstitutes={uniqueInstitutes} 
            uniquePrograms={uniquePrograms} 
            uniqueCategories={uniqueCategories} 
          />
        )}

        {activeTab === 'predictor' && (
          <RankPredictor
            allCutoffs={allCutoffs}
            uniqueCategories={uniqueCategories}
            uniqueQuotas={uniqueQuotas}
            uniquePrograms={uniquePrograms}
          />
        )}

        {activeTab === 'colleges' && (
          <CollegeExplorer
            allCutoffs={allCutoffs}
            uniqueInstitutes={uniqueInstitutes}
          />
        )}
      </main>
    </>
  );
}

export default App;
