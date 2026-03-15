import React, { useState } from 'react';

const CollegeExplorer = ({ allCutoffs, uniqueInstitutes }) => {
  const [selectedInstitutes, setSelectedInstitutes] = useState(['', '', '']); // Up to 3 colleges
  const [loading, setLoading] = useState(false);
  
  const baselineYear = 2024;
  const baselineRound = 1;

  const handleInstituteChange = (index, value) => {
    const newInstitutes = [...selectedInstitutes];
    newInstitutes[index] = value;
    setSelectedInstitutes(newInstitutes);
  };

  const getCollegeData = (instituteName) => {
    if (!instituteName) return null;
    const filtered = allCutoffs.filter(row => {
      const rInst = (row.institute || "").trim().toLowerCase();
      return (
          rInst === instituteName.trim().toLowerCase() &&
          String(row.year) === String(baselineYear) &&
          String(row.round) === String(baselineRound)
      );
    });

    if (filtered.length === 0) return { name: instituteName, branches: 0, range: "N/A", programs: [] };

    let minRank = Infinity;
    let maxRank = 0;
    let sumRank = 0;
    let countRank = 0;
    
    // Sort by program name then category
    filtered.sort((a, b) => {
      const pDiff = (a.program || "").localeCompare(b.program || "");
      if (pDiff !== 0) return pDiff;
      return (a.category || "").localeCompare(b.category || "");
    });

    filtered.forEach(row => {
      const oRank = parseInt((row.opening_rank || "").toString().replace(/,/g, ''));
      const cRank = parseInt((row.closing_rank || "").toString().replace(/,/g, ''));
      if (oRank && oRank < minRank) minRank = oRank;
      if (cRank && cRank > maxRank) maxRank = cRank;
      if (cRank && !isNaN(cRank)) {
        sumRank += cRank;
        countRank++;
      }
    });

    return {
      name: instituteName,
      branches: new Set(filtered.map(r => r.program)).size,
      minRank: minRank === Infinity ? '-' : minRank.toLocaleString(),
      maxRank: maxRank === 0 ? '-' : maxRank.toLocaleString(),
      avgRank: countRank === 0 ? '-' : Math.floor(sumRank / countRank).toLocaleString(),
      programs: filtered
    };
  };

  const comparisonData = selectedInstitutes.map(inst => getCollegeData(inst));

  return (
    <div className="glass-container analytics-container">
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>College Comparison Explorer</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Select up to 3 colleges to compare their branches offered and rank ranges (Round {baselineRound}, {baselineYear}).
      </p>

      <div className="filter-grid" style={{ marginBottom: '2rem' }}>
        {[0, 1, 2].map(index => (
          <div className="filter-group" key={index}>
            <label>College {index + 1}</label>
            <select value={selectedInstitutes[index]} onChange={(e) => handleInstituteChange(index, e.target.value)}>
              <option value="">-- Select or Leave Blank --</option>
              {uniqueInstitutes.map((inst, i) => <option key={i} value={inst}>{inst}</option>)}
            </select>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
        {comparisonData.map((data, idx) => {
          if (!data) return null;
          return (
            <div key={idx} className="glass-container" style={{ padding: '1.5rem', background: 'rgba(255,255,255,0.02)' }}>
              <h3 style={{ color: 'var(--text-primary)', marginBottom: '1rem', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '1rem' }}>
                {data.name}
              </h3>
              
              {data.programs.length === 0 ? (
                <p style={{ color: 'var(--text-secondary)' }}>No cutoff data found for this period.</p>
              ) : (
                <>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
                    <div style={{ flex: '1 1 auto', minWidth: '100px', padding: '1rem', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Branches</span>
                      <strong style={{ fontSize: '1.25rem', color: '#60a5fa' }}>{data.branches}</strong>
                    </div>
                    <div style={{ flex: '2 1 auto', minWidth: '160px', padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '8px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Rank Range</span>
                      <strong style={{ fontSize: '1rem', color: '#34d399' }}>{data.minRank} - {data.maxRank}</strong>
                    </div>
                    <div style={{ flex: '1 1 auto', minWidth: '100px', padding: '1rem', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '8px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>
                      <span style={{ display: 'block', fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase' }}>Avg Run Rate</span>
                      <strong style={{ fontSize: '1rem', color: '#fbbf24' }}>{data.avgRank}</strong>
                    </div>
                  </div>

                  <h4 style={{ color: 'var(--text-secondary)', marginBottom: '1rem', fontSize: '0.9rem', textTransform: 'uppercase' }}>Branch Cutoffs</h4>
                  <div style={{ maxHeight: '400px', overflowY: 'auto', paddingRight: '0.5rem' }} className="custom-scrollbar">
                    {data.programs.map((prog, pIdx) => (
                      <div key={pIdx} style={{ padding: '0.75rem', borderBottom: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                        <div>
                          <p style={{ margin: 0, color: 'var(--text-primary)', fontSize: '0.9rem', fontWeight: '500' }}>{prog.program}</p>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{prog.category} | {prog.quota}</span>
                        </div>
                        <strong style={{ color: 'var(--text-primary)', fontSize: '0.9rem' }}>{prog.closing_rank?.toLocaleString()}</strong>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default CollegeExplorer;
