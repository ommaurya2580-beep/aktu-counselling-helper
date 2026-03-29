import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';

/* ─── constants ─────────────────────────────────────────────────── */
const MAX_SELECTED = 3;
const DEBOUNCE_MS  = 300;

/* ─── scoring weights ───────────────────────────────────────────── */
const WEIGHTS = {
  avg_package:      0.35,
  placement:        0.25,
  highest_package:  0.20,
  ranking:          0.10, // lower closing_rank = better
  fees:            -0.10, // lower fees = better
};

/* ─── helpers ───────────────────────────────────────────────────── */
function normalize(val, min, max) {
  if (max === min) return 0.5;
  return (val - min) / (max - min);
}

function computeScores(selected, allColleges) {
  if (!selected.length || !allColleges.length) return selected;

  // Compute global min/max from FULL dataset so scores are always consistent
  const maxAvgPkg  = Math.max(...allColleges.map(c => c.avg_package));
  const minAvgPkg  = Math.min(...allColleges.map(c => c.avg_package));
  const maxHighPkg = Math.max(...allColleges.map(c => c.highest_package));
  const minHighPkg = Math.min(...allColleges.map(c => c.highest_package));
  const maxPlace   = Math.max(...allColleges.map(c => c.placement));
  const minPlace   = Math.min(...allColleges.map(c => c.placement));
  const maxRank    = Math.max(...allColleges.map(c => c.closing_rank));
  const minRank    = Math.min(...allColleges.map(c => c.closing_rank));
  const maxFees    = Math.max(...allColleges.map(c => c.fees_max));
  const minFees    = Math.min(...allColleges.map(c => c.fees_min));

  return selected.map(c => ({
    ...c,
    score: (
      normalize(c.avg_package,     minAvgPkg, maxAvgPkg)  * WEIGHTS.avg_package +
      normalize(c.placement,       minPlace,  maxPlace)   * WEIGHTS.placement +
      normalize(c.highest_package, minHighPkg, maxHighPkg) * WEIGHTS.highest_package +
      // lower rank is BETTER → invert: use (maxRank - rank) / range
      normalize(maxRank - c.closing_rank, 0, maxRank - minRank) * WEIGHTS.ranking +
      // lower fees is BETTER → invert
      normalize(maxFees - c.fees_min, 0, maxFees - minFees) * WEIGHTS.fees
    )
  }));
}

const RANK_LABELS = ['🥇 Best Choice', '🥈 Good Choice', '🥉 Average'];
const RANK_COLORS = ['#22c55e', '#f59e0b', '#94a3b8'];

/* ─── sub-components ────────────────────────────────────────────── */
function Chip({ college, onRemove }) {
  return (
    <div className="bg-white/5 backdrop-blur-xl border border-white/10 text-slate-300 px-5 py-2.5 rounded-2xl text-[11px] font-black flex items-center gap-4 animate-in fade-in zoom-in duration-300 group/chip transition-all hover:bg-white/10 hover:border-indigo-500/30">
      <span className="truncate max-w-[280px] uppercase tracking-wider font-outfit">{college.college}</span>
      <button
        className="w-5 h-5 rounded-full bg-white/5 group-hover/chip:bg-red-500/20 group-hover/chip:text-red-400 transition-all flex items-center justify-center text-base leading-none"
        onClick={() => onRemove(college.college)}
        title="Remove"
        aria-label={`Remove ${college.college}`}
      >×</button>
    </div>
  );
}

