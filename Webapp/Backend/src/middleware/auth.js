// src/middleware/auth.js
const { admin } = require("../firebaseAdmin");

async function verifyFirebaseToken(req, res, next) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.split(" ")[1] : null;
  if (!token) return res.status(401).json({ error: "Missing auth token" });

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    console.log("✅ Firebase token verified:", decoded);
    req.user = decoded;
    next();
  } catch (err) {
    console.error("🔥 Firebase token verification failed:", err.message);
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role === "admin" || req.user?.admin === true) {
    return next();
  }
  return res.status(403).json({ error: "Admin privileges required" });
}

module.exports = { verifyFirebaseToken, requireAdmin };
