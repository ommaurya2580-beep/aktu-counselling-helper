/**
 * convertColleges.js
 * Reads FINAL_FIXED_ALL_COLLEGES.csv (xlsx binary) → public/colleges.min.json
 *
 * Run: node scripts/convertColleges.js
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const INPUT  = path.join(__dirname, '..', 'src', 'FINAL_FIXED_ALL_COLLEGES.csv');
const OUTPUT = path.join(__dirname, '..', 'public', 'colleges.min.json');

// ── Helpers ────────────────────────────────────────────────────────────────

/** Strip ~, INR, LPA, extra spaces from a string */
function strip(s) {
  if (s == null) return '';
  return String(s)
    .replace(/~|INR|LPA/gi, '')
    .replace(/,(\s*)/g, ',')  // keep commas tight
    .trim();
}

/**
 * Parse "70000-85000" or "70000" or "~70000" → pick the average (or the single number).
 * Returns 0 if unparseable.
 */
function parseRange(raw) {
  if (raw == null || raw === '') return 0;
  const s = strip(raw).replace(/\s+/g, '');
  const parts = s.split('-').map(p => parseFloat(p)).filter(n => !isNaN(n));
  if (parts.length === 0) return 0;
  if (parts.length === 1) return parts[0];
  return Math.round((parts[0] + parts[1]) / 2);
}

/**
 * Parse percentage like "~70%", "70-80%", "~80-90%" → average number
 */
function parsePct(raw) {
  if (raw == null) return 0;
  const s = String(raw).replace(/~|%/g, '').trim();
  return parseRange(s);
}

/**
 * Clean the location string: strip " (~320 km from Varanasi)" etc.
 */
function cleanLocation(raw) {
  if (!raw) return '';
  return String(raw).replace(/\s*\(~?\d+\s*km[^)]*\)/gi, '').trim();
}

/**
 * Parse "Google, Microsoft, ..." into an array of strings.
 */
function parseCompanies(raw) {
  if (!raw) return [];
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

// ── Main ───────────────────────────────────────────────────────────────────

console.log('[convertColleges] Reading:', INPUT);
if (!fs.existsSync(INPUT)) {
  console.error('ERROR: Input file not found:', INPUT);
  process.exit(1);
}

const workbook = XLSX.readFile(INPUT);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// header:1 → first row is header array, rest are data rows
const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

const HEADER_ROW = 1; // row index 1 is the real header (row 0 == row 1 == same in this file)
const DATA_START = 2; // data starts at row index 2

const HEADERS = rawRows[HEADER_ROW]; // column labels

const colleges = [];

for (let i = DATA_START; i < rawRows.length; i++) {
  const row = rawRows[i];
  if (!row || !row[1]) continue; // skip empty rows (no college name)

  const college     = String(row[1] || '').trim();
  const location    = cleanLocation(String(row[2] || ''));
  const affiliation = String(row[3] || '').trim();
  const autonomous  = String(row[4] || '').trim();
  const type        = String(row[5] || '').trim();
  const naac        = String(row[6] || '').trim() || 'NA';
  const nba         = String(row[7] || '').trim() || 'NA';

  const fees_raw       = strip(String(row[8]  || ''));
  const total_fees_raw = strip(String(row[9]  || ''));
  const avg_pkg_raw    = strip(String(row[10] || ''));
  const high_pkg_raw   = strip(String(row[11] || ''));
  const placement_raw  = String(row[12] || '');
  const companies_raw  = String(row[13] || '');
  const opening_raw    = strip(String(row[14] || ''));
  const closing_raw    = strip(String(row[15] || ''));

  // ── Parse numeric fields ─────────────────────────────────────────────
  const fees_avg      = parseRange(fees_raw);       // yearly tuition (avg of range)
  const total_fees    = parseRange(total_fees_raw);
  const avg_package   = parseRange(avg_pkg_raw);    // in LPA
  const highest_package = parseRange(high_pkg_raw); // in LPA
  const placement     = parsePct(placement_raw);    // %
  const opening_rank  = parseRange(opening_raw);
  const closing_rank  = parseRange(closing_raw);

  const obj = {
    college,
    college_lower: college.toLowerCase(),
    location,
    location_lower: location.toLowerCase(),
    type,
    affiliation,
    autonomous,
    naac,
    nba,
    fees_min: (() => {
      const parts = fees_raw.split('-').map(p => parseFloat(p)).filter(n => !isNaN(n));
      return parts.length ? parts[0] : 0;
    })(),
    fees_max: (() => {
      const parts = fees_raw.split('-').map(p => parseFloat(p)).filter(n => !isNaN(n));
      return parts.length > 1 ? parts[1] : (parts[0] || 0);
    })(),
    total_fees,
    avg_package,
    highest_package,
    placement,
    companies: parseCompanies(companies_raw),
    opening_rank,
    closing_rank,
  };

  colleges.push(obj);
}

// ── Output ─────────────────────────────────────────────────────────────────
const json = JSON.stringify(colleges);
fs.writeFileSync(OUTPUT, json, 'utf8');
const sizeKB = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(1);

console.log(`[convertColleges] ✅ Wrote ${colleges.length} colleges → ${OUTPUT}`);
console.log(`[convertColleges]    Size: ${sizeKB} KB`);
