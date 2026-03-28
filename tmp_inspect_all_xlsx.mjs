import XLSX from 'xlsx';
import path from 'path';

const libDir = 'C:\\Users\\ommau\\OneDrive\\Desktop\\aktu caunciling\\lib';
const rounds = [
    'aktu_round1.xlsx',
    'aktu_round2.xlsx',
    'aktu_round3.xlsx',
    'aktu_round4.xlsx',
    'aktu_round6.xlsx',
    'aktu_round7.xlsx'
];

rounds.forEach(file => {
    const filePath = path.join(libDir, file);
    try {
        const workbook = XLSX.readFile(filePath);
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log(`\n--- ${file} ---`);
        console.log('Row 0:', data[0]);
        console.log('Row 1:', data[1]);
    } catch(e) {
        console.error(`Error reading ${file}:`, e.message);
    }
});
