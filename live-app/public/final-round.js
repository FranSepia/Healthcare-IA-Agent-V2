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

  const SECTIONS=[
    {key:'How it decides',type:'flow'},
    {key:'What we look for',type:'lists',groups:[['focusAreas','Focus areas'],['activities','Activities Aceso delivers']],
      title:'What makes an opportunity a fit?',
      purpose:'The topics and kinds of work Aceso delivers. The AI reads the whole notice, not just the title, and scores how well it matches these lists.',
      uses:[['Reads the full notice','Objectives, deliverables and eligibility, not the title alone.'],['Scores the match','A core match scores high, adjacent work scores medium, anything outside these lists scores low.'],['Tags the main theme','The best-matching focus area becomes the theme tag shown on each opportunity.']],
      example:'A tender mentions “health systems” but only buys equipment. The topic matches, the activity doesn’t, so it is excluded as goods procurement.'},
    {key:'Where & who',type:'lists',groups:[['regions','Priority regions'],['fundersMDB','Development banks'],['fundersPhilanthropic','Foundations'],['fundersGov','Government aid agencies'],['fundersUS','U.S. government']],
      title:'Where and with whom does Aceso want to work?',
      purpose:'Priority regions and preferred funders raise the score. They are a bonus, never a requirement.',
      uses:[['Finds the country and funder','Read directly from the notice.'],['Adds a bonus on a match','A listed region or funder pushes the fit score up.'],['Never excludes on its own','Places and funders not on these lists are still scored normally.']],
      example:'A World Bank notice in Indonesia gets both bonuses. A strong CDC notice in Kenya is still scored normally, just without the regional bonus.'},
    {key:'Exclude or flag',type:'rules'},
    {key:'Sources & timing',type:'info'}
  ];
  const SOURCES=[
    ['grantsGov','Grants.gov','Official Grants.gov API'],
    ['worldBank','World Bank','World Bank procurement API'],
    ['coefficientGiving','Coefficient Giving','Public funding page · AI separates real RFPs from news'],
    ['unitaid','Unitaid','Public consultancies & RFPs page'],
    ['undp','UNDP','Public procurement notices page'],
    ['ungm','UNGM','UN Global Marketplace · read with a headless browser']
  ];
  let criterion=0, lastSearch=null;
  const esc=v=>typeof escapeHtml==='function'?escapeHtml(v):String(v);

  function chipTag(key,i,v){return `<span class="chip"><span>${esc(v)}</span><button type="button" data-remove="${i}" data-key="${key}" aria-label="Remove ${esc(v)}">×</button></span>`}
  function addForm(key,mode,placeholder){return `<form class="chip-add" data-key="${key}" data-mode="${mode}"><input type="text" placeholder="${esc(placeholder)}" required><button type="button">+ Add</button></form>`}
  function chipGroup(key,label){const arr=criteriaState[key]||[];return `<div class="chip-group"><h4>${label} <span>${arr.length}</span></h4><div class="chip-list">${arr.map((v,i)=>chipTag(key,i,v)).join('')}<form class="chip-add chip-add-inline" data-key="${key}" data-mode="chip"><input type="text" placeholder="+ Add" aria-label="Add to ${label}" required><button type="button" aria-label="Add">↵</button></form></div></div>`}
  function checklist(key){const arr=criteriaState[key]||[];return `<div class="checklist-list compact">${arr.map((item,i)=>`<label class="checklist-item ${item.enabled?'':'off'}"><input type="checkbox" data-toggle="${i}" data-key="${key}" ${item.enabled?'checked':''}><span>${esc(item.label)}</span><button type="button" data-remove="${i}" data-key="${key}" aria-label="Remove">×</button></label>`).join('')}</div>${addForm(key,'item','Add a rule…')}`}
  const fmtUSD=n=>n>=1e6?`$${(n/1e6).toFixed(n%1e6?1:0)}M`:`$${Math.round(n/1e3)}K`;

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

  function flowPages(){
    const n=liveNumbers(), max=Math.max(1,n.found), pct=v=>Math.round(v/max*100);
    const bar=(label,v,note,cls)=>`<div class="flow-bar ${cls}"><div class="flow-bar-label"><b data-count="${v}">0</b><span>${label}<small>${note}</small></span></div><i><u style="--w:${pct(v)}%"></u></i></div>`;
    const reasonMax=Math.max(1,...n.reasons.map(r=>r[1]));
    const steps=[['⇣','Collect','Open notices from Grants.gov, World Bank, Coefficient Giving, Unitaid, UNDP and UNGM.'],['⌫','Clean up','Notices whose deadline already passed are dropped; duplicates are merged.'],['✕','Knock-outs','Excluded only when a rule clearly applies. When in doubt, the notice stays.',3],['◎','Score 0–100','The AI compares the full notice with your lists: topic, activity, region, funder, budget, eligibility.',1],['△','Flag','Review flags like a tight deadline or an unpublished budget. A flag never excludes.',3],['✓','You decide','A person approves, rejects or recovers any case. The agent only recommends.']];
    return `<article class="notebook-page flow-page"><p class="page-count">01 <span>/ 0${SECTIONS.length}</span></p><h2>How every opportunity is decided</h2><p>Every notice goes through the same route, and nothing disappears silently: each exclusion keeps its reason.</p>
      ${n.found?'':'<p class="flow-empty">Run a search to see the last search’s numbers here.</p>'}
      <h3>Last search, step by step</h3>
      <div class="flow-bars">${bar('Collected',n.found,'from 6 public sources','fb-all')}${bar('Excluded by a rule',n.excluded,'kept with the exact reason','fb-out')}${bar('Scored by AI',n.scored,'fit score 0–100','fb-in')}</div>
      <div class="flow-tiers"><span class="t-rec"><b data-count="${n.recommended}">0</b>Recommended<small>85+</small></span><span class="t-dec"><b data-count="${n.decision}">0</b>Decision needed<small>65–84</small></span><span class="t-low"><b data-count="${n.low}">0</b>Low fit<small>under 65</small></span></div>
      ${n.reasons.length?`<h3>Why notices were excluded</h3><div class="flow-reasons">${n.reasons.map(([r,c])=>`<div><span>${esc(r)}</span><i><u style="--w:${Math.round(c/reasonMax*100)}%"></u></i><b>${c}</b></div>`).join('')}</div>`:''}
    </article>
    <article class="notebook-page flow-steps-page"><p class="eyebrow">THE AGENT’S ROUTE</p><h2>Six steps, one human decision</h2>
      <ol class="flow-steps">${steps.map((s,i)=>`<li style="--i:${i}"${s[3]?` data-go="${s[3]}" title="See the rules"`:''}><i>${s[0]}</i><span><b>${s[1]}</b><p>${s[2]}</p></span>${s[3]?'<em>Edit →</em>':''}</li>`).join('')}</ol>
      <aside class="worked-example"><small>GOOD TO KNOW</small><p>Every excluded notice can be reviewed and recovered from Opportunities › Discarded.${n.flagged?` In the last search, ${n.flagged} scored opportunities carry at least one review flag.`:''}</p></aside>
    </article>`;
  }

  function listPages(s){
    return `<article class="notebook-page settings-page"><p class="page-count">0${criterion+1} <span>/ 0${SECTIONS.length}</span></p><h2>${s.title}</h2><p>${s.purpose}</p><div class="settings-heading"><h3>Your lists</h3><button type="button" id="resetCriterion" class="reset-link">↺ Reset to Aceso defaults</button></div><div class="chip-groups">${s.groups.map(([k,l])=>chipGroup(k,l)).join('')}</div></article>
    <article class="notebook-page playbook-page"><p class="eyebrow">HOW THE AGENT USES THIS</p><h2>In plain words</h2><div class="notebook-actions">${s.uses.map((x,i)=>`<div><i>${i+1}</i><span><b>${x[0]}</b><p>${x[1]}</p></span></div>`).join('')}</div><aside class="worked-example"><small>EXAMPLE</small><p>${s.example}</p></aside></article>`;
  }

  function rulesPages(){
    const b=criteriaState.budget,l=criteriaState.languages;
    const lang=(k,label)=>`<label><input type="checkbox" data-lang="${k}" ${l[k]?'checked':''}><span>${label}</span></label>`;
    return `<article class="notebook-page settings-page rules-out"><p class="page-count">04 <span>/ 0${SECTIONS.length}</span></p><div class="settings-heading"><h2><i class="rule-dot out">✕</i>Excluded outright</h2><button type="button" id="resetCriterion" class="reset-link">↺ Reset to Aceso defaults</button></div><p>Checked first. A notice is excluded only when a rule clearly applies, and the rule is saved with it. Switch a rule off and it stops being applied on the next search.</p>
      ${checklist('knockouts')}
      <h3>Languages Aceso delivers in</h3><div class="language-editor inline">${lang('english','English')}${lang('spanish','Spanish')}${lang('portuguese','Portuguese')}</div><p class="rules-hint">Any other language usually scores as low fit.</p></article>
    <article class="notebook-page rules-flag"><p class="eyebrow">NEVER EXCLUDES</p><h2><i class="rule-dot flag">△</i>Kept, but flagged</h2><p>A flag travels with the opportunity so the reviewer knows what to check. An opportunity can carry several.</p>
      <h3>Budget</h3><div class="budget-editor"><label class="budget-min"><span>Flag budgets below (USD)</span><input type="number" id="budgetMinInput" value="${b.min}" step="10000" min="0"></label><label class="budget-flag"><input type="checkbox" id="budgetFlagLarge" ${b.flagLarge?'checked':''}><span>Also flag budgets of $5M or more, to check delivery capacity</span></label></div>
      <label class="budget-flag french-flag"><input type="checkbox" data-lang="frenchReview" ${l.frenchReview?'checked':''}><span>French notices go to human review instead of being scored as low fit</span></label>
      <h3>Other flags</h3>${checklist('reviewFlags')}</article>`;
  }

  function infoPages(){
    const src=lastSearch&&lastSearch.sources, when=lastSearch&&lastSearch.searchedAt?new Date(lastSearch.searchedAt).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'}):null;
    return `<article class="notebook-page info-page"><p class="page-count">05 <span>/ 0${SECTIONS.length}</span></p><h2>Where opportunities come from</h2><p>Six free public sources, searched only when you press Search now.${when?` Numbers from the search of ${when}.`:''}</p>
      <div class="source-grid">${SOURCES.map(([k,name,how],i)=>{const d=src&&src[k];const state=!d?'idle':d.ok?'ok':'down';return `<div class="source-card ${state}" style="--i:${i}"><span class="src-dot"></span><b>${name}</b><small>${how}</small><strong>${d?(d.ok?`<em data-count="${d.count}">0</em> notices`:'Unavailable'):'Not searched yet'}</strong></div>`}).join('')}</div>
      <p class="rules-hint">No credentials are stored in this interface. API keys live on the server.</p></article>
    <article class="notebook-page timing-page"><p class="eyebrow">TIMING</p><h2>How deadlines are handled</h2>
      <div class="deadline-track"><span class="dz past"><b>Passed</b><small>dropped</small></span><span class="dz soon"><b>Due soon</b><small>flagged</small></span><span class="dz ok"><b>Later</b><small>normal</small></span><i class="today-marker"><small>Today</small></i></div>
      <div class="notebook-actions">
        <div><i>1</i><span><b>Deadline already passed</b><p>Dropped before scoring. It never appears, not even in Discarded.</p></span></div>
        <div><i>2</i><span><b>Due within about two weeks</b><p>Kept and scored, with a “Tight submission deadline” flag.</p></span></div>
        <div><i>3</i><span><b>No date, or a date without a year</b><p>Kept, and shown exactly as published so a person can verify it.</p></span></div>
        <div><i>4</i><span><b>Every search is saved</b><p>Results survive a reload. A new search runs only when you ask for it.</p></span></div>
      </div></article>`;
  }

  function animateNotebook(view){
    const reduce=window.matchMedia&&matchMedia('(prefers-reduced-motion: reduce)').matches;
    qa('[data-count]',view).forEach(el=>{const target=Number(el.dataset.count)||0;if(reduce||!target){el.textContent=target;return}const t0=performance.now();const tick=t=>{const p=Math.min(1,(t-t0)/700);el.textContent=Math.round(target*(1-Math.pow(1-p,3)));if(p<1)requestAnimationFrame(tick)};requestAnimationFrame(tick)});
    requestAnimationFrame(()=>requestAnimationFrame(()=>view.querySelector('.criteria-notebook')?.classList.add('animate-in')));
  }

  function resetSection(s){
    const keys=s.type==='lists'?s.groups.map(g=>g[0]):s.type==='rules'?['knockouts','reviewFlags','budget','languages']:[];
    keys.forEach(k=>{criteriaState[k]=JSON.parse(JSON.stringify(DEFAULT_CRITERIA_STATE[k]))});saveCriteriaState();
  }

  function bindSettings(view){
    const changed=m=>{saveCriteriaState();say(m||'Saved. Applied on the next search.')};
    qa('[data-remove]',view).forEach(btn=>btn.onclick=()=>{criteriaState[btn.dataset.key].splice(Number(btn.dataset.remove),1);changed();renderNotebook(false)});
    qa('[data-toggle]',view).forEach(input=>input.onchange=()=>{criteriaState[input.dataset.key][Number(input.dataset.toggle)].enabled=input.checked;input.closest('.checklist-item')?.classList.toggle('off',!input.checked);changed()});
    qa('.chip-add',view).forEach(form=>{
      const key=form.dataset.key,mode=form.dataset.mode,input=form.querySelector('input');
      const commit=()=>{const val=input.value.trim();if(!val)return;const list=criteriaState[key]||(criteriaState[key]=[]);const exists=list.some(x=>(typeof x==='string'?x:x.label).toLowerCase()===val.toLowerCase());if(exists){say('Already in the list.');return}list.push(mode==='chip'?val:{id:key+'-'+Date.now(),label:val,enabled:true});changed();renderNotebook(false)};
      form.querySelector('button').onclick=commit;form.onsubmit=e=>{e.preventDefault();commit()};
    });
    const min=q('#budgetMinInput',view);if(min)min.onchange=e=>{criteriaState.budget.min=Math.max(0,Number(e.target.value)||0);changed(`Budget flag set below ${fmtUSD(criteriaState.budget.min)}.`)};
    const large=q('#budgetFlagLarge',view);if(large)large.onchange=e=>{criteriaState.budget.flagLarge=e.target.checked;changed()};
    qa('[data-lang]',view).forEach(input=>input.onchange=()=>{criteriaState.languages[input.dataset.lang]=input.checked;changed()});
    qa('[data-go]',view).forEach(li=>li.onclick=()=>{criterion=Number(li.dataset.go);renderNotebook()});
  }

  function renderNotebook(animate=true){
    const view=q('#criteriaView'),s=SECTIONS[criterion]; if(!view)return;
    const total=SECTIONS.length, n=liveNumbers();
    const pages=s.type==='flow'?flowPages():s.type==='lists'?listPages(s):s.type==='rules'?rulesPages():infoPages();
    view.innerHTML=`<header class="notebook-head"><div><p class="eyebrow">SEARCH & DECISION CRITERIA</p><h1>How the opportunity agent decides</h1><p>Five pages: how a decision is made, what Aceso looks for, and what gets excluded or flagged. Every edit is saved and applied on the next search.</p></div><aside><b>LAST SEARCH</b><strong>${n.scored}</strong><span>ready for review</span><small>${n.excluded} excluded with a traceable reason</small></aside></header>
      <section class="criteria-notebook criteria-v3 type-${s.type}${animate?'':' animate-in'}"><i class="ring r1"></i><i class="ring r2"></i><i class="ring r3"></i><i class="ring r4"></i>${pages}</section>
      <footer class="notebook-footer"><button id="criterionPrev" ${criterion===0?'disabled':''}>← Previous</button><nav>${SECTIONS.map((x,i)=>`<button data-criterion="${i}" class="${i===criterion?'active':i<criterion?'done':''}"><i>${i+1}</i><span>${x.key}</span></button>`).join('')}</nav><button id="criterionNext">${criterion===total-1?'Back to start':'Next →'}</button></footer>`;
    qa('[data-criterion]',view).forEach(b=>b.onclick=()=>{criterion=Number(b.dataset.criterion);renderNotebook()});
    q('#criterionPrev',view).onclick=()=>{if(criterion){criterion--;renderNotebook()}};
    q('#criterionNext',view).onclick=()=>{criterion=criterion<total-1?criterion+1:0;renderNotebook()};
    bindSettings(view);
    const reset=q('#resetCriterion',view);if(reset)reset.onclick=()=>{resetSection(s);renderNotebook(false);say('Reset to Aceso defaults.')};
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
