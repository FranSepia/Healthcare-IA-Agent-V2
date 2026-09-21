# Aceso Intelligence — Live Search (real APIs)

This is the same Aceso Intelligence interface, now wired to real, free data
sources instead of mock data. Clicking **Search now** — or just opening the
app — makes real HTTP calls across six sources (Grants.gov, World Bank,
Coefficient Giving, Unitaid, UNDP, UNGM), then scores every result with
Gemini (or a built-in fallback scorer if no Gemini key is configured yet).

**No database is connected.** Every search is stateless: the server fetches
live, scores, and returns — nothing is saved anywhere. Refresh the page,
restart the server, or search again, and there is no memory of the
previous run. A second search for the same keyword can return different
results than the first (sources change) and there is no way to tell
"new since yesterday" from "same as always" — that needs real storage
(see "No persistence yet" below).

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
   Opportunities, Pipeline status counts, Dashboard, the ROI panel)
   re-renders from the same live set — then are discarded; see "No
   persistence yet" below.

## No persistence yet

There is currently no database. Everything above happens in memory, once,
per request. Concretely, this means:

- No history. Yesterday's search results are gone the moment a new search
  runs (or the server restarts) — there's no record to compare against.
- "New" vs "Repeated" badges only reflect duplicates found **within the
  same search**, not across different searches over time.
- The ROI dashboard's Day-1/2/3 style metrics are illustrative for the
  current run only, not a real multi-day comparison.

To add real history (recommended next step, not yet built): a lightweight
option is SQLite via `better-sqlite3` — no server to run, just a file —
storing each search's results with a `first_seen_at`/`last_seen_at` per
opportunity (keyed by source + sourceOpportunityId) so repeat searches can
tell genuinely new opportunities from ones already seen, and the ROI panel
can compare real days instead of one snapshot.

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
│   ├── gemini.js                 Gemini REST call, no SDK dependency
│   ├── scoring.js                Knock-outs + Gemini/heuristic evaluation + prompts
│   ├── dedupe.js                 Cross-source duplicate detection
│   ├── criteria.js               Default Aceso criteria (mirrors the Criteria page)
│   ├── curlFetch.js              Shared curl-based fetch for TLS-fingerprint-blocked sites
│   └── browser.js                Shared Puppeteer browser instance (for UNGM)
├── public/                       The frontend (same UI as the other iterations)
│   └── live-search.js            Wires #searchNow + initial load to POST /api/search
├── .env.example                  Copy to .env and add GEMINI_API_KEY
└── package.json
```

## Known limitations (honest list)

- No database — see "No persistence yet" above.
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
  ~5-7s) — a full six-source search typically takes 6-10s total since
  sources run in parallel, bounded by the slowest one.
- The fallback scorer (no Gemini key) is a simple keyword match — good
  enough to prove the pipeline end-to-end, not a real evaluation. Add a key
  for real scoring.
- World Bank notices don't have a stable public "view this exact notice"
  URL, so the official link points to a live search on
  `projects.worldbank.org` filtered by the project ID — verified to load,
  not a guessed deep link.
- This reuses the frontend's existing mock-data UI. The primary flow
  (search → list → detail → excluded panel, with real scores, summaries
  and knock-out reasons) is fully live; the Pipeline tab's stage cards
  still show illustrative example data, since that view was designed
  around a proposal-tracking workflow, not raw search results.