function StatRow({ label, values, highlight, index, formatter = v => v }) {
  const nums = values.map(v => (typeof v === 'number' ? v : NaN));
  const validNums = nums.filter(n => !isNaN(n) && n > 0);
  const best  = validNums.length ? Math.max(...validNums) : null;
  const worst = validNums.length ? Math.min(...validNums) : null;
  // For fees/rank: lower is better (highlight === 'low')
  const bestVal  = highlight === 'low' ? worst : best;
  const worstVal = highlight === 'low' ? best  : worst;

  return (
    <tr 
      className="hover:bg-white/[0.02] transition-colors group animate-slideUp"
      style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}
    >
      <td className="px-8 py-6 text-slate-500 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5 opacity-80 group-hover:text-slate-300 transition-colors font-outfit">
        {label}
      </td>
      {values.map((v, i) => {
        const isNum = typeof nums[i] === 'number' && !isNaN(nums[i]);
        const isBest  = isNum && validNums.length > 1 && nums[i] === bestVal;
        const isWorst = isNum && validNums.length > 1 && nums[i] === worstVal && bestVal !== worstVal;
        return (
          <td
            key={i}
            className={`px-8 py-6 text-center transition-all duration-500 font-outfit ${isBest ? 'text-emerald-400 font-black' : isWorst ? 'text-red-400 font-bold opacity-60' : 'text-slate-400 font-bold'}`}
          >
            {isBest && <span className="mr-2 text-[10px] animate-pulse">★</span>}
            {formatter(v)}
          </td>
        );
      })}
      {/* Pad empty columns if < 3 selected */}
      {Array.from({ length: MAX_SELECTED - values.length }).map((_, i) => (
        <td key={`empty-${i}`} className="px-8 py-6 text-center text-slate-800 font-black tracking-widest opacity-20 font-outfit">—</td>
      ))}
    </tr>
  );
}

