import React, { useState, useMemo, useEffect } from 'react';
import Select from 'react-select';
import { 
  loadComparisonData, 
  compareFast, 
  compareBranches, 
  findWinner,
  normalize
} from '../utils/comparisonLoader.js';

const customStyles = {
  control: (base, state) => ({
    ...base,
    background: "rgba(255, 255, 255, 0.05)",
    backdropFilter: "blur(40px)",
    borderColor: state.isFocused ? "rgba(99, 102, 241, 0.4)" : "rgba(255, 255, 255, 0.1)",
    borderRadius: "1.5rem",
    padding: "10px",
    color: "white",
    boxShadow: state.isFocused ? "0 0 20px rgba(99, 102, 241, 0.1)" : "none",
    "&:hover": { borderColor: "rgba(255, 255, 255, 0.2)" },
    cursor: "pointer",
  }),
  menu: (base) => ({
    ...base,
    background: "rgba(15, 23, 42, 0.98)",
    backdropFilter: "blur(20px)",
    borderRadius: "1.5rem",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
    zIndex: 9999
  }),
  option: (base, state) => ({
    ...base,
    background: state.isSelected ? "rgba(99, 102, 241, 0.4)" : state.isFocused ? "rgba(255, 255, 255, 0.05)" : "transparent",
    color: "white",
    padding: "14px 24px",
    fontSize: "0.75rem",
    fontWeight: "800",
    cursor: "pointer",
    transition: "all 0.2s ease",
    textTransform: "uppercase",
    letterSpacing: "0.05em"
  }),
  input: (base) => ({ ...base, color: "white" }),
  singleValue: (base) => ({ ...base, color: "white", fontWeight: "800", fontSize: "0.875rem" }),
  placeholder: (base) => ({ ...base, color: "rgba(71, 85, 105, 1)", fontSize: "0.875rem", fontWeight: "800" }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

/* ─── constants ─────────────────────────────────────────────────── */
const MAX_SELECTED_COLLEGES = 3;

/* ─── sub-components ────────────────────────────────────────────── */
function RankChip({ name, onRemove }) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 text-slate-300 px-5 py-2.5 rounded-2xl text-[11px] font-black flex items-center gap-4 animate-in fade-in zoom-in duration-300 group/chip transition-all hover:bg-white/10 hover:border-indigo-500/30 font-outfit">
      <span className="truncate max-w-[280px] uppercase tracking-wider">{name.split(',')[0]}</span>
      <button 
        onClick={() => onRemove(name)} 
        className="w-5 h-5 rounded-full bg-white/5 group-hover/chip:bg-red-500/20 group-hover/chip:text-red-400 transition-all flex items-center justify-center text-base leading-none"
        aria-label={`Remove ${name}`}
      >
        ×
      </button>
    </div>
  );
}

