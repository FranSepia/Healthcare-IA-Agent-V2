(() => {
  const qs=(s,r=document)=>r.querySelector(s), qsa=(s,r=document)=>[...r.querySelectorAll(s)];
  const opps=window.opportunities || (typeof opportunities!=='undefined'?opportunities:[]);
  let active=opps[0]||{};

  function showToast(message){ if(typeof toast==='function') toast(message); }
  function showPage(name){ if(typeof showView==='function') showView(name); }

  function opportunityRow(o){
    return `<button class="unified-opp-row ${o.id===active.id?'selected':''}" data-opportunity="${o.id}">
      <span class="unified-check" role="checkbox" aria-checked="false"></span>
      <span class="unified-fit ${o.score<85?'mid':''}"><b>${o.score}</b><small>%</small></span>
      <span class="unified-name"><small>${escapeHtml(o.type)} · ${escapeHtml(o.org)} · ${escapeHtml(o.country)} ${typeof dupBadge==='function'?dupBadge(o):''}</small><strong>${escapeHtml(o.title)}</strong><em>${sourceTag(o)}${rfpStatusTag(o)}${typeof alertFlagTag==='function'?alertFlagTag(o):''}<i>${escapeHtml(o.pillar)}</i><i class="green">${escapeHtml(o.status)}</i></em></span>
      <span class="unified-value"><b>${escapeHtml(o.value)}</b><small>▣ &nbsp;${escapeHtml(o.due)}</small></span>
      <span class="unified-status"><i>✓</i><small>${escapeHtml(o.state)}</small></span><span class="unified-arrow">›</span>
    </button>`;
  }

  function quickView(o){
    return `<aside class="unified-quick"><header><p class="eyebrow">QUICK VIEW</p><span class="unified-fit"><b>${o.score}</b><small>% FIT</small></span></header>
      <h2>${escapeHtml(o.title)}</h2><div class="tags" style="margin:2px 0 8px">${sourceTag(o)}${rfpStatusTag(o)}</div><p>Strong alignment with Aceso’s strategy, validated experience and delivery model.</p>
      <dl><div><dt>Funder</dt><dd>${escapeHtml(o.org)}</dd></div><div><dt>Country</dt><dd>${escapeHtml(o.country)}</dd></div><div><dt>Deadline</dt><dd>${escapeHtml(o.due)}</dd></div><div><dt>Value</dt><dd>${escapeHtml(o.value)}</dd></div></dl>
      <section><b>Why it matters</b><p>Directly relevant to Aceso’s health-financing portfolio and supported by reusable evidence.</p></section>
      <button class="unified-open-record">Open full opportunity record&nbsp;&nbsp;→</button></aside>`;
  }

  function renderUnifiedOpportunities(){
    const view=qs('#opportunitiesView'); if(!view) return;
    const activeOpps=typeof isWatchlist==='function'?opps.filter(o=>!isWatchlist(o)):opps;
    if(!activeOpps.some(o=>o.id===active.id)) active=activeOpps[0]||opps[0]||{};
    const watchHTML=typeof watchlistHTML==='function'?watchlistHTML():'';
    view.innerHTML=`<section class="opportunities-master-head"><p class="eyebrow">OPPORTUNITIES</p><h1>Every qualified opportunity, in one place.</h1><p>Compare fit, source evidence and review status without losing the broader pipeline context.</p></section>
      <nav class="opportunities-tabs"><button class="active" data-u-tab="all">All opportunities <b>${activeOpps.length}</b></button><button data-u-tab="discarded">Discarded <b>${(typeof discarded!=='undefined'?discarded:[]).length}</b></button><button data-u-tab="history">History</button></nav>
      <section class="unified-opportunities-layout"><main><div class="unified-list-head"><b>${activeOpps.length} opportunities · ranked by fit</b><span>VALUE / DEADLINE&nbsp;&nbsp;&nbsp;&nbsp; REVIEW STATUS</span></div><div class="unified-list">${activeOpps.map(opportunityRow).join('')}</div>${watchHTML}</main><div id="unifiedQuick">${quickView(active)}</div></section>`;
    bindUnifiedOpportunityEvents();
    if(typeof bindWatchlist==='function') bindWatchlist(view);
    qsa('[data-u-tab]',view).forEach(b=>b.onclick=()=>{ if(b.dataset.uTab==='all') renderUnifiedOpportunities(); else if(typeof renderOppTab==='function') { view.innerHTML=`<section class="opportunities-master-head"><p class="eyebrow">OPPORTUNITIES</p><h1>${b.dataset.uTab==='discarded'?'Discarded opportunities':'Opportunity history'}</h1></section><div class="subnav"><button data-opp-tab="all">All opportunities</button><button data-opp-tab="discarded">Discarded</button><button data-opp-tab="history">History</button></div><div id="opportunityTabContent"></div>`; renderOppTab(b.dataset.uTab); qsa('[data-opp-tab]',view).forEach(x=>x.onclick=()=>x.dataset.oppTab==='all'?renderUnifiedOpportunities():renderOppTab(x.dataset.oppTab)); }});
  }
  function bindUnifiedOpportunityEvents(){
    qsa('.unified-opp-row').forEach(row=>row.onclick=e=>{const o=opps.find(x=>x.id===Number(row.dataset.opportunity)); if(!o)return; if(e.target.closest('.unified-check')){e.target.closest('.unified-check').classList.toggle('checked'); return;} active=o; qsa('.unified-opp-row').forEach(x=>x.classList.toggle('selected',x===row)); qs('#unifiedQuick').innerHTML=quickView(o); qs('.unified-open-record').onclick=()=>window.openDetail(o);});
    const open=qs('.unified-open-record'); if(open) open.onclick=()=>window.openDetail(active);
  }

  // Eligibility rows come from what the agent extracted at screening time —
  // no extra AI call. Status is a plain reading of that text, for a person to confirm.
  function acceptedLanguages(){
    try{const st=JSON.parse(localStorage.getItem('aceso_criteria_state_v2')||'null');const l=(st&&st.languages)||{english:true,spanish:true,portuguese:true};return ['english','spanish','portuguese'].filter(k=>l[k]!==false)}catch(e){return ['english','spanish','portuguese']}
  }
  function daysUntil(text){const t=Date.parse(text||'');if(Number.isNaN(t))return null;return Math.ceil((t-Date.now())/864e5)}
  function eligibilityTable(o){
    const m=o.meta||{},flags=m.reviewFlags||[],el=m.eligibility||'',lang=(m.language||'').trim(),days=daysUntil(o.due);
    const restricted=/(national|local|domestic)\s+(firms?|companies|organi[sz]ations?|entities)|registered in|incorporat|individual consultant|only .{0,30}(nationals|citizens)/i.test(el);
    const rows=[
      ['Contract type',m.orgType||'Not stated',!m.orgType?'unknown':/consult|firm|organi[sz]ation|ngo|any|compan/i.test(m.orgType)?'verified':'pending'],
      ['International firms',!el?'Not stated':restricted||flags.includes('Unclear eligibility')?'Restriction or doubt in the notice':'No restriction stated',!el?'unknown':restricted||flags.includes('Unclear eligibility')?'pending':'verified'],
      ['Submission language',lang||'Not stated',!lang?'unknown':acceptedLanguages().includes(lang.toLowerCase())?'verified':'pending'],
      ['Required qualifications',m.qualifications||'Not stated',!m.qualifications||/not specified/i.test(m.qualifications)?'unknown':'pending'],
      ['Location & travel',m.location||o.country||'Not stated',flags.includes('Travel required')?'pending':'verified'],
      ['TOR / RFP',m.rfpAvailable===false||flags.includes('Missing or incomplete TOR/RFP')?'Not yet published or incomplete':'Available',m.rfpAvailable===false||flags.includes('Missing or incomplete TOR/RFP')?'pending':'verified'],
      ['Submission deadline',o.due||'Not stated',days==null?'unknown':days<14?'pending':'verified']
    ];
    const label={verified:'✓ Verified',pending:'◷ Confirm',unknown:'— Not stated'};
    return `<div class="elig-table"><header><span>Requirement</span><span>What the notice says</span><span>Status</span></header>${rows.map(r=>`<div><b>${r[0]}</b><span>${escapeHtml(r[1])}</span><em class="elig-${r[2]}">${label[r[2]]}</em></div>`).join('')}</div><p class="roi-caption">Read from the notice at screening time. “Confirm” means a person should check it against the full TOR.</p>`;
  }
  function sourceRecord(o){
    const m=o.meta||{},fmt=v=>{const t=Date.parse(v||'');return Number.isNaN(t)?(v||'—'):new Date(t).toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'})};
    const doc=(kind,title,sub,href)=>`<${href?`a href="${escapeHtml(href)}" target="_blank" rel="noopener"`:'div'} class="doc-tile"><i>${kind}</i><span><b>${escapeHtml(title)}</b><small>${escapeHtml(sub)}</small></span></${href?'a':'div'}>`;
    const tiles=[
      doc('↗','Original publication',o.source||'Source',o.sourceUrl),
      doc('TOR','Terms of reference',m.rfpAvailable===false?'Not yet published':'On the source page',m.rfpAvailable===false?null:o.sourceUrl),
      doc('ID','Source record',m.sourceOpportunityId||'No ID published',null),
      doc('◷','Detection history',`First ${fmt(m.firstDetected)} · last ${fmt(m.lastDetected)}`,null)
    ].join('');
    const merged=(m.mergedSources&&m.mergedSources.length)?`<div class="tags" style="margin-top:10px">${m.mergedSources.map(x=>`<span class="tag">${escapeHtml(x.source)} · ${escapeHtml(x.detectedAt)}</span>`).join('')}</div><p class="roi-caption">A single primary record is kept; the official link and earliest detection time are preserved across sources.</p>`:`<p class="roi-caption">Duplicate status: ${escapeHtml(m.dupStatus||'New')} · detected by a single source so far.</p>`;
    return `<div class="doc-tiles">${tiles}</div>${merged}`;
  }

  // Chapters 01 and 02 open folded: one line that sums up the whole chapter,
  // and "Show details" for the explanation, bars, flags and requirement table.
  function foldChapter(chapter,summary){
    const h2=qs('h2',chapter); if(!h2)return;
    const body=document.createElement('div'); body.className='chapter-body';
    while(h2.nextSibling) body.appendChild(h2.nextSibling);
    chapter.classList.add('collapsible');
    h2.insertAdjacentHTML('afterend',`<div class="chapter-summary"><p>${summary}</p><button type="button" class="chapter-toggle" aria-expanded="false"><span>Show details</span><i aria-hidden="true">⌄</i></button></div>`);
    chapter.appendChild(body);
    const btn=qs('.chapter-toggle',chapter);
    btn.onclick=()=>{const open=chapter.classList.toggle('open');btn.setAttribute('aria-expanded',String(open));qs('span',btn).textContent=open?'Hide details':'Show details';};
  }
  function foldRecordChapters(root,o,fitTier){
    const [assessment,eligibility]=qsa('.record-chapter',root);
    const m=o.meta||{},flags=m.reviewFlags||[];
    if(assessment){
      const tier=fitTier.startsWith('Strong')?'Strong fit':fitTier.startsWith('Low')?'Low fit':'Potential fit';
      const checks=qsa('.assessment-alerts>span',assessment).length;
      const parts=[...flags.map(escapeHtml)];
      if(checks)parts.push(`${checks} point${checks===1?'':'s'} to confirm before pursuing`);
      foldChapter(assessment,`<b>${tier} · ${o.score}%.</b> ${parts.join(' · ')}${parts.length?'.':''}`);
    }
    if(eligibility){
      const rows=qsa('.elig-table>div',eligibility).map(r=>({name:qs('b',r).textContent,status:(qs('em',r).className.match(/elig-(\w+)/)||[])[1]}));
      const verified=rows.filter(r=>r.status==='verified').length;
      const confirm=rows.filter(r=>r.status==='pending').map(r=>r.name);
      const missing=rows.filter(r=>r.status==='unknown').length;
      const parts=[];
      if(confirm.length)parts.push(`To confirm: ${escapeHtml(confirm.join(', '))}`);
      if(missing)parts.push(`${missing} not stated in the notice`);
      foldChapter(eligibility,`<b>${verified} of ${rows.length} requirements verified.</b> ${parts.join(' · ')}${parts.length?'.':''}`);
    }
  }

  function showOpportunityRecord(o={}){
    active=o; if(typeof closeDrawer==='function') closeDrawer(); showPage('detail');
    const root=qs('#detailContent'); if(!root)return;
    const context=o.meta&&o.meta.objective?{region:o.meta.location||o.country,summary:o.meta.objective}:{region:o.country||'Global',summary:'No summary available for this opportunity yet.'};
    const m=o.meta||{};
    const fitTier=m.fitTier||(o.score>=85?'Strong Fit':o.score>=65?'Potential Fit — Human Review Required':'Low Fit');
    const fitTierCls=fitTier.startsWith('Strong')?'rfp-open':fitTier.startsWith('Low')?'rfp-closed':'rfp-potential';
    const fitTierShort=fitTier.startsWith('Strong')?'Strong Fit':fitTier.startsWith('Low')?'Low Fit':'Human Review';
    const factors=[['Thematic alignment',Math.min(98,o.score+4)],['Activity alignment',Math.min(96,o.score+1)],['Regional alignment',Math.max(55,o.score-8)],['Funder alignment',Math.min(94,o.score+2)],['Budget alignment',Math.max(60,o.score-10)],['Eligibility',Math.max(60,o.score-9)],['Language',m.language==='French'?55:Math.max(80,o.score-3)],['Operational feasibility',Math.max(58,o.score-14)],['Deadline feasibility',Math.max(62,o.score-11)],['Risk indicators',Math.max(50,100-o.score)]];
    root.innerHTML=`<section class="complete-record">
      <header class="complete-record-hero"><div class="record-origin" data-country="${escapeHtml(o.country)}"><span>${escapeHtml(o.type)} · ${escapeHtml(o.org)} &nbsp;|&nbsp; ${escapeHtml(o.country)} · ${escapeHtml(context.region)}</span><div class="tags" style="margin:8px 0 0">${sourceTag(o)}${rfpStatusTag(o)}<span class="tag rfp-status ${fitTierCls}">${escapeHtml(fitTier)}</span></div><h1>${escapeHtml(o.title)}</h1><p>${escapeHtml(context.summary)}</p><a class="source-link" ${sourceHrefAttrs(o)}>↗ &nbsp; View original publication</a></div><div class="record-hero-decision" data-country="${escapeHtml(o.country)}"><span class="country-signal"><i></i>${escapeHtml(o.country)}<small>${escapeHtml(context.region)}</small></span><span class="hero-score" style="--fit:${o.score}%"><i aria-hidden="true"></i><span><b>${o.score}%</b><small>FIT</small></span></span><em>${escapeHtml(fitTierShort)}</em><dl><div><dt>Value</dt><dd>${escapeHtml(o.value)}</dd></div><div><dt>Deadline</dt><dd>${escapeHtml(o.due)}</dd></div><div><dt>Type</dt><dd>${escapeHtml(o.type)}</dd></div><div><dt>Pillar</dt><dd>${escapeHtml(o.pillar)}</dd></div></dl><button data-approve>Approve to pursue&nbsp;&nbsp;→</button></div></header>
      <div class="complete-record-grid"><main>
        <article class="record-chapter"><p class="eyebrow">01 · AGENT ASSESSMENT</p><h2>Why this opportunity deserves human review</h2><p>${escapeHtml(m.explanation||`It aligns with Aceso’s ${o.pillar} experience, meets the configured fit threshold and has a viable advisory scope. Country-specific eligibility and delivery capacity still require human validation.`)}</p><div class="assessment-bars">${factors.map(x=>`<div><span>${x[0]}</span><i><b style="width:${x[1]}%"></b></i><strong>${x[1]}%</strong></div>`).join('')}</div>${(m.reviewFlags&&m.reviewFlags.length)?`<div class="tags" style="margin:10px 0 0">${m.reviewFlags.map(f=>`<span class="tag status" style="background:var(--orangebg);color:var(--orange)">${escapeHtml(f)}</span>`).join('')}${m.mnchException?'<span class="tag rfp-status rfp-info">MNCH · contradictory criteria</span>':''}</div>`:''}<div class="assessment-alerts">${m.exclusions&&m.exclusions.length?m.exclusions.map(x=>`<span>△ ${escapeHtml(x)}</span>`).join(''):`<span>△ Confirm participation requirements in ${escapeHtml(o.country)}</span><span>△ Validate the published delivery window</span><span>△ Confirm proposed-team availability</span>`}</div></article>
        <article class="record-chapter"><p class="eyebrow">02 · ELIGIBILITY</p><h2>Requirement-by-requirement check</h2><p>${escapeHtml(m.objective||context.summary)}</p>${eligibilityTable(o)}${(m.keywords&&m.keywords.length)?`<div class="tags" style="margin-top:12px">${m.keywords.map(k=>`<span class="tag">${escapeHtml(k)}</span>`).join('')}</div>`:''}</article>
        <article class="record-chapter"><p class="eyebrow">03 · SOURCE RECORD</p><h2>Documents and decision evidence</h2><p>Original publication, extracted details and the record used for the pursuit decision.</p>${sourceRecord(o)}</article>
      </main><aside class="record-workbench">
        <article class="review-comments"><header><div><p class="eyebrow">HUMAN REVIEW</p><h2>Team comments</h2></div><span id="commentCount">0 comments</span></header><div id="commentList"></div><form id="commentForm"><textarea required placeholder="Add a comment for the team..."></textarea><button>Add comment</button></form></article>
        <article class="decision-route-full"><p class="eyebrow">DECISION ROUTE</p><h2>From opportunity to approval</h2>${['Opportunity mapping','Fit ranking','Aceso workspace','Analyst review','BD Manager','Finance & Director'].map((x,i)=>`<div class="${i<3?'done':i===3?'active':''}"><i>${i<3?'✓':''}</i><span><b>${x}</b><small>${i<3?'Completed':i===3?'Current step — finalise recommendation.':'Pending'}</small></span></div>`).join('')}</article>
        <article class="next-human"><p class="eyebrow">NEXT HUMAN DECISION</p><h2>Confirm country and eligibility requirements</h2><p>Validate the participation route for ${escapeHtml(o.country)} and resolve any remaining eligibility questions before committing proposal capacity.</p><small>SUBMISSION DEADLINE <b>${escapeHtml(o.due)}</b></small><button data-approve>Approve to pursue</button><button data-clarify>Request clarification</button></article>
      </aside></div></section>`;
    foldRecordChapters(root,o,fitTier);
    setupRecordInteractions();
  }

  function setupRecordInteractions(){
    const comments=[];
    const renderComments=()=>{qs('#commentList').innerHTML=comments.map(x=>`<article><i>${escapeHtml(x[0])}</i><div><b>${escapeHtml(x[1])}</b><small>${escapeHtml(x[2])}</small><p>${escapeHtml(x[3])}</p></div></article>`).join('');qs('#commentCount').textContent=`${comments.length} comments`;};
    renderComments();
    const sourceDoc=qs('[data-source-doc]');if(sourceDoc)sourceDoc.onclick=()=>{if(active.sourceUrl)window.open(active.sourceUrl,'_blank','noopener');else showToast('DevelopmentAid listing — membership sign-in required to view the original notice.')};
    qs('#commentForm').onsubmit=e=>{e.preventDefault();const t=e.target.querySelector('textarea');comments.push(['BD','Liz','Just now',t.value.trim()]);t.value='';renderComments();showToast('Comment added to the opportunity record.')};
    qsa('[data-approve]').forEach(b=>b.onclick=()=>showToast('Opportunity approved to pursue.'));qs('[data-clarify]').onclick=()=>showToast('Clarification request added to the decision history.');
  }

  const criterionSteps=[
    {key:'Regions',title:'Where do we want to work?',sub:'Select the regions or countries that are a priority for your team.',options:['Africa','Latin America','Asia','Middle East','Europe','North America'],chosen:[0,1],preview:'regions'},
    {key:'Sectors',title:'Which sectors should we prioritize?',sub:'Choose the areas where Aceso wants to focus its search.',options:['Health Financing','Primary Care','Maternal Health','Digital Health','Health Systems Strengthening','Education','Agriculture','WASH','Climate & Environment'],chosen:[0,1,2,3,4],preview:'bars'},
    {key:'Funding',title:'What funding types matter most?',sub:'Select the kinds of opportunities the agent should prioritize.',options:['RFP / Consulting','Technical Assistance','Grants','Tenders','Loans','Equity'],chosen:[0,1,2,3],preview:'donut'},
    {key:'Value',title:'What opportunity size fits us best?',sub:'Set the funding range that matches Aceso’s pursuit strategy.',options:['Under $250K','$250K – $2M','$2M – $10M','$10M+'],chosen:[1,2],preview:'histogram'},
    {key:'Timeline',title:'When should opportunities be due?',sub:'Define the time horizon that best fits Aceso’s planning cycle.',options:['Closing in 30 days','31 – 90 days','3 – 6 months','6+ months'],chosen:[1,2],preview:'timeline'},
    {key:'Strategic Fit',title:'How closely should opportunities align?',sub:'Set the strategic fit that Aceso should prioritize.',options:['High fit','Medium fit','Exploratory'],chosen:[0],preview:'fit'}
  ]; let step=0;
  function previewFor(s){
    if(s.preview==='regions')return `<div class="criteria-map-shape">AFRICA&nbsp;&nbsp;&nbsp;&nbsp; LATIN AMERICA</div><div class="criteria-stats"><b>124<small>in Africa</small></b><b>68<small>in Latin America</small></b><b>22<small>in other regions</small></b></div>`;
    if(s.preview==='donut')return `<div class="criteria-donut"><b>214<small>opportunities</small></b></div><div class="criteria-legend">${[['RFP / Consulting','42%'],['Technical Assistance','24%'],['Grants','18%'],['Tenders','11%'],['Other','5%']].map(x=>`<span>${x[0]} <b>${x[1]}</b></span>`).join('')}</div>`;
    if(s.preview==='histogram')return `<h3 class="range-label">Your selected range<br><b>$250K – $10M</b></h3><div class="criteria-histogram">${[18,28,42,55,70,82,67,55,37,23,16].map((x,i)=>`<i style="height:${x}%"></i>`).join('')}</div>`;
    if(s.preview==='timeline')return `<div class="criteria-timeline-chart">${[2,3,5,7,8,7,4,4,3,2,2,2].map((x,i)=>`<span>${Array.from({length:x},()=>'<i></i>').join('')}<small>${['Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar','Apr','May','Jun'][i]}</small></span>`).join('')}</div>`;
    const values=s.preview==='fit'?[['Strategic alignment',92],['Delivery confidence',78],['Reusable experience',76],['Pursuit readiness',62]]:[['Health Financing',68],['Health Systems Strengthening',52],['Primary Care',38],['Digital Health',32],['Maternal Health',24]];return `<div class="criteria-preview-bars">${values.map(x=>`<div><span>${x[0]}</span><i><b style="width:${x[1]}%"></b></i><strong>${x[1]}${s.preview==='fit'?'%':''}</strong></div>`).join('')}</div>`;
  }
  function renderCriteriaWizard(){
    const view=qs('#criteriaView'),s=criterionSteps[step]; if(!view)return;
    view.innerHTML=`<header class="criteria-master-head"><p class="eyebrow">SEARCH CRITERIA</p><h1>Set your focus</h1><p>Define a few key preferences and let Aceso Intelligence find the most relevant opportunities for your team.</p><em>A more relevant<br>pipeline starts here.</em></header><section class="criteria-book"><article><p class="step-number">0${step+1} <span>/ 6</span></p><h2>${s.title}</h2><p>${s.sub}</p><div class="criteria-options ${s.options.length>6?'nine':''}">${s.options.map((x,i)=>`<button class="${s.chosen.includes(i)?'chosen':''}" data-choice="${i}"><i>${['◎','♡','✚','▤','♟','◈','⌁','●','◒'][i]}</i><span>${x}</span><b>${s.chosen.includes(i)?'✓':''}</b></button>`).join('')}</div><div class="criteria-tip"><i>☼</i><span><b>Tip</b><small>${step===1?'Focusing on fewer sectors helps the agent surface stronger matches.':'Your selections update the estimated opportunity pool in real time.'}</small></span></div></article><article><header><div><p class="eyebrow">IMPACT PREVIEW</p><h2>${step===0?'Your selected regions':step===1?'Your selected sectors':step===2?'How your funding strategy shapes the pipeline':step===3?'Your preferred opportunity size':step===4?'Your submission timeline':'What Aceso will prioritize'}</h2><p>Based on your selection, the agent will prioritize opportunities matching these preferences.</p></div><b class="opportunity-total">214 <span>opportunities</span></b></header>${previewFor(s)}<div class="criteria-insight"><i>▥</i><span><b>Key insight</b><small>Your current selection balances relevance, opportunity volume and team capacity.</small></span></div></article></section><footer class="criteria-footer"><button id="criteriaPrev">← &nbsp; Previous</button><nav>${criterionSteps.map((x,i)=>`<button class="${i===step?'active':i<step?'done':''}" data-step="${i}"><i>${i<step?'✓':''}</i><span>${x.key}</span></button>`).join('')}</nav><button id="criteriaNext">${step===5?'Save criteria':'Next'} &nbsp;→</button></footer>`;
    qsa('[data-choice]').forEach(b=>b.onclick=()=>{const i=Number(b.dataset.choice),at=s.chosen.indexOf(i);at>=0?s.chosen.splice(at,1):s.chosen.push(i);renderCriteriaWizard()});qsa('[data-step]').forEach(b=>b.onclick=()=>{step=Number(b.dataset.step);renderCriteriaWizard()});qs('#criteriaPrev').onclick=()=>{if(step>0){step--;renderCriteriaWizard()}};qs('#criteriaNext').onclick=()=>{if(step<5){step++;renderCriteriaWizard()}else showToast('Search criteria saved and applied.')};
  }

  const oldShow=window.showView || (typeof showView==='function'?showView:null);
  if(oldShow){ window.showView=function(name){ oldShow(name); if(name==='opportunities')renderUnifiedOpportunities(); if(name==='criteria')renderCriteriaWizard(); }; qsa('.navlinks button').forEach(b=>b.onclick=()=>window.showView(b.dataset.view)); }
  window.openDetail=showOpportunityRecord;
  window.renderUnifiedOpportunities=renderUnifiedOpportunities;
  window.renderCriteriaWizard=renderCriteriaWizard;
  renderCriteriaWizard();
})();
