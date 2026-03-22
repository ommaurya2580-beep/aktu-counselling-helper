/**
 * convertColleges.js  v2
 * Reads FINAL_FIXED_ALL_COLLEGES.csv (xlsx binary)
 * Computes: roi, naac_score, type_score, location_score, final_score
 * Outputs:  public/colleges.min.json
 *
 * Run: node scripts/convertColleges.js
 */

import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

const INPUT  = path.join(__dirname, '..', 'src', 'FINAL_FIXED_ALL_COLLEGES.csv');
const OUTPUT = path.join(__dirname, '..', 'public', 'colleges.min.json');

// ── Helpers ─────────────────────────────────────────────────────────────────

function strip(s) {
  if (s == null) return '';
  return String(s).replace(/~|INR|LPA/gi, '').replace(/,(\s*)/g, ',').trim();
}

function parseRange(raw) {
  if (raw == null || raw === '') return 0;
  const s = strip(raw).replace(/\s+/g, '');
  const parts = s.split('-').map(p => parseFloat(p)).filter(n => !isNaN(n));
  if (!parts.length) return 0;
  if (parts.length === 1) return parts[0];
  return Math.round((parts[0] + parts[1]) / 2);
}

function parsePct(raw) {
  if (raw == null) return 0;
  return parseRange(String(raw).replace(/~|%/g, '').trim());
}

/** Extract distance in km from location string like "Lucknow (~320 km from Varanasi)" */
function parseDistanceKm(rawLocation) {
  const m = String(rawLocation).match(/~?(\d+)\s*km/i);
  return m ? parseInt(m[1]) : 500; // default 500 when unknown
}

function cleanLocation(raw) {
  if (!raw) return '';
  return String(raw).replace(/\s*\(~?\d+\s*km[^)]*\)/gi, '').trim();
}

function parseCompanies(raw) {
  if (!raw) return [];
  return String(raw).split(',').map(s => s.trim()).filter(Boolean);
}

// ── Scoring helpers ──────────────────────────────────────────────────────────

function getNaacScore(grade) {
  const g = (grade || '').trim().toUpperCase().replace(/\s+/g, '');
  if (g === 'A++') return 100;
  if (g === 'A+')  return 90;
  if (g === 'A')   return 80;
  if (g.includes('B')) return 60; // B, B+, B++
  return 40; // NA or unknown
}

function getTypeScore(type) {
  return (type || '').trim().toLowerCase() === 'government' ? 100 : 70;
}

function getLocationScore(distKm) {
  if (distKm < 100) return 100;
  if (distKm < 300) return 80;
  if (distKm < 600) return 60;
  return 40;
}

function normalize(val, min, max) {
  if (max === min) return 50;
  return ((val - min) / (max - min)) * 100;
}

// ── Main ─────────────────────────────────────────────────────────────────────

console.log('[convertColleges] Reading:', INPUT);
if (!fs.existsSync(INPUT)) {
  console.error('ERROR: Input file not found:', INPUT);
  process.exit(1);
}

const workbook  = XLSX.readFile(INPUT);
const sheet     = workbook.Sheets[workbook.SheetNames[0]];
const rawRows   = XLSX.utils.sheet_to_json(sheet, { header: 1 });
const DATA_START = 2;

const colleges = [];

