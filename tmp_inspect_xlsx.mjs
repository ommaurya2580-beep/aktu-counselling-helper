import XLSX from 'xlsx';
import path from 'path';
const libDir = 'C:\\Users\\ommau\\OneDrive\\Desktop\\aktu caunciling\\lib';
const file = 'aktu_round1.xlsx';
const filePath = path.join(libDir, file);

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Row 0 (Headers):', data[0]);
console.log('Row 1 (Data):', data[1]);
