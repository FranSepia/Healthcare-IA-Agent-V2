(() => {
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const say=(message)=>typeof toast==='function'?toast(message):null;

  // Mirrors lib/criteria.js — the backend applies exactly these lists, so
  // switching a rule off here really stops it on the next search.
  const DEFAULT_CRITERIA_STATE={
    focusAreas:['Health Systems Strengthening','Pandemic Preparedness and Response','Research and Evaluation','Policy and Capacity Building','Hospital Systems Management','Health Financing','Social Health Insurance','Innovative Service Delivery','Private Sector Contracting','Healthcare Information Systems and Technology','Universal Health Coverage','Provider Payment Systems','Quality of Care','Healthcare Efficiency','Public-Private Partnerships','Program Sustainability and Donor Transition','One Health','Nutrition'],
    activities:['Advisory and consulting services','Research','Evaluation','Costing','Training and curriculum development','Capacity building','Strategic planning','Policy development','Program assessments','Service-delivery reform'],
    regions:['Indonesia','Southeast Asia','Latin America and the Caribbean','Priority countries in Africa (e.g. Tanzania)'],
    fundersMDB:['World Bank','IFC','ADB','IDB','IsDB','AfDB','AIIB'],
    fundersPhilanthropic:[],
    fundersGov:['European Commission','GIZ','BMZ','Italian Development Cooperation'],
    fundersUS:['CDC','U.S. Department of State'],
    budget:{min:200000,flagLarge:true},
    languages:{english:true,spanish:true,portuguese:true,frenchReview:true},
    extraLanguages:[],
    keywords:['Health financing','Provider payment','Universal health coverage','Primary health care','Health system strengthening'],
    deadlineDays:14,
    sources:{grantsGov:true,worldBank:true,coefficientGiving:true,unitaid:true,undp:true,ungm:true},
    knockouts:['Restricted to individual consultants, not firms','Full-time in-country presence required','Local incorporation required','Eligibility restricted to a country/region that excludes Aceso','Education or experience requirements Aceso’s available senior team cannot satisfy','Requires hiring multiple senior external specialists','Work located in a conflict area','Travel to a U.S. Department of State Level 4 destination','Excessive focus on physical infrastructure','Incompatible language requirements','Procurement plan with no applicable opportunity for an international consulting firm','Scope of work too vague to evaluate'].map((label,i)=>({id:'ko'+i,label,enabled:true})),
    reviewFlags:['Tight submission deadline','Missing or incomplete TOR/RFP','Budget not published','Potentially wired opportunity','Unfamiliar or inconsistent funder','Additional consultant required','Unclear eligibility','Travel required','Limited information available','High price weighting in the evaluation','Interesting topic or country despite a low budget'].map((label,i)=>({id:'rf'+i,label,enabled:true}))
  };
  const CRITERIA_STATE_KEY='aceso_criteria_state_v2';
  const LEGACY_LABELS=['Opportunity already closed','Clearly insufficient budget'];
  function cloneDefaults(){return JSON.parse(JSON.stringify(DEFAULT_CRITERIA_STATE))}
  function loadCriteriaState(){
    let state;
    try{const raw=localStorage.getItem(CRITERIA_STATE_KEY);state=raw?Object.assign(cloneDefaults(),JSON.parse(raw)):cloneDefaults()}catch(e){state=cloneDefaults()}
    // Older saved states listed rules that are now enforced in code (closed
    // deadlines, the budget minimum) or held a placeholder funder name.
    ['knockouts','reviewFlags'].forEach(k=>{if(Array.isArray(state[k]))state[k]=state[k].filter(x=>!LEGACY_LABELS.includes(x&&x.label))});
    state.fundersPhilanthropic=(state.fundersPhilanthropic||[]).filter(x=>!/add specific names/i.test(x));
    delete state.mnch;
    // Unchecked Focus areas / Activities: kept for the UI, never sent to the agent.
    state.inactive=state.inactive&&typeof state.inactive==='object'?state.inactive:{};
    return state;
  }
  function saveCriteriaState(){try{localStorage.setItem(CRITERIA_STATE_KEY,JSON.stringify(criteriaState))}catch(e){}}
  let criteriaState=loadCriteriaState();
  saveCriteriaState();

  // Exclusion reasons come from both code rules and the AI's own wording, so
  // map each one back to the rule it corresponds to before counting.
  function reasonLabel(raw){
    const t=raw.toLowerCase();
    const rule=(criteriaState.knockouts||[]).map(k=>k.label).find(l=>t.includes(l.toLowerCase()));
    if(rule)return rule;
    if(/goods|equipment|civil works|construction|infrastructure/.test(t))return 'Excessive focus on physical infrastructure';
    if(/individual consultant/.test(t))return 'Restricted to individual consultants, not firms';
    if(/conflict/.test(t))return 'Work located in a conflict area';
    if(/vague/.test(t))return 'Scope of work too vague to evaluate';
    if(/language/.test(t))return 'Incompatible language requirements';
    if(/incorporat/.test(t))return 'Local incorporation required';
    if(/eligib|restricted to/.test(t))return 'Eligibility restricted to a country/region that excludes Aceso';
    return raw?raw.charAt(0).toUpperCase()+raw.slice(1):'Other rule';
  }

  function liveNumbers(){
    const act=typeof opportunities!=='undefined'?opportunities:[], out=typeof discarded!=='undefined'?discarded:[];
    const tier=s=>act.filter(o=>o.status===s).length;
    const reasons={};out.forEach(d=>{const r=reasonLabel((d&&d[3])||'');reasons[r]=(reasons[r]||0)+1});
    return {found:act.length+out.length,excluded:out.length,scored:act.length,recommended:tier('Recommended'),decision:tier('Decision needed'),low:tier('Low fit'),
      flagged:act.filter(o=>o.meta&&(o.meta.reviewFlags||[]).length).length,
      reasons:Object.entries(reasons).sort((a,b)=>b[1]-a[1]).slice(0,4)};
  }

  // Rules the backend checks in code on every search (lib/scoring.js
  // runKnockouts / reconcileBudgetFlags). Every other rule is applied by the
  // AI reading the notice, so it only runs while Gemini scoring is on.
  const CODE_KNOCKOUTS=['Restricted to individual consultants, not firms','Excessive focus on physical infrastructure','Work located in a conflict area'];
  const CODE_FLAGS=['Budget not published'];
  let aiScoring=null;
  fetch('/api/health').then(r=>r.json()).then(d=>{aiScoring=Boolean(d.geminiConfigured);if(q('#criteriaView')?.classList.contains('active'))renderNotebook(false)}).catch(()=>{});

  const SOURCES=[
    ['grantsGov','Grants.gov','U.S. federal grants','Official API','grantsgov.png'],
    ['worldBank','World Bank','Projects & procurement','Official API','worldbank.png'],
    ['coefficientGiving','Coefficient Giving','Philanthropic funding','AI separates RFPs from news','coefficient.png'],
    ['unitaid','Unitaid','Global health procurement','Public notices page','unitaid.png'],
    ['undp','UNDP','Development procurement','Public notices page','undp.svg'],
    ['ungm','UNGM','UN Global Marketplace','Read with a headless browser','ungm.png']
  ];
  // Layout and copy follow Yael's "Criteria Final" design; every control
  // here writes to criteriaState, which live-search.js sends to /api/search.
  const FUNDER_GROUPS=[['fundersMDB','Development bank'],['fundersPhilanthropic','Foundation'],['fundersGov','Government aid'],['fundersUS','U.S. government']];
  const PREVIEW=8;
  let criterion=0, owner='agent', lastSearch=null;
  const expanded={}, adding={};
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v);
  const fmtUSD=n=>n>=1e6?`$${(n/1e6).toFixed(n%1e6?1:0)}M`:`$${Math.round(n/1e3)}K`;
  const offList=k=>(criteriaState.inactive&&criteriaState.inactive[k])||[];
  const aiNote=()=>aiScoring===false?`<p class="crit-warn">AI scoring is off on this server, so only rules marked <b>code</b> apply right now.</p>`:'';
  const codeMark=on=>on?'<em class="crit-code" title="Checked in code on every search, even without AI">code</em>':'';

  // Inline "Add" row, opened from a group's ⊕ Add button.
  function addRow(key,placeholder,extra=''){
    return adding[key]?`<form class="criteria-add-row chip-add" data-key="${key}" data-mode="${key==='funders'?'funder':['knockouts','reviewFlags'].includes(key)?'item':'chip'}">${extra}<input type="text" placeholder="${esc(placeholder)}" required><button type="submit">Add</button><button type="button" data-add-close="${key}" aria-label="Cancel">×</button></form>`:'';
  }
  const addBtn=(key,label='Add')=>`<button type="button" data-add-open="${key}">⊕ &nbsp;${label}</button>`;
  const moreBtn=(key,total)=>total>PREVIEW?`<button type="button" class="criteria-more" data-expand="${key}">${expanded[key]?'Show fewer':`Show all ${total}`}</button>`:'';

  // Plain string lists with a checkbox (focus areas, activities, keywords).
  // Unchecking moves an item to criteriaState.inactive[key]: kept, never sent.
  function checkRows(key,mode){
    const all=[...(criteriaState[key]||[]).map(v=>[v,true]),...offList(key).map(v=>[v,false])];
    const shown=expanded[key]?all:all.slice(0,PREVIEW);
    return shown.map(([v,on])=>{
      const toggle=mode==='keyword'?`<button type="button" class="keyword-toggle ${on?'active':''}" data-active="${esc(v)}" data-key="${key}" aria-pressed="${on}" aria-label="Toggle ${esc(v)}"><i></i></button>`:`<button type="button" class="criteria-check ${on?'active':''}" data-active="${esc(v)}" data-key="${key}" aria-pressed="${on}" aria-label="Toggle ${esc(v)}">✓</button>`;
      const field=mode==='keyword'?`<input value="${esc(v)}" data-rename-str="${key}" data-old="${esc(v)}" aria-label="Edit ${esc(v)}">`:`<textarea rows="1" data-rename-str="${key}" data-old="${esc(v)}" aria-label="Edit ${esc(v)}">${esc(v)}</textarea>`;
      return `<article class="criteria-compact-row ${mode==='keyword'?'criteria-keyword-row':'criteria-phrase-row'} ${on?'':'is-off'}">${toggle}${field}<button type="button" class="setting-remove" data-drop="${esc(v)}" data-key="${key}" aria-label="Remove ${esc(v)}">×</button></article>`;
    }).join('')+moreBtn(key,all.length);
  }
  function group(key,label,mode,addLabel){
    return `<section class="criteria-setting-group"><header><div><h3>${label}</h3></div>${addBtn(key)}</header><div>${checkRows(key,mode)}${addRow(key,addLabel)}</div></section>`;
  }

  function leftFocus(){
    return `<div class="focus-groups">${group('focusAreas','Focus areas','phrase','Add focus area')}${group('keywords','Priority keywords','keyword','Add keyword')}</div>`;
  }
  function leftActivities(){
    return `<div class="activity-editor">${group('activities','Activities Aceso delivers','phrase','Add activity')}</div>`;
  }

  const prefRow=(icon,value,key,i,title)=>`<article><i>⋮</i><span>${icon}</span><input value="${esc(value)}" data-rename-idx="${key}:${i}" aria-label="Edit ${esc(value)}"${title?` title="${esc(title)}"`:''}><button type="button" data-remove="${i}" data-key="${key}" aria-label="Remove ${esc(value)}">×</button></article>`;
  const langRow=(label,attr,on,removable)=>`<article class="criteria-compact-row ${on?'':'is-off'}"><button type="button" class="criteria-check ${on?'active':''}" ${attr} aria-pressed="${on}" aria-label="Toggle ${label}">✓</button><input value="${esc(label)}" readonly tabindex="-1">${removable?`<button type="button" class="setting-remove" ${removable} aria-label="Remove ${label}">×</button>`:'<span></span>'}</article>`;
  function leftGeo(){
    const regions=criteriaState.regions||[], l=criteriaState.languages, extra=criteriaState.extraLanguages||[];
    return `<div class="geography-language-editor"><div class="preference-lists">
      <section class="preference-list"><header><div><h3>Priority geographies</h3><small>Prioritise opportunities in these regions.</small></div>${addBtn('regions','Add region')}</header>${regions.map((r,i)=>prefRow('⌖',r,'regions',i)).join('')}${addRow('regions','Add region')}</section></div>
      <section class="language-rules"><header><div><h3>Languages Aceso delivers in</h3><small>Active languages are accepted; French notices go to human review.</small></div>${addBtn('extraLanguages','Add language')}</header><div>
        ${langRow('English','data-lang="english"',l.english)}${langRow('Spanish','data-lang="spanish"',l.spanish)}${langRow('Portuguese','data-lang="portuguese"',l.portuguese)}${langRow('French','data-lang="frenchReview"',l.frenchReview)}
        ${extra.map((x,i)=>langRow(x,`data-extra-lang="${i}"`,true,`data-remove="${i}" data-key="extraLanguages"`)).join('')}${addRow('extraLanguages','Add language')}
      </div></section></div>`;
  }
  function leftFunders(){
    const funders=FUNDER_GROUPS.flatMap(([k,type])=>(criteriaState[k]||[]).map((name,i)=>({k,type,name,i})));
    const typeSelect=`<select name="group" aria-label="Funder type">${FUNDER_GROUPS.map(([k,t])=>`<option value="${k}">${t}</option>`).join('')}</select>`;
    return `<div class="preference-lists funder-editor"><section class="preference-list"><header><div><h3>Preferred funders</h3><small>Give higher consideration to these institutions.</small></div>${addBtn('funders','Add funder')}</header>${funders.map(f=>prefRow('▥',f.name,f.k,f.i,f.type)).join('')}${addRow('funders','Add funder',typeSelect)}</section></div>`;
  }

  function leftOut(){
    const arr=criteriaState.knockouts||[], shown=expanded.knockouts?arr:arr.slice(0,PREVIEW);
    return `${aiNote()}<div class="exclusion-groups"><section class="criteria-setting-group"><header><div><h3>Exclusion rules</h3></div>${addBtn('knockouts')}</header><div>${shown.map(item=>{const i=arr.indexOf(item);return `<article class="criteria-compact-row ${item.enabled?'':'is-off'}"><button type="button" class="criteria-check ${item.enabled?'active':''}" data-toggle="${i}" data-key="knockouts" aria-pressed="${item.enabled}" aria-label="Toggle ${esc(item.label)}">✓</button><textarea rows="1" class="crit-field" data-rename-idx="knockouts:${i}" aria-label="Edit rule">${esc(item.label)}</textarea>${codeMark(CODE_KNOCKOUTS.includes(item.label))}<button type="button" class="setting-remove" data-remove="${i}" data-key="knockouts" aria-label="Remove ${esc(item.label)}">×</button></article>`}).join('')}${moreBtn('knockouts',arr.length)}${addRow('knockouts','Add rule')}</div></section></div>`;
  }

  function leftFlag(){
    const b=criteriaState.budget, arr=criteriaState.reviewFlags||[], shown=expanded.reviewFlags?arr:arr.slice(0,6);
    const sw=(attrs,on,label)=>`<button type="button" class="criteria-switch ${on?'active':''}" ${attrs} aria-pressed="${on}" aria-label="Toggle ${esc(label)}"><i></i></button>`;
    return `${aiNote()}<div class="flag-editor"><div class="flag-thresholds"><label><b>Flag budgets below (USD)</b><input type="number" min="0" step="10000" value="${b.min}" id="budgetMinInput"></label><label><b>Flag opportunities due within</b><span><input type="number" min="1" max="120" value="${Number(criteriaState.deadlineDays)||14}" id="deadlineDaysInput"><em>days</em></span></label></div>
      <section class="criteria-setting-group"><header><div><h3>Additional review flags</h3></div>${addBtn('reviewFlags')}</header><div class="flag-list">
        <article class="criteria-compact-row ${b.flagLarge?'':'is-off'}">${sw('data-flag-large',b.flagLarge,'Large budget')}<input value="Budget of $5M or more (capacity check)" readonly tabindex="-1">${codeMark(true)}<span></span></article>
        ${shown.map(item=>{const i=arr.indexOf(item);return `<article class="criteria-compact-row ${item.enabled?'':'is-off'}">${sw(`data-toggle="${i}" data-key="reviewFlags"`,item.enabled,item.label)}<textarea rows="1" class="crit-field" data-rename-idx="reviewFlags:${i}" aria-label="Edit flag">${esc(item.label)}</textarea>${codeMark(CODE_FLAGS.includes(item.label))}<button type="button" class="setting-remove" data-remove="${i}" data-key="reviewFlags" aria-label="Remove ${esc(item.label)}">×</button></article>`}).join('')}
        ${moreBtn('reviewFlags',arr.length).replace(`Show all ${arr.length}`,`Show all ${arr.length} flags`)}${addRow('reviewFlags','Add review flag')}
      </div></section></div>`;
  }

  // Page 5 keeps the approved Sources & Monitoring layout, plus a switch per source.
  function leftSources(){
    const src=lastSearch&&lastSearch.sources, when=lastSearch&&lastSearch.searchedAt?new Date(lastSearch.searchedAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):null, on=criteriaState.sources||{};
    const active=SOURCES.filter(([k])=>on[k]!==false).length;
    return `<div class="nb-sources">${SOURCES.map(([k,name,what,how,logo],i)=>{const enabled=on[k]!==false,d=src&&src[k];const state=!enabled?'excluded':!d?'idle':d.skipped?'idle':d.ok?'ok':'down';
      return `<div class="nb-source ${state}" style="--i:${i}" title="${esc(how)}"><img src="assets/sources/${logo}" alt="" loading="lazy"><div><b>${name}</b><small>${what}</small><label class="nb-source-toggle"><button type="button" class="criteria-switch ${enabled?'active':''}" data-source="${k}" aria-pressed="${enabled}" aria-label="${enabled?'Exclude':'Include'} ${name}"><i></i></button><span>${enabled?'Included':'Excluded'}</span></label></div><strong>${!enabled?'<em>—</em>excluded':d&&!d.skipped?(d.ok?`<em data-count="${d.count}">0</em>notices`:'<em>—</em>unavailable'):'<em>—</em>not searched'}</strong></div>`}).join('')}</div>
      <p class="nb-caption">${active} of ${SOURCES.length} sources included. Excluded sources are not queried on the next search.${when?` Counts from the search of ${when}.`:''}</p>
      <div class="nb-sep"></div>
      <section class="nb-block"><header class="nb-row-head"><div><h3>Monitoring rules</h3><p>Built into the agent.</p></div><em class="nb-tag">Fixed</em></header>
      <ul class="nb-facts"><li><b>On demand</b>A search runs when someone presses Search now.</li><li><b>Closed notices</b>Dropped before scoring.</li><li><b>Duplicates</b>Merged across sources.</li><li><b>No date, or no year</b>Kept, shown as published.</li></ul></section>`;
  }
  function lastSearchBox(){
    const n=liveNumbers(); if(!n.found)return `<aside class="worked-example"><small>LAST SEARCH</small><p>Run a search to see its numbers here.</p></aside>`;
    const max=Math.max(1,n.found), bar=(label,v,cls)=>`<div class="nb-bar ${cls}"><span>${label}</span><i><u style="--w:${Math.round(v/max*100)}%"></u></i><b data-count="${v}">0</b></div>`;
    return `<aside class="worked-example nb-last"><small>LAST SEARCH</small>${bar('Collected',n.found,'all')}${bar('Excluded by a rule',n.excluded,'out')}${bar('Scored',n.scored,'in')}
      <p class="nb-tiers"><span class="t-rec">${n.recommended} recommended</span><span class="t-dec">${n.decision} decision needed</span><span class="t-low">${n.low} low fit</span></p></aside>`;
  }

  const PAGES=[
    {nav:'Focus Areas',reset:['focusAreas','keywords'],title:'What should the agent look for?',purpose:'Choose the health-system themes that define a strong strategic fit.',left:leftFocus,
      agent:[['Collect from approved sources','Gathers open notices from the sources included on the last page.'],['Read the full scope','Compares objectives and deliverables with these focus areas—not only titles or keyword matches.'],['Explain thematic fit','Scores the fit from 0 to 100 and states which themes match.']],
      human:[['Search with thematic terms','Analysts currently visit each platform and repeat searches using their own combinations of keywords.'],['Read the TOR or RFP','They open each notice and interpret whether the apparent match is substantive.'],['Apply institutional judgment','They decide whether an adjacent theme is strategically worth pursuing.']],
      rule:'A keyword match never overrides the actual deliverables or applicant type.',example:'A notice mentions health systems but only purchases equipment. The agent detects the mismatch; the analyst confirms the exclusion.'},
    {nav:'Activities',reset:['activities'],title:'What kind of work does Aceso deliver?',purpose:'Define the service types and assignments the agent should recognize as relevant.',left:leftActivities,
      agent:[['Extract expected activities','Reads the scope, deliverables and outputs requested by the funder.'],['Classify the service type','Tells advisory, research, evaluation and capacity-building work apart from unrelated work.'],['Compare the delivery model','Checks whether the assignment matches the activities listed here.']],
      human:[['Review deliverables manually','Analysts currently read the scope line by line to understand what the client is truly buying.'],['Compare with past work','They rely on experience and memory to determine whether Aceso has delivered something similar.'],['Resolve unusual cases','They decide whether a less common activity is still strategically viable.']],
      rule:'The activity is determined by the deliverables, not by broad language in the title.',example:'An opportunity mentions advisory support but primarily requests logistics. The agent flags the mismatch; the analyst validates the classification.'},
    {nav:'Geography & Languages',reset:['regions','languages.english','languages.spanish','languages.portuguese','languages.frenchReview','extraLanguages'],title:'Where can Aceso credibly deliver?',purpose:'Set priority geographies and the languages Aceso can use for delivery and submission.',left:leftGeo,
      agent:[['Extract location and language','Reads the country, region and submission language of each notice.'],['Compare with configured coverage','Gives extra weight to priority geographies and checks the language against the accepted list.'],['Flag participation constraints','Surfaces local-registration or in-country presence requirements.']],
      human:[['Filter and interpret locations','Analysts currently review country and regional eligibility across each platform.'],['Confirm language capability','They check whether the proposal and delivery can be supported in the required language.'],['Validate a partner route','They determine whether Aceso can participate through a consortium or local partner.']],
      rule:'A geographic preference guides ranking; unclear eligibility requires human review.',example:'A Rwanda notice requires local registration but accepts consortiums. The agent keeps it visible; the analyst validates the partner route.'},
    {nav:'Funders',reset:['fundersMDB','fundersPhilanthropic','fundersGov','fundersUS'],title:'Which institutions should rank higher?',purpose:'Maintain a clear list of preferred funders without hiding strong opportunities from others.',left:leftFunders,
      agent:[['Identify the funding institution','Reads the funder named in each notice.'],['Apply priority context','Raises opportunities from preferred institutions in the ranking.'],['Preserve strong exceptions','Keeps high-fit opportunities from other funders visible.']],
      human:[['Recognize familiar institutions','The team currently relies on experience to identify priority funders and known processes.'],['Consider relationship history','They weigh previous work, familiarity and strategic value.'],['Assess unfamiliar funders','They investigate whether a new institution is credible and worth pursuing.']],
      rule:'A preferred funder improves ranking; it never creates an automatic exclusion.',example:'A World Bank opportunity ranks higher, while a strong thematic fit from another funder remains available for human review.'},
    {nav:'Excluded Outright',reset:['knockouts'],title:'What should stop automatically?',purpose:'Use only clear hard-stop conditions to exclude an opportunity without prior review.',left:leftOut,
      agent:[['Test every hard stop','Checks each notice against every active exclusion rule. Rules marked “code” are checked on every search.'],['Require clear evidence','Excludes only when the notice clearly meets the rule.'],['Record the reason','Saves the matched rule with every excluded notice, visible in Discarded.']],
      human:[['Screen notices one by one','Analysts currently identify cancellations, duplicates, low-value work and scope mismatches manually.'],['Interpret ambiguous wording','They decide whether a condition is truly disqualifying or needs clarification.'],['Recover exceptions','They can reopen a notice when the evidence was incomplete or incorrectly interpreted.']],
      rule:'When evidence is incomplete or ambiguous, keep the opportunity and flag it for review.',example:'A hospital-equipment tender is identified as goods-only procurement. The agent records the rule; the analyst can confirm or reopen it.'},
    {nav:'Kept but Flagged',reset:['reviewFlags','budget','deadlineDays'],title:'Kept, but flagged',purpose:'Define what should remain visible but require human review.',left:leftFlag,
      agent:[['Detect uncertainty','Identifies missing budgets, short deadlines, incomplete documents and unclear eligibility.'],['Document the concern','Shows each flag on the opportunity so the reviewer sees it first.'],['Keep it in review','Routes the opportunity to a person instead of silently rejecting it.']],
      human:[['Notice uncertainty while reading','Analysts currently discover missing or contradictory information during manual review.'],['Investigate the open question','They consult the source, colleagues or funder when needed.'],['Choose the next step','They keep, prioritise or discard the opportunity with a recorded reason.']],
      rule:'Undisclosed value, short timing and uncertain eligibility always require human review.',example:'A strong-fit EOI has no budget and closes in 12 days. The agent flags both concerns; the analyst decides whether the effort is viable.'},
    {nav:'Sources & Monitoring',reset:['sources'],title:'Where opportunities come from',purpose:'Six public sources, and how the monitoring layer works.',left:leftSources,sourcesPage:true}
  ];

  function rightPage(p){
    if(p.sourcesPage){
      const e=owner==='agent'
        ?{eyebrow:'HOW MONITORING WORKS',title:'Collect, clean up, screen, score.',steps:[['Collects','Open notices from the included sources on the left.'],['Cleans up','Drops closed notices and merges duplicates.'],['Screens and scores','Rules first, then a 0–100 fit score with its reasons.']],box:lastSearchBox()}
        :{eyebrow:'WHEN MUST A HUMAN DECIDE?',title:'Every pursuit decision belongs to people.',steps:[['Review recommendations','Recommended and Decision needed arrive ready to read.'],['Decide pursuit and staffing','Approve, reject or recover — with the reason kept.'],['Own the submission','Proposals move through Pipeline under the team’s control.']],box:`<aside class="worked-example nb-rule-box"><small>DECISION RULE</small><p><b>The agent recommends and documents. It never makes the final pursuit or submission decision.</b></p></aside>`};
      return `<article class="notebook-page playbook-page nb-right">${ownerTabs()}<div class="nb-explain"><p class="eyebrow">${e.eyebrow}</p><h2>${e.title}</h2><ol class="nb-steps">${e.steps.map((s,i)=>`<li style="--i:${i}"><i>${i+1}</i><span><b>${s[0]}</b><p>${s[1]}</p></span></li>`).join('')}</ol>${e.box}</div></article>`;
    }
    return `<article class="notebook-page playbook-page">${ownerTabs()}<p class="eyebrow">${owner==='agent'?'HOW THE AGENT WORKS':'HOW THE TEAM WORKS TODAY'}</p><h2>${owner==='agent'?'How the agent searches and evaluates':'How analysts handle this manually'}</h2><div class="notebook-actions">${p[owner].map((x,i)=>`<div><i>${String(i+1).padStart(2,'0')}</i><span><b>${x[0]}</b><p>${x[1]}</p></span></div>`).join('')}</div><aside class="worked-example"><small>SEE BOTH IN PRACTICE</small><p>${p.example}</p><b class="we-output"><i></i>${owner==='agent'?'Agent output: prioritised result with its reasons':'Human output: validated interpretation and decision'}</b></aside></article>`;
  }
  const ownerTabs=()=>`<div class="owner-tabs" role="tablist" aria-label="Explanation view"><button type="button" data-owner="agent" role="tab" aria-selected="${owner==='agent'}" class="${owner==='agent'?'active':''}"><span>✦</span> Agent</button><button type="button" data-owner="human" role="tab" aria-selected="${owner==='human'}" class="${owner==='human'?'active':''}"><span>◎</span> Human today</button></div>`;

  function animateNotebook(view){
    const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    qa('[data-count]',view).forEach(el=>{const target=Number(el.dataset.count)||0;if(reduce||!target){el.textContent=target;return}const t0=performance.now();const tick=t=>{const p=Math.min(1,(t-t0)/700);el.textContent=Math.round(target*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)});
    requestAnimationFrame(()=>requestAnimationFrame(()=>view.querySelector('.criteria-notebook')?.classList.add('animate-in')));
  }

  function resetSection(p){
    // "languages.x" resets one field, so pages sharing an object don't reset each other.
    p.reset.forEach(k=>{const [a,b]=k.split('.');if(b)criteriaState[a][b]=DEFAULT_CRITERIA_STATE[a][b];else{criteriaState[a]=JSON.parse(JSON.stringify(DEFAULT_CRITERIA_STATE[a]));if(criteriaState.inactive)delete criteriaState.inactive[a]}});saveCriteriaState();
  }

  function bindSettings(view){
    const changed=m=>{saveCriteriaState();say(m||'Saved. Applied on the next search.')};
    const rowOf=el=>el.closest('.criteria-compact-row,.nb-source');
    const labelOf=x=>(typeof x==='string'?x:x.label).toLowerCase();
    const flip=(btn,on)=>{btn.classList.toggle('active',on);btn.setAttribute('aria-pressed',String(on));rowOf(btn)?.classList.toggle('is-off',!on)};
    qa('[data-remove]',view).forEach(btn=>btn.onclick=e=>{e.preventDefault();criteriaState[btn.dataset.key].splice(Number(btn.dataset.remove),1);changed();renderNotebook(false)});
    qa('[data-drop]',view).forEach(btn=>btn.onclick=e=>{e.preventDefault();const k=btn.dataset.key,v=btn.dataset.drop;criteriaState[k]=(criteriaState[k]||[]).filter(x=>x!==v);criteriaState.inactive[k]=offList(k).filter(x=>x!==v);changed();renderNotebook(false)});
    qa('[data-active]',view).forEach(btn=>btn.onclick=()=>{
      const k=btn.dataset.key,v=btn.dataset.active,on=criteriaState[k]||[],off=offList(k),turnOn=!on.includes(v);
      // Re-checked items return to their default position; custom ones stay at the end.
      const rank=x=>{const i=(DEFAULT_CRITERIA_STATE[k]||[]).indexOf(x);return i<0?Infinity:i};
      if(turnOn){criteriaState.inactive[k]=off.filter(x=>x!==v);on.push(v);criteriaState[k]=on.map((x,i)=>[x,i]).sort((p,q)=>(rank(p[0])-rank(q[0]))||(p[1]-q[1])).map(p=>p[0])}
      else{criteriaState[k]=on.filter(x=>x!==v);criteriaState.inactive[k]=[...off,v]}
      flip(btn,turnOn);changed(turnOn?'Back on. Applied on the next search.':'Off. The agent stops using it on the next search.');
    });
    qa('[data-toggle]',view).forEach(btn=>btn.onclick=()=>{const item=criteriaState[btn.dataset.key][Number(btn.dataset.toggle)];item.enabled=!item.enabled;flip(btn,item.enabled);changed(item.enabled?'Rule on. Applied on the next search.':'Rule off. It stops on the next search.')});
    qa('[data-flag-large]',view).forEach(btn=>btn.onclick=()=>{criteriaState.budget.flagLarge=!criteriaState.budget.flagLarge;flip(btn,criteriaState.budget.flagLarge);changed()});
    qa('[data-lang]',view).forEach(btn=>btn.onclick=()=>{const k=btn.dataset.lang;criteriaState.languages[k]=!criteriaState.languages[k];flip(btn,criteriaState.languages[k]);changed()});
    qa('[data-source]',view).forEach(btn=>btn.onclick=()=>{
      const k=btn.dataset.source,on=criteriaState.sources||(criteriaState.sources={}),next=on[k]===false;
      if(!next&&SOURCES.filter(([s])=>on[s]!==false).length<=1){say('Keep at least one source included.');return}
      on[k]=next;changed(next?'Source included in the next search.':'Source excluded: it will not be queried on the next search.');renderNotebook(false);
    });
    // Inline edits: plain string lists (by old value) and indexed lists / rule labels.
    qa('[data-rename-str]',view).forEach(f=>f.onchange=()=>{
      const k=f.dataset.renameStr,old=f.dataset.old,val=f.value.trim(),inOn=(criteriaState[k]||[]).includes(old),list=inOn?criteriaState[k]:offList(k);
      if(!val||(val!==old&&[...(criteriaState[k]||[]),...offList(k)].some(x=>x.toLowerCase()===val.toLowerCase()))){f.value=old;say(val?'Already in the list.':'A value is required.');return}
      list[list.indexOf(old)]=val;changed('Updated. Applied on the next search.');renderNotebook(false);
    });
    qa('[data-rename-idx]',view).forEach(f=>f.onchange=()=>{
      const [k,i]=f.dataset.renameIdx.split(':'),list=criteriaState[k],idx=Number(i),val=f.value.trim(),cur=list[idx],old=typeof cur==='string'?cur:cur.label;
      if(!val||list.some((x,j)=>j!==idx&&labelOf(x)===val.toLowerCase())){f.value=old;say(val?'Already in the list.':'A value is required.');return}
      if(typeof cur==='string')list[idx]=val;else cur.label=val;changed('Updated. Applied on the next search.');
    });
    qa('[data-add-open]',view).forEach(btn=>btn.onclick=()=>{const k=btn.dataset.addOpen;adding[k]=true;if(['focusAreas','activities','keywords','knockouts','reviewFlags'].includes(k))expanded[k]=true;renderNotebook(false);q(`.criteria-add-row[data-key="${k}"] input`,q('#criteriaView'))?.focus()});
    qa('[data-add-close]',view).forEach(btn=>btn.onclick=()=>{adding[btn.dataset.addClose]=false;renderNotebook(false)});
    qa('.criteria-add-row',view).forEach(form=>{
      const mode=form.dataset.mode,input=form.querySelector('input[type="text"]');
      form.onsubmit=e=>{
        e.preventDefault();const val=input.value.trim();if(!val)return;
        const key=mode==='funder'?form.querySelector('select').value:form.dataset.key;
        const list=criteriaState[key]||(criteriaState[key]=[]);
        if(list.some(x=>labelOf(x)===val.toLowerCase())||offList(key).some(x=>x.toLowerCase()===val.toLowerCase())){say('Already in the list.');return}
        list.push(mode==='item'?{id:key+'-'+Date.now(),label:val,enabled:true}:val);
        adding[form.dataset.key]=false;changed();renderNotebook(false);
      };
      input.onkeydown=e=>{if(e.key==='Escape'){adding[form.dataset.key]=false;renderNotebook(false)}};
    });
    const min=q('#budgetMinInput',view);if(min)min.onchange=e=>{criteriaState.budget.min=Math.max(0,Number(e.target.value)||0);changed(`Budget flag set below ${fmtUSD(criteriaState.budget.min)}.`)};
    const days=q('#deadlineDaysInput',view);if(days)days.onchange=e=>{criteriaState.deadlineDays=Math.min(120,Math.max(1,Math.round(Number(e.target.value)||14)));e.target.value=criteriaState.deadlineDays;changed(`Deadline flag set to ${criteriaState.deadlineDays} days.`)};
    qa('[data-expand]',view).forEach(btn=>btn.onclick=()=>{expanded[btn.dataset.expand]=!expanded[btn.dataset.expand];renderNotebook(false)});
    qa('[data-owner]',view).forEach(btn=>btn.onclick=()=>{owner=btn.dataset.owner;renderNotebook(false)});
  }

  function renderNotebook(animate=true){
    const view=q('#criteriaView'),p=PAGES[criterion]; if(!view)return;
    const total=PAGES.length;
    const engine=aiScoring===false?'<span class="warn"><i></i> AI scoring off — code rules only</span>':'<span><i></i> Applied on the next search</span>';
    view.innerHTML=`<header class="notebook-head"><div><p class="eyebrow">ACESO DECISION PLAYBOOK <span>• ${criterion+1} OF ${total}</span></p><h1>Criteria, made easy to govern.</h1><p>Configure what the agent evaluates. Keep every strategic decision with the team.</p></div><aside class="criteria-connection"><small>LIVE ENGINE</small><b>Rules are editable</b>${engine}</aside></header>
      <section class="criteria-notebook criteria-notebook-v2 criterion-theme-${criterion}${p.sourcesPage?' criteria-v4':''}${animate?'':' animate-in'}"><div class="notebook-spine" aria-hidden="true"><span></span></div><i class="ring r1"></i><i class="ring r2"></i><i class="ring r3"></i><i class="ring r4"></i>
        <article class="notebook-page settings-page"><header class="criteria-page-toolbar"><p class="page-count">CRITERION 0${criterion+1} <span>/ 0${total}</span></p>${p.reset.length?'<button type="button" id="resetCriterion">↶ &nbsp;Reset to Aceso defaults</button>':''}</header><h2>${p.title}</h2><p>${p.purpose}</p><div class="criteria-page-controls">${p.left()}</div>${p.rule?`<div class="rule-note"><small>DECISION RULE</small><b>${p.rule}</b></div>`:''}</article>
        ${rightPage(p)}
      </section><footer class="notebook-footer notebook-footer-v2"><button id="criterionPrev" ${criterion===0?'disabled':''}>← Previous</button><nav>${PAGES.map((x,i)=>`<button data-criterion="${i}" class="${i===criterion?'active':i<criterion?'done':''}"><i>${i<criterion?'✓':i+1}</i><span>${x.nav}</span></button>`).join('')}</nav><button id="criterionNext">${criterion===total-1?'Save criteria':'Next →'}</button></footer>`;
    qa('[data-criterion]',view).forEach(b=>b.onclick=()=>{criterion=Number(b.dataset.criterion);owner='agent';renderNotebook()});
    q('#criterionPrev',view).onclick=()=>{if(criterion){criterion--;owner='agent';renderNotebook()}};
    // Every change is already saved as it is made; the last button confirms that.
    q('#criterionNext',view).onclick=()=>{if(criterion<total-1){criterion++;owner='agent';renderNotebook()}else{saveCriteriaState();say('Criteria saved. They apply on the next search.')}};
    bindSettings(view);
    const reset=q('#resetCriterion',view);if(reset)reset.onclick=()=>{resetSection(p);Object.keys(adding).forEach(k=>delete adding[k]);renderNotebook(false);say('Reset to Aceso defaults.')};
    if(animate)animateNotebook(view);else qa('[data-count]',view).forEach(el=>el.textContent=el.dataset.count);
  }

  document.addEventListener('aceso:live-search-complete',e=>{
    const d=e.detail||{};lastSearch={sources:d.sources,searchedAt:d.searchedAt};
    if(q('#criteriaView')?.classList.contains('active'))renderNotebook(false);
  });

  function tuneToday(){
    const headline=q('#todayView .hero-copy h1');
    if(headline) headline.innerHTML='<strong class="today-nine">9</strong> <span class="hero-accent">opportunities</span> ready<br>for review today';
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

  function pipelineMode(){const active=q('#pipelineMetrics button.active'),view=q('#pipelineView');view?.classList.toggle('proposal-mode',active?.dataset.pstage==='Proposal')}

  const priorDetail=window.openDetail;
  window.openDetail=function(opportunity){
    priorDetail(opportunity);
    const origin=q('.record-origin');
    if(origin) origin.dataset.country=opportunity.country||'';
  };

  const priorShow=window.showView;
  window.showView=function(name){priorShow(name);if(name==='criteria')renderNotebook();if(name==='pipeline')setTimeout(pipelineMode)};
  qa('.navlinks button').forEach(b=>b.onclick=()=>window.showView(b.dataset.view));
  q('#pipelineMetrics')?.addEventListener('click',()=>setTimeout(pipelineMode));
  tuneToday();pipelineMode();renderNotebook();
})();
