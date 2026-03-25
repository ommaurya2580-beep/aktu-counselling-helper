import xlsx from 'xlsx';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const filePath = path.join(__dirname, '../Book2.xlsx');
const workbook = xlsx.readFile(filePath);

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

const data = xlsx.utils.sheet_to_json(sheet, { defval: '' });

console.log('Total Rows:', data.length);
if (data.length > 0) {
    console.log('\nHeaders:', Object.keys(data[0]));
    console.log('\nFirst 3 rows:');
    console.log(JSON.stringify(data.slice(0, 3), null, 2));
}
