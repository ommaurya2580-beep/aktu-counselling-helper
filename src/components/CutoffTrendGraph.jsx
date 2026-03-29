import React, { useState, useMemo } from 'react';
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

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
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
    <div className="glass-container analytics-container">
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>Cutoff Analytics & Trends</h2>
      
      <div className="filter-grid" style={{ marginBottom: '2rem' }}>
        <div className="filter-group" style={{ gridColumn: '1 / -1' }}>
          <label>Institute Name</label>
          <select name="institute" value={filters.institute} onChange={handleFilterChange}>
            <option value="">Select Institute</option>
            {uniqueInstitutes.map((inst, i) => <option key={i} value={inst}>{inst}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Primary Program</label>
          <select name="program" value={filters.program} onChange={handleFilterChange}>
            <option value="">Select Program</option>
            {displayPrograms.map((prog, i) => <option key={i} value={prog}>{prog}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Compare With (Optional)</label>
          <select name="compareProgram" value={filters.compareProgram} onChange={handleFilterChange}>
            <option value="">Select Program to Compare</option>
            {displayPrograms.map((prog, i) => <option key={i} value={prog}>{prog}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Category</label>
          <select name="category" value={filters.category} onChange={handleFilterChange}>
            <option value="">Select Category</option>
            {uniqueCategories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
          </select>
        </div>
      </div>

      <button className="search-btn" onClick={fetchAnalyticsData} disabled={loading} style={{ marginBottom: '2rem' }}>
        {loading ? "Generating Chart..." : "Analyze Trends"}
      </button>

      {error && (
        <div className="error-alert" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171', padding: '1rem', borderRadius: '8px', marginBottom: '1.5rem', fontWeight: '500' }}>
          {error}
        </div>
      )}

      {chartData.length > 0 && (
        <>
          <div style={{ display: 'flex', justifyContent: 'center', gap: '1rem', marginBottom: '2rem' }}>
            <button
              onClick={() => setMetric('closing')}
              style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: metric === 'closing' ? '1px solid #3b82f6' : '1px solid var(--glass-border)', background: metric === 'closing' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)', color: metric === 'closing' ? '#60a5fa' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', fontSize: '0.95rem' }}
            >
              Closing Rank
            </button>
            <button
              onClick={() => setMetric('opening')}
              style={{ padding: '0.6rem 1.5rem', borderRadius: '8px', border: metric === 'opening' ? '1px solid #3b82f6' : '1px solid var(--glass-border)', background: metric === 'opening' ? 'rgba(59, 130, 246, 0.15)' : 'rgba(255,255,255,0.05)', color: metric === 'opening' ? '#60a5fa' : 'var(--text-secondary)', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.2s', fontSize: '0.95rem' }}
            >
              Opening Rank
            </button>
          </div>

          <div className="analytics-insights" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem', marginBottom: '2rem' }}>
              <div style={{ background: 'rgba(59, 130, 246, 0.08)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.3)' }}>
                  <h3 style={{ color: '#60a5fa', marginBottom: '0.75rem', fontSize: '1.1rem' }}>Primary Insight</h3>
                  <div style={{ color: 'var(--text-primary)', fontWeight: '500', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={filters.program}>{filters.program}</div>
                  {renderBestRound(true)}
                  {renderTrend(true)}
              </div>

              {filters.compareProgram && (
                  <div style={{ background: 'rgba(168, 85, 247, 0.08)', padding: '1.5rem', borderRadius: '12px', border: '1px solid rgba(168, 85, 247, 0.3)' }}>
                      <h3 style={{ color: '#c084fc', marginBottom: '0.75rem', fontSize: '1.1rem' }}>Compare Insight</h3>
                      <div style={{ color: 'var(--text-primary)', fontWeight: '500', marginBottom: '0.5rem', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }} title={filters.compareProgram}>{filters.compareProgram}</div>
                      {renderBestRound(false)}
                      {renderTrend(false)}
                  </div>
              )}
              
              {filters.compareProgram && (
                  <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                      <h3 style={{ color: 'var(--text-primary)', marginBottom: '0.75rem', fontSize: '1.1rem' }}>Gap Analysis</h3>
                      {renderGapAnalysisInner()}
                  </div>
              )}
          </div>

          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '1.5rem', borderRadius: '12px', border: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
              <Line options={lineChartOptions} data={lineChartData} />
              <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                Note: Higher placement on the graph means a more competitive (numerically lower) rank.
              </p>
          </div>

          <div className="table-container" style={{ overflowX: 'auto', background: 'rgba(15, 23, 42, 0.6)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', color: 'var(--text-secondary)' }}>
              <thead>
                <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid var(--glass-border)' }}>
                  <th style={{ padding: '1rem', color: 'var(--text-primary)' }}>Round</th>
                  <th style={{ padding: '1rem', color: 'var(--text-primary)' }}>Primary {metric === 'closing' ? 'Close' : 'Open'}</th>
                  {filters.compareProgram && <th style={{ padding: '1rem', color: 'var(--text-primary)' }}>Compare {metric === 'closing' ? 'Close' : 'Open'}</th>}
                  {filters.compareProgram && <th style={{ padding: '1rem', color: 'var(--text-primary)' }}>Better</th>}
                </tr>
              </thead>
              <tbody>
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
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                      <td style={{ padding: '1rem' }}>{row.round}</td>
                      <td style={{ padding: '1rem', color: '#60a5fa', fontWeight: 'bold' }}>{pc ? pc.toLocaleString() : '-'}</td>
                      
                      {filters.compareProgram && <td style={{ padding: '1rem', color: '#c084fc', fontWeight: 'bold' }}>{cc ? cc.toLocaleString() : '-'}</td>}
                      
                      {filters.compareProgram && (
                        <td style={{ padding: '1rem' }}>
                          {better === "Primary" && <span style={{ background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>Primary ✓</span>}
                          {better === "Compare" && <span style={{ background: 'rgba(74, 222, 128, 0.15)', color: '#4ade80', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>Compare ✓</span>}
                          {better === "Tie" && <span style={{ color: 'var(--text-secondary)' }}>Tie</span>}
                          {better === "-" && <span style={{ color: 'var(--text-secondary)' }}>-</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
};

export default CutoffTrendGraph;
