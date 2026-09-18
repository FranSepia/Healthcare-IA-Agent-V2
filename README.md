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

## Security note

These are frontend-only prototypes with mock data. No real credential, API key or DevelopmentAid login is stored anywhere in this repository — production connections to Grants.gov, DevelopmentAid or any other source must keep keys in backend environment variables, never in client-side code.
