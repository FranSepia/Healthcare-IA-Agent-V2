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
    ['grantsGov','Grants.gov','U.S. federal grants','Official API'],
    ['worldBank','World Bank','Projects & procurement','Official API'],
    ['coefficientGiving','Coefficient Giving','Philanthropic funding','AI separates RFPs from news'],
    ['unitaid','Unitaid','Global health procurement','Public notices page'],
    ['undp','UNDP','Development procurement','Public notices page'],
    ['ungm','UNGM','UN Global Marketplace','Read with a headless browser']
  ];
  const FUNDER_GROUPS=[['fundersMDB','Development banks'],['fundersPhilanthropic','Foundations'],['fundersGov','Government aid agencies'],['fundersUS','U.S. government']];
  const CHIP_PREVIEW=8;
  let criterion=0, side='agent', lastSearch=null;
  const expanded={};
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v);
  const fmtUSD=n=>n>=1e6?`$${(n/1e6).toFixed(n%1e6?1:0)}M`:`$${Math.round(n/1e3)}K`;

  // ---- left-page controls ---------------------------------------------------
  function chips(key,label,opts={}){
    const arr=criteriaState[key]||[], open=expanded[key]||arr.length<=CHIP_PREVIEW, shown=open?arr:arr.slice(0,CHIP_PREVIEW);
    return `<div class="nb-group${opts.sub?' sub':''}"><div class="nb-group-head"><h4>${label}<span>${arr.length}</span></h4>${opts.tag?`<em class="nb-tag" title="${esc(opts.tagTitle||'')}">${opts.tag}</em>`:''}</div>
      <div class="nb-chips">${shown.map(v=>`<span class="nb-chip">${esc(v)}<button type="button" data-remove="${arr.indexOf(v)}" data-key="${key}" aria-label="Remove ${esc(v)}">×</button></span>`).join('')}${arr.length>CHIP_PREVIEW?`<button type="button" class="nb-more" data-expand="${key}">${open?'Show less':`+${arr.length-CHIP_PREVIEW} more`}</button>`:''}
      <form class="chip-add nb-add-chip" data-key="${key}" data-mode="chip"><input type="text" placeholder="+ Add" aria-label="Add to ${label}" required><button type="button" aria-label="Add">↵</button></form></div>
      ${!arr.length&&opts.empty?`<p class="nb-empty">${opts.empty}</p>`:''}</div>`;
  }
  function ruleList(key,sourceOf){
    const arr=criteriaState[key]||[];
    return `<div class="nb-rules">${arr.map((item,i)=>{const src=sourceOf(item.label);return `<label class="nb-rule ${item.enabled?'':'off'}"><input type="checkbox" data-toggle="${i}" data-key="${key}" ${item.enabled?'checked':''}><i class="nb-switch" aria-hidden="true"></i><span>${esc(item.label)}</span><em class="nb-src ${src}" title="${src==='code'?'Checked in code on every search':'Applied by the AI when it reads the notice'}">${src==='code'?'Code':'AI'}</em><button type="button" data-remove="${i}" data-key="${key}" aria-label="Remove ${esc(item.label)}">×</button></label>`}).join('')}</div>
      <form class="chip-add nb-add-rule" data-key="${key}" data-mode="item"><input type="text" placeholder="Add a rule…" required><button type="button">+ Add</button></form>`;
  }
  const knockoutSource=l=>CODE_KNOCKOUTS.includes(l)?'code':'ai';
  const flagSource=l=>CODE_FLAGS.includes(l)?'code':'ai';
  const aiNote=()=>aiScoring===false?`<p class="nb-warn">AI scoring is off on this server, so only rules marked <b>Code</b> apply right now.</p>`:'';

  function leftFocus(){
    return `${chips('focusAreas','Focus areas',{tag:'AI + fallback',tagTitle:'Used by the AI and by the keyword fallback scorer'})}
      ${chips('activities','Activities Aceso delivers',{tag:'AI',tagTitle:'Used by the AI when it reads the notice'})}`;
  }
  function leftGeo(){
    const l=criteriaState.languages;
    return `${chips('regions','Priority regions',{tag:'Bonus',tagTitle:'Raises the score; never excludes'})}
      <div class="nb-group"><div class="nb-group-head"><h4>Preferred funders<span>${FUNDER_GROUPS.reduce((s,[k])=>s+(criteriaState[k]||[]).length,0)}</span></h4><em class="nb-tag" title="Raises the score; never excludes">Bonus</em></div></div>
      <div class="nb-funders">${FUNDER_GROUPS.map(([k,label])=>chips(k,label,{sub:true,empty:'None yet'})).join('')}</div>`;
  }
  function leftOut(){
    const l=criteriaState.languages, lang=(k,label)=>`<label class="nb-check"><input type="checkbox" data-lang="${k}" ${l[k]?'checked':''}><span>${label}</span></label>`;
    return `${aiNote()}${ruleList('knockouts',knockoutSource)}
      <div class="nb-sep"></div><div class="nb-group-head"><h4>Languages Aceso delivers in</h4><em class="nb-tag">AI</em></div>
      <div class="nb-langs">${lang('english','English')}${lang('spanish','Spanish')}${lang('portuguese','Portuguese')}</div>`;
  }
  function leftFlag(){
    const b=criteriaState.budget,l=criteriaState.languages;
    return `${aiNote()}<div class="nb-budget">
        <label class="nb-field"><span>Flag budgets below (USD)</span><input type="number" id="budgetMinInput" value="${b.min}" step="10000" min="0"></label>
        <div class="nb-fixed"><span>Tight deadline</span><b>Under 14 days</b><small>Fixed rule</small></div>
      </div>
      <label class="nb-rule nb-toggle-row ${b.flagLarge?'':'off'}"><input type="checkbox" id="budgetFlagLarge" ${b.flagLarge?'checked':''}><i class="nb-switch" aria-hidden="true"></i><span>Also flag budgets of $5M or more (capacity check)</span><em class="nb-src code">Code</em></label>
      <label class="nb-rule nb-toggle-row ${l.frenchReview?'':'off'}"><input type="checkbox" data-lang="frenchReview" ${l.frenchReview?'checked':''}><i class="nb-switch" aria-hidden="true"></i><span>Send French notices to human review</span><em class="nb-src ai">AI</em></label>
      <div class="nb-sep"></div><div class="nb-group-head"><h4>Review flags<span>${(criteriaState.reviewFlags||[]).filter(x=>x.enabled).length} on</span></h4></div>
      ${ruleList('reviewFlags',flagSource)}`;
  }
  function leftSources(){
    const src=lastSearch&&lastSearch.sources, when=lastSearch&&lastSearch.searchedAt?new Date(lastSearch.searchedAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):null;
    return `<div class="nb-sources">${SOURCES.map(([k,name,what,how],i)=>{const d=src&&src[k];const state=!d?'idle':d.ok?'ok':'down';return `<div class="nb-source ${state}" style="--i:${i}" title="${esc(how)}"><span class="src-dot"></span><b>${name}</b><small>${what}</small><strong>${d?(d.ok?`<em data-count="${d.count}">0</em> notices`:'Unavailable'):'—'}</strong></div>`}).join('')}</div>
      <p class="nb-caption">${when?`Counts from the search of ${when}.`:'Counts appear after the next search.'} Sources are fixed; API keys live on the server.</p>
      <div class="nb-sep"></div><div class="nb-group-head"><h4>Monitoring rules</h4><em class="nb-tag">Fixed</em></div>
      <ul class="nb-facts"><li><b>On demand</b>A search runs only when someone presses Search now.</li><li><b>Closed notices</b>Dropped before scoring; they never appear.</li><li><b>Duplicates</b>Merged across sources.</li><li><b>No date, or no year</b>Kept, shown exactly as published.</li><li><b>Every search is saved</b>Results survive a reload.</li></ul>`;
  }

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
    p.reset.forEach(k=>{const [a,b]=k.split('.');if(b)criteriaState[a][b]=DEFAULT_CRITERIA_STATE[a][b];else criteriaState[a]=JSON.parse(JSON.stringify(DEFAULT_CRITERIA_STATE[a]))});saveCriteriaState();
  }

  function bindSettings(view){
    const changed=m=>{saveCriteriaState();say(m||'Saved. Applied on the next search.')};
    qa('[data-remove]',view).forEach(btn=>btn.onclick=e=>{e.preventDefault();criteriaState[btn.dataset.key].splice(Number(btn.dataset.remove),1);changed();renderNotebook(false)});
    qa('[data-toggle]',view).forEach(input=>input.onchange=()=>{criteriaState[input.dataset.key][Number(input.dataset.toggle)].enabled=input.checked;input.closest('.nb-rule')?.classList.toggle('off',!input.checked);changed(input.checked?'Rule on. Applied on the next search.':'Rule off. It stops on the next search.')});
    qa('.chip-add',view).forEach(form=>{
      const key=form.dataset.key,mode=form.dataset.mode,input=form.querySelector('input');
      const commit=()=>{const val=input.value.trim();if(!val)return;const list=criteriaState[key]||(criteriaState[key]=[]);const exists=list.some(x=>(typeof x==='string'?x:x.label).toLowerCase()===val.toLowerCase());if(exists){say('Already in the list.');return}list.push(mode==='chip'?val:{id:key+'-'+Date.now(),label:val,enabled:true});if(mode==='chip')expanded[key]=true;changed();renderNotebook(false)};
      form.querySelector('button').onclick=commit;form.onsubmit=e=>{e.preventDefault();commit()};
    });
    const min=q('#budgetMinInput',view);if(min)min.onchange=e=>{criteriaState.budget.min=Math.max(0,Number(e.target.value)||0);changed(`Budget flag set below ${fmtUSD(criteriaState.budget.min)}.`)};
    const large=q('#budgetFlagLarge',view);if(large)large.onchange=e=>{criteriaState.budget.flagLarge=e.target.checked;e.target.closest('.nb-rule')?.classList.toggle('off',!e.target.checked);changed()};
    qa('[data-lang]',view).forEach(input=>input.onchange=()=>{criteriaState.languages[input.dataset.lang]=input.checked;input.closest('.nb-rule')?.classList.toggle('off',!input.checked);changed()});
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