for (let i = DATA_START; i < rawRows.length; i++) {
  const row = rawRows[i];
  if (!row || !row[1]) continue;

  const rawLocation    = String(row[2] || '');
  const college        = String(row[1] || '').trim();
  const location       = cleanLocation(rawLocation);
  const affiliation    = String(row[3] || '').trim();
  const autonomous     = String(row[4] || '').trim();
  const type           = String(row[5] || '').trim();
  const naac           = String(row[6] || '').trim() || 'NA';
  const nba            = String(row[7] || '').trim() || 'NA';
  const distance_km    = parseDistanceKm(rawLocation);

  const fees_raw       = strip(String(row[8]  || ''));
  const total_fees_raw = strip(String(row[9]  || ''));
  const avg_pkg_raw    = strip(String(row[10] || ''));
  const high_pkg_raw   = strip(String(row[11] || ''));
  const placement_raw  = String(row[12] || '');
  const companies_raw  = String(row[13] || '');
  const opening_raw    = strip(String(row[14] || ''));
  const closing_raw    = strip(String(row[15] || ''));

  const feeParts   = fees_raw.split('-').map(p => parseFloat(p)).filter(n => !isNaN(n));
  const total_fees   = parseRange(total_fees_raw);
  const avg_package  = parseRange(avg_pkg_raw);
  const highest_package = parseRange(high_pkg_raw);
  const placement    = parsePct(placement_raw);
  const opening_rank = parseRange(opening_raw);
  const closing_rank = parseRange(closing_raw);

  // ROI = avg_package (LPA) / total_fees (in lakhs)
  // total_fees is stored in ₹, convert to lakhs (/100000)
  const total_fees_lakhs = total_fees / 100000;
  const roi = total_fees_lakhs > 0 ? parseFloat((avg_package / total_fees_lakhs).toFixed(3)) : 0;

  colleges.push({
    college,
    college_lower:    college.toLowerCase(),
    location,
    location_lower:   location.toLowerCase(),
    type,
    affiliation,
    autonomous,
    naac,
    nba,
    distance_km,
    fees_min:  feeParts.length     ? feeParts[0]  : 0,
    fees_max:  feeParts.length > 1 ? feeParts[1]  : (feeParts[0] || 0),
    total_fees,
    avg_package,
    highest_package,
    placement,
    companies: parseCompanies(companies_raw),
    opening_rank,
    closing_rank,
    roi,
    // pre-computed non-normalised scores
    naac_score:     getNaacScore(naac),
    type_score:     getTypeScore(type),
    location_score: getLocationScore(distance_km),
  });
}

// ── Global normalisation ─────────────────────────────────────────────────────

function minMax(arr, field) {
  const vals = arr.map(c => c[field]).filter(v => v > 0);
  return { min: Math.min(...vals), max: Math.max(...vals) };
}

const st = {
  avg_package:      minMax(colleges, 'avg_package'),
  highest_package:  minMax(colleges, 'highest_package'),
  placement:        minMax(colleges, 'placement'),
  total_fees:       minMax(colleges, 'total_fees'),
  closing_rank:     minMax(colleges, 'closing_rank'),
  roi:              minMax(colleges, 'roi'),
};

for (const c of colleges) {
  // lower closing_rank = better → invert
  const cutoffInv  = st.closing_rank.max - c.closing_rank;
  const cutoffRange = { min: 0, max: st.closing_rank.max - st.closing_rank.min };

  // lower fees = better → invert
  const feesInv    = st.total_fees.max - c.total_fees;
  const feesRange  = { min: 0, max: st.total_fees.max - st.total_fees.min };

  const avg_norm      = normalize(c.avg_package,      st.avg_package.min,     st.avg_package.max);
  const place_norm    = normalize(c.placement,         st.placement.min,       st.placement.max);
  const high_norm     = normalize(c.highest_package,   st.highest_package.min, st.highest_package.max);
  const roi_norm      = normalize(c.roi,               st.roi.min,             st.roi.max);
  const fees_norm     = normalize(feesInv,             feesRange.min,          feesRange.max);
  const cutoff_norm   = normalize(cutoffInv,           cutoffRange.min,        cutoffRange.max);

  c.final_score = parseFloat((
    avg_norm      * 0.25 +
    place_norm    * 0.15 +
    high_norm     * 0.10 +
    roi_norm      * 0.20 +
    c.naac_score  * 0.10 +
    c.type_score  * 0.10 +
    c.location_score * 0.05 +
    cutoff_norm   * 0.05
  ).toFixed(2));
}

// Sort by final_score descending so rank is implicit by array index
colleges.sort((a, b) => b.final_score - a.final_score);

// ── Output ───────────────────────────────────────────────────────────────────
const json   = JSON.stringify(colleges);
fs.writeFileSync(OUTPUT, json, 'utf8');
const sizeKB = (Buffer.byteLength(json, 'utf8') / 1024).toFixed(1);

console.log(`[convertColleges] ✅ Wrote ${colleges.length} colleges → ${OUTPUT}`);
console.log(`[convertColleges]    Size: ${sizeKB} KB`);
console.log(`[convertColleges]    Top 3: ${colleges.slice(0,3).map(c=>c.college+' ('+c.final_score+')').join(' | ')}`);
