import React, { useEffect, useState, useMemo } from 'react';
import CutoffList from './components/CutoffList';
import CutoffTrendGraph from './components/CutoffTrendGraph';
import RankPredictor from './components/RankPredictor';
import CollegeExplorer from './components/CollegeExplorer';
import filterData from './data/filterOptions.json';
import Select from 'react-select';

const initialFilters = {
  year: 'all',
  round: 'all',
  institute: 'all',
  program: 'all',
  category: 'all',
  quota: 'all',
  gender: 'all'
};

function App() {
  const [activeTab, setActiveTab] = useState('search'); // 'search', 'analytics', 'predictor', 'colleges'
  const [allCutoffs, setAllCutoffs] = useState([]); // Stores all 10k records from JSON
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  
  const [uniqueInstitutes] = useState(filterData.institutes || []);
  const [uniquePrograms] = useState(filterData.programs || []);
  const [uniqueCategories] = useState(filterData.categories || []);
  const [uniqueQuotas] = useState(filterData.quotas || []);
  const [uniqueGenders] = useState(filterData.genders || []);

  // Filter States
  const [filters, setFilters] = useState(initialFilters);

  const handleFilterChange = React.useCallback((e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  }, []);

  const handleSearch = React.useCallback(() => {
    setIsSearching(true);
    // Simulate short network delay for better UX
    setTimeout(() => {
      setIsSearching(false);
    }, 400);
  }, []);

  const handleResetFilters = React.useCallback(() => {
    setFilters(initialFilters);
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
        console.log("Dataset loaded:", data.length);
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

  const filteredCutoffs = useMemo(() => {
    if (!allCutoffs || allCutoffs.length === 0) return [];

    function normalize(v) {
      return String(v || "").trim().toLowerCase();
    }

    const result = allCutoffs.filter(item => {
      const year = normalize(item.year);
      const round = normalize(item.round);
      const institute = normalize(item.institute);
      const program = normalize(item.program);
      const quota = normalize(item.quota);
      const category = normalize(item.category);
      // Use fallback to seat_gender just in case dataset has mixed keys
      const gender = normalize(item.gender || item.seat_gender);

      const fYear = normalize(filters.year);
      const fRound = normalize(filters.round !== "All Rounds" ? filters.round : "");
      const fInstitute = normalize(filters.institute);
      const fProgram = normalize(filters.program);
      const fQuota = normalize(filters.quota);
      const fCategory = normalize(filters.category);
      const fGender = normalize(filters.gender);

      if (fYear && fYear !== "all" && year !== fYear) return false;
      if (fRound && fRound !== "all" && round !== fRound) return false;
      if (fQuota && fQuota !== "all" && quota !== fQuota) return false;
      if (fCategory && fCategory !== "all" && category !== fCategory) return false;
      if (fGender && fGender !== "all" && gender !== fGender) return false;

      if (fInstitute && fInstitute !== "all" && !institute.includes(fInstitute)) return false;
      if (fProgram && fProgram !== "all" && !program.includes(fProgram)) return false;

      return true;
    });

    console.log("Filters:", filters);
    console.log("Dataset sample:", allCutoffs[0]);
    console.log("Filtered results:", result.length);

    // 3. Sort by closing_rank ascending
    result.sort((a, b) => {
      const rankA = parseInt(a.closing_rank) || parseInt(a.closing_rank?.toString().replace(/,/g, '')) || 9999999;
      const rankB = parseInt(b.closing_rank) || parseInt(b.closing_rank?.toString().replace(/,/g, '')) || 9999999;
      return rankA - rankB;
    });

    return result;
  }, [allCutoffs, filters]);

  const roundOptions = useMemo(() => {
    if (!allCutoffs || allCutoffs.length === 0) return [];
    
    let relevantCutoffs = allCutoffs;
    if (filters.year && filters.year !== 'all') {
      relevantCutoffs = allCutoffs.filter(item => String(item.year) === String(filters.year));
    }

    const rounds = [...new Set(relevantCutoffs.map(item => item.round))].filter(Boolean);
    const sortedRounds = rounds
      .map(r => parseInt(r))
      .filter(r => !isNaN(r))
      .sort((a, b) => a - b);
    return sortedRounds.map(r => String(r));
  }, [allCutoffs, filters.year]);

  const instituteOptions = useMemo(() => {
    return [
      { label: "All Institutes", value: "all" },
      ...uniqueInstitutes.map(inst => ({ label: inst, value: inst }))
    ];
  }, [uniqueInstitutes]);

  const programOptions = useMemo(() => {
    return [
      { label: "All Programs", value: "all" },
      ...uniquePrograms.map(prog => ({ label: prog, value: prog }))
    ];
  }, [uniquePrograms]);

  const customStyles = {
    control: (base) => ({
      ...base,
      backgroundColor: "#0f172a",
      color: "white",
      borderRadius: "10px",
      minHeight: "42px",
      border: "1px solid rgba(255, 255, 255, 0.1)"
    }),
    singleValue: (base) => ({
      ...base,
      color: "white"
    }),
    menu: (base) => ({
      ...base,
      backgroundColor: "#1e293b",
      color: "white",
      zIndex: 5
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "#3b82f6" : "#1e293b",
      color: "white",
      cursor: "pointer"
    })
  };

  // Warning for empty search results
  useEffect(() => {
    const hasApplied = Object.values(filters).some(v => v !== 'all' && v.trim() !== '');
    if (!loading && !isSearching && hasApplied && filteredCutoffs.length === 0 && allCutoffs.length > 0) {
      setWarning("No exact cutoff found for the selected filters. Try removing some filters.");
    } else {
      setWarning(null);
    }
  }, [filteredCutoffs, loading, isSearching, filters, allCutoffs.length]);

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
                <option value="all">All Years</option>
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
                <option value="all">All Rounds</option>
                {roundOptions.map(r => (
                  <option key={r} value={r}>Round {r}</option>
                ))}
              </select>
            </div>
            <div className="filter-group" style={{ zIndex: 10 }}>
              <label>Institute Name</label>
              <Select
                options={instituteOptions}
                onChange={(selected) => handleFilterChange({ target: { name: 'institute', value: selected.value } })}
                value={instituteOptions.find(opt => opt.value === filters.institute)}
                styles={customStyles}
                isSearchable={true}
                isDisabled={loading}
              />
            </div>
            <div className="filter-group" style={{ zIndex: 9 }}>
              <label>Program Name</label>
              <Select
                options={programOptions}
                onChange={(selected) => handleFilterChange({ target: { name: 'program', value: selected.value } })}
                value={programOptions.find(opt => opt.value === filters.program)}
                styles={customStyles}
                isSearchable={true}
                isDisabled={loading}
              />
            </div>
            <div className="filter-group">
              <label>Category</label>
              <select
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                disabled={loading}
              >
                <option value="all">All Categories</option>
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
                <option value="all">All Quotas</option>
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
                <option value="all">All Genders</option>
                {uniqueGenders.map((gen, index) => (
                  <option key={index} value={gen}>{gen}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            {/* Keeping the search button mainly to trigger the isSearching artificial delay, if desired, otherwise we removed its purpose. */}
            {/* We'll leave it in but it works even without clicking it because of useMemo. */}
            <button 
              className="search-btn" 
              onClick={handleSearch} 
              disabled={loading || isSearching} 
              style={{ flex: 1, backgroundColor: '#3b82f6', color: 'white', border: 'none', fontWeight: 'bold', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s', opacity: (loading || isSearching) ? 0.6 : 1 }}
            >
              {isSearching ? 'Refreshing...' : 'Apply Filters Manually'}
            </button>
            <button className="reset-btn" onClick={handleResetFilters} disabled={loading || isSearching} style={{ flex: 1, backgroundColor: 'rgba(59, 130, 246, 0.2)', border: '1px solid #3b82f6', color: '#60a5fa', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
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
        ) : activeTab === 'search' && isSearching ? (
          <div className="loader-container" style={{ margin: '2rem 0', textAlign: 'center' }}>
            <p style={{ color: 'var(--text-secondary)', fontSize: '1.2rem', fontWeight: '500' }}>Applying filters...</p>
          </div>
        ) : activeTab === 'search' ? (
          <CutoffList 
             cutoffs={filteredCutoffs} 
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
