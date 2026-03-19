/**
 * rename-to-2025.js — Step 1
 * Reads public/cutoffs.min.json, sets year = "2025" on every record,
 * saves to public/cutoffs_2025_fixed.json (original is NOT overwritten).
 */

const fs   = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, 'public', 'cutoffs.min.json');
const OUTPUT = path.join(__dirname, 'public', 'cutoffs_2025_fixed.json');

// ── Load ──────────────────────────────────────────────────────────────────────
let data;
try {
  data = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
  console.log(`✅  Loaded ${data.length} records from cutoffs.min.json\n`);
} catch (err) {
  console.error('❌  Cannot read/parse input:', err.message);
  process.exit(1);
}

// ── Show BEFORE (first 3 records, year field only) ────────────────────────────
console.log('='.repeat(55));
console.log('BEFORE (year field, first 3 records)');
console.log('='.repeat(55));
for (let i = 0; i < Math.min(3, data.length); i++) {
  const { year, year_norm, round, institute, program } = data[i];
  console.log(JSON.stringify({ year, year_norm, round, institute, program }, null, 2));
}
console.log();

// ── Remap ─────────────────────────────────────────────────────────────────────
const updated = data.map(item => {
  const out = { ...item, year: '2025' };
  // Only set year_norm if the field already exists in the record
  if ('year_norm' in item) out.year_norm = '2025';
  return out;
});

// ── Show AFTER (same 3 records) ───────────────────────────────────────────────
console.log('='.repeat(55));
console.log('AFTER  (year field, first 3 records)');
console.log('='.repeat(55));
for (let i = 0; i < Math.min(3, updated.length); i++) {
  const { year, year_norm, round, institute, program } = updated[i];
  console.log(JSON.stringify({ year, year_norm, round, institute, program }, null, 2));
}
console.log();

// ── Verify all years are "2025" ───────────────────────────────────────────────
const yearDist = {};
for (const r of updated) {
  const y = String(r.year ?? 'MISSING');
  yearDist[y] = (yearDist[y] || 0) + 1;
}
console.log('Year distribution in output file:');
for (const [y, cnt] of Object.entries(yearDist)) {
  console.log(`  year="${y}"  →  ${cnt} records`);
}

// ── Round distribution (keeps all rounds intact) ──────────────────────────────
const roundCounts = {};
for (const r of updated) {
  const k = String(r.round ?? 'MISSING');
  roundCounts[k] = (roundCounts[k] || 0) + 1;
}
const sortedRounds = Object.entries(roundCounts).sort((a, b) => b[1] - a[1]);
console.log('\nRound distribution (all rounds preserved):');
for (const [round, cnt] of sortedRounds) {
  console.log(`  "${round}"  →  ${cnt}`);
}

// ── Write output ──────────────────────────────────────────────────────────────
try {
  fs.writeFileSync(OUTPUT, JSON.stringify(updated), 'utf-8'); // minified
  console.log(`\n✅  Written ${updated.length} records → public/cutoffs_2025_fixed.json`);
  console.log('    Original cutoffs.min.json is UNCHANGED.');
  console.log('\nDone ✅  Share the output above to confirm, then I give Step 2.');
} catch (err) {
  console.error('❌  Write error:', err.message);
  process.exit(1);
}
