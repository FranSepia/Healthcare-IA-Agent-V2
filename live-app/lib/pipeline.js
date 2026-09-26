const crypto = require('crypto');
const { FieldValue } = require('firebase-admin/firestore');
const { getDb, hasFirebaseConfig } = require('./firebase');

// Pipeline & Proposals: which real opportunities the team moved past
// Qualified, who owns them, their delivery plan, comments and history.
// One Firestore document per opportunity, keyed by a stable id the frontend
// derives from the notice (source URL / source + title). "Qualified" is not
// stored — it is read live from the latest search's recommended results.
const COLLECTION = 'pipeline';
const STAGES = ['Internal review', 'Proposal', 'Submitted', 'Declined'];
const KEY_RE = /^[a-z0-9_-]{4,80}$/i;
const LIMITS = { deliverables: 60, history: 200, comments: 300 };

// Used only when Firestore is not configured (local development): the
// pipeline then lives in server memory and is lost on restart.
const memory = new Map();
const store = () => (hasFirebaseConfig() ? 'firestore' : 'memory');

const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const day = (v) => (/^\d{4}-\d{2}-\d{2}$/.test(v || '') ? v : '');
const url = (v) => (/^https?:\/\//i.test(v || '') ? str(v, 1000) : '');
const newId = () => crypto.randomBytes(6).toString('hex');

// Only these opportunity fields are kept: enough to show the record even
// after it drops out of the latest search.
function cleanOpp(o = {}) {
  const score = Number(o.score);
  return {
    title: str(o.title, 400),
    org: str(o.org, 200),
    country: str(o.country, 120),
    pillar: str(o.pillar, 160),
    type: str(o.type, 80),
    source: str(o.source, 80),
    sourceUrl: url(o.sourceUrl),
    value: str(o.value, 120),
    due: str(o.due, 60),
    summary: str(o.summary, 1500),
    score: Number.isFinite(score) ? Math.max(0, Math.min(100, Math.round(score))) : null
  };
}

function cleanDeliverable(d = {}) {
  return {
    id: str(d.id, 20) || newId(),
    name: str(d.name, 200),
    owner: str(d.owner, 200),
    due: day(d.due),
    done: Boolean(d.done),
    doneAt: d.done ? str(d.doneAt, 40) : ''
  };
}

function cleanHistory(h = {}) {
  return { at: str(h.at, 40) || new Date().toISOString(), text: str(h.text, 300), detail: str(h.detail, 600) };
}

function cleanComment(c = {}) {
  return { id: str(c.id, 20) || newId(), author: str(c.author, 80) || 'Team member', text: str(c.text, 2000), at: str(c.at, 40) || new Date().toISOString() };
}

// Accepts a partial update from the frontend; unknown fields are dropped.
function cleanPatch(body = {}) {
  const patch = {};
  if (body.stage !== undefined) {
    if (!STAGES.includes(body.stage)) throw Object.assign(new Error('Unknown stage.'), { status: 400 });
    patch.stage = body.stage;
  }
  if (body.opp !== undefined) patch.opp = cleanOpp(body.opp);
  if (body.owner !== undefined) patch.owner = str(body.owner, 120);
  if (body.submittedAt !== undefined) patch.submittedAt = str(body.submittedAt, 40);
  if (Array.isArray(body.deliverables)) patch.deliverables = body.deliverables.slice(0, LIMITS.deliverables).map(cleanDeliverable).filter((d) => d.name);
  if (Array.isArray(body.history)) patch.history = body.history.slice(0, LIMITS.history).map(cleanHistory).filter((h) => h.text);
  return patch;
}

function checkKey(key) {
  if (!KEY_RE.test(key || '')) throw Object.assign(new Error('Invalid pipeline key.'), { status: 400 });
}

async function listPipeline() {
  if (store() === 'memory') return [...memory.values()];
  const snap = await getDb().collection(COLLECTION).get();
  return snap.docs.map((doc) => ({ key: doc.id, ...doc.data() }));
}

// Creates the record on first write (stage and opportunity required), then
// merges later partial updates.
async function savePipelineItem(key, body) {
  checkKey(key);
  const patch = cleanPatch(body);
  const now = new Date().toISOString();
  if (store() === 'memory') {
    const prev = memory.get(key);
    if (!prev && (!patch.stage || !patch.opp)) throw Object.assign(new Error('A new pipeline item needs a stage and an opportunity.'), { status: 400 });
    const next = { key, deliverables: [], history: [], comments: [], owner: '', createdAt: now, ...prev, ...patch, updatedAt: now };
    memory.set(key, next);
    return next;
  }
  const ref = getDb().collection(COLLECTION).doc(key);
  return getDb().runTransaction(async (tx) => {
    const doc = await tx.get(ref);
    if (!doc.exists && (!patch.stage || !patch.opp)) throw Object.assign(new Error('A new pipeline item needs a stage and an opportunity.'), { status: 400 });
    const base = doc.exists ? {} : { deliverables: [], history: [], comments: [], owner: '', createdAt: now };
    tx.set(ref, { ...base, ...patch, updatedAt: now }, { merge: true });
    return { key, ...(doc.exists ? doc.data() : {}), ...base, ...patch, updatedAt: now };
  });
}

// Comments are appended server-side so two people commenting at once never
// overwrite each other.
async function addPipelineComment(key, body) {
  checkKey(key);
  const comment = cleanComment({ author: body && body.author, text: body && body.text });
  if (!comment.text) throw Object.assign(new Error('Comment text is required.'), { status: 400 });
  if (store() === 'memory') {
    const prev = memory.get(key);
    if (!prev) throw Object.assign(new Error('Pipeline item not found.'), { status: 404 });
    prev.comments = [...(prev.comments || []), comment].slice(-LIMITS.comments);
    prev.updatedAt = new Date().toISOString();
    return comment;
  }
  const ref = getDb().collection(COLLECTION).doc(key);
  const doc = await ref.get();
  if (!doc.exists) throw Object.assign(new Error('Pipeline item not found.'), { status: 404 });
  await ref.update({ comments: FieldValue.arrayUnion(comment), updatedAt: new Date().toISOString() });
  return comment;
}

// Removing an item returns the opportunity to Qualified (if it is still
// recommended by the latest search).
async function removePipelineItem(key) {
  checkKey(key);
  if (store() === 'memory') { memory.delete(key); return; }
  await getDb().collection(COLLECTION).doc(key).delete();
}

module.exports = { STAGES, store, listPipeline, savePipelineItem, addPipelineComment, removePipelineItem };
