(() => {
  // Illustrative example pipeline for demos — there is no backend yet that
  // tracks which real search results have been approved to pursue, so this
  // is a fixed, deliberately-crafted example dataset (generic project
  // shapes against real funder types), not live data. window.pipelineStats()
  // exposes the same numbers the Dashboard's pipeline funnel reads, so the
  // two views can never disagree.
  // Stages, rows and owners follow Yael's pipeline (Aceso team members as
  // owners). Values are illustrative so example totals can be computed.
  const stageData = {
    Qualified: [
      { score: 93, title: 'Health Financing Reform & Domestic Resource Mobilization', summary: 'Eligibility, evidence and team availability', funder: 'World Bank', country: 'Kenya', focus: 'Health systems financing', owner: 'Kirby McDonald', initials: 'KM', progress: 35, next: 'Complete human review', date: '16 Sep 2026', fit: 'High', value: 2600000 },
      { score: 88, title: 'Primary Healthcare Service Delivery Strengthening', summary: 'Build resilient PHC systems', funder: 'WHO', country: 'Rwanda', focus: 'Primary healthcare', owner: 'Brendan Lawler', initials: 'BL', progress: 20, next: 'Review guidelines', date: '12 Sep 2026', fit: 'High', value: 1800000 },
      { score: 81, title: 'UHC Implementation Support', summary: 'Technical assistance and capacity building', funder: 'Gates Foundation', country: 'Nigeria', focus: 'Universal health coverage', owner: 'Gráinne O\'Casey', initials: 'GO', progress: 10, next: 'Assess eligibility', date: '20 Sep 2026', fit: 'Medium', value: 1200000 }
    ],
    'Internal review': [
      { score: 93, title: 'Health Financing Reform & Domestic Resource Mobilization', summary: 'Awaiting final pursuit decision', funder: 'World Bank', country: 'Kenya', focus: 'Health systems financing', owner: 'Lizeth Hernandez-Rubio', initials: 'LH', progress: 72, next: 'Confirm delivery team', date: '16 Sep 2026', fit: 'High', value: 2600000 },
      { score: 90, title: 'Provider Payment Systems in Sub-Saharan Africa', summary: 'Evidence review in progress', funder: 'Gates Foundation', country: 'Rwanda', focus: 'Provider payments', owner: 'Jonty Roland', initials: 'JR', progress: 58, next: 'Approve to pursue', date: '13 Sep 2026', fit: 'High', value: 1400000 }
    ],
    Proposal: [
      { score: 91, title: 'Maternal Health Systems Strengthening', summary: 'Proposal production in progress', funder: 'UNFPA', country: 'Tanzania', focus: 'Maternal health', owner: 'Lizeth Hernandez-Rubio', initials: 'LH', progress: 75, next: 'Technical review', date: '28 Sep 2026', fit: 'High', value: 1100000 },
      { score: 86, title: 'Digital Health for UHC', summary: 'Drafting technical approach', funder: 'European Union', country: 'Multiple countries', focus: 'Digital health', owner: 'Gráinne O\'Casey', initials: 'GO', progress: 40, next: 'Complete concept note', date: '15 Oct 2026', fit: 'High', value: 2400000 },
      { score: 84, title: 'Health Workforce Capacity Building', summary: 'Team and workplan development', funder: 'World Bank', country: 'Ghana', focus: 'Health workforce', owner: 'Brendan Lawler', initials: 'BL', progress: 25, next: 'Assemble core team', date: '3 Nov 2026', fit: 'Medium', value: 900000 }
    ],
    Submitted: [
      { score: 92, title: 'Health Systems Governance Advisory', summary: 'Submitted · awaiting response', funder: 'World Bank', country: 'Kenya', focus: 'Governance', owner: 'Lizeth Hernandez-Rubio', initials: 'LH', progress: 100, next: 'Funder response', date: '18 Sep 2026', fit: 'High', value: 1650000 },
      { score: 87, title: 'Regional Health Financing Support', summary: 'Submitted · clarification window', funder: 'African Development Bank', country: 'Rwanda', focus: 'Health financing', owner: 'Kirby McDonald', initials: 'KM', progress: 100, next: 'Monitor response', date: '24 Sep 2026', fit: 'High', value: 940000 }
    ]
  };

  const plans = [
    { title: 'Maternal Health Systems Strengthening', funder: 'UNFPA', country: 'Tanzania', due: '28 Sep 2026',
      steps: [['Initial opportunity assessment', '2 Sep', true, 'Kirby McDonald'], ['Assemble core team', '4 Sep', true, 'Kirby McDonald · Jonty Roland'], ['Review funder guidelines', '7 Sep', true, 'Gráinne O\'Casey'], ['Develop concept note', '16 Sep', false, 'Lizeth Hernandez-Rubio · Kirby McDonald'], ['Internal review and approval', '22 Sep', false, 'Jonty Roland'], ['Prepare full proposal', '6 Oct', false, 'Proposal team']],
      history: [['7 Sep', 'Funder guidelines reviewed', 'UNFPA-guidelines.pdf'], ['4 Sep', 'Core team confirmed', 'Team-availability.xlsx'], ['2 Sep', 'Opportunity assessment completed', 'Assessment-v1.docx']] },
    { title: 'Digital Health for UHC', funder: 'EU', country: 'Multiple countries', due: '15 Oct 2026',
      steps: [['Requirements mapped', '5 Sep', true, 'Gráinne O\'Casey'], ['Win themes agreed', '8 Sep', true, 'Gráinne O\'Casey · Lizeth Hernandez-Rubio'], ['Draft technical approach', '24 Sep', false, 'Jonty Roland'], ['Past performance selected', '28 Sep', false, 'Lizeth Hernandez-Rubio'], ['Pricing review', '8 Oct', false, 'Finance · Maureen Lewis']],
      history: [['8 Sep', 'Win themes approved', 'Win-themes-v2.docx'], ['5 Sep', 'Requirements mapped', 'Compliance-matrix.xlsx']] },
    { title: 'Health Workforce Capacity Building', funder: 'World Bank', country: 'Ghana', due: '3 Nov 2026',
      steps: [['Kickoff complete', '7 Sep', true, 'Brendan Lawler'], ['Partner validation', '18 Sep', false, 'Kirby McDonald'], ['Draft outline', '25 Sep', false, 'Brendan Lawler · Lizeth Hernandez-Rubio'], ['Team CVs', '2 Oct', false, 'People operations']],
      history: [['7 Sep', 'Proposal kickoff held', 'Kickoff-notes.pdf']] }
  ];
  let activeStage = 'Qualified';
  let activePlan = 0;

  // Date navigation (same control as the Dashboard): filters every stage by
  // each row's next-action / due date.
  let range = 'all', custom = { from: '', to: '' };
  const RANGE_LABEL = { all: 'All dates', week: 'This week', month: 'This month', quarter: 'This quarter' };
  const parseDay = t => { const d = new Date(Date.parse(t)); return Number.isNaN(d.getTime()) ? null : d; };
  const fmtDay = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  function rangeBounds() {
    const now = new Date(); now.setHours(0, 0, 0, 0);
    if (range === 'week') { const a = new Date(now); a.setDate(a.getDate() - ((a.getDay() + 6) % 7)); const b = new Date(a); b.setDate(b.getDate() + 6); b.setHours(23, 59, 59); return [a, b]; }
    if (range === 'month') return [new Date(now.getFullYear(), now.getMonth(), 1), new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59)];
    if (range === 'quarter') { const q0 = Math.floor(now.getMonth() / 3) * 3; return [new Date(now.getFullYear(), q0, 1), new Date(now.getFullYear(), q0 + 3, 0, 23, 59, 59)]; }
    if (range === 'custom' && custom.from && custom.to) return [new Date(custom.from + 'T00:00:00'), new Date(custom.to + 'T23:59:59')];
    return null;
  }
  const inRange = t => { const b = rangeBounds(); if (!b) return true; const d = parseDay(t); return !!d && d >= b[0] && d <= b[1]; };
  const rows = stage => stageData[stage].filter(x => inRange(x.date));

  function renderPeriod() {
    const metrics = document.querySelector('#pipelineMetrics'); if (!metrics) return;
    let box = document.querySelector('#pipelinePeriod');
    if (!box) { box = document.createElement('div'); box.id = 'pipelinePeriod'; box.className = 'pl-period'; metrics.before(box); }
    const b = rangeBounds();
    const label = range === 'custom' && !(custom.from && custom.to) ? 'Choose dates' : range === 'all' ? RANGE_LABEL.all : `${RANGE_LABEL[range] || 'Custom range'} · ${fmtDay(b[0])} – ${fmtDay(b[1])}`;
    box.innerHTML = `<span class="pl-period-summary"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg></i><span><small>Next action & due dates</small><strong>${label}</strong></span></span>
      <div class="pl-period-tabs" role="tablist" aria-label="Date range">${['all', 'week', 'month', 'quarter', 'custom'].map(k => `<button type="button" role="tab" aria-selected="${range === k}" class="${range === k ? 'active' : ''}" data-range="${k}">${k === 'all' ? 'All' : k[0].toUpperCase() + k.slice(1)}</button>`).join('')}</div>
      ${range === 'custom' ? `<form class="pl-period-custom"><label><span>From</span><input type="date" name="from" value="${custom.from}" required></label><label><span>To</span><input type="date" name="to" value="${custom.to}" required></label><button type="submit">Apply</button></form>` : ''}`;
    box.querySelectorAll('[data-range]').forEach(btn => btn.onclick = () => { range = btn.dataset.range; renderStage(); renderPlans(); });
    const form = box.querySelector('.pl-period-custom');
    if (form) form.onsubmit = e => { e.preventDefault(); const f = form.from.value, t = form.to.value; if (!f || !t || f > t) { if (typeof toast === 'function') toast('Choose a start date before the end date.'); return; } custom = { from: f, to: t }; renderStage(); renderPlans(); };
  }

  const STAGES = ['Qualified', 'Internal review', 'Proposal', 'Submitted'];
  const avg = list => list.length ? Math.round(list.reduce((a, x) => a + x.progress, 0) / list.length) : 0;

  function fmtValue(n) { return n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`; }

  // Read by the Dashboard's pipeline funnel so the two views can never
  // show different numbers for the same example data.
  function pipelineStats() {
    const stages = STAGES;
    const counts = stages.map(s => stageData[s].length);
    const totalValue = stages.reduce((sum, s) => sum + stageData[s].reduce((a, x) => a + x.value, 0), 0);
    const items = stages.flatMap(s => stageData[s].map(x => ({ stage: s, title: x.title, funder: x.funder, country: x.country, owner: x.owner, progressPct: x.progress, nextAction: x.next, date: x.date, fit: x.fit, value: fmtValue(x.value) })));
    return { stages, counts, totalValue, fmtValue, items };
  }
  window.pipelineStats = pipelineStats;

  function stageRow(item) {
    return `<button class="pipeline-data-row" data-title="${escapeHtml(item.title)}"><span class="pipeline-check"><input type="checkbox" aria-label="Select ${escapeHtml(item.title)}"></span><span class="pipeline-opportunity"><strong class="stage-score">${item.score}</strong><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.summary)}</small></span></span><span><b>${escapeHtml(item.funder)} · ${escapeHtml(item.country)}</b><small>${escapeHtml(item.country)}</small></span><span><b>${escapeHtml(item.focus)}</b></span><span class="pipeline-owner"><i>${escapeHtml(item.initials)}</i><b>${escapeHtml(item.owner)}<small>Analyst</small></b></span><span class="pipeline-progress"><b>${item.progress}%</b><i><u style="width:${item.progress}%"></u></i></span><span class="pipeline-next"><b>${escapeHtml(item.next)}</b><small>${escapeHtml(item.date)}</small></span><span class="fit-pill ${item.fit.toLowerCase()}">${escapeHtml(item.fit)}</span><em>›</em></button>`;
  }

  function renderStage(stage) {
    if (typeof stage === 'string' && stageData[stage]) activeStage = stage;
    renderPeriod();
    // Proposal shows only "Proposal production" (the stage table repeats it).
    document.querySelector('#pipelineView')?.classList.toggle('proposal-mode', activeStage === 'Proposal');
    const stageSummary = [
      ['Qualified', rows('Qualified').length, `${fmtValue(rows('Qualified').reduce((a, x) => a + x.value, 0))} potential`],
      ['Internal review', rows('Internal review').length, `${rows('Internal review').length} need decision`],
      ['Proposal', rows('Proposal').length, `${avg(rows('Proposal'))}% average progress`],
      ['Submitted', rows('Submitted').length, `${rows('Submitted').filter(x => x.next === 'Funder response').length} response due`]
    ];
    const metrics = document.querySelector('#pipelineMetrics');
    if (metrics) {
      metrics.innerHTML = stageSummary.map(([name, count, copy]) => `<button data-pstage="${name}" class="${name === activeStage ? 'active' : ''}"><span>${name}</span><b>${count}</b><small>${copy}</small></button>`).join('');
      metrics.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { activeStage = button.dataset.pstage; renderStage(); renderPlans(); }));
    }
    if (!document.querySelector('#exampleDataNote')) {
      const note = document.createElement('div'); note.id = 'exampleDataNote'; note.className = 'status-mapping';
      note.innerHTML = '<b>Example pipeline —</b> illustrative projects shown to demonstrate the workflow. Live pipeline tracking (real opportunities moving through these stages) is not connected yet.';
      metrics?.after(note);
    }
    const title = document.querySelector('#selectedStageTitle'); if (title) title.textContent = activeStage === 'Proposal' ? 'Proposals in production' : `${activeStage} opportunities`;
    const copy = document.querySelector('#selectedStageCopy'); if (copy) copy.textContent = activeStage === 'Proposal' ? 'Track owners, deadlines and proposal completion.' : 'Review evidence, ownership and the next required decision.';
    const table = document.querySelector('#pipelineTable');
    if (table) {
      table.innerHTML = `<div class="pipeline-columns"><span></span><span>Opportunity</span><span>Funder · Country</span><span>Focus area</span><span>Owner</span><span>Progress</span><span>Next action</span><span>Fit</span><span></span></div>${rows(activeStage).map(stageRow).join('') || '<p class="pl-empty">No opportunities in this stage for the selected dates.</p>'}`;
      table.querySelectorAll('.pipeline-data-row').forEach(row => {
        row.addEventListener('click', event => { if (event.target.matches('input')) return; const item = stageData[activeStage].find(x => x.title === row.dataset.title); openPipelineOpportunity(item); });
      });
    }
  }

  function planPercent(plan) { return Math.round(plan.steps.filter(step => step[2]).length / plan.steps.length * 100); }
  function renderPlans() {
    const box = document.querySelector('#proposalPlans'); if (!box) return;
    const visible = plans.map((plan, index) => ({ plan, index })).filter(x => inRange(x.plan.due));
    const head = document.querySelector('#pipelineView .workspace-card h2'); if (head) head.textContent = `${visible.length} active proposal${visible.length === 1 ? '' : 's'}`;
    const all = document.querySelector('#pipelineView .workspace-card .text-link'); if (all) { all.textContent = range === 'all' ? '' : 'Show all dates'; all.onclick = () => { range = 'all'; renderStage(); renderPlans(); }; }
    box.innerHTML = visible.length ? visible.map(({ plan, index }) => {
      const pc = planPercent(plan), next = plan.steps.find(step => !step[2]);
      return `<button class="proposal-summary" data-plan="${index}"><span class="proposal-brand">${index === 0 ? '⚕' : index === 1 ? '✦' : '◎'}</span><span><b>${escapeHtml(plan.title)}</b><small>${escapeHtml(plan.funder)} · ${escapeHtml(plan.country)}</small></span><span class="ps-next"><small>Next deliverable</small><b>${escapeHtml(next ? `${next[0]} · ${next[1]}` : 'All deliverables complete')}</b></span><strong>${pc}%</strong><i><u style="width:${pc}%"></u></i><small>Due<br>${escapeHtml(plan.due)}</small><em>›</em></button>`;
    }).join('') : '<p class="pl-empty">No proposals due in the selected dates.</p>';
    box.querySelectorAll('.proposal-summary').forEach(button => button.addEventListener('click', () => openProposal(Number(button.dataset.plan))));
  }

  function addHistoryEvidence(plan, label, fileName) { if (!fileName) return; plan.history.unshift(['Today', label, fileName]); }

  function openEvidenceDialog(plan, stepIndex) {
    let dialog = document.querySelector('#deliverableEvidenceDialog');
    if (!dialog) {
      document.body.insertAdjacentHTML('beforeend', `<dialog class="evidence-dialog" id="deliverableEvidenceDialog"><form method="dialog"><header><div><p class="eyebrow">COMPLETE DELIVERABLE</p><h2>Complete deliverable</h2><p>Add a file, link or comment if you need a traceable record. Everything is optional.</p></div><button type="button" class="dialog-x" aria-label="Close">×</button></header><div class="evidence-choice-grid"><label><span>▤</span><b>Upload file or PDF</b><small>PDF, DOCX, XLSX or image</small><input id="completionFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"></label><label><span>↗</span><b>Add a source link</b><small>Drive, SharePoint or reference URL</small><input id="completionLink" type="url" placeholder="https://..."></label></div><label class="evidence-note"><span>Comment <small>Optional</small></span><textarea id="completionNote" placeholder="Add a completion note or approval context..."></textarea></label><footer><button type="button" class="secondary" id="completeWithoutEvidence">✓ Complete only</button><button class="primary" value="save">Save details &amp; complete →</button></footer></form></dialog>`);
      dialog = document.querySelector('#deliverableEvidenceDialog');
      dialog.querySelector('.dialog-x').onclick = () => dialog.close('cancel');
    }
    const step = plan.steps[stepIndex];
    dialog.querySelector('h2').textContent = step[0];
    dialog.querySelector('#completionFile').value = '';
    dialog.querySelector('#completionLink').value = '';
    dialog.querySelector('#completionNote').value = '';
    dialog.querySelector('#completeWithoutEvidence').onclick = () => dialog.close('skip');
    dialog.oncancel = event => { event.preventDefault(); dialog.close('cancel') };
    dialog.onclose = () => {
      if (!['save', 'skip'].includes(dialog.returnValue)) return;
      if (dialog.returnValue === 'save') {
        const file = dialog.querySelector('#completionFile').files[0];
        const link = dialog.querySelector('#completionLink').value.trim();
        const note = dialog.querySelector('#completionNote').value.trim();
        addHistoryEvidence(plan, `File attached · ${step[0]}`, file?.name);
        addHistoryEvidence(plan, `Link added · ${step[0]}`, link);
        addHistoryEvidence(plan, `Completion comment · ${step[0]}`, note);
      }
      step[2] = true;
      renderPlans(); renderDeliveryPlan();
    };
    dialog.showModal();
  }

  function stepMarkup(step, index, checked) { return `<div class="delivery-step ${checked ? 'complete' : ''}"><input data-plan-step="${index}" type="checkbox" aria-label="Mark ${escapeHtml(step[0])} as complete" ${checked ? 'checked' : ''}><span><b>${escapeHtml(step[0])}</b><em>${escapeHtml(step[3] || 'Unassigned')}</em></span><small class="step-due"><span>${checked ? 'Completed' : 'Due'}</span><b>${escapeHtml(step[1])}</b></small><button type="button" data-remove-step="${index}" aria-label="Remove ${escapeHtml(step[0])}">×</button></div>`; }

  function renderDeliveryPlan() {
    const box = document.querySelector('#deliveryPlan'); if (!box) return;
    const plan = plans[activePlan], done = plan.steps.filter(step => step[2]).length, pc = planPercent(plan);
    box.innerHTML = `<div class="delivery-head"><div><p class="eyebrow">EDITABLE DELIVERY PLAN</p><h2>${escapeHtml(plan.title)}</h2><p>Turn strategy into action. Track deliverables, owners, evidence and deadlines.</p></div><span>● &nbsp; In progress</span></div><div class="delivery-progress"><div><b>${pc}%</b><span>Overall completion</span></div><i><u style="width:${pc}%"></u></i><small>${done} of ${plan.steps.length} deliverables</small><button id="addPlanStep">＋ Add deliverable</button></div><div class="delivery-columns"><section><header><b>Completed</b><span>${done}</span></header>${plan.steps.map((step, index) => step[2] ? stepMarkup(step, index, true) : '').join('')}</section><section><header><b>Pending</b><span>${plan.steps.length - done}</span></header>${plan.steps.map((step, index) => !step[2] ? stepMarkup(step, index, false) : '').join('')}</section></div><form class="deliverable-form" id="newStepForm"><header><div><p class="eyebrow">NEW DELIVERABLE</p><h3>Add work to the delivery plan</h3><p>Define ownership and due date. Evidence can be added now or when the work is completed.</p></div><button type="button" id="closeNewStep" aria-label="Close">×</button></header><div class="dl-fields"><label><span>Deliverable name</span><input id="newStepName" placeholder="e.g. Draft technical approach" required></label><label><span>Responsible person(s)</span><input id="newStepOwner" list="dlPeople" placeholder="Select or enter names" required></label><label><span>Due date</span><input id="newStepDate" type="date" required></label></div><datalist id="dlPeople">${members(plan).map(n => `<option value="${escapeHtml(n)}">`).join('')}</datalist><div class="dl-evidence"><span class="dl-label">Supporting evidence <small>Optional</small></span><div><label class="dl-ev"><i>▤</i><span><b>Upload file / PDF</b><input id="newStepFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"></span></label><label class="dl-ev"><i>↗</i><span><b>Attach link</b><input id="newStepLink" type="url" placeholder="https://..."></span></label></div></div><section class="dl-email"><label class="dl-email-toggle"><input type="checkbox" id="dlEmail"><span><b>Send email notification</b><small>Choose exactly who receives it and when.</small></span><em>Optional</em></label><div class="dl-email-body" hidden><div class="dl-radios"><label><input type="radio" name="dlWho" value="all" checked><span><b>All proposal members</b><small>${escapeHtml(members(plan).join(', ') || 'The complete team')}</small></span></label><label><input type="radio" name="dlWho" value="specific"><span><b>Specific recipients</b><small>One person or as many as needed</small></span></label></div><div class="dl-recipients" hidden><span class="dl-label">Email recipients</span><div class="dl-chips"></div><div class="dl-add"><input type="email" id="dlRecipient" placeholder="name@acesoglobal.org"><button type="button" id="dlAddRecipient">＋ Add recipient</button></div><small>Add one email at a time. You can remove any recipient before scheduling.</small></div><div class="dl-timing"><label><span>Delivery timing</span><select id="dlTiming"><option value="now">Send when the deliverable is added</option><option value="schedule">Schedule a specific date and time</option></select></label><label class="dl-when" hidden><span>Send on</span><input type="datetime-local" id="dlWhen"></label></div></div></section><footer><button type="button" class="secondary" id="cancelNewStep">Cancel</button><button class="primary">Add deliverable →</button></footer></form><section class="project-history"><header><div><p class="eyebrow">PROJECT HISTORY</p><h3>Deliverables and evidence</h3></div><label class="evidence-upload">＋ Attach evidence<input id="projectEvidence" type="file" multiple></label></header><div class="history-list">${plan.history.map(item => `<div><time>${escapeHtml(item[0])}</time><span><b>${escapeHtml(item[1])}</b><small>▤ ${escapeHtml(item[2])}</small></span></div>`).join('')}</div></section>`;
    box.querySelector('#addPlanStep').addEventListener('click', () => box.querySelector('#newStepForm').classList.toggle('show'));
    box.querySelector('#closeNewStep').onclick = box.querySelector('#cancelNewStep').onclick = () => box.querySelector('#newStepForm').classList.remove('show');
    box.querySelectorAll('[data-plan-step]').forEach(input => input.addEventListener('change', () => { const index = Number(input.dataset.planStep); if (input.checked) { input.checked = false; openEvidenceDialog(plan, index); } else { plan.steps[index][2] = false; renderPlans(); renderDeliveryPlan(); } }));
    box.querySelectorAll('[data-remove-step]').forEach(button => button.addEventListener('click', () => { plan.steps.splice(Number(button.dataset.removeStep), 1); renderPlans(); renderDeliveryPlan(); }));
    bindDeliverableForm(box, plan);
    box.querySelector('#projectEvidence').addEventListener('change', event => { [...event.target.files].forEach(file => plan.history.unshift(['Today', 'Evidence attached', file.name])); renderDeliveryPlan(); });
  }

  // People on a proposal (named owners of its deliverables, not team labels).
  function members(plan) {
    const names = plan.steps.flatMap(step => String(step[3] || '').split(' · ')).map(x => x.trim());
    return [...new Set(names)].filter(n => n && !/team|finance|operations/i.test(n));
  }

  function bindDeliverableForm(box, plan) {
    const form = box.querySelector('#newStepForm'); if (!form) return;
    const recipients = [];
    const $ = sel => form.querySelector(sel);
    const chips = () => { $('.dl-chips').innerHTML = recipients.map((r, i) => `<span>${escapeHtml(r)}<button type="button" data-rm="${i}" aria-label="Remove ${escapeHtml(r)}">×</button></span>`).join(''); form.querySelectorAll('[data-rm]').forEach(b => b.onclick = () => { recipients.splice(Number(b.dataset.rm), 1); chips(); }); };
    const who = () => form.querySelector('input[name="dlWho"]:checked').value;
    const sync = () => {
      $('.dl-email-body').hidden = !$('#dlEmail').checked;
      $('.dl-recipients').hidden = who() !== 'specific';
      $('.dl-when').hidden = $('#dlTiming').value !== 'schedule';
    };
    $('#dlEmail').onchange = sync; $('#dlTiming').onchange = sync;
    form.querySelectorAll('input[name="dlWho"]').forEach(r => r.onchange = sync);
    const addRecipient = () => {
      const v = $('#dlRecipient').value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) { if (typeof toast === 'function') toast('Enter a valid email address.'); return; }
      if (!recipients.includes(v)) recipients.push(v);
      $('#dlRecipient').value = ''; chips();
    };
    $('#dlAddRecipient').onclick = addRecipient;
    $('#dlRecipient').onkeydown = e => { if (e.key === 'Enter') { e.preventDefault(); addRecipient(); } };
    form.addEventListener('submit', event => {
      event.preventDefault();
      const email = $('#dlEmail').checked, timing = $('#dlTiming').value, when = $('#dlWhen').value;
      if (email && who() === 'specific' && !recipients.length) { if (typeof toast === 'function') toast('Add at least one recipient, or choose all proposal members.'); return; }
      if (email && timing === 'schedule' && !when) { if (typeof toast === 'function') toast('Choose when the email should be sent.'); return; }
      const name = $('#newStepName').value.trim(), owner = $('#newStepOwner').value.trim();
      const date = new Date($('#newStepDate').value + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const file = $('#newStepFile').files[0], link = $('#newStepLink').value.trim();
      plan.steps.push([name, date, false, owner]);
      plan.history.unshift(['Today', `Deliverable added · ${name}`, `${owner} · due ${date}`]);
      addHistoryEvidence(plan, `Evidence added · ${name}`, file?.name || link);
      if (email) {
        const to = who() === 'all' ? `All proposal members (${members(plan).length})` : recipients.join(', ');
        const at = timing === 'schedule' ? new Date(when).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : 'on creation';
        plan.history.unshift(['Today', `Email notification ${timing === 'schedule' ? 'scheduled' : 'queued'} · ${name}`, `To ${to} · ${at}`]);
      }
      renderPlans(); renderDeliveryPlan();
      if (typeof toast === 'function') toast(email ? 'Deliverable added. The notification is recorded; email sending is not connected yet.' : 'Deliverable added to the delivery plan.');
    });
    sync();
  }

  // ---- Side panels: same layout as the opportunity summary drawer ----
  const STAGE_LABEL = { Qualified: 'Qualified', 'Internal review': 'Internal review', Proposal: 'Proposal in production', Submitted: 'Submitted' };
  const stageOf = item => STAGES.find(st => stageData[st].includes(item)) || activeStage;
  function summaryHTML(item, extra = '') {
    const stage = stageOf(item);
    return `<div class="reference-drawer pipeline-drawer"><p class="eyebrow">${escapeHtml(STAGE_LABEL[stage])} · ${escapeHtml(item.funder)}</p>
      <div class="drawer-heading"><div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.country)} · ${escapeHtml(item.focus)}</p></div><span class="drawer-fit"><b>${item.score}%</b><small>FIT</small></span></div>
      <div class="recommendation-line"><b>● &nbsp; ${escapeHtml(item.next)}</b><span>Next action · ${escapeHtml(item.date)}</span></div>
      <section><h3>Project summary</h3><p>${escapeHtml(item.summary)}.</p></section>
      <div class="reference-facts"><div><i>◉</i><span><small>Value</small><b>${fmtValue(item.value)}</b></span></div><div><i>▣</i><span><small>Next action due</small><b>${escapeHtml(item.date)}</b></span></div><div><i>▤</i><span><small>Owner</small><b>${escapeHtml(item.owner)}</b></span></div><div><i>▥</i><span><small>Focus area</small><b>${escapeHtml(item.focus)}</b></span></div></div>
      <section class="pl-drawer-progress"><h3>Progress</h3><div><i><u style="width:${item.progress}%"></u></i><b>${item.progress}%</b></div></section>
      ${extra}
      <p class="pl-example">Example pipeline data — illustrative until approvals are tracked in the app.</p>
      <div class="drawer-actions"><button class="primary" id="pipelineOpenFull">Open full opportunity record →</button></div></div>`;
  }
  function showDrawer(item, html) {
    const drawerContent = document.querySelector('#drawerContent'); if (!drawerContent) return;
    drawerContent.innerHTML = html;
    document.querySelector('#drawerScrim')?.classList.add('show'); document.querySelector('#quickDrawer')?.classList.add('show'); document.querySelector('#quickDrawer')?.setAttribute('aria-hidden', 'false');
    document.querySelector('#quickDrawer').scrollTop = 0;
    document.querySelector('#pipelineOpenFull').addEventListener('click', () => { if (typeof window.openDetail === 'function') window.openDetail({ type: 'RFP', org: item.funder, country: item.country, title: item.title, score: item.score, value: fmtValue(item.value), due: item.date, pillar: item.focus, state: 'In pipeline', source: 'Pipeline example', meta: { objective: item.summary } }); });
  }
  // Proposal: the summary for context, then the editable delivery plan.
  function openProposal(index) {
    activePlan = index;
    const plan = plans[index];
    const item = stageData.Proposal.find(x => x.title === plan.title) || { score: 0, title: plan.title, summary: 'Proposal in production', funder: plan.funder, country: plan.country, focus: '', owner: '', progress: planPercent(plan), next: '', date: plan.due, value: 0 };
    showDrawer(item, summaryHTML(item, '<section class="delivery-plan-card in-drawer" id="deliveryPlan"></section>'));
    renderDeliveryPlan();
  }

  function openPipelineOpportunity(item) {
    if (stageOf(item) === 'Proposal') { const i = plans.findIndex(pl => pl.title === item.title); if (i >= 0) return openProposal(i); }
    return showDrawer(item, summaryHTML(item));
  }
  window.renderPipeline = renderStage;

  // The Today screen's stage strip mirrors the pipeline stages and numbers.
  // Clicking a stage opens a quick view of its work right on Today; picking
  // an item opens it in the pipeline.
  const QUICK_TITLE = { Qualified: 'Qualified work', 'Internal review': 'Awaiting internal review', Proposal: 'Proposal work', Submitted: 'Submitted, awaiting response' };
  let quickStage = null;
  function quickHTML(stage) {
    const items = stageData[stage].map(item => {
      const plan = plans.find(pl => pl.title === item.title);
      const badge = stage === 'Proposal' && plan ? `${planPercent(plan)}%` : `${item.score}%`;
      const right = stage === 'Proposal' && plan ? `Due ${plan.due}` : `${item.next} · ${item.date}`;
      return `<button type="button" data-quick="${escapeHtml(item.title)}"><span class="sq-badge">${badge}</span><span class="sq-main"><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.funder)} · ${escapeHtml(item.country)}</small></span><span class="sq-right">${escapeHtml(right)}</span><em>›</em></button>`;
    }).join('');
    return `<header><div><p class="eyebrow">QUICK VIEW</p><h3>${QUICK_TITLE[stage]}</h3></div><button type="button" class="sq-close" aria-label="Close quick view">×</button></header><div class="sq-grid">${items}</div><footer>Select an opportunity to open it in the ${STAGE_LABEL[stage].toLowerCase()} stage.</footer>`;
  }
  function renderTodayStrip() {
    const strip = document.querySelector('#todayView .stage-strip'); if (!strip) return;
    const cards = [
      ['Qualified', 'Qualified', `${fmtValue(stageData.Qualified.reduce((a, x) => a + x.value, 0))} potential`],
      ['Internal review', 'Internal review', `${stageData['Internal review'].length} need decision`],
      ['Proposal', 'Proposals in progress', `${avg(stageData.Proposal)}% avg. completion`],
      ['Submitted', 'Submitted', `${stageData.Submitted.filter(x => x.next === 'Funder response').length} response due`]
    ];
    strip.innerHTML = cards.map(([stage, label, copy]) => `<button data-stage="${stage}" class="${quickStage === stage ? 'active' : ''}" aria-expanded="${quickStage === stage}"><span>${stageData[stage].length}</span><div><b>${label}</b><small>${copy}</small></div><em>→</em></button>`).join('');
    let panel = document.querySelector('#stageQuick');
    if (!panel) { panel = document.createElement('section'); panel.id = 'stageQuick'; panel.className = 'stage-quick'; strip.after(panel); }
    panel.hidden = !quickStage;
    panel.innerHTML = quickStage ? quickHTML(quickStage) : '';
    strip.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => { quickStage = quickStage === b.dataset.stage ? null : b.dataset.stage; renderTodayStrip(); });
    if (!quickStage) return;
    panel.querySelector('.sq-close').onclick = () => { quickStage = null; renderTodayStrip(); };
    panel.querySelectorAll('[data-quick]').forEach(b => b.onclick = () => {
      const stage = quickStage, item = stageData[stage].find(x => x.title === b.dataset.quick);
      window.showView('pipeline'); range = 'all'; renderStage(stage); renderPlans();
      setTimeout(() => openPipelineOpportunity(item));
    });
  }
  renderTodayStrip();
  document.addEventListener('DOMContentLoaded', () => { renderStage(); renderPlans(); renderDeliveryPlan(); });
})();
