# Aceso Intelligence — Prototype Clones

Static HTML/CSS/JS clones of the Aceso Intelligence opportunity-tracking prototype (originally from `aceso-intelligence-today-review.yael-rubio24.chatgpt.site`), extended with real Aceso Global criteria and a three-source intelligence model (Grants.gov, DevelopmentAid, Coefficient Giving).

No backend, no build step — each folder is a self-contained static site (open `index.html` or serve the folder statically).

## Folders

- **`Clon HTML YAEL/`** — First iteration. Clone of the original prototype plus:
  - Source badges (Grants.gov / DevelopmentAid / Coefficient Giving) and RFP-status classification (Open RFP / Closed RFP / Informational Announcement / Potential Future Opportunity) on every opportunity.
  - An 8-criterion "Sources" page documenting the three-source connector design and the open questions for Aceso (DevelopmentAid membership, monitored Coefficient Giving pages, the MNCH criteria conflict).
  - Criteria audited against Aceso's real backend spec (language, budget thresholds, geography red flags).

- **`Clon HTML YAEL - ROI Iteration/`** — Second iteration, prepared for a three-day ROI validation pilot. Same visual design and navigation, with:
  - **Criteria** rebuilt with Aceso's actual criteria (Focus Areas, Activities, Priority Regions, Preferred Funders, Budget, Languages, Quick Knock-outs, Review Flags, the MNCH open question) — every list is editable in the UI (add/remove/toggle, persisted to `localStorage`, with a reset-to-defaults option per criterion).
  - A normalized opportunity data model (source ID, objective/scope, eligibility, qualifications, language, location/travel, RFP availability, keywords, first/last detected, duplicate status, review flags, explainable 10-factor fit score).
  - Duplicate detection (New / Repeated / Possible Duplicate badges, merged-source records).
  - A "Future opportunities watchlist" separating non-Open-RFP Coefficient Giving items from the active review queue.
  - A three-day ROI validation dashboard section (agent-only / manual-only / found-by-both, false positives/negatives, review time, results by source/region/thematic area).

- **`live-app/`** *(branch `feature/live-integration` only)* — The real, working version: a small Node/Express backend that actually calls Grants.gov and the World Bank (both free, public, no key), scrapes Coefficient Giving, deduplicates and scores everything with Gemini (or a fallback scorer if no key is set), and serves the same frontend wired to real data. Clicking **Search now** runs a real search. See `live-app/README.md` for setup and exactly where to put your Gemini API key.

## Security note

These are frontend-only prototypes with mock data — except `live-app/`, which is a real backend. Even there, no real credential or API key is ever stored in this repository or sent to the browser: `live-app/.env` (holding `GEMINI_API_KEY`) is git-ignored, and the key is only ever read server-side.
