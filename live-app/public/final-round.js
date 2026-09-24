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
  const FUNDER_GROUPS=[['fundersMDB','Development bank'],['fundersPhilanthropic','Foundation'],['fundersGov','Government aid'],['fundersUS','U.S. government']];
  const PREVIEW=8;
  let criterion=0, side='agent', lastSearch=null;
  const expanded={}, adding={};
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v);
  const fmtUSD=n=>n>=1e6?`$${(n/1e6).toFixed(n%1e6?1:0)}M`:`$${Math.round(n/1e3)}K`;
  const ICON={target:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><path d="M12 12l6-6"/></svg>',gear:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>',pin:'<svg viewBox="0 0 24 24"><path d="M12 21s-6-5.6-6-11a6 6 0 0 1 12 0c0 5.4-6 11-6 11z"/><circle cx="12" cy="10" r="2.2"/></svg>',bank:'<svg viewBox="0 0 24 24"><path d="M3 9l9-5 9 5M5 9v9M9.5 9v9M14.5 9v9M19 9v9M3 20h18"/></svg>',trash:'<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>'};
  const svg=k=>`<i class="nb-ico" aria-hidden="true">${ICON[k]}</i>`;

  // "+ Add …" opens an inline input in place, so adding is one click away but
  // doesn't clutter the page with empty fields.
  function addControl(key,label,mode,extra=''){
    if(!adding[key])return `<button type="button" class="nb-add-open" data-add-open="${key}">＋ ${label}</button>`;
    return `<form class="chip-add nb-add-inline" data-key="${key}" data-mode="${mode}">${extra}<input type="text" placeholder="${esc(label)}…" required><button type="button">Add</button><button type="button" class="nb-add-cancel" data-add-close="${key}" aria-label="Cancel">×</button></form>`;
  }

  // Checkbox grid for plain string lists. Unchecking moves an item to
  // criteriaState.inactive[key]; only the checked list is sent to the agent.
  function checkGrid(key,label,sub,icon,tag,addLabel){
    const on=criteriaState[key]||[], off=(criteriaState.inactive&&criteriaState.inactive[key])||[];
    const all=[...on.map(v=>[v,true]),...off.map(v=>[v,false])];
    const open=expanded[key]||all.length<=PREVIEW, shown=open?all:all.slice(0,PREVIEW);
    return `<section class="nb-block"><header class="nb-block-head">${svg(icon)}<div><h3>${label}<span class="nb-count">${on.length}${off.length?` of ${all.length}`:''}</span></h3><p>${sub}</p></div>${tag?`<em class="nb-tag" title="${esc(tag[1])}">${tag[0]}</em>`:''}</header>
      <div class="nb-grid">${shown.map(([v,isOn])=>`<label class="nb-box ${isOn?'':'off'}"><input type="checkbox" data-active="${esc(v)}" data-key="${key}" ${isOn?'checked':''}><span>${esc(v)}</span><button type="button" data-drop="${esc(v)}" data-key="${key}" aria-label="Remove ${esc(v)}">×</button></label>`).join('')}</div>
      <div class="nb-block-foot">${all.length>PREVIEW?`<button type="button" class="nb-more" data-expand="${key}">${open?'Show fewer':`Show all ${all.length}`}</button>`:'<span></span>'}${addControl(key,addLabel,'chip')}</div></section>`;
  }

  function leftFocus(){
    return `${checkGrid('focusAreas','Focus areas','The themes the agent should look for.','target',['AI + fallback','Used by the AI and by the keyword fallback scorer'],'Add focus area')}
      <div class="nb-sep"></div>
      ${checkGrid('activities','Activities Aceso delivers','The types of work the agent should prioritize.','gear',['AI','Used by the AI when it reads the notice'],'Add activity')}`;
  }

  function leftGeo(){
    const regions=criteriaState.regions||[];
    const funders=FUNDER_GROUPS.flatMap(([k,type])=>(criteriaState[k]||[]).map((name,i)=>({k,type,name,i})));
    const typeSelect=`<select name="group" aria-label="Funder type">${FUNDER_GROUPS.map(([k,t])=>`<option value="${k}">${t}</option>`).join('')}</select>`;
    return `<section class="nb-block"><header class="nb-row-head"><div><h3>Priority regions</h3><p>Prioritise opportunities in these regions.</p></div>${adding.regions?'':`<button type="button" class="nb-link-add" data-add-open="regions">⊕ Add region</button>`}</header>
        <div class="nb-list">${regions.map((r,i)=>`<div class="nb-list-row">${svg('pin')}<span>${esc(r)}</span><button type="button" data-remove="${i}" data-key="regions" aria-label="Remove ${esc(r)}">×</button></div>`).join('')||'<p class="nb-empty">No priority regions.</p>'}${adding.regions?addControl('regions','Add region','chip'):''}</div></section>
      <section class="nb-block"><header class="nb-row-head"><div><h3>Preferred funders</h3><p>Give higher consideration to opportunities from these funders.</p></div>${adding.funders?'':`<button type="button" class="nb-link-add" data-add-open="funders">⊕ Add funder</button>`}</header>
        <div class="nb-list nb-list-scroll">${funders.map(f=>`<div class="nb-list-row">${svg('bank')}<span>${esc(f.name)}</span><small>${f.type}</small><button type="button" data-remove="${f.i}" data-key="${f.k}" aria-label="Remove ${esc(f.name)}">×</button></div>`).join('')}${adding.funders?addControl('funders','Add funder','funder',typeSelect):''}</div></section>`;
  }

  function leftOut(){
    const l=criteriaState.languages, arr=criteriaState.knockouts||[];
    const lang=(k,label)=>`<label class="nb-plain"><input type="checkbox" data-lang="${k}" ${l[k]?'checked':''}><span>${label}</span></label>`;
    return `${aiNote()}<section class="nb-block"><header class="nb-row-head"><div><h3>Exclusion rules</h3><p><b class="nb-src-key code">Code</b> checked on every search · <b class="nb-src-key ai">AI</b> applied by the AI</p></div></header>
        <div class="nb-grid">${arr.map((item,i)=>[item,i]).slice(0,expanded.knockouts?arr.length:PREVIEW).map(([item,i])=>{const src=knockoutSource(item.label);return `<label class="nb-box ${item.enabled?'':'off'}"><input type="checkbox" data-toggle="${i}" data-key="knockouts" ${item.enabled?'checked':''}><span>${esc(item.label)}<em class="nb-src ${src}">${src==='code'?'Code':'AI'}</em></span><button type="button" data-remove="${i}" data-key="knockouts" aria-label="Remove ${esc(item.label)}">×</button></label>`}).join('')}</div>
        <div class="nb-block-foot">${arr.length>PREVIEW?`<button type="button" class="nb-more" data-expand="knockouts">${expanded.knockouts?'Show fewer':`Show all ${arr.length}`}</button>`:'<span></span>'}${addControl('knockouts','Add rule','item')}</div></section>
      <div class="nb-sep"></div>
      <section class="nb-block"><header class="nb-row-head"><div><h3>Languages Aceso delivers in</h3><p>Other languages usually score as low fit.</p></div><em class="nb-tag">AI</em></header>
        <div class="nb-langs">${lang('english','English')}${lang('spanish','Spanish')}${lang('portuguese','Portuguese')}</div></section>`;
  }

  function leftFlag(){
    const b=criteriaState.budget,l=criteriaState.languages,arr=criteriaState.reviewFlags||[];
    const toggle=(attrs,on)=>`<label class="nb-toggle"><input type="checkbox" ${attrs} ${on?'checked':''}><i></i></label>`;
    const fixedRow=(label,attrs,on,src)=>`<div class="nb-flag-row ${on?'':'off'}"><span class="nb-flag-label">${label}<em class="nb-src ${src}">${src==='code'?'Code':'AI'}</em></span>${toggle(attrs,on)}<span class="nb-flag-fixed" title="Built-in rule">—</span></div>`;
    return `${aiNote()}<div class="nb-fields">
        <label class="nb-field"><span>Flag budgets below (USD)</span><input type="number" id="budgetMinInput" value="${b.min}" step="10000" min="0"></label>
        <div class="nb-field"><span>Flag opportunities due within</span><div class="nb-fixed-input"><b>14</b><em>days</em></div><small>Fixed in the agent</small></div>
      </div>
      <div class="nb-sep"></div>
      <section class="nb-block"><header class="nb-row-head"><div><h3>Review flags</h3><p>Kept visible, with a note for the reviewer. ${arr.filter(x=>x.enabled).length} of ${arr.length} on.</p></div></header>
        <div class="nb-flag-table"><div class="nb-flag-cols"><span>Flag condition</span><span>Status</span><span></span></div>
        ${fixedRow('Budget of $5M or more (capacity check)','id="budgetFlagLarge"',b.flagLarge,'code')}
        ${fixedRow('French notice — send to human review','data-lang="frenchReview"',l.frenchReview,'ai')}
        ${arr.map((item,i)=>[item,i]).slice(0,expanded.reviewFlags?arr.length:6).map(([item,i])=>{const src=flagSource(item.label);return `<div class="nb-flag-row ${item.enabled?'':'off'}"><span class="nb-flag-label"><input type="text" value="${esc(item.label)}" data-rename="${i}" data-key="reviewFlags" aria-label="Flag condition"><em class="nb-src ${src}">${src==='code'?'Code':'AI'}</em></span>${toggle(`data-toggle="${i}" data-key="reviewFlags"`,item.enabled)}<button type="button" class="nb-trash" data-remove="${i}" data-key="reviewFlags" aria-label="Delete ${esc(item.label)}">${ICON.trash}</button></div>`}).join('')}</div>
        <div class="nb-block-foot">${arr.length>6?`<button type="button" class="nb-more" data-expand="reviewFlags">${expanded.reviewFlags?'Show fewer':`Show all ${arr.length}`}</button>`:'<span></span>'}${addControl('reviewFlags','Add another review flag','item')}</div></section>`;
  }

  function leftSources(){
    const src=lastSearch&&lastSearch.sources, when=lastSearch&&lastSearch.searchedAt?new Date(lastSearch.searchedAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):null;
    return `<div class="nb-sources">${SOURCES.map(([k,name,what,how,logo],i)=>{const d=src&&src[k];const state=!d?'idle':d.ok?'ok':'down';return `<div class="nb-source ${state}" style="--i:${i}" title="${esc(how)}"><img src="assets/sources/${logo}" alt="" loading="lazy"><div><b>${name}</b><small>${what}</small></div><strong>${d?(d.ok?`<em data-count="${d.count}">0</em>notices`:'<em>—</em>unavailable'):'<em>—</em>not searched'}</strong></div>`}).join('')}</div>
      <p class="nb-caption">${when?`Counts from the search of ${when}.`:'Counts appear after the next search.'} Sources are fixed; API keys live on the server.</p>
      <div class="nb-sep"></div>
      <section class="nb-block"><header class="nb-row-head"><div><h3>Monitoring rules</h3><p>Built into the agent.</p></div><em class="nb-tag">Fixed</em></header>
      <ul class="nb-facts"><li><b>On demand</b>A search runs when someone presses Search now.</li><li><b>Closed notices</b>Dropped before scoring.</li><li><b>Duplicates</b>Merged across sources.</li><li><b>No date, or no year</b>Kept, shown as published.</li></ul></section>`;
  }

  const knockoutSource=l=>CODE_KNOCKOUTS.includes(l)?'code':'ai';
  const flagSource=l=>CODE_FLAGS.includes(l)?'code':'ai';
  const aiNote=()=>aiScoring===false?`<p class="nb-warn">AI scoring is off on this server, so only rules marked <b>Code</b> apply right now.</p>`:'';

  // ---- right-page explanations (one side at a time) -------------------------
  function lastSearchBox(){
    const n=liveNumbers(); if(!n.found)return `<aside class="worked-example"><small>LAST SEARCH</small><p>Run a search to see its numbers here.</p></aside>`;
    const max=Math.max(1,n.found), bar=(label,v,cls)=>`<div class="nb-bar ${cls}"><span>${label}</span><i><u style="--w:${Math.round(v/max*100)}%"></u></i><b data-count="${v}">0</b></div>`;
    return `<aside class="worked-example nb-last"><small>LAST SEARCH</small>${bar('Collected',n.found,'all')}${bar('Excluded by a rule',n.excluded,'out')}${bar('Scored',n.scored,'in')}
      <p class="nb-tiers"><span class="t-rec">${n.recommended} recommended</span><span class="t-dec">${n.decision} decision needed</span><span class="t-low">${n.low} low fit</span></p></aside>`;
  }
  function reasonsBox(){
    const n=liveNumbers(); if(!n.reasons.length)return `<aside class="worked-example"><small>WORKED EXAMPLE</small><p>A notice buys only medical equipment. It matches “Excessive focus on physical infrastructure”, so it is excluded and the rule is saved with it.</p><b class="nb-out">Agent output: excluded — physical infrastructure</b></aside>`;
    const max=Math.max(1,...n.reasons.map(r=>r[1]));
    return `<aside class="worked-example nb-last"><small>WHY NOTICES WERE EXCLUDED · LAST SEARCH</small>${n.reasons.map(([r,c])=>`<div class="nb-bar out"><span title="${esc(r)}">${esc(r)}</span><i><u style="--w:${Math.round(c/max*100)}%"></u></i><b>${c}</b></div>`).join('')}</aside>`;
  }

  const PAGES=[
    {nav:'Focus & activities',reset:['focusAreas','activities'],title:'What makes an opportunity a fit?',sub:'The themes and kinds of work the agent should prioritize.',left:leftFocus,
      agent:{eyebrow:'HOW THE AGENT SCORES FIT',title:'It reads the whole notice and scores the match.',steps:[['Reads the full notice','Objectives, deliverables and eligibility, not just the title.'],['Scores 0–100','85+ Recommended · 65–84 Decision needed · under 65 Low fit.'],['Tags the main theme','The best-matching focus area becomes the theme on each opportunity.']],
        box:()=>`<aside class="worked-example"><small>WORKED EXAMPLE</small><p>A tender mentions “health systems” but only buys equipment. The theme matches, the activity doesn’t.</p><b class="nb-out">Agent output: excluded — goods procurement</b></aside>`},
      human:{eyebrow:'WHAT THE TEAM DECIDES',title:'The score is advice, not a decision.',steps:[['Keep the lists current','Add or remove a theme; it applies from the next search.'],['Review “Decision needed”','Every 65–84 score goes to a person before anything else.'],['Approve, reject or recover','From Opportunities, with the reason kept.']],
        box:()=>`<aside class="worked-example"><small>EXAMPLE</small><p>A UHC advisory notice scores 72. An analyst reads the TOR and decides whether to pursue.</p><b class="nb-out">Agent: decision needed · Human: pursue or not</b></aside>`}},
    {nav:'Geography & funders',reset:['regions','fundersMDB','fundersPhilanthropic','fundersGov','fundersUS'],title:'Where and with whom does Aceso want to work?',sub:'Preferences raise the score. They never exclude.',left:leftGeo,
      agent:{eyebrow:'HOW PREFERENCES INFLUENCE SCORING',title:'A match adds to the score.',steps:[['Finds the country and funder','Read directly from the notice.'],['Adds a bonus on a match','A listed region or funder pushes the fit score up.'],['Never excludes on its own','Everything else is still scored normally.']],
        box:()=>`<aside class="worked-example"><small>EXAMPLE</small><p>A World Bank notice in Indonesia gets both bonuses. A strong CDC notice in Kenya is still scored, just without the regional bonus.</p></aside>`},
      human:{eyebrow:'WHAT THE TEAM DECIDES',title:'Decide where to stretch.',steps:[['Set the priorities','Regions and funders the firm wants to grow in.'],['Judge strong fits outside them','Out-of-region opportunities still reach you when the fit is high.'],['Vet new funders','Unknown funders arrive with an “Unfamiliar funder” flag.']],
        box:()=>`<aside class="worked-example"><small>EXAMPLE</small><p>A foundation Aceso hasn’t worked with posts a strong RFP. The team checks the funder before deciding.</p></aside>`}},
    {nav:'Excluded outright',reset:['knockouts','languages.english','languages.spanish','languages.portuguese'],title:'Excluded outright',sub:'Only clear hard stops remove a notice automatically.',left:leftOut,
      agent:{eyebrow:'WHAT THE AGENT DOES',title:'When the agent excludes automatically',steps:[['Applies only explicit rules','A notice is excluded only when a rule clearly applies.'],['Keeps it traceable','The exact rule is saved with every exclusion.'],['When in doubt, keeps it','Anything uncertain goes to a person instead.']],box:reasonsBox},
      human:{eyebrow:'WHAT THE TEAM DECIDES',title:'Nothing is lost.',steps:[['Review what was excluded','Opportunities › Discarded lists every case with its rule.'],['Recover any case','One click sends it back for human review.'],['Loosen a rule','Switch it off here; it stops on the next search.']],
        box:()=>`<aside class="worked-example"><small>EXAMPLE</small><p>Excluded for “Local incorporation required”, but a local partner could apply.</p><b class="nb-out">Human decision: recover for review</b></aside>`}},
    {nav:'Kept, but flagged',reset:['reviewFlags','budget','languages.frenchReview'],title:'Kept, but flagged',sub:'Visible, scored normally, with a note for the reviewer.',left:leftFlag,
      agent:{eyebrow:'WHAT THE AGENT DOES',title:'A flag never excludes.',steps:[['Budget flags come from the value','Computed from the published budget, in code.'],['Other flags come from the notice','The AI adds only the flags switched on here.'],['Several can apply','Each travels with the opportunity to the reviewer.']],
        box:()=>`<aside class="worked-example"><small>WORKED EXAMPLE</small><p>No budget is published and the deadline is 10 days away.</p><b class="nb-out">Agent flags: budget not published, tight deadline</b></aside>`},
      human:{eyebrow:'WHAT THE TEAM DECIDES',title:'People decide what a flag means.',steps:[['Agent documents concerns','Each flag has a clear reason.'],['People review and decide','Pursue, staff or submit — or let it go.'],['Tune the flags','Switch off flags that add noise; add ones the team needs.']],
        box:()=>`<aside class="worked-example"><small>EXAMPLE</small><p>A strong-fit notice is flagged “Unclear eligibility”. The team confirms with the funder and keeps it.</p><b class="nb-out">Human decision: keep for review</b></aside>`}},
    {nav:'Sources & monitoring',reset:[],title:'Where opportunities come from',sub:'Six public sources, and how the monitoring layer works.',left:leftSources,
      agent:{eyebrow:'HOW MONITORING WORKS',title:'Collect, clean up, screen, score.',steps:[['Collects','Open notices from the six sources on the left.'],['Cleans up','Drops closed notices and merges duplicates.'],['Screens and scores','Rules first, then a 0–100 fit score with its reasons.']],box:lastSearchBox},
      human:{eyebrow:'WHEN MUST A HUMAN DECIDE?',title:'Every pursuit decision belongs to people.',steps:[['Review recommendations','Recommended and Decision needed arrive ready to read.'],['Decide pursuit and staffing','Approve, reject or recover — with the reason kept.'],['Own the submission','Proposals move through Pipeline under the team’s control.']],
        box:()=>`<aside class="worked-example nb-rule-box"><small>DECISION RULE</small><p><b>The agent recommends and documents. It never makes the final pursuit or submission decision.</b></p></aside>`}}
  ];

  function rightPage(p){
    const e=p[side];
    return `<article class="notebook-page nb-right"><div class="nb-sides" role="tablist" aria-label="Explanation">${['agent','human'].map(k=>`<button type="button" role="tab" aria-selected="${side===k}" class="${side===k?'active':''}" data-side="${k}">${k==='agent'?'Agent':'Human'}</button>`).join('')}</div>
      <div class="nb-explain" data-side-panel="${side}"><p class="eyebrow">${e.eyebrow}</p><h2>${e.title}</h2>
      <ol class="nb-steps">${e.steps.map((s,i)=>`<li style="--i:${i}"><i>${i+1}</i><span><b>${s[0]}</b><p>${s[1]}</p></span></li>`).join('')}</ol>${e.box()}</div></article>`;
  }
  function leftPage(p){
    return `<article class="notebook-page nb-left"><div class="nb-left-head"><p class="page-count">CRITERION 0${criterion+1} <span>/ 0${PAGES.length}</span></p>${p.reset.length?'<button type="button" id="resetCriterion" class="reset-link">↺ Reset to Aceso defaults</button>':''}</div>
      <h2>${p.title}</h2><p class="nb-sub">${p.sub}</p><div class="nb-controls">${p.left()}</div></article>`;
  }

  function animateNotebook(view){
    const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    qa('[data-count]',view).forEach(el=>{const target=Number(el.dataset.count)||0;if(reduce||!target){el.textContent=target;return}const t0=performance.now();const tick=t=>{const p=Math.min(1,(t-t0)/700);el.textContent=Math.round(target*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)});
    requestAnimationFrame(()=>requestAnimationFrame(()=>view.querySelector('.criteria-notebook')?.classList.add('animate-in')));
  }

  function resetSection(p){
    // "languages.x" resets one field, so pages sharing the languages object
    // (Excluded outright vs Kept, but flagged) don't reset each other.
    p.reset.forEach(k=>{const [a,b]=k.split('.');if(b)criteriaState[a][b]=DEFAULT_CRITERIA_STATE[a][b];else criteriaState[a]=JSON.parse(JSON.stringify(DEFAULT_CRITERIA_STATE[a]));if(!b&&criteriaState.inactive)delete criteriaState.inactive[a]});saveCriteriaState();
  }

  function bindSettings(view){
    const changed=m=>{saveCriteriaState();say(m||'Saved. Applied on the next search.')};
    const rowOf=el=>el.closest('.nb-box,.nb-flag-row');
    const labelOf=x=>(typeof x==='string'?x:x.label).toLowerCase();
    qa('[data-remove]',view).forEach(btn=>btn.onclick=e=>{e.preventDefault();criteriaState[btn.dataset.key].splice(Number(btn.dataset.remove),1);changed();renderNotebook(false)});
    // Plain lists: remove by value from whichever side (checked / unchecked) holds it.
    qa('[data-drop]',view).forEach(btn=>btn.onclick=e=>{e.preventDefault();const k=btn.dataset.key,v=btn.dataset.drop,off=criteriaState.inactive[k]||[];criteriaState[k]=(criteriaState[k]||[]).filter(x=>x!==v);criteriaState.inactive[k]=off.filter(x=>x!==v);changed();renderNotebook(false)});
    qa('[data-active]',view).forEach(input=>input.onchange=()=>{
      const k=input.dataset.key,v=input.dataset.active,on=criteriaState[k]||[],off=criteriaState.inactive[k]||[];
      // Re-checked items return to their default position (order sets the
      // fallback scorer's theme tag); custom items stay at the end.
      const rank=x=>{const i=(DEFAULT_CRITERIA_STATE[k]||[]).indexOf(x);return i<0?Infinity:i};
      if(input.checked){criteriaState.inactive[k]=off.filter(x=>x!==v);if(!on.includes(v))on.push(v);criteriaState[k]=on.map((x,i)=>[x,i]).sort((p,q)=>(rank(p[0])-rank(q[0]))||(p[1]-q[1])).map(p=>p[0])}
      else{criteriaState[k]=on.filter(x=>x!==v);if(!off.includes(v))off.push(v);criteriaState.inactive[k]=off}
      rowOf(input)?.classList.toggle('off',!input.checked);changed(input.checked?'Back on. Applied on the next search.':'Off. The agent stops using it on the next search.');
    });
    qa('[data-toggle]',view).forEach(input=>input.onchange=()=>{criteriaState[input.dataset.key][Number(input.dataset.toggle)].enabled=input.checked;rowOf(input)?.classList.toggle('off',!input.checked);changed(input.checked?'Rule on. Applied on the next search.':'Rule off. It stops on the next search.')});
    qa('[data-rename]',view).forEach(input=>input.onchange=()=>{
      const list=criteriaState[input.dataset.key],i=Number(input.dataset.rename),val=input.value.trim();
      if(!val||list.some((x,j)=>j!==i&&labelOf(x)===val.toLowerCase())){input.value=list[i].label;say(val?'Already in the list.':'A flag needs a name.');return}
      list[i].label=val;changed('Flag renamed. Applied on the next search.');
    });
    qa('[data-add-open]',view).forEach(btn=>btn.onclick=()=>{adding[btn.dataset.addOpen]=true;renderNotebook(false);q(`.nb-add-inline[data-key="${btn.dataset.addOpen}"] input`,q('#criteriaView'))?.focus()});
    qa('[data-add-close]',view).forEach(btn=>btn.onclick=()=>{adding[btn.dataset.addClose]=false;renderNotebook(false)});
    qa('.chip-add',view).forEach(form=>{
      const mode=form.dataset.mode,input=form.querySelector('input[type="text"]');
      const commit=()=>{
        const val=input.value.trim();if(!val)return;
        const key=mode==='funder'?form.querySelector('select').value:form.dataset.key;
        const list=criteriaState[key]||(criteriaState[key]=[]), off=criteriaState.inactive[key]||[];
        if(list.some(x=>labelOf(x)===val.toLowerCase())||off.some(x=>x.toLowerCase()===val.toLowerCase())){say('Already in the list.');return}
        list.push(mode==='item'?{id:key+'-'+Date.now(),label:val,enabled:true}:val);
        adding[form.dataset.key]=false;expanded[key]=true;changed();renderNotebook(false);
      };
      form.querySelector('button:not(.nb-add-cancel)').onclick=commit;form.onsubmit=e=>{e.preventDefault();commit()};
      input.onkeydown=e=>{if(e.key==='Escape'){adding[form.dataset.key]=false;renderNotebook(false)}};
    });
    const min=q('#budgetMinInput',view);if(min)min.onchange=e=>{criteriaState.budget.min=Math.max(0,Number(e.target.value)||0);changed(`Budget flag set below ${fmtUSD(criteriaState.budget.min)}.`)};
    const large=q('#budgetFlagLarge',view);if(large)large.onchange=e=>{criteriaState.budget.flagLarge=e.target.checked;rowOf(e.target)?.classList.toggle('off',!e.target.checked);changed()};
    qa('[data-lang]',view).forEach(input=>input.onchange=()=>{criteriaState.languages[input.dataset.lang]=input.checked;rowOf(input)?.classList.toggle('off',!input.checked);changed()});
    qa('[data-expand]',view).forEach(btn=>btn.onclick=()=>{expanded[btn.dataset.expand]=!expanded[btn.dataset.expand];renderNotebook(false)});
    qa('[data-side]',view).forEach(btn=>btn.onclick=()=>{side=btn.dataset.side;renderNotebook(false)});
  }

  function renderNotebook(animate=true){
    const view=q('#criteriaView'),p=PAGES[criterion]; if(!view)return;
    const total=PAGES.length, n=liveNumbers();
    view.innerHTML=`<header class="notebook-head"><div><p class="eyebrow">SEARCH & DECISION CRITERIA</p><h1>How the opportunity agent works</h1><p>Set what the agent looks for, and see exactly where human judgment begins. Changes save automatically and apply on the next search.</p></div><aside><b>LAST SEARCH</b><strong>${n.scored}</strong><span>ready for review</span><small>${n.excluded} excluded with a traceable reason</small></aside></header>
      <section class="criteria-notebook criteria-v4${animate?'':' animate-in'}"><i class="ring r1"></i><i class="ring r2"></i><i class="ring r3"></i><i class="ring r4"></i>${leftPage(p)}${rightPage(p)}</section>
      <footer class="notebook-footer"><button id="criterionPrev" ${criterion===0?'disabled':''}>← Previous</button><nav>${PAGES.map((x,i)=>`<button data-criterion="${i}" class="${i===criterion?'active':i<criterion?'done':''}"><i>${i<criterion?'✓':i+1}</i><span>${x.nav}</span></button>`).join('')}</nav><button id="criterionNext">${criterion===total-1?'Back to start':'Next →'}</button></footer>`;
    qa('[data-criterion]',view).forEach(b=>b.onclick=()=>{criterion=Number(b.dataset.criterion);renderNotebook()});
    q('#criterionPrev',view).onclick=()=>{if(criterion){criterion--;renderNotebook()}};
    q('#criterionNext',view).onclick=()=>{criterion=criterion<total-1?criterion+1:0;renderNotebook()};
    bindSettings(view);
    const reset=q('#resetCriterion',view);if(reset)reset.onclick=()=>{resetSection(p);renderNotebook(false);say('Reset to Aceso defaults.')};
    if(animate)animateNotebook(view);else qa('[data-count]',view).forEach(el=>el.textContent=el.dataset.count);
  }

  document.addEventListener('aceso:live-search-complete',e=>{
    const d=e.detail||{};lastSearch={sources:d.sources,searchedAt:d.searchedAt};
    if(q('#criteriaView')?.classList.contains('active'))renderNotebook(false);
  });

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
