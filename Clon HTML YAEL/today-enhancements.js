document.addEventListener('DOMContentLoaded', () => {
  const selectionBar = document.querySelector('#selectionBar');
  const selectedCount = document.querySelector('#selectedCount');
  const reviewButton = document.querySelector('#sendReview');

  document.querySelector('#todayList')?.addEventListener('change', () => {
    const count = document.querySelectorAll('#todayList input[type="checkbox"]:checked').length;
    selectionBar?.classList.toggle('show', count > 0);
    if (selectedCount) selectedCount.textContent = `${count} selected`;
    if (reviewButton) reviewButton.disabled = count === 0;
  });

  const excluded = document.querySelector('#excludedContent');
  if (excluded) {
    const cases = [
      { flag: '🇳🇬', source: 'African Development Bank', country: 'Nigeria', title: 'Hospital Equipment Procurement Program', reason: 'Procurement of goods', explanation: 'The scope is the purchase and installation of medical equipment; it does not require health-systems advisory services.', rule: 'Quick knock-out 2.1 · Procurement and supply contracts' },
      { flag: '🇬🇭', source: 'World Bank', country: 'Ghana', title: 'District Hospital Construction Supervision', reason: 'Infrastructure', explanation: 'The assignment is limited to construction supervision and does not include policy, financing or health-systems advisory work.', rule: 'Quick knock-out 2.3 · Civil works and infrastructure' },
      { flag: '🇹🇿', source: 'Ministry of Health', country: 'Tanzania', title: 'National Health Insurance Local Counsel', reason: 'National firm only', explanation: 'The notice requires a nationally registered firm and does not permit a consortium or international partner route.', rule: 'Mandatory criterion 1.4 · Applicant eligibility' },
      { flag: '🇺🇬', source: 'UNICEF', country: 'Uganda', title: 'Supply Chain Warehousing and Distribution · Lot 1', reason: 'Procurement of goods', explanation: 'The deliverables focus on warehousing and physical distribution rather than technical assistance or health-systems consulting.', rule: 'Quick knock-out 2.1 · Procurement and supply contracts' },
      { flag: '🇿🇲', source: 'African Development Bank', country: 'Zambia', title: 'Regional Hospital Civil Works Program · Lot 2', reason: 'Infrastructure', explanation: 'The opportunity concerns civil works execution and does not match Aceso’s advisory service model.', rule: 'Quick knock-out 2.3 · Civil works and infrastructure' },
      { flag: '🇪🇹', source: 'WHO', country: 'Ethiopia', title: 'Individual Consultant for Health Information Systems', reason: 'Individual consultant', explanation: 'The procurement is restricted to an individual consultant rather than an eligible consulting firm.', rule: 'Mandatory criterion 1.1 · Applicant type' },
      { flag: '🌐', source: 'Coefficient Giving', country: 'Global', title: 'Global Health Grantmaking Trends — 2026 Outlook', reason: 'Not an RFP', explanation: 'The monitor found this on the Global Health & Wellbeing Opportunities page, but it is an editorial article, not a request for proposals — no eligibility, deadline or submission process was published.', rule: 'Source classification 3.2 · Coefficient Giving content filter (RFPs only)' }
    ];
    excluded.innerHTML = cases.map((item, index) => `
      <article class="excluded-case ${index === 0 ? 'open' : ''}">
        <button class="excluded-case-head" aria-expanded="${index === 0}">
          <span class="country-flag">${item.flag}</span>
          <span class="excluded-case-title"><small>${item.source} · ${item.country}</small><b>${item.title}</b></span>
          <span class="excluded-case-reason">${item.reason}</span><span class="case-chevron">›</span>
        </button>
        <div class="excluded-explanation"><small>WHY THIS IS NOT A MATCH</small><p>${item.explanation}</p><b>${item.rule}</b><div><button class="keep-excluded">Keep excluded</button><button class="recover-case">Recover for human review</button></div></div>
      </article>`).join('');

    excluded.querySelectorAll('.excluded-case-head').forEach((button) => button.addEventListener('click', () => {
      const card = button.closest('.excluded-case');
      card.classList.toggle('open');
      button.setAttribute('aria-expanded', card.classList.contains('open'));
    }));
    excluded.querySelectorAll('.keep-excluded').forEach((button) => button.addEventListener('click', () => {
      button.closest('.excluded-case').classList.remove('open');
    }));
    excluded.querySelectorAll('.recover-case').forEach((button) => button.addEventListener('click', () => {
      button.textContent = 'Sent to human review';
      button.disabled = true;
    }));
  }
});
