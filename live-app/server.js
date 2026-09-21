require('dotenv').config();
const path = require('path');
const express = require('express');
const cors = require('cors');

const { searchGrantsGov } = require('./connectors/grantsGov');
const { searchWorldBank } = require('./connectors/worldBank');
const { searchCoefficientGiving } = require('./connectors/coefficientGiving');
const { evaluateOpportunity } = require('./lib/scoring');
const { dedupe } = require('./lib/dedupe');
const { hasGeminiKey } = require('./lib/gemini');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Runs one connector, never lets a single source's failure break the whole search.
async function safeRun(label, fn) {
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

app.post('/api/search', async (req, res) => {
  const keyword = (req.body?.keyword || 'health systems').trim() || 'health systems';
  const criteria = req.body?.criteria || null;

  const [grantsGov, worldBank, coefficientGiving] = await Promise.all([
    safeRun('Grants.gov', () => searchGrantsGov({ keyword })),
    safeRun('World Bank', () => searchWorldBank({ keyword })),
    safeRun('Coefficient Giving', () => searchCoefficientGiving({}))
  ]);

  const rawOpportunities = [...grantsGov.items, ...worldBank.items, ...coefficientGiving.items];
  const deduped = dedupe(rawOpportunities);

  const evaluated = await Promise.all(deduped.map(async (opp) => {
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

  res.json({
    searchedAt: new Date().toISOString(),
    keyword,
    geminiConfigured: hasGeminiKey(),
    sources: {
      grantsGov: { ok: grantsGov.ok, count: grantsGov.count, ms: grantsGov.ms, error: grantsGov.error || null },
      worldBank: { ok: worldBank.ok, count: worldBank.count, ms: worldBank.ms, error: worldBank.error || null },
      coefficientGiving: { ok: coefficientGiving.ok, count: coefficientGiving.count, ms: coefficientGiving.ms, error: coefficientGiving.error || null }
    },
    results: evaluated
  });
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`Aceso Intelligence live server running at http://localhost:${PORT}`);
  console.log(`Gemini scoring: ${hasGeminiKey() ? 'ENABLED' : 'DISABLED (set GEMINI_API_KEY in live-app/.env to enable)'}`);
});
