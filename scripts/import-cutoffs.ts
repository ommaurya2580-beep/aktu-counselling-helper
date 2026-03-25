import { PrismaClient } from '@prisma/client';
import * as XLSX from 'xlsx';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

// List of top AKTU colleges to mark as Priority
const DEFAULT_PRIORITY_COLLEGES = [
  "Institute of Engineering and Technology, Lucknow",
  "Kamla Nehru Institute of Technology, Sultanpur",
  "Bundelkhand Institute of Engineering and Technology, Jhansi",
  "Madan Mohan Malaviya University of Technology, Gorakhpur",
  "Harcourt Butler Technical University, Kanpur",
  "Ajay Kumar Garg Engineering College, Ghaziabad",
  "JSS Academy of Technical Education, Noida",
  "KIET Group of Institutions, Ghaziabad",
  "Galgotias College of Engineering and Technology, Greater Noida",
  "ABES Engineering College, Ghaziabad",
  "G.L. Bajaj Institute of Technology and Management, Greater Noida"
];

async function seedPriorityColleges() {
  console.log('Seeding Priority Colleges...');
  for (const name of DEFAULT_PRIORITY_COLLEGES) {
    await prisma.priorityCollege.upsert({
      where: { name },
      update: {},
      create: { name }
    });
  }
  console.log('Priority Colleges seeded.');
}

async function importCutoffs(filePath: string) {
  console.log(`Starting import from ${filePath}...`);
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}`);
    return;
  }

  let data: any[] = [];

  if (filePath.endsWith('.xlsx')) {
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    data = XLSX.utils.sheet_to_json(sheet);
  } else if (filePath.endsWith('.json')) {
    data = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  }

  console.log(`Found ${data.length} records. Processing...`);

  // We process in chunks to prevent memory/connection issues
  const chunkSize = 500;
  let successCount = 0;
  
  for (let i = 0; i < data.length; i += chunkSize) {
    const chunk = data.slice(i, i + chunkSize);
    
    // Process chunk in parallel
    await Promise.all(
      chunk.map(async (row) => {
        try {
          // Adjust field names based on your actual Excel/JSON data structure.
          // Using fallbacks to common column names just in case.
          const college_name = row.college_name || row.institute || row.Institute || '';
          const branch_name = row.branch_name || row.program || row.Program || '';
          const category = (row.category || row.Category || 'OPEN').toString().toUpperCase();
          const quota = (row.quota || row.Quota || 'UP STATE').toString().toUpperCase();
          const opening_rank = parseInt(row.opening_rank || row.OpeningRank || row.OR || '0', 10);
          const max_closing_rank = parseInt(row.max_closing_rank || row.closing_rank || row.ClosingRank || row.CR || '0', 10);
          const round = parseInt(row.round || row.Round || '1', 10);

          if (!college_name || !branch_name) return; // Skip invalid rows

          await prisma.cutoff2025.upsert({
            where: {
              college_name_branch_name_category_quota_round: {
                college_name,
                branch_name,
                category,
                quota,
                round
              }
            },
            update: {
              opening_rank,
              max_closing_rank
            },
            create: {
              college_name,
              branch_name,
              category,
              quota,
              opening_rank,
              max_closing_rank,
              round
            }
          });
          successCount++;
        } catch (err) {
          console.error(`Error importing row:`, row);
          console.error(err);
        }
      })
    );
    console.log(`Progress: ${Math.min(i + chunkSize, data.length)} / ${data.length} records...`);
  }

  console.log(`\nImport complete! Successfully upserted ${successCount} records.`);
}

async function main() {
  await seedPriorityColleges();
  
  const possiblePaths = [
    path.join(__dirname, '../Book2.xlsx'),
    path.join(__dirname, '../public/data/cutoffs.min.json'),
    path.join(__dirname, '../cutoffs.min.json')
  ];

  const fileToImport = possiblePaths.find(p => fs.existsSync(p));

  if (fileToImport) {
    await importCutoffs(fileToImport);
  } else {
    console.log('No data file found (checked Book2.xlsx, cutoffs.min.json)... Please paste your data file in the project root.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
