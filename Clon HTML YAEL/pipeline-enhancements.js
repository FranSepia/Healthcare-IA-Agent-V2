(() => {
  const stageData = {
    Qualified: [
      {score:93,title:'Health Financing Reform & Domestic Resource Mobilization',summary:'Eligibility, evidence and team availability',funder:'World Bank',country:'Kenya',focus:'Health systems financing',owner:'Ana Ruiz',initials:'AR',progress:35,next:'Complete human review',date:'16 Sep 2026',fit:'High',source:'DevelopmentAid'},
      {score:88,title:'Primary Healthcare Service Delivery Strengthening',summary:'Build resilient PHC systems',funder:'WHO',country:'Rwanda',focus:'Primary healthcare',owner:'Javier Morales',initials:'JM',progress:20,next:'Review guidelines',date:'12 Sep 2026',fit:'High',source:'Coefficient Giving',rfpStatus:'Informational Announcement',sourceUrl:'https://coefficientgiving.org/research-and-news/'},
      {score:81,title:'UHC Implementation Support',summary:'Technical assistance and capacity building',funder:'Gates Foundation',country:'Nigeria',focus:'Universal health coverage',owner:'Sofía Castro',initials:'SC',progress:10,next:'Assess eligibility',date:'20 Sep 2026',fit:'Medium',source:'Grants.gov',sourceUrl:'https://www.grants.gov/search-grants'}
    ],
    'Internal review': [
      {score:93,title:'Health Financing Reform & Domestic Resource Mobilization',summary:'Awaiting final pursuit decision',funder:'World Bank',country:'Kenya',focus:'Health systems financing',owner:'Ana Ruiz',initials:'AR',progress:72,next:'Confirm delivery team',date:'16 Sep 2026',fit:'High'},
      {score:90,title:'Provider Payment Systems in Sub-Saharan Africa',summary:'Evidence review in progress',funder:'Gates Foundation',country:'Rwanda',focus:'Provider payments',owner:'Javier Morales',initials:'JM',progress:58,next:'Approve to pursue',date:'13 Sep 2026',fit:'High'}
    ],
    Proposal: [
      {score:91,title:'Maternal Health Systems Strengthening',summary:'Proposal production in progress',funder:'UNFPA',country:'Tanzania',focus:'Maternal health',owner:'Ana Ruiz',initials:'AR',progress:75,next:'Technical review',date:'28 Sep 2026',fit:'High'},
      {score:86,title:'Digital Health for UHC',summary:'Drafting technical approach',funder:'European Union',country:'Multiple countries',focus:'Digital health',owner:'Sofía Castro',initials:'SC',progress:40,next:'Complete concept note',date:'15 Oct 2026',fit:'High'},
      {score:84,title:'Health Workforce Capacity Building',summary:'Team and workplan development',funder:'World Bank',country:'Ghana',focus:'Health workforce',owner:'Javier Morales',initials:'JM',progress:25,next:'Assemble core team',date:'3 Nov 2026',fit:'Medium'}
    ],
    Submitted: [
      {score:92,title:'Health Systems Governance Advisory',summary:'Submitted · awaiting response',funder:'World Bank',country:'Kenya',focus:'Governance',owner:'Ana Ruiz',initials:'AR',progress:100,next:'Funder response',date:'18 Sep 2026',fit:'High'},
      {score:87,title:'Regional Health Financing Support',summary:'Submitted · clarification window',funder:'African Development Bank',country:'Rwanda',focus:'Health financing',owner:'Sofía Castro',initials:'SC',progress:100,next:'Monitor response',date:'24 Sep 2026',fit:'High'}
    ]
  };

  const plans = [
    {title:'Maternal Health Systems Strengthening',funder:'UNFPA',country:'Tanzania',due:'28 Sep 2026',steps:[['Initial opportunity assessment','2 Sep',true,'Ana Ruiz'],['Assemble core team','4 Sep',true,'Ana Ruiz · Javier Morales'],['Review funder guidelines','7 Sep',true,'Sofía Castro'],['Develop concept note','16 Sep',false,'Ana Ruiz · Mariana López'],['Internal review and approval','22 Sep',false,'Javier Morales'],['Prepare full proposal','6 Oct',false,'Proposal team']],history:[['7 Sep','Funder guidelines reviewed','UNFPA-guidelines.pdf'],['4 Sep','Core team confirmed','Team-availability.xlsx'],['2 Sep','Opportunity assessment completed','Assessment-v1.docx']]},
    {title:'Digital Health for UHC',funder:'EU',country:'Multiple countries',due:'15 Oct 2026',steps:[['Requirements mapped','5 Sep',true,'Sofía Castro'],['Win themes agreed','8 Sep',true,'Sofía Castro · Ana Ruiz'],['Draft technical approach','24 Sep',false,'Javier Morales'],['Past performance selected','28 Sep',false,'Mariana López'],['Pricing review','8 Oct',false,'Finance · Ana Ruiz']],history:[['8 Sep','Win themes approved','Win-themes-v2.docx'],['5 Sep','Requirements mapped','Compliance-matrix.xlsx']]},
    {title:'Health Workforce Capacity Building',funder:'World Bank',country:'Ghana',due:'3 Nov 2026',steps:[['Kickoff complete','7 Sep',true,'Javier Morales'],['Partner validation','18 Sep',false,'Sofía Castro'],['Draft outline','25 Sep',false,'Javier Morales · Ana Ruiz'],['Team CVs','2 Oct',false,'People operations']],history:[['7 Sep','Proposal kickoff held','Kickoff-notes.pdf']]}
  ];
  let activeStage = 'Qualified';
  let activePlan = 0;

  const stageSummary = [['Qualified',9,'$11.4M potential'],['Internal review',4,'2 need decision'],['Proposal',3,'63% average progress'],['Submitted',2,'1 response due']];

  function stageRow(item) {
    return `<button class="pipeline-data-row" data-title="${item.title}"><span class="pipeline-check"><input type="checkbox" aria-label="Select ${item.title}"></span><span class="pipeline-opportunity"><strong class="stage-score">${item.score}</strong><span><b>${item.title}</b><small>${item.summary}</small><em class="pipeline-source-line">${sourceTag(item)}${rfpStatusTag(item)}</em></span></span><span><b>${item.funder} · ${item.country}</b><small>${item.country}</small></span><span><b>${item.focus}</b></span><span class="pipeline-owner"><i>${item.initials}</i><b>${item.owner}<small>Analyst</small></b></span><span class="pipeline-progress"><b>${item.progress}%</b><i><u style="width:${item.progress}%"></u></i></span><span class="pipeline-next"><b>${item.next}</b><small>${item.date}</small></span><span class="fit-pill ${item.fit.toLowerCase()}">${item.fit}</span><em>›</em></button>`;
  }

  function renderStage() {
    document.querySelector('#pipelineMetrics').innerHTML = stageSummary.map(([name,count,copy]) => `<button data-pstage="${name}" class="${name===activeStage?'active':''}"><span>${name}</span><b>${count}</b><small>${copy}</small></button>`).join('');
    document.querySelectorAll('#pipelineMetrics button').forEach(button => button.addEventListener('click', () => { activeStage=button.dataset.pstage; renderStage(); }));
    document.querySelector('#selectedStageTitle').textContent = activeStage === 'Proposal' ? 'Proposals in production' : `${activeStage} opportunities`;
    document.querySelector('#selectedStageCopy').textContent = activeStage === 'Proposal' ? 'Track owners, deadlines and proposal completion.' : 'Review and take action on opportunities that meet your criteria and are ready for the next decision.';
    document.querySelector('#pipelineTable').innerHTML = `<div class="pipeline-columns"><span></span><span>Opportunity</span><span>Funder · Country</span><span>Focus area</span><span>Owner</span><span>Progress</span><span>Next action</span><span>Fit</span><span></span></div>${stageData[activeStage].map(stageRow).join('')}`;
    document.querySelectorAll('.pipeline-data-row').forEach(row => {
      row.addEventListener('click', event => { if(event.target.matches('input')) return; const item=stageData[activeStage].find(x=>x.title===row.dataset.title); openPipelineOpportunity(item); });
    });
  }

  function planPercent(plan){return Math.round(plan.steps.filter(step=>step[2]).length/plan.steps.length*100)}
  function renderPlans(){
    document.querySelector('#proposalPlans').innerHTML=plans.map((plan,index)=>`<button class="proposal-summary ${index===activePlan?'active':''}" data-plan="${index}"><span class="proposal-brand">${index===0?'⚕':index===1?'✦':'◎'}</span><span><b>${plan.title}</b><small>${plan.funder} · ${plan.country}</small></span><strong>${planPercent(plan)}%</strong><i><u style="width:${planPercent(plan)}%"></u></i><small>Due<br>${plan.due}</small><em>›</em></button>`).join('');
    document.querySelectorAll('.proposal-summary').forEach(button=>button.addEventListener('click',()=>{activePlan=Number(button.dataset.plan);renderPlans();renderDeliveryPlan()}));
  }

  function addHistoryEvidence(plan,label,fileName){
    if(!fileName)return;
    plan.history.unshift(['Today',label,fileName]);
  }

  function openEvidenceDialog(plan,stepIndex){
    let dialog=document.querySelector('#deliverableEvidenceDialog');
    if(!dialog){
      document.body.insertAdjacentHTML('beforeend',`<dialog class="evidence-dialog" id="deliverableEvidenceDialog"><form method="dialog"><header><div><p class="eyebrow">COMPLETE DELIVERABLE</p><h2>Complete deliverable</h2><p>Add a file, link or comment if you need a traceable record. Everything is optional.</p></div><button type="button" class="dialog-x" aria-label="Close">×</button></header><div class="evidence-choice-grid"><label><span>▤</span><b>Upload file or PDF</b><small>PDF, DOCX, XLSX or image</small><input id="completionFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"></label><label><span>↗</span><b>Add a source link</b><small>Drive, SharePoint or reference URL</small><input id="completionLink" type="url" placeholder="https://..."></label></div><label class="evidence-note"><span>Comment <small>Optional</small></span><textarea id="completionNote" placeholder="Add a completion note or approval context..."></textarea></label><footer><button type="button" class="secondary" id="completeWithoutEvidence">✓ Complete only</button><button class="primary" value="save">Save details &amp; complete →</button></footer></form></dialog>`);
      dialog=document.querySelector('#deliverableEvidenceDialog');
      dialog.querySelector('.dialog-x').onclick=()=>dialog.close('cancel');
    }
    const step=plan.steps[stepIndex];
    dialog.querySelector('h2').textContent=step[0];
    dialog.querySelector('#completionFile').value='';
    dialog.querySelector('#completionLink').value='';
    dialog.querySelector('#completionNote').value='';
    dialog.querySelector('#completeWithoutEvidence').onclick=()=>dialog.close('skip');
    dialog.oncancel=event=>{event.preventDefault();dialog.close('cancel')};
    dialog.onclose=()=>{
      if(!['save','skip'].includes(dialog.returnValue))return;
      if(dialog.returnValue==='save'){
        const file=dialog.querySelector('#completionFile').files[0];
        const link=dialog.querySelector('#completionLink').value.trim();
        const note=dialog.querySelector('#completionNote').value.trim();
        addHistoryEvidence(plan,`File attached · ${step[0]}`,file?.name);
        addHistoryEvidence(plan,`Link added · ${step[0]}`,link);
        addHistoryEvidence(plan,`Completion comment · ${step[0]}`,note);
      }
      step[2]=true;
      renderPlans();renderDeliveryPlan();
    };
    dialog.showModal();
  }

  function renderDeliveryPlan(){
    const plan=plans[activePlan],done=plan.steps.filter(step=>step[2]).length,pc=planPercent(plan);
    document.querySelector('#deliveryPlan').innerHTML=`<div class="delivery-head"><div><p class="eyebrow">EDITABLE DELIVERY PLAN</p><h2>${plan.title.replace(' & Domestic Resource Mobilization','')}</h2><p>Turn strategy into action. Track deliverables, owners, evidence and deadlines.</p></div><span>● &nbsp; In progress</span></div><div class="delivery-progress"><div><b>${pc}%</b><span>Overall completion</span></div><i><u style="width:${pc}%"></u></i><small>${done} of ${plan.steps.length} deliverables</small><button id="addPlanStep">＋ Add deliverable</button></div><div class="delivery-columns"><section><header><b>Completed</b><span>${done}</span></header>${plan.steps.map((step,index)=>step[2]?stepMarkup(step,index,true):'').join('')}</section><section><header><b>Pending</b><span>${plan.steps.length-done}</span></header>${plan.steps.map((step,index)=>!step[2]?stepMarkup(step,index,false):'').join('')}</section></div><form class="new-step-form deliverable-form" id="newStepForm"><header><div><p class="eyebrow">NEW DELIVERABLE</p><h3>Add work to the delivery plan</h3><p>Define ownership and due date. Evidence can be added now or when the work is completed.</p></div><button type="button" id="closeNewStep" aria-label="Close">×</button></header><div class="deliverable-fields"><label><span>Deliverable name</span><input id="newStepName" placeholder="e.g. Draft technical approach" required></label><label><span>Responsible person(s)</span><input id="newStepOwner" placeholder="Select or enter names" required></label><label><span>Due date</span><input id="newStepDate" type="date" required></label></div><fieldset><legend>Supporting evidence <small>Optional</small></legend><label><span>▤</span><b>Upload file / PDF</b><input id="newStepFile" type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"></label><label><span>↗</span><b>Attach link</b><input id="newStepLink" type="url" placeholder="https://..."></label></fieldset><section class="notification-builder"><header><label><input id="notifyTeam" type="checkbox"><span><b>Send email notification</b><small>Choose exactly who receives it and when.</small></span></label><em>Optional</em></header><div id="notificationOptions" hidden><div class="recipient-choice"><label><input type="radio" name="recipientMode" value="all"><span><b>All proposal members</b><small>Send to the complete team</small></span></label><label><input type="radio" name="recipientMode" value="selected" checked><span><b>Specific recipients</b><small>One person or as many as needed</small></span></label></div><div class="custom-recipients" id="recipientList"><span class="recipient-label">Email recipients</span><div class="recipient-chips" id="recipientChips"><span data-email="ana.ruiz@acesoglobal.org">ana.ruiz@acesoglobal.org<button type="button" aria-label="Remove ana.ruiz@acesoglobal.org">×</button></span></div><div class="recipient-entry"><input id="recipientEmail" type="email" placeholder="name@acesoglobal.org"><button type="button" id="addRecipient">＋ Add recipient</button></div><small>Add one email at a time. You can remove any recipient before scheduling.</small></div><div class="send-timing"><label><span>Delivery timing</span><select id="notificationTiming"><option value="scheduled">Schedule a specific date and time</option><option value="now">Send when deliverable is added</option></select></label><label id="scheduleField"><span>Send on</span><input id="notificationDate" type="datetime-local" required></label></div></div></section><footer><button type="button" class="secondary" id="cancelNewStep">Cancel</button><button class="primary">Add deliverable →</button></footer></form><section class="project-history"><header><div><p class="eyebrow">PROJECT HISTORY</p><h3>Deliverables and evidence</h3></div><label class="evidence-upload">＋ Attach evidence<input id="projectEvidence" type="file" multiple></label></header><div class="history-list">${plan.history.map(item=>`<div><time>${item[0]}</time><span><b>${item[1]}</b><small>▤ ${item[2]}</small></span></div>`).join('')}</div></section>`;
    document.querySelector('#addPlanStep').addEventListener('click',()=>document.querySelector('#newStepForm').classList.toggle('show'));
    document.querySelector('#closeNewStep').onclick=document.querySelector('#cancelNewStep').onclick=()=>document.querySelector('#newStepForm').classList.remove('show');
    document.querySelector('#notificationDate').required=false;
    document.querySelector('#notifyTeam').onchange=event=>{const enabled=event.target.checked;document.querySelector('#notificationOptions').hidden=!enabled;document.querySelector('#notificationDate').required=enabled&&document.querySelector('#notificationTiming').value==='scheduled'};
    document.querySelectorAll('[name="recipientMode"]').forEach(input=>input.onchange=()=>{document.querySelector('#recipientList').hidden=input.value!=='selected'});
    const addRecipient=()=>{const input=document.querySelector('#recipientEmail'),email=input.value.trim().toLowerCase();if(!input.checkValidity()||!email){input.reportValidity();return}if(document.querySelector(`#recipientChips [data-email="${CSS.escape(email)}"]`)){toast('That email is already included.');return}document.querySelector('#recipientChips').insertAdjacentHTML('beforeend',`<span data-email="${email}">${email}<button type="button" aria-label="Remove ${email}">×</button></span>`);input.value=''};
    document.querySelector('#addRecipient').onclick=addRecipient;
    document.querySelector('#recipientEmail').onkeydown=event=>{if(event.key==='Enter'){event.preventDefault();addRecipient()}};
    document.querySelector('#recipientChips').onclick=event=>event.target.closest('button')?.parentElement.remove();
    document.querySelector('#notificationTiming').onchange=event=>{const scheduled=event.target.value==='scheduled';document.querySelector('#scheduleField').hidden=!scheduled;document.querySelector('#notificationDate').required=scheduled};
    document.querySelectorAll('[data-plan-step]').forEach(input=>input.addEventListener('change',()=>{const index=Number(input.dataset.planStep);if(input.checked){input.checked=false;openEvidenceDialog(plan,index)}else{plan.steps[index][2]=false;renderPlans();renderDeliveryPlan()}}));
    document.querySelectorAll('[data-remove-step]').forEach(button=>button.addEventListener('click',()=>{plan.steps.splice(Number(button.dataset.removeStep),1);renderPlans();renderDeliveryPlan()}));
    document.querySelector('#newStepForm').addEventListener('submit',event=>{event.preventDefault();const date=new Date(document.querySelector('#newStepDate').value+'T12:00:00').toLocaleDateString('en-GB',{day:'numeric',month:'short'}),name=document.querySelector('#newStepName').value,file=document.querySelector('#newStepFile').files[0],link=document.querySelector('#newStepLink').value.trim(),notify=document.querySelector('#notifyTeam').checked,timing=document.querySelector('#notificationTiming').value,individual=notify&&document.querySelector('[name="recipientMode"]:checked').value==='selected',recipients=individual?[...document.querySelectorAll('#recipientChips [data-email]')].map(chip=>chip.dataset.email):['All proposal members'];if(notify&&!recipients.length){toast('Add at least one email recipient.');return}plan.steps.push([name,date,false,document.querySelector('#newStepOwner').value]);addHistoryEvidence(plan,`Evidence added · ${name}`,file?.name||link);if(notify){const scheduled=timing==='scheduled',sendAt=document.querySelector('#notificationDate').value,recipientCopy=individual?`${recipients.length} recipient${recipients.length===1?'':'s'}`:'All proposal members';plan.history.unshift(['Today',scheduled?'Email notification scheduled':'Email notification sent',scheduled?`${recipientCopy} · ${new Date(sendAt).toLocaleString('en-GB')}`:recipientCopy]);toast(scheduled?`Email scheduled for ${recipientCopy.toLowerCase()}.`:`Email sent to ${recipientCopy.toLowerCase()}.`)}renderPlans();renderDeliveryPlan()});
    document.querySelector('#projectEvidence').addEventListener('change',event=>{[...event.target.files].forEach(file=>plan.history.unshift(['Today','Evidence attached',file.name]));renderDeliveryPlan()});
  }
  function stepMarkup(step,index,checked){return `<div class="delivery-step ${checked?'complete':''}"><input data-plan-step="${index}" type="checkbox" aria-label="Mark ${step[0]} as complete" ${checked?'checked':''}><span><b>${step[0]}</b><em>${step[3]||'Unassigned'}</em></span><small class="step-due"><span>${checked?'Completed':'Due'}</span><b>${step[1]}</b></small><button type="button" data-remove-step="${index}" aria-label="Remove ${step[0]}">×</button></div>`}

  function openPipelineOpportunity(item){
    document.querySelector('#drawerContent').innerHTML=`<p class="eyebrow">RFP · ${item.funder}</p><div class="tags" style="margin:2px 0 10px">${sourceTag(item)}${rfpStatusTag(item)}</div><div class="drawer-title-row"><div><h2>${item.title}</h2><p>${item.country} · ${item.focus}</p></div><div class="fit-box fit-high"><strong>${item.score}%</strong><small>FIT</small></div></div><div class="drawer-recommendation"><b>● &nbsp; Recommended</b><span>AI recommendation · human decision</span></div><h3>Project summary</h3><p class="quick-summary">The funder seeks a consulting firm to strengthen health systems through technical analysis, stakeholder consultation and an actionable implementation roadmap. International firms are eligible.</p><div class="quick-facts drawer-four"><div><small>Value</small><b>$2.6M</b></div><div><small>Deadline</small><b>${item.date}</b></div><div><small>Type</small><b>RFP</b></div><div><small>Pillar</small><b>${item.focus}</b></div></div><div class="drawer-insights"><section><h4>Review status</h4><b>✓ &nbsp; Agent screening complete</b><p>Awaiting first human review by an analyst</p></section><section><h4>✦ &nbsp; Why it fits</h4><p>✓ Aligns with our expertise<br>✓ Matches our focus region<br>✓ Open to international firms</p></section></div><section class="criteria-audit"><header><div><small>AGENT DECISION TRACE</small><h3>Criteria used for this recommendation</h3></div><button type="button" id="openCriteriaGuide">View full logic →</button></header><div><span><b>Strategic expertise</b><small>Scope names ${item.focus} and advisory delivery.</small></span><em>30%</em><strong class="audit-pass">✓ Pass</strong></div><div><span><b>Geography &amp; eligibility</b><small>${item.country}; international firms are permitted.</small></span><em>20%</em><strong class="audit-pass">✓ Pass</strong></div><div><span><b>Funder relevance</b><small>${item.funder} matches the priority-funder list.</small></span><em>20%</em><strong class="audit-pass">✓ Pass</strong></div><div><span><b>Delivery feasibility</b><small>Team capacity still requires human confirmation.</small></span><em>15%</em><strong class="audit-review">△ Review</strong></div><footer><span>Source: eligibility section, scope of work and deadline fields</span><b>Weighted fit: ${item.score}%</b></footer></section><h4>Relevant keywords</h4><div class="tags"><span class="tag">Health financing</span><span class="tag">Domestic resources</span><span class="tag">Fiscal space</span><span class="tag">UHC reform</span></div><div class="drawer-actions"><button class="secondary" id="pipelineOpenSource">View original publication ↗</button><button class="primary" id="pipelineOpenFull">Open full opportunity record →</button></div>`;
    const criterionNotes=[`Expertise fit: ${item.focus} matches two comparable Aceso projects.`,`Country fit: ${item.country} is an Aceso priority geography and international firms are eligible.`,`Funder fit: ${item.funder} is a priority institution with relevant past-performance evidence.`,`Delivery fit: the deadline is viable; team availability still needs human confirmation.`];
    document.querySelectorAll('.criteria-audit>div small').forEach((note,index)=>note.textContent=criterionNotes[index]);
    document.querySelector('#drawerScrim').classList.add('show');document.querySelector('#quickDrawer').classList.add('show');document.querySelector('#quickDrawer').setAttribute('aria-hidden','false');
    document.querySelector('#pipelineOpenFull').addEventListener('click',()=>openDetail({type:'RFP',org:item.funder,country:item.country,title:item.title,score:item.score,value:'$2.6M',due:item.date,pillar:item.focus,state:'Awaiting analyst',source:item.source,rfpStatus:item.rfpStatus,sourceUrl:item.sourceUrl}));
    document.querySelector('#pipelineOpenSource').addEventListener('click',()=>{if(item.sourceUrl)window.open(item.sourceUrl,'_blank','noopener');else if(typeof toast==='function')toast('DevelopmentAid listing — membership sign-in required to view the original notice.')});
    document.querySelector('#openCriteriaGuide').addEventListener('click',()=>{document.querySelector('#drawerScrim').classList.remove('show');document.querySelector('#quickDrawer').classList.remove('show');window.showView('criteria')});
  }

  window.renderPipeline=renderStage;
  document.addEventListener('DOMContentLoaded',()=>{renderStage();renderPlans();renderDeliveryPlan()});
})();
