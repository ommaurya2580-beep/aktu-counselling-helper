const admin = require("firebase-admin");
const serviceAccount = require("c:\\Users\\ommau\\Downloads\\aktu-counselling-data-firebase-adminsdk-fbsvc-9c6cfc0707.json");

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function checkData() {
  const snapshot = await db.collection("cutoffs").limit(1).get();
  snapshot.forEach(doc => {
    console.log(doc.id, "=>", doc.data());
    console.log("Types:");
    for (const [key, value] of Object.entries(doc.data())) {
      console.log(`  ${key}: ${typeof value} (${value})`);
    }
  });
}
checkData().catch(console.error);
