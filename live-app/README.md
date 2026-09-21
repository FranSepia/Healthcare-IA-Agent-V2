# Aceso Intelligence — Live Search (real APIs)

This is the same Aceso Intelligence interface, now wired to real, free data
sources instead of mock data. Clicking **Search now** — or just opening the
app — makes real HTTP calls to Grants.gov and the World Bank, and scrapes
Coefficient Giving, then scores every result with Gemini (or a built-in
fallback scorer if no Gemini key is configured yet).

## 1. Install

```bash
cd live-app
npm install
```

## 2. Add your Gemini API key (optional but recommended)

The app **works without a key** — it falls back to a simple keyword-matching
scorer. Add a key to get real AI scoring, summaries and Coefficient Giving
RFP classification.

1. Get a free key at **https://aistudio.google.com/app/apikey** (sign in
   with a Google account, click "Create API key").
2. Copy the example env file and paste your key in:

   ```bash
   cp .env.example .env
   ```

   Then open `live-app/.env` and set:

   ```
   GEMINI_API_KEY=your-key-here
   ```

`.env` is already in `.gitignore` — it is never committed, and the key is
only ever read on the backend (`server.js` / `lib/gemini.js`). It is never
sent to the browser or embedded in any frontend file.

## 3. Run it

```bash
npm start
```

Open **http://localhost:4000**. The app runs a live search automatically on
load, and every click of **Search now** runs a fresh one.

## What actually happens when you click "Search now"

1. **Grants.gov** — calls the official public `search2` / `fetchOpportunity`
   REST API (`https://api.grants.gov`). No key needed, no signup.
2. **World Bank** — calls the public Procurement Notices API
   (`https://search.worldbank.org/api/v2/procnotices`). No key needed.
   This replaces DevelopmentAid, which needs a paid membership Aceso hasn't
   authorized yet — the World Bank is Aceso's #1 preferred funder anyway,
   so this is a closer, free substitute, not a random stand-in.
3. **Coefficient Giving** — has no public API, so this is a real web
   monitor: it fetches `coefficientgiving.org/funds/global-health-wellbeing-opportunities/`,
   finds every linked "request-for-proposals-*" page, and reads each one.
   (Note: the site blocks Node's built-in `fetch` at the TLS-fingerprint
   level — `curl` doesn't trigger the same block, so this connector shells
   out to `curl`, which is preinstalled on Windows 10+/macOS/Linux.)
4. Every result is **deduplicated** (same title + funder → one record,
   sources merged) and run through the **knock-out rules** (closed
   deadline, budget far under threshold, individual-consultant-only, etc.)
   before scoring.
5. Whatever survives gets scored by **Gemini** — or the fallback keyword
   scorer if no key is set — against Aceso's real criteria (focus areas,
   activities, funders, budget, language rules). The score, fit tier,
   objective summary, eligibility read and review flags you see on every
   opportunity card and detail page all come from this step, live, every
   search. This is also what powers the "summary" you see when you click
   into an opportunity — there's no separate summarize button, the
   objective/explanation Gemini writes during scoring **is** the summary.
6. Results replace the app's data in place and every screen (Today,
   Opportunities, Pipeline status counts, Dashboard, the ROI panel)
   re-renders from the same live set.

## Project layout

```
live-app/
├── server.js                    Express app: serves the frontend + POST /api/search
├── connectors/
│   ├── grantsGov.js              Source 1 — public API
│   ├── worldBank.js              Source 2 — public API (DevelopmentAid substitute)
│   └── coefficientGiving.js      Source 3 — web monitor (curl + cheerio + Gemini)
├── lib/
│   ├── gemini.js                 Gemini REST call, no SDK dependency
│   ├── scoring.js                Knock-outs + Gemini/heuristic evaluation + prompts
│   ├── dedupe.js                 Cross-source duplicate detection
│   └── criteria.js               Default Aceso criteria (mirrors the Criteria page)
├── public/                       The frontend (same UI as the other iterations)
│   └── live-search.js            Wires #searchNow + initial load to POST /api/search
├── .env.example                  Copy to .env and add GEMINI_API_KEY
└── package.json
```

## Known limitations (honest list)

- Coefficient Giving relies on `curl` being available on PATH. If it isn't,
  the connector falls back to Node's native `fetch`, which the site's bot
  protection currently blocks — that source will just report 0 results
  rather than break the whole search (check the toast / `/api/search`
  response's `sources` field to see what actually ran).
- The fallback scorer (no Gemini key) is a simple keyword match — good
  enough to prove the pipeline end-to-end, not a real evaluation. Add a key
  for real scoring.
- World Bank notices don't have a stable public "view this exact notice"
  URL, so the official link points to a live search on
  `projects.worldbank.org` filtered by the project ID — verified to load,
  not a guessed deep link.
- This reuses the frontend's existing mock-data UI, so a few secondary
  surfaces (the Today page's exclusion-reason accordion, pipeline stage
  cards) still show illustrative example data rather than the live set —
  the primary flow (search → list → detail, with real scores and
  summaries) is fully live.
