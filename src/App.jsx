import React, { useEffect, useState, useMemo } from 'react';
import { normalizeString } from './utils/stringUtils'; // [PERF] top-level import — used at load time for pre-normalization
import CutoffList from './components/CutoffList';
import CutoffTrendGraph from './components/CutoffTrendGraph';
import RankPredictor from './components/RankPredictor';
import CollegeExplorer from './components/CollegeExplorer';
import filterData from './data/filterOptions.json';
import Select from 'react-select';

import { db } from './services/firebase';
import { fetchFilteredCutoffs } from './services/firestoreSearch';

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

  const [filteredCutoffs, setFilteredCutoffs] = useState([]);
  const [lastDoc, setLastDoc] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);

  // [STEP 3+4 FIX] Pure local-JSON filter using pre-normalized fields.
  const executeSearch = React.useCallback((isLoadMore = false) => {
    if (isLoadMore) {
      setIsLoadingMore(true);
    } else {
      setIsSearching(true);
      setFilteredCutoffs([]);
    }

    setError(null);
    setWarning(null);

    // Safety guard: dataset not yet loaded
    if (!allCutoffs?.length) {
      setFilteredCutoffs([]);
      setWarning("Dataset still loading. Please wait and try again.");
      setIsSearching(false);
      setIsLoadingMore(false);
      return;
    }

    // [STEP 5 DEBUG] Log applied filters so we can trace mismatches
    console.info('[DEBUG] executeSearch called with filters:', JSON.stringify(filters));

    console.time('[PERF] local filter+sort');
    let localResults = allCutoffs;

    // [STEP 4 FIX] Year — use year_norm (pre-computed string, always trimmed)
    // OLD BUG: String(item.year) could include whitespace or be a number, causing mismatches
    if (filters.year && filters.year !== 'all') {
      const yTarget = String(filters.year).trim();
      localResults = localResults.filter(item => item.year_norm === yTarget);
      console.info(`[DEBUG] After year="${yTarget}" filter: ${localResults.length} records`);
    }

    // [STEP 4 FIX] Round — direct string compare on round_norm (works for both "1" and "Special Round")
    // OLD BUG: built roundTarget by stripping "Round " and then comparing, which broke named rounds
    if (filters.round && filters.round !== 'all' && filters.round !== 'All Rounds') {
      const rTarget = String(filters.round).trim();
      localResults = localResults.filter(item => item.round_norm === rTarget);
      console.info(`[DEBUG] After round="${rTarget}" filter: ${localResults.length} records`);
    }

    // Institute — pre-computed institute_lower; normalizeString called ONCE (not per item)
    if (filters.institute && filters.institute !== 'all') {
      const instTarget = normalizeString(filters.institute);
      localResults = localResults.filter(item => item.institute_lower === instTarget);
    }

    // Program — exact match first (fast path), .includes() fallback for partial names
    if (filters.program && filters.program !== 'all') {
      const progTarget = normalizeString(filters.program);
      localResults = localResults.filter(item =>
        item.program_lower === progTarget ||
        item.program_lower.includes(progTarget)
      );
    }

    // Category, Quota, Gender — simple exact string compare (fastest possible)
    if (filters.category && filters.category !== 'all' && filters.category !== 'All Categories') {
      localResults = localResults.filter(item => item.category === filters.category);
    }
    if (filters.quota && filters.quota !== 'all' && filters.quota !== 'All Quotas') {
      localResults = localResults.filter(item => item.quota === filters.quota);
    }
    if (filters.gender && filters.gender !== 'all' && filters.gender !== 'All Genders') {
      localResults = localResults.filter(item => item.gender === filters.gender);
    }

    // Sort by closing_rank ascending
    localResults.sort((a, b) => (parseInt(a.closing_rank) || 9999999) - (parseInt(b.closing_rank) || 9999999));

    console.timeEnd('[PERF] local filter+sort');
    console.info(`[PERF] Final results: ${localResults.length} total, showing up to 500`);

    if (localResults.length === 0 && !isLoadMore) {
      // [STEP 6] Helpful message for 2025 — tell user data exists but filter may be too strict
      const year2025count = allCutoffs.filter(r => r.year_norm === '2025').length;
      if (filters.year === '2025' && year2025count > 0) {
        setWarning(`No results for your current 2025 filters. (${year2025count} total 2025 records loaded — try fewer filters.)`);
      } else {
        setWarning("No cutoffs found for those filters. Try removing one or more filters.");
      }
    }

    const limitedResults = localResults.slice(0, 500);

    // setTimeout(0) — yields browser paint cycle before committing state → no UI freeze
    setTimeout(() => {
      setFilteredCutoffs(limitedResults);
      setLastDoc(null);
      setHasMore(false);
      setIsSearching(false);
      setIsLoadingMore(false);
    }, 0);
  }, [filters, allCutoffs]);


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
    setWarning(null);
    setError(null);
  }, []);

  // Fetch JSON Data exactly ONCE on mount
  useEffect(() => {
    let isMounted = true;
    const loadStaticData = async () => {
      try {
        setLoading(true);

        // Load the fixed dataset — cutoffs.min.json now has year="2025" on all records
        // (run: node fix-dataset-year.js to confirm)
        const response = await fetch('/cutoffs.min.json');
        if (!response.ok) throw new Error(`Failed to load dataset (HTTP ${response.status})`);
        const data = await response.json();

        console.time('[PERF] preprocessing');

        // Pre-normalize ALL fields ONCE at load time.
        // year_norm   — forced to "2025" (belt-and-suspenders; data file already has year="2025")
        // round_norm  — numeric rounds: "Round 1" → "1"; named rounds: kept as-is
        //               e.g. "Special Round" → "Special Round", "Spot Round" → "Spot Round"
        // institute_lower, program_lower — exact string match in filter
        // category_norm — lowercase normalized once
        const processed = data.map(item => {
          const rawRound = String(item.round ?? '').trim();
          const round_norm = /^Round\s*\d+$/i.test(rawRound)
            ? rawRound.replace(/^Round\s*/i, '').trim()  // "Round 1" → "1"
            : rawRound;                                   // "Special Round" → "Special Round"

          return {
            ...item,
            year_norm: '2025', // forced unconditionally — entire dataset is 2025 counselling
            institute_lower: normalizeString(item.institute),
            program_lower:   normalizeString(item.program),
            program_norm:    (item.program ?? '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ').trim().split(/\s+/).pop() || '',
            round_norm,
            category_norm:   normalizeString(item.category),
          };
        });

        console.timeEnd('[PERF] preprocessing');
        console.info(`[PERF] Loaded & pre-processed ${processed.length} records.`);

        // [DEBUG] Confirm year distribution — should be { "2025": 10804 }
        const yearDist = {};
        for (const r of processed) { yearDist[r.year_norm] = (yearDist[r.year_norm] || 0) + 1; }
        console.info('[DEBUG] Year distribution after preprocessing:', yearDist);

        // [DEBUG] Sample of round_norm values — confirm "Special Round" etc. are preserved
        const roundSample = [...new Set(processed.map(r => r.round_norm))].slice(0, 10);
        console.info('[DEBUG] Sample round_norm values:', roundSample);

        if (isMounted) {
          setAllCutoffs(processed);
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
  }, []); // Empty array → runs exactly ONCE

  // (Static dataset still loaded for dropdown dynamic options if needed)

  // [STEP 2 FIX] Build year→rounds map ONCE. Use year_norm + round_norm (both strings).
  // BUG WAS HERE: old code did parseInt(item.round_norm) — returned NaN for "Special Round",
  // "Spot Round", "Mop-up Round" etc. → if (!isNaN(r)) skipped them ALL → year 2025 had empty map.
  const yearRoundMap = useMemo(() => {
    if (!allCutoffs.length) return {};
    const map = {};
    for (const item of allCutoffs) {
      const y = item.year_norm || String(item.year ?? '').trim(); // prefer pre-computed year_norm
      const r = item.round_norm;                                   // full string: "1", "2", "Special Round" etc.
      if (!y || !r) continue;
      if (!map[y]) map[y] = new Set();
      map[y].add(r);
    }
    // Sort: numeric rounds first (1, 2, 3…) then named rounds alphabetically
    const result = {};
    for (const y in map) {
      const rounds = [...map[y]];
      result[y] = rounds.sort((a, b) => {
        const aNum = parseInt(a), bNum = parseInt(b);
        const aIsNum = !isNaN(aNum), bIsNum = !isNaN(bNum);
        if (aIsNum && bIsNum) return aNum - bNum;     // both numeric → sort by value
        if (aIsNum) return -1;                         // numeric before named
        if (bIsNum) return  1;
        return a.localeCompare(b);                     // both named → alphabetical
      });
    }

    // [STEP 5 DEBUG] Log map so we can confirm 2025 rounds appear
    console.info('[DEBUG] yearRoundMap built:', Object.fromEntries(
      Object.entries(result).map(([y, rs]) => [y, rs.length + ' rounds: ' + rs.join(', ')])
    ));
    return result;
  }, [allCutoffs]);

  // O(1) lookup — no iteration on year dropdown change
  const roundOptions = useMemo(() => {
    if (!allCutoffs.length) return [];

    let rounds;
    if (!filters.year || filters.year === 'all') {
      // Merge all years' rounds into one sorted list
      const allRounds = new Set();
      for (const rs of Object.values(yearRoundMap)) rs.forEach(r => allRounds.add(r));
      rounds = [...allRounds];
    } else {
      rounds = yearRoundMap[String(filters.year)] || [];
    }

    // Same sort: numeric first, then named
    return [...rounds].sort((a, b) => {
      const aNum = parseInt(a), bNum = parseInt(b);
      const aIsNum = !isNaN(aNum), bIsNum = !isNaN(bNum);
      if (aIsNum && bIsNum) return aNum - bNum;
      if (aIsNum) return -1;
      if (bIsNum) return  1;
      return a.localeCompare(b);
    });
  }, [yearRoundMap, filters.year, allCutoffs.length]);

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
          <>
            <CutoffList 
               cutoffs={filteredCutoffs} 
            />
            {hasMore ? (
              <div style={{ textAlign: 'center', marginTop: '1.5rem', marginBottom: '2rem' }}>
                <button 
                  onClick={handleLoadMore} 
                  disabled={isLoadingMore}
                  style={{
                    padding: '0.75rem 2rem', 
                    borderRadius: '8px', 
                    background: 'rgba(59, 130, 246, 0.2)', 
                    color: '#60a5fa', 
                    border: '1px solid #3b82f6', 
                    cursor: 'pointer',
                    fontWeight: 'bold',
                    opacity: isLoadingMore ? 0.6 : 1
                  }}
                >
                  {isLoadingMore ? 'Loading...' : 'Load More'}
                </button>
              </div>
            ) : filteredCutoffs.length > 0 ? (
               <div style={{ textAlign: 'center', marginTop: '1.5rem', marginBottom: '2rem', color: 'var(--text-secondary)' }}>
                 No more results.
               </div>
            ) : null}
          </>
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
