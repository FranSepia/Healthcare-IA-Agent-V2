const path = require('path');
const fs = require('fs');
const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

let app = null;
let db = null;

function hasFirebaseConfig() {
  return Boolean(process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
}

// Lazily initializes the Admin SDK on first use — mirrors the
// hasGeminiKey()/callGemini() pattern in lib/gemini.js so callers can check
// availability before touching the database.
function getDb() {
  if (db) return db;
  if (!hasFirebaseConfig()) {
    const err = new Error('FIREBASE_SERVICE_ACCOUNT_PATH is not set');
    err.code = 'NO_FIREBASE_CONFIG';
    throw err;
  }
  const keyPath = path.resolve(__dirname, '..', process.env.FIREBASE_SERVICE_ACCOUNT_PATH);
  if (!fs.existsSync(keyPath)) {
    throw new Error(`Firebase service account file not found at ${keyPath}`);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  app = initializeApp({ credential: cert(serviceAccount) });
  db = getFirestore(app);
  // Several payloads we store (e.g. a search result's optional rfpStatus)
  // use `undefined` for "not present" — Firestore rejects that by default.
  db.settings({ ignoreUndefinedProperties: true });
  return db;
}

module.exports = { getDb, hasFirebaseConfig };
