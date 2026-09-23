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

  // ---- Radar/spider: average fit score by source (real, computed) ----
  function radarHTML(rows) {
    if (rows.length < 3) return emptyState('a source-quality radar');
    const axes = rows.slice(0, 8);
    const n = axes.length, cx = 140, cy = 118, r = 76;
    const angle = i => (Math.PI * 2 * i / n) - Math.PI / 2;
    const pt = (i, val) => { const a = angle(i), rad = (Math.max(0, Math.min(100, val)) / 100) * r; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; };
    const rings = [25, 50, 75, 100].map(ring => `<polygon points="${axes.map((_, i) => pt(i, ring).join(',')).join(' ')}" class="viz-radar-ring"/>`).join('');
    const spokes = axes.map((_, i) => { const [x, y] = pt(i, 100); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="viz-radar-axis"/>`; }).join('');
    const dataPts = axes.map((row, i) => pt(i, row.value));
    const shape = `<polygon points="${dataPts.map(p => p.join(',')).join(' ')}" class="viz-radar-shape"/>`;
    const dots = axes.map((row, i) => { const [x, y] = dataPts[i]; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#2a78d6" stroke="#fcfcfb" stroke-width="1.5" tabindex="0"><title>${escapeHtml(row.name)}: ${Math.round(row.value)}% average fit</title></circle>`; }).join('');
    const labels = axes.map((row, i) => { const a = angle(i); const [x, y] = pt(i, 124); const anchor = Math.abs(Math.cos(a)) < 0.25 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end'); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="viz-axis-label" text-anchor="${anchor}">${escapeHtml(row.name)}</text>`; }).join('');
    return `<svg viewBox="0 0 280 250" class="viz-radar" role="img" aria-label="Average fit score by source">${rings}${spokes}${shape}${dots}${labels}</svg>`;
  }

  // ---- Treemap: potential value by theme (squarified, real $ sums) ----
  function worstAspect(row, length) {
    const sum = row.reduce((a, b) => a + b, 0);
    if (!sum) return Infinity;
    const maxV = Math.max(...row), minV = Math.min(...row);
    return Math.max((length * length * maxV) / (sum * sum), (sum * sum) / (length * length * minV));
  }
  function squarifyRec(values, x, y, w, h, out) {
    if (!values.length) return;
    if (values.length === 1) { out.push({ x, y, w, h }); return; }
    const length = Math.min(w, h);
    let i = 1;
    while (i < values.length && worstAspect(values.slice(0, i + 1), length) <= worstAspect(values.slice(0, i), length)) i++;
    const row = values.slice(0, i);
    const rowSum = row.reduce((a, b) => a + b, 0);
    if (w >= h) {
      const rowW = rowSum / h; let offY = y;
      row.forEach(v => { const rh = v / rowW; out.push({ x, y: offY, w: rowW, h: rh }); offY += rh; });
      squarifyRec(values.slice(i), x + rowW, y, w - rowW, h, out);
    } else {
      const rowH = rowSum / w; let offX = x;
      row.forEach(v => { const rw = v / rowH; out.push({ x: offX, y, w: rw, h: rowH }); offX += rw; });
      squarifyRec(values.slice(i), x, y + rowH, w, h - rowH, out);
    }
  }
  function treemapHTML(rows) {
    if (rows.length < 3) return emptyState('a value-by-theme treemap');
    const w = 560, h = 230;
    const sorted = rows.slice().sort((a, b) => b.value - a.value);
    const total = sorted.reduce((s, r) => s + r.value, 0);
    const scale = (w * h) / total;
    const rects = []; squarifyRec(sorted.map(r => r.value * scale), 0, 0, w, h, rects);
    const cells = rects.map((r, i) => {
      const name = escapeHtml(sorted[i].name), val = fmtMoney(sorted[i].value);
      const showLabel = r.w > 64 && r.h > 30;
      return `<g tabindex="0"><rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${Math.max(0, r.w - 2).toFixed(1)}" height="${Math.max(0, r.h - 2).toFixed(1)}" fill="${SEQ_BLUE[Math.max(1, 6 - i)]}" rx="4"><title>${name}: ${val}</title></rect>${showLabel ? `<text x="${(r.x + 8).toFixed(1)}" y="${(r.y + 19).toFixed(1)}" class="viz-treemap-label">${name}</text><text x="${(r.x + 8).toFixed(1)}" y="${(r.y + 34).toFixed(1)}" class="viz-treemap-value">${val}</text>` : ''}</g>`;
    }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" class="viz-treemap" role="img" aria-label="Potential value by theme treemap">${cells}</svg>`;
  }

  // ---- Arc diagram: which sources tend to surface which themes (real co-occurrence) ----
  function arcDiagramHTML(edges) {
    if (edges.length < 3) return emptyState('a source-theme relationship diagram');
    const sources = [...new Set(edges.map(e => e.source))].slice(0, 5);
    const pillars = [...new Set(edges.map(e => e.pillar))].slice(0, 4);
    const nodes = [...sources.map(name => ({ name, type: 'source' })), ...pillars.map(name => ({ name, type: 'pillar' }))];
    const w = 560, h = 230, margin = 50;
    const step = (w - margin * 2) / Math.max(1, nodes.length - 1);
    const xFor = name => margin + nodes.findIndex(n => n.name === name) * step;
    const baseline = h - 70;
    const shown = edges.filter(e => sources.includes(e.source) && pillars.includes(e.pillar));
    const maxWeight = Math.max(...shown.map(e => e.weight), 1);
    const arcs = shown.map(e => {
      const x1 = xFor(e.source), x2 = xFor(e.pillar), mx = (x1 + x2) / 2, dist = Math.abs(x2 - x1);
      const peak = baseline - Math.min(110, 24 + dist * 0.5);
      const strokeW = (1 + (e.weight / maxWeight) * 5).toFixed(1);
      return `<path d="M${x1.toFixed(1)},${baseline} Q${mx.toFixed(1)},${peak.toFixed(1)} ${x2.toFixed(1)},${baseline}" fill="none" stroke="#2a78d6" stroke-width="${strokeW}" opacity="${(0.22 + (e.weight / maxWeight) * 0.55).toFixed(2)}" tabindex="0"><title>${escapeHtml(e.source)} → ${escapeHtml(e.pillar)}: ${e.weight}</title></path>`;
    }).join('');
    // Too many nodes to fit readable inline labels side by side (mark-spec
    // rule: a label that won't fit doesn't get clipped) — nodes carry their
    // name via hover tooltip instead, with short alternating-offset labels
    // beneath so most are still readable without hovering.
    const dots = nodes.map(n => `<circle cx="${xFor(n.name).toFixed(1)}" cy="${baseline}" r="5" fill="${n.type === 'source' ? '#2a78d6' : '#eb6834'}" tabindex="0"><title>${escapeHtml(n.name)}</title></circle>`).join('');
    const labels = nodes.map((n, i) => {
      const x = xFor(n.name);
      const short = n.name.length > 11 ? n.name.slice(0, 10) + '…' : n.name;
      const rowY = baseline + 16 + (i % 2) * 13;
      return `<text x="${x.toFixed(1)}" y="${rowY}" class="viz-axis-label" text-anchor="middle">${escapeHtml(short)}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" class="viz-arc" role="img" aria-label="Which sources surface which themes">${arcs}${dots}${labels}</svg><div class="viz-legend"><span><i style="background:#2a78d6"></i>Source</span><span><i style="background:#eb6834"></i>Theme</span></div>`;
  }

  // ---- Flow diagram: Found -> Relevant/Discarded -> fit tier of the relevant ones (real, 2-stage) ----
  function flowHTML(found, relevantCount, discardedCount, tierCounts) {
    if (found < 4) return emptyState('a search-to-decision flow diagram');
    const w = 560, h = 260, colX = [30, 210, 390], nodeW = 50;
    const scale = (h - 20) / found;
    const bNodes = [
      { name: 'Relevant', value: relevantCount, color: '#2a78d6' },
      { name: 'Discarded', value: discardedCount, color: '#c3c2b7' }
    ];
    let y = 10; bNodes.forEach(n => { n.h = n.value * scale; n.y = y; y += n.h + 4; });
    const tierOrder = [['Strong Fit', '#1baf7a'], ['Potential Fit', '#eda100'], ['Low Fit', '#e34948']];
    const cNodes = tierOrder.map(([name, color]) => ({ name, color, value: tierCounts[name] || 0 })).filter(n => n.value > 0);
    let cy2 = bNodes[0].y; cNodes.forEach(n => { n.h = n.value * scale; n.y = cy2; cy2 += n.h + 4; });
    const foundH = found * scale;
    const ribbon = (x1, y1, h1, x2, y2, h2, color, opacity) => {
      const mx = (x1 + x2) / 2;
      return `<path d="M${x1},${y1} C${mx},${y1} ${mx},${y2} ${x2},${y2} L${x2},${y2 + h2} C${mx},${y2 + h2} ${mx},${y1 + h1} ${x1},${y1 + h1} Z" fill="${color}" opacity="${opacity}"/>`;
    };
    const abRibbons = bNodes.map(n => ribbon(colX[0] + nodeW, 10, foundH, colX[1], n.y, n.h, n.color, 0.28)).join('');
    const bcRibbons = cNodes.map(n => ribbon(colX[1] + nodeW, bNodes[0].y, bNodes[0].h, colX[2], n.y, n.h, n.color, 0.5)).join('');
    const nodeRect = (x, y0, h0, color, label, value) => `<g tabindex="0"><rect x="${x}" y="${y0.toFixed(1)}" width="${nodeW}" height="${Math.max(2, h0).toFixed(1)}" fill="${color}" rx="3"><title>${escapeHtml(label)}: ${value}</title></rect><text x="${x + nodeW + 6}" y="${(y0 + h0 / 2 + 4).toFixed(1)}" class="viz-flow-label">${escapeHtml(label)} (${value})</text></g>`;
    const nodesHTML = nodeRect(colX[0], 10, foundH, '#143f71', 'Found', found)
      + bNodes.map(n => nodeRect(colX[1], n.y, n.h, n.color, n.name, n.value)).join('')
      + cNodes.map(n => nodeRect(colX[2], n.y, n.h, n.color, n.name, n.value)).join('');
    return `<svg viewBox="0 0 ${w} ${h}" class="viz-flow" role="img" aria-label="Search results flowing from found to relevant or discarded, then by fit tier">${abRibbons}${bcRibbons}${nodesHTML}</svg>`;
  }

  function computeAndRender() {
    const root = document.querySelector('#dashboardExtraCharts');
    if (!root) return;
    const opps = (typeof window.activeOpportunities === 'function' ? window.activeOpportunities() : window.opportunities) || [];
    const discardedList = (typeof discarded !== 'undefined' ? discarded : []) || [];

    const byPillar = {}; const byCountry = {}; const bySource = {}; const valueByPillar = {};
    const scoreSumBySource = {}; const scoreCountBySource = {}; const sourcePillarWeight = {}; const tierCounts = {};
    opps.forEach(o => {
      if (o.pillar) byPillar[o.pillar] = (byPillar[o.pillar] || 0) + 1;
      if (o.country) byCountry[o.country] = (byCountry[o.country] || 0) + 1;
      if (o.source) bySource[o.source] = (bySource[o.source] || 0) + 1;
      const val = parseValue(o.value);
      if (val && o.pillar) valueByPillar[o.pillar] = (valueByPillar[o.pillar] || 0) + val;
      if (o.source && typeof o.score === 'number') { scoreSumBySource[o.source] = (scoreSumBySource[o.source] || 0) + o.score; scoreCountBySource[o.source] = (scoreCountBySource[o.source] || 0) + 1; }
      if (o.source && o.pillar) { const key = o.source + '|' + o.pillar; sourcePillarWeight[key] = (sourcePillarWeight[key] || 0) + 1; }
      const tier = o.score >= 85 ? 'Strong Fit' : o.score >= 65 ? 'Potential Fit' : 'Low Fit';
      tierCounts[tier] = (tierCounts[tier] || 0) + 1;
    });
    const pillarRows = Object.entries(byPillar).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
    const countryRows = Object.entries(byCountry).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
    const sourceRows = Object.entries(bySource).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
    const valueByPillarRows = Object.entries(valueByPillar).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
    const avgScoreBySource = Object.entries(scoreSumBySource).map(([name, sum]) => ({ name, value: sum / scoreCountBySource[name] })).sort((a, b) => b.value - a.value);
    const sourcePillarEdges = Object.entries(sourcePillarWeight).map(([key, weight]) => { const [source, pillar] = key.split('|'); return { source, pillar, weight }; }).sort((a, b) => b.weight - a.weight);

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
      <section class="chart-card">
        <p class="eyebrow">AVERAGE FIT BY SOURCE</p>
        ${radarHTML(avgScoreBySource)}
      </section>
      <section class="chart-card">
        <p class="eyebrow">POTENTIAL VALUE BY THEME</p>
        ${treemapHTML(valueByPillarRows)}
      </section>
      <section class="chart-card chart-card-wide">
        <p class="eyebrow">WHICH SOURCES SURFACE WHICH THEMES</p>
        ${arcDiagramHTML(sourcePillarEdges)}
      </section>
      <section class="chart-card chart-card-wide">
        <p class="eyebrow">FROM SEARCH TO DECISION</p>
        ${flowHTML(opps.length + discardedList.length, opps.length, discardedList.length, tierCounts)}
      </section>
    `;
  }

  window.renderDashboardCharts = computeAndRender;
  document.addEventListener('aceso:dashboard-ready', computeAndRender);
  document.addEventListener('aceso:live-search-complete', () => {
    if (document.querySelector('#dashboardExtraCharts')) computeAndRender();
  });
})();
