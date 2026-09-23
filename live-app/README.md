# Aceso Intelligence — Live Search (real APIs)

This is the same Aceso Intelligence interface, wired to real, free data
sources instead of mock data. Clicking **Search now** makes real HTTP calls
across six sources (Grants.gov, World Bank, Coefficient Giving, Unitaid,
UNDP, UNGM), then scores every result with Gemini (or a built-in fallback
scorer if no Gemini key is configured yet).

**Opening the app does not start a search.** It loads the most recent saved
search instantly (if Firestore is configured — see step 3) or shows an
empty state. A fresh search only ever runs when you click **Search now** —
it's a real, Gemini-backed evaluation of every surviving opportunity and can
take several minutes on the free tier's rate limit, so it's never triggered
automatically.

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

The default model is `gemini-flash-lite-latest`; override with `GEMINI_MODEL`
in `.env` if a different one suits your key better (some free-tier models
have very small daily quotas — see `lib/gemini.js` for what's been tried).

## 3. Add search history (optional)

Without this, the app still works — it just starts empty every time and
nothing is saved. To persist every search and load the last one instantly
on open:

1. Create a Firebase project (Firestore, Standard edition) and generate a
   service account key (Project settings → Service accounts → Generate new
   private key).
2. Save that JSON file as `live-app/firebase-service-account.json` (already
   git-ignored — never commit it).
3. In `.env`, set `FIREBASE_SERVICE_ACCOUNT_PATH=./firebase-service-account.json`.

## 4. Run it

```bash
npm start
```

Open **http://localhost:4000**. Click **Search now** to run a live search.

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
   level — `curl` doesn't trigger the same block — see `lib/curlFetch.js`.)
4. **Unitaid** — same curl-based approach; scrapes the clean, structured
   `unitaid.org/consultancies-and-rfps/` page (title, objective, deadline,
   reference and — for each item — the real official UNGM link).
5. **UNDP** — no public API; `procurement-notices.undp.org` is a plain
   server-rendered page listing every currently-open notice worldwide
   (500+), pre-filtered by keyword before scoring so the pipeline doesn't
   choke on volume.
6. **UNGM** (UN Global Marketplace) — aggregates notices across every UN
   agency. Unlike the other sources, its search results only exist after
   client-side JavaScript runs, so a plain HTTP fetch gets nothing — this
   connector drives a real headless browser (Puppeteer, reusing one shared
   instance across searches so repeat searches don't pay a multi-second
   browser-launch cost each time). It auto-detects an installed Chrome or
   Edge; set `PUPPETEER_EXECUTABLE_PATH` in `.env` if it can't find yours.
7. Every result is **deduplicated** (same title + funder → one record,
   sources merged) and run through the **knock-out rules** (closed
   deadline, individual-consultant-only, goods/civil-works procurement,
   conflict-area country, etc.) before scoring.
8. Whatever survives gets scored by **Gemini** — or the fallback keyword
   scorer if no key is set — against Aceso's real criteria (focus areas,
   activities, funders, budget, language rules). The score, fit tier,
   objective summary, eligibility read and review flags you see on every
   opportunity card and detail page all come from this step, live, every
   search. This is also what powers the "summary" you see when you click
   into an opportunity — there's no separate summarize button, the
   objective/explanation Gemini writes during scoring **is** the summary.
9. Results replace the app's data in place and every screen (Today,
   Opportunities, Dashboard, the search-results summary) re-renders from
   the same live set; see "Persistence" below for what happens to them
   after that.

## Persistence (optional, via Firestore)

If `FIREBASE_SERVICE_ACCOUNT_PATH` is set (see step 3), every completed
search is saved as one document in the `searches` Firestore collection, and:

- `GET /api/search-history` lists past searches (keyword, timestamp, result
  count, per-source status) without their full result payload.
- `GET /api/search-history/:id` returns one full past search.
- `GET /api/search-history/latest` returns the most recent one — this is
  what the frontend loads instantly on page open.

This is history **per search run**, not a normalized, longitudinal model of
individual opportunities — "New" vs "Repeated" badges still only reflect
duplicates found within the same search, not tracked across different runs
over time. Without Firestore configured, the app works exactly as before:
in-memory only, empty on every fresh page load until you search.

## Project layout

```
live-app/
├── server.js                    Express app: serves the frontend + POST /api/search
├── connectors/
│   ├── grantsGov.js              Source 1 — public API
│   ├── worldBank.js              Source 2 — public API (DevelopmentAid substitute)
│   ├── coefficientGiving.js      Source 3 — web monitor (curl + cheerio + Gemini)
│   ├── unitaid.js                Source 4 — web monitor (curl + cheerio)
│   ├── undp.js                   Source 5 — web monitor (plain HTML, cheerio)
│   └── ungm.js                   Source 6 — web monitor (Puppeteer, JS-rendered)
├── lib/
│   ├── gemini.js                 Gemini REST call, throttled queue + retries, no SDK dependency
│   ├── scoring.js                Knock-outs + Gemini/heuristic evaluation + prompts
│   ├── dedupe.js                 Cross-source duplicate detection
│   ├── criteria.js               Default Aceso criteria (mirrors the Criteria page)
│   ├── curlFetch.js              Shared curl-based fetch for TLS-fingerprint-blocked sites
│   ├── browser.js                Shared Puppeteer browser instance (for UNGM)
│   ├── firebase.js               Firestore Admin SDK connection (optional)
│   └── searchHistory.js          Save/list/get past searches in Firestore
├── public/                       The frontend (same UI as the other iterations)
│   └── live-search.js            Wires #searchNow + initial load to POST /api/search
├── .env.example                  Copy to .env and add GEMINI_API_KEY
└── package.json
```

## Known limitations (honest list)

- No database by default — see "Persistence (optional, via Firestore)" above.
- Gemini scoring is rate-limited to the free tier's quota (default 5
  requests/minute, configurable via `GEMINI_RPM`), so a full search can take
  several minutes — this is expected, not a bug.
- Coefficient Giving and Unitaid rely on `curl` being available on PATH
  (preinstalled on Windows 10+/macOS/Linux). If it isn't, they fall back
  to Node's native `fetch`, which both sites' bot protection blocks — that
  source will just report 0 results rather than break the whole search
  (check the toast / `/api/search` response's `sources` field to see what
  actually ran).
- UNGM needs a real Chrome or Edge installed on the machine running the
  server (it auto-detects common install paths). Without one, that source
  reports itself unavailable but the other five still work.
- UNGM is noticeably slower than the other sources (real browser render,
  ~5-7s) — fetching all six sources' raw listings typically takes 6-10s
  total since they run in parallel, bounded by the slowest one. That's
  separate from the Gemini scoring step afterward, which is the part that
  can take several minutes (see the rate-limit bullet above).
- The fallback scorer (no Gemini key) is a simple keyword match — good
  enough to prove the pipeline end-to-end, not a real evaluation. Add a key
  for real scoring.
- World Bank notices don't have a stable public "view this exact notice"
  URL, so the official link points to a live search on
  `projects.worldbank.org` filtered by the project ID — verified to load,
  not a guessed deep link.
- The primary flow (search → list → detail → excluded panel → dashboard,
  with real scores, summaries and knock-out reasons) is fully live and
  data everywhere is either computed from real results or an honest empty
  state — no fabricated numbers or names remain in the UI. The Pipeline &
  Proposals tab shows an honest "not connected to real data yet" state:
  there's no backend model yet for tracking which opportunities have been
  approved to pursue or what stage they're in.
