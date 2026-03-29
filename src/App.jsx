import React, { useEffect, useState, useMemo } from 'react';
import { normalizeString } from './utils/stringUtils'; // [PERF] top-level import — used at load time for pre-normalization
import CutoffList from './components/CutoffList';
import CutoffTrendGraph from './components/CutoffTrendGraph';
import RankPredictor from './components/RankPredictor';
import CollegeComparison from './pages/CollegeComparison';
import RankComparison from './pages/RankComparison';
/* import filterData from './data/filterOptions.json'; */ // Removed in favor of dynamic fetch from /data/filterOptions.json
import Select from 'react-select';

import { db } from './services/firebase';
import { fetchFilteredCutoffs } from './services/firestoreSearch';

// Import All Round Data for full college list
import round1 from "./data/aktu_round1.json";
import round2 from "./data/aktu_round2.json";
import round3 from "./data/aktu_round3.json";
import round4 from "./data/aktu_round4.json";
import round6 from "./data/aktu_round6.json";
import round7 from "./data/aktu_round7.json";
import cutoffsFull from "./data/cutoffs.json";
import cutoffsMin from "./data/cutoffs.min.json";

const allDataCombined = [...round1, ...round2, ...round3, ...round4, ...round6, ...round7, ...cutoffsFull, ...cutoffsMin];
const normalizeInstitute = (str) => (str || "").toLowerCase().replace(/[^a-z0-9 ]/g, "").trim();

const collegeList = Array.from(
  new Map(
    allDataCombined.map(item => {
      const name = item.institute || item.college_name || "";
      const key = normalizeInstitute(name);
      return [key, name.toUpperCase()];
    })
  ).values()
).sort();

const programList = Array.from(
  new Set(allDataCombined.map(item => item.program || item.branch || ""))
).filter(Boolean).sort();

const categoryList = Array.from(
  new Set(allDataCombined.map(item => item.category || ""))
).filter(Boolean).sort();

const quotaList = Array.from(
  new Set(allDataCombined.map(item => item.quota || ""))
).filter(Boolean).sort();

console.log("Total Colleges:", collegeList.length);

