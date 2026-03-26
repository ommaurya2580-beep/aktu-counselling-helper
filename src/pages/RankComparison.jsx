import React, { useState, useMemo, useEffect } from 'react';
import { getRoundData } from '../utils/cutoffLoader.js';
import filterOptions from '../data/filterOptions.json';

const RankComparison = () => {
  const [selectedColleges, setSelectedColleges] = useState([]);
  const [selectedRound, setSelectedRound] = useState('Round 1');
  const [filters, setFilters] = useState({
    category: 'OPEN',
    quota: 'Home State',
    gender: 'Both Male and Female Seats'
  });
  const [roundData, setRoundData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);

  // Fetch data when round changes
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        const roundNum = selectedRound.replace('Round ', '');
        const data = await getRoundData(roundNum);
        setRoundData(data || []);
      } catch (error) {
        console.error('Error loading round data:', error);
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [selectedRound]);

  // Utility to normalize strings for robust matching (removes punctuation, dots, and extra spaces)
  const normalizeForSearch = (str) => {
    if (!str) return '';
    return str.toLowerCase().replace(/[^a-z0-9]/g, '').trim();
  };

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

  const comparisonData = useMemo(() => {
    if (selectedColleges.length === 0 || roundData.length === 0) return [];

    // 1. Pre-process Round Data to build a lookup map
    const branchMap = {};
    
    // Normalization keys
    const targetCategory = normalizeForSearch(filters.category);
    const targetQuota = normalizeForSearch(filters.quota);
    const isFemaleOnly = filters.gender === 'Female Seats Only';
    
    // Pre-normalize selected college names for comparison
    const normalizedSelectedColleges = selectedColleges.map(c => normalizeForSearch(c));

    roundData.forEach(item => {
      const itemCollegeNormalized = normalizeForSearch(item.college_name);
      
      // Find which selected college this item belongs to
      const collegeIdx = normalizedSelectedColleges.indexOf(itemCollegeNormalized);
      if (collegeIdx === -1) return;
      
      const collegeName = selectedColleges[collegeIdx];
      const itemCategory = normalizeForSearch(item.category);
      const itemQuota = normalizeForSearch(item.quota);
      
      // Category Match Logic
      // 1. Strict match
      // 2. Contains (e.g., OPEN matches OPEN(TF))
      // 3. Gender specific (e.g., matches (GL) if female selected)
      let catScore = 0;
      if (itemCategory === targetCategory) catScore = 10;
      else if (itemCategory.includes(targetCategory)) catScore = 5;
      else if (targetCategory === 'open' && itemCategory.startsWith('open')) catScore = 3;
      
      // Gender filtering: if female only, filter for categories with 'GL' or 'GIRL'
      if (isFemaleOnly) {
          if (!item.category.includes('GL') && !item.category.includes('GIRL')) {
              catScore = 0; // Disqualify if not female seat
          } else {
              catScore += 2; // Boost if female seat
          }
      }

      const quotaMatch = itemQuota === targetQuota || itemQuota.includes(targetQuota);
      
      if (catScore > 0 && quotaMatch) {
          if (!branchMap[item.branch]) branchMap[item.branch] = {};
          
          // Only keep the best category match for each college+branch
          // Using collegeName (from selectedColleges) as key for consistency
          const currentMatch = branchMap[item.branch][collegeName];
          if (!currentMatch || catScore > currentMatch.score || (catScore === currentMatch.score && item.closing_rank < currentMatch.closing_rank)) {
              branchMap[item.branch][collegeName] = {
                  ...item,
                  score: catScore
              };
          }
      }
    });

    // Fallback logic: If a college has data for a branch but NOT in the specific category, try 'OPEN'
    if (targetCategory !== 'open') {
        roundData.forEach(item => {
            const itemCollegeNormalized = normalizeForSearch(item.college_name);
            const collegeIdx = normalizedSelectedColleges.indexOf(itemCollegeNormalized);
            if (collegeIdx === -1) return;
            
            const collegeName = selectedColleges[collegeIdx];
            const itemCategory = normalizeForSearch(item.category);
            const itemQuota = normalizeForSearch(item.quota);
            
            if (itemCategory === 'open' && (itemQuota === targetQuota || itemQuota.includes(targetQuota))) {
                if (!branchMap[item.branch]) return; // Only fallback for branches already found in other colleges
                if (!branchMap[item.branch][collegeName]) {
                    branchMap[item.branch][collegeName] = { ...item, score: 1, isFallback: true };
                }
            }
        });
    }

    // Transform map to displayable array
    return Object.keys(branchMap).map(branchName => {
      const branchColleges = selectedColleges.map(collegeName => {
        const match = branchMap[branchName][collegeName];
        return {
          name: collegeName,
          opening_rank: match?.opening_rank || 'N/A',
          closing_rank: match?.closing_rank || 'N/A',
          category: match?.category, // Show which category matched for clarity
          exists: !!match,
          isFallback: match?.isFallback
        };
      });

      // Find winner for this branch (lowest closing rank among valid matches)
      let winner = null;
      let minClosing = Infinity;

      branchColleges.forEach(bc => {
        if (bc.exists && bc.closing_rank !== 'N/A' && !bc.isFallback) {
          const rank = Number(bc.closing_rank);
          if (rank < minClosing) {
            minClosing = rank;
            winner = bc.name;
          }
        }
      });

      return {
        branch: branchName,
        colleges: branchColleges,
        winner
      };
    }).sort((a, b) => a.branch.localeCompare(b.branch));
  }, [selectedColleges, roundData, filters]);

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
                {comparisonData.length > 0 ? comparisonData.map((row) => (
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
