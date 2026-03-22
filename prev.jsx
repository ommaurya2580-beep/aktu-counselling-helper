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
    <div className="cc-chip">
      <span>{college.college}</span>
      <button
        className="cc-chip-remove"
        onClick={() => onRemove(college.college)}
        title="Remove"
        aria-label={`Remove ${college.college}`}
      >×</button>
    </div>
  );
}

function StatRow({ label, values, highlight, formatter = v => v }) {
  const nums = values.map(v => (typeof v === 'number' ? v : NaN));
  const validNums = nums.filter(n => !isNaN(n) && n > 0);
  const best  = validNums.length ? Math.max(...validNums) : null;
  const worst = validNums.length ? Math.min(...validNums) : null;
  // For fees/rank: lower is better (highlight === 'low')
  const bestVal  = highlight === 'low' ? worst : best;
  const worstVal = highlight === 'low' ? best  : worst;

  return (
    <tr className="cc-stat-row">
      <td className="cc-stat-label">{label}</td>
      {values.map((v, i) => {
        const isNum = typeof nums[i] === 'number' && !isNaN(nums[i]);
        const isBest  = isNum && validNums.length > 1 && nums[i] === bestVal;
        const isWorst = isNum && validNums.length > 1 && nums[i] === worstVal && bestVal !== worstVal;
        return (
          <td
            key={i}
            className={`cc-stat-val ${isBest ? 'cc-best' : ''} ${isWorst ? 'cc-worst' : ''}`}
          >
            {formatter(v)}
          </td>
        );
      })}
      {/* Pad empty columns if < 3 selected */}
      {Array.from({ length: MAX_SELECTED - values.length }).map((_, i) => (
        <td key={`empty-${i}`} className="cc-stat-val cc-empty-col" />
      ))}
    </tr>
  );
}

