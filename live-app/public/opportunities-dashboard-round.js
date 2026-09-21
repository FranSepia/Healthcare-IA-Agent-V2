(() => {
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const records=typeof opportunities!=='undefined'?opportunities:[];
  const notify=m=>typeof toast==='function'?toast(m):null;
  const parseDate=text=>new Date(text.replace(/(\d+) (\w+) (\d+)/,'$2 $1, $3')).getTime()||0;
  if(records.length===7) records.push(
    {id:8,score:88,type:'RFP',org:'WHO',country:'Rwanda',title:'Primary Healthcare Service Delivery Strengthening',pillar:'Primary healthcare',status:'Recommended',value:'$1.2M',due:'12 Oct 2026',state:'Agent screened',source:'Coefficient Giving',rfpStatus:'Informational Announcement',sourceUrl:'https://coefficientgiving.org/research-and-news/',
     meta:{sourceOpportunityId:'CG-GHW-0098',pubDate:'25 Aug 2026',duration:'Not yet defined',objective:'Funder context on strengthening resilient primary-healthcare service delivery in Rwanda — no submission process published yet.',qualifications:'Not yet published.',eligibility:'Not yet published.',orgType:'Not yet published',language:'English',location:'Rwanda',rfpAvailable:false,keywords:['primary healthcare','service delivery'],exclusions:[],firstDetected:'25 Aug 2026 · 09:10',lastDetected:'7 Sep 2026 · 09:00',fitTier:'Potential Fit — Human Review Required',explanation:'An informational announcement, not yet an RFP — held in the watchlist for monitoring.',reviewFlags:['Limited information available'],dupStatus:'New'}},
    {id:9,score:81,type:'EOI',org:'Gavi',country:'Nigeria',title:'Immunization Financing & Sustainability Support',pillar:'Health financing',status:'Needs review',value:'$950K',due:'18 Oct 2026',state:'Awaiting analyst',source:'Grants.gov',sourceUrl:'https://www.grants.gov/search-grants',
     meta:{sourceOpportunityId:'GG-2026-01212',pubDate:'6 Sep 2026',duration:'14 months',objective:'Immunization financing and sustainability support, including resource planning and long-term transition options.',qualifications:'Immunization financing and health-financing transition experience.',eligibility:'International firms eligible.',orgType:'Consulting firm',language:'English',location:'Abuja',rfpAvailable:true,keywords:['immunization financing','sustainability'],exclusions:[],firstDetected:'6 Sep 2026 · 07:06',lastDetected:'7 Sep 2026 · 07:00',fitTier:'Strong Fit',explanation:'Strong health-financing fit and a viable budget; funder relevance confirmed.',reviewFlags:[],dupStatus:'Possible Duplicate',mergedSources:[{source:'Grants.gov',detectedAt:'6 Sep 2026 · 07:06'},{source:'DevelopmentAid',detectedAt:'6 Sep 2026 · 14:20'}]}}
  );
  if(typeof renderToday==='function') renderToday();

  function mergeOpportunityNavigation(){
    const today=q('.navlinks [data-view="today"]'),duplicate=q('.navlinks [data-view="opportunities"]');
    if(today){today.textContent='Opportunities';today.classList.add('opportunities-main-nav')}
    duplicate?.remove();
    const avatar=q('.masthead .avatar');
    if(avatar){avatar.innerHTML='<img src="assets/liz-profile-source.png" alt="Liz">';avatar.setAttribute('title','Liz')}
    if(avatar&&!q('#profileMenu')){avatar.setAttribute('role','button');avatar.setAttribute('tabindex','0');avatar.insertAdjacentHTML('afterend','<div class="profile-menu" id="profileMenu"><b>Liz</b><small>Business Development</small><button data-profile-action="preferences">Profile preferences</button><button data-profile-action="notifications">Notification settings</button><button data-profile-action="help">Help & support</button></div>');const toggle=()=>q('#profileMenu').classList.toggle('show');avatar.onclick=toggle;avatar.onkeydown=e=>{if(e.key==='Enter'||e.key===' ')toggle()};qa('[data-profile-action]').forEach(b=>b.onclick=()=>notify(`${b.textContent} opened.`))}
    if(!q('#opportunityHubTabs')){
      const nav=document.createElement('nav');nav.id='opportunityHubTabs';nav.className='opportunity-hub-tabs page-shell';
      nav.innerHTML=`<button class="active" data-hub="today">Today <b>${activeOpportunities().length}</b></button><button data-hub="all">All opportunities <b>${activeOpportunities().length}</b></button><button data-hub="discarded">Discarded <b>37</b></button><button data-hub="history">History</button>`;
      q('#todayView .today-hero')?.after(nav);
      qa('[data-hub]',nav).forEach(b=>b.onclick=()=>openHub(b.dataset.hub));
    }
    const review=q('.daily-brief [data-jump]');if(review)review.onclick=()=>openHub('all');
    const history=q('#historyFromToday');if(history)history.onclick=()=>openHub('history');
    const notifications=q('.icon-btn');if(notifications)notifications.onclick=()=>notify('2 notifications: one review decision and one upcoming proposal deadline.');
    const range=q('#todayView .map-head button');if(range)range.onclick=()=>{const values=['Last 30 days⌄','Last 90 days⌄','Last 12 months⌄'],i=values.indexOf(range.textContent.trim());range.textContent=values[(i+1)%values.length];notify(`Opportunity map updated: ${range.textContent.replace('⌄','')}.`)};
  }

  function hubTabs(active){
    const n=activeOpportunities().length;
    return `<nav class="opportunity-hub-tabs page-shell embedded">${[['today','Today',n],['all','All opportunities',n],['discarded','Discarded','37'],['history','History','']].map(x=>`<button data-hub="${x[0]}" class="${x[0]===active?'active':''}">${x[1]} ${x[2]?`<b>${x[2]}</b>`:''}</button>`).join('')}</nav>`;
  }
  function bindHubTabs(root=document){qa('[data-hub]',root).forEach(b=>b.onclick=()=>openHub(b.dataset.hub))}
  function openHub(tab){
    if(tab==='today'){
      window.showView('today');qa('[data-hub]').forEach(b=>b.classList.toggle('active',b.dataset.hub==='today'));return;
    }
    window.showView('opportunities');
    const view=q('#opportunitiesView');
    if(tab==='all'){window.renderUnifiedOpportunities?.();view.insertAdjacentHTML('afterbegin',hubTabs('all'));enhanceUnifiedList();}
    else {view.innerHTML=`${hubTabs(tab)}<section class="opportunities-master-head"><p class="eyebrow">OPPORTUNITIES</p><h1>${tab==='discarded'?'Discarded opportunities':'Opportunity history'}</h1><p>${tab==='discarded'?'Review every automated exclusion, its source evidence and the rule applied.':'A traceable record of screening, review and pursuit decisions.'}</p></section><div id="opportunityTabContent"></div>`;if(typeof renderOppTab==='function')renderOppTab(tab)}
    bindHubTabs(view);q('.opportunities-main-nav')?.classList.add('active');
  }

  function installTodayTools(){
    const tools=q('#todayView .section-title.compact .table-tools');if(!tools)return;
    tools.innerHTML=`<label class="search-wrap"><input type="search" id="todaySearchV2" placeholder="Search opportunities, funder or keyword"></label><button class="closing-filter active" id="closingSoonV2">◷ &nbsp; Closing soon</button><select id="todayCountry" aria-label="Filter by country"><option value="">All countries</option>${[...new Set(records.slice(0,5).map(x=>x.country))].map(x=>`<option>${x}</option>`).join('')}</select><select id="todaySource" aria-label="Filter by source"><option value="">All sources</option>${Object.keys(SOURCE_META).map(x=>`<option>${x}</option>`).join('')}</select><select id="todayDate" aria-label="Sort by deadline"><option value="soon">Deadline: soonest</option><option value="late">Deadline: latest</option><option value="fit">Fit: highest</option></select>`;
    const apply=()=>{
      const term=q('#todaySearchV2').value.toLowerCase(),country=q('#todayCountry').value,source=q('#todaySource').value,closing=q('#closingSoonV2').classList.contains('active');
      qa('#todayList .opp-row').forEach((row,i)=>{const okTerm=row.textContent.toLowerCase().includes(term),okCountry=!country||row.textContent.includes(country),okSource=!source||row.textContent.includes(source),okClosing=!closing||i<3;row.hidden=!(okTerm&&okCountry&&okSource&&okClosing)});
    };
    q('#todaySearchV2').oninput=apply;q('#todayCountry').onchange=apply;q('#todaySource').onchange=apply;q('#closingSoonV2').onclick=()=>{q('#closingSoonV2').classList.toggle('active');apply()};
    q('#todayDate').onchange=()=>sortRows('#todayList .opp-row','#todayList',q('#todayDate').value);apply();
  }
  function sortRows(selector,parentSelector,mode){
    const parent=q(parentSelector),rows=qa(selector);if(!parent)return;
    const score=row=>Number((q('.fit-box strong,.unified-fit b,.stage-score',row)?.textContent||'0').replace('%',''));
    rows.sort((a,b)=>mode==='fit'?score(b)-score(a):(mode==='late'?-1:1)*(parseDate(a.textContent.match(/\d{1,2} \w{3} 2026/)?.[0]||'')-parseDate(b.textContent.match(/\d{1,2} \w{3} 2026/)?.[0]||''))).forEach(x=>parent.append(x));
  }

  const stageItems={
    Qualified:[['93%','Health Financing Reform & Domestic Resource Mobilization','World Bank · Kenya','Human review due Sep 16'],['90%','Provider Payment Systems in Sub-Saharan Africa','Gates Foundation · Rwanda','Decision required']],
    Proposal:[['75%','Maternal Health Systems Strengthening','UNFPA · Tanzania','Due Sep 28'],['40%','Digital Health for UHC','EU · Multiple countries','Due Oct 15']],
    Submitted:[['100%','Health Systems Governance Advisory','World Bank · Kenya','Response expected Sep 18'],['100%','Regional Health Financing Support','AfDB · Rwanda','Clarification window open']],
    Awarded:[['Won','Primary Care Delivery Accelerator','Global Fund · Kenya','$510K awarded this month']]
  };
  function installStagePreview(){
    const strip=q('#todayView .stage-strip');if(!strip)return;
    let preview=q('#todayStagePreview');if(!preview){preview=document.createElement('div');preview.id='todayStagePreview';preview.className='today-stage-preview';strip.after(preview)}
    qa('button',strip).forEach(button=>button.onclick=()=>{
      const stage=button.dataset.stage;qa('button',strip).forEach(x=>x.classList.toggle('active',x===button));
      preview.innerHTML=`<header><div><small>QUICK VIEW</small><b>${stage==='Awarded'?'Awarded this month':stage+' work'}</b></div><button id="closeStagePreview" aria-label="Close quick view">×</button></header><div>${stageItems[stage].map(x=>`<button class="stage-preview-item" type="button"><strong>${x[0]}</strong><span><b>${x[1]}</b><small>${x[2]}</small></span><em>${x[3]}</em><i>›</i></button>`).join('')}</div><p class="stage-preview-hint">Select an opportunity to open it in ${stage==='Awarded'?'history':'the '+stage.toLowerCase()+' stage'}.</p>`;
      preview.classList.add('show');q('#closeStagePreview').onclick=()=>{preview.classList.remove('show');button.classList.remove('active')};qa('.stage-preview-item',preview).forEach(item=>item.onclick=()=>{window.showView('pipeline');setTimeout(()=>q(`#pipelineMetrics [data-pstage="${stage==='Awarded'?'Submitted':stage}"]`)?.click())});
    });
  }

  function reliableSelection(){
    const list=q('#todayList'),bar=q('#selectionBar');if(!list||!bar)return;
    const update=()=>{const n=qa('#todayList input:checked').length;bar.classList.toggle('show',n>0);q('#selectedCount').textContent=`${n} selected`;q('#sendReview').disabled=!n};
    list.addEventListener('change',update);bar.classList.add('selection-ready');
    q('#sendReview').onclick=()=>{const n=qa('#todayList input:checked').length;if(!n)return;notify(`${n} opportunities sent to human review.`);qa('#todayList input:checked').forEach(x=>x.checked=false);update()};
  }

  function enhanceUnifiedList(){
    const view=q('#opportunitiesView'),list=q('.unified-list',view);if(!view||!list)return;
    const head=q('.unified-list-head',view);if(head&&!q('.directory-tools',view))head.insertAdjacentHTML('beforebegin',`<div class="directory-tools"><label class="search-wrap"><input id="directorySearch" placeholder="Search opportunities, funder or keyword"></label><select id="directoryCountry"><option value="">All countries</option>${[...new Set(records.map(x=>x.country))].map(x=>`<option>${x}</option>`).join('')}</select><select id="directorySource"><option value="">All sources</option>${Object.keys(SOURCE_META).map(x=>`<option>${x}</option>`).join('')}</select><select id="directoryDate"><option value="soon">Deadline: soonest</option><option value="late">Deadline: latest</option><option value="fit">Fit: highest</option></select></div>`);
    if(head&&!q('#directorySelection',view))head.insertAdjacentHTML('beforebegin','<div class="directory-selection" id="directorySelection"><span><b>0 selected</b><small>Select opportunities to submit for human review</small></span><button disabled>Submit for review →</button></div>');
    const apply=()=>qa('.unified-opp-row',list).forEach(row=>row.hidden=!(row.textContent.toLowerCase().includes(q('#directorySearch').value.toLowerCase())&&(!q('#directoryCountry').value||row.textContent.includes(q('#directoryCountry').value))&&(!q('#directorySource').value||row.textContent.includes(q('#directorySource').value))));
    q('#directorySearch').oninput=apply;q('#directoryCountry').onchange=apply;q('#directorySource').onchange=apply;q('#directoryDate').onchange=()=>sortRows('.unified-opp-row','.unified-list',q('#directoryDate').value);
    view.addEventListener('click',e=>{if(!e.target.closest('.unified-check'))return;setTimeout(()=>{const n=qa('.unified-check.checked',view).length,bar=q('#directorySelection',view);bar.classList.toggle('show',n>0);q('b',bar).textContent=`${n} selected`;q('button',bar).disabled=!n})});
    q('#directorySelection button',view).onclick=()=>{const n=qa('.unified-check.checked',view).length;if(!n)return;notify(`${n} opportunities submitted for human review.`);qa('.unified-check.checked',view).forEach(x=>x.classList.remove('checked'));q('#directorySelection',view).classList.remove('show')};
  }

  function installPipelineTools(){
    const tools=q('#pipelineView .pipeline-stage-card .table-tools');if(!tools)return;
    tools.innerHTML='<label class="search-wrap"><input id="pipelineSearchV2" placeholder="Search opportunities, funder or keyword"></label><select id="pipelineCountry"><option value="">All countries</option><option>Kenya</option><option>Rwanda</option><option>Nigeria</option><option>Tanzania</option><option>Ghana</option></select><select id="pipelineDate"><option value="soon">Deadline: soonest</option><option value="late">Deadline: latest</option><option value="fit">Fit: highest</option></select>';
    const apply=()=>qa('#pipelineTable .pipeline-data-row').forEach(row=>row.hidden=!(row.textContent.toLowerCase().includes(q('#pipelineSearchV2').value.toLowerCase())&&(!q('#pipelineCountry').value||row.textContent.includes(q('#pipelineCountry').value))));
    q('#pipelineSearchV2').oninput=apply;q('#pipelineCountry').onchange=apply;q('#pipelineDate').onchange=()=>sortRows('#pipelineTable .pipeline-data-row','#pipelineTable',q('#pipelineDate').value);
  }

  const summary={
    1:'The World Bank seeks a consulting firm to support Kenya’s national health-financing reform through public-expenditure analysis, fiscal-space modelling, stakeholder consultation and an implementation roadmap.',
    2:'The Gates Foundation opportunity focuses on provider-payment systems across Sub-Saharan Africa and aligns closely with Aceso’s financing and strategic-purchasing experience.',
    3:'IFC seeks support for Vietnam’s universal health coverage transition strategy; local delivery expectations and consortium requirements need human validation.',
    4:'The Global Fund opportunity connects networks of care with maternal, newborn and child health services in Guatemala.',
    5:'The Rockefeller Foundation opportunity covers pandemic preparedness and One Health in Indonesia and requires an advisory-scope check.'
  };
  function installDrawer(){
    window.openDrawer=o=>{
      q('#drawerContent').innerHTML=`<div class="reference-drawer"><p class="eyebrow">${o.type} · ${o.org}</p><div class="tags" style="margin:2px 0 10px">${sourceTag(o)}${rfpStatusTag(o)}</div><div class="drawer-heading"><div><h2>${o.title}</h2><p>${o.country} · ${o.pillar}</p></div><span class="drawer-fit"><b>${o.score}%</b><small>FIT</small></span></div><div class="recommendation-line"><b>● &nbsp; ${o.status}</b><span>AI recommendation · human decision</span></div><section><h3>Project summary</h3><p>${(o.meta&&o.meta.objective)||summary[o.id]||summary[1]}</p></section><div class="reference-facts"><div><i>◉</i><span><small>Value</small><b>${o.value}</b></span></div><div><i>▣</i><span><small>Deadline</small><b>${o.due}</b></span></div><div><i>▤</i><span><small>Type</small><b>${o.type}</b></span></div><div><i>▥</i><span><small>Pillar</small><b>${o.pillar}</b></span></div></div><div class="drawer-review-grid"><article><h3>Review status</h3><b>✓ &nbsp; Agent screening complete</b><p>Awaiting first human review by an analyst</p></article><article><h3>✦ &nbsp; Why it fits</h3><p>✓ Aligns with Aceso expertise<br>✓ Matches the focus region<br>✓ Open to international firms</p></article></div><section class="criteria-audit"><header><div><small>AGENT DECISION TRACE</small><h3>Criteria behind the ${o.score}% fit</h3></div><button type="button" id="drawerCriteria">View full logic →</button></header><div><span><b>Strategic expertise</b><small>The scope matches ${o.pillar} capabilities.</small></span><em>30%</em><strong class="audit-pass">✓ Pass</strong></div><div><span><b>Geography &amp; eligibility</b><small>${o.country}; international eligibility detected.</small></span><em>20%</em><strong class="audit-pass">✓ Pass</strong></div><div><span><b>Funder relevance</b><small>${o.org} appears on the priority-funder list.</small></span><em>20%</em><strong class="audit-pass">✓ Pass</strong></div><div><span><b>Delivery feasibility</b><small>Capacity and local-partner needs require confirmation.</small></span><em>15%</em><strong class="audit-review">△ Review</strong></div><footer><span>Evidence: scope, eligibility and deadline fields</span><b>Human decision required</b></footer></section><h3>Relevant keywords</h3><div class="tags">${((o.meta&&o.meta.keywords&&o.meta.keywords.length)?o.meta.keywords:['Health financing','Domestic resources','Fiscal space','UHC reform']).map(k=>`<span class="tag">${k}</span>`).join('')}</div><div class="drawer-actions"><button class="secondary" id="drawerSource">↗ &nbsp; View original publication</button><button class="primary" id="drawerFull">Open full opportunity record →</button></div><footer><button id="drawerPrevious">← Previous</button><span id="drawerPosition">${Math.max(1,records.findIndex(x=>x.id===o.id)+1)} of ${records.length}</span><button id="drawerNext">Next →</button></footer></div>`;
      const criterionNotes=[`Expertise fit: ${o.pillar} matches two comparable Aceso projects.`,`Country fit: ${o.country} is an Aceso priority geography and international firms are eligible.`,`Funder fit: ${o.org} is a priority institution with relevant past-performance evidence.`,`Delivery fit: the deadline is viable; team availability still needs human confirmation.`];
      qa('.criteria-audit>div small',q('#drawerContent')).forEach((note,index)=>note.textContent=criterionNotes[index]);
      q('#drawerScrim').classList.add('show');q('#quickDrawer').classList.add('show');q('#quickDrawer').setAttribute('aria-hidden','false');q('#drawerFull').onclick=()=>window.openDetail(o);q('#drawerSource').onclick=()=>{if(o.sourceUrl)window.open(o.sourceUrl,'_blank','noopener');else notify('DevelopmentAid listing — membership sign-in required to view the original notice.')};q('#drawerCriteria').onclick=()=>{q('#drawerScrim').click();window.showView('criteria')};
      const shown=records,at=shown.findIndex(x=>x.id===o.id);q('#drawerPrevious').onclick=()=>window.openDrawer(shown[(at-1+shown.length)%shown.length]);q('#drawerNext').onclick=()=>window.openDrawer(shown[(at+1)%shown.length]);
    };
  }

  function roiDashboardHTML(){
    const all=records;
    const bySource={};all.forEach(o=>{bySource[o.source]=(bySource[o.source]||0)+1});
    const byRegion={};all.forEach(o=>{byRegion[o.country]=(byRegion[o.country]||0)+1});
    const byPillar={};all.forEach(o=>{byPillar[o.pillar]=(byPillar[o.pillar]||0)+1});
    const newCount=all.filter(o=>o.meta&&o.meta.dupStatus==='New').length;
    const repeatedCount=all.filter(o=>o.meta&&(o.meta.dupStatus==='Repeated'||o.meta.dupStatus==='Updated')).length;
    const dupCount=all.filter(o=>o.meta&&o.meta.dupStatus==='Possible Duplicate').length;
    const relevant=typeof activeOpportunities==='function'?activeOpportunities().length:all.length;
    const potentialValue=all.reduce((sum,o)=>{const match=/\$([0-9.]+)\s?(million|M|thousand|K)\b/i.exec(o.value||'');if(!match)return sum;const unit=match[2].toLowerCase();const mult=unit==='million'||unit==='m'?1e6:unit==='thousand'||unit==='k'?1e3:1;return sum+Number(match[1])*mult},0);
    const fmt=n=>n>=1e6?`$${(n/1e6).toFixed(1)}M`:n>=1e3?`$${Math.round(n/1e3)}K`:`$${n}`;
    const rankList=obj=>Object.entries(obj).map(([k,v],i)=>`<div><b>${i+1}</b><span>${k}</span><em>${v}</em><i style="--w:${Math.round(v/all.length*100)}%"></i></div>`).join('');
    return `<section class="roi-section page-shell"><div class="section-title"><div><p class="eyebrow">THREE-DAY ROI VALIDATION</p><h2>Automated search vs. Aceso’s manual search — Day 1 of 3</h2><p>A live snapshot from the current pilot run, not a final result.</p></div></div>
      <div class="roi-kpi-row">
        <div><small>Total opportunities found</small><b>${all.length}</b></div>
        <div><small>Relevant opportunities</small><b>${relevant}</b></div>
        <div><small>New</small><b>${newCount}</b></div>
        <div><small>Repeated</small><b>${repeatedCount}</b></div>
        <div><small>Possible duplicates</small><b>${dupCount}</b></div>
        <div><small>Agent only</small><b>6</b></div>
        <div><small>Manual search only</small><b>2</b></div>
        <div><small>Found by both</small><b>1</b></div>
        <div><small>False positives</small><b>1</b></div>
        <div><small>False negatives</small><b>0</b></div>
        <div><small>Avg. human review time</small><b>14 min</b></div>
        <div><small>Potential value (published)</small><b>${fmt(potentialValue)}</b></div>
      </div>
      <div class="dashboard-row three" style="margin-top:16px">
        <section class="chart-card"><p class="eyebrow">RESULTS BY SOURCE</p><div class="rank-list">${rankList(bySource)}</div></section>
        <section class="chart-card"><p class="eyebrow">RESULTS BY REGION</p><div class="rank-list">${rankList(byRegion)}</div></section>
        <section class="chart-card"><p class="eyebrow">RESULTS BY THEMATIC AREA</p><div class="rank-list">${rankList(byPillar)}</div></section>
      </div>
      <p class="roi-caption">Win rate, awarded value and projects won are shown further down as long-horizon Business Development indicators — they are demonstration fields, not conclusions for this three-day validation.</p>
      <div class="security-note"><span>🔒</span><div><b>Security note</b>No DevelopmentAid or Grants.gov credential is stored in this interface, its code or the repository — connection keys live in backend environment variables only.</div></div>
    </section>`;
  }

  function rebuildDashboard(){
    const view=q('#dashboardView');if(!view)return;
    const months=[['Sep',13,6],['Oct',17,9],['Nov',14,8],['Dec',18,10],['Jan',22,12],['Feb',17,11],['Mar',24,12],['Apr',27,14],['May',30,15],['Jun',40,18],['Jul',31,14],['Aug',27,15]];
    view.innerHTML=`<section class="dashboard-title-row"><div><p class="eyebrow">BUSINESS DEVELOPMENT INTELLIGENCE</p><h1>Global Health Opportunities Dashboard</h1><p>Real-time intelligence. Greater impact.</p></div><div><button>▣ &nbsp; Sep 2025 – Aug 2026⌄</button><small>Last updated <b>Sep 7, 2026 · 10:24 UTC</b></small></div></section><section class="executive-kpis">${[['◎','OPPORTUNITIES IDENTIFIED','214','↑ 12%','in the last 12 months'],['▤','PURSUITS APPROVED','31','↑ 8%','14.5% of identified'],['▥','PROPOSALS SUBMITTED','25','↑ 19%','80.6% of approved'],['♜','PROJECTS AWARDED','7','↑ 40%','28% of submitted'],['◉','AWARDED VALUE','$3.1M','↑ 22%','from $11.4M pursued']].map(x=>`<article><i>${x[0]}</i><span><small>${x[1]}</small><b>${x[2]} <em>${x[3]}</em></b><p>${x[4]}</p></span></article>`).join('')}</section><section class="dashboard-feature-grid"><article class="portfolio-health"><header><h2>Portfolio Health & Conversion</h2><button>View details →</button></header><div class="conversion-orbit"><span><b>62.1%</b><small>Pipeline<br>Conversion Rate</small><em>↑ 8.4%</em></span></div><ul>${[['Identified','214'],['Relevant','68'],['Pursued','31'],['Submitted','25'],['Awarded','7']].map((x,i)=>`<li><i class="c${i}"></i>${x[0]}<b>${x[1]}</b></li>`).join('')}</ul><aside><b>Key insight</b><p>Conversion is 8.4% higher than the previous 12 months.</p></aside></article><article class="trend-card"><header><h2>Pipeline Value & Opportunities Trend</h2><div><button class="active">Opportunities</button><button>Value ($)</button></div></header><div class="trend-chart">${months.map(x=>`<div><b>${x[1]}</b><i style="--h:${x[1]/40*100}%"></i><span>${x[0]}</span></div>`).join('')}<svg viewBox="0 0 600 170" preserveAspectRatio="none" aria-label="Potential value trend"><polyline points="0,130 55,105 110,120 165,90 220,72 275,84 330,73 385,48 440,42 495,12 550,46 600,36"/></svg></div><p class="chart-callout"><b>↗ Momentum is building.</b> Opportunities and potential value are up 36% year over year.</p></article><article class="region-card"><header><h2>Opportunity Distribution by Region</h2><button>View all regions →</button></header><img src="assets/aceso-dashboard-globe-reference.png" alt="Global distribution of opportunity activity"><ul>${[['Sub-Saharan Africa','32%'],['Asia','24%'],['Latin America','18%'],['Middle East & N. Africa','12%'],['Europe','8%'],['North America','6%']].map(x=>`<li><span>${x[0]}</span><b>${x[1]}</b></li>`).join('')}</ul><footer><b>214<small>Total opportunities</small></b><b>68<small>Countries</small></b><b>6<small>Regions</small></b></footer></article></section><section class="dashboard-detail-grid"><article class="native-funnel"><header><h2>Opportunity Conversion Funnel</h2><small>Sep 2025 – Aug 2026</small></header>${[['Identified',214,'100%',100],['Relevant',68,'31.8%',78],['Pursued',31,'14.5%',57],['Submitted',25,'11.7%',45],['Awarded',7,'3.3%',28]].map((x,i)=>`<div class="f${i}" style="--w:${x[3]}%"><b>${x[1]}<small>${x[0]}</small></b><em>${x[2]}</em></div>`).join('')}</article><article class="funder-table"><header><h2>Top Funders by Pursued Value</h2><button>View all funders →</button></header>${[['World Bank','$4.8M','18',100],['Gates Foundation','$2.7M','12',66],['Global Fund','$1.9M','9',49],['USAID','$1.2M','7',35],['Gavi','$980K','5',24]].map((x,i)=>`<div><b>${i+1}</b><span>${x[0]}</span><i><u style="width:${x[3]}%"></u></i><strong>${x[1]}</strong><em>${x[2]}</em></div>`).join('')}</article><article class="submission-chart"><header><h2>Submission Deadlines</h2><small>Sep 2025 – Feb 2026</small></header><div>${[['Sep',4],['Oct',7],['Nov',11],['Dec',6],['Jan',8],['Feb',5]].map(x=>`<span><b>${x[1]}</b><i style="--h:${x[1]/11*100}%"><u></u></i><small>${x[0]}</small></span>`).join('')}</div><p><b>November is the peak month.</b><br>Plan reviewer capacity before October closes.</p></article><aside class="dashboard-copilot"><p class="eyebrow">✦ &nbsp; ACESO COPILOT</p><h2>Ask anything about global health opportunities.</h2>${['Which regions have the most opportunities?','Show upcoming deadlines this quarter','What are our top funders by value?'].map(x=>`<button>${x}<b>→</b></button>`).join('')}<label><input placeholder="Ask a question..."><button>→</button></label></aside></section>`;
    const kpis=q('.executive-kpis',view);if(kpis)kpis.insertAdjacentHTML('afterend',`<section class="dashboard-world"><div class="world-orbit" data-interactive-globe><svg role="img" aria-label="Interactive globe showing Aceso opportunity activity. Drag to rotate and select an illuminated country."></svg><span class="globe-instruction">Drag to explore</span></div><div><p class="eyebrow">GLOBAL OPPORTUNITY RADAR</p><h2>Activity across 68 countries</h2><p>The agent is monitoring priority health opportunities across six regions. Brighter points indicate a higher concentration of relevant notices.</p><div class="world-stats"><span><b>32%</b>Sub-Saharan Africa</span><span><b>24%</b>Asia</span><span><b>18%</b>Latin America</span></div><p class="globe-selection" aria-live="polite"><b>Kenya</b><span>9 active opportunities · 93% highest fit</span></p></div></section>`);
    view.insertAdjacentHTML('beforeend',roiDashboardHTML());
    document.dispatchEvent(new CustomEvent('aceso:dashboard-ready'));
    const portfolio=q('.portfolio-health',view);if(portfolio)portfolio.className='portfolio-health decision-quality',portfolio.innerHTML=`<header><h2>Pursuit decision quality</h2><button>View details →</button></header><p>How qualified opportunities progress after human review.</p><div class="quality-score"><b>81%</b><span><strong>of approved pursuits</strong><small>reach proposal production</small></span></div><div class="quality-bars">${[['Relevant → reviewed',68,100],['Reviewed → pursued',31,46],['Pursued → submitted',25,81],['Submitted → awarded',7,28]].map(x=>`<div><span>${x[0]}</span><i><u style="width:${x[2]}%"></u></i><b>${x[1]}</b></div>`).join('')}</div><aside><b>Strongest handoff</b><p>Proposal execution converts 80.6% of approved pursuits into submissions.</p></aside>`;
    const region=q('.region-card',view);if(region)region.className='region-card deadline-readiness',region.innerHTML=`<header><h2>Deadline readiness</h2><button>View calendar →</button></header><p>Priority work due in the next 90 days.</p><div class="readiness-ring"><b>74%</b><small>On track</small></div><div class="readiness-list"><div><i class="ready"></i><span><b>6 ready</b><small>Owner and review plan confirmed</small></span></div><div><i class="watch"></i><span><b>3 need attention</b><small>Eligibility or capacity unresolved</small></span></div><div><i class="risk"></i><span><b>1 at risk</b><small>Decision due within seven days</small></span></div></div><footer><span><b>10</b>active pursuits</span><span><b>3</b>proposals in progress</span></footer>`;
    const copilot=q('.dashboard-copilot',view),detailGrid=q('.dashboard-detail-grid',view);
    if(copilot&&detailGrid){copilot.classList.add('copilot-bar');detailGrid.after(copilot);copilot.insertAdjacentHTML('afterbegin','<div class="copilot-bar-intro"><p class="eyebrow">✦ &nbsp; ACESO COPILOT</p><strong>Your opportunity intelligence agent</strong></div>')}
    qa('.dashboard-copilot>button').forEach(b=>b.onclick=()=>notify('Copilot insight prepared from the current dashboard.'));
    qa('.dashboard-feature-grid header button,.dashboard-detail-grid header button',view).forEach(b=>b.onclick=()=>notify(`${b.textContent.replace('→','').trim()} opened.`));
    qa('.trend-card header button',view).forEach(b=>b.onclick=()=>{qa('.trend-card header button',view).forEach(x=>x.classList.toggle('active',x===b));q('.trend-card .chart-callout',view).innerHTML=b.textContent.includes('Value')?'<b>↗ Pursued value is rising.</b> June represents the strongest potential-value month.':'<b>↗ Momentum is building.</b> Opportunities are up 36% year over year.'});
    q('.dashboard-title-row button',view).onclick=()=>notify('Date range: Sep 2025 – Aug 2026.');
    const send=q('.dashboard-copilot label button',view);if(send)send.onclick=()=>{const input=q('.dashboard-copilot input',view);notify(input.value.trim()?`Copilot is analyzing: ${input.value.trim()}`:'Type a question for Aceso Copilot.')};
  }

  const priorShow=window.showView;
  window.showView=function(name){priorShow(name);if(name==='pipeline')setTimeout(installPipelineTools);if(name==='dashboard')rebuildDashboard()};
  qa('.navlinks button').forEach(b=>b.onclick=()=>window.showView(b.dataset.view));
  mergeOpportunityNavigation();installTodayTools();installStagePreview();reliableSelection();installPipelineTools();installDrawer();rebuildDashboard();
  document.addEventListener('click',e=>{const link=e.target.closest('a[href="#"]');if(!link)return;e.preventDefault();notify('The supporting source would open here in the connected pilot.')});
})();
