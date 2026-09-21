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

// Pure-code hard knock-outs, applied before any LLM call — mirrors the
// "quick knock-outs first" design from the Aceso backend spec.
function runKnockouts(opp, criteria) {
  const flags = [];
  const min = criteria?.budget?.min ?? DEFAULT_CRITERIA.budget.min;
  const amount = parseBudgetNumber(opp.value);
  let disqualified = false;
  let reason = null;

  if (opp.due) {
    const parsed = Date.parse(opp.due);
    if (!Number.isNaN(parsed) && parsed < Date.now()) {
      disqualified = true;
      reason = 'Opportunity already closed';
    }
  }
  if (!disqualified && amount != null && amount < min) {
    flags.push('Clearly insufficient budget');
  }
  if (!opp.value || opp.value === 'Not disclosed') {
    flags.push('Budget not published');
  }
  const titleLower = (opp.title || '').toLowerCase();
  if (/individual consultant/.test(titleLower)) {
    flags.push('Restricted to individual consultants, not firms');
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

Return this exact JSON shape:
{
  "score": <integer 0-100, thematic+activity+regional+funder+budget+eligibility fit>,
  "pillar": "<the single best-matching focus area from the list above>",
  "objective": "<1-2 sentence plain-English summary of what the opportunity actually asks for>",
  "eligibility": "<1 sentence: who can apply, any red flags (national-firm-only, in-country incorporation, etc.)>",
  "qualifications": "<1 sentence: required qualifications/experience if stated, else 'Not specified'>",
  "keywords": ["<3-5 short keyword phrases>"],
  "reviewFlags": ["<zero or more from: Tight submission deadline, Missing or incomplete TOR/RFP, Budget not published, Unfamiliar or inconsistent funder, Unclear eligibility, Limited information available>"],
  "explanation": "<2-3 sentences explaining the score, written for a human analyst deciding whether to review this further>"
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
      const raw = await callGemini(buildPrompt(opp, criteria));
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

  const reviewFlags = Array.from(new Set([...(evaluation.reviewFlags || []), ...knockout.flags]));
  const fitTier = fitTierFor(evaluation.score, false);

  return { ...evaluation, fitTier, reviewFlags, knockedOut: false, usedGemini };
}

module.exports = { evaluateOpportunity, buildCoefficientPrompt, runKnockouts, parseBudgetNumber };
