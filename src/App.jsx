import React, { useEffect, useState, useMemo } from 'react';
import { normalizeString } from './utils/stringUtils'; 
import CutoffList from './components/CutoffList';
import CutoffTrendGraph from './components/CutoffTrendGraph';
import RankPredictor from './components/RankPredictor';
import CollegeComparison from './pages/CollegeComparison';
import RankComparison from './pages/RankComparison';
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
  const [activeTab, setActiveTab] = useState('search'); 
  const [allCutoffs, setAllCutoffs] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);
  
  const [uniqueInstitutes, setUniqueInstitutes] = useState(collegeList);
  const [uniquePrograms, setUniquePrograms] = useState(programList);
  const [uniqueCategories, setUniqueCategories] = useState(categoryList);
  const [uniqueQuotas, setUniqueQuotas] = useState(quotaList);
  const [uniqueGenders, setUniqueGenders] = useState(['Male Only', 'Female Only', 'Both Male and Female Seats']);

  const [filters, setFilters] = useState(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState(initialFilters);

  const handleFilterChange = React.useCallback((e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  }, []);

  const [filteredCutoffs, setFilteredCutoffs] = useState([]);

  const executeSearch = React.useCallback(() => {
    if (allCutoffs.length === 0) return;
    
    setIsSearching(true);
    setWarning(null);

    const normalize = (str) => (str || "").toLowerCase().replace(/[\r\n\t]/g, " ").trim();
    const selectedCollege = appliedFilters.institute !== 'all' ? appliedFilters.institute : null;
    const selectedBranch = appliedFilters.program !== 'all' ? normalize(appliedFilters.program) : null;

    let filteredResults = allCutoffs.filter(item => {
      const matchRound = appliedFilters.round === 'all' || appliedFilters.round === 'All Rounds' || item.round === appliedFilters.round || `Round ${item.round}` === appliedFilters.round;
      const matchCollege = !selectedCollege || normalizeInstitute(item.institute).includes(normalizeInstitute(selectedCollege));
      const matchBranch = !selectedBranch || normalize(item.program).includes(selectedBranch);
      const matchCategory = appliedFilters.category === 'all' || appliedFilters.category === 'All Categories' || item.category === appliedFilters.category;
      const matchQuota = appliedFilters.quota === 'all' || appliedFilters.quota === 'All Quotas' || item.quota === appliedFilters.quota;
      const matchGender = appliedFilters.gender === 'all' || appliedFilters.gender === 'All Genders' || item.gender === appliedFilters.gender;

      return matchRound && matchCollege && matchBranch && matchCategory && matchQuota && matchGender;
    });

    filteredResults.sort((a, b) => (parseInt(a.closing_rank) || 999999) - (parseInt(b.closing_rank) || 999999));

    setFilteredCutoffs(filteredResults);
    setIsSearching(false);
  }, [appliedFilters, allCutoffs]);

  useEffect(() => {
    executeSearch();
  }, [executeSearch]);

  const handleResetFilters = React.useCallback(() => {
    setFilters(initialFilters);
    setAppliedFilters(initialFilters);
    setWarning(null);
    setError(null);
  }, []);

  useEffect(() => {
    let isMounted = true;
    const loadFilterData = async () => {
      try {
        setLoading(true);
        const res = await fetch('/data/filterOptions.json');
        if (!res.ok) throw new Error(`Failed to load filter options`);
        const filterData = await res.json();
        if (isMounted) {
          if (filterData.genders) setUniqueGenders(filterData.genders);
          setLoading(false);
          executeSearch();
        }
      } catch (err) {
        if (isMounted) {
          setError("Failed to load filter options.");
          setLoading(false);
        }
      }
    };

    const loadCutoffData = () => {
      try {
        const mergedMap = new Map();
        allDataCombined.forEach(item => {
          const inst = (item.institute || item.college_name || "").toUpperCase();
          const prog = (item.program || item.branch || "").toUpperCase();
          const key = `${item.round}-${inst}-${prog}-${item.category}-${item.quota}-${item.gender}-${item.closing_rank}`;
          mergedMap.set(key, { ...item, institute: inst, program: prog });
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

  const roundOptions = useMemo(() => ["All Rounds", "Round 1", "Round 2", "Round 3", "Round 4", "Round 6", "Round 7"], []);

  const instituteOptions = useMemo(() => [
    { label: "All Institutes", value: "all" },
    ...collegeList.map(inst => ({ label: inst.replace(/[\r\n]+/g, ' ').trim(), value: inst }))
  ], []);

  const programOptions = useMemo(() => [
    { label: "All Programs", value: "all" },
    ...uniquePrograms.map(prog => ({ label: prog.replace(/[\r\n]+/g, ' ').trim(), value: prog }))
  ], [uniquePrograms]);

  useEffect(() => {
    if (filters.program && filters.program !== 'all') {
      const isValid = programOptions.some(opt => opt.value === filters.program);
      if (!isValid) setFilters(prev => ({ ...prev, program: 'all' }));
    }
  }, [programOptions, filters.program]);

  const customStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: "rgba(2, 6, 23, 0.6)",
      color: "white",
      borderRadius: "1rem",
      padding: "0.25rem 0.5rem",
      border: state.isFocused ? "1px solid rgba(99, 102, 241, 0.5)" : "1px solid rgba(255, 255, 255, 0.05)",
      boxShadow: state.isFocused ? "0 0 15px rgba(99, 102, 241, 0.1)" : "inset 0 2px 4px rgba(0,0,0,0.1)",
      transition: "all 0.3s ease"
    }),
    singleValue: (base) => ({ ...base, color: "white", fontWeight: "800", fontSize: "0.75rem" }),
    placeholder: (base) => ({ ...base, color: "rgba(148, 163, 184, 0.5)", fontSize: "0.75rem", fontWeight: "800" }),
    menu: (base) => ({ ...base, backgroundColor: "#0f172a", borderRadius: "1rem", border: "1px solid rgba(255, 255, 255, 0.1)", overflow: "hidden", zIndex: 100 }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "rgba(99, 102, 241, 0.2)" : "transparent",
      color: "white",
      padding: "12px 20px",
      fontSize: "0.75rem",
      fontWeight: "800",
      cursor: "pointer",
      transition: "all 0.2s ease"
    }),
    input: (base) => ({ ...base, color: "white" }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  };

  return (
    <div className="h-screen overflow-hidden bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-950 via-slate-900 to-black text-slate-200 flex flex-col selection:bg-indigo-500/30">
      {/* ── Desktop Navigation ── */}
      <nav className="relative z-50 hidden md:block border-b border-white/5 bg-slate-950/40 backdrop-blur-2xl shadow-2xl flex-none">
        <div className="max-w-7xl mx-auto px-10 h-24 flex items-center justify-between">
          <div className="flex items-center gap-4 group cursor-pointer">
            <div className="w-12 h-12 bg-white/5 backdrop-blur-xl rounded-2xl flex items-center justify-center shadow-2xl shadow-indigo-500/10 group-hover:scale-110 group-hover:rotate-3 transition-all duration-500 border border-white/10 overflow-hidden relative">
              <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/20 to-purple-500/20"></div>
              <span className="text-white font-black text-2xl relative z-10">A</span>
            </div>
            <div className="flex flex-col">
              <span className="text-white font-black text-2xl tracking-tighter uppercase leading-none">AKTU <span className="text-indigo-400">Counselling Helper 2026</span></span>
              <span className="text-[10px] font-black text-slate-500 uppercase tracking-[0.4em] mt-1 opacity-50">Official 2025</span>
            </div>
          </div>
          
          <div className="flex items-center gap-1 bg-white/5 p-1.5 rounded-[2rem] border border-white/5 shadow-inner">
            {[
              { id: 'search', icon: '🔍', label: 'Search' },
              { id: 'analytics', icon: '📊', label: 'Analytics' },
              { id: 'predictor', icon: '🚀', label: 'Predictor' },
              { id: 'compare', icon: '⚖️', label: 'Compare' },
              { id: 'rank comparison', icon: '📈', label: 'Rankings' }
            ].map(tab => (
              <button 
                key={tab.id} 
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-2.5 px-7 py-3 rounded-[1.5rem] font-black transition-all duration-500 group/btn ${
                  activeTab === tab.id 
                    ? 'text-white' 
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {activeTab === tab.id ? (
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600/30 to-purple-600/30 rounded-[1.5rem] border border-indigo-500/30 shadow-[0_4px_15px_rgba(99,102,241,0.2)] animate-scaleIn"></div>
                ) : (
                  <div className="absolute inset-0 bg-white/0 group-hover/btn:bg-white/5 rounded-[1.5rem] transition-all duration-300"></div>
                )}
                <span className={`relative z-10 text-xl transition-transform duration-500 ${activeTab === tab.id ? 'scale-125' : 'group-hover/btn:scale-110'}`}>{tab.icon}</span>
                <span className="relative z-10 text-xs uppercase tracking-widest">{tab.label}</span>
                {activeTab === tab.id && (
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-6 h-1 bg-indigo-500 rounded-full shadow-[0_0_15px_#6366f1] animate-fadeIn"></div>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4">
            <div className="px-5 py-2 rounded-full border border-indigo-500/30 bg-indigo-500/5 backdrop-blur-md flex items-center gap-3 shadow-lg">
              <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_#10b981]"></div>
              <span className="text-[10px] font-black text-indigo-300 uppercase tracking-widest leading-none">Live Data</span>
            </div>
          </div>
        </div>
      </nav>

      {/* ── Mobile Top Bar ── */}
      <header className="md:hidden sticky top-0 z-50 bg-slate-950/60 backdrop-blur-2xl border-b border-white/5 px-6 py-5 flex items-center justify-between shadow-2xl flex-none">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-white/5 rounded-xl flex items-center justify-center border border-white/10 overflow-hidden">
            <img src="/logo.png" alt="AKTU" className="w-full h-full object-cover" />
          </div>
          <span className="text-white font-black tracking-tighter uppercase text-base">AKTU <span className="text-indigo-400">Counselling Helper 2026</span></span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/20">Official 2025</span>
        </div>
      </header>

      {/* ── Mobile Bottom Navigation ── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-slate-950/80 backdrop-blur-3xl border-t border-white/5 px-4 pt-4 pb-10 shadow-[0_-20px_40px_rgba(0,0,0,0.6)] rounded-t-[2.5rem]">
        <div className="flex items-center justify-around max-w-md mx-auto">
          {[
            { id: 'search', icon: '🔍', label: 'Search' },
            { id: 'analytics', icon: '📊', label: 'Trends' },
            { id: 'predictor', icon: '🚀', label: 'Predict' },
            { id: 'compare', icon: '⚖️', label: 'Compare' },
            { id: 'rank comparison', icon: '📈', label: 'Rankings' }
          ].map(tab => (
            <button 
              key={tab.id} 
              onClick={() => setActiveTab(tab.id)}
              className="flex flex-col items-center gap-2 group transition-all"
            >
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-500 relative ${
                activeTab === tab.id 
                  ? 'bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 shadow-[0_8px_25px_rgba(79,70,229,0.3)] scale-110' 
                  : 'text-slate-500 active:scale-90'
              }`}>
                {activeTab === tab.id && (
                  <div className="absolute inset-0 bg-indigo-500/10 blur-xl rounded-full animate-pulse"></div>
                )}
                <span className={`text-2xl transition-transform relative z-10 ${activeTab === tab.id ? 'scale-110' : ''}`}>{tab.icon}</span>
              </div>
              <span className={`text-[9px] font-black uppercase tracking-tighter transition-all relative z-10 ${
                activeTab === tab.id ? 'text-indigo-400 translate-y-0.5' : 'text-slate-600 opacity-60'
              }`}>
                {tab.label}
              </span>
            </button>
          ))}
        </div>
      </nav>

      <div className="w-full max-w-7xl mx-auto px-4 sm:px-10 flex-1 overflow-hidden">
        <main key={activeTab} className={`h-full w-full animate-slideUp pb-12 ${activeTab !== 'predictor' ? 'overflow-y-auto' : 'overflow-hidden'}`}>
          <div className={`${activeTab !== 'predictor' ? 'pt-8' : ''} h-full`}>

          {activeTab === 'search' && (
            <>
              {/* Filter Controls Section */}
              <section className="bg-slate-900/40 backdrop-blur-3xl border border-white/10 rounded-[3.5rem] p-10 md:p-12 mb-16 shadow-2xl relative group">
                <div className="absolute -top-24 -right-24 w-96 h-96 bg-indigo-500/10 blur-[120px] rounded-full transition-opacity duration-1000 opacity-30 group-hover:opacity-60"></div>
                <div className="absolute -bottom-24 -left-24 w-80 h-80 bg-purple-500/5 blur-[100px] rounded-full transition-opacity duration-1000 opacity-20 group-hover:opacity-40"></div>
                
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 pb-8 border-b border-white/5 gap-6">
                  <div className="flex flex-col">
                    <h3 className="text-3xl md:text-4xl font-black text-white flex items-center gap-4 uppercase tracking-tighter italic">
                      Discovery <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400">Engine</span>
                    </h3>
                    <p className="text-slate-500 text-[11px] font-black uppercase tracking-[0.4em] mt-3 opacity-60">Multi-parameter search optimization</p>
                  </div>
                  <button 
                    onClick={handleResetFilters}
                    className="h-12 px-6 rounded-2xl text-[10px] font-black uppercase tracking-[0.25em] text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 border border-white/5 transition-all flex items-center gap-3 backdrop-blur-sm shadow-xl"
                  >
                    <span className="text-base">↺</span> Refresh Index
                  </button>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
                  {/* Row 1 */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 opacity-60">Session</label>
                    <div className="relative group/field">
                      <select name="year" value={filters.year} onChange={handleFilterChange} className="w-full bg-slate-950/60 border border-white/5 rounded-2xl px-6 py-4 text-white font-black outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all appearance-none cursor-pointer text-xs shadow-inner group-hover/field:border-white/10">
                        <option value="all">Official 2025</option>
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600 text-[10px]">▼</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 opacity-60">Phase</label>
                    <div className="relative group/field">
                      <select name="round" value={filters.round} onChange={handleFilterChange} className="w-full bg-slate-950/60 border border-white/5 rounded-2xl px-6 py-4 text-white font-black outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all appearance-none cursor-pointer text-xs shadow-inner group-hover/field:border-white/10">
                        {roundOptions.map(r => (
                          <option key={r} value={r} className="bg-slate-900 text-slate-200">
                            {r === 'All Rounds' ? 'Round 1 to 7' : r}
                          </option>
                        ))}
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600 text-[10px]">▼</div>
                    </div>
                  </div>

                  <div className="space-y-3 lg:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 opacity-60">Institution</label>
                      <Select
                        options={instituteOptions}
                        onChange={(selected) => handleFilterChange({ target: { name: 'institute', value: selected.value } })}
                        value={instituteOptions.find(opt => opt.value === filters.institute)}
                        styles={customStyles}
                        isSearchable={true}
                        isDisabled={loading}
                        menuPortalTarget={document.body}
                        placeholder="University or Institute name..."
                      className="text-xs font-black"
                    />
                  </div>

                  {/* Row 2 */}
                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 opacity-60">Categorization</label>
                    <div className="relative group/field">
                      <select
                        name="category"
                        value={filters.category}
                        onChange={handleFilterChange}
                        disabled={loading}
                        className="w-full bg-slate-950/60 border border-white/5 rounded-2xl px-6 py-4 text-white font-black outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all appearance-none cursor-pointer text-xs shadow-inner group-hover/field:border-white/10"
                      >
                        <option value="all">All Profiles</option>
                        {uniqueCategories.map((cat, index) => (
                          <option key={index} value={cat} className="bg-slate-900">{cat}</option>
                        ))}
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600 text-[10px]">▼</div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 opacity-60">Quota</label>
                    <div className="relative group/field">
                      <select
                        name="quota"
                        value={filters.quota}
                        onChange={handleFilterChange}
                        disabled={loading}
                        className="w-full bg-slate-950/60 border border-white/5 rounded-2xl px-6 py-4 text-white font-black outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all appearance-none cursor-pointer text-xs shadow-inner group-hover/field:border-white/10"
                      >
                        <option value="all">Global Quota</option>
                        {uniqueQuotas.map((quota, index) => (
                          <option key={index} value={quota} className="bg-slate-900">{quota}</option>
                        ))}
                      </select>
                      <div className="absolute right-6 top-1/2 -translate-y-1/2 pointer-events-none text-slate-600 text-[10px]">▼</div>
                    </div>
                  </div>

                  <div className="space-y-3 lg:col-span-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-2 opacity-60">Discipline</label>
                    <Select
                      options={programOptions}
                      onChange={(selected) => handleFilterChange({ target: { name: 'program', value: selected.value } })}
                      value={programOptions.find(opt => opt.value === filters.program)}
                      styles={customStyles}
                      isSearchable={true}
                      isDisabled={loading}
                      menuPortalTarget={document.body}
                      placeholder="Engineering or Medical Discipline..."
                      className="text-xs font-black"
                    />
                  </div>
                </div>
                
                <div className="mt-12 flex flex-col md:flex-row gap-6">
                  <button 
                    className="flex-[4] h-20 group relative overflow-hidden rounded-[1.75rem] shadow-2xl shadow-indigo-600/20 active:scale-[0.98] transition-all"
                    onClick={() => setAppliedFilters(filters)} 
                    disabled={loading || isSearching} 
                  >
                    <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 group-hover:scale-110 transition-transform duration-700 bg-[length:200%_100%] group-hover:bg-[100%_0%]"></div>
                    <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                    <span className="relative z-10 text-white font-black text-xl uppercase tracking-[0.3em] flex items-center justify-center gap-5">
                      {isSearching ? (
                        <>
                          <div className="w-6 h-6 border-3 border-white/20 border-t-white rounded-full animate-spin"></div>
                          Processing Matrix...
                        </>
                      ) : (
                        <>Initialize Search <span className="text-2xl italic group-hover:translate-x-2 transition-transform">→</span></>
                      )}
                    </span>
                  </button>

                  <button 
                    onClick={handleResetFilters}
                    className="flex-1 h-20 bg-slate-950/40 hover:bg-slate-900 border border-white/5 rounded-[1.75rem] font-black uppercase tracking-[0.25em] text-slate-500 hover:text-white transition-all text-[10px] backdrop-blur-md shadow-xl"
                  >
                    Clear Filter
                  </button>
                </div>
              </section>

              {error && (
                <div className="glass-card mb-8 p-6 border-red-500/50 bg-red-500/10 animate-fadeIn">
                  <p className="text-red-400 font-black text-sm uppercase tracking-widest">{error}</p>
                </div>
              )}

              {warning && (
                <div className="glass-card mb-8 p-6 border-amber-500/50 bg-amber-500/10 animate-fadeIn">
                  <p className="text-amber-400 font-black text-sm uppercase tracking-widest">{warning}</p>
                </div>
              )}

              {activeTab === 'search' && (
                <CutoffList 
                  cutoffs={filteredCutoffs} 
                  appliedFilters={appliedFilters} 
                  isLoading={loading || isSearching} 
                />
              )}
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
          </div>
        </main>
      </div>
    </div>
  );
}

export default App;
