(() => {
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const say=(message)=>typeof toast==='function'?toast(message):null;

  const DEFAULT_CRITERIA_STATE={
    focusAreas:['Health Systems Strengthening','Pandemic Preparedness and Response','Research and Evaluation','Policy and Capacity Building','Hospital Systems Management','Health Financing','Social Health Insurance','Innovative Service Delivery','Private Sector Contracting','Healthcare Information Systems and Technology','Universal Health Coverage','Provider Payment Systems','Quality of Care','Healthcare Efficiency','Public-Private Partnerships','Program Sustainability and Donor Transition','One Health','Nutrition'],
    activities:['Advisory and consulting services','Research','Evaluation','Costing','Training and curriculum development','Capacity building','Strategic planning','Policy development','Program assessments','Service-delivery reform'],
    regions:['Indonesia','Southeast Asia','Latin America and the Caribbean','Priority countries in Africa (e.g. Tanzania)'],
    fundersMDB:['World Bank','IFC','ADB','IDB','IsDB','AfDB','AIIB'],
    fundersPhilanthropic:['Philanthropic foundations (add specific names as confirmed)'],
    fundersGov:['European Commission','GIZ','BMZ','Italian Development Cooperation'],
    fundersUS:['CDC','U.S. Department of State'],
    budget:{min:200000,flagLarge:true},
    languages:{english:true,spanish:true,portuguese:true,frenchReview:true},
    knockouts:['Restricted to individual consultants, not firms','Full-time in-country presence required','Local incorporation required','Eligibility restricted to a country/region that excludes Aceso','Education or experience requirements Aceso’s available senior team cannot satisfy','Requires hiring multiple senior external specialists','Work located in a conflict area','Travel to a U.S. Department of State Level 4 destination','Excessive focus on physical infrastructure','Incompatible language requirements','Clearly insufficient budget','Procurement plan with no applicable opportunity for an international consulting firm','Scope of work too vague to evaluate','Opportunity already closed'].map((label,i)=>({id:'ko'+i,label,enabled:true})),
    reviewFlags:['Tight submission deadline','Missing or incomplete TOR/RFP','Budget not published','Potentially wired opportunity','Unfamiliar or inconsistent funder','Additional consultant required','Unclear eligibility','Travel required','Limited information available','High price weighting in the evaluation','Interesting topic or country despite a low budget'].map((label,i)=>({id:'rf'+i,label,enabled:true})),
    mnch:'human_review'
  };
  const CRITERIA_STATE_KEY='aceso_criteria_state_v2';
  function cloneDefaults(){return JSON.parse(JSON.stringify(DEFAULT_CRITERIA_STATE))}
  function loadCriteriaState(){try{const raw=localStorage.getItem(CRITERIA_STATE_KEY);return raw?Object.assign(cloneDefaults(),JSON.parse(raw)):cloneDefaults()}catch(e){return cloneDefaults()}}
  function saveCriteriaState(){try{localStorage.setItem(CRITERIA_STATE_KEY,JSON.stringify(criteriaState))}catch(e){}}
  let criteriaState=loadCriteriaState();

  const criteria=[
    {key:'Focus Areas',sub:'Thematic fit',type:'chips',stateKey:'focusAreas',settingsLabel:'Current focus areas',title:'Which thematic areas define a strategic fit?',purpose:'The topics Aceso is positioned to deliver against today — used for LLM-based thematic scoring, never a simple keyword match.',agent:[['Read the full scope','Uses objectives, deliverables and eligibility — not the title alone.'],['Match against these areas','Compares the scope with the list on the left, plus Aceso’s prior proposals and delivered work.'],['Score relevance','Separates core fit, adjacent fit and out-of-scope work.']],human:[['Maintain this list','Adds or removes focus areas as Aceso’s strategy shifts.'],['Review edge cases','Decides when an adjacent topic is strategically worth pursuing.']],rule:'A keyword match never overrides the actual deliverables or applicant type — the list on the left is guidance for the LLM, not a rigid filter.',example:'A tender mentions “health systems” but only purchases equipment. The agent classifies the deliverables as procurement, not advisory work, regardless of the keyword match.'},
    {key:'Activities',sub:'Service fit',type:'chips',stateKey:'activities',settingsLabel:'Relevant activities',title:'What kind of work does Aceso actually deliver?',purpose:'The service types Aceso can staff and deliver — used to separate advisory assignments from work outside the service model.',agent:[['Extract activities','Reads the requested deliverables and activities from the scope of work.'],['Match against this list','Confirms the assignment is advisory, research or capacity-building work, not goods or construction.']],human:[['Maintain this list','Adds or removes activity types as Aceso’s service offering evolves.']],rule:'An opportunity whose activities fall entirely outside this list is a strong candidate for exclusion, even with a strong thematic match.',example:'A UHC-themed opportunity turns out to be a hospital-equipment purchase. Strong thematic fit, zero activity fit — the agent flags the mismatch instead of recommending it.'},
    {key:'Regions',sub:'Geographic priority',type:'chips',stateKey:'regions',settingsLabel:'Priority regions',title:'Where is Aceso prioritizing delivery right now?',purpose:'The countries and regions Aceso wants to prioritize this cycle. This list is intentionally short — Aceso has not yet provided a complete country list.',agent:[['Extract geography','Reads the country, region and multi-country scope from the notice.'],['Weigh regional priority','Treats a match against this list as a positive signal, not a hard requirement — opportunities outside it still reach scoring.']],human:[['Complete this list','Add countries and regions as Aceso confirms them — this list is a starting point, not the final scope.']],rule:'Being outside the priority-region list is a scoring signal, never an automatic knock-out — only the eligibility red flags (see Quick Knock-outs) can knock an opportunity out entirely.',example:'A strong-fit opportunity in Kenya is outside today’s priority list. It still reaches scoring, just without the regional-priority bonus that a Tanzania opportunity would get.'},
    {key:'Funders',sub:'Funder fit',type:'chip-groups',groups:[{key:'fundersMDB',label:'Multilateral development banks'},{key:'fundersPhilanthropic',label:'Philanthropic foundations'},{key:'fundersGov',label:'Government aid agencies'},{key:'fundersUS',label:'United States government agencies'}],settingsLabel:'Preferred funders',title:'Which funders does Aceso prioritize?',purpose:'Funder relevance is one of the scoring factors — a notice from a listed funder starts with a positive signal.',agent:[['Extract the funder','Reads the issuing organization from the notice.'],['Match against these groups','A listed funder is a positive signal; an unlisted or inconsistent funder is a review flag, not a knock-out.']],human:[['Maintain these lists','Adds or removes funders in each group as relationships develop.']],rule:'An unfamiliar or inconsistent funder is a review flag (see Review Flags), never an automatic exclusion.',example:'A notice from a funder not on any list still reaches scoring; it is flagged “Unfamiliar or inconsistent funder” so the analyst gives it a second look before deciding.'},
    {key:'Budget',sub:'Value threshold',type:'budget',settingsLabel:'Current threshold',title:'Is the opportunity within Aceso’s budget range?',purpose:'A minimum-value guide, not a hard wall — a human can always approve an exception below it.',agent:[['Capture the value','Extracts budget, currency and whether the amount is undisclosed.'],['Apply the threshold as guidance','Below the minimum is a review flag, not an automatic rejection.'],['Flag very large opportunities too','A multimillion-dollar opportunity may exceed Aceso’s current operational capacity — it gets flagged for review just like an under-threshold one.']],human:[['Set the threshold','Adjusts the preferred minimum as Aceso’s capacity and strategy change.'],['Approve exceptions','Clears a below-threshold or very-large opportunity for pursuit when it’s worth it.']],rule:'The preferred minimum is a review threshold, not an automatic rejection. An undisclosed value means “needs review,” never automatic rejection either.',example:'A $150,000 opportunity falls under the preferred $200,000 minimum. It is flagged “Clearly insufficient budget” for a human to confirm — the agent never discards it outright.'},
    {key:'Languages',sub:'Delivery language',type:'languages',settingsLabel:'Accepted languages',title:'Is the notice in a language Aceso can act on?',purpose:'English, Spanish and Portuguese are accepted outright. French needs a human. Anything else is usually a knock-out.',agent:[['Detect the language','Reads the notice language directly from the source record.'],['Accept English, Spanish, Portuguese','No extra review needed for these three.'],['Route French to a human','French is never auto-approved and never auto-rejected — it always needs a reviewer to confirm delivery capacity.']],human:[['Confirm delivery languages','Approves which languages the team can realistically deliver in this cycle.'],['Decide on French notices','Reviews each French notice individually — there is no automatic outcome for French yet.']],rule:'Any other exclusive-language requirement is normally low fit or disqualifying, at the reviewer’s judgment.',example:'A French-only EOI with a strong thematic fit still goes to human review — never straight to Recommended — because no one has confirmed French-language delivery capacity.'},
    {key:'Quick Knock-outs',sub:'Hard exclusions',type:'checklist',stateKey:'knockouts',settingsLabel:'Active knock-out rules',title:'What gets an opportunity excluded outright?',purpose:'Fast, rule-based checks the agent runs before spending any real evaluation time on a notice.',agent:[['Scan for each active rule','Checks the notice against every enabled knock-out below.'],['Record the exact rule that failed','Every exclusion keeps the specific rule and the source passage, for audit.'],['Skip disabled rules','A rule unchecked here is not applied — it stays visible so a reviewer can re-enable it later.']],human:[['Turn rules on or off','Disables a knock-out that’s currently too aggressive, or adds a new one.'],['Recover exceptions','Returns a questionable exclusion to human review.']],rule:'Ante la duda, incluir: when a rule’s match is ambiguous, the opportunity goes to review, not straight to excluded.',example:'A notice requires “full-time in-country presence.” The agent excludes it under that rule and keeps the exact sentence on file in case a reviewer wants to recover it.'},
    {key:'Review Flags',sub:'Non-disqualifying alerts',type:'checklist',stateKey:'reviewFlags',settingsLabel:'Active review flags',title:'What deserves a second look, without excluding the opportunity?',purpose:'Signals that change how carefully a human should read an opportunity, without ever knocking it out.',agent:[['Scan for each active flag','Checks the notice against every enabled flag below.'],['Attach flags, not exclusions','A flagged opportunity still reaches the pipeline — the flag just travels with it.'],['Allow several at once','An opportunity can carry more than one flag, e.g. both a tight deadline and an unpublished budget.']],human:[['Turn flags on or off','Disables a flag that’s currently too noisy, or adds a new one.'],['Read the flagged reason first','Uses the flag list to triage which opportunities need the closest read.']],rule:'A review flag never excludes an opportunity — it only asks a human to look twice before deciding.',example:'A high-fit opportunity has no published budget. It keeps its Recommended-track fit score and picks up a “Budget not published” flag instead of being penalized for it.'},
    {key:'MNCH',sub:'Open question',type:'mnch',title:'How should maternal, newborn and child health opportunities be treated?',purpose:'MNCH shows up in Aceso’s documentation both as a priority topic and as a possible exclusion keyword — the two haven’t been reconciled yet.',agent:[['Never auto-reject MNCH','Until Aceso clarifies the rule, an MNCH-flagged opportunity is never knocked out automatically.'],['Always route to human review','Every MNCH opportunity is held for a reviewer, regardless of its fit score.']],human:[['Resolve the contradiction','Confirms whether MNCH should count as a Focus Area, an exclusion, or stay case-by-case.'],['Decide case by case, for now','Reviews each MNCH opportunity individually while the rule is unresolved.']],rule:'Human Review Required is the standing rule for MNCH until Aceso documents a final answer.',example:'A Networks of Care & MNCH Integration opportunity scores well on Service Delivery. It still routes to human review rather than Recommended, purely because of the unresolved MNCH question.'},
    {key:'Timing',sub:'Deadline & capacity',title:'Can the team respond and deliver?',purpose:'Surface deadlines early enough for a quality pursuit and avoid commitments the team cannot staff.',settings:['31–90 days','3–6 months','Flag under 14 days','Capacity check'],agent:[['Calculate time','Counts working days and identifies clarification deadlines.'],['Assess complexity','Compares remaining time with required partners and documents.'],['Check capacity','Flags overlap with active proposals and delivery load.']],human:[['Confirm availability','Validates owner, reviewers and technical leads.'],['Make the trade-off','Chooses which pursuit receives capacity when deadlines collide.']],rule:'A short deadline is excluded only when the required preparation cannot reasonably be completed.',example:'Two proposals close in the same week. The agent shows the collision; Business Development assigns priority and ownership.'},
    {key:'Decision',sub:'Human checkpoints',title:'When must a human decide?',purpose:'Keep every recommendation traceable while reserving pursuit, staffing and submission decisions for people.',settings:['Analyst review','BD recommendation','Finance check','Director approval'],agent:[['Prepare evidence','Shows source fields, fit, warnings and reusable experience.'],['Explain uncertainty','Labels missing, conflicting or assumption-based information.'],['Route the case','Assigns the next decision and preserves comments and history.']],human:[['Go / no-go','Approves pursuit or keeps the opportunity excluded.'],['Resolve ambiguity','Validates partners, budget and team.'],['Approve submission','Reviews the generated draft before it is sent.']],rule:'The agent recommends and documents. It never makes the final pursuit or submission decision — Aceso Global always keeps final approval.',example:'The agent prepares a proposal preview, but the analyst must review it and the director must authorize submission.'},
    {key:'Sources',sub:'Intelligence feeds',type:'sources',settings:['Grants.gov — Simpler.Grants.gov REST API','DevelopmentAid — enterprise API / feed / export (pending confirmation)','Coefficient Giving — public RFP monitor','Priority: Global Health & Wellbeing Opportunities'],title:'Where does each opportunity come from, and how is it fetched?',purpose:'Three feeds validate every notice before it reaches the pipeline. The analyst only ever sees the source name — never the connection method or any credential.',agent:[['Grants.gov','Queries the official Simpler.Grants.gov REST API with Aceso’s criteria; the API key lives in a backend environment variable, never in this frontend.'],['DevelopmentAid','Prefers, in order: the enterprise API, an authorized data feed, a CSV/Excel export, automated processing of DevelopmentAid email alerts, or — as a temporary proof of concept only — authorized browser automation. No credential from any of these is ever stored in code, a document or this interface.'],['Coefficient Giving — monitor scope','Watches coefficientgiving.org/research-and-news/ and prioritizes coefficientgiving.org/funds/global-health-wellbeing-opportunities/; blogs, staff publications and general research are discarded — only requests for proposals are kept.'],['Coefficient Giving — field extraction','For every RFP kept, extracts title, objective, funding amount, eligibility, deadline, thematic area and the official link, then classifies it as Open RFP, Closed RFP, Informational Announcement or Potential Future Opportunity.']],human:[['Confirm DevelopmentAid credentials are still valid','And change the password — it was previously stored in plain text.'],['Confirm what the current membership permits','Enterprise API access, data feed, exports or alerts.'],['Confirm monitored Coefficient Giving pages','Approve the exact section(s) the agent should watch.'],['Authorize the pilot','Approve using all three sources together for the three-day validation.']],rule:'Only Open RFPs from Coefficient Giving enter the primary review queue. Potential Future Opportunities go to a separate watchlist, never the active pipeline.',example:'A Global Health & Wellbeing Opportunities post announces a future funding round with no submission process yet. The agent tags it “Potential Future Opportunity” and moves it to the watchlist instead of the review queue.',legend:[['rfp-open','Open RFP','Accepting proposals now — enters the primary review queue.'],['rfp-closed','Closed RFP','Submission window has passed — kept for reference, not pursuit.'],['rfp-info','Informational Announcement','Funder context or guidance — no submission process yet.'],['rfp-potential','Potential Future Opportunity','Signals a likely future round — goes to the watchlist, not the queue.']]}
  ];
  let criterion=0, owner='agent';

  function chipTag(key,i,v){return `<span class="chip"><span>${v}</span><button type="button" data-remove="${i}" data-key="${key}" aria-label="Remove ${v}">×</button></span>`}
  function addForm(key,mode,placeholder){return `<form class="chip-add" data-key="${key}" data-mode="${mode}"><input type="text" placeholder="${placeholder}" required><button type="button">+ Add</button></form>`}

  function settingsHTML(s){
    if(s.type==='chips'){
      const arr=criteriaState[s.stateKey]||[];
      return `<div class="chip-list">${arr.map((v,i)=>chipTag(s.stateKey,i,v)).join('')}</div>${addForm(s.stateKey,'chip','Add another…')}`;
    }
    if(s.type==='chip-groups'){
      return `<div class="chip-groups">${s.groups.map(g=>{const arr=criteriaState[g.key]||[];return `<div class="chip-group"><h4>${g.label}</h4><div class="chip-list">${arr.map((v,i)=>chipTag(g.key,i,v)).join('')}</div>${addForm(g.key,'chip','Add to '+g.label.toLowerCase()+'…')}</div>`}).join('')}</div>`;
    }
    if(s.type==='budget'){
      const b=criteriaState.budget;
      return `<div class="budget-editor"><label class="budget-min"><span>Preferred minimum budget (USD)</span><input type="number" id="budgetMinInput" value="${b.min}" step="10000" min="0"></label><label class="budget-flag"><input type="checkbox" id="budgetFlagLarge" ${b.flagLarge?'checked':''}><span>Also flag very large, multimillion-dollar opportunities for review — they may exceed Aceso’s operational capacity.</span></label></div>`;
    }
    if(s.type==='languages'){
      const l=criteriaState.languages;
      return `<div class="language-editor"><label><input type="checkbox" data-lang="english" ${l.english?'checked':''}><span>English — accepted</span></label><label><input type="checkbox" data-lang="spanish" ${l.spanish?'checked':''}><span>Spanish — accepted</span></label><label><input type="checkbox" data-lang="portuguese" ${l.portuguese?'checked':''}><span>Portuguese — accepted</span></label><label class="lang-french"><input type="checkbox" data-lang="frenchReview" ${l.frenchReview?'checked':''}><span>French — human review required</span></label></div>`;
    }
    if(s.type==='checklist'){
      const arr=criteriaState[s.stateKey]||[];
      return `<div class="checklist-list">${arr.map((item,i)=>`<label class="checklist-item ${item.enabled?'':'off'}"><input type="checkbox" data-toggle="${i}" data-key="${s.stateKey}" ${item.enabled?'checked':''}><span>${item.label}</span><button type="button" data-remove="${i}" data-key="${s.stateKey}" aria-label="Remove">×</button></label>`).join('')}</div>${addForm(s.stateKey,'item','Add another…')}`;
    }
    if(s.type==='mnch'){
      const v=criteriaState.mnch;
      return `<div class="mnch-banner">⚠ &nbsp;Contradictory in Aceso's documentation — treated as Human Review Required until resolved.</div><div class="mnch-options">${[['human_review','Human Review Required (current)'],['include','Always include'],['exclude','Always exclude']].map(([val,label])=>`<label><input type="radio" name="mnchMode" value="${val}" ${v===val?'checked':''}><span>${label}</span></label>`).join('')}</div>`;
    }
    return `<div class="notebook-settings">${(s.settings||[]).map(x=>`<button class="selected"><span>✓</span>${x}</button>`).join('')}</div>`;
  }

  function resetCriterionState(s){
    if(s.type==='chips'||s.type==='checklist'){criteriaState[s.stateKey]=JSON.parse(JSON.stringify(DEFAULT_CRITERIA_STATE[s.stateKey]))}
    else if(s.type==='chip-groups'){s.groups.forEach(g=>{criteriaState[g.key]=JSON.parse(JSON.stringify(DEFAULT_CRITERIA_STATE[g.key]))})}
    else if(s.type==='budget'){criteriaState.budget=JSON.parse(JSON.stringify(DEFAULT_CRITERIA_STATE.budget))}
    else if(s.type==='languages'){criteriaState.languages=JSON.parse(JSON.stringify(DEFAULT_CRITERIA_STATE.languages))}
    else if(s.type==='mnch'){criteriaState.mnch=DEFAULT_CRITERIA_STATE.mnch}
    saveCriteriaState();
  }

  function bindSettings(s){
    qa('[data-remove]').forEach(btn=>btn.onclick=()=>{const key=btn.dataset.key;criteriaState[key].splice(Number(btn.dataset.remove),1);saveCriteriaState();renderNotebook();say('Criteria updated.')});
    qa('[data-toggle]').forEach(input=>input.onchange=()=>{const key=input.dataset.key;criteriaState[key][Number(input.dataset.toggle)].enabled=input.checked;saveCriteriaState();renderNotebook();say('Criteria updated.')});
    qa('.chip-add').forEach(form=>{
      const key=form.dataset.key,mode=form.dataset.mode,input=form.querySelector('input'),addBtn=form.querySelector('button');
      const commit=()=>{const val=input.value.trim();if(!val)return;if(!criteriaState[key])criteriaState[key]=[];if(mode==='chip'){if(criteriaState[key].some(x=>x.toLowerCase()===val.toLowerCase())){say('Already in the list.');return}criteriaState[key].push(val)}else{criteriaState[key].push({id:key+'-'+Date.now(),label:val,enabled:true})}saveCriteriaState();renderNotebook();say('Criteria updated.')};
      addBtn.onclick=commit;form.onsubmit=e=>{e.preventDefault();commit()};
    });
    if(s.type==='budget'){
      q('#budgetMinInput').onchange=e=>{criteriaState.budget.min=Math.max(0,Number(e.target.value)||0);saveCriteriaState();say('Budget threshold updated.')};
      q('#budgetFlagLarge').onchange=e=>{criteriaState.budget.flagLarge=e.target.checked;saveCriteriaState();say('Criteria updated.')};
    }
    if(s.type==='languages'){
      qa('[data-lang]').forEach(input=>input.onchange=()=>{criteriaState.languages[input.dataset.lang]=input.checked;saveCriteriaState();say('Language rules updated.')});
    }
    if(s.type==='mnch'){
      qa('[name="mnchMode"]').forEach(input=>input.onchange=()=>{if(input.checked){criteriaState.mnch=input.value;saveCriteriaState();say('MNCH handling updated.')}});
    }
    if(!s.type||s.type==='sources'){
      qa('.notebook-settings button').forEach(b=>b.onclick=()=>b.classList.toggle('selected'));
    }
  }

  function renderNotebook(){
    const view=q('#criteriaView'),s=criteria[criterion]; if(!view)return;
    const editable=['chips','chip-groups','budget','languages','checklist','mnch'].includes(s.type);
    const total=criteria.length;
    view.innerHTML=`<header class="notebook-head"><div><p class="eyebrow">SEARCH & DECISION CRITERIA</p><h1>How the opportunity agent works</h1><p>A guided notebook for configuring the agent and understanding exactly where human judgment begins.${editable?' Every list on this page is editable — changes are saved for the next search.':''}</p></div><aside><b>LIVE PILOT</b><strong>9</strong><span>ready for review</span><small>37 excluded with traceable reasons</small></aside></header>
      <section class="criteria-notebook"><i class="ring r1"></i><i class="ring r2"></i><i class="ring r3"></i><i class="ring r4"></i>
        <article class="notebook-page settings-page"><p class="page-count">CRITERION ${String(criterion+1).padStart(2,'0')} <span>/ ${String(total).padStart(2,'0')}</span></p><h2>${s.title}</h2><p>${s.purpose}</p><div class="settings-heading"><h3>${s.settingsLabel||'Current pilot settings'}</h3>${editable?'<button type="button" id="resetCriterion" class="reset-link">↺ Reset to Aceso defaults</button>':''}</div><div class="notebook-settings-editable">${settingsHTML(s)}</div><div class="rule-note"><small>DECISION RULE</small><b>${s.rule}</b></div>${s.legend?`<div class="rfp-legend"><small>RFP CLASSIFICATION</small>${s.legend.map(x=>`<div><span class="tag rfp-status ${x[0]}">${x[1]}</span><p>${x[2]}</p></div>`).join('')}</div>`:''}</article>
        <article class="notebook-page playbook-page"><div class="owner-tabs"><button data-owner="agent" class="${owner==='agent'?'active':''}">Agent</button><button data-owner="human" class="${owner==='human'?'active':''}">Human</button></div><p class="eyebrow">${owner==='agent'?'WHAT THE AGENT DOES':'WHAT THE REVIEWER DECIDES'}</p><h2>${owner==='agent'?'Automated screening playbook':'Required human checkpoints'}</h2><div class="notebook-actions">${s[owner].map((x,i)=>`<div><i>${i+1}</i><span><b>${x[0]}</b><p>${x[1]}</p></span></div>`).join('')}</div><aside class="worked-example"><small>WORKED EXAMPLE</small><p>${s.example}</p><b>${owner==='agent'?'Agent output: documented recommendation':'Human output: recorded decision'}</b></aside></article>
      </section><footer class="notebook-footer"><button id="criterionPrev" ${criterion===0?'disabled':''}>← Previous</button><nav>${criteria.map((x,i)=>`<button data-criterion="${i}" class="${i===criterion?'active':i<criterion?'done':''}"><i>${i<criterion?'✓':i+1}</i><span>${x.key}</span></button>`).join('')}</nav><button id="criterionNext">${criterion===total-1?'Save criteria':'Next criterion →'}</button></footer>`;
    qa('[data-owner]').forEach(b=>b.onclick=()=>{owner=b.dataset.owner;renderNotebook()});
    qa('[data-criterion]').forEach(b=>b.onclick=()=>{criterion=Number(b.dataset.criterion);owner='agent';renderNotebook()});
    q('#criterionPrev').onclick=()=>{if(criterion){criterion--;owner='agent';renderNotebook()}};
    q('#criterionNext').onclick=()=>{if(criterion<total-1){criterion++;owner='agent';renderNotebook()}else say('Criteria saved and applied to the next agent search.')};
    bindSettings(s);
    if(q('#resetCriterion'))q('#resetCriterion').onclick=()=>{resetCriterionState(s);renderNotebook();say('Reset to Aceso defaults.')};
  }

  function tuneToday(){
    const headline=q('#todayView .hero-copy h1');
    if(headline) headline.innerHTML='<strong class="today-nine">9</strong> opportunities ready<br>for review today';
    const tools=q('#todayView .section-title.compact .table-tools');
    if(tools&&!q('.search-wrap',tools)){
      const input=q('input',tools),wrap=document.createElement('label');wrap.className='search-wrap';input.parentNode.insertBefore(wrap,input);wrap.append(input);
      const closing=document.createElement('button');closing.className='closing-filter';closing.innerHTML='◷ &nbsp; Closing soon';tools.insertBefore(closing,tools.children[1]);
      closing.onclick=()=>{closing.classList.toggle('active');qa('#todayList .opp-row').forEach((row,i)=>row.hidden=closing.classList.contains('active')&&i>2)};
    }
    const update=()=>{const checked=qa('#todayList input[type="checkbox"]:checked'),bar=q('#selectionBar'),button=q('#sendReview');bar?.classList.toggle('show',checked.length>0);if(q('#selectedCount'))q('#selectedCount').textContent=`${checked.length} selected`;if(button)button.disabled=!checked.length};
    q('#todayList')?.addEventListener('change',update);
    const old=q('#sendReview');if(old&&!old.dataset.fixed){const fresh=old.cloneNode(true);fresh.dataset.fixed='1';old.replaceWith(fresh);fresh.onclick=()=>{const count=qa('#todayList input[type="checkbox"]:checked').length;if(!count)return;say(`${count} opportunities sent to human review.`);qa('#todayList input[type="checkbox"]:checked').forEach(x=>x.checked=false);update()}}
  }

  function tuneDashboard(){
    const funnel=q('.master-funnel');if(funnel)funnel.innerHTML=[['Identified','214','100%',100],['Relevant','68','31.8%',72],['Pursued','31','14.5%',52],['Submitted','25','11.7%',43],['Awarded','7','3.3%',25]].map(x=>`<div style="--w:${x[3]}%"><span>${x[0]}</span><i><u></u></i><b>${x[1]}</b><em>${x[2]}</em></div>`).join('');
    const card=q('.deadline-card');if(card)card.innerHTML=`<header><div><b>SUBMISSION DEADLINES</b><small>Upcoming proposals by month</small></div><small>Sep 2025 – Feb 2026</small></header><div class="deadline-bars">${[['Sep',4],['Oct',7],['Nov',11],['Dec',6],['Jan',8],['Feb',5]].map(([m,n])=>`<div><b>${n}</b><i style="--h:${n/11*100}%"></i><span>${m}</span></div>`).join('')}</div><p class="deadline-insight"><b>November is the peak month.</b> Plan reviewer capacity before the October pipeline closes.</p>`;
  }

  function pipelineMode(){const active=q('#pipelineMetrics button.active'),view=q('#pipelineView');view?.classList.toggle('proposal-mode',active?.dataset.pstage==='Proposal')}

  const priorDetail=window.openDetail;
  window.openDetail=function(opportunity){
    priorDetail(opportunity);
    const origin=q('.record-origin');
    if(origin) origin.dataset.country=opportunity.country||'';
  };

  const priorShow=window.showView;
  window.showView=function(name){priorShow(name);if(name==='criteria')renderNotebook();if(name==='dashboard')tuneDashboard();if(name==='pipeline')setTimeout(pipelineMode)};
  qa('.navlinks button').forEach(b=>b.onclick=()=>window.showView(b.dataset.view));
  q('#pipelineMetrics')?.addEventListener('click',()=>setTimeout(pipelineMode));
  tuneToday();tuneDashboard();pipelineMode();renderNotebook();
})();
