/**
 * rename-to-2026.js — Step 1
 * Reads public/cutoffs.min.json, sets year = "2026" on every record,
 * saves result to public/cutoffs_2026.json (does NOT overwrite original).
 */

const fs   = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, 'public', 'cutoffs.min.json');
const OUTPUT = path.join(__dirname, 'public', 'cutoffs_2026.json');

// ── Load ──────────────────────────────────────────────────────────────────────
let data;
try {
  data = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
  console.log(`✅  Loaded ${data.length} records from cutoffs.min.json\n`);
} catch (err) {
  console.error('❌  Cannot read/parse input:', err.message);
  process.exit(1);
}

// ── Remap ─────────────────────────────────────────────────────────────────────
const updated = data.map(item => ({
  ...item,
  year:      '2026',   // overwrite year field
  year_norm: '2026',   // set pre-computed norm too (if App.jsx uses it)
}));

// ── Verify sample ─────────────────────────────────────────────────────────────
console.log('='.repeat(55));
console.log('SAMPLE (first 3 updated records)');
console.log('='.repeat(55));
for (let i = 0; i < Math.min(3, updated.length); i++) {
  const { year, year_norm, round, institute, program, closing_rank } = updated[i];
  console.log(JSON.stringify({ year, year_norm, round, institute, program, closing_rank }, null, 2));
}

// ── Round distribution (sanity check) ────────────────────────────────────────
const roundCounts = {};
for (const r of updated) {
  const k = String(r.round ?? 'MISSING');
  roundCounts[k] = (roundCounts[k] || 0) + 1;
}
const sorted = Object.entries(roundCounts).sort((a, b) => b[1] - a[1]);
console.log('\nRound distribution in updated dataset:');
for (const [round, cnt] of sorted) {
  console.log(`  "${round}"  →  ${cnt}`);
}

// ── Write output ──────────────────────────────────────────────────────────────
try {
  fs.writeFileSync(OUTPUT, JSON.stringify(updated), 'utf-8'); // minified
  console.log(`\n✅  Written ${updated.length} records → public/cutoffs_2026.json`);
  console.log('    Original cutoffs.min.json is UNCHANGED.');
  console.log('\nDone. Share the output above, then we proceed to Step 2.');
} catch (err) {
  console.error('❌  Write error:', err.message);
  process.exit(1);
}
