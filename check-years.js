/**
 * check-years.js — Step 1 Diagnostic
 * Reads cutoffs.min.json and prints:
 *   1. Record count per year
 *   2. Round distribution per year
 *   3. 3 sample records per year group
 */

const fs = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'public', 'cutoffs.min.json');

// --- Load data ---
let data;
try {
  const raw = fs.readFileSync(FILE, 'utf-8');
  data = JSON.parse(raw);
  console.log(`✅ Loaded ${data.length} records from ${FILE}\n`);
} catch (err) {
  console.error('❌ Failed to read/parse file:', err.message);
  process.exit(1);
}

// --- Group by year ---
const byYear = {};
for (const item of data) {
  const y = String(item.year ?? 'MISSING');
  if (!byYear[y]) byYear[y] = [];
  byYear[y].push(item);
}

// --- Print year summary ---
console.log('='.repeat(60));
console.log('YEAR DISTRIBUTION');
console.log('='.repeat(60));
const yearKeys = Object.keys(byYear).sort();
for (const y of yearKeys) {
  console.log(`  year="${y}"  →  ${byYear[y].length} records`);
}
console.log();

// --- Round distribution per year ---
for (const y of yearKeys) {
  const records = byYear[y];

  // Count per round value
  const roundCounts = {};
  for (const item of records) {
    const r = String(item.round ?? 'MISSING');
    roundCounts[r] = (roundCounts[r] || 0) + 1;
  }

  // Sort by count desc
  const sorted = Object.entries(roundCounts).sort((a, b) => b[1] - a[1]);

  console.log('='.repeat(60));
  console.log(`YEAR = "${y}"  (${records.length} records)`);
  console.log('  Round distribution:');
  for (const [round, count] of sorted) {
    console.log(`    round="${round}"  →  ${count} records`);
  }

  // 3 samples
  console.log('  3 sample records:');
  for (let i = 0; i < Math.min(3, records.length); i++) {
    const { year, round, institute, program, category, quota, gender, closing_rank } = records[i];
    console.log('   ', JSON.stringify({ year, round, institute, program, category, quota, gender, closing_rank }, null, 2)
      .split('\n').join('\n    '));
  }
  console.log();
}
