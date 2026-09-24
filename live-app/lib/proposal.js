// Prompts for the on-demand proposal assistance in the opportunity record.
// Both run only when a person presses the button — never automatically —
// and use only the data the frontend sends (the opportunity as screened,
// plus Knowledge Base evidence the page already matched without AI).

const clip = (v, n) => String(v ?? '').slice(0, n);

function opportunityBlock(o = {}) {
  return `Title: ${clip(o.title, 300)}
Funder: ${clip(o.org, 200)}
Country: ${clip(o.country, 120)}
Type: ${clip(o.type, 60)} · Value: ${clip(o.value, 120)} · Deadline: ${clip(o.due, 80)}
Objective: ${clip(o.objective, 1200)}
Eligibility: ${clip(o.eligibility, 800)}
Required qualifications: ${clip(o.qualifications, 800)}
Organization type: ${clip(o.orgType, 120)} · Language: ${clip(o.language, 60)} · TOR/RFP available: ${o.rfpAvailable === false ? 'no' : 'yes or unknown'}
Review flags: ${(o.reviewFlags || []).map(f => clip(f, 80)).join('; ') || 'none'}`;
}

function evidenceBlock(evidence = [], team = []) {
  const ev = evidence.slice(0, 6).map(e => `- ${clip(e.title, 200)} (${clip(e.region, 80)}): ${clip(e.summary, 300)} Transferable: ${clip(e.use, 200)}`).join('\n') || '- none selected';
  const tm = team.slice(0, 6).map(p => `- ${clip(p.name, 80)}, ${clip(p.role, 80)} — proposed as ${clip(p.proposedRole, 60)}; expertise: ${(p.expertise || []).map(x => clip(x, 60)).join(', ')}`).join('\n') || '- none selected';
  return `ACESO EVIDENCE SELECTED BY THE TEAM (public project pages; internal CVs not included)\nProjects:\n${ev}\nPeople:\n${tm}`;
}

function buildPlanPrompt({ opportunity, evidence, team, sections, gaps }) {
  return `You are helping Aceso Global, a health-systems consulting firm, prepare a proposal. Write a preparation plan for the sections the team selected. Use ONLY the information below; never invent requirements, numbers, past projects, clients or people. Where the notice does not say something, say it must be confirmed. Plain English, concise, practical.

OPPORTUNITY (as screened by the agent)
${opportunityBlock(opportunity)}

${evidenceBlock(evidence, team)}

SECTIONS TO PREPARE: ${(sections || []).map(s => clip(s, 120)).join('; ')}
OPEN INFORMATION GAPS: ${(gaps || []).map(g => clip(g, 160)).join('; ') || 'none'}

Return ONLY this JSON (no markdown):
{"sections":[{"title":"<exactly one of the sections above>","purpose":"<1 sentence: what this section must achieve for this funder>","keyPoints":["<2-4 short, specific points to cover>"],"useEvidence":["<titles or names from the evidence above that support this section, or empty>"],"confirmFirst":"<what must be confirmed before writing it, or empty string>"}],"firstSteps":["<3 concrete next steps for the team, in order>"]}`;
}

function buildCompliancePrompt({ opportunity, evidence, team, sections }) {
  return `You are the compliance checker for Aceso Global's proposal team. From the opportunity below, list the requirements a proposal must satisfy and trace each one to Aceso's evidence and to a proposal section. Use ONLY the information below. A requirement is "Covered" only if the listed evidence clearly supports it; "Partial" if it partly does; "Missing" if nothing listed supports it; "Needs review" if the notice itself is unclear. Never invent evidence, documents or page numbers — cite the field the requirement came from (Objective, Eligibility, Required qualifications, Organization type, Language, Deadline, Value).

OPPORTUNITY (as screened by the agent)
${opportunityBlock(opportunity)}

${evidenceBlock(evidence, team)}

PROPOSAL SECTIONS: ${(sections || []).map(s => clip(s, 120)).join('; ')}

Return ONLY this JSON (no markdown):
{"requirements":[{"requirement":"<short requirement>","source":"<field it came from>","evidence":"<matching evidence from the list above, or 'No evidence selected'>","section":"<proposal section that must address it>","status":"Covered|Partial|Missing|Needs review","note":"<1 short sentence: what to do>"}]}
List 4 to 8 requirements, most important first.`;
}

module.exports = { buildPlanPrompt, buildCompliancePrompt };
