import React, { useState } from 'react';
import Select from 'react-select';
import { predictColleges } from '../utils/predictor.js';
import Skeleton from './Skeleton.jsx';

const customStyles = {
  control: (base, state) => ({
    ...base,
    background: "rgba(2, 6, 23, 0.5)",
    backdropFilter: "blur(40px)",
    borderColor: state.isFocused ? "rgba(99, 102, 241, 0.4)" : "rgba(255, 255, 255, 0.05)",
    borderRadius: "1rem",
    padding: "6px",
    color: "white",
    boxShadow: state.isFocused ? "0 0 20px rgba(99, 102, 241, 0.1)" : "none",
    "&:hover": { borderColor: "rgba(255, 255, 255, 0.1)" },
    cursor: "pointer",
  }),
  menu: (base) => ({
    ...base,
    background: "rgba(15, 23, 42, 0.95)",
    backdropFilter: "blur(20px)",
    borderRadius: "1rem",
    border: "1px border rgba(255, 255, 255, 0.05)",
    overflow: "hidden",
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
  }),
  option: (base, state) => ({
    ...base,
    background: state.isSelected ? "rgba(99, 102, 241, 0.4)" : state.isFocused ? "rgba(255, 255, 255, 0.05)" : "transparent",
    color: "white",
    padding: "12px 20px",
    fontSize: "0.75rem",
    fontWeight: "800",
    cursor: "pointer",
    transition: "all 0.2s ease"
  }),
  input: (base) => ({ ...base, color: "white" }),
  singleValue: (base) => ({ ...base, color: "white", fontWeight: "800", fontSize: "0.875rem" }),
  placeholder: (base) => ({ ...base, color: "rgba(71, 85, 105, 1)", fontSize: "0.875rem", fontWeight: "800" }),
  menuPortal: (base) => ({ ...base, zIndex: 9999 }),
};

