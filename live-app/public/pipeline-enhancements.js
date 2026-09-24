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
    const stageSummary = [
      ['Qualified', stageData.Qualified.length, `${fmtValue(stageData.Qualified.reduce((a, x) => a + x.value, 0))} potential`],
      ['Internal review', stageData['Internal review'].length, `${stageData['Internal review'].length} need decision`],
      ['Proposal', stageData.Proposal.length, `${avg(stageData.Proposal)}% average progress`],
      ['Submitted', stageData.Submitted.length, `${stageData.Submitted.filter(x => x.next === 'Funder response').length} response due`]
    ];
    const metrics = document.querySelector('#pipelineMetrics');
    if (metrics) {
      metrics.innerHTML = stageSummary.map(([name, count, copy]) => `<button data-pstage="${name}" class="${name === activeStage ? 'active' : ''}"><span>${name}</span><b>${count}</b><small>${copy}</small></button>`).join('');
      metrics.querySelectorAll('button').forEach(button => button.addEventListener('click', () => { activeStage = button.dataset.pstage; renderStage(); }));
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
      table.innerHTML = `<div class="pipeline-columns"><span></span><span>Opportunity</span><span>Funder · Country</span><span>Focus area</span><span>Owner</span><span>Progress</span><span>Next action</span><span>Fit</span><span></span></div>${stageData[activeStage].map(stageRow).join('')}`;
      table.querySelectorAll('.pipeline-data-row').forEach(row => {
        row.addEventListener('click', event => { if (event.target.matches('input')) return; const item = stageData[activeStage].find(x => x.title === row.dataset.title); openPipelineOpportunity(item); });
      });
    }
  }

  function planPercent(plan) { return Math.round(plan.steps.filter(step => step[2]).length / plan.steps.length * 100); }
  function renderPlans() {
    const box = document.querySelector('#proposalPlans'); if (!box) return;
    box.innerHTML = plans.map((plan, index) => `<button class="proposal-summary ${index === activePlan ? 'active' : ''}" data-plan="${index}"><span class="proposal-brand">${index === 0 ? '⚕' : index === 1 ? '✦' : '◎'}</span><span><b>${escapeHtml(plan.title)}</b><small>${escapeHtml(plan.funder)} · ${escapeHtml(plan.country)}</small></span><strong>${planPercent(plan)}%</strong><i><u style="width:${planPercent(plan)}%"></u></i><small>Due<br>${escapeHtml(plan.due)}</small><em>›</em></button>`).join('');
    box.querySelectorAll('.proposal-summary').forEach(button => button.addEventListener('click', () => { activePlan = Number(button.dataset.plan); renderPlans(); renderDeliveryPlan(); }));
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
    box.innerHTML = `<div class="delivery-head"><div><p class="eyebrow">EDITABLE DELIVERY PLAN</p><h2>${escapeHtml(plan.title)}</h2><p>Turn strategy into action. Track deliverables, owners, evidence and deadlines.</p></div><span>● &nbsp; In progress</span></div><div class="delivery-progress"><div><b>${pc}%</b><span>Overall completion</span></div><i><u style="width:${pc}%"></u></i><small>${done} of ${plan.steps.length} deliverables</small><button id="addPlanStep">＋ Add deliverable</button></div><div class="delivery-columns"><section><header><b>Completed</b><span>${done}</span></header>${plan.steps.map((step, index) => step[2] ? stepMarkup(step, index, true) : '').join('')}</section><section><header><b>Pending</b><span>${plan.steps.length - done}</span></header>${plan.steps.map((step, index) => !step[2] ? stepMarkup(step, index, false) : '').join('')}</section></div><form class="new-step-form deliverable-form" id="newStepForm"><header><div><p class="eyebrow">NEW DELIVERABLE</p><h3>Add work to the delivery plan</h3><p>Define ownership and due date. Evidence can be added now or when the work is completed.</p></div><button type="button" id="closeNewStep" aria-label="Close">×</button></header><div class="deliverable-fields"><label><span>Deliverable name</span><input id="newStepName" placeholder="e.g. Draft technical approach" required></label><label><span>Responsible person(s)</span><input id="newStepOwner" placeholder="Select or enter names" required></label><label><span>Due date</span><input id="newStepDate" type="date" required></label></div><fieldset><legend>Supporting evidence <small>Optional</small></legend><label><span>▤</span><b>Upload file / PDF</b><input id="newStepFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"></label><label><span>↗</span><b>Attach link</b><input id="newStepLink" type="url" placeholder="https://..."></label></fieldset><footer><button type="button" class="secondary" id="cancelNewStep">Cancel</button><button class="primary">Add deliverable →</button></footer></form><section class="project-history"><header><div><p class="eyebrow">PROJECT HISTORY</p><h3>Deliverables and evidence</h3></div><label class="evidence-upload">＋ Attach evidence<input id="projectEvidence" type="file" multiple></label></header><div class="history-list">${plan.history.map(item => `<div><time>${escapeHtml(item[0])}</time><span><b>${escapeHtml(item[1])}</b><small>▤ ${escapeHtml(item[2])}</small></span></div>`).join('')}</div></section>`;
    box.querySelector('#addPlanStep').addEventListener('click', () => box.querySelector('#newStepForm').classList.toggle('show'));
    box.querySelector('#closeNewStep').onclick = box.querySelector('#cancelNewStep').onclick = () => box.querySelector('#newStepForm').classList.remove('show');
    box.querySelectorAll('[data-plan-step]').forEach(input => input.addEventListener('change', () => { const index = Number(input.dataset.planStep); if (input.checked) { input.checked = false; openEvidenceDialog(plan, index); } else { plan.steps[index][2] = false; renderPlans(); renderDeliveryPlan(); } }));
    box.querySelectorAll('[data-remove-step]').forEach(button => button.addEventListener('click', () => { plan.steps.splice(Number(button.dataset.removeStep), 1); renderPlans(); renderDeliveryPlan(); }));
    box.querySelector('#newStepForm').addEventListener('submit', event => {
      event.preventDefault();
      const date = new Date(box.querySelector('#newStepDate').value + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
      const name = box.querySelector('#newStepName').value, file = box.querySelector('#newStepFile').files[0], link = box.querySelector('#newStepLink').value.trim();
      plan.steps.push([name, date, false, box.querySelector('#newStepOwner').value]);
      addHistoryEvidence(plan, `Evidence added · ${name}`, file?.name || link);
      renderPlans(); renderDeliveryPlan();
    });
    box.querySelector('#projectEvidence').addEventListener('change', event => { [...event.target.files].forEach(file => plan.history.unshift(['Today', 'Evidence attached', file.name])); renderDeliveryPlan(); });
  }

  function openPipelineOpportunity(item) {
    const drawerContent = document.querySelector('#drawerContent'); if (!drawerContent) return;
    drawerContent.innerHTML = `<p class="eyebrow">RFP · ${escapeHtml(item.funder)}</p><div class="drawer-title-row"><div><h2>${escapeHtml(item.title)}</h2><p>${escapeHtml(item.country)} · ${escapeHtml(item.focus)}</p></div><div class="fit-box fit-high"><strong>${item.score}%</strong><small>FIT</small></div></div><div class="drawer-recommendation"><b>● &nbsp; Recommended</b><span>AI recommendation · human decision</span></div><h3>Project summary</h3><p class="quick-summary">${escapeHtml(item.summary)}</p><div class="quick-facts drawer-four"><div><small>Value</small><b>${fmtValue(item.value)}</b></div><div><small>Deadline</small><b>${escapeHtml(item.date)}</b></div><div><small>Type</small><b>RFP</b></div><div><small>Pillar</small><b>${escapeHtml(item.focus)}</b></div></div><div class="drawer-actions"><button class="primary" id="pipelineOpenFull">Open full opportunity record →</button></div>`;
    document.querySelector('#drawerScrim')?.classList.add('show'); document.querySelector('#quickDrawer')?.classList.add('show'); document.querySelector('#quickDrawer')?.setAttribute('aria-hidden', 'false');
    document.querySelector('#pipelineOpenFull').addEventListener('click', () => { if (typeof window.openDetail === 'function') window.openDetail({ type: 'RFP', org: item.funder, country: item.country, title: item.title, score: item.score, value: fmtValue(item.value), due: item.date, pillar: item.focus, state: 'In pipeline', source: 'Pipeline example', meta: { objective: item.summary } }); });
  }

  window.renderPipeline = renderStage;

  // The Today screen's stage strip mirrors the pipeline stages and numbers.
  function renderTodayStrip() {
    const strip = document.querySelector('#todayView .stage-strip'); if (!strip) return;
    const cards = [
      ['Qualified', 'Qualified', `${fmtValue(stageData.Qualified.reduce((a, x) => a + x.value, 0))} potential`],
      ['Internal review', 'Internal review', `${stageData['Internal review'].length} need decision`],
      ['Proposal', 'Proposals in progress', `${avg(stageData.Proposal)}% avg. completion`],
      ['Submitted', 'Submitted', `${stageData.Submitted.filter(x => x.next === 'Funder response').length} response due`]
    ];
    strip.innerHTML = cards.map(([stage, label, copy]) => `<button data-stage="${stage}"><span>${stageData[stage].length}</span><div><b>${label}</b><small>${copy}</small></div><em>→</em></button>`).join('');
    strip.querySelectorAll('[data-stage]').forEach(b => b.onclick = () => { window.showView('pipeline'); renderStage(b.dataset.stage); });
  }
  renderTodayStrip();
  document.addEventListener('DOMContentLoaded', () => { renderStage(); renderPlans(); renderDeliveryPlan(); });
})();
