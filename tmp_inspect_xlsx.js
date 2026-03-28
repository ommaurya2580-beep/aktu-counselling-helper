const XLSX = require('xlsx');
const path = require('path');
const libDir = 'C:\\Users\\ommau\\OneDrive\\Desktop\\aktu caunciling\\lib';
const file = 'aktu_round1.xlsx';
const filePath = path.join(libDir, file);

const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];
const data = XLSX.utils.sheet_to_json(sheet);

console.log('Keys in row 0:', Object.keys(data[0]));
console.log('Sample row:', data[0]);
