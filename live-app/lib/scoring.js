const { callGemini, hasGeminiKey } = require('./gemini');
const { DEFAULT_CRITERIA, FIXED_FLAGS, activeLabels } = require('./criteria');

function parseBudgetNumber(value) {
  if (!value || typeof value !== 'string') return null;
  const text = value.replace(/,/g, '');
  const match = text.match(/\$?\s*([0-9]+(?:\.[0-9]+)?)(?:\s*(?:-|–|to)\s*\$?\s*([0-9]+(?:\.[0-9]+)?))?\s*(billion|million|thousand|bn|m|k)?(?![a-z])/i);
  if (!match) return null;
  const low = Number(match[1]);
  const high = match[2] ? Number(match[2]) : low;
  const unit = (match[3] || '').toLowerCase();
  const mult = unit === 'billion' || unit === 'bn' ? 1e9 : unit === 'million' || unit === 'm' ? 1e6 : unit === 'thousand' || unit === 'k' ? 1e3 : 1;
  // For a range ("$10-30 million") the ceiling is what counts against a minimum.
  return Math.max(low, high) * mult;
}

// The two budget flags are derived from the parsed value, so they are always
// recomputed from it — Gemini's own flags or a stale saved result can't
// contradict what the table shows.
const LARGE_BUDGET = 5e6;

function reconcileBudgetFlags(flags, value, min = DEFAULT_CRITERIA.budget.min, flagLarge = DEFAULT_CRITERIA.budget.flagLarge) {
  const rest = (flags || []).filter(f => f !== 'Budget not published' && !FIXED_FLAGS.includes(f));
  if (!value || value === 'Not disclosed') return [...rest, 'Budget not published'];
  const amount = parseBudgetNumber(value);
  if (amount == null) return rest;
  if (amount < min) return [...rest, 'Clearly insufficient budget'];
  if (flagLarge && amount >= LARGE_BUDGET) return [...rest, 'Very large budget — check capacity'];
  return rest;
}

function fitTierFor(score, disqualified) {
  if (disqualified) return 'Low Fit';
  if (score >= 85) return 'Strong Fit';
  if (score >= 65) return 'Potential Fit — Human Review Required';
  return 'Low Fit';
}

// Patterns for notices that are goods/works procurement, not advisory
// services — Aceso's "Excessive focus on physical infrastructure" /
// goods-procurement knock-out. Checked against title + description.
const GOODS_OR_WORKS_PATTERN = /\b(procurement of|supply of|delivery of|purchase of)\b.{0,40}\b(goods|equipment|vehicles?|ambulances?|dental chairs?|medical equipment|furniture|generators?|drugs|medicines|pharmaceuticals)\b|\bcivil works\b|\bconstruction (of|supervision)\b|plant design,?\s*supply,?\s*(and\s*)?installation|\bwarehousing\b|\brehabilitation of\b.{0,30}\b(building|infrastructure|facility|plant)\b/i;

const CONFLICT_AREA_COUNTRIES = ['Syria', 'Yemen', 'Afghanistan', 'Somalia', 'South Sudan', 'Ukraine', 'Sudan', 'Libya'];

