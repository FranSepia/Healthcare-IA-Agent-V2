// Extra Dashboard visualizations, all driven by real data (live opportunities
// + the example pipeline in pipeline-enhancements.js). Each chart degrades to
// an honest "not enough data" state rather than inventing numbers to fill
// empty space. Follows live-app's dataviz skill: thin marks, rounded bar
// ends, hairline gridlines, one sequential hue for magnitude, a capped
// categorical set (3 slots + Other) for identity, hover tooltips.
(() => {
  const CATEGORICAL = ['#2a78d6', '#eb6834', '#1baf7a']; // palette slots 1-3 (validated all-pairs)
  const OTHER_COLOR = '#898781';
  const SEQ_BLUE = ['#cde2fb', '#9ec5f4', '#6da7ec', '#3987e5', '#2a78d6', '#1c5cab', '#104281'];

  function parseValue(str) {
    const m = /\$([0-9.]+)\s?(million|billion|thousand|M|K|B)?/i.exec(str || '');
    if (!m) return null;
    const n = Number(m[1]);
    if (Number.isNaN(n)) return null;
    const unit = (m[2] || '').toLowerCase();
    const mult = unit === 'billion' || unit === 'b' ? 1e9 : unit === 'million' || unit === 'm' ? 1e6 : unit === 'thousand' || unit === 'k' ? 1e3 : 1;
    return n * mult;
  }
  function fmtMoney(n) {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
    return `$${Math.round(n)}`;
  }

  function emptyState(label) {
    return `<div class="chart-empty">Not enough data yet for ${label} — run a search with more results.</div>`;
  }

  // ---- Horizontal bar chart (magnitude ranking, single sequential hue) ----
  function barChartHTML(rows, opts = {}) {
    if (!rows.length) return emptyState(opts.label || 'this chart');
    const max = Math.max(...rows.map(r => r.value)) || 1;
    return `<div class="viz-bars">${rows.slice(0, opts.limit || 8).map(r => { const name = escapeHtml(r.name), val = opts.fmt ? opts.fmt(r.value) : r.value; return `
      <div class="viz-bar-row" tabindex="0" aria-label="${name}: ${val}">
        <span class="viz-bar-label">${name}</span>
        <span class="viz-bar-track"><span class="viz-bar-fill" style="width:${Math.max(4, Math.round(r.value / max * 100))}%"></span></span>
        <span class="viz-bar-value">${val}</span>
        <span class="viz-bar-tip">${name}: ${val}</span>
      </div>`; }).join('')}</div>`;
  }

  // ---- Funnel (ordinal sequential ramp, widest-to-narrowest) ----
  function funnelHTML(stages, counts) {
    const total = counts[0] || 1;
    return `<div class="viz-funnel">${stages.map((s, i) => {
      const pct = Math.max(8, Math.round(counts[i] / total * 100));
      const color = SEQ_BLUE[3 + Math.min(3, i)];
      return `<div class="viz-funnel-row" tabindex="0" aria-label="${s}: ${counts[i]}"><span class="viz-funnel-label">${s}</span><span class="viz-funnel-track"><span class="viz-funnel-fill" style="width:${pct}%;background:${color}">${counts[i]}</span></span><span class="viz-funnel-tip">${s}: ${counts[i]} opportunit${counts[i] === 1 ? 'y' : 'ies'}</span></div>`;
    }).join('')}</div>`;
  }

  // ---- Scatter/bubble: fit score (x) vs. potential value (y), color by pillar (capped) ----
  function scatterHTML(points, opts = {}) {
    if (points.length < 3) return emptyState('a fit-vs-value scatter plot');
    const w = 560, h = 260, pad = { l: 46, r: 16, t: 12, b: 30 };
    const maxVal = Math.max(...points.map(p => p.value));
    const pillars = [...new Set(points.map(p => p.pillar))];
    const topPillars = pillars.slice(0, 3);
    const colorFor = pillar => { const i = topPillars.indexOf(pillar); return i >= 0 ? CATEGORICAL[i] : OTHER_COLOR; };
    const x = score => pad.l + (score / 100) * (w - pad.l - pad.r);
    const y = val => h - pad.b - (val / (maxVal || 1)) * (h - pad.t - pad.b);
    const gridlines = [0, 25, 50, 75, 100].map(gx => `<line x1="${x(gx)}" y1="${pad.t}" x2="${x(gx)}" y2="${h - pad.b}" class="viz-grid"/><text x="${x(gx)}" y="${h - pad.b + 16}" class="viz-axis-label" text-anchor="middle">${gx}</text>`).join('');
    const dots = points.map(p => `<circle cx="${x(p.score).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="6" fill="${colorFor(p.pillar)}" stroke="#fcfcfb" stroke-width="2" tabindex="0"><title>${escapeHtml(p.title)} — ${p.score}% fit, ${fmtMoney(p.value)}, ${escapeHtml(p.pillar)}</title></circle>`).join('');
    const legend = (topPillars.length > 1 ? topPillars.map((p, i) => `<span><i style="background:${CATEGORICAL[i]}"></i>${escapeHtml(p)}</span>`).join('') + (pillars.length > 3 ? `<span><i style="background:${OTHER_COLOR}"></i>Other</span>` : '') : '');
    return `<svg viewBox="0 0 ${w} ${h}" class="viz-scatter" role="img" aria-label="Fit score versus potential value scatter plot">${gridlines}<line x1="${pad.l}" y1="${h - pad.b}" x2="${w - pad.r}" y2="${h - pad.b}" class="viz-axis"/><text x="${w / 2}" y="${h - 4}" class="viz-axis-label" text-anchor="middle">Fit score</text>${dots}</svg>${legend ? `<div class="viz-legend">${legend}</div>` : ''}`;
  }

  // ---- Heatmap: submission deadlines by week ----
  function heatmapHTML(dueDates) {
    const now = new Date();
    const weeks = Array.from({ length: 10 }, (_, i) => {
      const start = new Date(now); start.setDate(now.getDate() + i * 7);
      return { start, count: 0 };
    });
    let plotted = 0;
    dueDates.forEach(d => {
      const date = new Date(d);
      if (Number.isNaN(date.getTime())) return;
      const diffDays = Math.floor((date - now) / 86400000);
      if (diffDays < 0 || diffDays >= 70) return;
      weeks[Math.floor(diffDays / 7)].count += 1;
      plotted += 1;
    });
    if (plotted < 2) return emptyState('a deadline heatmap');
    const max = Math.max(...weeks.map(w => w.count)) || 1;
    return `<div class="viz-heatmap">${weeks.map(w => {
      const step = w.count === 0 ? 0 : Math.max(1, Math.round(w.count / max * (SEQ_BLUE.length - 1)));
      return `<div class="viz-heat-cell" style="background:${step === 0 ? '#f0efec' : SEQ_BLUE[step]}" tabindex="0" aria-label="Week of ${w.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${w.count} deadlines"><span class="viz-heat-tip">${w.start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}: ${w.count}</span></div>`;
    }).join('')}</div><div class="viz-heat-labels"><span>Next 10 weeks</span><span>${max} peak/week</span></div>`;
  }

  // ---- Word cloud: keyword frequency (size-encoded, single hue) ----
  function wordCloudHTML(keywords) {
    const counts = new Map();
    keywords.forEach(k => { const key = k.trim(); if (key) counts.set(key, (counts.get(key) || 0) + 1); });
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 18);
    if (entries.length < 4) return emptyState('a theme word cloud');
    const max = entries[0][1];
    return `<div class="viz-wordcloud">${entries.map(([word, count]) => {
      const scale = 0.7 + (count / max) * 0.9;
      const opacity = 0.55 + (count / max) * 0.45;
      const safeWord = escapeHtml(word);
      return `<span style="font-size:${scale.toFixed(2)}em;opacity:${opacity.toFixed(2)}" tabindex="0" aria-label="${safeWord}: ${count} opportunities">${safeWord}</span>`;
    }).join('')}</div>`;
  }

  function computeAndRender() {
    const root = document.querySelector('#dashboardExtraCharts');
    if (!root) return;
    const opps = (typeof window.activeOpportunities === 'function' ? window.activeOpportunities() : window.opportunities) || [];

    const byPillar = {}; const byCountry = {}; const bySource = {};
    opps.forEach(o => { if (o.pillar) byPillar[o.pillar] = (byPillar[o.pillar] || 0) + 1; if (o.country) byCountry[o.country] = (byCountry[o.country] || 0) + 1; if (o.source) bySource[o.source] = (bySource[o.source] || 0) + 1; });
    const pillarRows = Object.entries(byPillar).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
    const countryRows = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
    const sourceRows = Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));

    const scatterPoints = opps.map(o => ({ title: o.title, score: o.score, value: parseValue(o.value), pillar: o.pillar })).filter(p => p.value);
    const dueDates = opps.map(o => o.due).filter(Boolean);
    const keywords = opps.flatMap(o => (o.meta && o.meta.keywords) || []);
    const pipeline = typeof window.pipelineStats === 'function' ? window.pipelineStats() : null;

    root.innerHTML = `
      <section class="chart-card">
        <p class="eyebrow">RESULTS BY SOURCE</p>
        ${barChartHTML(sourceRows, { label: 'sources' })}
      </section>
      <section class="chart-card">
        <p class="eyebrow">OPPORTUNITIES BY THEME</p>
        ${barChartHTML(pillarRows, { label: 'themes' })}
      </section>
      <section class="chart-card">
        <p class="eyebrow">TOP COUNTRIES</p>
        ${barChartHTML(countryRows, { label: 'countries' })}
      </section>
      ${pipeline ? `<section class="chart-card">
        <p class="eyebrow">PIPELINE OVERVIEW <span class="chart-card-note">(example data)</span></p>
        ${funnelHTML(pipeline.stages, pipeline.counts)}
      </section>` : ''}
      <section class="chart-card chart-card-wide">
        <p class="eyebrow">FIT SCORE VS. POTENTIAL VALUE</p>
        ${scatterHTML(scatterPoints)}
      </section>
      <section class="chart-card">
        <p class="eyebrow">UPCOMING DEADLINES</p>
        ${heatmapHTML(dueDates)}
      </section>
      <section class="chart-card">
        <p class="eyebrow">MOST COMMON THEMES</p>
        ${wordCloudHTML(keywords)}
      </section>
    `;
  }

  window.renderDashboardCharts = computeAndRender;
  document.addEventListener('aceso:dashboard-ready', computeAndRender);
  document.addEventListener('aceso:live-search-complete', () => {
    if (document.querySelector('#dashboardExtraCharts')) computeAndRender();
  });
})();
