import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalize(text: string): string {
  return text.toLowerCase().replace(/ /g, "").replace(/-/g, "").replace(/\./g, "").trim();
}

export async function predictColleges(
  userRank: number,
  category: string,
  quota: string,
  preferredBranch: string
): Promise<any> {
  if (userRank < 1) {
    return { error: "Invalid rank" };
  }

  const normBranch = normalize(preferredBranch);
  const results: any[] = [];

  // 1. YEAR ADJUSTMENT (2025 data → 2026 prediction)
  const YEAR_ADJUSTMENT = 1.08; // 8% relaxation (empirical value)

  // DB queries
  const records = await prisma.cutoff2025.findMany({
    where: {
      category: category.toUpperCase(),
      quota: quota.toUpperCase()
    }
  });

  const pCollegesList = await prisma.priorityCollege.findMany();
  const priorityColleges = new Set(pCollegesList.map(c => c.name));

  for (const record of records) {
    const cr = record.max_closing_rank;
    const adjustedCr = Math.floor(cr * YEAR_ADJUSTMENT); // 2026 ke liye thoda relax

    if (userRank > adjustedCr * 1.35) {
      continue;
    }

    // Branch match (strong but not over-biased)
    const recordNormBranch = normalize(record.branch_name);
    const branchMatch = recordNormBranch === normBranch || recordNormBranch.includes(normBranch);

    const margin = adjustedCr - userRank;
    const marginStr = margin >= 0 ? `+${margin}` : `${margin}`;

    // Chance with ratio + margin
    const ratio = userRank / adjustedCr;
    let chance = "";
    let color = "";

    if (ratio <= 0.80) {
      chance = "DREAM ⭐";
      color = "green";
    } else if (ratio <= 0.95 || margin >= 4000) {
      chance = "VERY SAFE ✅";
      color = "green";
    } else if (ratio <= 1.08 || margin >= 2000) {
      chance = "SAFE 👍";
      color = "blue";
    } else if (ratio <= 1.22 || margin >= 800) {
      chance = "MODERATE ⚠️";
      color = "orange";
    } else {
      chance = "BACKUP 🔁";
      color = "red";
    }

    // Score (fixed negative + branch over-bias)
    let score = Math.max(0, (margin / adjustedCr) * 100); // negative score fix
    score += branchMatch ? 25 : 0; // reduced from 40/50
    score += priorityColleges.has(record.college_name) ? 30 : 0;

    results.push({
      college: record.college_name,
      branch: record.branch_name,
      closing_rank_2025: cr,
      adjusted_closing_2026: adjustedCr,
      your_rank: userRank,
      margin: marginStr,
      chance: chance,
      chance_color: color,
      score: Number(score.toFixed(1)),
      is_branch_match: branchMatch,
      is_priority: priorityColleges.has(record.college_name),
      fallback_used: false // agar OPEN fallback kiya toh True
    });
  }

  // SORT
  results.sort((a, b) => b.score - a.score);

  // Category fallback (safe & transparent)
  if (results.length === 0 && category.toUpperCase() !== "OPEN") {
    // fallback to OPEN
    const fallbackResults = await predictColleges(userRank, "OPEN", quota, preferredBranch);
    if (!fallbackResults.error) {
      const allFallback = [
        ...(fallbackResults.dream_colleges || []),
        ...(fallbackResults.safe_colleges || []),
        ...(fallbackResults.backup_colleges || [])
      ];
      for (const r of allFallback) {
        r.fallback_used = true;
        if (!r.chance.includes("(OPEN fallback)")) {
          r.chance += " (OPEN fallback)";
        }
      }
    }
    return fallbackResults;
  }

  // Split into Dream / Safe / Backup
  const dream = results.filter(r => r.chance.includes("DREAM") || r.chance.includes("VERY SAFE")).slice(0, 4);
  const safe = results.filter(r => r.chance === "SAFE 👍").slice(0, 6);
  const backup = results.filter(r => r.chance === "MODERATE ⚠️" || r.chance === "BACKUP 🔁").slice(0, 6);

  return {
    dream_colleges: dream,
    safe_colleges: safe,
    backup_colleges: backup,
    total_matches: results.length,
    year_adjustment_used: `2025 data × ${YEAR_ADJUSTMENT} (for 2026)`,
    disclaimer: "Prediction based on previous year data. Admission not guaranteed."
  };
}
