const { getDb, hasFirebaseConfig } = require('./firebase');

const COLLECTION = 'searches';

// Persists one completed search so it survives a page reload or server
// restart. Never throws — a Firestore hiccup should never take down a
// search that already succeeded; callers just get `null` back on failure.
async function saveSearch(payload) {
  if (!hasFirebaseConfig()) return null;
  try {
    const db = getDb();
    const ref = await db.collection(COLLECTION).add(payload);
    return ref.id;
  } catch (err) {
    console.error(`[search-history] failed to save search: ${err.message}`);
    return null;
  }
}

// Lightweight list for browsing past searches — omits the (potentially
// large) `results` array so the list stays fast to load.
async function listSearches(limit = 20) {
  if (!hasFirebaseConfig()) return [];
  const db = getDb();
  const snap = await db.collection(COLLECTION).orderBy('searchedAt', 'desc').limit(limit).get();
  return snap.docs.map((doc) => {
    const data = doc.data();
    return {
      id: doc.id,
      searchedAt: data.searchedAt,
      keyword: data.keyword,
      geminiConfigured: data.geminiConfigured,
      resultCount: Array.isArray(data.results) ? data.results.length : 0,
      sources: data.sources
    };
  });
}

async function getSearchById(id) {
  if (!hasFirebaseConfig()) return null;
  const db = getDb();
  const doc = await db.collection(COLLECTION).doc(id).get();
  if (!doc.exists) return null;
  return { id: doc.id, ...doc.data() };
}

module.exports = { saveSearch, listSearches, getSearchById };
