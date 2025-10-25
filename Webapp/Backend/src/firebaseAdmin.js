// src/firebaseAdmin.js
const admin = require("firebase-admin");

if (!admin.apps.length) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);

    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });

    console.log("✅ Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Failed to initialize Firebase Admin:", err);
  }
}

const db = admin.firestore();
const auth = admin.auth();

module.exports = { admin, db, auth };