const RankPredictor = ({ uniqueCategories, uniqueQuotas, uniquePrograms }) => {
  const [filters, setFilters] = useState({ rank: '', category: '', quota: '', branch: '', round: '1' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState({ high: [], medium: [], low: [] });

  const handleFilterChange = (e) => {
    if (e.target) {
      const { name, value } = e.target;
      setFilters(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSelectChange = (selected, name) => {
    setFilters(prev => ({ ...prev, [name]: selected?.value || '' }));
  };

  const handlePredict = async () => {
    if (!filters.rank || !filters.category || !filters.quota || !filters.branch || !filters.round) {
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
    setResults({ high: [], medium: [], low: [] });

    try {
      const allResults = await predictColleges(
        userRank,
        filters.category,
        filters.quota,
        filters.branch,
        filters.round
      );
      
      const grouped = {
        high: allResults.filter(r => r.chance === 'HIGH'),
        medium: allResults.filter(r => r.chance === 'MEDIUM'),
        low: allResults.filter(r => r.chance === 'LOW'),
        isRelaxed: allResults.some(r => r.isRelaxed)
      };
      
      setResults(grouped);
      
      if (allResults.length === 0) {
        setError('No colleges found for your rank and preferences.');
      }
    } catch (err) {
      console.error('Prediction error:', err);
      setError('Failed to process predictions. Check console for details.');
    } finally {
      setLoading(false);
    }
  };

  const CollegeCard = ({ college, chanceType }) => {
    let chanceColor = 'text-slate-400';
    let chanceBg = 'bg-slate-500/10';
    let chanceBorder = 'border-slate-500/20';
    let chanceGlow = 'shadow-slate-500/5';

    if (chanceType === 'HIGH') {
      chanceColor = 'text-emerald-400';
      chanceBg = 'bg-emerald-500/10';
      chanceBorder = 'border-emerald-500/20';
      chanceGlow = 'shadow-emerald-500/10';
    } else if (chanceType === 'MEDIUM') {
      chanceColor = 'text-amber-400';
      chanceBg = 'bg-amber-500/10';
      chanceBorder = 'border-amber-500/20';
      chanceGlow = 'shadow-amber-500/10';
    } else if (chanceType === 'LOW') {
      chanceColor = 'text-rose-400';
      chanceBg = 'bg-rose-500/10';
      chanceBorder = 'border-rose-500/20';
      chanceGlow = 'shadow-rose-500/10';
    }

    return (
      <div 
        className={`group bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 hover:bg-white/[0.08] hover:border-white/20 transition-all duration-500 shadow-xl ${chanceGlow} hover:-translate-y-1 font-outfit relative overflow-hidden animate-slideUp`}
        style={{ animationDelay: `${college.index * 50}ms` }}
      >
        {/* Subtle decorative glow */}
        <div className={`absolute -top-12 -right-12 w-32 h-32 blur-3xl rounded-full opacity-10 transition-opacity group-hover:opacity-20 ${chanceType === 'HIGH' ? 'bg-emerald-500' : chanceType === 'MEDIUM' ? 'bg-amber-500' : 'bg-rose-500'}`}></div>

        <div className="flex justify-between items-start mb-6">
          <span className={`px-4 py-1.5 rounded-xl text-[10px] font-black tracking-[0.15em] uppercase border ${chanceBg} ${chanceColor} ${chanceBorder}`}>
            {chanceType} CHANCE
          </span>
          <div className="flex flex-col items-end">
             <span className="text-slate-500 text-[9px] font-black uppercase tracking-widest opacity-50">Round</span>
             <span className="text-white text-xs font-black italic">#{college.round}</span>
          </div>
        </div>
        
        <h4 className="text-white font-black text-xl leading-snug mb-3 line-clamp-2 min-h-[3.5rem] group-hover:text-indigo-300 transition-colors">
          {college.college_name}
        </h4>
        
        <div className="flex items-center gap-3 mb-8">
          <div className={`w-2 h-2 rounded-full ${chanceType === 'HIGH' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.4)]' : chanceType === 'MEDIUM' ? 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.4)]' : 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.4)]'}`}></div>
          <p className="text-slate-400 text-xs font-bold uppercase tracking-wide line-clamp-1 opacity-80">{college.branch}</p>
        </div>

        <div className="grid grid-cols-2 gap-8 pt-6 border-t border-white/5">
          <div className="flex flex-col">
            <span className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em] mb-1.5 leading-none">Closing Rank</span>
            <span className="text-white font-black text-2xl tabular-nums italic">
              {Number(college.closing_rank).toLocaleString()}
            </span>
          </div>
          <div className="flex flex-col items-end text-right">
            <span className="text-[9px] text-slate-600 font-black uppercase tracking-[0.2em] mb-1.5 leading-none">Rank Gap</span>
            <span className={`font-black text-xl tabular-nums italic ${college.proximity >= 0 ? 'text-indigo-400' : 'text-rose-400'}`}>
              {college.proximity > 0 ? `+${college.proximity.toLocaleString()}` : college.proximity.toLocaleString()}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const Section = ({ title, colleges, chanceType, emptyMsg }) => {
    if (colleges.length === 0 && !emptyMsg) return null;
    return (
      <div className="mb-16 animate-in fade-in slide-in-from-bottom-4 duration-700">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
          <div className="flex items-center gap-4">
            <div className={`w-3 h-3 rounded-full ${chanceType === 'HIGH' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.3)]' : chanceType === 'MEDIUM' ? 'bg-amber-500 shadow-[0_0_10px_rgba(245,158,11,0.3)]' : 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.3)]'}`}></div>
            <h3 className="text-white font-black text-sm tracking-[0.25em] uppercase font-outfit">{title}</h3>
          </div>
          <span className="bg-white/5 px-4 py-1.5 rounded-full text-[10px] font-black text-slate-500 border border-white/10 uppercase tracking-widest">
            {colleges.length} matches
          </span>
        </div>
        
        {colleges.length === 0 ? (
          <div className="py-16 px-8 rounded-[2.5rem] border border-dashed border-white/5 bg-white/[0.01] text-center font-outfit">
             <p className="text-slate-600 text-sm font-black uppercase tracking-[0.2em] italic opacity-40">{emptyMsg}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {colleges.map((col, i) => <CollegeCard key={i} college={{...col, index: i}} chanceType={chanceType} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full animate-fadeIn font-outfit overflow-hidden">
      {/* Hero Header - Fixed at top of component */}
      <div className="relative pb-6 flex-none">
        <div className="absolute -top-20 -left-20 w-64 h-64 bg-indigo-600/10 blur-[100px] rounded-full"></div>
        <h1 className="text-4xl md:text-6xl font-black text-white tracking-tighter mb-4 leading-tight">
          Rank <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-blue-400 italic">Predictor</span>
        </h1>
        <p className="text-slate-400 font-medium max-w-2xl text-lg leading-relaxed border-l-2 border-indigo-500/30 pl-6">
          Advanced prediction engine utilizing 2025 multi-round cutoff distribution. Discover your probabilistic target colleges in real-time.
        </p>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-10 overflow-hidden min-h-0">
        {/* Left Column: Filters */}
        <div className="w-full lg:w-[320px] lg:flex-none h-full overflow-y-auto pr-2 custom-scrollbar">
          <div className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-indigo-500/5 blur-[80px] rounded-full -mr-20 -mt-20 group-hover:bg-indigo-500/10 transition-colors duration-700"></div>
            
            <div className="relative z-10 space-y-8">
              <div className="flex items-center gap-4 mb-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-600/20 flex items-center justify-center border border-white/10 shadow-lg">
                  <svg className="w-6 h-6 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
                <h2 className="text-white font-black text-2xl tracking-tight">Search Params</h2>
              </div>

              <div className="space-y-6">
                <div className="group/input">
                  <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.25em] mb-3 ml-2 group-focus-within/input:text-indigo-400 transition-colors">JEE Mains Rank</label>
                  <div className="relative">
                    <input 
                      type="number" 
                      name="rank" 
                      value={filters.rank} 
                      onChange={handleFilterChange}
                      placeholder="e.g. 45000"
                      className="w-full bg-slate-950/50 border border-white/5 rounded-2xl p-4 pl-4 text-white font-black placeholder:text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 transition-all shadow-inner"
                    />
                  </div>
                </div>

                <div className="group/input">
                  <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.25em] mb-3 ml-2 group-focus-within/input:text-indigo-400 transition-colors">Category</label>
                  <Select
                    options={uniqueCategories?.map(c => ({ value: c, label: c }))}
                    value={filters.category ? { value: filters.category, label: filters.category } : null}
                    onChange={(selected) => handleSelectChange(selected, 'category')}
                    styles={customStyles}
                    menuPortalTarget={document.body}
                    placeholder="Select Category"
                  />
                </div>

                <div className="group/input">
                  <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.25em] mb-3 ml-2 group-focus-within/input:text-indigo-400 transition-colors">Quota</label>
                  <Select
                    options={uniqueQuotas?.map(q => ({ value: q, label: q }))}
                    value={filters.quota ? { value: filters.quota, label: filters.quota } : null}
                    onChange={(selected) => handleSelectChange(selected, 'quota')}
                    styles={customStyles}
                    menuPortalTarget={document.body}
                    placeholder="Select Quota"
                  />
                </div>

                <div className="group/input">
                  <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.25em] mb-3 ml-2 group-focus-within/input:text-indigo-400 transition-colors">Preferred Branch</label>
                  <Select
                    options={uniquePrograms?.map(p => ({ value: p, label: p }))}
                    value={filters.branch ? { value: filters.branch, label: filters.branch } : null}
                    onChange={(selected) => handleSelectChange(selected, 'branch')}
                    styles={customStyles}
                    menuPortalTarget={document.body}
                    placeholder="Select Branch"
                  />
                </div>

                <div className="group/input">
                  <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.25em] mb-3 ml-2 group-focus-within/input:text-indigo-400 transition-colors">Counselling Round</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[1, 2, 3, 4, 6, 7].map(r => (
                      <button
                        key={r}
                        onClick={() => setFilters(prev => ({ ...prev, round: String(r) }))}
                        className={`py-3 rounded-xl text-[11px] font-black transition-all border ${filters.round === String(r) ? 'bg-indigo-500 border-indigo-400 text-white shadow-lg shadow-indigo-600/20 scale-105' : 'bg-slate-950/50 border-white/5 text-slate-500 hover:border-white/10 hover:text-white'}`}
                      >
                        R{r}
                      </button>
                    ))}
                  </div>
                </div>

                <button 
                  onClick={handlePredict} 
                  disabled={loading}
                  className="group relative w-full h-16 rounded-2xl overflow-hidden shadow-2xl transition-all active:scale-[0.98] disabled:opacity-50 mt-4 shadow-indigo-600/10"
                >
                  <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 via-blue-600 to-indigo-600 group-hover:scale-110 transition-transform duration-500 bg-[length:200%_100%] group-hover:bg-[100%_0%]"></div>
                  <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
                  <span className="relative z-10 text-white font-black text-xs uppercase tracking-[0.3em] flex items-center justify-center gap-4">
                    Predict 🚀
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Prediction Results */}
        <div className="flex-1 h-full overflow-y-auto px-2 custom-scrollbar">
           {loading ? (
             <div className="space-y-12">
               {[1, 2].map((section) => (
                 <div key={section} className="space-y-8">
                    <div className="flex items-center gap-4">
                      <Skeleton className="w-4 h-4 rounded-full" />
                      <Skeleton className="w-48 h-6 rounded-lg" />
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {[1, 2, 3, 4].map((i) => (
                        <div key={i} className="bg-white/5 border border-white/10 rounded-[2.5rem] p-8 space-y-6">
                          <div className="flex justify-between items-center">
                            <Skeleton className="w-24 h-6 rounded-xl" />
                            <Skeleton className="w-12 h-4 rounded-lg" />
                          </div>
                          <Skeleton className="w-full h-12 rounded-xl" />
                          <div className="flex items-center gap-3">
                            <Skeleton className="w-3 h-3 rounded-full" />
                            <Skeleton className="w-32 h-4 rounded-lg" />
                          </div>
                          <div className="pt-6 border-t border-white/5 grid grid-cols-2 gap-8">
                            <div className="space-y-2">
                              <Skeleton className="w-16 h-3 rounded-lg" />
                              <Skeleton className="w-24 h-8 rounded-lg" />
                            </div>
                            <div className="space-y-2 flex flex-col items-end">
                              <Skeleton className="w-16 h-3 rounded-lg" />
                              <Skeleton className="w-20 h-7 rounded-lg" />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                 </div>
               ))}
             </div>
           ) : error ? (
              <div className="p-12 bg-rose-500/5 border border-rose-500/10 rounded-[3rem] text-center animate-in zoom-in duration-500 shadow-2xl backdrop-blur-xl">
                 <div className="w-16 h-16 bg-rose-500/10 rounded-2xl flex items-center justify-center mx-auto mb-8 border border-rose-500/20 text-rose-500 text-3xl font-black shadow-inner">!</div>
                 <h3 className="text-white font-black text-2xl uppercase tracking-tighter mb-4">Oops! No Matches</h3>
                 <p className="text-slate-400 font-medium tracking-tight max-w-sm mx-auto leading-relaxed">{error}</p>
                 <button 
                  onClick={() => setFilters({ ...filters, rank: '' })}
                  className="mt-8 px-8 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:text-white transition-all"
                 >Reset Filters</button>
              </div>
           ) : results.high.length > 0 || results.medium.length > 0 || results.low.length > 0 ? (
                <div className="space-y-4">
                  {results.isRelaxed && (
                    <div className="flex items-center gap-4 px-6 py-4 bg-indigo-500/10 border border-indigo-500/20 rounded-[1.5rem] mb-10 backdrop-blur-sm animate-in fade-in slide-in-from-top-4 duration-500">
                      <div className="w-2.5 h-2.5 rounded-full bg-indigo-400 animate-pulse shadow-[0_0_10px_rgba(129,140,248,0.5)]"></div>
                      <span className="text-[11px] text-indigo-300 font-black uppercase tracking-[0.2em]">Heuristic Expansion: <span className="text-indigo-400/60 font-medium">Search range expanded to optimize results visibility.</span></span>
                    </div>
                  )}
                  <Section title="✅ Safety Targets" colleges={results.high} chanceType="HIGH" />
                  <Section title="⚖️ Probable Targets" colleges={results.medium} chanceType="MEDIUM" />
                  <Section title="🧗 Ambitious Reach" colleges={results.low} chanceType="LOW" />
                </div>
           ) : (
             <div className="h-full flex flex-col items-center justify-center p-16 border-2 border-dashed border-white/5 rounded-[4rem] text-slate-600 transition-colors hover:border-white/10 group">
               <div className="w-24 h-24 mb-10 flex items-center justify-center rounded-[2rem] bg-white/[0.02] border border-white/5 shadow-inner group-hover:scale-110 transition-transform duration-500">
                <svg className="w-12 h-12 opacity-20 group-hover:opacity-40 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                </svg>
               </div>
               <p className="text-2xl font-black text-white/20 tracking-tighter uppercase mb-4">Prediction Engine Idle</p>
               <p className="text-sm font-black uppercase tracking-[0.3em] opacity-40 text-center max-w-xs leading-relaxed">Enter your JEE credentials to initialize target mapping.</p>
               <div className="mt-10 flex gap-4">
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/20"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/40"></div>
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500/20"></div>
               </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default RankPredictor;
