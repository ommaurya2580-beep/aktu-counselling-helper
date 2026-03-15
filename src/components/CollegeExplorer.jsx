import React, { useState } from 'react';
import { collection, query, where, getDocs } from 'firebase/firestore';

const CollegeExplorer = ({ db, uniqueInstitutes }) => {
  const [selectedInstitute, setSelectedInstitute] = useState('');
  const [collegeData, setCollegeData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  
  // Hardcoded to recent baseline for general college overview
  const baselineYear = 2024;
  const baselineRound = 1;

  const fetchCollegeDetails = async (institute) => {
    if (!institute) {
      setCollegeData([]);
      return;
    }
    setLoading(true);
    setError(null);
    setCollegeData([]);

    try {
      const q = query(
        collection(db, 'cutoffs'),
        where('year', '==', baselineYear),
        where('round', '==', baselineRound)
      );

      const snapshot = await getDocs(q);
      const allRows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      // Filter locally to avoid index rules limitations
      const filtered = allRows.filter(row => {
        const rInst = (row.institute || "").trim().toLowerCase();
        return rInst === institute.trim().toLowerCase();
      });

      // Sort by program name then category
      filtered.sort((a, b) => {
        const pDiff = (a.program || "").localeCompare(b.program || "");
        if (pDiff !== 0) return pDiff;
        return (a.category || "").localeCompare(b.category || "");
      });

      if (filtered.length === 0) {
        setError(`No cutoff historical data found for ${institute} in ${baselineYear} (Round ${baselineRound}).`);
      } else {
        setCollegeData(filtered);
      }
    } catch (err) {
      console.error("Error fetching college details:", err);
      setError("Failed to fetch college details.");
    } finally {
      setLoading(false);
    }
  };

  const handleInstituteChange = (e) => {
    const val = e.target.value;
    setSelectedInstitute(val);
    fetchCollegeDetails(val);
  };

  return (
    <div className="glass-container analytics-container">
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)' }}>College Explorer</h2>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Select a college to view its offered programs and their latest round 1 baseline cutoffs (Year {baselineYear}).
      </p>

      <div className="filter-group" style={{ marginBottom: '2rem', maxWidth: '600px', margin: '0 auto 2rem auto' }}>
        <label>Select Institute</label>
        <select value={selectedInstitute} onChange={handleInstituteChange}>
          <option value="">-- Choose an Institute --</option>
          {uniqueInstitutes.map((inst, i) => <option key={i} value={inst}>{inst}</option>)}
        </select>
      </div>

      {loading && (
        <div className="loader-container" style={{ margin: '2rem 0' }}>
          <div className="loader"></div>
          <p style={{ textAlign: 'center', marginTop: '1rem', color: 'var(--text-secondary)' }}>Loading college data...</p>
        </div>
      )}

      {error && (
        <div style={{ padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#f87171', borderRadius: '8px', marginBottom: '1.5rem' }}>
          {error}
        </div>
      )}

      {collegeData.length > 0 && !loading && (
        <div>
          <h3 style={{ marginBottom: '1.5rem', color: 'var(--text-primary)', borderBottom: '1px solid var(--glass-border)', paddingBottom: '1rem' }}>
            {selectedInstitute}
          </h3>
          
          <div className="table-wrapper glass-container" style={{ padding: 0 }}>
            <table>
              <thead>
                <tr>
                  <th>Program Name</th>
                  <th>Category</th>
                  <th>Quota</th>
                  <th>Opening Rank</th>
                  <th>Closing Rank</th>
                </tr>
              </thead>
              <tbody>
                {collegeData.map((row, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: '500' }}>{row.program}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.category}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.quota}</td>
                    <td style={{ color: 'var(--text-secondary)' }}>{row.opening_rank}</td>
                    <td style={{ fontWeight: '600' }}>{row.closing_rank}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default CollegeExplorer;
