import xlsx from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const inputPath = path.join(__dirname, '../Book2.xlsx');
const outputMinPath = path.join(__dirname, '../public/cutoffs.min.json');
const outputJsonPath = path.join(__dirname, '../public/cutoffs.json');

console.log('[parse_new_cutoffs] Reading:', inputPath);
if (!fs.existsSync(inputPath)) {
  console.error('ERROR: Input file not found:', inputPath);
  process.exit(1);
}

const workbook = xlsx.readFile(inputPath);
const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Parse straight to JSON
const rawData = xlsx.utils.sheet_to_json(sheet, { defval: '' });

const cutoffs = [];
let count = 0;

for (const row of rawData) {
  // Map fields based on keys found handling special chars "┬áΓû▓Γû╝" or anything after a space
  
  // Find key values by checking if key includes a string instead of exact matching, 
  // as the special characters might be tricky due to encoding issues during copy paste.
  const findValue = (obj, searchString) => {
    const key = Object.keys(obj).find(k => k.toLowerCase().includes(searchString.toLowerCase()));
    return key ? obj[key] : '';
  };

  const institute = typeof row['Institute'] !== 'undefined' ? row['Institute'] : findValue(row, 'Institute');
  if (!institute || !String(institute).trim()) continue;

  const roundRaw = row['Round'] || findValue(row, 'Round') || '';
  const roundStr = String(roundRaw);
  // Match number like 'Round 1' -> '1', 'Round 2' -> '2'
  const roundNumMatch = roundStr.match(/\d+/);
  const round_num = roundNumMatch ? parseInt(roundNumMatch[0], 10) : 1;
  const round = `Round ${round_num}`;

  const program = String(row['Program'] || findValue(row, 'Program') || '').trim();
  const stream = String(row['Stream'] || findValue(row, 'Stream') || '').trim();
  const quota = String(row['Quota'] || findValue(row, 'Quota') || '').trim();
  const category = String(row['Category'] || findValue(row, 'Category') || '').trim();
  const gender = String(findValue(row, 'Gender') || '').trim();
  const opening_rank = parseInt(findValue(row, 'Opening') || 0, 10) || 0;
  const closing_rank = parseInt(findValue(row, 'Closing') || 0, 10) || 0;
  const remark = String(row['Remark'] || findValue(row, 'Remark') || '').trim();

  cutoffs.push({
    year: 2025,
    round,
    institute,
    program,
    stream,
    quota,
    category,
    gender,
    opening_rank,
    closing_rank,
    remark
  });
  
  count++;
}

console.log(`[parse_new_cutoffs] Processed ${count} valid records`);

// Write JSON payload
const jsonStr = JSON.stringify(cutoffs);
fs.writeFileSync(outputJsonPath, JSON.stringify(cutoffs, null, 2), 'utf8');
fs.writeFileSync(outputMinPath, jsonStr, 'utf8');

const sizeKB = (Buffer.byteLength(jsonStr, 'utf8') / 1024).toFixed(1);
console.log(`[parse_new_cutoffs] ✅ Wrote ${cutoffs.length} cutoff records to ${outputMinPath}`);
console.log(`[parse_new_cutoffs] Size: ${sizeKB} KB`);
