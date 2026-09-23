(() => {
  const q=(s,r=document)=>r.querySelector(s), qa=(s,r=document)=>[...r.querySelectorAll(s)];
  const records=typeof opportunities!=='undefined'?opportunities:[];
  const notify=m=>typeof toast==='function'?toast(m):null;
  const parseDate=text=>new Date(text.replace(/(\d+) (\w+) (\d+)/,'$2 $1, $3')).getTime()||0;
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
      nav.innerHTML=`<button class="active" data-hub="today">Today <b>${activeOpportunities().length}</b></button><button data-hub="all">All opportunities <b>${activeOpportunities().length}</b></button><button data-hub="discarded">Discarded <b>${(typeof discarded!=='undefined'?discarded:[]).length}</b></button><button data-hub="history">History</button>`;
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
    const discardedCount=(typeof discarded!=='undefined'?discarded:[]).length;
    return `<nav class="opportunity-hub-tabs page-shell embedded">${[['today','Today',n],['all','All opportunities',n],['discarded','Discarded',discardedCount],['history','History','']].map(x=>`<button data-hub="${x[0]}" class="${x[0]===active?'active':''}">${x[1]} ${x[2]?`<b>${x[2]}</b>`:''}</button>`).join('')}</nav>`;
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

  function installDrawer(){
    window.openDrawer=o=>{
      q('#drawerContent').innerHTML=`<div class="reference-drawer"><p class="eyebrow">${escapeHtml(o.type)} · ${escapeHtml(o.org)}</p><div class="tags" style="margin:2px 0 10px">${sourceTag(o)}${rfpStatusTag(o)}</div><div class="drawer-heading"><div><h2>${escapeHtml(o.title)}</h2><p>${escapeHtml(o.country)} · ${escapeHtml(o.pillar)}</p></div><span class="drawer-fit"><b>${o.score}%</b><small>FIT</small></span></div><div class="recommendation-line"><b>● &nbsp; ${escapeHtml(o.status)}</b><span>AI recommendation · human decision</span></div><section><h3>Project summary</h3><p>${escapeHtml((o.meta&&o.meta.objective)||'No summary available for this opportunity yet.')}</p></section><div class="reference-facts"><div><i>◉</i><span><small>Value</small><b>${escapeHtml(o.value)}</b></span></div><div><i>▣</i><span><small>Deadline</small><b>${escapeHtml(o.due)}</b></span></div><div><i>▤</i><span><small>Type</small><b>${escapeHtml(o.type)}</b></span></div><div><i>▥</i><span><small>Pillar</small><b>${escapeHtml(o.pillar)}</b></span></div></div><div class="drawer-review-grid"><article><h3>Review status</h3><b>✓ &nbsp; Agent screening complete</b><p>Awaiting first human review by an analyst</p></article><article><h3>✦ &nbsp; Why it fits</h3><p>✓ Aligns with Aceso expertise<br>✓ Matches the focus region<br>✓ Open to international firms</p></article></div><section class="criteria-audit"><header><div><small>AGENT DECISION TRACE</small><h3>Criteria behind the ${o.score}% fit</h3></div><button type="button" id="drawerCriteria">View full logic →</button></header><div><span><b>Strategic expertise</b><small>The scope matches ${escapeHtml(o.pillar)} capabilities.</small></span><em>30%</em><strong class="audit-pass">✓ Pass</strong></div><div><span><b>Geography &amp; eligibility</b><small>${escapeHtml(o.country)}; international eligibility detected.</small></span><em>20%</em><strong class="audit-pass">✓ Pass</strong></div><div><span><b>Funder relevance</b><small>${escapeHtml(o.org)} appears on the priority-funder list.</small></span><em>20%</em><strong class="audit-pass">✓ Pass</strong></div><div><span><b>Delivery feasibility</b><small>Capacity and local-partner needs require confirmation.</small></span><em>15%</em><strong class="audit-review">△ Review</strong></div><footer><span>Evidence: scope, eligibility and deadline fields</span><b>Human decision required</b></footer></section><h3>Relevant keywords</h3><div class="tags">${((o.meta&&o.meta.keywords&&o.meta.keywords.length)?o.meta.keywords:['Health financing','Domestic resources','Fiscal space','UHC reform']).map(k=>`<span class="tag">${escapeHtml(k)}</span>`).join('')}</div><div class="drawer-actions"><button class="secondary" id="drawerSource">↗ &nbsp; View original publication</button><button class="primary" id="drawerFull">Open full opportunity record →</button></div><footer><button id="drawerPrevious">← Previous</button><span id="drawerPosition">${Math.max(1,records.findIndex(x=>x.id===o.id)+1)} of ${records.length}</span><button id="drawerNext">Next →</button></footer></div>`;
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
    const rankList=obj=>Object.entries(obj).map(([k,v],i)=>`<div><b>${i+1}</b><span>${escapeHtml(k)}</span><em>${v}</em><i style="--w:${Math.round(v/all.length*100)}%"></i></div>`).join('');
    return `<section class="roi-section page-shell"><div class="section-title"><div><p class="eyebrow">SEARCH RESULTS SUMMARY</p><h2>What this search found</h2><p>Computed live from the current search results.</p></div></div>
      <div class="roi-kpi-row">
        <div><small>Total opportunities found</small><b>${all.length}</b></div>
        <div><small>Relevant opportunities</small><b>${relevant}</b></div>
        <div><small>New</small><b>${newCount}</b></div>
        <div><small>Repeated</small><b>${repeatedCount}</b></div>
        <div><small>Possible duplicates</small><b>${dupCount}</b></div>
        <div><small>Potential value (published)</small><b>${fmt(potentialValue)}</b></div>
      </div>
      <div id="dashboardExtraCharts" class="dashboard-charts-grid"></div>
      <div class="security-note"><span>🔒</span><div><b>Security note</b>No DevelopmentAid or Grants.gov credential is stored in this interface, its code or the repository — connection keys live in backend environment variables only.</div></div>
    </section>`;
  }

  function rebuildDashboard(){
    const view=q('#dashboardView');if(!view)return;
    const relevantCount=typeof activeOpportunities==='function'?activeOpportunities().length:records.length;
    const discardedCount=(typeof discarded!=='undefined'?discarded:[]).length;
    const potentialValue=records.reduce((sum,o)=>{const match=/\$([0-9.]+)\s?(million|M|thousand|K)\b/i.exec(o.value||'');if(!match)return sum;const unit=match[2].toLowerCase();const mult=unit==='million'||unit==='m'?1e6:unit==='thousand'||unit==='k'?1e3:1;return sum+Number(match[1])*mult},0);
    const fmtValue=n=>n>=1e6?`$${(n/1e6).toFixed(1)}M`:n>=1e3?`$${Math.round(n/1e3)}K`:`$${n}`;
    const updatedAt=new Date().toLocaleString('en-US',{dateStyle:'medium',timeStyle:'short'});
    view.innerHTML=`<section class="dashboard-title-row"><div><p class="eyebrow">BUSINESS DEVELOPMENT INTELLIGENCE</p><h1>Global Health Opportunities Dashboard</h1><p>Computed live from the current search results.</p></div><div><small>Last updated <b>${updatedAt}</b></small></div></section><section class="executive-kpis">${[['◎','OPPORTUNITIES IDENTIFIED',String(records.length),'from this search'],['▤','RELEVANT',String(relevantCount),'passed all screening rules'],['✕','DISCARDED',String(discardedCount),'excluded with a traceable reason'],['◉','POTENTIAL VALUE',fmtValue(potentialValue),'sum of published budgets']].map(x=>`<article><i>${x[0]}</i><span><small>${x[1]}</small><b>${x[2]}</b><p>${x[3]}</p></span></article>`).join('')}</section><section class="dashboard-detail-grid single"><aside class="dashboard-copilot"><p class="eyebrow">✦ &nbsp; ACESO COPILOT</p><h2>Ask anything about global health opportunities.</h2>${['Which regions have the most opportunities?','Show upcoming deadlines this quarter','What are our top sources by value?'].map(x=>`<button>${x}<b>→</b></button>`).join('')}<label><input placeholder="Ask a question..."><button>→</button></label><div class="copilot-answer" hidden></div></aside></section>`;
    const kpis=q('.executive-kpis',view);if(kpis)kpis.insertAdjacentHTML('afterend',`<section class="dashboard-world"><div class="world-orbit" data-interactive-globe><svg role="img" aria-label="Interactive globe showing Aceso opportunity activity. Drag to rotate and select an illuminated country."></svg><span class="globe-instruction">Drag to explore</span></div><div><p class="eyebrow">GLOBAL OPPORTUNITY RADAR</p><h2>Activity across <span data-globe-country-count>0</span> countries</h2><p>Live results from this search's six sources. Brighter points indicate a higher concentration of relevant notices.</p><div class="world-stats" data-globe-top-countries><span><b>0</b>Running the first search…</span></div></div></section>`);
    if(typeof window.refreshGlobeActivity==='function')window.refreshGlobeActivity();
    view.insertAdjacentHTML('beforeend',roiDashboardHTML());
    document.dispatchEvent(new CustomEvent('aceso:dashboard-ready'));
    const copilot=q('.dashboard-copilot',view),detailGrid=q('.dashboard-detail-grid',view);
    if(copilot&&detailGrid){copilot.classList.add('copilot-bar');detailGrid.after(copilot);copilot.insertAdjacentHTML('afterbegin','<div class="copilot-bar-intro"><p class="eyebrow">✦ &nbsp; ACESO COPILOT</p><strong>Your opportunity intelligence agent</strong></div>')}
    qa('.dashboard-feature-grid header button,.dashboard-detail-grid header button',view).forEach(b=>b.onclick=()=>notify(`${b.textContent.replace('→','').trim()} opened.`));
    bindCopilot(view);
  }

  function buildCopilotContext(){
    const all=typeof records!=='undefined'?records:(typeof opportunities!=='undefined'?opportunities:[]);
    const discardedList=typeof discarded!=='undefined'?discarded:[];
    const bySource={},byRegion={},byPillar={};
    all.forEach(o=>{if(o.source)bySource[o.source]=(bySource[o.source]||0)+1;if(o.country)byRegion[o.country]=(byRegion[o.country]||0)+1;if(o.pillar)byPillar[o.pillar]=(byPillar[o.pillar]||0)+1});
    const topOpportunities=all.slice().sort((a,b)=>(b.score||0)-(a.score||0)).slice(0,10).map(o=>({title:o.title,org:o.org,country:o.country,score:o.score,value:o.value,due:o.due,pillar:o.pillar}));
    const pipeline=typeof window.pipelineStats==='function'?window.pipelineStats():null;
    return {
      totalOpportunitiesFound: all.length+discardedList.length,
      relevantOpportunities: all.length,
      discardedCount: discardedList.length,
      byResultsSource: bySource, byCountry: byRegion, byTheme: byPillar,
      topOpportunitiesByFit: topOpportunities,
      examplePipeline: pipeline ? { note: 'This is illustrative example data for demos, not a real live pipeline.', stageOrder: pipeline.stages, stageCounts: pipeline.counts, totalPipelineValue: pipeline.totalValue } : null
    };
  }

  async function askCopilot(question, view){
    question=(question||'').trim();
    const scope=view||document;
    const answerBox=q('.copilot-answer',scope);
    if(!question){ if(answerBox){answerBox.hidden=false;answerBox.innerHTML='<p class="copilot-note">Type a question for Aceso Copilot.</p>'} return; }
    const buttons=qa('.dashboard-copilot button',scope), input=q('.dashboard-copilot input',scope);
    buttons.forEach(b=>b.disabled=true); if(input)input.disabled=true;
    if(answerBox){answerBox.hidden=false;answerBox.innerHTML='<p class="copilot-note">Thinking… this shares Gemini\'s rate limit with search scoring, so it can take a bit if a search is running.</p>'}
    try{
      const res=await fetch('/api/copilot',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({question,context:buildCopilotContext()})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok||data.error){ if(answerBox)answerBox.innerHTML=`<p class="copilot-note">${escapeHtml(data.error||`HTTP ${res.status}`)}</p>`; }
      else if(answerBox){ answerBox.innerHTML=`<p class="copilot-q">${escapeHtml(question)}</p><p class="copilot-a">${escapeHtml(data.answer)}</p>`; }
    }catch(err){ if(answerBox)answerBox.innerHTML=`<p class="copilot-note">Copilot request failed: ${escapeHtml(err.message)}</p>`; }
    finally{ buttons.forEach(b=>b.disabled=false); if(input)input.disabled=false; }
  }

  function bindCopilot(view){
    qa('.dashboard-copilot>button',view).forEach(b=>b.onclick=()=>askCopilot(b.textContent.replace('→','').trim(),view));
    const input=q('.dashboard-copilot input',view), send=q('.dashboard-copilot label button',view);
    if(send)send.onclick=()=>askCopilot(input?.value,view);
    if(input)input.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();askCopilot(input.value,view)}};
  }

  function installGlobalCopilot(){
    if(q('#globalCopilotDock'))return;
    const dock=document.createElement('div');
    dock.id='globalCopilotDock';
    dock.className='global-copilot-dock';
    dock.innerHTML=`<div class="dashboard-copilot copilot-float" id="globalCopilotPanel" hidden><p class="eyebrow">✦ &nbsp; ACESO COPILOT</p><h2>Ask anything about global health opportunities.</h2>${['Which regions have the most opportunities?','Show upcoming deadlines this quarter','What are our top sources by value?'].map(x=>`<button type="button">${x}<b>→</b></button>`).join('')}<label><input placeholder="Ask a question..."><button type="button">→</button></label><div class="copilot-answer" hidden></div></div><button type="button" class="copilot-launcher" id="copilotLauncher" aria-expanded="false" aria-controls="globalCopilotPanel">✦ <span>Aceso Copilot</span></button>`;
    document.body.appendChild(dock);
    const panel=q('#globalCopilotPanel',dock),launcher=q('#copilotLauncher',dock);
    const setOpen=open=>{
      panel.hidden=!open;
      launcher.setAttribute('aria-expanded',String(open));
      launcher.innerHTML=open?'✕ <span>Close</span>':'✦ <span>Aceso Copilot</span>';
      if(open)setTimeout(()=>q('input',panel)?.focus(),50);
    };
    launcher.onclick=()=>setOpen(panel.hidden);
    document.addEventListener('keydown',e=>{if(e.key==='Escape'&&!panel.hidden)setOpen(false)});
    // launcher.innerHTML changes on click, which can detach the exact node the
    // click landed on before this listener runs — composedPath() reflects the
    // event's original path, so it stays correct even after that mutation.
    document.addEventListener('click',e=>{if(!panel.hidden&&!e.composedPath().includes(dock))setOpen(false)});
    bindCopilot(panel);
  }

  const priorShow=window.showView;
  window.showView=function(name){priorShow(name);if(name==='pipeline')setTimeout(installPipelineTools);if(name==='dashboard')rebuildDashboard()};
  qa('.navlinks button').forEach(b=>b.onclick=()=>window.showView(b.dataset.view));
  mergeOpportunityNavigation();installTodayTools();reliableSelection();installPipelineTools();installDrawer();rebuildDashboard();installGlobalCopilot();
  document.addEventListener('click',e=>{const link=e.target.closest('a[href="#"]');if(!link)return;e.preventDefault();notify('The supporting source would open here in the connected pilot.')});
})();
