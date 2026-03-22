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

  const normalize = (str) => (str || "").toString().trim().toLowerCase();

  const fetchAnalyticsData = () => {
    if (!filters.institute || !filters.program || !filters.category) {
      setError("Please select an Institute, Primary Program, and Category to view trends.");
      return;
    }
    if (filters.compareProgram && normalize(filters.program) === normalize(filters.compareProgram)) {
      alert("Please select different programs to compare");
      return;
    }
    setLoading(true);
    setError(null);
    setChartData([]);

    // setTimeout to allow UI to show loading state
    setTimeout(() => {
      try {
        const selectedInstitute = filters.institute;
        const selectedCategory = filters.category;
        const primaryProgram = filters.program;
        const compareProgram = filters.compareProgram;

        console.log("Selected:", {
          institute: selectedInstitute,
          program: primaryProgram,
          compareProgram: compareProgram,
          category: selectedCategory
        });
        if (allCutoffs.length > 0) {
          console.log("Sample Data:", allCutoffs[0]);
        }

        // STEP 1: FILTER DATA
        const filteredData = allCutoffs.filter(item => {
          const instMatch = normalize(item.institute_lower) === normalize(selectedInstitute) || normalize(item.institute) === normalize(selectedInstitute);
          const catMatch = normalize(item.category_norm) === normalize(selectedCategory) || normalize(item.category) === normalize(selectedCategory);
          const yearMatch = normalize(item.year_norm) === '2025' || normalize(item.year) === '2025';
          const progMatch = normalize(item.program).includes(normalize(primaryProgram)) || 
                           (compareProgram && normalize(item.program).includes(normalize(compareProgram)));
          
          return instMatch && catMatch && yearMatch && progMatch;
        });

        console.log("Matched Data:", filteredData.length);

        // STEP 2: GROUP BY ROUND
        const roundMap = {};

        filteredData.forEach(item => {
          const roundName = item.round_norm || String(item.round).trim().replace(/^Round\s*/i, '');
          const roundKey = /^\d+$/.test(roundName) ? `Round ${roundName}` : roundName;

          if (!roundMap[roundKey]) {
            roundMap[roundKey] = { raw_round: roundName };
          }

          const itemProgNorm = normalize(item.program);
          const pClose = parseInt(item.closing_rank) || parseInt(String(item.closing_rank).replace(/,/g, ''));
          const pOpen = parseInt(item.opening_rank) || parseInt(String(item.opening_rank).replace(/,/g, ''));

          if (itemProgNorm.includes(normalize(primaryProgram))) {
            roundMap[roundKey].primary_close = pClose;
            roundMap[roundKey].primary_open = pOpen;
          }

          if (compareProgram && itemProgNorm.includes(normalize(compareProgram))) {
            roundMap[roundKey].compare_close = pClose;
            roundMap[roundKey].compare_open = pOpen;
          }
        });

        // STEP 3: CONVERT TO ARRAY
        const processedChartData = Object.keys(roundMap).map(roundKey => ({
          round: roundKey,
          ...roundMap[roundKey]
        }));

        // Sort rounds
        processedChartData.sort((a, b) => {
          const aNum = parseInt(a.raw_round);
          const bNum = parseInt(b.raw_round);
          const aIsNum = !isNaN(aNum);
          const bIsNum = !isNaN(bNum);
          if (aIsNum && bIsNum) return aNum - bNum;
          if (aIsNum) return -1;
          if (bIsNum) return 1;
          return a.raw_round.localeCompare(b.raw_round);
        });

        if (processedChartData.length === 0) {
          setError("No matching data found. Try selecting exact program name.");
        } else {
          setChartData(processedChartData);
        }
      } catch (err) {
        console.error("Error fetching analytics:", err);
        setError("Failed to fetch historical data.");
      } finally {
        setLoading(false);
      }
    }, 0);
  };

  const lineChartData = useMemo(() => {
    const labels = chartData.map(d => d.round);
    const p1Data = chartData.map(d => d.primary_close || null);
    
    const datasets = [
      {
        label: `Primary: ${filters.program || 'Program'}`,
        data: p1Data,
        borderColor: '#3b82f6', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.3,
        pointRadius: 6,
        pointHoverRadius: 8
      }
    ];

    if (filters.compareProgram) {
      const p2Data = chartData.map(d => d.compare_close || null);
      if (p2Data.some(v => v !== null)) {
        datasets.push({
          label: `Compare: ${filters.compareProgram}`,
          data: p2Data,
          borderColor: '#a855f7', // Purple
          backgroundColor: 'rgba(168, 85, 247, 0.5)',
          tension: 0.3,
          pointRadius: 6,
          pointHoverRadius: 8
        });
     }
    }

    return {
      labels: labels,
      datasets: datasets
    };
  }, [chartData, filters.program, filters.compareProgram]);

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { color: '#f8fafc' } },
      title: { 
        display: true, 
        text: 'Closing Rank vs Round (2025)', 
        color: '#f8fafc',
        font: { size: 16 }
      },
      tooltip: {
        callbacks: {
          label: (context) => `Closing Rank: ${context.parsed.y ? context.parsed.y.toLocaleString() : 'N/A'}`
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
          <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--glass-border)', marginBottom: '2rem' }}>
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
                  <th style={{ padding: '1rem', color: 'var(--text-primary)' }}>Primary Open</th>
                  <th style={{ padding: '1rem', color: 'var(--text-primary)' }}>Primary Close</th>
                  {filters.compareProgram && <th style={{ padding: '1rem', color: 'var(--text-primary)' }}>Compare Open</th>}
                  {filters.compareProgram && <th style={{ padding: '1rem', color: 'var(--text-primary)' }}>Compare Close</th>}
                  {filters.compareProgram && <th style={{ padding: '1rem', color: 'var(--text-primary)' }}>Better</th>}
                </tr>
              </thead>
              <tbody>
                {chartData.map((row, idx) => {
                  let better = "-";
                  if (filters.compareProgram) {
                    const pc = row.primary_close;
                    const cc = row.compare_close;
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
                      <td style={{ padding: '1rem' }}>{row.primary_open ? row.primary_open.toLocaleString() : '-'}</td>
                      <td style={{ padding: '1rem', color: '#60a5fa', fontWeight: 'bold' }}>{row.primary_close ? row.primary_close.toLocaleString() : '-'}</td>
                      
                      {filters.compareProgram && <td style={{ padding: '1rem' }}>{row.compare_open ? row.compare_open.toLocaleString() : '-'}</td>}
                      {filters.compareProgram && <td style={{ padding: '1rem', color: '#c084fc', fontWeight: 'bold' }}>{row.compare_close ? row.compare_close.toLocaleString() : '-'}</td>}
                      
                      {filters.compareProgram && (
                        <td style={{ padding: '1rem' }}>
                          {better === "Primary" && <span style={{ background: 'rgba(59, 130, 246, 0.2)', color: '#60a5fa', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>Primary ✓</span>}
                          {better === "Compare" && <span style={{ background: 'rgba(168, 85, 247, 0.2)', color: '#c084fc', padding: '0.25rem 0.5rem', borderRadius: '4px', fontSize: '0.85rem', fontWeight: 'bold' }}>Compare ✓</span>}
                          {better === "Tie" && <span style={{ color: 'var(--text-secondary)' }}>Tie</span>}
                          {better === "-" && <span>-</span>}
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
