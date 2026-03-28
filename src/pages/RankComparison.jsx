import React, { useState, useMemo, useEffect } from 'react';
import { 
  loadComparisonData, 
  compareFast, 
  compareBranches, 
  findWinner,
  normalize
} from '../utils/comparisonLoader.js';

const RankComparison = () => {
  const [selectedColleges, setSelectedColleges] = useState([]);
  const [selectedRound, setSelectedRound] = useState('Round 1');
  const [filters, setFilters] = useState({
    category: 'OPEN',
    quota: 'Home State',
    gender: 'Both Male and Female Seats'
  });
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterOptions, setFilterOptions] = useState({
    institutes: [],
    categories: [],
    quotas: [],
    genders: [],
    rounds: ['Round 1', 'Round 2', 'Round 3', 'Round 4']
  });
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch filter options once on mount
  useEffect(() => {
    fetch('/data/filterOptions.json')
      .then(res => res.json())
      .then(data => setFilterOptions(data))
      .catch(err => console.error('Error loading filter options:', err));
  }, []);

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

  // Use central normalize utility for robust matching
  const normalizeForSearch = (str) => normalize(str);

  const filteredCollegesList = useMemo(() => {
    if (!searchQuery) return [];
    
    const normalizedQuery = normalizeForSearch(searchQuery);
    
    return filterOptions.institutes.filter(inst => {
      const normalizedInst = normalizeForSearch(inst);
      // Try exact includes on raw string OR normalized matching for abbreviations like "G.L. Bajaj" vs "gl bajaj"
      const isMatch = inst.toLowerCase().includes(searchQuery.toLowerCase()) || 
                     normalizedInst.includes(normalizedQuery);
                     
      return isMatch && !selectedColleges.includes(inst);
    }).slice(0, 10);
  }, [searchQuery, selectedColleges]);

  const handleSelectCollege = (college) => {
    if (selectedColleges.length < 3) {
      setSelectedColleges([...selectedColleges, college]);
      setSearchQuery('');
      setShowDropdown(false);
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
    <div className="min-h-screen bg-[#020617] text-slate-300 font-['Outfit'] pb-20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <header className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-black text-white mb-4 tracking-tight">
            Rank <span className="text-blue-500">Comparison</span>
          </h2>
          <p className="text-slate-400 font-medium max-w-2xl mx-auto">
            Select up to 3 colleges to compare their branch-wise cutoffs for the 2025 counselling session.
          </p>
        </header>

        {/* Filters & Selector Box */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-8 mb-12 shadow-2xl">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {/* Round Select */}
            <div>
              <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">
                Counselling Round
              </label>
              <select
                className="w-full bg-slate-950/50 border border-white/10 text-white px-5 py-3.5 rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-bold cursor-pointer appearance-none"
                value={selectedRound}
                onChange={(e) => setSelectedRound(e.target.value)}
              >
                {filterOptions.rounds.map(r => <option key={r} value={r} className="bg-slate-900">{r}</option>)}
              </select>
            </div>

            {/* Category Select */}
            <div>
              <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">
                Category
              </label>
              <select
                className="w-full bg-slate-950/50 border border-white/10 text-white px-5 py-3.5 rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-bold cursor-pointer appearance-none"
                value={filters.category}
                onChange={(e) => setFilters({...filters, category: e.target.value})}
              >
                {filterOptions.categories.map(c => <option key={c} value={c} className="bg-slate-900">{c}</option>)}
              </select>
            </div>

            {/* Quota Select */}
            <div>
              <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">
                Quota
              </label>
              <select
                className="w-full bg-slate-950/50 border border-white/10 text-white px-5 py-3.5 rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-bold cursor-pointer appearance-none"
                value={filters.quota}
                onChange={(e) => setFilters({...filters, quota: e.target.value})}
              >
                {filterOptions.quotas.map(q => <option key={q} value={q} className="bg-slate-900">{q}</option>)}
              </select>
            </div>

            {/* Gender Select */}
            <div>
              <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-2 ml-1">
                Gender
              </label>
              <select
                className="w-full bg-slate-950/50 border border-white/10 text-white px-5 py-3.5 rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all font-bold cursor-pointer appearance-none"
                value={filters.gender}
                onChange={(e) => setFilters({...filters, gender: e.target.value})}
              >
                {filterOptions.genders.map(g => <option key={g} value={g} className="bg-slate-900">{g}</option>)}
              </select>
            </div>
          </div>

          {/* College Selector */}
          <div className="relative pt-6 border-t border-white/5">
            <label className="block text-slate-500 text-[10px] font-black uppercase tracking-widest mb-3 ml-1">
              Add Colleges to Compare ({selectedColleges.length}/3)
            </label>
            
            <div className="flex flex-wrap gap-2 mb-4 min-h-[42px]">
              {selectedColleges.map(c => (
                <div key={c} className="bg-blue-600/20 border border-blue-500/30 text-blue-400 px-4 py-2 rounded-xl text-xs font-black flex items-center gap-3 animate-in fade-in zoom-in duration-300">
                  <span className="truncate max-w-[250px]">{c.split(',')[0]}</span>
                  <button onClick={() => handleRemoveCollege(c)} className="w-5 h-5 rounded-full hover:bg-red-500/20 hover:text-red-400 transition-colors flex items-center justify-center text-lg leading-none">×</button>
                </div>
              ))}
              {selectedColleges.length === 0 && <span className="text-slate-600 text-xs italic mt-2 ml-1">Search and select at least one college...</span>}
            </div>

            {selectedColleges.length < 3 && (
              <div className="relative">
                <input
                  type="text"
                  className="w-full bg-slate-950/50 border border-white/10 text-white px-6 py-4 rounded-2xl focus:ring-2 focus:ring-blue-500/50 outline-none transition-all placeholder:text-slate-700 font-bold"
                  placeholder="Search for a college (e.g. IET Lucknow)..."
                  value={searchQuery}
                  onChange={(e) => { setSearchQuery(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                />
                
                {showDropdown && searchQuery && (
                  <div className="absolute z-50 w-full mt-2 bg-slate-900 border border-white/10 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-2xl animate-in slide-in-from-top-2 duration-200 overflow-y-auto max-h-60">
                    {filteredCollegesList.length > 0 ? filteredCollegesList.map(inst => (
                      <button
                        key={inst}
                        onClick={() => handleSelectCollege(inst)}
                        className="w-full text-left px-6 py-4 text-slate-400 hover:bg-blue-600 hover:text-white transition-all font-bold text-sm border-b border-white/5 last:border-0"
                      >
                        {inst}
                      </button>
                    )) : (
                      <div className="px-6 py-4 text-slate-600 text-sm font-bold italic">No matching colleges found</div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Comparison Table Section */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-4">
            <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-blue-500 font-black tracking-widest text-xs uppercase animate-pulse">Computing Data...</p>
          </div>
        ) : selectedColleges.length > 0 ? (
          <div className="overflow-x-auto rounded-[3rem] border border-white/5 shadow-2xl bg-slate-900/20 backdrop-blur-sm">
            <table className="w-full border-collapse min-w-[900px]">
              <thead>
                <tr className="bg-white/5">
                  <th className="px-10 py-8 text-left text-slate-500 text-[10px] font-black uppercase tracking-widest border-b border-white/5">Branch / Specialization</th>
                  {selectedColleges.map((name, i) => (
                    <th key={name} className="px-10 py-8 text-center border-b border-white/5">
                      <div className="text-[10px] text-blue-500 font-black uppercase mb-1 tracking-tighter opacity-50 italic">Option 0{i+1}</div>
                      <div className="text-white text-sm font-black truncate max-w-[200px] mx-auto" title={name}>
                        {name.split(',')[0]}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {comparisonResults.length > 0 ? comparisonResults.map((row) => (
                  <tr key={row.branch} className="hover:bg-white/[0.02] transition-all group">
                    <td className="px-10 py-8">
                      <div className="text-white font-black text-sm tracking-tight group-hover:text-blue-400 transition-colors uppercase leading-tight max-w-[200px]">
                        {row.branch}
                      </div>
                    </td>
                    {row.colleges.map((col, i) => (
                      <td key={i} className="px-10 py-8 text-center">
                        {col.exists ? (
                          <div className={`p-5 rounded-[1.5rem] transition-all duration-700 ${row.winner === col.name ? 'bg-emerald-500/10 border border-emerald-500/20 ring-1 ring-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.05)]' : 'bg-slate-950/30 border border-white/5'}`}>
                            {row.winner === col.name && (
                              <div className="flex items-center justify-center gap-1.5 mb-3">
                                <span className="text-emerald-500 text-[10px]">★</span>
                                <span className="text-[9px] font-black text-emerald-500 uppercase tracking-widest italic">Winner Choice</span>
                              </div>
                            )}
                            
                            {col.isFallback && (
                              <div className="text-[8px] text-orange-400 font-black uppercase mb-1 tracking-widest opacity-80 italic flex items-center justify-center gap-1">
                                <span className="w-1 h-1 rounded-full bg-orange-400 animate-pulse"></span>
                                Fallback to Open
                              </div>
                            )}
                            
                            <div className="text-[8px] text-slate-500 font-black uppercase mb-3 tracking-widest opacity-40">
                              {col.category}
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                              <div className="text-left">
                                <div className="text-[8px] text-slate-600 font-black uppercase tracking-tighter mb-1 opacity-60">Opening</div>
                                <div className="text-white text-sm font-black italic">
                                  {isNaN(Number(col.opening_rank)) ? col.opening_rank : Number(col.opening_rank).toLocaleString()}
                                </div>
                              </div>
                              <div className="text-right">
                                <div className="text-[8px] text-slate-600 font-black uppercase tracking-tighter mb-1 opacity-60">Closing</div>
                                <div className="text-blue-400 text-sm font-black italic">
                                  {isNaN(Number(col.closing_rank)) ? col.closing_rank : Number(col.closing_rank).toLocaleString()}
                                </div>
                              </div>
                            </div>
                          </div>
                        ) : (
                          <div className="py-8 bg-slate-950/20 rounded-3xl border border-dashed border-white/5 text-slate-800 text-[10px] font-black uppercase tracking-widest italic flex items-center justify-center">
                            Not Offered
                          </div>
                        )}
                      </td>
                    ))}
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={selectedColleges.length + 1} className="px-10 py-32 text-center">
                      <div className="flex flex-col items-center grayscale opacity-30">
                        <div className="text-5xl mb-4">🔍</div>
                        <div className="text-slate-500 font-black uppercase tracking-widest text-xs">
                          No matching data found for this specific combination
                        </div>
                        <p className="text-slate-700 text-[10px] font-bold mt-2">Try changing the Round or Category filters</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-40 bg-slate-900/20 rounded-[3rem] border-2 border-dashed border-white/5">
             <div className="w-20 h-20 bg-blue-600/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-4xl">⚖️</span>
             </div>
             <h3 className="text-2xl font-black text-slate-700 uppercase tracking-widest mb-2">Comparison Engine Ready</h3>
             <p className="text-slate-800 font-bold max-w-md mx-auto">
               Select up to three colleges using the search box above to start the deep-dive cutoff analysis.
             </p>
          </div>
        )}

        {/* Information Panel */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="p-8 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/10">
            <h4 className="flex items-center gap-3 text-white font-black uppercase text-xs tracking-wider mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-indigo-500 animate-pulse"></span>
              How to read this table?
            </h4>
            <p className="text-slate-500 text-xs font-bold leading-relaxed">
              We compare branches across your selected colleges. The <span className="text-emerald-500">"Winner Choice"</span> is automatically highlighted based on the <span className="text-white">lowest closing rank</span>, which statistically indicates a higher demand and perceived college quality for that specific branch.
            </p>
          </div>
          <div className="p-8 rounded-[2rem] bg-blue-500/5 border border-blue-500/10">
            <h4 className="flex items-center gap-3 text-white font-black uppercase text-xs tracking-wider mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></span>
              Round-wise Trends
            </h4>
            <p className="text-slate-500 text-xs font-bold leading-relaxed">
              Cutoffs generally increase (ranks get higher) in later rounds. Check Round 4 or Round 6 to see the final opportunities for high-tier colleges if your rank is on the border.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RankComparison;
