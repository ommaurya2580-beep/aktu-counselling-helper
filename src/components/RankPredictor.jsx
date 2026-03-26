import React, { useState } from 'react';
import { predictColleges } from '../utils/predictor.js';

const RankPredictor = ({ uniqueCategories, uniqueQuotas, uniquePrograms }) => {
  const [filters, setFilters] = useState({ rank: '', category: '', quota: '', branch: '', round: '1' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [results, setResults] = useState({ high: [], medium: [], low: [] });

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
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

  const CollegeCard = ({ college, color }) => (
    <div className={`bg-slate-800/40 backdrop-blur-md border border-slate-700/50 rounded-2xl p-6 shadow-xl flex flex-col gap-4 transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl hover:border-slate-600 border-t-4 ${color}`}>
      <div className="flex justify-between items-center">
        <span className={`px-3 py-1 rounded-full text-[10px] uppercase font-black tracking-wider text-white bg-slate-700/80`}>
          {college.chance} CHANCE
        </span>
        <div className="flex flex-col items-end">
          <span className="text-slate-500 text-[10px] font-bold uppercase tracking-tighter">Round</span>
          <span className="text-white text-sm font-black italic">#0{college.round}</span>
        </div>
      </div>
      
      <div>
        <h4 className="text-white font-extrabold text-xl leading-tight mb-2 min-h-[3rem] line-clamp-2">{college.college_name}</h4>
        <div className="flex items-center gap-2">
           <div className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse"></div>
           <p className="text-slate-400 text-xs font-semibold uppercase tracking-wide">{college.branch}</p>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 py-4 border-t border-slate-700/30">
        <div className="flex flex-col">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Closing Rank</span>
          <span className="text-white text-2xl font-black">{Number(college.closing_rank).toLocaleString()}</span>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mb-1">Rank Diff</span>
          <span className={`text-lg font-black ${college.proximity >= 0 ? 'text-blue-400' : 'text-pink-500'}`}>
            {college.proximity.toLocaleString()}
          </span>
        </div>
      </div>
    </div>
  );

  const Section = ({ title, colleges, color, emptyMsg }) => {
    if (colleges.length === 0 && !emptyMsg) return null;
    return (
      <div className="mb-16 animate-fadeIn">
        <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/5">
          <h3 className="text-white text-2xl font-black tracking-tight flex items-center gap-3">
            {title}
          </h3>
          {results.isRelaxed && (
             <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-lg">
                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse"></div>
                <span className="text-[10px] text-blue-400 font-bold uppercase tracking-widest">Based on relaxed criteria</span>
             </div>
          )}
          <div className="flex items-center gap-2 bg-slate-900/80 px-4 py-1.5 rounded-full border border-slate-800">
             <span className="text-slate-500 text-[10px] font-bold uppercase">Results Found</span>
             <span className="text-blue-400 font-black text-lg">{colleges.length}</span>
          </div>
        </div>
        
        {colleges.length === 0 ? (
          <div className="py-12 px-6 rounded-3xl border-2 border-dashed border-slate-800 text-center">
             <p className="text-slate-600 font-medium italic">{emptyMsg}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {colleges.map((col, i) => <CollegeCard key={i} college={col} color={color} />)}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-[#020617] text-slate-300 font-['Outfit'] selection:bg-blue-500/30">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@100;300;400;500;600;700;800;900&display=swap');
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .animate-fadeIn { animation: fadeIn 0.6s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
      `}</style>

      <div className="max-w-7xl mx-auto px-4 py-12">
        {/* Hero Section */}
        <div className="relative mb-16 text-center animate-fadeIn">
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 bg-blue-500/10 blur-[120px] rounded-full"></div>
          <h1 className="text-5xl md:text-7xl font-black text-white mb-6 bg-gradient-to-b from-white via-slate-200 to-slate-500 bg-clip-text text-transparent tracking-tighter">
            Rank Predictor
          </h1>
          <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto font-medium leading-relaxed">
            Revolutionary <span className="text-blue-400 font-bold">O(1) Engine</span> powered by 2025 cutoff data. 
            Get instant, accurate predictions without database delays.
          </p>
        </div>

        {/* Search Panel */}
        <div className="bg-slate-900/40 backdrop-blur-xl border border-white/5 rounded-[2.5rem] p-4 md:p-10 mb-20 shadow-2xl relative overflow-hidden animate-fadeIn" style={{ animationDelay: '0.1s' }}>
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 blur-[80px] rounded-full"></div>
          
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-10">
            <div className="group">
              <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 ml-2 group-focus-within:text-blue-400 transition-colors">JEE Mains Rank</label>
              <input type="number" name="rank" value={filters.rank} onChange={handleFilterChange}
                placeholder="Ex: 45000"
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-white font-bold placeholder:text-slate-600 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all shadow-inner"
              />
            </div>

            <div className="group">
              <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 ml-2 group-focus-within:text-blue-400 transition-colors">Category</label>
              <select name="category" value={filters.category} onChange={handleFilterChange}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all appearance-none cursor-pointer">
                <option value="">Select Category</option>
                {uniqueCategories?.map((c, i) => <option key={i} value={c}>{c}</option>)}
              </select>
            </div>

            <div className="group">
              <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 ml-2 group-focus-within:text-blue-400 transition-colors">Quota</label>
              <select name="quota" value={filters.quota} onChange={handleFilterChange}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all appearance-none cursor-pointer">
                <option value="">Select Quota</option>
                {uniqueQuotas?.map((q, i) => <option key={i} value={q}>{q}</option>)}
              </select>
            </div>

            <div className="group">
              <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 ml-2 group-focus-within:text-blue-400 transition-colors">Branch</label>
              <select name="branch" value={filters.branch} onChange={handleFilterChange}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all appearance-none cursor-pointer">
                <option value="">Select Branch</option>
                {uniquePrograms?.map((p, i) => <option key={i} value={p}>{p}</option>)}
              </select>
            </div>

            <div className="group">
              <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] mb-3 ml-2 group-focus-within:text-blue-400 transition-colors">Round</label>
              <select name="round" value={filters.round} onChange={handleFilterChange}
                className="w-full bg-slate-950/50 border border-slate-800 rounded-2xl p-4 text-white font-bold focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all appearance-none cursor-pointer">
                {[1, 2, 3, 4, 6, 7].map(r => (
                  <option key={r} value={r}>Round {r}</option>
                ))}
              </select>
            </div>
          </div>

          <button onClick={handlePredict} disabled={loading}
            className="group relative w-full h-20 rounded-2xl overflow-hidden shadow-[0_20px_40px_rgba(37,99,235,0.2)] transition-all active:scale-[0.99] disabled:opacity-50 disabled:cursor-not-allowed">
            <div className="absolute inset-0 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 group-hover:scale-110 transition-transform duration-500"></div>
            <div className="absolute inset-0 bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
            <span className="relative z-10 text-white font-black text-xl uppercase tracking-[0.15em] flex items-center justify-center gap-3">
              {loading ? (
                <>
                  <div className="w-6 h-6 border-4 border-white/20 border-t-white rounded-full animate-spin"></div>
                  Processing...
                </>
              ) : (
                <>Predict Colleges 🚀</>
              )}
            </span>
          </button>
        </div>

        {/* Result Area */}
        <div className="relative">
           {error ? (
              <div className="max-w-md mx-auto p-6 bg-red-500/5 border border-red-500/20 rounded-3xl text-center animate-fadeIn">
                 <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4 border border-red-500/20 text-red-500 text-2xl font-black">!</div>
                 <p className="text-red-400 font-bold">{error}</p>
              </div>
           ) : (
                <div className="space-y-4">
                  <Section title="✅ HIGH CHANCE (SAFE)" colleges={results.high} color="border-t-green-500/80 shadow-green-500/5" />
                  <Section title="⚖️ MEDIUM CHANCE (TARGET)" colleges={results.medium} color="border-t-yellow-500/80 shadow-yellow-500/5" />
                  <Section title="🧗 LOW CHANCE (AMBITIOUS)" colleges={results.low} color="border-t-red-500/80 shadow-red-500/5" />
                </div>
           )}
        </div>
      </div>
    </div>
  );
};

export default RankPredictor;
