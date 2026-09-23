(() => {
  // Illustrative example pipeline for demos — there is no backend yet that
  // tracks which real search results have been approved to pursue, so this
  // is a fixed, deliberately-crafted example dataset (generic project
  // shapes against real funder types), not live data. window.pipelineStats()
  // exposes the same numbers the Dashboard's pipeline funnel reads, so the
  // two views can never disagree.
  const stageData = {
    Qualified: [
      { score: 88, title: 'Health Financing Systems Assessment', summary: 'Public-expenditure review and fiscal-space analysis', funder: 'World Bank', country: 'Kenya', focus: 'Health financing', owner: 'Sofia Reyes', initials: 'SR', progress: 25, next: 'Complete evidence review', date: '2 Oct 2026', fit: 'High', value: 1400000 },
      { score: 82, title: 'Digital Health Interoperability Roadmap', summary: 'National EHR standards and data-exchange strategy', funder: 'Gates Foundation', country: 'Rwanda', focus: 'Digital health', owner: 'Marcus Chen', initials: 'MC', progress: 15, next: 'Confirm team availability', date: '9 Oct 2026', fit: 'High', value: 620000 },
      { score: 79, title: 'Universal Health Coverage Policy Advisory', summary: 'UHC transition strategy and stakeholder alignment', funder: 'WHO', country: 'Ghana', focus: 'UHC transition', owner: 'Amara Okafor', initials: 'AO', progress: 10, next: 'Validate eligibility', date: '14 Oct 2026', fit: 'Medium', value: 480000 }
    ],
    Proposal: [
      { score: 91, title: 'Provider Payment Reform Technical Assistance', summary: 'Proposal in production — technical approach in draft', funder: 'Global Fund', country: 'Tanzania', focus: 'Provider payments', owner: 'Sofia Reyes', initials: 'SR', progress: 60, next: 'Finalize technical approach', date: '28 Sep 2026', fit: 'High', value: 1100000 },
      { score: 85, title: 'Community Health Worker Program Design', summary: 'Drafting workplan and budget narrative', funder: 'UNICEF', country: 'Uganda', focus: 'Service delivery', owner: 'Marcus Chen', initials: 'MC', progress: 45, next: 'Budget narrative', date: '6 Oct 2026', fit: 'High', value: 750000 },
      { score: 77, title: 'Maternal Health Systems Strengthening', summary: 'Compliance matrix and team CVs in progress', funder: 'USAID', country: 'Nigeria', focus: 'Maternal health', owner: 'Amara Okafor', initials: 'AO', progress: 30, next: 'Compliance matrix', date: '11 Oct 2026', fit: 'Medium', value: 890000 }
    ],
    Submitted: [
      { score: 92, title: 'Health Information Systems Modernization', summary: 'Submitted · awaiting funder response', funder: 'World Bank', country: 'Zambia', focus: 'Health information systems', owner: 'Sofia Reyes', initials: 'SR', progress: 100, next: 'Funder response', date: '20 Sep 2026', fit: 'High', value: 1650000 },
      { score: 84, title: 'Regional Health Financing Support', summary: 'Submitted · clarification window open', funder: 'African Development Bank', country: 'Rwanda', focus: 'Health financing', owner: 'Marcus Chen', initials: 'MC', progress: 100, next: 'Monitor response', date: '25 Sep 2026', fit: 'High', value: 940000 }
    ],
    Awarded: [
      { score: 93, title: 'Primary Care Delivery Accelerator', summary: 'Awarded this month', funder: 'Global Fund', country: 'Kenya', focus: 'Primary healthcare', owner: 'Amara Okafor', initials: 'AO', progress: 100, next: 'Kickoff scheduled', date: '15 Sep 2026', fit: 'High', value: 510000 }
    ]
  };

  const plans = [
    { title: 'Provider Payment Reform Technical Assistance', funder: 'Global Fund', country: 'Tanzania', due: '28 Sep 2026',
      steps: [['Initial opportunity assessment', '10 Sep', true, 'Sofia Reyes'], ['Assemble core team', '13 Sep', true, 'Sofia Reyes · Marcus Chen'], ['Review funder guidelines', '17 Sep', true, 'Amara Okafor'], ['Develop technical approach', '24 Sep', false, 'Sofia Reyes'], ['Internal review and approval', '26 Sep', false, 'Marcus Chen'], ['Submit full proposal', '28 Sep', false, 'Proposal team']],
      history: [['17 Sep', 'Funder guidelines reviewed', 'Global-Fund-guidelines.pdf'], ['13 Sep', 'Core team confirmed', 'Team-availability.xlsx'], ['10 Sep', 'Opportunity assessment completed', 'Assessment-v1.docx']] },
    { title: 'Community Health Worker Program Design', funder: 'UNICEF', country: 'Uganda', due: '6 Oct 2026',
      steps: [['Requirements mapped', '12 Sep', true, 'Marcus Chen'], ['Win themes agreed', '16 Sep', true, 'Marcus Chen · Sofia Reyes'], ['Draft workplan', '28 Sep', false, 'Amara Okafor'], ['Budget narrative', '2 Oct', false, 'Marcus Chen'], ['Pricing review', '5 Oct', false, 'Finance']],
      history: [['16 Sep', 'Win themes approved', 'Win-themes-v2.docx'], ['12 Sep', 'Requirements mapped', 'Compliance-matrix.xlsx']] },
    { title: 'Maternal Health Systems Strengthening', funder: 'USAID', country: 'Nigeria', due: '11 Oct 2026',
      steps: [['Kickoff complete', '14 Sep', true, 'Amara Okafor'], ['Partner validation', '25 Sep', false, 'Sofia Reyes'], ['Draft outline', '3 Oct', false, 'Amara Okafor · Marcus Chen'], ['Team CVs', '9 Oct', false, 'People operations']],
      history: [['14 Sep', 'Proposal kickoff held', 'Kickoff-notes.pdf']] }
  ];
  let activeStage = 'Qualified';
  let activePlan = 0;

  function fmtValue(n) { return n >= 1e6 ? `$${(n / 1e6).toFixed(1)}M` : `$${Math.round(n / 1e3)}K`; }

  // Read by the Dashboard's pipeline funnel so the two views can never
  // show different numbers for the same example data.
  function pipelineStats() {
    const stages = ['Qualified', 'Proposal', 'Submitted', 'Awarded'];
    const counts = stages.map(s => stageData[s].length);
    const totalValue = stages.reduce((sum, s) => sum + stageData[s].reduce((a, x) => a + x.value, 0), 0);
    const awardedValue = stageData.Awarded.reduce((a, x) => a + x.value, 0);
    const items = stages.flatMap(s => stageData[s].map(x => ({ stage: s, title: x.title, funder: x.funder, country: x.country, owner: x.owner, progressPct: x.progress, nextAction: x.next, date: x.date, fit: x.fit, value: fmtValue(x.value) })));
    return { stages, counts, totalValue, awardedValue, fmtValue, items };
  }
  window.pipelineStats = pipelineStats;

  function stageRow(item) {
    return `<button class="pipeline-data-row" data-title="${escapeHtml(item.title)}"><span class="pipeline-check"><input type="checkbox" aria-label="Select ${escapeHtml(item.title)}"></span><span class="pipeline-opportunity"><strong class="stage-score">${item.score}</strong><span><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.summary)}</small></span></span><span><b>${escapeHtml(item.funder)} · ${escapeHtml(item.country)}</b><small>${escapeHtml(item.country)}</small></span><span><b>${escapeHtml(item.focus)}</b></span><span class="pipeline-owner"><i>${escapeHtml(item.initials)}</i><b>${escapeHtml(item.owner)}<small>Analyst</small></b></span><span class="pipeline-progress"><b>${item.progress}%</b><i><u style="width:${item.progress}%"></u></i></span><span class="pipeline-next"><b>${escapeHtml(item.next)}</b><small>${escapeHtml(item.date)}</small></span><span class="fit-pill ${item.fit.toLowerCase()}">${escapeHtml(item.fit)}</span><em>›</em></button>`;
  }

  function renderStage() {
    const stageSummary = [
      ['Qualified', stageData.Qualified.length, `${fmtValue(stageData.Qualified.reduce((a, x) => a + x.value, 0))} potential`],
      ['Proposal', stageData.Proposal.length, `${Math.round(stageData.Proposal.reduce((a, x) => a + x.progress, 0) / stageData.Proposal.length)}% average progress`],
      ['Submitted', stageData.Submitted.length, `${stageData.Submitted.length} awaiting response`],
      ['Awarded', stageData.Awarded.length, 'Added this month']
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
  document.addEventListener('DOMContentLoaded', () => { renderStage(); renderPlans(); renderDeliveryPlan(); });
})();