// Pure-code hard knock-outs, applied before any LLM call — mirrors the
// "quick knock-outs first" design from the Aceso backend spec. Only rules
// that can be checked reliably from structured fields or clear text
// patterns run here; anything requiring judgment (vague scope, indirect
// eligibility red flags) is left to the Gemini/heuristic evaluation step
// as a review flag instead, per "ante la duda, incluir."
function runKnockouts(opp, criteria) {
  const flags = [];
  const active = new Set(activeLabels(criteria?.knockouts, DEFAULT_CRITERIA.knockouts));
  const min = criteria?.budget?.min ?? DEFAULT_CRITERIA.budget.min;
  const amount = parseBudgetNumber(opp.value);
  const titleLower = (opp.title || '').toLowerCase();
  const combinedText = `${opp.title || ''} ${opp.raw?.description || ''}`;
  let disqualified = false;
  let reason = null;

  // "Already closed" is filtered out entirely in server.js before this ever
  // runs — a closed notice isn't worth reviewing, active or excluded.

  const individualRule = active.has('Restricted to individual consultants, not firms');
  if (!disqualified && individualRule && /individual consultant/i.test(opp.raw?.procurementMethod || '')) {
    disqualified = true;
    reason = 'Restricted to individual consultants, not firms';
  }
  if (!disqualified && individualRule && /individual consultant/.test(titleLower)) {
    disqualified = true;
    reason = 'Restricted to individual consultants, not firms';
  }

  if (!disqualified && active.has('Excessive focus on physical infrastructure') && GOODS_OR_WORKS_PATTERN.test(combinedText)) {
    disqualified = true;
    reason = 'Excessive focus on physical infrastructure (goods/civil-works procurement, not advisory services)';
  }

  if (!disqualified && active.has('Work located in a conflict area') && CONFLICT_AREA_COUNTRIES.some(c => (opp.country || '').includes(c))) {
    disqualified = true;
    reason = 'Work located in a conflict area';
  }

  if (!disqualified && amount != null && amount < min) {
    flags.push('Clearly insufficient budget');
  }
  if (!opp.value || opp.value === 'Not disclosed') {
    flags.push('Budget not published');
  }

  return { disqualified, reason, flags };
}

function heuristicEvaluate(opp, criteria) {
  const areas = criteria?.focusAreas?.length ? criteria.focusAreas : DEFAULT_CRITERIA.focusAreas;
  const text = `${opp.title} ${opp.raw?.description || ''}`.toLowerCase();
  const matched = areas.filter(a => text.includes(a.toLowerCase().split(' ').slice(0, 2).join(' ')) || text.includes(a.toLowerCase().split(' ')[0]));
  let score = 42 + Math.min(48, matched.length * 14);
  const funders = [...(criteria?.fundersMDB || DEFAULT_CRITERIA.fundersMDB), ...(criteria?.fundersGov || DEFAULT_CRITERIA.fundersGov), ...(criteria?.fundersUS || DEFAULT_CRITERIA.fundersUS)];
  if (funders.some(f => (opp.org || '').toLowerCase().includes(f.toLowerCase()))) score += 8;
  const keywords = Array.isArray(criteria?.keywords) ? criteria.keywords : DEFAULT_CRITERIA.keywords;
  score += Math.min(9, 3 * keywords.filter(k => k && text.includes(String(k).toLowerCase())).length);
  score = Math.min(96, score);
  return {
    score,
    pillar: matched[0] || 'Health systems',
    objective: (opp.raw?.description || '').slice(0, 220) || `${opp.org} opportunity in ${opp.country}.`,
    eligibility: opp.raw?.eligibility || 'See official listing',
    qualifications: 'See official listing',
    keywords: matched.slice(0, 4),
    explanation: matched.length
      ? `Keyword match against Aceso's focus areas (${matched.slice(0, 2).join(', ')}). This is the no-API-key fallback scorer — add GEMINI_API_KEY for a full semantic evaluation.`
      : `No strong keyword match found against Aceso's focus areas. This is the no-API-key fallback scorer — add GEMINI_API_KEY for a full semantic evaluation.`
  };
}

