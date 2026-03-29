import React, { useState, useMemo } from 'react';
import Skeleton from './Skeleton.jsx';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import Select from 'react-select';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);

const CutoffTrendGraph = ({ allCutoffs, uniqueInstitutes, uniquePrograms, uniqueCategories }) => {
  const [filters, setFilters] = useState({
    institute: '',
    program: '',
    compareProgram: '',
    category: '',
  });
  
  const [metric, setMetric] = useState('closing'); // Dual metrics
  
  const [chartData, setChartData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const customStyles = {
    control: (base, state) => ({
      ...base,
      backgroundColor: "rgba(2, 6, 23, 0.45)",
      color: "white",
      borderRadius: "1.25rem",
      padding: "0.4rem 0.6rem",
      border: state.isFocused ? "1px solid rgba(99, 102, 241, 0.4)" : "1px solid rgba(255, 255, 255, 0.05)",
      boxShadow: state.isFocused ? "0 0 20px rgba(99, 102, 241, 0.08)" : "none",
      transition: "all 0.3s ease",
      cursor: "pointer",
      "&:hover": {
        borderColor: "rgba(255, 255, 255, 0.12)"
      }
    }),
    singleValue: (base) => ({ ...base, color: "white", fontWeight: "700", fontSize: "0.875rem" }),
    placeholder: (base) => ({ ...base, color: "rgba(148, 163, 184, 0.4)", fontSize: "0.875rem", fontWeight: "600" }),
    menu: (base) => ({ 
      ...base, 
      backgroundColor: "#0f172a", 
      borderRadius: "1.25rem", 
      border: "1px solid rgba(255, 255, 255, 0.08)", 
      overflow: "hidden", 
      zIndex: 100,
      boxShadow: "0 15px 40px rgba(0,0,0,0.5)"
    }),
    option: (base, state) => ({
      ...base,
      backgroundColor: state.isFocused ? "rgba(99, 102, 241, 0.15)" : "transparent",
      color: state.isFocused ? "#a5b4fc" : "white",
      padding: "14px 24px",
      fontSize: "0.8125rem",
      fontWeight: "700",
      cursor: "pointer",
      borderBottom: "1px solid rgba(255,255,255,0.03)",
      transition: "all 0.2s ease"
    }),
    input: (base) => ({ ...base, color: "white" }),
    menuPortal: (base) => ({ ...base, zIndex: 9999 }),
  };

  const handleFilterChange = (name, value) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const programsForInstitute = useMemo(() => {
    if (!filters.institute) return uniquePrograms || []; 
    
    return [
      ...new Set(
        allCutoffs
          .filter(item => (item.institute || "").trim().toLowerCase() === filters.institute.trim().toLowerCase())
          .map(item => (item.program || "").trim())
      )
    ].sort();
  }, [allCutoffs, filters.institute, uniquePrograms]);

  const displayPrograms = programsForInstitute;

  const normalize = (str) =>
    String(str || "")
      .toLowerCase()
      .replace(/[^a-z0-9]/g, "")
      .trim();

  const programMatch = (itemProgram, selectedProgram) => {
    const a = normalize(itemProgram);
    const b = normalize(selectedProgram);
    return a.includes(b) || b.includes(a);
  };

  const fetchAnalyticsData = () => {
    if (!filters.institute || !filters.program || !filters.category) {
      setError("Please select an Institute, Primary Program, and Category to view trends.");
      return;
    }
    if (filters.compareProgram && normalize(filters.program) === normalize(filters.compareProgram)) {
      setError("Please select different branches");
      return;
    }
    setLoading(true);
    setError(null);
    setChartData([]);

    setTimeout(() => {
      try {
        const selectedInstitute = normalize(filters.institute);
        const selectedCategory = normalize(filters.category);
        const primaryProgram = normalize(filters.program);
        const compareProgram = normalize(filters.compareProgram);

        // STEP 4 — Correct Filtering Logic
        const filtered = allCutoffs.filter(item => {
          if (!item) return false;

          const inst = normalize(item.institute);
          const cat = normalize(item.category);

          if (selectedInstitute && inst !== selectedInstitute) return false;
          if (selectedCategory && cat !== selectedCategory) return false;

          return true;
        });

        // STEP 5 — Separate Primary & Compare Data
        const primaryData = filtered.filter(item =>
          programMatch(item.program, filters.program)
        );

        let compareData = [];
        if (filters.compareProgram) {
          compareData = filtered.filter(item =>
            programMatch(item.program, filters.compareProgram)
          );
        }

        // STEP 8 — Group Data by Round
        const groupByRound = (data) => {
          const map = {};
          data.forEach(item => {
            const roundStr = String(item.round || "").replace(/\D/g, "");
            if (!roundStr) return;
            const round = roundStr;

            const closingStr = item.closing_rank ? String(item.closing_rank).replace(/,/g, '') : '0';
            const closing = Number(closingStr);
            const openingStr = item.opening_rank ? String(item.opening_rank).replace(/,/g, '') : '0';
            const opening = Number(openingStr);

            if (!map[round]) map[round] = [];
            map[round].push({ closing, opening: (!isNaN(opening) && opening > 0) ? opening : closing });
          });
          return map;
        };

        // STEP 9 — Extract Best Rank Per Round
        const bestRank = (map) => {
          const result = {};
          Object.keys(map).forEach(round => {
            result[round] = {
              closing: Math.min(...map[round].map(x => x.closing).filter(v => !isNaN(v))),
              opening: Math.min(...map[round].map(x => x.opening).filter(v => !isNaN(v)))
            };
          });
          return result;
        };

        const primaryMap = bestRank(groupByRound(primaryData));
        const compareMap = bestRank(groupByRound(compareData));

        // STEP 10 — Align Rounds Properly
        const rounds = ["1", "2", "3", "4", "6", "7"];

        const graphData = rounds.map(r => {
          const pData = primaryMap[r] ?? null;
          const cData = compareMap[r] ?? null;
          return {
            round: `Round ${r}`,
            primary_closing: pData?.closing && isFinite(pData.closing) ? pData.closing : null,
            primary_opening: pData?.opening && isFinite(pData.opening) ? pData.opening : null,
            compare_closing: cData?.closing && isFinite(cData.closing) ? cData.closing : null,
            compare_opening: cData?.opening && isFinite(cData.opening) ? cData.opening : null
          };
        });

        // STEP 11 — Fix "No Data Found" Condition
        if (!primaryData.length && !compareData.length) {
          setError("No data found for selected filters");
        } else {
          setChartData(graphData);
        }
      } catch (err) {
        console.error("Error fetching analytics:", err);
        setError("Failed to fetch historical data.");
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  const renderBestRound = (isPrimary) => {
    if (chartData.length === 0) return null;
    let minRank = Infinity;
    let bestRound = "";
    chartData.forEach(d => {
        const val = isPrimary ? (metric === 'closing' ? d.primary_closing : d.primary_opening) : (metric === 'closing' ? d.compare_closing : d.compare_opening);
        if (val && val < minRank) {
            minRank = val;
            bestRound = d.round;
        }
    });
    if (minRank === Infinity) return null;
    return <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.5rem' }}>Best chance in <strong style={{ color: 'var(--text-primary)' }}>{bestRound}</strong></div>;
  };

  const renderTrend = (isPrimary) => {
    const validRounds = chartData.filter(d => {
        const val = isPrimary ? (metric === 'closing' ? d.primary_closing : d.primary_opening) : (metric === 'closing' ? d.compare_closing : d.compare_opening);
        return val !== null;
    });
    
    if (validRounds.length < 2) return null;
    
    const r1 = validRounds[0];
    const rLast = validRounds[validRounds.length - 1];
    
    const val1 = isPrimary ? (metric === 'closing' ? r1.primary_closing : r1.primary_opening) : (metric === 'closing' ? r1.compare_closing : r1.compare_opening);
    const valLast = isPrimary ? (metric === 'closing' ? rLast.primary_closing : rLast.primary_opening) : (metric === 'closing' ? rLast.compare_closing : rLast.compare_opening);
    
    if (!val1 || !valLast || val1 === valLast) return <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.5rem', fontWeight: 'bold' }}>Demand Stable ⚖️</div>;
    
    if (valLast > val1) {
        return <div style={{ color: '#4ade80', fontSize: '0.95rem', marginTop: '0.5rem', fontWeight: 'bold' }}>Demand Increasing 📈</div>;
    } else {
        return <div style={{ color: '#f87171', fontSize: '0.95rem', marginTop: '0.5rem', fontWeight: 'bold' }}>Demand Decreasing 📉</div>;
    }
  };

  const renderGapAnalysisInner = () => {
    if (chartData.length === 0) return null;
    let r1 = chartData.find(d => d.round === "Round 1" && d.primary_closing && d.compare_closing);
    if (!r1) r1 = chartData.find(d => d.primary_closing && d.compare_closing); // any round with both
    if (!r1) return <div style={{ color: 'var(--text-secondary)' }}>Not enough overlapping data for gap analysis.</div>;

    const pc = metric === 'closing' ? r1.primary_closing : r1.primary_opening;
    const cc = metric === 'closing' ? r1.compare_closing : r1.compare_opening;
    
    if (!pc || !cc || pc === cc) return <div style={{ color: 'var(--text-secondary)' }}>Extremely similar competetion metrics.</div>;
    const gap = Math.abs(pc - cc);
    const moreCompetitive = pc < cc ? filters.program : filters.compareProgram;
    const lessCompetitive = pc < cc ? filters.compareProgram : filters.program;
    
    return (
        <div style={{ color: 'var(--text-secondary)', fontSize: '0.95rem', marginTop: '0.5rem', lineHeight: '1.5' }}>
            <strong style={{ color: '#60a5fa' }}>{moreCompetitive.split('(')[0].trim()}</strong> is <span style={{ color: '#4ade80', fontWeight: 'bold' }}>{gap.toLocaleString()}</span> ranks more competitive than <strong style={{ color: '#c084fc' }}>{lessCompetitive.split('(')[0].trim()}</strong>.
        </div>
    );
  };

  const lineChartData = useMemo(() => {
    const labels = chartData.map(d => d.round);
    const p1Data = chartData.map(d => metric === 'closing' ? d.primary_closing : d.primary_opening);
    
    const datasets = [
      {
        label: `Primary: ${filters.program || 'Program'}`,
        data: p1Data,
        borderColor: '#3b82f6', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.4, // Smooth curve
        pointRadius: 6,
        pointBackgroundColor: '#3b82f6',
        pointHoverRadius: 8,
        spanGaps: true
      }
    ];

    if (filters.compareProgram) {
      const p2Data = chartData.map(d => metric === 'closing' ? d.compare_closing : d.compare_opening);
      if (p2Data.some(v => v !== null)) {
        datasets.push({
          label: `Compare: ${filters.compareProgram}`,
          data: p2Data,
          borderColor: '#a855f7', // Purple
          backgroundColor: 'rgba(168, 85, 247, 0.5)',
          tension: 0.4, // Smooth curve
          pointRadius: 6,
          pointBackgroundColor: '#a855f7',
          pointHoverRadius: 8,
          spanGaps: true
        });
     }
    }

    return {
      labels: labels,
      datasets: datasets
    };
  }, [chartData, filters.program, filters.compareProgram, metric]);

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { color: '#f8fafc' } },
      title: { 
        display: true, 
        text: `${metric === 'closing' ? 'Closing' : 'Opening'} Rank Trends (2025)`, 
        color: '#f8fafc',
        font: { size: 16 }
      },
      tooltip: {
        backgroundColor: 'rgba(15, 23, 42, 0.9)',
        titleColor: '#f8fafc',
        bodyColor: '#e2e8f0',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        padding: 12,
        callbacks: {
          label: (context) => {
            const branchName = context.dataset.label.replace(/^(Primary|Compare):\s*/, '');
            const val = context.parsed.y ? context.parsed.y.toLocaleString() : 'N/A';
            const metricName = metric === 'closing' ? 'Closing Rank' : 'Opening Rank';
            return [`  Branch: ${branchName}`, `  ${metricName}: ${val}`];
          }
        }
      }
    },
    scales: {
      y: {
        reverse: true, // Lower rank is better
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      },
      x: {
        ticks: { color: '#94a3b8' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' }
      }
    }
  };

  return (
    <div className="space-y-10 animate-fadeIn">
      {/* 1. Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-2">
        <div className="flex items-center gap-5">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-purple-600/20 flex items-center justify-center border border-white/10 shadow-lg backdrop-blur-md">
            <svg className="w-7 h-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
          </div>
          <div>
            <h2 className="text-3xl md:text-4xl font-black text-white tracking-tight">Analytics Dashboard</h2>
            <p className="text-slate-400 text-sm font-medium mt-1">Visualize historical cutoff trends and branch competition metrics.</p>
          </div>
        </div>
      </div>

      {/* 2. Unified Filter Section */}
      <div className="bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-[100px] rounded-full -mr-20 -mt-20"></div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 relative z-10">
          <div className="group">
            <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4 ml-2 group-focus-within:text-indigo-400 transition-colors opacity-70">Institute</label>
            <Select
              options={uniqueInstitutes.map(inst => ({ label: inst, value: inst }))}
              onChange={(selected) => handleFilterChange('institute', selected?.value || '')}
              value={filters.institute ? { label: filters.institute, value: filters.institute } : null}
              styles={customStyles}
              isSearchable={true}
              placeholder="Select Institute..."
              menuPortalTarget={document.body}
            />
          </div>
          <div className="group">
            <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4 ml-2 group-focus-within:text-indigo-400 transition-colors opacity-70">Primary Program</label>
            <Select
              options={displayPrograms.map(prog => ({ label: prog, value: prog }))}
              onChange={(selected) => handleFilterChange('program', selected?.value || '')}
              value={filters.program ? { label: filters.program, value: filters.program } : null}
              styles={customStyles}
              isSearchable={true}
              placeholder="Select Program..."
              menuPortalTarget={document.body}
            />
          </div>
          <div className="group">
            <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4 ml-2 group-focus-within:text-purple-400 transition-colors opacity-70">Compare With (Optional)</label>
            <Select
              options={displayPrograms.map(prog => ({ label: prog, value: prog }))}
              onChange={(selected) => handleFilterChange('compareProgram', selected?.value || '')}
              value={filters.compareProgram ? { label: filters.compareProgram, value: filters.compareProgram } : null}
              styles={customStyles}
              isSearchable={true}
              placeholder="Compare Branch..."
              menuPortalTarget={document.body}
            />
          </div>
          <div className="group">
            <label className="block text-slate-500 text-[10px] font-black uppercase tracking-[0.3em] mb-4 ml-2 group-focus-within:text-indigo-400 transition-colors opacity-70">Category</label>
            <Select
              options={uniqueCategories.map(cat => ({ label: cat, value: cat }))}
              onChange={(selected) => handleFilterChange('category', selected?.value || '')}
              value={filters.category ? { label: filters.category, value: filters.category } : null}
              styles={customStyles}
              isSearchable={true}
              placeholder="Select Category..."
              menuPortalTarget={document.body}
            />
          </div>
        </div>

        <div className="mt-8 flex flex-col md:flex-row items-center justify-between gap-6 pt-6 border-t border-white/5 relative z-10">
          <div className="flex items-center gap-3 bg-slate-900/40 p-1.5 rounded-2xl border border-white/5">
            <button onClick={() => setMetric('closing')}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 ${metric === 'closing' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
              Closing Rank
            </button>
            <button onClick={() => setMetric('opening')}
              className={`px-5 py-2.5 rounded-xl font-bold text-xs transition-all duration-300 ${metric === 'opening' ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/30' : 'text-slate-500 hover:text-slate-300'}`}>
              Opening Rank
            </button>
          </div>
          <button onClick={fetchAnalyticsData} disabled={loading}
            className="group relative px-10 py-4 rounded-2xl overflow-hidden shadow-lg transition-all active:scale-95 disabled:opacity-50 min-w-[200px]">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-600 to-purple-600 group-hover:scale-105 transition-transform duration-500"></div>
            <span className="relative z-10 text-white font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2">
              {loading ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin"></div> : 'Analyze 📈'}
            </span>
          </button>
        </div>
      </div>

      {error && (
        <div className="p-5 bg-red-500/5 border border-red-500/20 rounded-3xl flex items-center gap-4 text-red-400">
          <div className="w-10 h-10 rounded-2xl bg-red-500/10 flex items-center justify-center flex-shrink-0 border border-red-500/20">!</div>
          <p className="font-bold text-sm tracking-wide">{error}</p>
        </div>
      )}

      {loading ? (
        <div className="space-y-10 animate-fadeIn">
          {/* Skeleton KPI Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-white/5 p-8 rounded-[2rem] border border-white/10 space-y-4">
                <div className="flex items-center gap-2">
                  <Skeleton className="w-2 h-2 rounded-full" />
                  <Skeleton className="w-24 h-3 rounded-lg" />
                </div>
                <Skeleton className="w-full h-8 rounded-xl" />
                <div className="space-y-2">
                  <Skeleton className="w-32 h-4 rounded-lg" />
                  <Skeleton className="w-40 h-4 rounded-lg" />
                </div>
              </div>
            ))}
          </div>

          {/* Skeleton Chart Block */}
          <div className="bg-white/5 p-10 rounded-[2.5rem] border border-white/10 h-[400px] flex items-center justify-center">
             <div className="w-full h-full relative overflow-hidden bg-white/5 rounded-2xl animate-pulse">
                <div className="absolute inset-x-0 bottom-0 h-[2px] bg-white/10 shadow-[0_0_15px_rgba(255,255,255,0.1)]"></div>
             </div>
          </div>

          {/* Skeleton Table */}
          <div className="space-y-6">
            <Skeleton className="w-48 h-6 rounded-lg ml-2" />
            <div className="rounded-[2rem] border border-white/10 bg-white/5 overflow-hidden">
               {[1, 2, 3, 4].map((i) => (
                 <div key={i} className="px-8 py-6 border-b border-white/5 flex justify-between items-center">
                    <Skeleton className="w-24 h-4 rounded-lg" />
                    <Skeleton className="w-32 h-6 rounded-lg" />
                    <Skeleton className="w-32 h-6 rounded-lg" />
                    <Skeleton className="w-24 h-4 rounded-lg" />
                 </div>
               ))}
            </div>
          </div>
        </div>
      ) : chartData.length > 0 ? (
        <div className="space-y-10 animate-fadeIn">
          {/* 3. KPI / Insight Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl relative overflow-hidden group hover:border-indigo-500/30 transition-all duration-500 shadow-xl">
              <div className="absolute -top-10 -right-10 w-32 h-32 bg-indigo-500/10 rounded-full blur-3xl group-hover:bg-indigo-500/20 transition-all"></div>
              <h3 className="text-indigo-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-4 flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"></div> Main Metric
              </h3>
              <div className="text-white font-black text-xl mb-4 line-clamp-2 leading-tight">{filters.program}</div>
              <div className="space-y-2">
                {renderBestRound(true)}
                {renderTrend(true)}
              </div>
            </div>

            {filters.compareProgram && (
              <div className="bg-white/5 p-8 rounded-[2rem] border border-white/10 backdrop-blur-xl relative overflow-hidden group hover:border-purple-500/30 transition-all duration-500 shadow-xl">
                <div className="absolute -top-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-3xl group-hover:bg-purple-500/20 transition-all"></div>
                <h3 className="text-purple-400 font-bold uppercase tracking-[0.2em] text-[10px] mb-4 flex items-center gap-2.5">
                  <div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.5)]"></div> Comparison Insight
                </h3>
                <div className="text-white font-black text-xl mb-4 line-clamp-2 leading-tight">{filters.compareProgram}</div>
                <div className="space-y-2">
                  {renderBestRound(false)}
                  {renderTrend(false)}
                </div>
              </div>
            )}
            
            {filters.compareProgram && (
              <div className="bg-slate-900/40 p-8 rounded-[2rem] border border-white/5 backdrop-blur-xl transition-all duration-500 flex flex-col justify-center">
                <h3 className="text-slate-500 font-bold uppercase tracking-[0.2em] text-[10px] mb-4">Competitive Gap Analysis</h3>
                {renderGapAnalysisInner()}
              </div>
            )}
          </div>

          {/* 4. Visualization Section */}
          <div className="bg-white/5 p-6 md:p-10 rounded-[2.5rem] border border-white/10 backdrop-blur-xl shadow-2xl relative overflow-hidden">
            <div className="max-w-7xl mx-auto">
              <Line options={lineChartOptions} data={lineChartData} />
              <div className="mt-8 pt-8 border-t border-white/5 flex flex-col md:flex-row items-center justify-between gap-4 text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">
                <span>Dataset: 2025 AKTU Counselling Rounds</span>
                <span className="bg-slate-900/80 px-4 py-2 rounded-xl border border-white/5">Numerical lower rank = higher demand</span>
              </div>
            </div>
          </div>

          {/* 5. Detailed Data Table / Mobile Cards */}
          <div className="space-y-6">
            <h4 className="text-white font-black text-xl tracking-tight ml-2">Historical Distribution</h4>
            
            {/* Desktop Table */}
            <div className="hidden md:block overflow-x-auto rounded-[2rem] border border-white/10 bg-white/5 shadow-2xl backdrop-blur-xl transition-all">
              <table className="w-full">
                <thead>
                  <tr className="bg-slate-900/40 border-b border-white/5">
                    <th className="px-8 py-6 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Rounds</th>
                    <th className="px-8 py-6 text-indigo-300 text-[10px] font-black uppercase tracking-[0.2em]">Primary {metric}</th>
                    {filters.compareProgram && <th className="px-8 py-6 text-purple-300 text-[10px] font-black uppercase tracking-[0.2em]">Compare {metric}</th>}
                    {filters.compareProgram && <th className="px-8 py-6 text-slate-400 text-[10px] font-black uppercase tracking-[0.2em]">Verdict</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {chartData.map((row, idx) => {
                    let better = "-";
                    const pc = metric === 'closing' ? row.primary_closing : row.primary_opening;
                    const cc = metric === 'closing' ? row.compare_closing : row.compare_opening;

                    if (filters.compareProgram) {
                      if (pc && cc) {
                        if (pc < cc) better = "Primary";
                        else if (cc < pc) better = "Compare";
                        else better = "Tie";
                      } else if (pc && !cc) better = "Primary";
                      else if (!pc && cc) better = "Compare";
                    }

                    return (
                      <tr 
                        key={idx} 
                        className="hover:bg-white/[0.04] transition-all group animate-slideUp"
                        style={{ animationDelay: `${idx * 50}ms` }}
                      >
                        <td className="px-8 py-6 text-white font-black text-sm">{row.round}</td>
                        <td className="px-8 py-6 text-indigo-400 font-black text-lg">{pc ? pc.toLocaleString() : '-'}</td>
                        {filters.compareProgram && <td className="px-8 py-6 text-purple-400 font-black text-lg">{cc ? cc.toLocaleString() : '-'}</td>}
                        {filters.compareProgram && (
                          <td className="px-8 py-6">
                            {better === "Primary" && <span className="bg-indigo-500/10 text-indigo-400 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest border border-indigo-500/20">PRIMARY BEST</span>}
                            {better === "Compare" && <span className="bg-purple-500/10 text-purple-400 px-4 py-2 rounded-xl text-[10px] font-black tracking-widest border border-purple-500/20">COMPARE BEST</span>}
                            {better === "Tie" && <span className="text-slate-500 text-xs font-bold uppercase tracking-widest">Equivalent</span>}
                            {better === "-" && <span className="text-slate-700">-</span>}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="md:hidden space-y-4">
              {chartData.map((row, idx) => {
                const pc = metric === 'closing' ? row.primary_closing : row.primary_opening;
                const cc = metric === 'closing' ? row.compare_closing : row.compare_opening;
                return (
                  <div key={idx} className="bg-white/5 border border-white/10 p-6 rounded-3xl backdrop-blur-xl">
                    <div className="flex justify-between items-center mb-6">
                      <span className="text-white font-black text-lg">{row.round}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-4">
                      <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                        <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest block mb-1">Primary Rank</span>
                        <span className="text-indigo-400 font-black text-xl">{pc ? pc.toLocaleString() : 'N/A'}</span>
                      </div>
                      {filters.compareProgram && (
                        <div className="bg-slate-900/40 p-4 rounded-2xl border border-white/5">
                          <span className="text-slate-500 text-[9px] font-bold uppercase tracking-widest block mb-1">Compare Rank</span>
                          <span className="text-purple-400 font-black text-xl">{cc ? cc.toLocaleString() : 'N/A'}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default CutoffTrendGraph;
