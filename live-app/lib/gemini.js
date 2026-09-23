// Thin wrapper around the Gemini REST API. No SDK dependency — one fetch call.
// Free key: https://aistudio.google.com/app/apikey (set GEMINI_API_KEY in live-app/.env)

// gemini-3.6-flash (and the other newest-generation models) have a tiny
// free-tier quota on this key, the older 2.5 generation is "no longer
// available to new users" on this project, and gemini-3-flash-preview's
// free tier is capped at 20 requests/day (exhausted almost immediately by
// a real search). gemini-flash-lite-latest is the one that actually holds
// up across a full search, despite occasional overload under heavy
// external traffic (handled by the retry logic below). Override via
// GEMINI_MODEL if a different one suits your key better.
const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-flash-lite-latest';

// The free tier only allows a handful of requests per minute (observed:
// 5/min for gemini-3.6-flash) — firing every opportunity's evaluation call
// at once instantly blows through that and 429s almost all of them. This
// serializes every call through one queue, spaced evenly to stay under the
// quota, so a full search (every non-knocked-out opportunity, per Aceso's
// "non-AI filter first, then AI decides for everyone who passes it" rule)
// eventually gets real Gemini scoring instead of silently falling back.
// Override with GEMINI_RPM in .env if your key's quota is different.
const RPM = Number(process.env.GEMINI_RPM) || 5;
const MIN_INTERVAL_MS = Math.ceil(60000 / RPM);

let queueTail = Promise.resolve();
let lastCallAt = 0;

function throttled(fn) {
  const run = async () => {
    const wait = Math.max(0, lastCallAt + MIN_INTERVAL_MS - Date.now());
    if (wait > 0) await new Promise((r) => setTimeout(r, wait));
    lastCallAt = Date.now();
    return fn();
  };
  const result = queueTail.then(run, run);
  queueTail = result.then(() => {}, () => {}); // keep the chain alive even if this call ends up failing
  return result;
}

function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

async function rawCallGemini(prompt, { model = DEFAULT_MODEL, timeoutMs = 20000 } = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('GEMINI_API_KEY is not set');
    err.code = 'NO_GEMINI_KEY';
    throw err;
  }
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0.2, maxOutputTokens: 1024 }
      })
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      const err = new Error(`Gemini API error ${res.status}: ${body.slice(0, 400)}`);
      err.status = res.status;
      throw err;
    }
    const json = await res.json();
    const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || '';
    if (!text) throw new Error('Gemini returned no content (possibly blocked by safety filters)');
    try {
      return JSON.parse(text);
    } catch (parseErr) {
      // Gemini occasionally wraps JSON in a code fence despite responseMimeType — strip and retry once.
      const cleaned = text.replace(/^```(json)?/i, '').replace(/```$/, '').trim();
      return JSON.parse(cleaned);
    }
  } finally {
    clearTimeout(timeout);
  }
}

// 503 means Google's shared free-tier model is temporarily overloaded —
// unrelated to our own pacing, and observed in testing to often clear
// within a few retries. 429 means we landed on the wrong side of the
// quota window. Both are worth retrying with growing backoff before
// giving up to the heuristic scorer.
const MAX_RETRIES = 3;

// Calls Gemini asking for strict JSON output, throttled to the configured
// rate. Throws on any failure — callers are expected to catch and fall
// back to the heuristic scorer.
async function callGemini(prompt, opts = {}) {
  return throttled(async () => {
    let lastErr;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
      try {
        return await rawCallGemini(prompt, opts);
      } catch (err) {
        lastErr = err;
        const retryable = err.status === 429 || err.status === 503 || err.name === 'AbortError';
        if (!retryable || attempt === MAX_RETRIES) throw err;
        await new Promise((r) => setTimeout(r, MIN_INTERVAL_MS * (attempt + 1)));
      }
    }
    throw lastErr;
  });
}

module.exports = { callGemini, hasGeminiKey, DEFAULT_MODEL };
