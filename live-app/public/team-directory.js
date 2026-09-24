(() => {
  const people = [
    {name:'Maureen Lewis',role:'CEO & Founding Director',group:'Leadership',photo:'maureen-lewis.webp',areas:['Health-system reform','Health economics','Governance','Global health strategy'],summary:'Dr. Lewis has more than 25 years of experience advising government and private-sector leaders on health-system reform. She previously served as Chief Economist for Human Development at the World Bank and has authored more than 75 research publications and five books.'},
    {name:'Jerry La Forgia',role:'CTO & Founding Director',group:'Leadership',photo:'jerry-la-forgia.webp',areas:['Hospital governance','Quality of care','Health insurance','Public-private partnerships'],summary:'Dr. La Forgia is a global health and hospital-systems specialist who previously led World Bank health work in China, India and Brazil. His work focuses on hospital management, quality, insurance and private-sector participation in health-service delivery.'},
    {name:'Jonty Roland',role:'Associate Director',group:'Leadership',photo:'jonty-roland.webp',areas:['Health-system reform','Universal health coverage','Health financing','Strategy'],summary:'Jonty Roland advises governments, global organizations and private-sector clients on health-system design, financing and universal health coverage. He has worked in more than 25 countries and previously led UHC engagements across 18 countries for KPMG.'},
    {name:'Scott Wells',role:'Operations Director',group:'Leadership',photo:'scott-wells.webp',areas:['Finance','Human resources','Contracts','Nonprofit operations'],summary:'Scott Wells manages Aceso Global’s finance, human resources, contracts and internal services. He brings two decades of nonprofit-management experience, including service as Operations Director of the Sunlight Foundation.'},

    {name:'Mattias K. A. Lundberg',role:'Senior Economist',group:'Core team',photo:'mattias-lundberg.webp',areas:['Human development','Food security and nutrition','Primary health services','HIV/AIDS and TB'],summary:'Dr. Lundberg has more than 25 years of experience as a World Bank economist across human development, crisis response, jobs, food security, nutrition and infectious disease. His research includes incentives in primary care, health behavior and cost-effectiveness.'},
    {name:'Jack Langenbrunner',role:'Senior Associate',group:'Core team',photo:'jack-langenbrunner.webp',areas:['Health financing','Strategic purchasing','Universal health coverage','Indonesia and Asia'],summary:'Dr. Langenbrunner has more than 35 years of experience advising governments on health-system reform. A former World Bank Lead Health Economist, he specializes in financing, strategic purchasing, social health insurance and UHC implementation.'},
    {name:'Mariam M. Hamza',role:'Health Economist',group:'Core team',photo:'mariam-hamza.webp',areas:['Health financing','Human resources for health','Economic evaluation','MENA, Africa and East Asia'],summary:'Dr. Hamza supports health-system strengthening through health economics, quantitative research and evaluation. Her experience spans ten countries and includes health financing, workforce policy, discrete-choice experiments and quasi-experimental methods.'},
    {name:'Lizeth Hernandez-Rubio',role:'Senior Economist',group:'Core team',photo:'lizeth-hernandez-rubio.webp',areas:['Health financing','Evidence-based decisions','Health-system strengthening','LAC and ASEAN'],summary:'Lizeth Hernandez-Rubio works on health management and system-strengthening initiatives in low- and middle-income countries. Her expertise combines financing, evaluation and data analysis, with additional experience in genomic surveillance and vaccine development.'},
    {name:'Megan McGuire',role:'Program Manager',group:'Core team',photo:'megan-mcguire.webp',areas:['Global health security','Pandemic preparedness','Health innovation','One Health'],summary:'Megan McGuire manages programs focused on health-system strengthening and global health security. Her background includes pandemic preparedness, zoonoses, disease control, health policy and international advocacy.'},
    {name:'Maya Rallapalli',role:'Project Coordinator',group:'Core team',photo:'maya-rallapalli.webp',areas:['Health financing','Private-sector engagement','Sub-Saharan Africa','Communications'],summary:'Maya Rallapalli supports health-financing and private-sector engagement projects in low- and middle-income countries. Her experience also includes hospital operations, pharmaceutical consulting in Southeast Asia, communications and outreach.'},
    {name:'Sawyer Dixon',role:'Project Coordinator',group:'Core team',photo:'sawyer-dixon.webp',areas:['Health economics','Public health systems','LAC, Africa and Southeast Asia','Risk analysis'],summary:'Sawyer Dixon supports projects strengthening public-health systems across Latin America, Sub-Saharan Africa and Southeast Asia. His background combines economics, mathematics, enterprise risk and public-sector consulting.'},
    {name:'Kirby McDonald',role:'Analyst',group:'Core team',photo:'kirby-mcdonald.webp',areas:['Health financing','Social health insurance','Service-delivery models','Latin America'],summary:'Kirby McDonald supports work on health financing, social health insurance and service-delivery models in low- and middle-income countries. She also brings research experience and professional Spanish.'},
    {name:'Brendan Lawler',role:'Analyst',group:'Core team',photo:'brendan-lawler.webp',areas:['Health security','Health economics','Public-health communication','Population health'],summary:'Brendan Lawler works at the intersection of global health security, economics and public-health communication. His background includes research on health misinformation and experience implementing population-health management systems.'},
    {name:"Gráinne O'Casey",role:'Analyst',group:'Core team',photo:'grainne-ocasey.webp',areas:['Health economics','Health-system strengthening','Delivery models','Health-data analysis'],summary:'Gráinne O’Casey supports health economics, system-strengthening and service-delivery work in low- and middle-income countries. Her background includes population research, health-data analysis, economics and public policy.'},

    {name:'Ann Casanova',role:'Senior Non-Resident Associate',group:'Senior associates',photo:'ann-casanova.webp',areas:['Development strategy','Private-sector engagement','Global Fund, IFC and IDB','Program management'],summary:'Ann Casanova has more than 20 years of experience leading international-development projects and multidisciplinary teams across Latin America, Africa and Asia. Her work includes assignments for the Global Fund, IFC, IDB and USAID.'},
    {name:'Jasmine Sjarif',role:'Senior Non-Resident Associate',group:'Senior associates',photo:'jasmine-sjarif.webp',areas:['Universal health coverage','Primary care','Health-system resilience','Indonesia'],summary:'Jasmine Sjarif specializes in health systems, universal coverage, resilience and primary care across North America and Asia Pacific. She supports policy and implementation work in Indonesia and has private-sector healthcare consulting experience.'},
    {name:'Sofi Bergkvist',role:'Senior Non-Resident Associate',group:'Senior associates',photo:'sofi-bergkvist.webp',areas:['Universal health coverage','Health financing','Quality improvement','Asia'],summary:'Sofi Bergkvist advises governments, foundations and companies on UHC and health-system strengthening. She co-founded ACCESS Health International and has developed national and subnational insurance and quality-improvement programs.'},
    {name:'Michael Bourke',role:'Senior Non-Resident Associate',group:'Senior associates',photo:'michael-bourke.webp',areas:['Health information systems','Process redesign','IT strategy','Project management'],summary:'Dr. Bourke specializes in healthcare information systems, organizational assessment, process redesign and technology strategy. His consulting experience includes World Bank, IDB and USAID projects across multiple regions.'},
    {name:'Pedro Chequer',role:'Senior Non-Resident Associate',group:'Senior associates',photo:'pedro-chequer.webp',areas:['HIV/AIDS','Public-health leadership','Epidemiology','Latin America and Africa'],summary:'Dr. Chequer has more than 30 years of public-health leadership, with internationally recognized experience in HIV/AIDS, malaria and epidemiology. He has led national programs in Brazil and served in senior UNAIDS roles across several regions.'},
    {name:'Ioan Cleaton-Jones',role:'Senior Non-Resident Associate',group:'Senior associates',photo:'ioan-cleaton-jones.webp',areas:['Healthcare investment','Finance and due diligence','Private healthcare','Strategy and operations'],summary:'Dr. Cleaton-Jones combines clinical, investment and consulting experience across 33 countries. At IFC he worked on 72 healthcare projects and advised major portfolios covering hospitals, clinics, laboratories and related services.'},
    {name:'Sandra Dratler',role:'Senior Non-Resident Associate',group:'Senior associates',photo:'sandra-dratler.webp',areas:['Hospital operations','Governance','Capacity building','Strategy and finance'],summary:'Dr. Dratler has extensive experience managing and advising hospitals on operations, strategy, finance and governance. Her international work emphasizes institutional capacity building in Asia, Africa, Latin America and the Middle East.'},
    {name:'Robert Janett',role:'Senior Non-Resident Associate',group:'Senior associates',photo:'robert-janett.webp',areas:['Primary care','Health policy','Accountable care','Brazil and Latin America'],summary:'Dr. Janett is a practicing primary-care physician and academic who advises health organizations and international agencies. He has led primary-care improvement and accountable-care initiatives in the United States and Brazil.'},
    {name:'Rafael Mazin',role:'Senior Non-Resident Associate',group:'Senior associates',photo:'rafael-mazin.webp',areas:['HIV/AIDS','Program evaluation','Capacity building','Latin America'],summary:'Dr. Mazin is a public-health expert with more than 25 years of experience at PAHO. He has advised countries across the Americas on HIV/AIDS programs, monitoring and evaluation, human rights and stakeholder capacity building.'},
    {name:'Joanne Shear',role:'Senior Non-Resident Associate',group:'Senior associates',photo:'joanne-shear.webp',areas:['Clinical operations','Primary-care transformation','Implementation','Quality and risk'],summary:'Joanne Shear brings 38 years of federal healthcare experience across clinical operations, administration and implementation. She helped lead the U.S. Veterans Health Administration’s national patient-centered medical-home model.'},

    {name:'Eduardo González-Pier, PhD',role:'Board Chair',group:'Board',photo:'eduardo-gonzalez-pier.webp',areas:['Health financing','Social security','Domestic resource mobilization','Universal health coverage'],summary:'Eduardo González-Pier has more than 25 years of experience in health and social security. His leadership includes senior roles in the Mexican government and IMSS, as well as global work on sustainable financing and UHC.'},
    {name:'Les Funtleyder',role:'Board Member',group:'Board',photo:'les-funtleyder.webp',areas:['Healthcare investment','Medical technology','Managed care','Health innovation'],summary:'Les Funtleyder is a healthcare investor with experience across pharmaceuticals, medical technology, managed care, hospitals and health IT. He advises investors and organizations on the intersection of healthcare markets, policy and innovation.'},
    {name:'Patricia A. Moser, PhD',role:'Board Member',group:'Board',photo:'patricia-moser.webp',areas:['Health-policy evaluation','Sustainability and transition','Health financing','Global Fund and Gavi'],summary:'Dr. Moser has more than 30 years of experience evaluating global-health policies, institutions and financing reforms. Her work includes leadership and advisory assignments for the Global Fund, Gavi, ADB and USAID.'},
    {name:'William D. Savedoff, PhD',role:'Board Member',group:'Board',photo:'william-savedoff.webp',areas:['Health financing','Governance and corruption','Results-based financing','Public-service reform'],summary:'Dr. Savedoff studies how institutions, contracting and evaluation can improve public services in low- and middle-income countries. His experience includes IDB, WHO and Center for Global Development leadership and research.'},
    {name:'Manoj Mohanan, PhD',role:'Board Member',group:'Board',photo:'manoj-mohanan.webp',areas:['Health and development economics','Provider quality','Health insurance','Impact evaluation'],summary:'Dr. Mohanan is an applied economist whose research examines healthcare quality, insurance, contracting and social accountability in developing countries. He has led large-scale field experiments and influential health-policy research.'}
  ];

  const q=(s,r=document)=>r.querySelector(s);
  const qa=(s,r=document)=>[...r.querySelectorAll(s)];
  let group='All';

  const projectCatalog={
    financing:['Abu Dhabi Assessing Healthcare Financing Reforms','JLN Learning Exchange Innovative Financing and Delivery','Addressing Health Finance and Service Delivery Fragmentation: Lessons from Peru and OECD Countries'],
    hospital:['Assessing Healthcare Infrastructure Sector Opportunities','India Thematic Paper Phase I and Phase II – Healthcare Reform','Policy Notes on Regional Public Health Institutions, Integrated Care, and Rural Hospital Investment'],
    security:['ASEAN Pandemic Preparedness, Prevention, and Response Regional Collaboration','Patient Pathways and Pandemics: Covid-19 and Beyond for the Joint Learning Network on Universal Healthcare','Triaging the Patient Journey'],
    research:['Malaria Data Analysis','Patient Pathways in Malaysia','Assessing Healthcare Infrastructure Sector Opportunities'],
    private:['Global Fund Private Sector Engagement','Assessing Healthcare Infrastructure Sector Opportunities','JLN Learning Exchange Innovative Financing and Delivery'],
    primary:['Primary Healthcare Performance Management','Patient Pathways in Malaysia','Triaging the Patient Journey'],
    policy:['Policy Note on Regional Public Health Institutions','Implementation Learning Program on Identification of Poor and Vulnerable Households','Primary Healthcare Performance Management']
  };
  const verifiedProjects={
    'Ann Casanova':['Global Fund Private Sector Engagement']
  };

  function projectLinks(p){
    const text=[p.role,...p.areas,p.summary].join(' ').toLowerCase();
    const suggested=[];
    const add=key=>projectCatalog[key].forEach(title=>{if(!suggested.includes(title))suggested.push(title)});
    if(/financ|insurance|purchasing|economic|resource mobilization|universal health|uhc/.test(text))add('financing');
    if(/hospital|clinical operation|health information|governance|quality/.test(text))add('hospital');
    if(/pandemic|security|one health|disease|hiv|malaria|epidemiology/.test(text))add('security');
    if(/research|evaluation|data|economist|risk analysis/.test(text))add('research');
    if(/private|investment|ifc|partnership/.test(text))add('private');
    if(/primary|delivery|patient|implementation/.test(text))add('primary');
    if(/policy|capacity|institution|government|strategy/.test(text))add('policy');
    const verified=verifiedProjects[p.name]||[];
    return {verified,suggested:suggested.filter(title=>!verified.includes(title)).slice(0,3)};
  }

  function card(p,index){
    const links=projectLinks(p);
    return `<button class="talent-card" type="button" data-person="${index}" data-search="${[p.name,p.role,p.group,...p.areas,...links.verified,...links.suggested].join(' ').toLowerCase()}"><img src="assets/${p.photo}" alt="${p.name}"><span><b>${p.name}</b><small>${p.role}</small></span><p><strong>Experience in</strong>${p.areas.slice(0,3).map(a=>`<em>${a}</em>`).join('')}</p><div class="talent-project-count"><b>${links.verified.length+links.suggested.length}</b><span>related project${links.verified.length+links.suggested.length===1?'':'s'}</span><small>${links.verified.length?'Public connection + expertise match':'Suggested by expertise'}</small></div><i>View experience →</i></button>`;
  }

  function render(){
    const content=q('#knowledgeContent');
    if(!content)return;
    const filtered=people.map((p,index)=>({p,index})).filter(({p})=>group==='All'||p.group===group);
    content.innerHTML=`<div class="talent-tools"><label>Search experience<input id="talentSearch" type="search" placeholder="Name, role, region or area of expertise"></label><div class="talent-groups">${['All','Leadership','Core team','Senior associates','Board'].map(x=>`<button type="button" class="${x===group?'active':''}" data-team-group="${x}">${x}</button>`).join('')}</div></div><div class="talent-count"><b>${filtered.length} people</b><span>Select a profile to review detailed experience.</span></div><div class="talent-grid">${filtered.map(({p,index})=>card(p,index)).join('')}</div><p class="talent-source">Profile information summarized from Aceso Global’s Who We Are page. Internal CVs, availability and project records can be added during implementation.</p>`;
    qa('[data-team-group]',content).forEach(b=>b.onclick=()=>{group=b.dataset.teamGroup;render()});
    q('#talentSearch',content).oninput=e=>qa('[data-search]',content).forEach(card=>card.hidden=!card.dataset.search.includes(e.target.value.toLowerCase()));
    qa('[data-person]',content).forEach(b=>b.onclick=()=>openProfile(people[Number(b.dataset.person)]));
  }

  function openProfile(p){
    const links=projectLinks(p);
    let modal=q('#talentModal');
    if(!modal){
      document.body.insertAdjacentHTML('beforeend','<div class="talent-modal" id="talentModal" aria-hidden="true"><button class="talent-modal-backdrop" aria-label="Close profile"></button><article role="dialog" aria-modal="true" aria-labelledby="talentModalName"><button class="talent-modal-close" aria-label="Close profile">×</button><div id="talentModalContent"></div></article></div>');
      modal=q('#talentModal');
      q('.talent-modal-close',modal).onclick=q('.talent-modal-backdrop',modal).onclick=closeProfile;
      document.addEventListener('keydown',e=>{if(e.key==='Escape')closeProfile()});
    }
    q('#talentModalContent',modal).innerHTML=`<header><img src="assets/${p.photo}" alt="${p.name}"><div><p>${p.group}</p><h2 id="talentModalName">${p.name}</h2><h3>${p.role}</h3></div></header><section><h4>Experience in</h4><div>${p.areas.map(a=>`<span>${a}</span>`).join('')}</div><p>${p.summary}</p></section><section class="talent-project-evidence"><h4>Related Aceso project experience</h4>${links.verified.map(title=>`<article class="verified"><i>Verified public connection</i><b>${title}</b></article>`).join('')}${links.suggested.map(title=>`<article><i>Suggested from profile expertise · validate with CV</i><b>${title}</b></article>`).join('')}<p>Project suggestions identify potentially relevant experience; they do not confirm participation until Aceso validates the internal CV or project record.</p></section><footer><b>Potential use in Aceso Intelligence</b><p>This experience can be matched against an opportunity’s country, technical scope and required qualifications. Final recommendations would be validated against the approved internal CV and current availability.</p></footer>`;
    modal.classList.add('show');modal.setAttribute('aria-hidden','false');document.body.classList.add('modal-open');q('.talent-modal-close',modal).focus();
  }

  function closeProfile(){const modal=q('#talentModal');if(modal){modal.classList.remove('show');modal.setAttribute('aria-hidden','true');document.body.classList.remove('modal-open')}}

  window.renderTeamDirectory=render;
  // Read by Aceso Copilot: the Team & CVs directory with each profile's project links.
  window.knowledgeBaseTeam=()=>people.map(p=>{const links=projectLinks(p);return {name:p.name,role:p.role,group:p.group,expertise:p.areas,profileSummary:p.summary,verifiedProjects:links.verified,suggestedProjectsToValidateWithCV:links.suggested}});
  const peopleTab=q('[data-knowledge-tab="people"]');
  if(peopleTab){peopleTab.innerHTML=`Team &amp; CVs <b>${people.length}</b>`;peopleTab.addEventListener('click',()=>setTimeout(render));}
})();