function buildPrompt(opp, criteria) {
  const c = { ...DEFAULT_CRITERIA, ...criteria };
  const lang = { ...DEFAULT_CRITERIA.languages, ...(criteria?.languages || {}) };
  const extra = Array.isArray(criteria?.extraLanguages) ? criteria.extraLanguages : DEFAULT_CRITERIA.extraLanguages;
  const accepted = [lang.english && 'English', lang.spanish && 'Spanish', lang.portuguese && 'Portuguese', ...extra].filter(Boolean);
  const keywords = Array.isArray(criteria?.keywords) ? criteria.keywords : DEFAULT_CRITERIA.keywords;
  const deadlineDays = Math.max(1, Number(criteria?.deadlineDays) || DEFAULT_CRITERIA.deadlineDays);
  const knockouts = activeLabels(criteria?.knockouts, DEFAULT_CRITERIA.knockouts);
  const flagOptions = activeLabels(criteria?.reviewFlags, DEFAULT_CRITERIA.reviewFlags).filter(f => f !== 'Budget not published');
  const funders = [...c.fundersMDB, ...(c.fundersPhilanthropic || []), ...c.fundersGov, ...c.fundersUS].filter(f => !/add specific names/i.test(f));
  return `You are the screening agent for Aceso Global, a health-systems consulting firm. Evaluate ONE procurement/funding opportunity against Aceso's criteria and return ONLY a JSON object (no prose, no markdown fences).

ACESO CRITERIA
Focus areas: ${c.focusAreas.join('; ')}
Relevant activities: ${c.activities.join('; ')}
Priority regions (bonus, not required): ${c.regions.join('; ')}
Preferred funders (bonus signal): ${funders.join('; ')}
Priority keywords (a match raises relevance, but never overrides the actual deliverables or applicant type): ${keywords.join('; ') || 'none'}
Preferred minimum budget: $${c.budget.min.toLocaleString('en-US')} USD (a soft review threshold, not an automatic rejection)
Accepted languages: ${accepted.join(', ') || 'none configured'} outright; French ${lang.frenchReview ? 'is never auto-accepted or auto-rejected — score it normally and add the review flag "French — human review"' : 'is not accepted'}; anything else is usually low fit.

OPPORTUNITY
Title: ${opp.title}
Funder/organization: ${opp.org}
Country/region: ${opp.country}
Type: ${opp.type}
Value: ${opp.value}
Deadline: ${opp.due} (today is ${new Date().toISOString().slice(0, 10)}; add the "Tight submission deadline" flag if it is less than ${deadlineDays} days away)
Source: ${opp.source}
Description / notice text (may be partial): ${(opp.raw?.description || '').slice(0, 3000)}

First check the Aceso quick knock-outs below. If ANY clearly apply, set
"disqualified": true and stop scoring meaningfully (score should be low).
Only disqualify on a clear match — if it's ambiguous, do NOT disqualify;
leave it for human review instead (score normally, add a review flag).

QUICK KNOCK-OUTS (any one, if clearly true, disqualifies — use the exact wording as disqualifiedReason):
${knockouts.length ? knockouts.join('; ') : '(none active — do not disqualify)'}.
"Excessive focus on physical infrastructure" means procurement of goods, equipment or civil works/construction rather than an advisory/consulting assignment.
The budget is never a knock-out.

Return this exact JSON shape:
{
  "score": <integer 0-100, thematic+activity+regional+funder+budget+eligibility fit — irrelevant if disqualified is true>,
  "disqualified": <true or false>,
  "disqualifiedReason": "<the specific knock-out that applied, or null>",
  "pillar": "<the single best-matching focus area from the list above>",
  "objective": "<1-2 sentence plain-English summary of what the opportunity actually asks for>",
  "eligibility": "<1 sentence: who can apply, any red flags (national-firm-only, in-country incorporation, etc.)>",
  "qualifications": "<1 sentence: required qualifications/experience if stated, else 'Not specified'>",
  "keywords": ["<3-5 short keyword phrases>"],
  "reviewFlags": ["<zero or more, exact wording, only from: ${[...flagOptions, ...(lang.frenchReview ? ['French — human review'] : [])].join(', ') || '(none)'}>"],
  "explanation": "<2-3 sentences explaining the score or the disqualification, written for a human analyst>"
}`;
}

function buildCoefficientPrompt(pageTitle, url, text) {
  return `You are monitoring coefficientgiving.org for Aceso Global, a health-systems consulting firm. You were given the text of ONE page from that site. Decide whether it is an actual Request for Proposals / funding opportunity notice, or just a blog post, research article, staff announcement or general news. Return ONLY a JSON object (no prose, no markdown fences).

PAGE TITLE: ${pageTitle}
URL: ${url}
PAGE TEXT (may be partial):
${text.slice(0, 6000)}

Return this exact JSON shape:
{
  "isRfp": <true or false — false for blog posts, research summaries, staff bios, general news>,
  "classification": "<one of: Open RFP, Closed RFP, Informational Announcement, Potential Future Opportunity — only meaningful if isRfp is true>",
  "title": "<clean opportunity title>",
  "objective": "<1-2 sentence summary of what is being funded/requested>",
  "amount": "<funding amount as stated, or 'Not disclosed'>",
  "eligibility": "<1 sentence on who can apply>",
  "deadline": "<deadline as stated in the text, in any readable format, or 'Not specified'>",
  "thematicArea": "<the general health/wellbeing theme>"
}`;
}

