// backend/scripts/setAdminRole.js

const admin = require("firebase-admin");

    const serviceAccount = require("../src/serviceAccountKey.json")

    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });

async function setAdmin() {
  const uid = "bIkPLN4V9WYMXVZIc68qIg3EKQ62"; // 👈 Replace with your UID from Firebase console

  try {
    await admin.auth().setCustomUserClaims(uid, { role: "admin" });
    console.log(`✅ Admin role assigned to user UID: ${uid}`);
    console.log("Please log out and log in again to refresh token claims.");
  } catch (err) {
    console.error("❌ Failed to set admin role:", err);
  }
}

setAdmin();
