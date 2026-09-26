(() => {
  // Pipeline & Proposals — real opportunities only (layout: Yael's v51).
  //  • Qualified: the latest search's Recommended opportunities nobody has
  //    moved yet (read live, never stored).
  //  • Internal review → Proposal → Submitted: stored in Firestore through
  //    /api/pipeline (owner, delivery plan, comments, history), so everyone
  //    using the app sees the same pipeline.
  // window.pipelineStats() gives the Dashboard and Copilot the same numbers.
  const STAGES = ['Qualified', 'Internal review', 'Proposal', 'Submitted'];
  const STAGE_LABEL = { Qualified: 'Qualified', 'Internal review': 'Internal review', Proposal: 'Proposal in production', Submitted: 'Submitted' };
  const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(v == null ? '' : String(v)) : String(v == null ? '' : v));
  const say = m => { if (typeof toast === 'function') toast(m); };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const records = new Map(); // key -> stored pipeline record
  let storeMode = null, storeError = null, loaded = false;
  let activeStage = 'Qualified', activeKey = null;

  // ---- Real opportunities ---------------------------------------------------
  // Stable id for a notice across searches: its source URL, else source + title.
  function oppKey(o) {
    const basis = `${o.sourceUrl || ''}|${o.source || ''}|${o.title || ''}`.toLowerCase();
    let a = 0x811c9dc5, b = 5381;
    for (let i = 0; i < basis.length; i++) { const c = basis.charCodeAt(i); a = Math.imul(a ^ c, 16777619) >>> 0; b = (Math.imul(b, 33) + c) >>> 0; }
    return `op${a.toString(36)}${b.toString(36)}`;
  }
  const liveOpps = () => (typeof activeOpportunities === 'function' ? activeOpportunities() : (typeof opportunities !== 'undefined' ? opportunities : [])) || [];
  const findLive = key => liveOpps().find(o => oppKey(o) === key) || null;
  const snapshot = o => ({ title: o.title, org: o.org, country: o.country, pillar: o.pillar, type: o.type, source: o.source, sourceUrl: o.sourceUrl, value: o.value, due: o.due, score: o.score, summary: (o.meta && o.meta.objective) || '' });

  function stageItems(stage) {
    if (stage === 'Qualified') {
      return liveOpps().filter(o => o.status === 'Recommended' && !records.has(oppKey(o)))
        .map(o => ({ key: oppKey(o), stage: 'Qualified', opp: snapshot(o), owner: '', deliverables: [], comments: [], history: [] }));
    }
    return [...records.values()].filter(r => r.stage === stage).sort((x, y) => String(y.updatedAt || '').localeCompare(String(x.updatedAt || '')));
  }
  const itemByKey = key => records.get(key) || stageItems('Qualified').find(i => i.key === key) || null;

  // ---- Dates, values, derived fields ---------------------------------------
  const parseDay = t => { if (!t) return null; const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(t) ? `${t}T12:00:00` : t); return Number.isNaN(d.getTime()) ? null : d; };
  const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const short = t => { const d = parseDay(t); return d ? d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : (t || ''); };
  const fmtDay = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const when = t => { const d = parseDay(t); return d ? d.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : ''; };
  // Published value → lower bound in USD ("$10–30 million" → 10,000,000).
  function parseMoney(v) {
    const m = /\$\s?([\d.,]+)(?:\s*[–-]\s*\$?[\d.,]+)?\s*(billion|bn|million|m\b|thousand|k\b)?/i.exec(v || '');
    if (!m) return 0;
    const n = Number(m[1].replace(/,/g, '')); if (!Number.isFinite(n)) return 0;
    const u = (m[2] || '').toLowerCase();
    return n * (u.startsWith('b') ? 1e9 : u.startsWith('m') ? 1e6 : u.startsWith('t') || u === 'k' ? 1e3 : 1);
  }
  const fmtValue = n => (n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `$${Math.round(n / 1e3)}K` : `$${Math.round(n)}`);
  const fitOf = s => (s >= 85 ? 'High' : s >= 65 ? 'Medium' : 'Low');
  const initials = n => String(n || '').split(/\s+/).filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase();
  // Aceso's team from the Knowledge Base (team-directory.js loads later).
  let teamCache = null;
  const team = () => {
    if (!teamCache && typeof window.knowledgeBaseTeam === 'function') teamCache = (window.knowledgeBaseTeam() || []).filter(p => p && p.name).map(p => ({ name: p.name, role: p.role || '' }));
    return teamCache || [];
  };
  const roleOf = name => (team().find(p => p.name === name) || {}).role || '';

  const doneCount = i => (i.deliverables || []).filter(d => d.done).length;
  function progress(i) {
    if (i.stage === 'Proposal') { const n = (i.deliverables || []).length; return n ? Math.round(doneCount(i) / n * 100) : 0; }
    return i.stage === 'Submitted' ? 100 : null;
  }
  const nextStep = i => (i.deliverables || []).find(d => !d.done) || null;
  function nextAction(i) {
    if (i.stage === 'Qualified') return { label: 'Decide whether to pursue', date: i.opp.due, text: i.opp.due ? `Deadline ${i.opp.due}` : 'No deadline published' };
    if (i.stage === 'Internal review') return { label: 'Pursuit decision', date: i.opp.due, text: i.opp.due ? `Deadline ${i.opp.due}` : 'No deadline published' };
    if (i.stage === 'Proposal') { const s = nextStep(i); return s ? { label: s.name, date: s.due, text: s.due ? `Due ${short(s.due)}` : 'No due date' } : { label: 'Ready to submit', date: i.opp.due, text: i.opp.due ? `Deadline ${i.opp.due}` : '' }; }
    return { label: 'Awaiting funder response', date: i.submittedAt, text: i.submittedAt ? `Submitted ${short(i.submittedAt)}` : 'Submitted' };
  }
  const SUBLINE = { Qualified: () => 'Recommended by the agent', 'Internal review': () => 'Awaiting pursuit decision', Proposal: i => `${doneCount(i)} of ${(i.deliverables || []).length} deliverables complete`, Submitted: () => 'Submitted · awaiting response' };

  // ---- Date navigation (same control as the Dashboard) ----------------------
  let range = 'all', custom = { from: '', to: '' };
  const RANGE_LABEL = { all: 'All dates', week: 'This week', month: 'This month', quarter: 'This quarter' };
  function rangeBounds() {
    const now = today();
    if (range === 'week') { const a = addDays(now, -((now.getDay() + 6) % 7)); const b = addDays(a, 6); b.setHours(23, 59, 59); return [a, b]; }
    if (range === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)];
    if (range === 'quarter') { const q0 = Math.floor(now.getMonth() / 3) * 3; return [new Date(now.getFullYear(), q0, 1), new Date(now.getFullYear(), q0 + 3, 0, 23, 59, 59)]; }
    if (range === 'custom' && custom.from && custom.to) return [new Date(`${custom.from}T00:00:00`), new Date(`${custom.to}T23:59:59`)];
    return null;
  }
  const inRange = i => { const b = rangeBounds(); if (!b) return true; const d = parseDay(nextAction(i).date); return !!d && d >= b[0] && d <= b[1]; };
  const rows = stage => stageItems(stage).filter(inRange);

  function renderPeriod() {
    const metrics = $('#pipelineMetrics'); if (!metrics) return;
    let box = $('#pipelinePeriod');
    if (!box) { box = document.createElement('div'); box.id = 'pipelinePeriod'; box.className = 'pl-period'; metrics.before(box); }
    const b = rangeBounds();
    const label = range === 'custom' && !(custom.from && custom.to) ? 'Choose dates' : range === 'all' ? RANGE_LABEL.all : `${RANGE_LABEL[range] || 'Custom range'} · ${fmtDay(b[0])} – ${fmtDay(b[1])}`;
    box.innerHTML = `<span class="pl-period-summary"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg></i><span><small>Next action & due dates</small><strong>${label}</strong></span></span>
      <div class="pl-period-tabs" role="tablist" aria-label="Date range">${['all', 'week', 'month', 'quarter', 'custom'].map(k => `<button type="button" role="tab" aria-selected="${range === k}" class="${range === k ? 'active' : ''}" data-range="${k}">${k === 'all' ? 'All' : k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
      ${range === 'custom' ? `<form class="pl-period-custom"><label><span>From</span><input type="date" name="from" value="${custom.from}" required></label><label><span>To</span><input type="date" name="to" value="${custom.to}" required></label><button type="submit">Apply</button></form>` : ''}`;
    $$('[data-range]', box).forEach(btn => btn.onclick = () => { range = btn.dataset.range; renderStage(); });
    const form = $('.pl-period-custom', box);
    if (form) form.onsubmit = e => { e.preventDefault(); const f = form.from.value, t = form.to.value; if (!f || !t || f > t) { say('Choose a start date before the end date.'); return; } custom = { from: f, to: t }; renderStage(); };
  }

  // ---- Storage (Firestore through the server) --------------------------------
  async function api(method, path, body) {
    const res = await fetch(path, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
    return data;
  }
  async function loadStore() {
    try {
      const data = await api('GET', '/api/pipeline');
      records.clear(); (data.items || []).forEach(r => records.set(r.key, r));
      storeMode = data.store; storeError = null;
    } catch (err) { storeError = err.message; }
    loaded = true;
    rerender();
  }
  async function save(key, patch, message) {
    try {
      const data = await api('PUT', `/api/pipeline/${key}`, patch);
      records.set(key, { ...(records.get(key) || {}), ...data.item });
      if (message) say(message);
    } catch (err) { say(`Could not save: ${err.message}`); await loadStore(); return false; }
    rerender();
    return true;
  }
  const event = (text, detail = '') => ({ at: new Date().toISOString(), text, detail });
  const withEvent = (rec, text, detail) => [event(text, detail), ...((rec && rec.history) || [])];

  // A starting plan when an opportunity enters Proposal: dates spread back
  // from the published deadline (or the next 30 days). Every step is editable.
  function suggestedPlan(item) {
    const start = today(), due = parseDay(item.opp.due);
    const end = due && due > addDays(start, 7) ? due : addDays(start, 30);
    const span = Math.round((end - start) / 864e5);
    return [['Go / no-go and eligibility check', 0.1], ['Assemble core team', 0.2], ['Review funder guidelines and TOR', 0.3], ['Draft technical approach', 0.6], ['Internal review and approval', 0.8], ['Submit proposal', 0.95]]
      .map(([name, f]) => ({ name, owner: item.owner || '', due: iso(addDays(start, Math.max(1, Math.round(span * f)))), done: false }));
  }

  async function moveTo(item, stage) {
    const rec = records.get(item.key);
    const patch = { stage, opp: item.opp, history: withEvent(rec, `Moved to ${STAGE_LABEL[stage].toLowerCase()}`) };
    if (stage === 'Proposal' && !((rec && rec.deliverables) || []).length) {
      patch.deliverables = suggestedPlan({ ...item, owner: (rec && rec.owner) || item.owner || '' });
      patch.history = [event('Starting delivery plan created', `${patch.deliverables.length} suggested deliverables — edit as needed`), ...patch.history];
    }
    if (stage === 'Submitted') patch.submittedAt = new Date().toISOString();
    const ok = await save(item.key, patch, `Moved to ${STAGE_LABEL[stage].toLowerCase()}.`);
    if (ok) { activeStage = stage; if (stage === 'Proposal') activeKey = item.key; closeDrawer(); rerender(); }
  }
  async function removeItem(item) {
    if (!confirm(`Remove “${item.opp.title}” from the pipeline?`)) return;
    try { await api('DELETE', `/api/pipeline/${item.key}`); records.delete(item.key); say('Removed from the pipeline.'); }
    catch (err) { say(`Could not remove: ${err.message}`); }
    closeDrawer(); rerender();
  }
  // "Approve to pursue" on any opportunity record puts it in Internal review.
  window.pipelineApprove = async o => {
    if (!o || !o.title) return;
    const key = oppKey(o), rec = records.get(key);
    if (rec && rec.stage !== 'Declined') { say(`Already in the pipeline · ${STAGE_LABEL[rec.stage] || rec.stage}.`); return; }
    await moveTo({ key, opp: snapshot(o), owner: '' }, 'Internal review');
  };

  // ---- Stage cards and table -------------------------------------------------
  function stageCopy(stage) {
    const list = rows(stage);
    if (stage === 'Qualified') { const v = list.reduce((a, i) => a + parseMoney(i.opp.value), 0); return v ? `${fmtValue(v)} potential` : 'Value not published'; }
    if (stage === 'Internal review') return `${list.length} need decision`;
    if (stage === 'Proposal') return list.length ? `${Math.round(list.reduce((a, i) => a + progress(i), 0) / list.length)}% average progress` : 'No proposals yet';
    return `${list.length} awaiting response`;
  }
  function stageRow(i) {
    const o = i.opp, p = progress(i), na = nextAction(i), fit = fitOf(o.score || 0);
    return `<button class="pipeline-data-row ${i.stage === 'Proposal' && i.key === activeKey ? 'selected-proposal' : ''}" data-key="${esc(i.key)}"><span class="pipeline-check"><input type="checkbox" aria-label="Select ${esc(o.title)}"></span><span class="pipeline-opportunity"><strong class="stage-score">${o.score == null ? '—' : o.score}</strong><span><b>${esc(o.title)}</b><small>${esc(SUBLINE[i.stage](i))}</small></span></span><span><b>${esc(o.org || '—')} · ${esc(o.country || '—')}</b><small>${esc(o.source || '')}</small></span><span><b>${esc(o.pillar || '—')}</b></span><span class="pipeline-owner ${i.owner ? '' : 'unassigned'}"><i>${i.owner ? esc(initials(i.owner)) : '+'}</i><b>${esc(i.owner || 'Unassigned')}<small>${esc(i.owner ? roleOf(i.owner) : 'Assign in the panel')}</small></b></span><span class="pipeline-progress">${p == null ? '<b>—</b>' : `<b>${p}%</b><i><u style="width:${p}%"></u></i>`}</span><span class="pipeline-next"><b>${esc(na.label)}</b><small>${esc(na.text)}</small></span><span class="fit-pill ${fit.toLowerCase()}">${fit}</span><em>›</em></button>`;
  }
  const EMPTY = {
    Qualified: 'No recommended opportunities waiting. New ones appear here after a search; opportunities that need a decision stay on the Opportunities screen.',
    'Internal review': 'Nothing awaiting internal review. Move a qualified opportunity here, or use “Approve to pursue” on any opportunity record.',
    Proposal: 'No proposals in production yet. Approve an opportunity in Internal review to start its delivery plan.',
    Submitted: 'No submitted proposals yet.'
  };

  function renderStage(stage) {
    if (typeof stage === 'string' && STAGES.includes(stage)) activeStage = stage;
    const view = $('#pipelineView'); if (!view) return;
    renderPeriod();
    view.classList.toggle('proposal-mode', activeStage === 'Proposal');
    const metrics = $('#pipelineMetrics');
    if (metrics) {
      metrics.innerHTML = STAGES.map(s => `<button data-pstage="${s}" class="${s === activeStage ? 'active' : ''}"><span>${s}</span><b>${s === 'Qualified' || loaded ? rows(s).length : '…'}</b><small>${s === 'Qualified' || loaded ? stageCopy(s) : 'Loading…'}</small></button>`).join('');
      $$('button', metrics).forEach(b => b.onclick = () => { activeStage = b.dataset.pstage; renderStage(); });
    }
    let note = $('#pipelineStoreNote');
    if (!note) { note = document.createElement('div'); note.id = 'pipelineStoreNote'; note.className = 'status-mapping'; metrics?.after(note); }
    note.hidden = !(storeError || storeMode === 'memory');
    note.innerHTML = storeError ? `<b>Pipeline storage is unavailable —</b> ${esc(storeError)}. Qualified still shows the latest search.` : storeMode === 'memory' ? '<b>Not saved to the database —</b> Firestore is not configured on this server, so pipeline changes last only until it restarts.' : '';
    const title = $('#selectedStageTitle'); if (title) title.textContent = activeStage === 'Proposal' ? 'Proposals in production' : `${activeStage} opportunities`;
    const copy = $('#selectedStageCopy'); if (copy) copy.textContent = activeStage === 'Proposal' ? 'Track owners, deadlines and proposal completion. Select a proposal to open its workspace below.' : activeStage === 'Qualified' ? 'Recommended by the agent in the latest search and ready for a pursuit decision.' : activeStage === 'Internal review' ? 'Opportunities the team is deciding whether to pursue.' : 'Proposals sent to the funder.';
    const table = $('#pipelineTable');
    if (table) {
      const list = rows(activeStage);
      const empty = activeStage !== 'Qualified' && !loaded ? 'Loading the pipeline…' : range !== 'all' && stageItems(activeStage).length ? 'No opportunities in this stage for the selected dates.' : EMPTY[activeStage];
      table.innerHTML = `<div class="pipeline-columns"><span></span><span>Opportunity</span><span>Funder · Country</span><span>Focus area</span><span>Owner</span><span>Progress</span><span>Next action</span><span>Fit</span><span></span></div>${list.map(stageRow).join('') || `<p class="pl-empty">${esc(empty)}</p>`}`;
      $$('.pipeline-data-row', table).forEach(row => row.onclick = e => {
        if (e.target.matches('input')) return;
        const item = itemByKey(row.dataset.key); if (!item) return;
        if (activeStage === 'Proposal') { activeKey = item.key; renderStage(); $('#deliveryPlan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
        openPipelineOpportunity(item);
      });
    }
    renderWorkspace();
  }

  // ---- Side panel for Qualified / Internal review / Submitted ----------------
  function ownerSelect(item, attr = 'data-owner-select') {
    const names = team().map(p => p.name);
    if (item.owner && !names.includes(item.owner)) names.unshift(item.owner);
    return `<select ${attr} aria-label="Owner"><option value="">Unassigned</option>${names.map(n => `<option ${n === item.owner ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select>`;
  }
  function drawerHTML(item) {
    const o = item.opp, na = nextAction(item);
    const actions = item.stage === 'Qualified' ? '<button class="primary" data-move="Internal review">Move to internal review →</button>'
      : item.stage === 'Internal review' ? '<button class="primary" data-move="Proposal">Approve for proposal →</button>'
      : '<button class="secondary" data-move="Proposal">Back to proposal</button>';
    return `<div class="reference-drawer pipeline-drawer"><p class="eyebrow">${esc(STAGE_LABEL[item.stage])} · ${esc(o.org || '')}</p>
      <div class="drawer-heading"><div><h2>${esc(o.title)}</h2><p>${esc(o.country || '')}${o.pillar ? ` · ${esc(o.pillar)}` : ''}</p></div><span class="drawer-fit"><b>${o.score == null ? '—' : `${o.score}%`}</b><small>FIT</small></span></div>
      <div class="recommendation-line"><b>● &nbsp; ${esc(na.label)}</b><span>${esc(na.text)}</span></div>
      <section><h3>Project summary</h3><p>${esc(o.summary || 'No summary available for this opportunity yet.')}</p></section>
      <div class="reference-facts"><div><i>◉</i><span><small>Value</small><b>${esc(o.value || 'Not disclosed')}</b></span></div><div><i>▣</i><span><small>Deadline</small><b>${esc(o.due || 'Not specified')}</b></span></div><div><i>▤</i><span><small>Source</small><b>${esc(o.source || '—')}</b></span></div><div><i>▥</i><span><small>Focus area</small><b>${esc(o.pillar || '—')}</b></span></div></div>
      ${item.stage === 'Qualified' ? '' : `<label class="pl-owner"><span>Owner</span>${ownerSelect(item)}</label>`}
      <div class="pl-stage-actions">${actions}${item.stage === 'Qualified' ? '' : '<button class="link" data-remove-item>Remove from pipeline</button>'}</div>
      <div class="drawer-actions">${o.sourceUrl ? `<a class="secondary" href="${esc(o.sourceUrl)}" target="_blank" rel="noopener">View original publication ↗</a>` : ''}<button class="primary" id="pipelineOpenFull">Open full opportunity record →</button></div></div>`;
  }
  function openRecord(item) {
    if (typeof window.openDetail !== 'function') return;
    const live = findLive(item.key), o = item.opp;
    window.openDetail(live || { id: item.key, type: o.type || 'Opportunity', org: o.org, country: o.country, title: o.title, score: o.score, value: o.value || 'Not disclosed', due: o.due || 'Not specified', pillar: o.pillar, source: o.source, sourceUrl: o.sourceUrl, state: STAGE_LABEL[item.stage], meta: { objective: o.summary } });
  }
  function closeDrawer() {
    $('#drawerScrim')?.classList.remove('show'); $('#quickDrawer')?.classList.remove('show'); $('#quickDrawer')?.setAttribute('aria-hidden', 'true');
  }
  function openPipelineOpportunity(item) {
    if (item.stage === 'Proposal') { activeStage = 'Proposal'; activeKey = item.key; renderStage(); $('#deliveryPlan')?.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    const box = $('#drawerContent'); if (!box) return;
    box.innerHTML = drawerHTML(item);
    $('#drawerScrim')?.classList.add('show'); $('#quickDrawer')?.classList.add('show'); $('#quickDrawer')?.setAttribute('aria-hidden', 'false');
    $('#quickDrawer').scrollTop = 0;
    $('#pipelineOpenFull', box).onclick = () => openRecord(item);
    $$('[data-move]', box).forEach(b => b.onclick = () => moveTo(item, b.dataset.move));
    const rm = $('[data-remove-item]', box); if (rm) rm.onclick = () => removeItem(item);
    const sel = $('[data-owner-select]', box);
    if (sel) sel.onchange = () => save(item.key, { owner: sel.value, history: withEvent(records.get(item.key), sel.value ? `Owner set to ${sel.value}` : 'Owner removed') }, 'Owner saved.');
  }

  // ---- Proposal workspace (selected proposal, below the table) --------------
  let userName = '';
  try { userName = localStorage.getItem('aceso_user_name') || ''; } catch (e) { /* private mode */ }

  function stepMarkup(d, index) {
    return `<div class="delivery-step ${d.done ? 'complete' : ''}"><input data-plan-step="${index}" type="checkbox" aria-label="Mark ${esc(d.name)} as complete" ${d.done ? 'checked' : ''}><span><b>${esc(d.name)}</b><em>${esc(d.owner || 'Unassigned')}</em></span><small class="step-due"><span>${d.done ? 'Completed' : 'Due'}</span><b>${esc(short(d.done ? (d.doneAt || d.due) : d.due) || '—')}</b></small><button type="button" data-remove-step="${index}" aria-label="Remove ${esc(d.name)}">×</button></div>`;
  }
  function formMarkup(item) {
    const members = [...new Set([item.owner, ...(item.deliverables || []).map(d => d.owner)].filter(Boolean))];
    const people = [...new Set([...members, ...team().map(p => p.name)])];
    return `<form class="new-step-form deliverable-form" id="newStepForm"><header><div><p class="eyebrow">NEW DELIVERABLE</p><h3>Add work to the delivery plan</h3><p>Define ownership and due date. Evidence can be added now or when the work is completed.</p></div><button type="button" id="closeNewStep" aria-label="Close">×</button></header>
      <div class="dl-body"><div class="dl-fields"><label><span>Deliverable name</span><input id="newStepName" placeholder="e.g. Draft technical approach" required></label><label><span>Responsible person(s)</span><input id="newStepOwner" list="dlPeople" placeholder="Select or enter names" required></label><label><span>Due date</span><input id="newStepDate" type="date" required></label></div><datalist id="dlPeople">${people.map(n => `<option value="${esc(n)}">`).join('')}</datalist>
      <div class="dl-evidence"><span class="dl-label">Supporting evidence <small>Optional</small></span><div><label class="dl-ev"><i>▤</i><span><b>Upload file / PDF</b><input id="newStepFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"></span></label><label class="dl-ev"><i>↗</i><span><b>Attach link</b><input id="newStepLink" type="url" placeholder="https://..."></span></label></div></div>
      <section class="dl-email"><label class="dl-email-toggle"><input type="checkbox" id="dlEmail"><span><b>Send email notification</b><small>Choose exactly who receives it and when.</small></span><em>Optional</em></label><div class="dl-email-body" hidden><div class="dl-radios"><label><input type="radio" name="dlWho" value="all" checked><span><b>All proposal members</b><small>${esc(members.join(', ') || 'The owner and everyone with a deliverable')}</small></span></label><label><input type="radio" name="dlWho" value="specific"><span><b>Specific recipients</b><small>One person or as many as needed</small></span></label></div><div class="dl-recipients" hidden><span class="dl-label">Email recipients</span><div class="dl-chips"></div><div class="dl-add"><input type="email" id="dlRecipient" placeholder="name@acesoglobal.org"><button type="button" id="dlAddRecipient">＋ Add recipient</button></div><small>Add one email at a time. You can remove any recipient before scheduling.</small></div><div class="dl-timing"><label><span>Delivery timing</span><select id="dlTiming"><option value="now">Send when the deliverable is added</option><option value="schedule">Schedule a specific date and time</option></select></label><label class="dl-when" hidden><span>Send on</span><input type="datetime-local" id="dlWhen"></label></div></div></section></div>
      <footer><button type="button" class="secondary" id="cancelNewStep">Cancel</button><button class="primary">Add deliverable →</button></footer></form>`;
  }

  function renderWorkspace() {
    const box = $('#deliveryPlan'); if (!box) return;
    const proposals = activeStage === 'Proposal' ? rows('Proposal') : [];
    if (!proposals.length) { box.hidden = true; box.innerHTML = ''; return; }
    if (!proposals.some(p => p.key === activeKey)) activeKey = proposals[0].key;
    const item = records.get(activeKey), o = item.opp, list = item.deliverables || [];
    const done = doneCount(item), pc = progress(item), next = nextStep(item);
    const overdue = list.filter(d => !d.done && parseDay(d.due) && parseDay(d.due) < today());
    const approval = list.find(d => !d.done && /review|approv/i.test(d.name));
    const members = [...new Set([item.owner, ...list.map(d => d.owner)].flatMap(n => String(n || '').split(/\s*[·,]\s*/)).map(n => n.trim()).filter(Boolean))];
    const comments = [...(item.comments || [])].sort((a, b) => String(b.at).localeCompare(String(a.at)));
    box.hidden = false;
    box.innerHTML = `<header class="proposal-workspace-head"><div><p class="eyebrow">SELECTED PROPOSAL</p><h2>${esc(o.title)}</h2><p>${esc(o.org || '')}${o.country ? ` · ${esc(o.country)}` : ''} · Proposal stage</p></div><div class="pw-head-actions"><span>● &nbsp; In progress</span><button type="button" class="pw-submit" data-submit>Mark as submitted</button></div></header>
      <section class="proposal-workspace-summary"><div><small>Proposal readiness</small><b>${pc}%</b><i><u style="width:${pc}%"></u></i><em>${done} of ${list.length} deliverables complete</em></div><div><small>Next action</small><b>${esc(next ? next.name : 'No action pending')}</b></div><div><small>Deadline</small><b>${esc(o.due || 'Not specified')}</b></div><div><small>Owner</small>${ownerSelect(item, 'data-ws-owner')}</div></section>
      <section class="proposal-attention"><header><p class="eyebrow">NEEDS ATTENTION NOW</p></header><div><article><small>Next action</small><b>${esc(next ? next.name : 'All deliverables complete')}</b><em>${esc(next && next.due ? `Due ${short(next.due)}` : next ? 'No due date' : 'Ready to submit')}</em></article><article><small>Overdue</small><b>${overdue.length ? `${overdue.length} overdue deliverable${overdue.length === 1 ? '' : 's'}` : 'Nothing overdue'}</b><em>${esc(overdue.length ? overdue.map(d => d.name).join(', ') : 'Every open deliverable is on schedule')}</em></article><article><small>Next approval</small><b>${esc(approval ? approval.name : 'No approval pending')}</b><em>${esc(approval && approval.due ? `Due ${short(approval.due)}` : '—')}</em></article></div></section>
      <div class="proposal-workspace-body"><main><section class="proposal-delivery-sequence"><header><div><p class="eyebrow">EDITABLE DELIVERY PLAN</p><h3>From plan to submission</h3><p>Deliverables, owners, evidence and dates in one continuous sequence.</p></div><button type="button" id="addPlanStep">＋ Add deliverable</button></header><div class="delivery-sequence">${list.map(stepMarkup).join('') || '<p class="pl-empty">No deliverables yet. Add the first one.</p>'}</div></section></main>
      <aside><section><h3>Core team</h3><div class="workspace-team">${members.map(n => `<span><i>${esc(initials(n))}</i><b>${esc(n)}${roleOf(n) ? `<small>${esc(roleOf(n))}</small>` : ''}</b></span>`).join('') || '<small>No team members assigned yet.</small>'}</div></section>
      <section class="workspace-comments-panel"><header><h3>Team comments</h3><span>${comments.length}</span></header><div class="workspace-comments" id="proposalComments">${comments.map(c => `<article><i>${esc(initials(c.author))}</i><span><b>${esc(c.author)}</b><p>${esc(c.text)}</p><small>${esc(when(c.at))}</small></span></article>`).join('') || '<small class="wc-empty">No comments yet.</small>'}</div><form class="workspace-comment-form ${userName ? '' : 'needs-name'}" id="proposalCommentForm">${userName ? '' : '<input class="wc-name" aria-label="Your name" placeholder="Your name" required>'}<input class="wc-text" aria-label="Add a team comment" placeholder="Add a comment…" required><button aria-label="Post comment">↑</button></form></section></aside></div>
      ${formMarkup(item)}
      <section class="project-history"><header><div><p class="eyebrow">PROJECT HISTORY</p><h3>Deliverables and evidence</h3></div><label class="evidence-upload">＋ Attach evidence<input id="projectEvidence" type="file" multiple></label></header><div class="history-list">${(item.history || []).map(h => `<div><time>${esc(short(h.at))}</time><span><b>${esc(h.text)}</b>${h.detail ? `<small>${esc(h.detail)}</small>` : ''}</span></div>`).join('') || '<p class="pl-empty">No activity yet.</p>'}</div><p class="pl-caption">Files are not uploaded yet — the history records their names. Links are kept as entered.</p></section>`;
    bindWorkspace(box, item);
  }

  function bindWorkspace(box, item) {
    const key = item.key;
    const persist = (patch, msg) => save(key, patch, msg);
    $('[data-submit]', box).onclick = () => { if (confirm('Mark this proposal as submitted to the funder?')) moveTo(item, 'Submitted'); };
    const ws = $('[data-ws-owner]', box);
    ws.onchange = () => persist({ owner: ws.value, history: withEvent(item, ws.value ? `Owner set to ${ws.value}` : 'Owner removed') }, 'Owner saved.');
    $$('[data-plan-step]', box).forEach(input => input.onchange = () => {
      const index = Number(input.dataset.planStep), list = [...item.deliverables];
      if (input.checked) { input.checked = false; openEvidenceDialog(item, index); return; }
      list[index] = { ...list[index], done: false, doneAt: '' };
      persist({ deliverables: list, history: withEvent(item, `Reopened · ${list[index].name}`) });
    });
    $$('[data-remove-step]', box).forEach(btn => btn.onclick = () => {
      const index = Number(btn.dataset.removeStep), name = item.deliverables[index].name;
      if (!confirm(`Remove “${name}” from the delivery plan?`)) return;
      persist({ deliverables: item.deliverables.filter((_, i) => i !== index), history: withEvent(item, `Deliverable removed · ${name}`) });
    });
    const form = $('#newStepForm', box);
    const open = () => { form.classList.add('show'); document.body.classList.add('deliverable-drawer-open'); $('#newStepName', form).focus(); };
    const close = () => { form.classList.remove('show'); document.body.classList.remove('deliverable-drawer-open'); };
    $('#addPlanStep', box).onclick = open;
    $('#closeNewStep', form).onclick = $('#cancelNewStep', form).onclick = close;
    bindDeliverableForm(form, item, close);
    $('#projectEvidence', box).onchange = e => {
      const files = [...e.target.files]; if (!files.length) return;
      persist({ history: [...files.map(f => event('Evidence attached', f.name)), ...(item.history || [])] }, 'Evidence recorded in the project history.');
    };
    $('#proposalCommentForm', box).onsubmit = async e => {
      e.preventDefault();
      const nameInput = $('.wc-name', e.currentTarget), text = $('.wc-text', e.currentTarget).value.trim();
      if (nameInput) { userName = nameInput.value.trim(); try { localStorage.setItem('aceso_user_name', userName); } catch (err) { /* private mode */ } }
      if (!text || !userName) return;
      try {
        const data = await api('POST', `/api/pipeline/${key}/comments`, { author: userName, text });
        const rec = records.get(key); rec.comments = [...(rec.comments || []), data.comment]; renderWorkspace();
      } catch (err) { say(`Could not post the comment: ${err.message}`); }
    };
  }

  function bindDeliverableForm(form, item, close) {
    const recipients = [];
    const f = sel => $(sel, form);
    const chips = () => { f('.dl-chips').innerHTML = recipients.map((r, i) => `<span>${esc(r)}<button type="button" data-rm="${i}" aria-label="Remove ${esc(r)}">×</button></span>`).join(''); $$('[data-rm]', form).forEach(b => b.onclick = () => { recipients.splice(Number(b.dataset.rm), 1); chips(); }); };
    const who = () => $('input[name="dlWho"]:checked', form).value;
    const sync = () => { f('.dl-email-body').hidden = !f('#dlEmail').checked; f('.dl-recipients').hidden = who() !== 'specific'; f('.dl-when').hidden = f('#dlTiming').value !== 'schedule'; };
    f('#dlEmail').onchange = sync; f('#dlTiming').onchange = sync;
    $$('input[name="dlWho"]', form).forEach(r => r.onchange = sync);
    const addRecipient = () => {
      const v = f('#dlRecipient').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { say('Enter a valid email address.'); return; }
      if (!recipients.includes(v)) recipients.push(v);
      f('#dlRecipient').value = ''; chips();
    };
    f('#dlAddRecipient').onclick = addRecipient;
    f('#dlRecipient').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addRecipient(); } };
    form.onsubmit = async e => {
      e.preventDefault();
      const email = f('#dlEmail').checked, timing = f('#dlTiming').value, whenAt = f('#dlWhen').value;
      if (email && who() === 'specific' && !recipients.length) { say('Add at least one recipient, or choose all proposal members.'); return; }
      if (email && timing === 'schedule' && !whenAt) { say('Choose when the email should be sent.'); return; }
      const name = f('#newStepName').value.trim(), owner = f('#newStepOwner').value.trim(), due = f('#newStepDate').value;
      const file = f('#newStepFile').files[0], link = f('#newStepLink').value.trim();
      const history = [event('Deliverable added', `${name} · ${owner} · due ${short(due)}`)];
      if (file || link) history.unshift(event(`Evidence added · ${name}`, file ? file.name : link));
      if (email) {
        const to = who() === 'all' ? 'All proposal members' : recipients.join(', ');
        history.unshift(event(`Email notification ${timing === 'schedule' ? 'scheduled' : 'requested'} · ${name}`, `To ${to} · ${timing === 'schedule' ? when(whenAt) : 'on creation'} · not sent (email is not connected yet)`));
      }
      close();
      await save(item.key, { deliverables: [...(item.deliverables || []), { name, owner, due, done: false }], history: [...history, ...(item.history || [])] },
        email ? 'Deliverable added. The notification is recorded; email sending is not connected yet.' : 'Deliverable added to the delivery plan.');
    };
    sync();
  }

  function openEvidenceDialog(item, index) {
    let dialog = $('#deliverableEvidenceDialog');
    if (!dialog) {
      document.body.insertAdjacentHTML('beforeend', `<dialog class="evidence-dialog" id="deliverableEvidenceDialog"><form method="dialog"><header><div><p class="eyebrow">COMPLETE DELIVERABLE</p><h2>Complete deliverable</h2><p>Add a file, link or comment if you need a traceable record. Everything is optional.</p></div><button type="button" class="dialog-x" aria-label="Close">×</button></header><div class="evidence-choice-grid"><label><span>▤</span><b>Upload file or PDF</b><small>PDF, DOCX, XLSX or image</small><input id="completionFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"></label><label><span>↗</span><b>Add a source link</b><small>Drive, SharePoint or reference URL</small><input id="completionLink" type="url" placeholder="https://..."></label></div><label class="evidence-note"><span>Comment <small>Optional</small></span><textarea id="completionNote" placeholder="Add a completion note or approval context..."></textarea></label><footer><button type="button" class="secondary" id="completeWithoutEvidence">✓ Complete only</button><button class="primary" value="save">Save details &amp; complete →</button></footer></form></dialog>`);
      dialog = $('#deliverableEvidenceDialog');
      $('.dialog-x', dialog).onclick = () => dialog.close('cancel');
    }
    const step = item.deliverables[index];
    $('h2', dialog).textContent = step.name;
    $('#completionFile', dialog).value = ''; $('#completionLink', dialog).value = ''; $('#completionNote', dialog).value = '';
    $('#completeWithoutEvidence', dialog).onclick = () => dialog.close('skip');
    dialog.oncancel = e => { e.preventDefault(); dialog.close('cancel'); };
    dialog.onclose = () => {
      if (!['save', 'skip'].includes(dialog.returnValue)) return;
      const history = [event(`Completed · ${step.name}`, step.owner || '')];
      if (dialog.returnValue === 'save') {
        const file = $('#completionFile', dialog).files[0], link = $('#completionLink', dialog).value.trim(), note = $('#completionNote', dialog).value.trim();
        if (file) history.unshift(event(`File attached · ${step.name}`, file.name));
        if (link) history.unshift(event(`Link added · ${step.name}`, link));
        if (note) history.unshift(event(`Completion comment · ${step.name}`, note));
      }
      const list = [...item.deliverables]; list[index] = { ...step, done: true, doneAt: new Date().toISOString() };
      save(item.key, { deliverables: list, history: [...history, ...(item.history || [])] });
    };
    dialog.showModal();
  }

  // ---- Dashboard / Copilot numbers ------------------------------------------
  window.pipelineStats = function pipelineStats() {
    const lists = STAGES.map(s => stageItems(s));
    const all = lists.flat();
    return {
      stages: STAGES, counts: lists.map(l => l.length), loaded, fmtValue,
      totalValue: all.reduce((a, i) => a + parseMoney(i.opp.value), 0),
      items: all.map(i => ({ stage: i.stage, title: i.opp.title, funder: i.opp.org, country: i.opp.country, owner: i.owner || 'Unassigned', progressPct: progress(i), nextAction: nextAction(i).label, date: nextAction(i).text, fit: fitOf(i.opp.score || 0), value: i.opp.value || 'Not disclosed' }))
    };
  };

  // ---- Today: stage strip + quick view ---------------------------------------
  const QUICK_TITLE = { Qualified: 'Qualified work', 'Internal review': 'Awaiting internal review', Proposal: 'Proposal work', Submitted: 'Submitted, awaiting response' };
  let quickStage = null;
  function quickHTML(stage) {
    const items = stageItems(stage).map(i => {
      const badge = stage === 'Proposal' ? `${progress(i)}%` : i.opp.score == null ? '—' : `${i.opp.score}%`;
      return `<button type="button" data-quick="${esc(i.key)}"><span class="sq-badge">${badge}</span><span class="sq-main"><b>${esc(i.opp.title)}</b><small>${esc(i.opp.org || '')} · ${esc(i.opp.country || '')}</small></span><span class="sq-right">${esc(nextAction(i).text)}</span><em>›</em></button>`;
    }).join('');
    return `<header><div><p class="eyebrow">QUICK VIEW</p><h3>${QUICK_TITLE[stage]}</h3></div><button type="button" class="sq-close" aria-label="Close quick view">×</button></header>${items ? `<div class="sq-grid">${items}</div><footer>Select an opportunity to open it in the ${STAGE_LABEL[stage].toLowerCase()} stage.</footer>` : `<p class="pl-empty">${esc(EMPTY[stage])}</p>`}`;
  }
  function renderTodayStrip() {
    const strip = $('#todayView .stage-strip'); if (!strip) return;
    const copy = { Qualified: stageCopy('Qualified'), 'Internal review': `${stageItems('Internal review').length} need decision`, Proposal: stageItems('Proposal').length ? `${Math.round(stageItems('Proposal').reduce((a, i) => a + progress(i), 0) / stageItems('Proposal').length)}% avg. completion` : 'No proposals yet', Submitted: `${stageItems('Submitted').length} awaiting response` };
    const label = { Qualified: 'Qualified', 'Internal review': 'Internal review', Proposal: 'Proposals in progress', Submitted: 'Submitted' };
    strip.innerHTML = STAGES.map(s => `<button data-stage="${s}" class="${quickStage === s ? 'active' : ''}" aria-expanded="${quickStage === s}"><span>${s === 'Qualified' || loaded ? stageItems(s).length : '…'}</span><div><b>${label[s]}</b><small>${s === 'Qualified' || loaded ? copy[s] : 'Loading…'}</small></div><em>→</em></button>`).join('');
    let panel = $('#stageQuick');
    if (!panel) { panel = document.createElement('section'); panel.id = 'stageQuick'; panel.className = 'stage-quick'; strip.after(panel); }
    panel.hidden = !quickStage;
    panel.innerHTML = quickStage ? quickHTML(quickStage) : '';
    $$('[data-stage]', strip).forEach(b => b.onclick = () => { quickStage = quickStage === b.dataset.stage ? null : b.dataset.stage; renderTodayStrip(); });
    if (!quickStage) return;
    $('.sq-close', panel).onclick = () => { quickStage = null; renderTodayStrip(); };
    $$('[data-quick]', panel).forEach(b => b.onclick = () => {
      const item = itemByKey(b.dataset.quick); if (!item) return;
      window.showView('pipeline'); range = 'all'; renderStage(item.stage);
      setTimeout(() => openPipelineOpportunity(item));
    });
  }

  function rerender() { renderStage(); renderTodayStrip(); }
  window.renderPipeline = rerender;
  renderTodayStrip();
  document.addEventListener('DOMContentLoaded', () => { renderStage(); loadStore(); });
  document.addEventListener('aceso:live-search-complete', rerender);
})();
