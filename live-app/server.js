require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const { searchGrantsGov } = require('./connectors/grantsGov');
const { searchWorldBank } = require('./connectors/worldBank');
const { searchCoefficientGiving } = require('./connectors/coefficientGiving');
const { searchUnitaid } = require('./connectors/unitaid');
const { searchUndp } = require('./connectors/undp');
const { searchUngm } = require('./connectors/ungm');
const { evaluateOpportunity, buildCopilotPrompt } = require('./lib/scoring');
const { dedupe } = require('./lib/dedupe');
const { hasGeminiKey, callGemini } = require('./lib/gemini');
const { closeBrowser } = require('./lib/browser');
const { hasFirebaseConfig } = require('./lib/firebase');
const { saveSearch, listSearches, getSearchById, getLatestSearch } = require('./lib/searchHistory');

const app = express();
app.use(cors());
// Copilot requests carry the full on-screen context (charts, Knowledge Base…).
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Runs one connector, never lets a single source's failure break the whole search.
async function safeRun(label, fn, enabled = true) {
  // Switched off on the Criteria page: not queried at all.
  if (!enabled) return { label, ok: true, skipped: true, count: 0, ms: 0, items: [] };
  const startedAt = Date.now();
  try {
    const items = await fn();
    return { label, ok: true, count: items.length, ms: Date.now() - startedAt, items };
  } catch (err) {
    console.error(`[search] ${label} failed: ${err.message}`);
    return { label, ok: false, count: 0, ms: Date.now() - startedAt, items: [], error: err.message };
  }
}

function statusForTier(tier) {
  if (tier === 'Strong Fit') return 'Recommended';
  if (tier === 'Low Fit') return 'Low fit';
  return 'Decision needed';
}

app.get('/api/health', (req, res) => {
  res.json({ ok: true, geminiConfigured: hasGeminiKey() });
});

// Aceso Copilot — answers a free-text question against a compact summary of
// the current dashboard data the frontend sends along. Shares the same
// throttled Gemini queue as search scoring, so it can queue up behind a
// search that's still running.
app.post('/api/copilot', async (req, res) => {
  const question = (req.body?.question || '').trim();
  if (!question) return res.status(400).json({ error: 'Question is required.' });
  if (!hasGeminiKey()) return res.json({ answer: null, error: 'Gemini is not configured, so Copilot cannot answer right now.' });
  try {
    const context = req.body?.context || {};
    const raw = await callGemini(buildCopilotPrompt(question, context), { timeoutMs: 45000, maxOutputTokens: 2048 });
    res.json({ answer: raw.answer || "I couldn't come up with an answer for that." });
  } catch (err) {
    console.error(`[copilot] failed: ${err.message}`);
    res.status(500).json({ error: `Copilot couldn't answer right now: ${err.message}` });
  }
});

