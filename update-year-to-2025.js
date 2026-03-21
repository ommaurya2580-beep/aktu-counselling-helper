/**
 * update-year-to-2025.js — Step 1
 * Sets year = "2025" on ALL records, saves to public/cutoffs_2025_all.json
 * Original cutoffs.min.json is NOT overwritten.
 */

const fs   = require('fs');
const path = require('path');

const INPUT  = path.join(__dirname, 'public', 'cutoffs.min.json');
const OUTPUT = path.join(__dirname, 'public', 'cutoffs_2025_all.json');

// ── Load ──────────────────────────────────────────────────────────────────────
let data;
try {
  data = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
  console.log(`✅  Loaded ${data.length} records\n`);
} catch (err) {
  console.error('❌  Cannot read/parse input:', err.message);
  process.exit(1);
}

// ── Remap: set all to "2025" ──────────────────────────────────────────────────
let changed = 0;
const updated = data.map(item => {
  const wasAlready2025 = String(item.year ?? '') === '2025';
  if (!wasAlready2025) changed++;
  const out = { ...item, year: '2025' };
  if ('year_norm' in item) out.year_norm = '2025';
  return out;
});

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('='.repeat(55));
console.log('SUMMARY');
console.log('='.repeat(55));
console.log(`  Total records    : ${updated.length}`);
console.log(`  Records updated  : ${changed}  (year field changed to "2025")`);
console.log(`  Already "2025"   : ${updated.length - changed}`);

// ── 3 sample records ──────────────────────────────────────────────────────────
console.log('\n3 sample updated records:');
for (let i = 0; i < Math.min(3, updated.length); i++) {
  const { year, year_norm, round, institute, program, closing_rank } = updated[i];
  console.log(JSON.stringify({ year, year_norm, round, institute, program, closing_rank }, null, 2));
}

// ── Round distribution ────────────────────────────────────────────────────────
const roundCounts = {};
for (const r of updated) {
  const k = String(r.round ?? 'MISSING');
  roundCounts[k] = (roundCounts[k] || 0) + 1;
}
const sortedRounds = Object.entries(roundCounts).sort((a, b) => b[1] - a[1]);
console.log('\nRound distribution (year=2025):');
for (const [round, cnt] of sortedRounds) {
  console.log(`  "${round}"  →  ${cnt}`);
}

// ── Write ─────────────────────────────────────────────────────────────────────
try {
  fs.writeFileSync(OUTPUT, JSON.stringify(updated), 'utf-8');
  console.log(`\n✅  Written → public/cutoffs_2025_all.json`);
  console.log('    Original cutoffs.min.json unchanged.\n');
  console.log('Share the output above and I will give Step 2 (swap + App.jsx update).');
} catch (err) {
  console.error('❌  Write error:', err.message);
  process.exit(1);
}
