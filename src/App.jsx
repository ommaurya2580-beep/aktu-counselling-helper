import React, { useEffect, useState } from 'react';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { db } from './firebase';
import CutoffList from './components/CutoffList';
import CutoffAnalytics from './components/CutoffAnalytics';
import RankPredictor from './components/RankPredictor';
import CollegeExplorer from './components/CollegeExplorer';
import filterData from './data/filterOptions.json';
function App() {
  const [activeTab, setActiveTab] = useState('search'); // 'search', 'analytics', 'predictor', 'colleges'
  const [cutoffs, setCutoffs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  const [uniqueInstitutes, setUniqueInstitutes] = useState(filterData.institutes || []);
  const [uniquePrograms, setUniquePrograms] = useState(filterData.programs || []);
  const [uniqueCategories, setUniqueCategories] = useState(filterData.categories || []);
  const [uniqueQuotas, setUniqueQuotas] = useState(filterData.quotas || []);
  const [uniqueGenders, setUniqueGenders] = useState(filterData.genders || []);
  const [filtersLoading, setFiltersLoading] = useState(false);
  const [schemaTypes, setSchemaTypes] = useState({ year: 'number', round: 'number' }); // We know from DB schema that these are numbers

  // Filter States
  const [filters, setFilters] = useState({
    year: '2024', // Default latest year we have data for
    round: '',
    institute: '',
    program: '',
    category: '',
    quota: '',
    gender: ''
  });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleResetFilters = () => {
    setFilters({
      year: '2024',
      round: '',
      institute: '',
      program: '',
      category: '',
      quota: '',
      gender: ''
    });
    setCutoffs([]);
    setWarning(null);
    setError(null);
  };

  const fetchFilterOptions = async () => {
    // No longer needed! Static JSON is loaded instantly.
    // This saves 50,000+ document reads per day and prevents Firebase Quota Exceeded errors.
    setFiltersLoading(false);
  };

  const fetchCutoffs = async () => {
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      let q = collection(db, 'cutoffs');

      // 1) Normalize strings
      const fYear = filters.year?.trim() || "";
      const fRound = filters.round?.trim() || "";
      const fInstitute = filters.institute?.trim() || "";
      const fProgram = filters.program?.trim() || "";
      const fCategory = filters.category?.trim() || "";
      const fQuota = filters.quota?.trim() || "";
      const fGender = filters.gender?.trim() || "";

      // 2) Log Filter Values
      console.log("Search Filters:", {
        year: fYear,
        round: fRound,
        institute: fInstitute,
        program: fProgram,
        category: fCategory,
        quota: fQuota,
        gender: fGender
      });
      console.log("Selected Institute:", fInstitute);

      // 3) Build Minimal Firestore Query
      const conditions = [];

      if (fYear) {
        conditions.push(where('year', '==', schemaTypes.year === 'number' ? parseInt(fYear) : fYear));
      }
      if (fRound && fRound !== "All Rounds") {
        conditions.push(where('round', '==', schemaTypes.round === 'number' ? parseInt(fRound) : fRound));
      }

      if (conditions.length > 0) {
        q = query(q, ...conditions);
      }

      // 4) Fetch Data
      const querySnapshot = await getDocs(q);
      console.log("Documents from Firestore:", querySnapshot.size);

      // 5) Normalize, Apply Frontend Filters and Partial Matching
      let filteredResults = querySnapshot.docs
        .map(doc => {
          const row = doc.data();
          // Normalize string fields
          return {
            id: doc.id,
            ...row,
            program: typeof row.program === 'string' ? row.program.trim() : (row.program || ""),
            institute: typeof row.institute === 'string' ? row.institute.trim() : (row.institute || ""),
            category: typeof row.category === 'string' ? row.category.trim() : (row.category || ""),
            quota: typeof row.quota === 'string' ? row.quota.trim() : (row.quota || ""),
            gender: typeof row.gender === 'string' ? row.gender.trim() : (row.gender || "")
          };
        })
        .filter(row =>
          (!fProgram || row.program.toLowerCase().includes(fProgram.toLowerCase())) &&
          (!fCategory || row.category === fCategory) &&
          (!fQuota || row.quota === fQuota) &&
          (!fGender || row.gender === fGender) &&
          (!fInstitute || row.institute.toLowerCase().includes(fInstitute.toLowerCase()))
        );

      console.log("Documents after filtering:", filteredResults.length);

      // 6) Sort Results by Closing Rank
      filteredResults.sort((a, b) => {
        const rankA = parseInt(a.closing_rank) || parseInt(a.closing_rank?.toString().replace(/,/g, '')) || 9999999;
        const rankB = parseInt(b.closing_rank) || parseInt(b.closing_rank?.toString().replace(/,/g, '')) || 9999999;
        return rankA - rankB;
      });

      setCutoffs(filteredResults);

      // 7) Handle Empty Results
      if (filteredResults.length === 0) {
        setWarning("No exact cutoff found for the selected filters. Try removing some filters.");
      }

    } catch (err) {
      console.error("Error fetching data:", err);
      if (err.message.includes('requires an index')) {
        setError("This complex query requires a Firestore index. Please check your console for the direct link to create it, or deploy Indexes via Firebase CLI.");
      } else {
        setError("Failed to fetch cutoff data. Check connection and try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  // Initial load
  useEffect(() => {
    fetchFilterOptions();
    fetchCutoffs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
              <select
                name="institute"
                value={filters.institute}
                onChange={handleFilterChange}
                disabled={filtersLoading}
              >
                <option value="">All Institutes</option>
                {uniqueInstitutes.map((inst, index) => (
                  <option key={index} value={inst}>{inst}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Program Name</label>
              <select
                name="program"
                value={filters.program}
                onChange={handleFilterChange}
                disabled={filtersLoading}
              >
                <option value="">All Programs</option>
                {uniquePrograms.map((prog, index) => (
                  <option key={index} value={prog}>{prog}</option>
                ))}
              </select>
            </div>
            <div className="filter-group">
              <label>Category</label>
              <select
                name="category"
                value={filters.category}
                onChange={handleFilterChange}
                disabled={filtersLoading}
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
                disabled={filtersLoading}
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
                disabled={filtersLoading}
              >
                <option value="">All Genders</option>
                {uniqueGenders.map((gen, index) => (
                  <option key={index} value={gen}>{gen}</option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', gap: '1rem', marginTop: '1rem' }}>
            <button className="search-btn" onClick={fetchCutoffs} disabled={loading} style={{ flex: 2 }}>
              {loading ? 'Searching...' : 'Search Cutoffs'}
            </button>
            <button className="reset-btn" onClick={handleResetFilters} disabled={loading} style={{ flex: 1 }}>
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
          <div className="loader-container">
            <div className="loader"></div>
          </div>
        ) : activeTab === 'search' ? (
          <CutoffList 
             cutoffs={cutoffs} 
             filters={filters} 
          />
        ) : null}
          </>
        )}

        {activeTab === 'analytics' && (
          <CutoffAnalytics 
            db={db} 
            uniqueInstitutes={uniqueInstitutes} 
            uniquePrograms={uniquePrograms} 
            uniqueCategories={uniqueCategories} 
          />
        )}

        {activeTab === 'predictor' && (
          <RankPredictor
            db={db}
            uniqueCategories={uniqueCategories}
            uniqueQuotas={uniqueQuotas}
            uniquePrograms={uniquePrograms}
          />
        )}

        {activeTab === 'colleges' && (
          <CollegeExplorer
            db={db}
            uniqueInstitutes={uniqueInstitutes}
          />
        )}
      </main>
    </>
  );
}

export default App;
