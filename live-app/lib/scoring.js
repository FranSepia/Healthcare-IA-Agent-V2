const { callGemini, hasGeminiKey } = require('./gemini');
const { DEFAULT_CRITERIA } = require('./criteria');

function parseBudgetNumber(value) {
  if (!value || typeof value !== 'string') return null;
  const match = value.replace(/,/g, '').match(/\$?([0-9.]+)\s*(M|K)?/i);
  if (!match) return null;
  const n = Number(match[1]);
  if (Number.isNaN(n)) return null;
  const mult = /M/i.test(match[2] || '') ? 1e6 : /K/i.test(match[2] || '') ? 1e3 : 1;
  return n * mult;
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
  const min = criteria?.budget?.min ?? DEFAULT_CRITERIA.budget.min;
  const amount = parseBudgetNumber(opp.value);
  const titleLower = (opp.title || '').toLowerCase();
  const combinedText = `${opp.title || ''} ${opp.raw?.description || ''}`;
  let disqualified = false;
  let reason = null;

  // "Already closed" is filtered out entirely in server.js before this ever
  // runs — a closed notice isn't worth reviewing, active or excluded.

  if (!disqualified && /individual consultant/i.test(opp.raw?.procurementMethod || '')) {
    disqualified = true;
    reason = 'Restricted to individual consultants, not firms';
  }
  if (!disqualified && /individual consultant/.test(titleLower)) {
    disqualified = true;
    reason = 'Restricted to individual consultants, not firms';
  }

  if (!disqualified && GOODS_OR_WORKS_PATTERN.test(combinedText)) {
    disqualified = true;
    reason = 'Excessive focus on physical infrastructure (goods/civil-works procurement, not advisory services)';
  }

  if (!disqualified && CONFLICT_AREA_COUNTRIES.some(c => (opp.country || '').includes(c))) {
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
  return `You are the screening agent for Aceso Global, a health-systems consulting firm. Evaluate ONE procurement/funding opportunity against Aceso's criteria and return ONLY a JSON object (no prose, no markdown fences).

ACESO CRITERIA
Focus areas: ${c.focusAreas.join('; ')}
Relevant activities: ${c.activities.join('; ')}
Priority regions (bonus, not required): ${c.regions.join('; ')}
Preferred funders (bonus signal): ${[...c.fundersMDB, ...c.fundersGov, ...c.fundersUS].join('; ')}
Preferred minimum budget: $${c.budget.min.toLocaleString('en-US')} USD (a soft review threshold, not an automatic rejection)
Accepted languages: English, Spanish, Portuguese outright; French needs human review; anything else is usually low fit.

OPPORTUNITY
Title: ${opp.title}
Funder/organization: ${opp.org}
Country/region: ${opp.country}
Type: ${opp.type}
Value: ${opp.value}
Deadline: ${opp.due}
Source: ${opp.source}
Description / notice text (may be partial): ${(opp.raw?.description || '').slice(0, 3000)}

First check the Aceso quick knock-outs below. If ANY clearly apply, set
"disqualified": true and stop scoring meaningfully (score should be low).
Only disqualify on a clear match — if it's ambiguous, do NOT disqualify;
leave it for human review instead (score normally, add a review flag).

QUICK KNOCK-OUTS (any one, if clearly true, disqualifies):
Restricted to individual consultants, not firms; full-time in-country
presence required; local incorporation required; eligibility restricted to
a country/region that excludes Aceso; work located in a conflict area;
this is procurement of goods, equipment or civil works/construction, not
an advisory/consulting assignment; scope of work too vague to evaluate;
opportunity already closed (deadline passed).

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
  "reviewFlags": ["<zero or more from: Tight submission deadline, Missing or incomplete TOR/RFP, Budget not published, Unfamiliar or inconsistent funder, Unclear eligibility, Limited information available>"],
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
  const hasPublishedBudget = opp.value && opp.value !== 'Not disclosed';
  if (hasPublishedBudget) reviewFlags = reviewFlags.filter(f => f !== 'Budget not published');
  const fitTier = fitTierFor(evaluation.score, false);

  return { ...evaluation, fitTier, reviewFlags, knockedOut: false, usedGemini };
}

function buildCopilotPrompt(question, context) {
  return `You are Aceso Copilot, a business-development analyst assistant embedded in Aceso Global's health-systems consulting opportunity dashboard. Answer the user's question using ONLY the data below — never invent specific numbers, organization names, countries or opportunities that aren't present in it. If the data doesn't contain what's needed to answer, say so plainly instead of guessing. Some of the "pipeline" data is explicitly marked as illustrative example data, not real — say so if the question is about it. Reply in the same language as the question. Be concise and in a helpful analyst tone, plain text (no markdown): 2-4 sentences, or a short list of lines starting with "- " when the question asks for several items (for example deadlines).

How to read the data: "today" is the current date. "allRelevantOpportunities" are real search results that passed screening; "deadlineAsPublished" is the deadline exactly as shown in the app and "deadlineISO" is the same date normalized (null when it could not be parsed, e.g. no year). "upcomingDeadlinesSoonestFirst" is already sorted and excludes past dates. "agentStatus" is the agent's recommendation ("Recommended", "Decision needed" or "Low fit") and a "reviewState" of "Agent screened" means it is still waiting for a human review/approval decision. "examplePipeline.proposals" are illustrative example proposals with their own deadlines, owners, progress and next actions. When you cite a deadline, use the value from the data. For questions about deadlines, proposals in progress or pending decisions, list each item on its own line as "- <title> (<org or funder>) — <date or next action>", soonest first (at most 8 lines), in two labeled groups: first the real opportunities, then the example pipeline proposals (say they are illustrative). For pending decisions, name the real opportunities whose agentStatus is "Decision needed" or "Recommended" (highest fit first) and say the total count. Never give dates without the title they belong to.

DASHBOARD DATA (JSON):
${JSON.stringify(context).slice(0, 24000)}

QUESTION: ${question}

Return ONLY this JSON shape (no prose, no markdown fences): {"answer": "<your answer>"}`;
}

module.exports = { evaluateOpportunity, buildCoefficientPrompt, buildCopilotPrompt, runKnockouts, parseBudgetNumber };