function ComparisonCard({ college, rank, index }) {
  const borderColor = rank === 0 ? 'border-indigo-500/30' : rank === 1 ? 'border-purple-500/30' : 'border-white/10';
  const glowColor = rank === 0 ? 'bg-indigo-500/20' : rank === 1 ? 'bg-purple-500/20' : 'bg-slate-500/10';
  const bgBadge = college.type === 'Government' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20';

  return (
    <div 
      className={`backdrop-blur-3xl bg-white/5 border ${borderColor} p-8 rounded-[2.5rem] shadow-2xl relative overflow-hidden group transition-all duration-500 hover:-translate-y-2 hover:bg-white/[0.08] animate-slideUp`}
      style={{ animationDelay: `${index * 100}ms`, animationFillMode: 'both' }}
    >
      <div className={`absolute top-0 right-0 px-6 py-2 rounded-bl-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg flex items-center gap-2 font-outfit ${rank === 0 ? 'bg-indigo-600/80 backdrop-blur-md' : rank === 1 ? 'bg-purple-600/80 backdrop-blur-md' : 'bg-slate-700/80 backdrop-blur-md'}`}>
        <span>{rank === 0 ? '🏆' : rank === 1 ? '🥈' : '🥉'}</span>
        {RANK_LABELS[rank]}
      </div>
      
      <div className="mt-4">
        <div className="flex items-baseline gap-2 mb-3">
          <span className="text-5xl font-black text-white italic tracking-tighter font-outfit">
            {(college.score * 100).toFixed(1)}
          </span>
          <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-outfit">Quality Score</span>
        </div>
        
        <h3 className="text-xl font-black text-white mb-4 line-clamp-2 uppercase tracking-tight leading-7 font-outfit italic min-h-[3.5rem] group-hover:text-indigo-400 transition-colors">
          {college.college}
        </h3>
        
        <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-white/5">
          <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border font-outfit ${bgBadge}`}>
            {college.type}
          </span>
          <span className="px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white/5 text-slate-400 border border-white/10 font-outfit">
            📍 {college.location}
          </span>
        </div>
      </div>
      
      {/* Glow Effect */}
      <div className={`absolute -bottom-16 -right-16 w-48 h-48 blur-[100px] rounded-full opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none ${glowColor}`}></div>
    </div>
  );
}

/* ─── main component ─────────────────────────────────────────────── */
export default function CollegeComparison() {
  const [colleges, setColleges]         = useState([]);
  const [loading, setLoading]           = useState(true);
  const [error, setError]               = useState(null);
  const [searchQuery, setSearchQuery]   = useState('');
  const [debouncedQ, setDebouncedQ]     = useState('');
  const [selectedColleges, setSelected] = useState([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const searchRef                       = useRef(null);
  const timerRef                        = useRef(null);

  /* load data once */
  useEffect(() => {
    fetch('/colleges.min.json')
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(data => { setColleges(data); setLoading(false); })
      .catch(err => { setError(err.message); setLoading(false); });
  }, []);

  /* debounce search */
  useEffect(() => {
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setDebouncedQ(searchQuery.toLowerCase().trim()), DEBOUNCE_MS);
    return () => clearTimeout(timerRef.current);
  }, [searchQuery]);

  /* filtered dropdown list (useMemo — no re-render on every keystroke) */
  const filteredList = useMemo(() => {
    if (!debouncedQ || colleges.length === 0) return [];
    const selectedNames = new Set(selectedColleges.map(c => c.college));
    return colleges
      .filter(c => c.college_lower.includes(debouncedQ) && !selectedNames.has(c.college))
      .slice(0, 12);
  }, [debouncedQ, colleges, selectedColleges]);

  /* scored + ranked comparison (useMemo) */
  const rankedSelection = useMemo(() => {
    if (!selectedColleges.length || !colleges.length) return [];
    const scored = computeScores(selectedColleges, colleges);
    return [...scored].sort((a, b) => b.score - a.score);
  }, [selectedColleges, colleges]);

  /* handlers */
  const addCollege = useCallback(c => {
    if (selectedColleges.length >= MAX_SELECTED) return;
    setSelected(prev => [...prev, c]);
    setSearchQuery('');
    setDebouncedQ('');
    setDropdownOpen(false);
  }, [selectedColleges]);

  const removeCollege = useCallback(name => {
    setSelected(prev => prev.filter(c => c.college !== name));
  }, []);

  const clearAll = useCallback(() => setSelected([]), []);

  /* close dropdown on outside click */
  useEffect(() => {
    const handler = e => {
      if (searchRef.current && !searchRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  /* ── render ──────────────────────────────────────────────────── */
  if (loading) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center space-y-6">
      <div className="relative">
        <div className="w-16 h-16 border-4 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin"></div>
        <div className="absolute inset-0 bg-indigo-500/10 blur-xl animate-pulse"></div>
      </div>
      <p className="text-white font-black tracking-[0.3em] text-[10px] uppercase animate-pulse">Initializing Comparator</p>
    </div>
  );

  if (error) return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-6">
      <div className="w-20 h-20 bg-red-500/10 border border-red-500/20 rounded-3xl flex items-center justify-center text-4xl mb-4 animate-bounce">⚠️</div>
      <h3 className="text-3xl font-black text-white uppercase tracking-tighter italic">Analysis Error</h3>
      <p className="text-slate-400 font-bold uppercase tracking-widest text-xs max-w-md leading-relaxed">
        The biometric stream was interrupted: <span className="text-red-400">{error}</span>
      </p>
      <button 
        onClick={() => window.location.reload()}
        className="px-8 py-4 bg-white/5 border border-white/10 rounded-2xl text-[10px] font-black text-white uppercase tracking-[0.3em] hover:bg-white/10 transition-all active:scale-95"
      >
        Re-Initialize Matrix
      </button>
    </div>
  );

  const fmtL = v => v ? `${v.toLocaleString()} LPA` : '—';
  const fmtP = v => v ? `${v}%` : '—';

  return (
    <div className="min-h-screen bg-transparent text-slate-300 pb-20 pt-6 lg:pt-10 font-outfit">
      <div className="max-w-7xl mx-auto px-6">
        {/* ── Header ── */}
        <header className="text-left mb-16 relative">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/5 border border-white/10 text-indigo-400 text-[10px] font-black uppercase tracking-[0.2em] mb-6">
            <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse shadow-[0_0_10px_rgba(99,102,241,0.8)]"></span>
            Intelligence Mode Active
          </div>
          <h2 className="text-6xl md:text-8xl font-black text-white mb-6 tracking-tighter uppercase italic leading-none">
            College <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 via-purple-400 to-indigo-500">Comparator</span>
          </h2>
          <p className="text-slate-400 font-bold max-w-2xl text-sm md:text-base uppercase tracking-widest opacity-80 leading-relaxed">
            Side-by-side analytical benchmarking using the <span className="text-white">AKTU 2025 Deep-Score</span> engine algorithm.
          </p>
        </header>

        {/* Search & Selector Box */}
        <section className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-8 md:p-12 mb-16 shadow-2xl relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-600/10 blur-[120px] rounded-full -mr-48 -mt-48 transition-opacity duration-700 opacity-30 group-hover:opacity-60"></div>

          <div className="relative z-10" ref={searchRef}>
            <div className="flex flex-col lg:flex-row gap-8 items-end">
              <div className="flex-1 w-full space-y-4">
                <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] ml-2 opacity-60">
                  Admission Matrix Database
                </label>
                <div className="relative group/search">
                  <input
                    id="cc-search-input"
                    type="text"
                    className="w-full bg-white/5 border border-white/10 text-white px-10 py-7 rounded-[2rem] focus:ring-4 focus:ring-indigo-500/20 focus:border-indigo-500/40 outline-none transition-all placeholder:text-slate-700 font-black text-xl shadow-2xl tracking-tight disabled:opacity-50 disabled:cursor-not-allowed group-hover/search:border-white/20 font-outfit"
                    placeholder={
                      selectedColleges.length >= MAX_SELECTED
                        ? 'COLLEGE LIMIT REACHED (3/3)'
                        : 'ENTER COLLEGE NAME OR CODE...'
                    }
                    value={searchQuery}
                    disabled={selectedColleges.length >= MAX_SELECTED}
                    onChange={e => { setSearchQuery(e.target.value); setDropdownOpen(true); }}
                    onFocus={() => setDropdownOpen(true)}
                    autoComplete="off"
                  />
                  <div className="absolute right-10 top-1/2 -translate-y-1/2 flex items-center gap-4">
                    {selectedColleges.length < MAX_SELECTED && (
                      <div className="text-slate-700 text-2xl group-hover/search:scale-110 transition-transform">🔍</div>
                    )}
                  </div>
                </div>
              </div>

              {selectedColleges.length > 0 && (
                <button 
                  onClick={clearAll}
                  className="px-10 py-7 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/20 rounded-[2rem] text-[11px] font-black uppercase tracking-widest transition-all h-[84px] whitespace-nowrap active:scale-95 font-outfit shadow-lg shadow-red-500/5 group-hover:shadow-red-500/10"
                >
                  Reset Dashboard
                </button>
              )}
            </div>

            {/* Dropdown Results */}
            {dropdownOpen && (filteredList.length > 0 || (debouncedQ && filteredList.length === 0)) && (
              <div className="absolute z-50 w-full mt-6 bg-slate-900/95 border border-white/10 rounded-[2rem] shadow-[0_30px_60px_rgba(0,0,0,0.8)] overflow-hidden backdrop-blur-3xl animate-in fade-in slide-in-from-top-6 duration-500 border-t-indigo-500/30">
                <div className="max-h-[480px] overflow-y-auto custom-scrollbar">
                  {filteredList.length > 0 ? (
                    filteredList.map(c => (
                      <button
                        key={c.college}
                        onClick={() => addCollege(c)}
                        className="w-full text-left px-10 py-7 text-slate-400 hover:bg-white/5 hover:text-white transition-all border-b border-white/5 last:border-0 group/item flex items-center justify-between"
                      >
                        <div className="flex flex-col gap-1">
                          <span className="font-black uppercase tracking-tight text-lg group-hover/item:translate-x-2 transition-transform duration-300">{c.college}</span>
                          <div className="flex items-center gap-3">
                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{c.type}</span>
                            <span className="w-1 h-1 rounded-full bg-slate-800"></span>
                            <span className="text-[10px] font-bold text-slate-600 uppercase tracking-widest">{c.location}</span>
                          </div>
                        </div>
                        <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center opacity-0 group-hover/item:opacity-100 transition-all scale-75 group-hover/item:scale-100">
                          <span className="text-indigo-400 text-xl font-bold">+</span>
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="px-10 py-16 text-slate-600 text-sm font-black italic text-center uppercase tracking-[0.3em] opacity-50">
                       No signatures matching "{debouncedQ}"
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Selected Chips Grid */}
          <div className="mt-12 pt-12 border-t border-white/5 flex flex-wrap gap-4 items-center min-h-[70px]">
            {selectedColleges.length > 0 ? (
              <>
                {selectedColleges.map(c => (
                  <Chip key={c.college} college={c} onRemove={removeCollege} />
                ))}
                <div className="ml-auto flex items-center gap-4 px-8 py-4 bg-white/5 rounded-[1.5rem] border border-white/10">
                  <div className="flex gap-2">
                    {[1, 2, 3].map(i => (
                      <div key={i} className={`w-2.5 h-2.5 rounded-full transition-all duration-700 ${i <= selectedColleges.length ? 'bg-indigo-500 shadow-[0_0_15px_rgba(99,102,241,0.6)]' : 'bg-slate-800'}`}></div>
                    ))}
                  </div>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
                    {selectedColleges.length}/3 ENTRIES
                  </span>
                </div>
              </>
            ) : (
              <div className="w-full text-center py-6 text-slate-700 italic font-black uppercase tracking-[0.4em] text-[10px] opacity-40 animate-pulse">
                 Awaiting Data... Select comparison targets to initialize matrix
              </div>
            )}
          </div>
        </section>

        {/* ── Comparison Dashboard ── */}
        {rankedSelection.length >= 1 ? (
          <div className="space-y-24 animate-in fade-in slide-in-from-bottom-12 duration-1000">
            
            {/* Score Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {rankedSelection.map((c, i) => (
                <ComparisonCard key={c.college} college={c} rank={i} index={i} />
              ))}
              {Array.from({ length: MAX_SELECTED - rankedSelection.length }).map((_, i) => (
                <div key={i} className="border-2 border-dashed border-white/10 rounded-[2.5rem] p-10 flex flex-col items-center justify-center text-center opacity-30 group hover:opacity-100 hover:border-indigo-500/30 transition-all duration-700 bg-white/5">
                   <div className="w-20 h-20 bg-white/5 rounded-[2rem] border border-white/10 flex items-center justify-center mb-8 text-3xl group-hover:scale-110 group-hover:rotate-12 transition-all">⚖️</div>
                   <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] leading-relaxed group-hover:text-slate-300">
                     Comparison Slot Open<br/><span className="text-indigo-500/80">Awaiting Signal</span>
                   </p>
                </div>
              ))}
            </div>

            {/* Metric Comparison Table */}
            <div className="rounded-[2.5rem] border border-white/10 bg-white/5 backdrop-blur-3xl shadow-2xl overflow-hidden group/table">
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full border-collapse min-w-[1000px]">
                  <thead>
                    <tr className="bg-white/5 border-b border-white/10">
                      <th className="px-12 py-12 text-left w-[320px] relative border-r border-white/5">
                         <div className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-2">VECTOR INDEX</div>
                         <div className="text-white font-black text-2xl tracking-tighter uppercase italic leading-none">Metric Matrix</div>
                      </th>
                      {rankedSelection.map((c, i) => (
                        <th key={c.college} className="px-12 py-12 text-center relative max-w-[280px]">
                           <div className="text-[9px] text-slate-500 font-extrabold uppercase mb-3 tracking-[0.3em] opacity-60">Sequence #0{i+1}</div>
                           <div className="text-white text-base font-black uppercase tracking-tight line-clamp-2 italic leading-tight font-outfit">{c.college.split(',')[0]}</div>
                        </th>
                      ))}
                      {Array.from({ length: MAX_SELECTED - rankedSelection.length }).map((_, i) => (
                        <th key={`ph-${i}`} className="px-12 py-12 text-center text-slate-700 font-black italic tracking-widest opacity-20 uppercase text-xs">— VACANT —</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    <StatRow index={0} label="Quality Score" values={rankedSelection.map(c => (c.score * 100).toFixed(1))} formatter={v => <span className="text-xl font-black italic">{v}</span>} />
                    <StatRow index={1} label="Highest Package" values={rankedSelection.map(c => c.highest_package)} highlight="high" formatter={fmtL} />
                    <StatRow index={2} label="Average Package" values={rankedSelection.map(c => c.avg_package)} highlight="high" formatter={fmtL} />
                    <StatRow index={3} label="Placement Rate" values={rankedSelection.map(c => c.placement)} highlight="high" formatter={fmtP} />
                    <StatRow index={4} label="2024 Cutoff Rank" highlight="low" values={rankedSelection.map(c => c.closing_rank)} formatter={v => v.toLocaleString()} />
                    <StatRow index={5} label="Min Tuition" highlight="low" values={rankedSelection.map(c => c.fees_min)} formatter={v => v ? `₹${v.toLocaleString()}` : '—'} />
                    <StatRow index={6} label="Max Tuition" highlight="low" values={rankedSelection.map(c => c.fees_max)} formatter={v => v ? `₹${v.toLocaleString()}` : '—'} />
                    <StatRow index={7} label="Total Est. Cost" values={rankedSelection.map(c => c.total_fees)} highlight="low" formatter={v => v ? `₹${v.toLocaleString()}` : '—'} />
                    <StatRow index={8} label="Opening Entry Rank" values={rankedSelection.map(c => c.opening_rank)} highlight="low" formatter={v => v ? `~${v.toLocaleString()}` : '—'} />
                    <StatRow index={9} label="Closing Entry Rank" values={rankedSelection.map(c => c.closing_rank)} highlight="low" formatter={v => v ? `~${v.toLocaleString()}` : '—'} />
                    <StatRow index={10} label="NAAC Rating" values={rankedSelection.map(c => c.naac)} highlight="none" />
                    <StatRow index={11} label="NBA Status" values={rankedSelection.map(c => c.nba)} highlight="none" />
                    
                    {/* Recruiters Custom Row */}
                    <tr className="hover:bg-white/[0.02] transition-colors group">
                      <td className="px-12 py-12 text-slate-500 text-[11px] font-black uppercase tracking-[0.2em] border-r border-white/5 opacity-80 group-hover:text-slate-300 transition-colors">
                        Top Recruiters
                      </td>
                      {rankedSelection.map(c => (
                        <td key={c.college} className="px-12 py-12">
                          <div className="flex flex-wrap justify-center gap-2 max-w-[240px] mx-auto">
                            {(c.companies || []).slice(0, 4).map(co => (
                              <span key={co} className="px-4 py-2 bg-indigo-500/5 border border-indigo-500/20 rounded-xl text-[10px] font-black text-indigo-300 uppercase tracking-widest whitespace-nowrap group-hover:bg-indigo-500/10 transition-all">
                                {co}
                              </span>
                            ))}
                            {(c.companies || []).length > 4 && (
                              <span className="px-4 py-2 bg-slate-900 text-slate-500 rounded-xl text-[10px] font-black uppercase tracking-widest border border-white/5">
                                +{(c.companies || []).length - 4} MORE
                              </span>
                            )}
                          </div>
                        </td>
                      ))}
                      {Array.from({ length: MAX_SELECTED - rankedSelection.length }).map((_, i) => (
                        <td key={`ec-${i}`} className="px-12 py-12 text-center text-slate-800 font-black tracking-widest opacity-20 uppercase text-[10px]">—</td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Scoring Documentation */}
            <section className="bg-white/5 backdrop-blur-3xl border border-white/10 rounded-[2.5rem] p-12 lg:p-20 relative overflow-hidden group/algo shadow-3xl">
              <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-indigo-600/5 blur-[150px] rounded-full -mr-250 -mt-250"></div>
              
              <div className="flex flex-col lg:flex-row gap-20 items-start">
                <div className="flex-1 space-y-10">
                  <header>
                    <div className="text-indigo-500 text-[10px] font-black uppercase tracking-[0.4em] mb-4">ALGORITHM DOCUMENTATION</div>
                    <h4 className="flex items-center gap-6 text-white font-black uppercase text-4xl tracking-tighter italic leading-none">
                      AI Benchmarking <span className="text-indigo-500">Logic</span>
                    </h4>
                    <div className="h-1.5 w-32 bg-indigo-600 rounded-full mt-6 shadow-[0_0_20px_rgba(99,102,241,0.5)]"></div>
                  </header>

                  <p className="text-slate-400 text-lg font-medium leading-relaxed uppercase tracking-tight opacity-90 max-w-2xl">
                    Our proprietary ranking matrix processes the full AKTU dataset of <span className="text-white font-black">{colleges.length} institutions</span> to ensure objective, normalized scoring across performance vectors.
                  </p>
                  
                  <div className="grid grid-cols-2 lg:grid-cols-3 gap-6 pt-6">
                    {Object.entries(WEIGHTS).map(([key, weight]) => (
                      <div key={key} className="bg-slate-900/60 border border-white/10 p-8 rounded-[2rem] group/w transition-all hover:border-indigo-500/30 hover:bg-slate-900">
                        <div className="text-indigo-400 font-black text-4xl mb-2 italic tracking-tighter group-hover:scale-105 transition-transform">
                          {Math.abs(weight * 100)}%
                        </div>
                        <div className="text-slate-500 font-black uppercase text-[10px] tracking-[0.2em] group-hover/w:text-slate-300 transition-colors">
                          {key.replace('_', ' ')}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                <div className="w-full lg:w-[400px] bg-slate-900/40 rounded-[3.5rem] border border-white/5 p-12 flex flex-col items-center justify-center text-center relative overflow-hidden shadow-2xl shrink-0">
                   <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 via-transparent to-purple-500/5 animate-pulse"></div>
                   <div className="text-7xl mb-10 relative z-10 animate-bounce transition-all duration-1000">🤖</div>
                   <div className="text-[11px] font-black text-slate-500 uppercase tracking-[0.4em] mb-8 relative z-10 leading-loose">
                     Weights are calculated using normalized <span className="text-white">Min-Max Scalars</span> against the 2025 live dataset streams.
                   </div>
                   <div className="px-8 py-3 bg-indigo-600 rounded-2xl text-[10px] font-black text-white uppercase tracking-widest shadow-xl shadow-indigo-600/20 relative z-10">
                     SYSTEM CALIBRATED
                   </div>
                </div>
              </div>
            </section>

          </div>
        ) : (
          <div className="text-center py-56 bg-slate-900/10 rounded-[5rem] border-4 border-dashed border-white/5 mb-20 group hover:border-indigo-500/20 transition-all duration-1000 relative overflow-hidden">
             <div className="absolute inset-0 bg-indigo-500/1 blur-3xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity"></div>
             <div className="w-32 h-32 bg-slate-900/50 border border-white/5 rounded-[2.5rem] flex items-center justify-center mx-auto mb-10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-700 relative z-10">
                <span className="text-7xl relative z-10">⚖️</span>
             </div>
             <h3 className="text-4xl font-black text-slate-700 uppercase tracking-[0.2em] mb-6 group-hover:text-slate-400 transition-colors relative z-10">Comparator Standby</h3>
             <p className="text-slate-800 font-bold max-w-sm mx-auto uppercase tracking-widest text-[11px] leading-loose group-hover:text-slate-600 transition-colors relative z-10 px-6">
                Interface is dormant. Add institutional entities to activate the high-performance scoring matrix.
             </p>
          </div>
        )}
      </div>
    </div>
  );
}
