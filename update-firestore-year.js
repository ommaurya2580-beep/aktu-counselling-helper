/**
 * update-firestore-year.js
 * Bulk updates year field to "2025" on ALL documents in the "cutoffs" collection.
 * Uses Firebase Admin SDK with batched writes (max 500 ops/batch — Firestore limit).
 *
 * SETUP:
 *   1. npm install firebase-admin
 *   2. Download serviceAccount.json from:
 *      Firebase Console → Project Settings → Service Accounts → Generate new private key
 *   3. Place serviceAccount.json in same directory as this script
 *   4. node update-firestore-year.js
 */

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore }        = require('firebase-admin/firestore');
const serviceAccount          = require('./serviceAccount.json');

// ── Init ──────────────────────────────────────────────────────────────────────
initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

const COLLECTION   = 'cutoffs';
const BATCH_SIZE   = 500; // Firestore hard limit per batch

// ── Main ──────────────────────────────────────────────────────────────────────
async function updateAllYears() {
  console.log(`\n📂  Fetching all documents from "${COLLECTION}"...`);
  console.log('    (This may take a moment for 10k+ docs)\n');

  // Fetch entire collection (for 10k docs this is fine — no need for pagination)
  const snapshot = await db.collection(COLLECTION).get();
  const total = snapshot.size;
  console.log(`✅  Fetched ${total} documents\n`);

  if (total === 0) {
    console.log('⚠️  Collection is empty. Nothing to update.');
    return;
  }

  // ── Chunk into batches of 500 ─────────────────────────────────────────────
  const docs       = snapshot.docs;
  const batches    = [];
  let   batchIndex = 0;

  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const chunk = docs.slice(i, i + BATCH_SIZE);
    const batch = db.batch();

    for (const doc of chunk) {
      batch.update(doc.ref, { year: '2025' });
    }

    batches.push({ batch, from: i + 1, to: Math.min(i + BATCH_SIZE, total) });
    batchIndex++;
  }

  console.log(`🔢  Total batches to commit: ${batches.length}  (${BATCH_SIZE} ops/batch max)\n`);

  // ── Commit batches sequentially ───────────────────────────────────────────
  let updated = 0;
  let errors  = 0;

  for (let b = 0; b < batches.length; b++) {
    const { batch, from, to } = batches[b];
    try {
      await batch.commit();
      updated += (to - from + 1);
      console.log(`  ✅  Batch ${b + 1}/${batches.length} committed  (docs ${from}–${to})`);
    } catch (err) {
      errors++;
      console.error(`  ❌  Batch ${b + 1}/${batches.length} FAILED:`, err.message);
    }
  }

  // ── Final summary ─────────────────────────────────────────────────────────
  console.log('\n' + '='.repeat(50));
  console.log('SUMMARY');
  console.log('='.repeat(50));
  console.log(`  Total documents  : ${total}`);
  console.log(`  Updated to 2025  : ${updated}`);
  console.log(`  Failed batches   : ${errors}`);
  if (errors === 0) {
    console.log('\n🎉  All documents updated to year="2025" successfully!');
  } else {
    console.log('\n⚠️  Some batches failed. Re-run the script to retry — it is safe (idempotent).');
  }
}

updateAllYears().catch(err => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
