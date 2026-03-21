/**
 * fix-dataset-year.js
 * OVERWRITES public/cutoffs.min.json — changes ALL "year": "2024" → "year": "2025"
 * Safe to run multiple times (idempotent).
 * Run: node fix-dataset-year.js
 */

const fs   = require('fs');
const path = require('path');

const FILE = path.join(__dirname, 'public', 'cutoffs.min.json');

// ── Load ──────────────────────────────────────────────────────────────────────
let data;
try {
  data = JSON.parse(fs.readFileSync(FILE, 'utf-8'));
  console.log(`Loaded ${data.length} records from cutoffs.min.json`);
} catch (err) {
  console.error('Cannot read file:', err.message);
  process.exit(1);
}

// ── Update ALL records ────────────────────────────────────────────────────────
const updated = data.map(item => ({ ...item, year: '2025' }));

// ── Validate ──────────────────────────────────────────────────────────────────
const count2024 = updated.filter(d => d.year === '2024').length;
const count2025 = updated.filter(d => d.year === '2025').length;
console.log({ count2024, count2025 });

if (count2024 !== 0) {
  console.error('ERROR: Some records still have year=2024. Aborting.');
  process.exit(1);
}

// ── Overwrite ─────────────────────────────────────────────────────────────────
fs.writeFileSync(FILE, JSON.stringify(updated), 'utf-8');
console.log(`Done. cutoffs.min.json updated: all ${count2025} records now have year="2025"`);