// Data loading handled via fetch in useEffect
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
  
  const [uniqueInstitutes, setUniqueInstitutes] = useState(collegeList);
  const [uniquePrograms, setUniquePrograms] = useState(programList);
  const [uniqueCategories, setUniqueCategories] = useState(categoryList);
  const [uniqueQuotas, setUniqueQuotas] = useState(quotaList);
  const [uniqueGenders, setUniqueGenders] = useState(['Male Only', 'Female Only', 'Both Male and Female Seats']);

  // Filter States
  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);

  const handleFilterChange = React.useCallback((e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  }, []);

  const [filteredCutoffs, setFilteredCutoffs] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  const executeSearch = React.useCallback(() => {
    if (allCutoffs.length === 0) return;
    
    setIsSearching(true);
    setWarning(null);

    const normalize = (str) => (str || "").toLowerCase().replace(/[\r\n\t]/g, " ").trim();
    const selectedCollege = appliedFilters.institute !== 'all' ? appliedFilters.institute : null;
    const selectedBranch = appliedFilters.program !== 'all' ? normalize(appliedFilters.program) : null;

    let filteredResults = allCutoffs.filter(item => {
      // Round filter
      const matchRound = appliedFilters.round === 'all' || appliedFilters.round === 'All Rounds' || item.round === appliedFilters.round || `Round ${item.round}` === appliedFilters.round;

      // College search
      const matchCollege = !selectedCollege || normalizeInstitute(item.institute).includes(normalizeInstitute(selectedCollege));
      
      // Branch/Program search
      const matchBranch = !selectedBranch || normalize(item.program).includes(selectedBranch);
      
      // Category, Quota, Gender
      const matchCategory = appliedFilters.category === 'all' || appliedFilters.category === 'All Categories' || item.category === appliedFilters.category;
      const matchQuota = appliedFilters.quota === 'all' || appliedFilters.quota === 'All Quotas' || item.quota === appliedFilters.quota;
      const matchGender = appliedFilters.gender === 'all' || appliedFilters.gender === 'All Genders' || item.gender === appliedFilters.gender;

      return matchRound && matchCollege && matchBranch && matchCategory && matchQuota && matchGender;
    });

    // Sort by closing_rank ascending
    filteredResults.sort((a, b) => (parseInt(a.closing_rank) || 999999) - (parseInt(b.closing_rank) || 999999));

    setFilteredCutoffs(filteredResults);
    setIsSearching(false);
  }, [appliedFilters, allCutoffs]);

  // Execute search automatically when filters or data change (Live Search)
  useEffect(() => {
    executeSearch();
  }, [executeSearch]);


  const handleSearch = React.useCallback(() => {
    executeSearch(false);
  }, [executeSearch]);

  const handleLoadMore = React.useCallback(() => {
    if (hasMore && !isLoadingMore) {
      executeSearch(true);
    }
  }, [hasMore, isLoadingMore, executeSearch]);

  const handleResetFilters = React.useCallback(() => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setWarning(null);
    setError(null);
  }, []);

  // Fetch filter options once on mount
  useEffect(() => {
    let isMounted = true;
    const loadFilterData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/data/filterOptions.json');
        if (!res.ok) throw new Error(`Failed to load filter options`);
        const filterData = await res.json();

        if (isMounted) {
          // Keep fetch for backward compatibility if needed, but primary source is now dynamic
          if (filterData.genders) setUniqueGenders(filterData.genders);
          setLoading(false);
          
          // Initial search
          executeSearch();
        }
      } catch (err) {
        console.error("Error loading filter data:", err);
        if (isMounted) {
          setError("Failed to load filter options.");
          setLoading(false);
        }
      }
    };

    const loadCutoffData = () => {
      try {
        // Merge and deduplicate using the already imported allDataCombined
        const mergedMap = new Map();
        
        allDataCombined.forEach(item => {
          const inst = (item.institute || item.college_name || "").toUpperCase();
          const prog = (item.program || item.branch || "").toUpperCase();
          const key = `${item.round}-${inst}-${prog}-${item.category}-${item.quota}-${item.gender}-${item.closing_rank}`;
          mergedMap.set(key, {
            ...item,
            institute: inst,
            program: prog
          });
        });

        if (isMounted) {
          setAllCutoffs(Array.from(mergedMap.values()));
        }
      } catch (err) {
        console.error("Error loading cutoff data:", err);
      }
    };

    loadFilterData();
    loadCutoffData();

    return () => { isMounted = false; };
  }, []);

  // STEP 10 — PERFORMANCE OPTIMIZATION (useMemo)
  const roundOptions = useMemo(() => {
    return ["All Rounds", "Round 1", "Round 2", "Round 3", "Round 4", "Round 6", "Round 7"];
  }, []);

  const instituteOptions = useMemo(() => {
    return [
      { label: "All Institutes", value: "all" },
      ...collegeList.map(inst => ({ 
        label: inst.replace(/[\r\n]+/g, ' ').trim(), 
        value: inst 
      }))
    ];
  }, []);

  const programOptions = useMemo(() => {
    return [
      { label: "All Programs", value: "all" },
      ...uniquePrograms.map(prog => ({ 
        label: prog.replace(/[\r\n]+/g, ' ').trim(), 
        value: prog 
      }))
    ];
  }, [uniquePrograms]);

  // Auto-reset invalid branch if it becomes unavailable under new filters
  useEffect(() => {
    if (filters.program && filters.program !== 'all') {
      const isValid = programOptions.some(opt => opt.value === filters.program);
      if (!isValid) {
        setFilters(prev => ({ ...prev, program: 'all' }));
      }
    }
  }, [programOptions, filters.program]);

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

  // Warning handled during fetch

  return (
    <>
      <header>
        <h1>AKTU Counselling Helper</h1>
        <p className="subtitle">Official OR-CR Cutoff Analytics Platform</p>
      </header>

      <main>
        {/* Navigation Tabs */}
        <div className="tabs-container" style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', justifyContent: 'center', flexWrap: 'wrap' }}>
          {['search', 'analytics', 'predictor', 'compare', 'rank comparison'].map(tab => (
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
              </select>
            </div>
            <div className="filter-group">
              <label>Round Number</label>
              <select name="round" value={filters.round} onChange={handleFilterChange}>
                <option value="all">All Rounds</option>
                {roundOptions.map(r => (
                  // Named rounds (Special Round, Spot Round) already have full label;
                  // numeric rounds ("1", "2") get the "Round " prefix added
                  <option key={r} value={r}>
                    {/^\d+$/.test(r) ? `Round ${r}` : r}
                  </option>
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
            <button 
              className="search-btn" 
              onClick={() => setAppliedFilters(filters)} 
              disabled={loading || isSearching} 
              style={{ 
                flex: 1, 
                backgroundColor: '#3b82f6', 
                border: '1px solid #3b82f6', 
                color: 'white', 
                padding: '0.75rem', 
                borderRadius: '8px', 
                cursor: 'pointer', 
                transition: 'all 0.2s',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.5rem'
              }}
            >
              🔍 Search
            </button>
            <button className="reset-btn" onClick={handleResetFilters} disabled={loading || isSearching} style={{ flex: 1, backgroundColor: 'rgba(59, 130, 246, 0.1)', border: '1px solid rgba(59, 130, 246, 0.3)', color: '#60a5fa', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', transition: 'all 0.2s' }}>
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
            <CutoffList cutoffs={filteredCutoffs} appliedFilters={appliedFilters} />
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
            uniqueCategories={categoryList}
            uniqueQuotas={quotaList}
            uniquePrograms={programList}
          />
        )}


        {activeTab === 'compare' && (
          <CollegeComparison />
        )}

        {activeTab === 'rank comparison' && (
          <RankComparison 
            collegeList={uniqueInstitutes}
            uniqueCategories={uniqueCategories}
            uniqueQuotas={uniqueQuotas}
          />
        )}
      </main>
    </>
  );
}

export default App;
