import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const count = await prisma.cutoff2025.count();
  const samples = await prisma.cutoff2025.findMany({ take: 3 });
  const priorityCount = await prisma.priorityCollege.count();
  console.log(JSON.stringify({ count, samples, priorityCount }, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
