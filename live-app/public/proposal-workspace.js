// "Prepare the proposal with evidence, not a blank page" — the proposal
// workspace at the bottom of every opportunity record (layout from Yael's
// prototype, rebuilt on real data).
//
// No AI (computed on open):  evidence and team matched from the Knowledge
//   Base, readiness, proposal structure, missing information, quick
//   requirement check from the screening data.
// AI (only when a person presses the button, cached per opportunity so
//   reopening the record costs nothing):  section-by-section preparation
//   plan, and requirement → evidence → section traceability.
(() => {
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) : String(v ?? ''));
  const say = m => (typeof showToast === 'function' ? showToast(m) : typeof toast === 'function' ? toast(m) : null);
  const AI_CACHE_KEY = 'aceso_proposal_ai_v1';

  const STOP = new Set('with from that this their these those into over under about which while where there have been will shall must should could would other than also more most such each only both into upon across between within without through against among health healthcare support services service project projects program programme programs opportunity opportunities development global national international public level based including include related strengthen strengthening capacity system systems'.split(' '));
  const REGION_OF = { indonesia: 'southeast asia', vietnam: 'southeast asia', philippines: 'southeast asia', thailand: 'southeast asia', malaysia: 'southeast asia', cambodia: 'southeast asia', 'lao': 'southeast asia', myanmar: 'southeast asia', india: 'south asia', bangladesh: 'south asia', nepal: 'south asia', pakistan: 'south asia', 'sri lanka': 'south asia', kenya: 'africa', tanzania: 'africa', uganda: 'africa', nigeria: 'africa', ghana: 'africa', rwanda: 'africa', ethiopia: 'africa', 'sierra leone': 'africa', zambia: 'africa', malawi: 'africa', mozambique: 'africa', peru: 'latin america', colombia: 'latin america', mexico: 'latin america', brazil: 'latin america', panam: 'latin america', dominican: 'latin america', guatemala: 'latin america', honduras: 'latin america', ecuador: 'latin america', 'abu dhabi': 'middle east', egypt: 'middle east', jordan: 'middle east', morocco: 'middle east' };

  // Per-opportunity state kept for the session (sections, gap owners, includes).
  const sessions = new Map();
  let current = null, tab = 'evidence';

  const words = text => (String(text || '').toLowerCase().match(/[a-z][a-z-]{3,}/g) || []).map(w => w.replace(/s$/, '')).filter(w => !STOP.has(w));
  const oppKey = o => `${o.source || ''}|${(o.meta && o.meta.sourceOpportunityId) || o.title || ''}`;
  const regionOf = text => { const t = String(text || '').toLowerCase(); const hit = Object.keys(REGION_OF).find(k => t.includes(k)); return hit ? REGION_OF[hit] : null; };
  const daysUntil = text => { const t = Date.parse(text || ''); return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 864e5); };

  // ---- matching (no AI) -----------------------------------------------------
  function oppTerms(o) {
    const m = o.meta || {};
    return new Set(words([o.title, o.pillar, m.objective, m.qualifications, (m.keywords || []).join(' ')].join(' ')));
  }
  function overlap(terms, text) { return [...new Set(words(text))].filter(w => terms.has(w)); }

  function matchEvidence(o) {
    const projects = typeof window.knowledgeBaseProjects === 'function' ? window.knowledgeBaseProjects() : [];
    const terms = oppTerms(o), region = regionOf(`${o.country} ${(o.meta || {}).location || ''} ${o.title}`);
    return projects.map(p => {
      const shared = overlap(terms, [p.title, p.summary, p.transferableExperience, (p.thematicAreas || []).join(' ')].join(' '));
      const regional = region && String(p.region || '').toLowerCase().includes(region);
      const raw = shared.length + (regional ? 2 : 0);
      return { ...p, shared, regional, raw, match: Math.round(100 * (1 - Math.exp(-raw / 3.2))) };
    }).filter(p => p.raw > 0).sort((a, b) => b.raw - a.raw).slice(0, 4);
  }
  function matchTeam(o, evidence) {
    const team = typeof window.knowledgeBaseTeam === 'function' ? window.knowledgeBaseTeam() : [];
    const terms = oppTerms(o), region = regionOf(`${o.country} ${o.title}`);
    const linked = new Set(evidence.flatMap(e => [...(e.teamWithPublicConnection || []), ...(e.teamSuggestedByExpertise || [])]));
    return team.map(p => {
      const shared = overlap(terms, [(p.expertise || []).join(' '), p.profileSummary].join(' '));
      const regional = region && [(p.expertise || []).join(' '), p.profileSummary].join(' ').toLowerCase().includes(region);
      const raw = shared.length + (linked.has(p.name) ? 2 : 0) + (regional ? 1 : 0);
      return { ...p, shared, linked: linked.has(p.name), raw };
    }).filter(p => p.raw > 0).sort((a, b) => b.raw - a.raw).slice(0, 3);
  }

  // Information the team still needs, derived from the agent's own flags.
  function infoGaps(o) {
    const m = o.meta || {}, f = new Set(m.reviewFlags || []), d = daysUntil(o.due), gaps = [];
    const add = (title, detail, owner, level) => gaps.push({ title, detail, owner, level, done: false });
    if (m.rfpAvailable === false || f.has('Missing or incomplete TOR/RFP')) add('Full terms of reference', 'The TOR/RFP is missing or incomplete; request it before drafting.', 'Analyst', 'High');
    if (f.has('Unclear eligibility')) add('Eligibility route', 'Confirm Aceso can bid directly or needs a consortium partner.', 'Analyst', 'High');
    if (d != null && d < 14) add('Submission timeline', `Only ${Math.max(d, 0)} days left; confirm the team can deliver in time.`, 'BD Manager', 'High');
    if (f.has('Budget not published') || !o.value || o.value === 'Not disclosed') add('Budget and level of effort', 'No budget is published; estimate the level of effort and pricing.', 'Finance', 'Medium');
    if (f.has('Limited information available')) add('Scope details', 'The notice gives limited detail; clarify deliverables with the funder.', 'Analyst', 'Medium');
    if (f.has('Additional consultant required')) add('External expert', 'An additional consultant may be needed; identify candidates.', 'BD Manager', 'Medium');
    if (f.has('Travel required')) add('Travel and duty of care', 'Travel is required; confirm availability and security arrangements.', 'BD Manager', 'Low');
    if (/french/i.test(m.language || '')) add('French-language submission', 'The proposal must be written in French.', 'BD Manager', 'Medium');
    add('Team availability', 'Confirm the suggested people are available for the delivery window.', 'BD Manager', 'Medium');
    return gaps;
  }

  const DEFAULT_SECTIONS = ['Executive summary', 'Understanding of the assignment', 'Technical approach and methodology', 'Relevant Aceso experience', 'Proposed team and responsibilities', 'Workplan and deliverables', 'Budget narrative'];

  function session(o) {
    const key = oppKey(o);
    if (!sessions.has(key)) {
      const evidence = matchEvidence(o), team = matchTeam(o, evidence);
      sessions.set(key, {
        key, evidence, team,
        include: new Set(evidence.slice(0, 3).map(e => e.title)),
        roles: Object.fromEntries(team.map((p, i) => [p.name, ['Technical lead', 'Senior reviewer', 'Specialist'][i] || 'Contributor'])),
        sections: DEFAULT_SECTIONS.map(t => ({ title: t, on: true })),
        gaps: infoGaps(o)
      });
    }
    return sessions.get(key);
  }

  // Readiness: evidence strength, team coverage, open information, time left.
  function readiness(o, s) {
    const top = s.evidence[0] ? s.evidence[0].match / 100 : 0;
    const team = Math.min(1, s.team.length / 2);
    const open = s.gaps.filter(g => !g.done);
    const info = Math.max(0, 1 - open.reduce((n, g) => n + (g.level === 'High' ? 0.3 : g.level === 'Medium' ? 0.15 : 0.05), 0));
    const d = daysUntil(o.due), time = d == null ? 0.5 : d >= 30 ? 1 : d >= 14 ? 0.7 : d >= 7 ? 0.4 : 0.2;
    const pct = Math.round((top * 0.35 + team * 0.2 + info * 0.3 + time * 0.15) * 100);
    const label = pct >= 75 ? 'Strong foundation' : pct >= 50 ? 'Workable, with gaps' : 'Early — resolve gaps first';
    return { pct, label, open: open.length, parts: { evidence: Math.round(top * 100), team: Math.round(team * 100), information: Math.round(info * 100), time: Math.round(time * 100) } };
  }

  // ---- AI cache ---------------------------------------------------------------
  const readCache = () => { try { return JSON.parse(localStorage.getItem(AI_CACHE_KEY) || '{}'); } catch (e) { return {}; } };
  // Accept a bare list too (older cached results / model output variations).
  const normalize = (mode, r) => Array.isArray(r) ? (mode === 'plan' ? { sections: r } : { requirements: r }) : (r || {});
  const cached = (s, mode) => { const c = readCache()[`${s.key}|${mode}`]; return c ? { ...c, result: normalize(mode, c.result) } : null; };
  function storeCache(s, mode, value) {
    try { const all = readCache(); all[`${s.key}|${mode}`] = value; localStorage.setItem(AI_CACHE_KEY, JSON.stringify(all)); } catch (e) { /* storage full or blocked: result still shows this session */ }
  }

  function payload(o, s) {
    const m = o.meta || {};
    return {
      opportunity: { title: o.title, org: o.org, country: o.country, type: o.type, value: o.value, due: o.due, objective: m.objective, eligibility: m.eligibility, qualifications: m.qualifications, orgType: m.orgType, language: m.language, rfpAvailable: m.rfpAvailable, reviewFlags: m.reviewFlags },
      evidence: s.evidence.filter(e => s.include.has(e.title)).map(e => ({ title: e.title, region: e.region, summary: e.summary, use: e.transferableExperience })),
      team: s.team.filter(p => s.roles[p.name] !== 'Not selected').map(p => ({ name: p.name, role: p.role, proposedRole: s.roles[p.name], expertise: p.expertise })),
      sections: s.sections.filter(x => x.on).map(x => x.title),
      gaps: s.gaps.filter(g => !g.done).map(g => `${g.title}: ${g.detail}`)
    };
  }

  async function runAI(mode, btn) {
    const o = current, s = session(o);
    btn.disabled = true; const label = btn.textContent; btn.textContent = 'Generating… (can take a minute)';
    try {
      const res = await fetch('/api/proposal-assist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode, payload: payload(o, s) }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || data.error || !data.result) { say(data.error || `AI assistance failed (HTTP ${res.status}).`); btn.disabled = false; btn.textContent = label; return; }
      storeCache(s, mode, { result: data.result, generatedAt: data.generatedAt, sections: payload(o, s).sections });
      render();
    } catch (err) { say(`AI assistance failed: ${err.message}`); btn.disabled = false; btn.textContent = label; }
  }

  // ---- panels -------------------------------------------------------------------
  function evidencePanel(o, s) {
    const best = s.evidence[0];
    return `<div class="pw-panel-head"><div><p class="eyebrow">EVIDENCE LIBRARY</p><h3>What Aceso can credibly reuse</h3><p>Matched automatically from the Knowledge Base by shared themes, terms and region — no AI needed. Choose what goes into the proposal.</p></div><div class="pw-tools"><button type="button" data-go-kb>Browse Knowledge Base ↗</button></div></div>
      <div class="pw-evidence-grid"><section><h4>Related Aceso projects <span>${s.evidence.length}</span></h4>
        ${s.evidence.length ? s.evidence.map(e => `<article class="pw-evidence-card"><div class="pw-match" title="Match with this notice"><b>${e.match}%</b></div><div><small>${esc((e.thematicAreas || []).slice(0, 2).join(' · ').toUpperCase())}</small><h5>${esc(e.title)}</h5><p>${esc(e.summary)}</p><em>Why: ${e.shared.slice(0, 5).map(esc).join(', ') || 'regional experience'}${e.regional ? ` · same region (${esc(e.region)})` : ''}</em><em>Transferable: <b>${esc(e.transferableExperience)}</b></em></div><label><input type="checkbox" data-include="${esc(e.title)}" ${s.include.has(e.title) ? 'checked' : ''}> Include</label><a class="pw-open" href="${esc(e.publicSource)}" target="_blank" rel="noopener">Public page ↗</a></article>`).join('') : '<p class="pw-empty">No Knowledge Base project shares themes with this notice yet. Add projects in Knowledge Base to grow the evidence library.</p>'}
      </section><aside><h4>Suggested team</h4>
        ${s.team.length ? s.team.map(p => `<article class="pw-person"><i>${esc(p.name.split(' ').map(x => x[0]).slice(0, 2).join(''))}</i><div><h5>${esc(p.name)}</h5><b>${esc(p.role)}</b><p>${esc((p.expertise || []).slice(0, 3).join(' · '))}</p><small>${p.linked ? 'Linked to a matched project · ' : ''}suggested by expertise — validate with CV</small><select data-role="${esc(p.name)}">${['Technical lead', 'Senior reviewer', 'Specialist', 'Contributor', 'Not selected'].map(r => `<option ${s.roles[p.name] === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div></article>`).join('') : '<p class="pw-empty">No team profile matches this notice’s themes.</p>'}
      </aside></div>
      ${best ? `<div class="pw-language"><div><p class="eyebrow">REUSABLE LANGUAGE</p><h4>From the closest public project page</h4><blockquote>“${esc(best.summary)}”</blockquote><small>From: ${esc(best.title)} · public project summary, not an approved proposal</small></div><a href="${esc(best.publicSource)}" target="_blank" rel="noopener">Open source ↗</a></div>` : ''}`;
  }

  function planPanel(o, s) {
    const ai = cached(s, 'plan'), chosen = s.sections.filter(x => x.on).map(x => x.title);
    const stale = ai && JSON.stringify(ai.sections) !== JSON.stringify(chosen);
    const open = s.gaps.filter(g => !g.done).length;
    return `<div class="pw-panel-head"><div><p class="eyebrow">PROPOSAL PLAN</p><h3>Define the response before drafting</h3><p>Pick the sections and resolve what the team still needs. The section-by-section guidance uses AI and runs only when you ask.</p></div></div>
      <div class="pw-plan-grid"><section><h4>Proposal structure <span>${chosen.length} selected</span></h4>
        <div class="pw-outline">${s.sections.map((x, i) => `<label class="${x.on ? '' : 'off'}"><input type="checkbox" data-section="${i}" ${x.on ? 'checked' : ''}><b>${String(i + 1).padStart(2, '0')}</b><input type="text" class="pw-section-name" data-section-name="${i}" value="${esc(x.title)}" aria-label="Section name"><button type="button" data-section-remove="${i}" aria-label="Remove section">×</button></label>`).join('')}</div>
        <form class="pw-add" data-add="section"><input required placeholder="Add another proposal section"><button>Add section</button></form></section>
      <aside><header><div><h4>Missing information</h4><p>From the agent’s review flags for this notice.</p></div><b>${open} open</b></header>
        <div class="pw-gaps">${s.gaps.map((g, i) => `<article class="${g.done ? 'resolved' : ''}"><input type="checkbox" data-gap="${i}" ${g.done ? 'checked' : ''} aria-label="Resolved"><div><h5>${esc(g.title)}</h5><p>${esc(g.detail)}</p><select data-gap-owner="${i}">${['Analyst', 'BD Manager', 'Finance', 'Director'].map(r => `<option ${g.owner === r ? 'selected' : ''}>${r}</option>`).join('')}</select></div><span class="${g.level.toLowerCase()}">${g.level}</span></article>`).join('')}</div>
        <form class="pw-add" data-add="gap"><input required placeholder="Add an information request"><button>Add</button></form></aside></div>
      <div class="pw-ai">${ai ? `<header><div><p class="eyebrow">✦ AI PREPARATION PLAN</p><h4>Generated ${esc(new Date(ai.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))}${stale ? ' · <span class="pw-stale">sections changed since</span>' : ''}</h4></div><button type="button" class="pw-secondary" data-ai="plan">↻ Regenerate</button></header>
        <div class="pw-ai-sections">${(ai.result.sections || []).map((x, i) => `<article><span>${String(i + 1).padStart(2, '0')}</span><div><h5>${esc(x.title)}</h5><p>${esc(x.purpose)}</p><ul>${(x.keyPoints || []).map(k => `<li>${esc(k)}</li>`).join('')}</ul>${(x.useEvidence || []).length ? `<small>Use: ${(x.useEvidence || []).map(esc).join(' · ')}</small>` : ''}${x.confirmFirst ? `<small class="pw-confirm">Confirm first: ${esc(x.confirmFirst)}</small>` : ''}</div></article>`).join('')}</div>
        ${(ai.result.firstSteps || []).length ? `<div class="pw-steps"><b>First steps</b><ol>${ai.result.firstSteps.map(x => `<li>${esc(x)}</li>`).join('')}</ol></div>` : ''}<p class="pw-ai-note">AI draft guidance from the notice and the evidence you selected. The team edits and approves everything.</p>`
        : `<div class="pw-ai-empty"><div><p class="eyebrow">✦ AI PREPARATION PLAN</p><h4>Get section-by-section guidance for the ${chosen.length} selected sections</h4><p>What each section must say, which evidence supports it and what to confirm first. Uses one AI request — run it when the structure is ready.</p></div><button type="button" class="pw-primary" data-ai="plan">Generate with AI →</button></div>`}</div>`;
  }

  function quickRequirements(o, s) {
    const m = o.meta || {}, f = new Set(m.reviewFlags || []), d = daysUntil(o.due);
    let langs = ['english', 'spanish', 'portuguese'];
    try { const st = JSON.parse(localStorage.getItem('aceso_criteria_state_v2') || 'null'); if (st && st.languages) langs = langs.filter(k => st.languages[k] !== false); } catch (e) { /* defaults */ }
    const topE = s.evidence.find(e => s.include.has(e.title)), topP = s.team[0];
    return [
      ['Organization type', m.orgType || 'Not stated', 'Aceso is a consulting firm', !m.orgType ? 'Needs review' : /consult|firm|organi[sz]ation|ngo|any|compan/i.test(m.orgType) ? 'Covered' : 'Needs review'],
      ['Eligibility', m.eligibility || 'Not stated', f.has('Unclear eligibility') ? 'Eligibility flagged as unclear' : 'No restriction flagged', !m.eligibility || f.has('Unclear eligibility') ? 'Needs review' : 'Partial'],
      ['Required qualifications', m.qualifications || 'Not stated', [topE && topE.title, topP && topP.name].filter(Boolean).join(' · ') || 'No evidence selected', !m.qualifications || /not specified/i.test(m.qualifications) ? 'Needs review' : topE || topP ? 'Partial' : 'Missing'],
      ['Language', m.language || 'Not stated', m.language ? (langs.includes(m.language.toLowerCase()) ? `Aceso delivers in ${m.language}` : `${m.language} not in Aceso’s languages`) : '—', !m.language ? 'Needs review' : langs.includes(m.language.toLowerCase()) ? 'Covered' : 'Missing'],
      ['Deadline', o.due || 'Not stated', d == null ? 'Date unclear' : `${Math.max(d, 0)} days left`, d == null ? 'Needs review' : d >= 14 ? 'Covered' : 'Partial'],
      ['Budget', o.value || 'Not disclosed', o.value && o.value !== 'Not disclosed' ? 'Published' : 'Not published', o.value && o.value !== 'Not disclosed' ? 'Covered' : 'Needs review']
    ];
  }

  function compliancePanel(o, s) {
    const rows = quickRequirements(o, s);
    const ai = cached(s, 'compliance'), aiRows = ai ? (ai.result.requirements || []) : [];
    const use = aiRows.length ? aiRows.map(r => r.status) : rows.map(r => r[3]);
    const covered = use.filter(x => x === 'Covered').length, partial = use.filter(x => x === 'Partial').length;
    const pct = use.length ? Math.round((covered + partial * 0.5) / use.length * 100) : 0;
    const count = st => use.filter(x => x === st).length;
    const cls = st => String(st || '').toLowerCase().replace(' ', '-');
    return `<div class="pw-panel-head"><div><p class="eyebrow">COMPLIANCE &amp; TRACEABILITY</p><h3>Every requirement connected to evidence</h3><p>A quick check from the screening data runs automatically. The full traceability check uses AI and runs only when you ask.</p></div><div class="pw-compliance-score"><b>${pct}%</b><span>Requirements covered${aiRows.length ? ' · AI check' : ' · quick check'}</span></div></div>
      <div class="pw-status-summary">${['Covered', 'Partial', 'Missing', 'Needs review'].map(st => `<span><i class="${cls(st)}"></i><b>${count(st)}</b> ${st}</span>`).join('')}</div>
      ${aiRows.length ? `<div class="pw-trace-table ai"><header><span>Requirement</span><span>Source</span><span>Aceso evidence</span><span>Proposal section</span><span>Status</span></header>${aiRows.map(r => `<article><div><b>${esc(r.requirement)}</b><small>${esc(r.note)}</small></div><span>${esc(r.source)}</span><span>${esc(r.evidence)}</span><span>${esc(r.section)}</span><em class="${cls(r.status)}">${esc(r.status)}</em></article>`).join('')}</div>
        <div class="pw-ai-meta"><span>✦ AI check generated ${esc(new Date(ai.generatedAt).toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }))}</span><button type="button" class="pw-secondary" data-ai="compliance">↻ Run again</button></div>`
      : `<div class="pw-trace-table"><header><span>Requirement</span><span>What the notice says</span><span>Aceso evidence</span><span>Status</span></header>${rows.map(r => `<article class="quick"><div><b>${esc(r[0])}</b></div><span>${esc(r[1])}</span><span>${esc(r[2])}</span><em class="${cls(r[3])}">${esc(r[3])}</em></article>`).join('')}</div>
        <div class="pw-ai-empty"><div><p class="eyebrow">✦ AI TRACEABILITY CHECK</p><h4>Map each requirement to evidence and to a proposal section</h4><p>Reads the notice and the evidence you selected, lists what the proposal must satisfy and where each point is covered or missing. One AI request.</p></div><button type="button" class="pw-primary" data-ai="compliance">Run AI check →</button></div>`}
      <footer class="pw-human-note"><div><b>Human validation remains required</b><p>The checks flag omissions and inconsistencies. Aceso keeps control of the final content, interpretation and submission decision.</p></div></footer>`;
  }

  const PANELS = { evidence: evidencePanel, plan: planPanel, compliance: compliancePanel };

  function render() {
    const root = q('#proposalWorkspace'); if (!root || !current) return;
    const s = session(current), r = readiness(current, s);
    q('.pw-readiness', root).innerHTML = `<small>PROPOSAL READINESS</small><b>${r.pct}%</b><i><u style="width:${r.pct}%"></u></i><span>${r.label} · ${r.open} open item${r.open === 1 ? '' : 's'}</span>`;
    // Breakdown stays available on hover instead of as tiny text.
    q('.pw-readiness', root).title = `Evidence ${r.parts.evidence}% · Team ${r.parts.team}% · Information ${r.parts.information}% · Time ${r.parts.time}%`;
    qa('[data-pw-tab]', root).forEach(b => b.classList.toggle('active', b.dataset.pwTab === tab));
    q('#pwBody', root).innerHTML = PANELS[tab](current, s);
  }

  function build(o) {
    current = o; tab = 'evidence';
    const record = q('#detailContent .complete-record'); if (!record) return;
    q('#proposalWorkspace')?.remove();
    record.insertAdjacentHTML('beforeend', `<section class="proposal-workspace-v3" id="proposalWorkspace"><header class="pw-hero"><div><p class="eyebrow">✦ AI-ASSISTED PROPOSAL PREPARATION</p><h2>Prepare the proposal with evidence,<br>not a blank page.</h2><p>The agent organizes Aceso's knowledge and checks the notice. The team chooses, edits and approves what moves forward.</p></div><aside class="pw-readiness"></aside></header>
      <nav class="pw-tabs"><button type="button" data-pw-tab="evidence"><span>01</span><b>Evidence Library</b><small>Projects &amp; team · automatic</small></button><button type="button" data-pw-tab="plan"><span>02</span><b>Proposal Plan</b><small>Structure &amp; missing information</small></button><button type="button" data-pw-tab="compliance"><span>03</span><b>Compliance Review</b><small>Requirements &amp; gaps</small></button></nav><main id="pwBody"></main></section>`);
    render();
  }

  // One delegated listener set for the whole workspace.
  document.addEventListener('click', e => {
    const root = e.target.closest('#proposalWorkspace'); if (!root || !current) return;
    const s = session(current);
    const t = e.target.closest('[data-pw-tab]'); if (t) { tab = t.dataset.pwTab; render(); return; }
    const ai = e.target.closest('[data-ai]'); if (ai) { runAI(ai.dataset.ai, ai); return; }
    const rm = e.target.closest('[data-section-remove]'); if (rm) { s.sections.splice(Number(rm.dataset.sectionRemove), 1); render(); return; }
    if (e.target.closest('[data-go-kb]') && typeof window.showView === 'function') { window.showView('knowledge'); }
  });
  document.addEventListener('change', e => {
    const root = e.target.closest('#proposalWorkspace'); if (!root || !current) return;
    const s = session(current), el = e.target;
    if (el.dataset.include != null) { el.checked ? s.include.add(el.dataset.include) : s.include.delete(el.dataset.include); render(); }
    else if (el.dataset.role != null) { s.roles[el.dataset.role] = el.value; render(); }
    else if (el.dataset.section != null) { s.sections[Number(el.dataset.section)].on = el.checked; render(); }
    else if (el.dataset.sectionName != null) { const v = el.value.trim(); if (v) s.sections[Number(el.dataset.sectionName)].title = v; render(); }
    else if (el.dataset.gap != null) { s.gaps[Number(el.dataset.gap)].done = el.checked; render(); }
    else if (el.dataset.gapOwner != null) { s.gaps[Number(el.dataset.gapOwner)].owner = el.value; }
  });
  document.addEventListener('submit', e => {
    const form = e.target.closest('#proposalWorkspace .pw-add'); if (!form || !current) return;
    e.preventDefault();
    const s = session(current), v = q('input', form).value.trim(); if (!v) return;
    if (form.dataset.add === 'section') s.sections.push({ title: v, on: true });
    else s.gaps.push({ title: v, detail: 'Added by the team.', owner: 'Analyst', level: 'Medium', done: false });
    render();
  });

  const prior = window.openDetail;
  window.openDetail = function (o) { prior(o); build(o || {}); };
})();
