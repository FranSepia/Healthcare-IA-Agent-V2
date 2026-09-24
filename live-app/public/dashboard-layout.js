// Dashboard layout: places every chart card (from dashboard-charts.js and
// dashboard-insights.js) into themed sections on one 3-column grid, so the
// page reads as one system instead of charts bolted on over time.
//
// Width is chosen per chart type: ranked lists, donuts and small multiples
// get one column; flows get two; timelines and wide networks get all three.
(() => {
  const q = (s, r = document) => r.querySelector(s);

  // [source, id, span] — source 'c' = dashboard-charts.js, 'i' = dashboard-insights.js
  const SECTIONS = [
    { id: 'time', eyebrow: 'PRODUCTIVITY', title: 'Analyst time saved', hours: true },
    { id: 'deadlines', eyebrow: 'DEADLINES', title: 'What is closing, and how ready we are',
      cards: [['i', 'deadlineReadiness', 1], ['i', 'submissionDeadlines', 1], ['c', 'upcomingDeadlines', 1]] },
    { id: 'fit', eyebrow: 'SCREENING & FIT', title: 'How the agent filtered this search',
      cards: [['i', 'conversionFunnel', 1], ['c', 'fitTiers', 1], ['c', 'fitDistribution', 1],
        ['c', 'searchToDecision', 2], ['c', 'fitBySource', 1]] },
    { id: 'sources', eyebrow: 'SOURCES, FUNDERS & THEMES', title: 'Where the opportunities come from',
      cards: [['c', 'resultsBySource', 1], ['i', 'topFunders', 1], ['c', 'topCountries', 1],
        ['c', 'opportunitiesByTheme', 1], ['c', 'commonThemes', 1], ['i', 'publicationTrend', 1],
        ['c', 'sourcesToThemes', 3]] },
    { id: 'pipeline', eyebrow: 'PIPELINE & VALUE', title: 'Pursuits and potential value',
      sub: 'The pipeline is illustrative example data until approvals are tracked in the app.',
      cards: [['c', 'pipelineOverview', 1], ['i', 'decisionQuality', 1], ['c', 'valueByTheme', 1],
        ['c', 'fitVsValue', 3]] }
  ];

  function cardHTML(card, span, key) {
    if (!card) return '';
    return `<section class="dcard span-${span}" data-card="${key}">
      <header class="dcard-head"><div><h3>${card.title}</h3>${card.sub ? `<p>${card.sub}</p>` : ''}</div>${card.note ? `<span class="dcard-note">${card.note}</span>` : ''}${card.aside || ''}</header>
      <div class="dcard-body">${card.body}</div>
      ${card.foot ? `<footer class="dcard-foot">${card.foot}</footer>` : ''}
    </section>`;
  }

  function sectionHTML(sec, charts, insights) {
    const head = `<header class="dsection-head"><p class="eyebrow">${sec.eyebrow}</p><h2>${sec.title}</h2>${sec.sub ? `<p>${sec.sub}</p>` : ''}</header>`;
    if (sec.hours) return `<section class="dsection" id="dsec-${sec.id}">${head}<div class="dgrid"><section id="analystHours" class="dcard span-3 analyst-hours"></section></div></section>`;
    const cards = sec.cards.map(([src, key, span]) => cardHTML((src === 'c' ? charts : insights)[key], span, key)).join('');
    return `<section class="dsection" id="dsec-${sec.id}">${head}<div class="dgrid">${cards}</div></section>`;
  }

  function sources() {
    return {
      charts: typeof window.dashboardChartCards === 'function' ? window.dashboardChartCards() : {},
      insights: typeof window.dashboardInsightCards === 'function' ? window.dashboardInsightCards() : {}
    };
  }

  function render() {
    const root = q('#dashSections');
    if (!root) return;
    const { charts, insights } = sources();
    root.innerHTML = SECTIONS.map(sec => sectionHTML(sec, charts, insights)).join('');
    if (typeof window.renderAnalystHours === 'function') window.renderAnalystHours(true);
  }

  // Re-render one section in place (e.g. a toggle) without replaying the
  // hours animation or moving the scroll position.
  function renderSection(id) {
    const el = q(`#dsec-${id}`);
    const sec = SECTIONS.find(s => s.id === id);
    if (!el || !sec) return;
    const { charts, insights } = sources();
    el.outerHTML = sectionHTML(sec, charts, insights);
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('#dashSections [data-trend]');
    if (!btn || typeof window.setInsightTrendMode !== 'function') return;
    window.setInsightTrendMode(btn.dataset.trend);
    renderSection('sources');
  });
  document.addEventListener('aceso:dashboard-ready', render);
  document.addEventListener('aceso:live-search-complete', () => { if (q('#dashSections')) render(); });
})();
