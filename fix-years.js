/**
 * fix-years.js — Step 2: Year correction script
 *
 * Rule (UPTAC pattern):
 *   round contains "special" | "spot" | "mop-up" | "mopup"  → year = "2025"
 *   everything else                                           → year = "2024"
 *
 * Outputs:
 *   public/cutoffs_2024.json   — 2024-only records
 *   public/cutoffs_2025.json   — 2025-only records
 *   public/cutoffs.min.json    — merged, sorted (year asc, then institute asc)
 */

const fs   = require('fs');
const path = require('path');

const BASE   = path.join(__dirname, 'public');
const INPUT  = path.join(BASE, 'cutoffs.min.json');
const OUT_24 = path.join(BASE, 'cutoffs_2024.json');
const OUT_25 = path.join(BASE, 'cutoffs_2025.json');
const OUT_ALL = INPUT; // overwrite original with corrected+sorted data

// ── Load ──────────────────────────────────────────────────────────────────────
let data;
try {
  data = JSON.parse(fs.readFileSync(INPUT, 'utf-8'));
  console.log(`✅  Loaded ${data.length} records\n`);
} catch (err) {
  console.error('❌  Cannot read/parse input:', err.message);
  process.exit(1);
}

// ── Classification helper ─────────────────────────────────────────────────────
const IS_2025_ROUND = /special|spot|mop-?up/i;

function classifyYear(item) {
  const round = String(item.round ?? '').trim();
  return IS_2025_ROUND.test(round) ? '2025' : '2024';
}

// ── Apply correction ──────────────────────────────────────────────────────────
let changed = 0;
const examples2025 = [];

const corrected = data.map(item => {
  const correctYear = classifyYear(item);
  const prev = String(item.year ?? '');

  if (String(correctYear) !== prev) {
    changed++;
    if (examples2025.length < 5) {
      examples2025.push({
        was: prev,
        now: correctYear,
        round: item.round,
        institute: item.institute,
        program: item.program,
        closing_rank: item.closing_rank,
      });
    }
  }

  return { ...item, year: correctYear };
});

// ── Split ─────────────────────────────────────────────────────────────────────
const data2024 = corrected.filter(r => r.year === '2024');
const data2025 = corrected.filter(r => r.year === '2025');

// ── Sort merged: year asc → institute asc ─────────────────────────────────────
const sorted = [...corrected].sort((a, b) => {
  if (a.year < b.year) return -1;
  if (a.year > b.year) return  1;
  return String(a.institute ?? '').localeCompare(String(b.institute ?? ''));
});

// ── Write outputs ──────────────────────────────────────────────────────────────
try {
  fs.writeFileSync(OUT_24,  JSON.stringify(data2024, null, 2), 'utf-8');
  fs.writeFileSync(OUT_25,  JSON.stringify(data2025, null, 2), 'utf-8');
  fs.writeFileSync(OUT_ALL, JSON.stringify(sorted,   null, 0), 'utf-8'); // minified
  console.log('✅  Files written successfully\n');
} catch (err) {
  console.error('❌  Write error:', err.message);
  process.exit(1);
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('='.repeat(55));
console.log('CORRECTION SUMMARY');
console.log('='.repeat(55));
console.log(`  Total records      : ${data.length}`);
console.log(`  Records changed    : ${changed}  (year "2024" → "2025")`);
console.log(`  2024 records now   : ${data2024.length}`);
console.log(`  2025 records now   : ${data2025.length}`);
console.log();

// ── Round distribution per corrected year ─────────────────────────────────────
for (const [label, arr] of [['2024', data2024], ['2025', data2025]]) {
  const roundMap = {};
  for (const r of arr) {
    const k = String(r.round ?? 'MISSING');
    roundMap[k] = (roundMap[k] || 0) + 1;
  }
  const sorted = Object.entries(roundMap).sort((a, b) => b[1] - a[1]);
  console.log(`  Rounds in year ${label}:`);
  for (const [round, cnt] of sorted) {
    console.log(`    "${round}"  →  ${cnt}`);
  }
  console.log();
}

// ── Sample changed records ────────────────────────────────────────────────────
if (examples2025.length > 0) {
  console.log('='.repeat(55));
  console.log(`SAMPLE CHANGED RECORDS (first ${examples2025.length})`);
  console.log('='.repeat(55));
  examples2025.forEach((ex, i) => {
    console.log(`  [${i + 1}] ${JSON.stringify(ex, null, 2).split('\n').join('\n  ')}`);
  });
} else {
  console.log('ℹ️   No records changed — all were already correct, or no "special/spot/mop-up" rounds found.');
  console.log('    Check your round values — share the output of check-years.js if unexpected.');
}

console.log('\nDone ✅');