function ComparisonCard({ college, rank }) {
  return (
    <div className="cc-card" style={{ borderColor: RANK_COLORS[rank] }}>
      <div className="cc-card-rank" style={{ color: RANK_COLORS[rank] }}>
        {RANK_LABELS[rank]}
      </div>
      <div className="cc-card-score">
        Score: <strong>{(college.score * 100).toFixed(1)}</strong>
      </div>
      <div className="cc-card-name">{college.college}</div>
      <div className="cc-card-meta">
        <span className={`cc-badge ${college.type === 'Government' ? 'cc-badge-gov' : 'cc-badge-pvt'}`}>
          {college.type}
        </span>
        <span className="cc-badge cc-badge-loc">📍 {college.location}</span>
      </div>
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
    <div className="loader-container">
      <div className="loader" />
    </div>
  );

  if (error) return (
    <div className="glass-container" style={{ color: '#f87171', textAlign: 'center' }}>
      ⚠️ Failed to load college data: {error}
    </div>
  );

  const fmt  = n => typeof n === 'number' && n ? n.toLocaleString() : '—';
  const fmtL = n => typeof n === 'number' && n ? `${n} LPA` : '—';
  const fmtP = n => typeof n === 'number' && n ? `${n}%` : '—';

  return (
    <div className="cc-page">
      {/* ── Header ── */}
      <div className="cc-header glass-container">
        <h2 className="cc-title">⚖️ College Comparison</h2>
        <p className="cc-subtitle">
          Compare up to 3 AKTU colleges side-by-side with smart AI-weighted scoring
        </p>

        {/* Search box */}
        <div className="cc-search-wrapper" ref={searchRef}>
          <div className="cc-search-row">
            <input
              id="cc-search-input"
              type="text"
              className="cc-search-input"
              placeholder={
                selectedColleges.length >= MAX_SELECTED
                  ? '✅ Maximum 3 colleges selected'
                  : '🔍 Search college name…'
              }
              value={searchQuery}
              disabled={selectedColleges.length >= MAX_SELECTED}
              onChange={e => { setSearchQuery(e.target.value); setDropdownOpen(true); }}
              onFocus={() => setDropdownOpen(true)}
              autoComplete="off"
            />
            {selectedColleges.length > 0 && (
              <button className="cc-clear-btn" onClick={clearAll} title="Clear all">
                Clear all
              </button>
            )}
          </div>

          {/* Dropdown */}
          {dropdownOpen && filteredList.length > 0 && (
            <ul className="cc-dropdown" role="listbox">
              {filteredList.map(c => (
                <li
                  key={c.college}
                  className="cc-dropdown-item"
                  role="option"
                  onClick={() => addCollege(c)}
                >
                  <span className="cc-dropdown-name">{c.college}</span>
                  <span className="cc-dropdown-meta">
                    {c.location} · {c.type}
                  </span>
                </li>
              ))}
            </ul>
          )}

          {dropdownOpen && debouncedQ && filteredList.length === 0 && (
            <div className="cc-dropdown cc-no-results">No colleges found for "{debouncedQ}"</div>
          )}
        </div>

        {/* Selected chips */}
        {selectedColleges.length > 0 && (
          <div className="cc-chips">
            {selectedColleges.map(c => (
              <Chip key={c.college} college={c} onRemove={removeCollege} />
            ))}
            <span className="cc-chips-hint">
              {MAX_SELECTED - selectedColleges.length > 0
                ? `+ ${MAX_SELECTED - selectedColleges.length} more`
                : '✅ Max reached'}
            </span>
          </div>
        )}

        {selectedColleges.length === 0 && (
          <p className="cc-empty-hint">
            Search and select 2–3 colleges to start comparing
          </p>
        )}
      </div>

      {/* ── Score Cards ── */}
      {rankedSelection.length >= 2 && (
        <div className="cc-score-cards">
          {rankedSelection.map((c, i) => (
            <ComparisonCard key={c.college} college={c} rank={i} />
          ))}
        </div>
      )}

      {/* ── Comparison Table ── */}
      {rankedSelection.length >= 1 && (
        <div className="cc-table-wrapper glass-container">
          <table className="cc-table">
            <thead>
              <tr>
                <th className="cc-th-label">Metric</th>
                {rankedSelection.map(c => (
                  <th key={c.college} className="cc-th-college">
                    <div className="cc-th-name">{c.college}</div>
                    <div className="cc-th-sub">{c.location} · {c.type}</div>
                  </th>
                ))}
                {/* Empty header cells to keep grid stable */}
                {Array.from({ length: MAX_SELECTED - rankedSelection.length }).map((_, i) => (
                  <th key={`ph-${i}`} className="cc-th-college cc-th-empty">—</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <StatRow
                label="Avg Package"
                values={rankedSelection.map(c => c.avg_package)}
                highlight="high"
                formatter={fmtL}
              />
              <StatRow
                label="Highest Package"
                values={rankedSelection.map(c => c.highest_package)}
                highlight="high"
                formatter={fmtL}
              />
              <StatRow
                label="Placement %"
                values={rankedSelection.map(c => c.placement)}
                highlight="high"
                formatter={fmtP}
              />
              <StatRow
                label="Yearly Fees (Min)"
                values={rankedSelection.map(c => c.fees_min)}
                highlight="low"
                formatter={v => v ? `₹${v.toLocaleString()}` : '—'}
              />
              <StatRow
                label="Yearly Fees (Max)"
                values={rankedSelection.map(c => c.fees_max)}
                highlight="low"
                formatter={v => v ? `₹${v.toLocaleString()}` : '—'}
              />
              <StatRow
                label="Total Fees"
                values={rankedSelection.map(c => c.total_fees)}
                highlight="low"
                formatter={v => v ? `₹${v.toLocaleString()}` : '—'}
              />
              <StatRow
                label="Opening Rank (CSE)"
                values={rankedSelection.map(c => c.opening_rank)}
                highlight="low"
                formatter={v => v ? `~${v.toLocaleString()}` : '—'}
              />
              <StatRow
                label="Closing Rank (CSE)"
                values={rankedSelection.map(c => c.closing_rank)}
                highlight="low"
                formatter={v => v ? `~${v.toLocaleString()}` : '—'}
              />
              <StatRow
                label="NAAC Grade"
                values={rankedSelection.map(c => c.naac)}
                highlight="none"
              />
              <StatRow
                label="NBA Accreditation"
                values={rankedSelection.map(c => c.nba)}
                highlight="none"
              />
              <tr className="cc-stat-row cc-companies-row">
                <td className="cc-stat-label">Top Recruiters</td>
                {rankedSelection.map(c => (
                  <td key={c.college} className="cc-stat-val cc-companies-cell">
                    {c.companies.slice(0, 5).map(co => (
                      <span key={co} className="cc-company-tag">{co}</span>
                    ))}
                    {c.companies.length > 5 && (
                      <span className="cc-company-more">+{c.companies.length - 5} more</span>
                    )}
                  </td>
                ))}
                {Array.from({ length: MAX_SELECTED - rankedSelection.length }).map((_, i) => (
                  <td key={`ec-${i}`} className="cc-stat-val cc-empty-col" />
                ))}
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* ── Algorithm info ── */}
      {rankedSelection.length >= 2 && (
        <div className="cc-algo-info glass-container">
          <h4>📊 Scoring Algorithm</h4>
          <div className="cc-algo-grid">
            <div className="cc-algo-item"><span className="cc-algo-w">35%</span> Avg Package</div>
            <div className="cc-algo-item"><span className="cc-algo-w">25%</span> Placement %</div>
            <div className="cc-algo-item"><span className="cc-algo-w">20%</span> Highest Package</div>
            <div className="cc-algo-item"><span className="cc-algo-w">10%</span> Rank (lower = better)</div>
            <div className="cc-algo-item"><span className="cc-algo-w">10%</span> Fees (lower = better)</div>
          </div>
          <p className="cc-algo-note">
            All metrics normalized against the full dataset of {colleges.length} colleges.
          </p>
        </div>
      )}
    </div>
  );
}