app.post('/api/search', async (req, res) => {
  const keyword = (req.body?.keyword || 'health systems').trim() || 'health systems';
  const criteria = req.body?.criteria || null;
  const on = key => criteria?.sources?.[key] !== false;

  const [grantsGov, worldBank, coefficientGiving, unitaid, undp, ungm] = await Promise.all([
    safeRun('Grants.gov', () => searchGrantsGov({ keyword }), on('grantsGov')),
    safeRun('World Bank', () => searchWorldBank({ keyword }), on('worldBank')),
    safeRun('Coefficient Giving', () => searchCoefficientGiving({}), on('coefficientGiving')),
    safeRun('Unitaid', () => searchUnitaid(), on('unitaid')),
    safeRun('UNDP', () => searchUndp({ keyword }), on('undp')),
    safeRun('UNGM', () => searchUngm({ keyword }), on('ungm'))
  ]);

  const rawOpportunities = [...grantsGov.items, ...worldBank.items, ...coefficientGiving.items, ...unitaid.items, ...undp.items, ...ungm.items];
  const deduped = dedupe(rawOpportunities);

  // Drop opportunities whose deadline has already passed before they're even
  // scored — there's no value in reviewing (or excluding) a closed notice,
  // so these no longer appear anywhere, not even in "Discarded". A due date
  // that doesn't parse cleanly is kept (never dropped on ambiguous data).
  const now = Date.now();
  const open = deduped.filter((opp) => {
    if (!opp.due) return true;
    const parsed = Date.parse(opp.due);
    return Number.isNaN(parsed) || parsed >= now;
  });

  const evaluated = await Promise.all(open.map(async (opp) => {
    const evaluation = await evaluateOpportunity(opp, criteria);
    return {
      title: opp.title,
      org: opp.org,
      country: opp.country,
      type: opp.type,
      value: opp.value,
      due: opp.due,
      source: opp.source,
      sourceUrl: opp.sourceUrl,
      rfpStatus: opp.rfpStatus || undefined,
      score: evaluation.score,
      pillar: evaluation.pillar,
      status: statusForTier(evaluation.fitTier),
      state: evaluation.knockedOut ? 'Excluded' : 'Agent screened',
      knockedOut: evaluation.knockedOut,
      knockoutReason: evaluation.knockoutReason || null,
      meta: {
        sourceOpportunityId: opp.raw?.sourceOpportunityId || null,
        pubDate: opp.raw?.pubDate || null,
        objective: evaluation.objective || opp.raw?.description?.slice(0, 220) || '',
        qualifications: evaluation.qualifications || 'Not specified',
        eligibility: evaluation.eligibility || opp.raw?.eligibility || 'See official listing',
        orgType: 'Consulting firm',
        language: opp.raw?.language || 'English',
        location: opp.country,
        rfpAvailable: true,
        keywords: evaluation.keywords || [],
        exclusions: [],
        firstDetected: new Date().toISOString(),
        lastDetected: new Date().toISOString(),
        fitTier: evaluation.fitTier,
        explanation: evaluation.explanation,
        reviewFlags: evaluation.reviewFlags || [],
        dupStatus: opp.dupStatus || 'New',
        mergedSources: opp.mergedSources || [],
        usedGemini: Boolean(evaluation.usedGemini)
      }
    };
  }));

  // Rank by fit, not by which connector happened to answer first — otherwise
  // "Today" (which only shows the top few) can look like it's only pulling
  // from whichever source returns the most rows (usually Grants.gov).
  evaluated.sort((a, b) => (b.knockedOut === a.knockedOut ? b.score - a.score : (a.knockedOut ? 1 : -1)));

  const responsePayload = {
    searchedAt: new Date().toISOString(),
    keyword,
    geminiConfigured: hasGeminiKey(),
    sources: {
      grantsGov: { ok: grantsGov.ok, count: grantsGov.count, ms: grantsGov.ms, error: grantsGov.error || null, skipped: Boolean(grantsGov.skipped) },
      worldBank: { ok: worldBank.ok, count: worldBank.count, ms: worldBank.ms, error: worldBank.error || null, skipped: Boolean(worldBank.skipped) },
      coefficientGiving: { ok: coefficientGiving.ok, count: coefficientGiving.count, ms: coefficientGiving.ms, error: coefficientGiving.error || null, skipped: Boolean(coefficientGiving.skipped) },
      unitaid: { ok: unitaid.ok, count: unitaid.count, ms: unitaid.ms, error: unitaid.error || null, skipped: Boolean(unitaid.skipped) },
      undp: { ok: undp.ok, count: undp.count, ms: undp.ms, error: undp.error || null, skipped: Boolean(undp.skipped) },
      ungm: { ok: ungm.ok, count: ungm.count, ms: ungm.ms, error: ungm.error || null, skipped: Boolean(ungm.skipped) }
    },
    results: evaluated
  };

  const historyId = await saveSearch(responsePayload);
  res.json({ ...responsePayload, historyId });
});

app.get('/api/search-history', async (req, res) => {
  if (!hasFirebaseConfig()) return res.json({ enabled: false, searches: [] });
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const searches = await listSearches(limit);
    res.json({ enabled: true, searches });
  } catch (err) {
    res.status(500).json({ enabled: true, error: err.message, searches: [] });
  }
});

app.get('/api/search-history/latest', async (req, res) => {
  if (!hasFirebaseConfig()) return res.json({ enabled: false, search: null });
  try {
    const search = await getLatestSearch();
    res.json({ enabled: true, search });
  } catch (err) {
    res.status(500).json({ enabled: true, error: err.message, search: null });
  }
});

app.get('/api/search-history/:id', async (req, res) => {
  if (!hasFirebaseConfig()) return res.status(404).json({ error: 'Search history is not enabled.' });
  try {
    const record = await getSearchById(req.params.id);
    if (!record) return res.status(404).json({ error: 'Search not found.' });
    res.json(record);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 4000;
const server = app.listen(PORT, () => {
  console.log(`Aceso Intelligence live server running at http://localhost:${PORT}`);
  console.log(`Gemini scoring: ${hasGeminiKey() ? 'ENABLED' : 'DISABLED (set GEMINI_API_KEY in live-app/.env to enable)'}`);
});
// With Gemini enabled, every opportunity that passes the non-AI filter gets
// a real (rate-limited) Gemini call, so a full /api/search can legitimately
// take several minutes on the free tier's 5-requests/minute quota — well
// past Node's default request/header timeouts. Disable them for this app.
server.requestTimeout = 0;
server.headersTimeout = 0;
server.timeout = 0;

// UNGM automation keeps a headless browser open in the background — close
// it cleanly on shutdown instead of leaving an orphaned process behind.
function shutdown() {
  server.close();
  closeBrowser().finally(() => process.exit(0));
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