async function evaluateOpportunity(opp, criteria) {
  const knockout = runKnockouts(opp, criteria);
  if (knockout.disqualified) {
    return {
      score: 20,
      fitTier: 'Low Fit',
      pillar: opp.pillar || 'Not evaluated',
      objective: opp.raw?.description ? opp.raw.description.slice(0, 200) : `${opp.org} opportunity in ${opp.country}.`,
      eligibility: opp.raw?.eligibility || 'Not evaluated — knocked out before scoring',
      qualifications: 'Not evaluated',
      keywords: [],
      reviewFlags: [],
      explanation: `Excluded automatically: ${knockout.reason}.`,
      knockedOut: true,
      knockoutReason: knockout.reason
    };
  }

  let evaluation;
  let usedGemini = false;
  if (hasGeminiKey()) {
    try {
      const geminiStart = Date.now();
      const raw = await callGemini(buildPrompt(opp, criteria));
      console.log(`[scoring] Gemini call for "${opp.title.slice(0, 60)}" took ${Date.now() - geminiStart}ms`);
      if (raw.disqualified) {
        return {
          score: 15,
          fitTier: 'Low Fit',
          pillar: raw.pillar || 'Not evaluated',
          objective: raw.objective || '',
          eligibility: raw.eligibility || 'Not evaluated — knocked out before scoring',
          qualifications: 'Not evaluated',
          keywords: [],
          reviewFlags: [],
          explanation: raw.explanation || `Excluded: ${raw.disqualifiedReason || 'matched a hard knock-out rule'}.`,
          knockedOut: true,
          knockoutReason: raw.disqualifiedReason || 'Matched a hard knock-out rule',
          usedGemini: true
        };
      }
      evaluation = {
        score: Math.max(0, Math.min(100, Number(raw.score) || 0)),
        pillar: raw.pillar || 'Health systems',
        objective: raw.objective || '',
        eligibility: raw.eligibility || 'See official listing',
        qualifications: raw.qualifications || 'Not specified',
        keywords: Array.isArray(raw.keywords) ? raw.keywords.slice(0, 5) : [],
        explanation: raw.explanation || '',
        reviewFlags: Array.isArray(raw.reviewFlags) ? raw.reviewFlags : []
      };
      usedGemini = true;
    } catch (err) {
      console.error(`[scoring] Gemini call failed for "${opp.title}": ${err.message}. Falling back to heuristic scorer.`);
      evaluation = heuristicEvaluate(opp, criteria);
    }
  } else {
    evaluation = heuristicEvaluate(opp, criteria);
  }

  // Gemini picks its own reviewFlags independently of the deterministic
  // checks above and can disagree with them — e.g. flagging "Budget not
  // published" even though a real value was extracted from the source.
  // The parsed opp.value is the ground truth for this specific flag, so
  // it always wins over whatever Gemini said.
  let reviewFlags = Array.from(new Set([...(evaluation.reviewFlags || []), ...knockout.flags]));
  reviewFlags = reconcileBudgetFlags(reviewFlags, opp.value, criteria?.budget?.min ?? DEFAULT_CRITERIA.budget.min, criteria?.budget?.flagLarge ?? DEFAULT_CRITERIA.budget.flagLarge);
  // Only flags switched on in Criteria (plus the budget flags enforced in code) survive.
  const allowed = new Set([...activeLabels(criteria?.reviewFlags, DEFAULT_CRITERIA.reviewFlags), ...FIXED_FLAGS, 'French — human review']);
  reviewFlags = reviewFlags.filter(f => allowed.has(f));
  const fitTier = fitTierFor(evaluation.score, false);

  return { ...evaluation, fitTier, reviewFlags, knockedOut: false, usedGemini };
}

// The frontend orders the context most-important-first, so this cap only
// ever trims the tail (Knowledge Base profiles) on unusually large searches.
const COPILOT_CONTEXT_CHARS = 150000;

