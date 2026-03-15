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

const CutoffAnalytics = ({ allCutoffs, uniqueInstitutes, uniquePrograms, uniqueCategories }) => {
  const [filters, setFilters] = useState({
    institute: '',
    program: '',
    compareProgram: '',
    category: '',
    round: '1', // default compare round 1
  });
  
  const [chartData, setChartData] = useState([]);
  const [compareData, setCompareData] = useState([]); // For comparing branches
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const fetchAnalyticsData = () => {
    if (!filters.institute || !filters.program || !filters.category) {
      setError("Please select an Institute, Program, and Category to view trends.");
      return;
    }
    setLoading(true);
    setError(null);
    setChartData([]);

    try {
      // Filter for the selected round and multiple years from the full JSON dataset
      const years = ["2021", "2022", "2023", "2024", "2025"];
      const roundMatches = allCutoffs.filter(row => 
          String(row.round) === String(filters.round) && 
          years.includes(String(row.year))
      );

      // Normalize and filter locally for program 1
      const p1Cutoffs = roundMatches.filter(row => {
        const rInst = (row.institute || "").trim().toLowerCase();
        const rProg = (row.program || "").trim().toLowerCase();
        const rCat = (row.category || "").trim();
        return rInst === filters.institute.toLowerCase() &&
               rProg === filters.program.toLowerCase() &&
               rCat === filters.category;
      });

      // Normalize and filter locally for program 2
      const p2Cutoffs = filters.compareProgram ? roundMatches.filter(row => {
        const rInst = (row.institute || "").trim().toLowerCase();
        const rProg = (row.program || "").trim().toLowerCase();
        const rCat = (row.category || "").trim();
        return rInst === filters.institute.toLowerCase() &&
               rProg === filters.compareProgram.toLowerCase() &&
               rCat === filters.category;
      }) : [];

      // Sort by year
      p1Cutoffs.sort((a, b) => parseInt(a.year) - parseInt(b.year));
      p2Cutoffs.sort((a, b) => parseInt(a.year) - parseInt(b.year));
      
      if (p1Cutoffs.length === 0 && p2Cutoffs.length === 0) {
        setError("No historical data found for this exact combination.");
      } else {
        setChartData(p1Cutoffs);
        setCompareData(p2Cutoffs);
      }
    } catch (err) {
      console.error("Error fetching analytics:", err);
      setError("Failed to fetch historical data.");
    } finally {
      setLoading(false);
    }
  };

  const lineChartData = useMemo(() => {
    const allYears = Array.from(new Set([
        ...chartData.map(d => d.year),
        ...compareData.map(d => d.year)
    ])).sort((a, b) => parseInt(a) - parseInt(b));

    const p1Data = allYears.map(year => {
        const match = chartData.find(d => d.year == year);
        return match ? (parseInt(match.closing_rank) || parseInt(match.closing_rank?.toString().replace(/,/g, ''))) : null;
    });

    const datasets = [
      {
        label: filters.program || 'Primary Program',
        data: p1Data,
        borderColor: 'rgb(59, 130, 246)', // Blue
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        tension: 0.3,
        pointRadius: 6,
        pointHoverRadius: 8
      }
    ];

    if (compareData.length > 0) {
        const p2Data = allYears.map(year => {
            const match = compareData.find(d => d.year == year);
            return match ? (parseInt(match.closing_rank) || parseInt(match.closing_rank?.toString().replace(/,/g, ''))) : null;
        });
        datasets.push({
            label: filters.compareProgram || 'Compare Program',
            data: p2Data,
            borderColor: 'rgb(245, 158, 11)', // Orange
            backgroundColor: 'rgba(245, 158, 11, 0.5)',
            tension: 0.3,
            pointRadius: 6,
            pointHoverRadius: 8
        });
    }

    return {
      labels: allYears,
      datasets: datasets
    };
  }, [chartData, compareData, filters.program, filters.compareProgram]);

  const lineChartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top', labels: { color: '#f8fafc' } },
      title: { 
        display: true, 
        text: 'Closing Rank vs Year', 
        color: '#f8fafc',
        font: { size: 16 }
      },
      tooltip: {
        callbacks: {
          label: (context) => `Closing Rank: ${context.parsed.y.toLocaleString()}`
        }
      }
    },
    scales: {
      y: {
        reverse: true, // Lower rank is better, so it goes higher up on the visual chart
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
          <label>Institute name</label>
          <select name="institute" value={filters.institute} onChange={handleFilterChange}>
            <option value="">Select Institute</option>
            {uniqueInstitutes.map((inst, i) => <option key={i} value={inst}>{inst}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Primary Program</label>
          <select name="program" value={filters.program} onChange={handleFilterChange}>
            <option value="">Select Program</option>
            {uniquePrograms.map((prog, i) => <option key={i} value={prog}>{prog}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Compare With (Optional)</label>
          <select name="compareProgram" value={filters.compareProgram} onChange={handleFilterChange}>
            <option value="">Select Program to Compare</option>
            {uniquePrograms.map((prog, i) => <option key={i} value={prog}>{prog}</option>)}
          </select>
        </div>
        <div className="filter-group">
          <label>Category</label>
          <select name="category" value={filters.category} onChange={handleFilterChange}>
            <option value="">Select Category</option>
            {uniqueCategories.map((cat, i) => <option key={i} value={cat}>{cat}</option>)}
          </select>
        </div>
        <div className="filter-group">
           <label>Round</label>
           <select name="round" value={filters.round} onChange={handleFilterChange}>
             {[1, 2, 3, 4, 5, 6].map(r => <option key={r} value={r}>Round {r}</option>)}
           </select>
        </div>
      </div>

      <button className="search-btn" onClick={fetchAnalyticsData} disabled={loading} style={{ marginBottom: '2rem' }}>
        {loading ? "Generating Chart..." : "Analyze Trends"}
      </button>

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171', borderRadius: '8px', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {(chartData.length > 0 || compareData.length > 0) && (
        <div style={{ background: 'rgba(15, 23, 42, 0.6)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
            <Line options={lineChartOptions} data={lineChartData} />
            <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
              Note: Higher placement on the graph means a more competitive (numerically lower) rank.
            </p>
        </div>
      )}
    </div>
  );
};

export default CutoffAnalytics;
