// Thin wrapper around the Gemini REST API. No SDK dependency — one fetch call.
// Free key: https://aistudio.google.com/app/apikey (set GEMINI_API_KEY in live-app/.env)

const DEFAULT_MODEL = process.env.GEMINI_MODEL || 'gemini-2.0-flash';

function hasGeminiKey() {
  return Boolean(process.env.GEMINI_API_KEY);
}

// Calls Gemini asking for strict JSON output. Throws on any failure —
// callers are expected to catch and fall back to the heuristic scorer.
async function callGemini(prompt, { model = DEFAULT_MODEL, timeoutMs = 20000 } = {}) {
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
      throw new Error(`Gemini API error ${res.status}: ${body.slice(0, 400)}`);
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

module.exports = { callGemini, hasGeminiKey, DEFAULT_MODEL };