function buildCopilotPrompt(question, context) {
  return `You are Aceso Copilot, a business-development analyst assistant embedded in Aceso Global's health-systems consulting opportunity dashboard. You can see everything the app shows: every screen, every opportunity, the numbers behind every chart and card, the Knowledge Base and the screening criteria. Answer the user's question using ONLY the data below — never invent specific numbers, organization names, countries or opportunities that aren't present in it. If the data doesn't contain what's needed to answer, say so plainly instead of guessing. Anything marked as example / illustrative data (isExampleData, examplePipeline, hatched example bars) is not real — say so whenever your answer relies on it. Reply in the same language as the question. Helpful analyst tone, plain text (no markdown): usually 2-5 sentences, or a short list of lines starting with "- " when the question asks for several items. Explaining a chart may take up to ~8 short lines.

How to explain the screens and charts: "currentScreen" is the screen the user is looking at right now (with its visible text) — use it to resolve "this", "here", "this chart" or "this screen". "dashboardInsights" and "dashboardCharts" describe every Dashboard visualization: "chart" is its title as shown, "how" is exactly how it is computed, and the remaining fields are its current values. When asked to explain a chart: say what it shows, how it is calculated (from "how"), what the current numbers say (cite the actual values), and one practical takeaway; mention if it uses example data. "dashboardInsights.analystTimeSaved" explains the hours-saved card on Opportunities and the hours chart on the Dashboard, including the minutes-per-notice assumption. "dashboardKpis" are the headline Dashboard cards. "knowledgeBase.projects" is the Experience Explorer (Aceso's past projects by thematic area) and "knowledgeBase.team" is Team & CVs (people, roles, expertise, related projects) — only "verified" project links are confirmed; "suggested" ones must be validated against internal CVs, say so. "screeningCriteria" is what the Criteria screen is set to. "discardedOpportunities" lists what the rules excluded and why.

How to read the opportunity data: "today" is the current date. "allRelevantOpportunities" are real search results that passed screening; "deadlineAsPublished" is the deadline exactly as shown in the app and "deadlineISO" is the same date normalized (null when it could not be parsed, e.g. no year). "upcomingDeadlinesSoonestFirst" is already sorted and excludes past dates. "agentStatus" is the agent's recommendation ("Recommended", "Decision needed" or "Low fit") and a "reviewState" of "Agent screened" means it is still waiting for a human review/approval decision. "examplePipeline.proposals" are illustrative example proposals with their own deadlines, owners, progress and next actions. When you cite a deadline, use the value from the data. For questions about deadlines, proposals in progress or pending decisions, list each item on its own line as "- <title> (<org or funder>) — <date or next action>", soonest first (at most 8 lines), in two labeled groups: first the real opportunities, then the example pipeline proposals (say they are illustrative). For pending decisions, name the real opportunities whose agentStatus is "Decision needed" or "Recommended" (highest fit first) and say the total count. Never give dates without the title they belong to.

How to read the data: "today" is the current date. "allRelevantOpportunities" are real search results that passed screening; "deadlineAsPublished" is the deadline exactly as shown in the app and "deadlineISO" is the same date normalized (null when it could not be parsed, e.g. no year). "upcomingDeadlinesSoonestFirst" is already sorted and excludes past dates. "agentStatus" is the agent's recommendation ("Recommended", "Decision needed" or "Low fit") and a "reviewState" of "Agent screened" means it is still waiting for a human review/approval decision. "examplePipeline.proposals" are illustrative example proposals with their own deadlines, owners, progress and next actions. When you cite a deadline, use the value from the data. For questions about deadlines, proposals in progress or pending decisions, list each item on its own line as "- <title> (<org or funder>) — <date or next action>", soonest first (at most 8 lines), in two labeled groups: first the real opportunities, then the example pipeline proposals (say they are illustrative). For pending decisions, name the real opportunities whose agentStatus is "Decision needed" or "Recommended" (highest fit first) and say the total count. Never give dates without the title they belong to.

APP DATA (JSON):
${JSON.stringify(context).slice(0, COPILOT_CONTEXT_CHARS)}

QUESTION: ${question}

Return ONLY this JSON shape (no prose, no markdown fences): {"answer": "<your answer>"}`;
}

module.exports = { evaluateOpportunity, buildCoefficientPrompt, buildCopilotPrompt, runKnockouts, parseBudgetNumber, reconcileBudgetFlags };