function MatrixCell({ college, isWinner }) {
  if (!college.exists) {
    return (
      <div className="group h-full flex items-center justify-center p-6 rounded-[2rem] bg-white/[0.02] border border-dashed border-white/5 text-slate-700 text-[10px] font-black uppercase tracking-[0.25em] italic opacity-30 font-outfit transition-all hover:opacity-50">
        Not Offered
      </div>
    );
  }

  return (
    <div className={`h-full p-8 rounded-[2.5rem] transition-all duration-700 relative font-outfit group/cell shadow-xl ${isWinner ? 'bg-indigo-500/10 border border-indigo-500/30 ring-1 ring-indigo-500/20 shadow-[0_0_50px_rgba(99,102,241,0.15)]' : 'bg-white/5 border border-white/10 hover:bg-white/[0.08] hover:border-white/20'}`}>
      {isWinner && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1.5 bg-gradient-to-r from-indigo-500 to-blue-600 rounded-full text-[9px] font-black text-white uppercase tracking-[0.15em] shadow-xl flex items-center gap-2 leading-none whitespace-nowrap border border-white/20 animate-in zoom-in duration-500 group-hover/cell:scale-110 transition-transform">
          <span className="text-amber-300">★</span> Best Choice
        </div>
      )}
      
      <div className="flex flex-col items-center">
        <div className="flex items-center gap-2 mb-6">
          <div className={`w-1.5 h-1.5 rounded-full ${isWinner ? 'bg-indigo-400' : 'bg-slate-600'}`}></div>
          <div className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.15em] opacity-80">
            {college.category}
            {college.isFallback && <span className="text-amber-500/80 ml-1.5 font-black">[FB]</span>}
          </div>
        </div>
        
        <div className="flex flex-col w-full gap-5">
          <div className="flex justify-between items-end border-b border-white/5 pb-4 group-hover/cell:border-white/10 transition-colors">
            <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest leading-none">Opening</span>
            <span className="text-slate-400 text-lg font-black tabular-nums transition-colors group-hover/cell:text-white">
              {isNaN(Number(college.opening_rank)) ? college.opening_rank : Number(college.opening_rank).toLocaleString()}
            </span>
          </div>
          <div className="flex justify-between items-end">
            <span className="text-[10px] text-slate-600 font-black uppercase tracking-widest leading-none">Closing</span>
            <span className={`text-2xl font-black italic tabular-nums tracking-tighter transition-all duration-500 ${isWinner ? 'text-indigo-400 scale-110' : 'text-slate-200 group-hover/cell:text-indigo-300'}`}>
              {isNaN(Number(college.closing_rank)) ? college.closing_rank : Number(college.closing_rank).toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

const RankComparison = ({ collegeList = [], uniqueCategories = [], uniqueQuotas = [] }) => {
  const [selectedColleges, setSelectedColleges] = useState([]);
  const [selectedRound, setSelectedRound] = useState('Round 1');
  const [filters, setFilters] = useState({
    category: 'OPEN',
    quota: 'Home State',
    gender: 'Both Male and Female Seats'
  });
  const [loading, setLoading] = useState(false);
  const [filterOptions, setFilterOptions] = useState({
    institutes: collegeList,
    categories: uniqueCategories,
    quotas: uniqueQuotas,
    genders: ['Both Male and Female Seats', 'Female Seats Only'],
    rounds: ['Round 1', 'Round 2', 'Round 3', 'Round 4', 'Round 6', 'Round 7']
  });

  // Synchronize internal state if props change
  useEffect(() => {
    setFilterOptions(prev => ({
      ...prev,
      institutes: collegeList,
      categories: uniqueCategories,
      quotas: uniqueQuotas
    }));
  }, [collegeList, uniqueCategories, uniqueQuotas]);


  // Fetch comparison data on mount
  useEffect(() => {
    const initData = async () => {
      setLoading(true);
      try {
        await loadComparisonData();
      } catch (error) {
        console.error('Error initializing comparison data:', error);
      } finally {
        setLoading(false);
      }
    };
    initData();
  }, []);

  const handleSelectCollege = (college) => {
    if (selectedColleges.length < MAX_SELECTED_COLLEGES) {
      setSelectedColleges([...selectedColleges, college]);
    }
  };

  const handleRemoveCollege = (college) => {
    setSelectedColleges(selectedColleges.filter(c => c !== college));
  };

  // Handle async updates for comparison results
  const [comparisonResults, setComparisonResults] = useState([]);
  
  useEffect(() => {
    const updateResults = async () => {
        if (selectedColleges.length === 0) {
            setComparisonResults([]);
            return;
        }
        
        setLoading(true);
        try {
            const data = await loadComparisonData();
            if (!data) return;

            const roundNum = selectedRound.replace('Round ', '');
            
            // 1. Get raw college data using fast lookup (O(1) + partial match)
            // Using findCollege under the hood in comparisonLoader.js
            const rawCollegeData = compareFast(data, selectedColleges, roundNum);

            const filteredCollegeData = {};
            const targetCategory = normalizeForSearch(filters.category);
            const targetQuota = normalizeForSearch(filters.quota);
            const isFemaleOnly = filters.gender === 'Female Seats Only';

            Object.entries(rawCollegeData).forEach(([collegeName, branches]) => {
                filteredCollegeData[collegeName] = (branches || []).filter(item => {
                    const itemCategory = normalizeForSearch(item.category);
                    const itemQuota = normalizeForSearch(item.quota);
                    
                    let isCategoryMatch = itemCategory === targetCategory || itemCategory.includes(targetCategory);
                    if (targetCategory === 'open' && itemCategory.startsWith('open')) isCategoryMatch = true;

                    if (isFemaleOnly) {
                        if (!item.category.includes('GL') && !item.category.includes('GIRL')) {
                            isCategoryMatch = false;
                        }
                    }

                    const isQuotaMatch = itemQuota === targetQuota || itemQuota.includes(targetQuota);
                    
                    return isCategoryMatch && isQuotaMatch;
                });

                // Fallback to OPEN if no results for specific category
                if (filteredCollegeData[collegeName].length === 0 && targetCategory !== 'open') {
                    filteredCollegeData[collegeName] = (branches || []).filter(item => {
                        const itemCategory = normalizeForSearch(item.category);
                        const itemQuota = normalizeForSearch(item.quota);
                        return itemCategory === 'open' && (itemQuota === targetQuota || itemQuota.includes(targetQuota));
                    }).map(item => ({ ...item, isFallback: true }));
                }
            });

            // 2. Group by branch using specialized utility
            const branchMap = compareBranches(filteredCollegeData);

            // 3. Transform to displayable format
            const transformed = Object.entries(branchMap).map(([branchName, colleges]) => {
                const rowColleges = selectedColleges.map(name => {
                    const match = colleges.find(c => c.college === name);
                    return {
                        name,
                        opening_rank: match?.opening_rank || 'N/A',
                        closing_rank: match?.closing || 'N/A',
                        category: match?.category || (match?.isFallback ? 'OPEN (FB)' : ''),
                        exists: !!match,
                        isFallback: match?.isFallback
                    };
                });

                const winnerObj = findWinner(colleges);

                return {
                    branch: branchName,
                    colleges: rowColleges,
                    winner: winnerObj?.college
                };
            }).sort((a, b) => a.branch.localeCompare(b.branch));

            setComparisonResults(transformed);
        } catch (error) {
            console.error("Error updating comparison results:", error);
        } finally {
            setLoading(false);
        }
    };
    updateResults();
  }, [selectedColleges, selectedRound, filters]);


  return (
    <div className="min-h-screen bg-transparent text-slate-300 pb-20 pt-6 lg:pt-10 font-outfit">
      <div className="max-w-7xl mx-auto px-6">
        <header className="text-left mb-16 relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.8)]"></span>
            Comparison Mode Active
          </div>
          <h2 className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tighter uppercase italic leading-none">
            Rank <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-500">Comparison</span>
          </h2>
          <p className="text-slate-400 font-bold max-w-2xl text-sm md:text-base uppercase tracking-widest opacity-80 leading-relaxed">
            Unbiased branch-level analytical matching across <span className="text-white">AKTU Engineering Institutions</span>.
          </p>
        </header>

        {/* Filters & Selector Box */}
        <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 mb-16 shadow-2xl relative group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full -mr-48 -mt-48 transition-opacity duration-700 opacity-30 group-hover:opacity-60"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12 relative z-10">
            {/* Round Select */}
            <div className="space-y-3">
              <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] ml-2 opacity-60">
                Academic Phase
              </label>
              <Select
                options={filterOptions.rounds.map(r => ({ value: r, label: r }))}
                value={{ value: selectedRound, label: selectedRound }}
                onChange={(selected) => setSelectedRound(selected.value)}
                styles={customStyles}
                menuPortalTarget={document.body}
                placeholder="Select Phase"
              />
            </div>

            {/* Category Select */}
            <div className="space-y-3">
              <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] ml-2 opacity-60">
                Quota Category
              </label>
              <Select
                options={filterOptions.categories.map(c => ({ value: c, label: c }))}
                value={{ value: filters.category, label: filters.category }}
                onChange={(selected) => setFilters({...filters, category: selected.value})}
                styles={customStyles}
                menuPortalTarget={document.body}
                placeholder="Select Category"
              />
            </div>

            {/* Quota Select */}
            <div className="space-y-3">
              <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] ml-2 opacity-60">
                State Eligibility
              </label>
              <Select
                options={filterOptions.quotas.map(q => ({ value: q, label: q }))}
                value={{ value: filters.quota, label: filters.quota }}
                onChange={(selected) => setFilters({...filters, quota: selected.value})}
                styles={customStyles}
                menuPortalTarget={document.body}
                placeholder="Select State"
              />
            </div>

            {/* Gender Select */}
            <div className="space-y-3">
              <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] ml-2 opacity-60">
                Seating Stream
              </label>
              <Select
                options={filterOptions.genders.map(g => ({ value: g, label: g }))}
                value={{ value: filters.gender, label: filters.gender }}
                onChange={(selected) => setFilters({...filters, gender: selected.value})}
                styles={customStyles}
                menuPortalTarget={document.body}
                placeholder="Select Stream"
              />
            </div>
          </div>

          {/* College Selector */}
          <div className="relative pt-12 border-t border-white/5 z-10">
            <div className="flex flex-col lg:flex-row gap-8 items-end">
              <div className="flex-1 w-full space-y-4">
                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] ml-2 opacity-60">
                   Institutional Selection ({selectedColleges.length}/{MAX_SELECTED_COLLEGES})
                </label>
                <div className="relative group/search">
                  <Select
                    options={filterOptions.institutes.filter(inst => !selectedColleges.includes(inst)).map(inst => ({ value: inst, label: inst }))}
                    onChange={(selected) => handleSelectCollege(selected.value)}
                    value={null}
                    styles={customStyles}
                    isSearchable={true}
                    isDisabled={selectedColleges.length >= MAX_SELECTED_COLLEGES}
                    menuPortalTarget={document.body}
                    placeholder={selectedColleges.length >= MAX_SELECTED_COLLEGES ? 'LIMIT REACHED' : 'SEARCH INSTITUTION NAME...'}
                  />
                </div>
              </div>

              {selectedColleges.length > 0 && (
                <button 
                  onClick={() => setSelectedColleges([])}
                  className="px-10 py-7 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all h-[70px] whitespace-nowrap active:scale-95 font-outfit shadow-lg shadow-red-500/5 group-hover:shadow-red-500/10 self-end"
                >
                  Purge Selection
                </button>
              )}
            </div>
            
            <div className="flex flex-wrap gap-4 mt-10 min-h-[60px]">
              {selectedColleges.map(c => (
                <RankChip key={c} name={c} onRemove={handleRemoveCollege} />
              ))}
              {selectedColleges.length === 0 && (
                <div className="w-full text-center py-6 text-slate-700 italic font-black uppercase tracking-[0.4em] text-[10px] opacity-40 animate-pulse">
                   Awaiting System Input... Select targets to initialize matrix
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Comparison Engine Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-40 space-y-6">
            <div className="relative">
              <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
              <div className="absolute inset-0 bg-indigo-500/10 blur-xl animate-pulse"></div>
            </div>
            <div className="flex flex-col items-center">
              <p className="text-white font-black tracking-[0.3em] text-[10px] uppercase">Processing Data</p>
              <div className="flex gap-1 mt-2">
                {[1,2,3].map(i => <div key={i} className="w-1 h-1 bg-indigo-500 rounded-full animate-bounce" style={{animationDelay: `${i*150}ms`}}></div>)}
              </div>
            </div>
          </div>
        ) : selectedColleges.length > 0 ? (
          <div className="space-y-8">
            {/* Desktop Table View */}
            <div className="hidden lg:block overflow-hidden rounded-[2.5rem] border border-white/10 shadow-3xl bg-white/5 backdrop-blur-3xl transition-all duration-700">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-10 py-10 text-left w-[300px]">
                        <div className="flex flex-col">
                          <span className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-1">Comparison Matrix</span>
                          <span className="text-white font-black text-lg uppercase tracking-tighter italic font-outfit">Branch Selection</span>
                        </div>
                      </th>
                      {selectedColleges.map((name, i) => (
                        <th key={name} className="px-10 py-10 text-center relative group/th">
                          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500 opacity-0 group-hover/th:opacity-100 transition-opacity"></div>
                          <div className="text-[9px] text-slate-500 font-extrabold uppercase mb-2 tracking-[0.2em] opacity-60">CHOICE #0{i+1}</div>
                          <div className="text-white text-sm font-black truncate max-w-[220px] mx-auto uppercase tracking-tighter font-outfit italic" title={name}>
                            {name.split(',')[0]}
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {comparisonResults.length > 0 ? comparisonResults.map((row, index) => (
                      <tr 
                        key={row.branch} 
                        className="hover:bg-white/[0.02] transition-all group animate-slideUp"
                        style={{ animationDelay: `${index * 40}ms`, animationFillMode: 'both' }}
                      >
                        <td className="px-10 py-10">
                          <div className="flex flex-col gap-1">
                            <div className="text-white font-black text-sm tracking-tight group-hover:text-indigo-400 transition-colors uppercase leading-tight max-w-[220px] font-outfit">
                              {row.branch}
                            </div>
                            <div className="w-8 h-1 bg-indigo-500/20 group-hover:w-12 group-hover:bg-indigo-500 transition-all rounded-full"></div>
                          </div>
                        </td>
                        {row.colleges.map((col, i) => (
                          <td key={i} className="px-10 py-10">
                            <MatrixCell college={col} isWinner={row.winner === col.name} />
                          </td>
                        ))}
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={selectedColleges.length + 1} className="px-10 py-40 text-center">
                          <div className="flex flex-col items-center grayscale opacity-20">
                            <div className="text-6xl mb-6">🏜️</div>
                            <div className="text-slate-500 font-black uppercase tracking-[0.4em] text-xs">
                              No Matching Results
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Mobile Card View */}
            <div className="lg:hidden space-y-6">
              {comparisonResults.length > 0 ? comparisonResults.map((row, index) => (
                <div 
                  key={row.branch} 
                  className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2rem] p-6 space-y-6 shadow-xl animate-slideUp"
                  style={{ animationDelay: `${index * 60}ms`, animationFillMode: 'both' }}
                >
                  <header className="flex flex-col gap-2 pb-4 border-b border-white/5">
                    <span className="text-[9px] font-black text-indigo-400 uppercase tracking-[0.2em]">Specialization</span>
                    <h4 className="text-white font-black uppercase tracking-tight leading-tight font-outfit text-base italic">{row.branch}</h4>
                  </header>
                  
                  <div className="grid grid-cols-1 gap-4">
                    {row.colleges.map((col, i) => (
                      <div key={i} className="space-y-2">
                        <div className="flex items-center justify-between px-2">
                          <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">{selectedColleges[i].split(',')[0]}</span>
                          {row.winner === col.name && col.exists && <span className="text-[8px] font-black text-indigo-400 uppercase tracking-widest bg-indigo-500/10 px-2 py-0.5 rounded-full border border-indigo-500/20">★ Top Choice</span>}
                        </div>
                        <MatrixCell college={col} isWinner={row.winner === col.name} />
                      </div>
                    ))}
                  </div>
                </div>
              )) : (
                <div className="text-center py-32 bg-white/5 rounded-[2rem] border-2 border-dashed border-white/10 opacity-30">
                  <span className="text-5xl block mb-4">🏜️</span>
                  <p className="text-[10px] font-black uppercase tracking-[0.3em]">No Matching Matrices</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="text-center py-48 bg-white/5 backdrop-blur-3xl rounded-[2.5rem] border border-white/10 mb-12 group hover:border-indigo-500/20 transition-all duration-700 shadow-2xl relative overflow-hidden">
             <div className="absolute inset-0 bg-indigo-500/5 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <div className="w-24 h-24 bg-white/5 rounded-[2rem] flex items-center justify-center mx-auto mb-10 group-hover:scale-110 group-hover:rotate-12 transition-all duration-500 relative border border-white/10">
                <span className="text-5xl relative z-10 animate-pulse">⚖️</span>
             </div>
             <h3 className="text-4xl font-black text-white uppercase tracking-widest mb-6 group-hover:text-indigo-400 transition-colors">Analyzer Engine <span className="text-indigo-500">Idle</span></h3>
             <p className="text-slate-400 font-bold max-w-sm mx-auto uppercase tracking-[0.2em] text-[11px] leading-relaxed group-hover:text-slate-300 transition-colors opacity-60">
                Select institutions from the search above to activate <span className="text-white">high-performance</span> branch comparison matrix.
             </p>
          </div>
        )}

        {/* Info Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-4">
          <div className="p-10 rounded-[2.5rem] bg-white/5 backdrop-blur-3xl border border-white/10 relative overflow-hidden group/info shadow-xl">
            <div className="absolute top-0 left-0 w-1 h-full bg-indigo-500/40 group-hover/info:bg-indigo-500 transition-all"></div>
            <h4 className="flex items-center gap-4 text-white font-black uppercase text-[11px] tracking-[0.2em] mb-6 font-outfit">
              <span className="text-indigo-500 text-lg">💡</span>
              Decoding the Winner
            </h4>
            <p className="text-slate-400 text-xs font-bold leading-loose uppercase tracking-wide opacity-80">
              The <span className="text-indigo-400">"Top Choice"</span> badge indicates the college with the <span className="text-white">strictest (lowest) closing rank</span>. This generally points to higher student preference and stronger placement histories for that specific specialization.
            </p>
          </div>
          <div className="p-10 rounded-[2.5rem] bg-white/5 backdrop-blur-3xl border border-white/10 relative overflow-hidden group/info shadow-xl">
            <div className="absolute top-0 left-0 w-1 h-full bg-purple-500/40 group-hover/info:bg-purple-500 transition-all"></div>
            <h4 className="flex items-center gap-4 text-white font-black uppercase text-[11px] tracking-[0.2em] mb-6 font-outfit">
              <span className="text-purple-500 text-lg">📈</span>
              Strategic Filtering
            </h4>
            <p className="text-slate-400 text-xs font-bold leading-loose uppercase tracking-wide opacity-80">
              Cutoffs tend to expand across rounds. If you aren't finding data for your category in Round 1, try exploring <span className="text-purple-400">Round 4 or Round 6</span>, which often include more relaxed criteria and internal slides.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RankComparison;
