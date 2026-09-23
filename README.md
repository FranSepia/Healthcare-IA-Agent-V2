# Aceso Intelligence

Real-time opportunity tracking for Aceso Global: a small Node/Express backend
in `live-app/` that searches six free public sources (Grants.gov, World Bank,
Coefficient Giving, Unitaid, UNDP, UNGM), deduplicates and scores everything
with Gemini (falling back to a heuristic scorer if no key is set), and serves
a frontend wired to those real results.

See `live-app/README.md` for setup, environment variables, and exactly where
to put your Gemini API key.

## Data and history

Search results are **not** persisted by default. Set `FIREBASE_SERVICE_ACCOUNT_PATH`
in `live-app/.env` to enable optional Firestore history: every completed
search is saved, the app loads the most recent one instantly on open, and
past searches are queryable via `GET /api/search-history`.

Opening the app does **not** start a new search automatically — it loads the
last saved search (if Firestore is configured) or shows an empty state.
Click **Search now** to run a fresh search against all six sources.

## Security note

No real credential or API key is ever stored in this repository or sent to
the browser. `live-app/.env` (holding `GEMINI_API_KEY`) and
`live-app/firebase-service-account.json` are both git-ignored; both are only
ever read server-side.

## Earlier static prototypes

Two static HTML/CSS/JS design prototypes (`Clon HTML YAEL/` and
`Clon HTML YAEL - ROI Iteration/`) preceded `live-app/` and are no longer
part of `main` — they used mock/hardcoded data with no backend. They're
preserved for reference at the `static-prototypes-archived` tag.
