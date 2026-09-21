(() => {
  const projectRecords=[
    {title:'Health Financing Reform',client:'Ministry of Health',country:'Ghana',year:'2025',area:'Health financing',files:8},
    {title:'Domestic Resource Mobilization',client:'World Bank',country:'Nigeria',year:'2024',area:'Fiscal policy',files:12},
    {title:'Provider Payment Assessment',client:'Gates Foundation',country:'Kenya',year:'2024',area:'Provider payments',files:6},
    {title:'UHC Transition Strategy',client:'IFC',country:'Vietnam',year:'2023',area:'Universal health coverage',files:9}
  ];
  const peopleRecords=[
    {name:'Ana Ruiz',role:'Health Financing Lead',areas:'Fiscal space · UHC · Public expenditure',projects:14,cv:'Ana-Ruiz-CV-2026.pdf'},
    {name:'Javier Morales',role:'Senior Health Systems Advisor',areas:'Service delivery · Provider payments',projects:11,cv:'Javier-Morales-CV-2026.pdf'},
    {name:'Sofía Castro',role:'Business Development Analyst',areas:'Digital health · Evidence review',projects:8,cv:'Sofia-Castro-CV-2026.pdf'},
    {name:'Mariana López',role:'Proposal Manager',areas:'Proposal strategy · Compliance',projects:17,cv:'Mariana-Lopez-CV-2026.pdf'}
  ];
  let activeTab='projects';
  let editingIndex=null;
  const q=(s,r=document)=>r.querySelector(s),qa=(s,r=document)=>[...r.querySelectorAll(s)];

  function enhanceFinancialAccess(){
    const kpis=q('#dashboardView .executive-kpis');
    if(!kpis||q('#dashboardView .financial-access-card'))return;
    kpis.insertAdjacentHTML('afterend',`<section class="financial-access-card" aria-label="Restricted financial indicators"><div class="financial-lock" aria-hidden="true">⌾</div><div class="financial-copy"><p class="eyebrow">RESTRICTED FINANCIAL INTELLIGENCE</p><h2>Financial indicators</h2><p>Portfolio margin, proposal investment, expected return and awarded revenue are limited to authorized Finance and Director profiles.</p><span>Private by role · Access activity is logged</span></div><div class="financial-preview" aria-hidden="true"><span><small>PORTFOLIO MARGIN</small><b>••%</b></span><span><small>PIPELINE VALUE</small><b>$••M</b></span><span><small>EXPECTED RETURN</small><b>••×</b></span></div><button type="button" id="financialAccess"><span>Restricted access</span>Request permission&nbsp;→</button></section>`);
    q('#financialAccess').onclick=()=>toast('Access request sent to the Finance and Director administrators.');
  }

  function enhanceDashboard(){
    const row=q('#dashboardView .dashboard-title-row');if(!row)return;
    enhanceFinancialAccess();
    if(q('.dashboard-period',row))return;
    const controls=row.lastElementChild;
    controls.innerHTML=`<div class="dashboard-filter-shell"><div class="dashboard-filter-top"><span class="period-summary"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg></i><span><small>Reporting period</small><strong id="periodLabel">Sep 2025 – Sep 2026</strong></span></span><div class="dashboard-period"><button data-period="week">Week</button><button data-period="month">Month</button><button class="active" data-period="year">Year</button><button data-period="custom">Custom</button></div></div><div class="custom-dates" hidden><div class="date-range-copy"><small>Custom range</small><b>Choose the exact window</b></div><label><span>From</span><div><input type="date" value="2025-09-01"></div></label><i aria-hidden="true"></i><label><span>To</span><div><input type="date" value="2026-09-07"></div></label><button>Apply range <b>→</b></button></div></div>`;
    const updateMetrics=period=>{const sets={week:['9','2','1','0','$0'],month:['37','8','6','2','$740K'],year:['214','31','25','7','$3.1M'],custom:['86','14','11','3','$1.4M']},values=sets[period];qa('.executive-kpis article>span>b').forEach((node,index)=>{const delta=node.querySelector('em')?.outerHTML||'';node.innerHTML=`${values[index]} ${delta}`});q('.dashboard-world h2').textContent=period==='week'?'Activity across 12 countries':period==='month'?'Activity across 31 countries':period==='custom'?'Activity across the selected period':'Activity across 68 countries'};
    qa('[data-period]',controls).forEach(button=>button.onclick=()=>{qa('[data-period]',controls).forEach(x=>x.classList.toggle('active',x===button));const custom=q('.custom-dates',controls);custom.hidden=button.dataset.period!=='custom';if(button.dataset.period!=='custom'){q('#periodLabel').textContent={week:'Last 7 days',month:'Last 30 days',year:'Last 12 months'}[button.dataset.period];updateMetrics(button.dataset.period);toast('Dashboard updated for '+q('#periodLabel').textContent.toLowerCase()+'.')}});
    q('.custom-dates button',controls).onclick=()=>{const dates=qa('.custom-dates input',controls);if(!dates[0].value||!dates[1].value||dates[0].value>dates[1].value){toast('Choose a valid start and end date.');return}q('#periodLabel').textContent=`${dates[0].value} – ${dates[1].value}`;updateMetrics('custom');toast('Dashboard updated for the selected dates.')};
  }

  function renderKnowledge(){
    const content=q('#knowledgeContent');if(!content)return;
    qa('[data-knowledge-tab]').forEach(button=>button.classList.toggle('active',button.dataset.knowledgeTab===activeTab));
    if(activeTab==='projects')content.innerHTML=`<div class="knowledge-tools"><label>Search projects<input id="knowledgeSearch" type="search" placeholder="Project, client, country or area"></label><label>Area<select id="knowledgeArea"><option>All areas</option><option>Health financing</option><option>Fiscal policy</option><option>Provider payments</option></select></label></div><div class="knowledge-table"><header><span>Project</span><span>Client &amp; country</span><span>Area</span><span>Year</span><span>Evidence</span><span></span></header>${projectRecords.map((p,i)=>`<article data-search="${Object.values(p).join(' ').toLowerCase()}"><span><b>${p.title}</b><small>Completed project</small></span><span><b>${p.client}</b><small>${p.country}</small></span><span>${p.area}</span><span>${p.year}</span><span><b>${p.files} files</b><small>Deliverables &amp; references</small></span><button data-update-project="${i}">Update →</button></article>`).join('')}</div>`;
    else content.innerHTML=`<div class="knowledge-tools"><label>Search team<input id="knowledgeSearch" type="search" placeholder="Name, role or expertise"></label><label>Availability<select><option>All profiles</option><option>Available</option><option>Assigned</option></select></label></div><div class="people-grid">${peopleRecords.map((p,i)=>`<article data-search="${Object.values(p).join(' ').toLowerCase()}"><header><i class="person-photo person-photo-${i%4}" aria-hidden="true"></i><span><b>${p.name}</b><small>${p.role}</small><em>${i===1?'Assigned':'Available for proposals'}</em></span></header><p>${p.areas}</p><div class="profile-evidence"><span><small>Project experience</small><b>${p.projects} projects</b></span><span><small>Current CV</small><b>▤ ${p.cv}</b></span></div><footer><button type="button" data-update-person="${i}">View profile</button><label>Replace CV<input type="file" data-cv="${i}" accept=".pdf,.doc,.docx"></label></footer></article>`).join('')}</div>`;
    const search=q('#knowledgeSearch');if(search)search.oninput=()=>qa('[data-search]',content).forEach(row=>row.hidden=!row.dataset.search.includes(search.value.toLowerCase()));
    qa('[data-update-project]',content).forEach(button=>button.onclick=()=>openEditor(Number(button.dataset.updateProject)));
    qa('[data-update-person]',content).forEach(button=>button.onclick=()=>openEditor(Number(button.dataset.updatePerson)));
    qa('[data-cv]',content).forEach(input=>input.onchange=()=>{const p=peopleRecords[Number(input.dataset.cv)];if(input.files[0]){p.cv=input.files[0].name;renderKnowledge();toast(`${p.name}'s CV was updated.`)}});
  }

  function openEditor(index=null){
    editingIndex=index;const editor=q('#knowledgeEditor');const current=index===null?null:(activeTab==='projects'?projectRecords[index]:peopleRecords[index]);
    editor.hidden=false;
    editor.innerHTML=activeTab==='projects'?`<header><b>${current?'Update project':'Add project'}</b><button type="button" data-close-editor>×</button></header><div><label>Project<input name="title" required value="${current?.title||''}"></label><label>Client<input name="client" required value="${current?.client||''}"></label><label>Country<input name="country" required value="${current?.country||''}"></label><label>Area<input name="area" required value="${current?.area||''}"></label><label>Year<input name="year" required value="${current?.year||'2026'}"></label></div><button class="primary">Save project</button>`:`<header><b>${current?'Update team profile':'Add team profile'}</b><button type="button" data-close-editor>×</button></header><div><label>Name<input name="name" required value="${current?.name||''}"></label><label>Role<input name="role" required value="${current?.role||''}"></label><label>Expertise<input name="areas" required value="${current?.areas||''}"></label><label>Projects<input name="projects" type="number" required value="${current?.projects||0}"></label><label>CV<input name="cv" value="${current?.cv||''}"></label></div><button class="primary">Save profile</button>`;
    q('[data-close-editor]',editor).onclick=()=>editor.hidden=true;
    editor.onsubmit=event=>{event.preventDefault();const data=Object.fromEntries(new FormData(editor));if(activeTab==='projects'){data.files=current?.files||0;editingIndex===null?projectRecords.unshift(data):Object.assign(projectRecords[editingIndex],data)}else{data.projects=Number(data.projects);editingIndex===null?peopleRecords.unshift(data):Object.assign(peopleRecords[editingIndex],data)}editor.hidden=true;renderKnowledge();toast(activeTab==='projects'?'Project database updated.':'Team profile updated.')};
    editor.scrollIntoView({behavior:'smooth',block:'nearest'});
  }

  qa('[data-knowledge-tab]').forEach(button=>button.onclick=()=>{activeTab=button.dataset.knowledgeTab;renderKnowledge()});
  q('#addKnowledgeRecord')?.addEventListener('click',()=>openEditor());
  document.addEventListener('aceso:dashboard-ready',enhanceDashboard);
  const priorShow=window.showView;window.showView=function(name){priorShow(name);if(name==='dashboard')setTimeout(enhanceDashboard);if(name==='knowledge')renderKnowledge()};
  qa('.navlinks button').forEach(button=>button.onclick=()=>window.showView(button.dataset.view));
  enhanceDashboard();renderKnowledge();
})();
