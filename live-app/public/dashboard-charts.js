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

  // Illustrative points for the scatter plot when a search hasn't returned
  // enough opportunities with both a real score and a published budget to
  // plot — same "clearly labeled example" pattern as the pipeline tab.
  const EXAMPLE_SCATTER = [
    { title: 'Health Financing Systems Assessment', score: 88, value: 1400000, pillar: 'Health financing' },
    { title: 'Digital Health Interoperability Roadmap', score: 82, value: 620000, pillar: 'Digital health' },
    { title: 'Universal Health Coverage Policy Advisory', score: 79, value: 480000, pillar: 'UHC transition' },
    { title: 'Provider Payment Reform Technical Assistance', score: 91, value: 1100000, pillar: 'Provider payments' },
    { title: 'Community Health Worker Program Design', score: 85, value: 750000, pillar: 'Service delivery' },
    { title: 'Maternal Health Systems Strengthening', score: 77, value: 890000, pillar: 'Maternal health' },
    { title: 'Health Information Systems Modernization', score: 92, value: 1650000, pillar: 'Health financing' },
    { title: 'Regional Health Financing Support', score: 84, value: 940000, pillar: 'Health financing' },
    { title: 'Routine Immunization Data Quality Review', score: 58, value: 210000, pillar: 'Digital health' },
    { title: 'Health Workforce Capacity Building', score: 65, value: 340000, pillar: 'Service delivery' }
  ];

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
    // Capped at 6 rows so cards sharing a grid row keep the same height.
    const limit = opts.limit || 6;
    const rest = rows.slice(limit);
    const more = rest.length ? `<p class="viz-bars-more">+ ${rest.length} more (${rest.reduce((s, r) => s + r.value, 0)} opportunit${rest.reduce((s, r) => s + r.value, 0) === 1 ? 'y' : 'ies'})</p>` : '';
    return `<div class="viz-bars">${rows.slice(0, limit).map(r => { const name = escapeHtml(r.name), val = opts.fmt ? opts.fmt(r.value) : r.value; return `
      <div class="viz-bar-row" tabindex="0" aria-label="${name}: ${val}" title="${name}: ${val}">
        <span class="viz-bar-label">${name}</span>
        <span class="viz-bar-track"><span class="viz-bar-fill" style="width:${Math.max(4, Math.round(r.value / max * 100))}%"></span></span>
        <span class="viz-bar-value">${val}</span>
      </div>`; }).join('')}</div>${more}`;
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
    // Drawn at roughly its on-screen width (a full-width card) so text stays ~11px.
    const w = 1300, h = 240, pad = { l: 58, r: 18, t: 14, b: 40 };
    const maxVal = Math.max(...points.map(p => p.value));
    const pillars = [...new Set(points.map(p => p.pillar))];
    const topPillars = pillars.slice(0, 3);
    const colorFor = pillar => { const i = topPillars.indexOf(pillar); return i >= 0 ? CATEGORICAL[i] : OTHER_COLOR; };
    // Fit axis starts near the lowest score instead of 0, so the points
    // spread across the chart rather than bunching at the right edge.
    const xMin = Math.max(0, Math.floor((Math.min(...points.map(p => p.score)) - 5) / 10) * 10);
    const xTicks = []; for (let t = xMin; t <= 100; t += 10) xTicks.push(t);
    const yMax = maxVal * 1.1 || 1;
    const x = score => pad.l + ((score - xMin) / (100 - xMin)) * (w - pad.l - pad.r);
    const y = val => h - pad.b - (val / yMax) * (h - pad.t - pad.b);
    const vGrid = xTicks.map(gx => `<line x1="${x(gx)}" y1="${pad.t}" x2="${x(gx)}" y2="${h - pad.b}" class="viz-grid"/><text x="${x(gx)}" y="${h - pad.b + 16}" class="viz-axis-label" text-anchor="middle">${gx}</text>`).join('');
    const hGrid = [0, 0.5, 1].map(f => `<line x1="${pad.l}" y1="${y(maxVal * f).toFixed(1)}" x2="${w - pad.r}" y2="${y(maxVal * f).toFixed(1)}" class="viz-grid"/><text x="${pad.l - 8}" y="${(y(maxVal * f) + 4).toFixed(1)}" class="viz-axis-label" text-anchor="end">${fmtMoney(maxVal * f)}</text>`).join('');
    const dots = points.map(p => `<circle cx="${x(p.score).toFixed(1)}" cy="${y(p.value).toFixed(1)}" r="6" fill="${colorFor(p.pillar)}" stroke="#fcfcfb" stroke-width="2" tabindex="0"><title>${escapeHtml(p.title)} — ${p.score}% fit, ${fmtMoney(p.value)}, ${escapeHtml(p.pillar)}</title></circle>`).join('');
    const legend = (topPillars.length > 1 ? topPillars.map((p, i) => `<span><i style="background:${CATEGORICAL[i]}"></i>${escapeHtml(p)}</span>`).join('') + (pillars.length > 3 ? `<span><i style="background:${OTHER_COLOR}"></i>Other</span>` : '') : '');
    return `<svg viewBox="0 0 ${w} ${h}" class="viz-scatter" role="img" aria-label="Fit score versus potential value scatter plot">${hGrid}${vGrid}<line x1="${pad.l}" y1="${h - pad.b}" x2="${w - pad.r}" y2="${h - pad.b}" class="viz-axis"/><text x="${(pad.l + w - pad.r) / 2}" y="${h - 4}" class="viz-axis-label" text-anchor="middle">Fit score →</text>${dots}</svg>${legend ? `<div class="viz-legend">${legend}</div>` : ''}`;
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
    }).join('')}</div><div class="viz-heat-labels"><span>${weeks[0].start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><span>${weeks[5].start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span><span>${weeks[9].start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span></div><div class="viz-heat-scale"><span>Fewer</span>${SEQ_BLUE.filter((_, i) => i % 2 === 0).map(c => `<i style="background:${c}"></i>`).join('')}<span>More · peak ${max}/week</span></div>`;
  }

  // ---- Word cloud: keyword frequency (size-encoded, single hue) ----
  function wordCloudHTML(keywords) {
    const counts = new Map();
    keywords.forEach(k => { const key = k.trim(); if (key) counts.set(key, (counts.get(key) || 0) + 1); });
    const entries = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
    if (entries.length < 4) return emptyState('a theme word cloud');
    const n = entries.length;
    // Ranked (not raw-ratio) scaling — guarantees a dramatic size/color
    // spread from most to least frequent even when the actual counts
    // cluster close together (e.g. mostly 1s and 2s).
    return `<div class="viz-wordcloud">${entries.map(([word, count], i) => {
      const rank = n > 1 ? i / (n - 1) : 0;
      // 16px → 11px keeps the most frequent theme prominent without
      // dwarfing the ~12px text used by every other card.
      const size = 16 - rank * 5;
      const step = Math.round((1 - rank) * (SEQ_BLUE.length - 1));
      const dark = step >= 4;
      const safeWord = escapeHtml(word);
      return `<span class="viz-cloud-chip" style="background:${SEQ_BLUE[step]};color:${dark ? '#fff' : '#12375e'};font-size:${size.toFixed(1)}px;font-weight:${dark ? 700 : 600}" tabindex="0" aria-label="${safeWord}: ${count} opportunities">${safeWord}<i>${count}</i></span>`;
    }).join('')}</div>`;
  }

  // ---- Donut: fit tier distribution (real, part-to-whole) ----
  function donutHTML(tierCounts) {
    const order = [['Strong Fit', '#1baf7a'], ['Potential Fit', '#eda100'], ['Low Fit', '#e34948']];
    const rows = order.map(([name, color]) => ({ name, color, value: tierCounts[name] || 0 })).filter(r => r.value > 0);
    const total = rows.reduce((s, r) => s + r.value, 0);
    if (total < 3) return emptyState('a fit-tier breakdown');
    const r = 66, cx = 90, cy = 90, circumference = 2 * Math.PI * r;
    let offset = 0;
    const arcs = rows.map(row => {
      const frac = row.value / total;
      const dash = frac * circumference;
      const el = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${row.color}" stroke-width="24" stroke-dasharray="${dash.toFixed(1)} ${(circumference - dash).toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 ${cx} ${cy})" tabindex="0"><title>${escapeHtml(row.name)}: ${row.value} (${Math.round(frac * 100)}%)</title></circle>`;
      offset += dash;
      return el;
    }).join('');
    const legend = rows.map(r2 => `<span><i style="background:${r2.color}"></i>${escapeHtml(r2.name)} — ${r2.value} (${Math.round(r2.value / total * 100)}%)</span>`).join('');
    return `<div class="viz-donut-wrap"><svg viewBox="0 0 180 180" class="viz-donut" role="img" aria-label="Fit tier distribution">${arcs}<text x="90" y="86" text-anchor="middle" class="viz-donut-total">${total}</text><text x="90" y="104" text-anchor="middle" class="viz-donut-total-label">scored</text></svg><div class="viz-legend viz-legend-stack">${legend}</div></div>`;
  }

  // ---- Histogram: fit-score distribution (real, 10-point buckets) ----
  function histogramHTML(scores) {
    if (scores.length < 5) return emptyState('a fit-score distribution');
    const buckets = Array.from({ length: 10 }, (_, i) => ({ from: i * 10, count: 0 }));
    scores.forEach(s => { const idx = Math.min(9, Math.floor(s / 10)); buckets[idx].count++; });
    const max = Math.max(...buckets.map(b => b.count)) || 1;
    const w = 400, h = 180, pad = { l: 4, r: 4, t: 8, b: 22 };
    const bw = (w - pad.l - pad.r) / buckets.length;
    const bars = buckets.map((b, i) => {
      const bh = (b.count / max) * (h - pad.t - pad.b);
      const x = pad.l + i * bw;
      const y = h - pad.b - bh;
      const color = b.from >= 80 ? '#1baf7a' : b.from >= 50 ? '#2a78d6' : '#c3c2b7';
      return `<rect x="${(x + 2).toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(0, bw - 4).toFixed(1)}" height="${Math.max(0, bh).toFixed(1)}" rx="3" fill="${color}" tabindex="0"><title>${b.from}-${b.from + 9}% fit: ${b.count} opportunit${b.count === 1 ? 'y' : 'ies'}</title></rect>`;
    }).join('');
    const anchorFor = v => v === 0 ? 'start' : v === 100 ? 'end' : 'middle';
    const axis = `<line x1="${pad.l}" y1="${h - pad.b}" x2="${w - pad.r}" y2="${h - pad.b}" class="viz-axis"/>` +
      [0, 50, 100].map(v => `<text x="${(pad.l + (v / 100) * (w - pad.l - pad.r)).toFixed(1)}" y="${h - 6}" class="viz-axis-label" text-anchor="${anchorFor(v)}">${v}</text>`).join('');
    return `<svg viewBox="0 0 ${w} ${h}" class="viz-histogram" role="img" aria-label="Distribution of fit scores">${bars}${axis}</svg>`;
  }

  // ---- Radar/spider: average fit score by source (real, computed) ----
  function radarHTML(rows) {
    if (rows.length < 3) return emptyState('a source-quality radar');
    const axes = rows.slice(0, 8);
    const n = axes.length, cx = 200, cy = 124, r = 82;
    const angle = i => (Math.PI * 2 * i / n) - Math.PI / 2;
    const pt = (i, val) => { const a = angle(i), rad = (Math.max(0, Math.min(100, val)) / 100) * r; return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)]; };
    const rings = [25, 50, 75, 100].map(ring => `<polygon points="${axes.map((_, i) => pt(i, ring).join(',')).join(' ')}" class="viz-radar-ring"/>`).join('');
    const spokes = axes.map((_, i) => { const [x, y] = pt(i, 100); return `<line x1="${cx}" y1="${cy}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}" class="viz-radar-axis"/>`; }).join('');
    const dataPts = axes.map((row, i) => pt(i, row.value));
    const shape = `<polygon points="${dataPts.map(p => p.join(',')).join(' ')}" class="viz-radar-shape"/>`;
    const dots = axes.map((row, i) => { const [x, y] = dataPts[i]; return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" fill="#2a78d6" stroke="#fcfcfb" stroke-width="1.5" tabindex="0"><title>${escapeHtml(row.name)}: ${Math.round(row.value)}% average fit</title></circle>`; }).join('');
    const labels = axes.map((row, i) => { const a = angle(i); const [x, y] = pt(i, 124); const anchor = Math.abs(Math.cos(a)) < 0.25 ? 'middle' : (Math.cos(a) > 0 ? 'start' : 'end'); return `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" class="viz-axis-label" text-anchor="${anchor}">${escapeHtml(row.name)}</text>`; }).join('');
    return `<svg viewBox="0 0 400 250" class="viz-radar" role="img" aria-label="Average fit score by source">${rings}${spokes}${shape}${dots}${labels}</svg>`;
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
    const w = 400, h = 220;
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
    const w = 1300, h = 200, margin = 90;
    const step = (w - margin * 2) / Math.max(1, nodes.length - 1);
    const xFor = name => margin + nodes.findIndex(n => n.name === name) * step;
    const baseline = h - 58;
    const shown = edges.filter(e => sources.includes(e.source) && pillars.includes(e.pillar));
    const maxWeight = Math.max(...shown.map(e => e.weight), 1);
    const arcs = shown.map(e => {
      const x1 = xFor(e.source), x2 = xFor(e.pillar), mx = (x1 + x2) / 2, dist = Math.abs(x2 - x1);
      // A quadratic curve's apex sits halfway to its control point, so the
      // control goes at twice the wanted rise; long arcs use the full height.
      const rise = Math.min(baseline - 12, 16 + dist * 0.16);
      const peak = baseline - 2 * rise;
      const strokeW = (1 + (e.weight / maxWeight) * 5).toFixed(1);
      return `<path d="M${x1.toFixed(1)},${baseline} Q${mx.toFixed(1)},${peak.toFixed(1)} ${x2.toFixed(1)},${baseline}" fill="none" stroke="#2a78d6" stroke-width="${strokeW}" opacity="${(0.22 + (e.weight / maxWeight) * 0.55).toFixed(2)}" tabindex="0"><title>${escapeHtml(e.source)} → ${escapeHtml(e.pillar)}: ${e.weight}</title></path>`;
    }).join('');
    // Too many nodes to fit readable inline labels side by side (mark-spec
    // rule: a label that won't fit doesn't get clipped) — nodes carry their
    // name via hover tooltip instead, with short alternating-offset labels
    // beneath so most are still readable without hovering.
    const dots = nodes.map(n => `<circle cx="${xFor(n.name).toFixed(1)}" cy="${baseline}" r="6" fill="${n.type === 'source' ? '#2a78d6' : '#eb6834'}" tabindex="0"><title>${escapeHtml(n.name)}</title></circle>`).join('');
    const labels = nodes.map((n, i) => {
      const x = xFor(n.name);
      const short = n.name.length > 24 ? n.name.slice(0, 23) + '…' : n.name;
      const rowY = baseline + 20 + (i % 2) * 16;
      return `<text x="${x.toFixed(1)}" y="${rowY}" class="viz-axis-label" text-anchor="middle">${escapeHtml(short)}</text>`;
    }).join('');
    return `<svg viewBox="0 0 ${w} ${h}" class="viz-arc" role="img" aria-label="Which sources surface which themes">${arcs}${dots}${labels}</svg><div class="viz-legend"><span><i style="background:#2a78d6"></i>Source</span><span><i style="background:#eb6834"></i>Theme</span></div>`;
  }

  // ---- Flow diagram: Found -> Relevant/Discarded -> fit tier of the relevant ones (real, 2-stage) ----
  function flowHTML(found, relevantCount, discardedCount, tierCounts) {
    if (found < 4) return emptyState('a search-to-decision flow diagram');
    const w = 860, h = 250, colX = [0, 330, 660], nodeW = 40;
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

  // One computation shared by the charts and by Aceso Copilot, so Copilot
  // explains exactly the numbers on screen.
  function computeData() {
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

    const realScatterPoints = opps.map(o => ({ title: o.title, score: o.score, value: parseValue(o.value), pillar: o.pillar })).filter(p => p.value);
    const scatterIsExample = realScatterPoints.length < 3;
    const scatterPoints = scatterIsExample ? EXAMPLE_SCATTER : realScatterPoints;
    const scores = opps.map(o => o.score).filter(s => typeof s === 'number');
    const dueDates = opps.map(o => o.due).filter(Boolean);
    const keywords = opps.flatMap(o => (o.meta && o.meta.keywords) || []);
    const pipeline = typeof window.pipelineStats === 'function' ? window.pipelineStats() : null;
    return { opps, discardedList, tierCounts, pillarRows, countryRows, sourceRows, valueByPillarRows, avgScoreBySource, sourcePillarEdges, scatterIsExample, scatterPoints, scores, dueDates, keywords, pipeline };
  }

  // Chart cards for dashboard-layout.js, which places them into themed
  // sections: { id: { title, sub, note, body, foot } }. Titles are sentence
  // case and every card shares one header style.
  function chartCards() {
    const { opps, discardedList, tierCounts, pillarRows, countryRows, sourceRows, valueByPillarRows, avgScoreBySource, sourcePillarEdges, scatterIsExample, scatterPoints, scores, dueDates, keywords, pipeline } = computeData();
    const share = (rows, total) => rows.length && total ? Math.round(rows[0].value / total * 100) : 0;
    const bestSource = avgScoreBySource[0];
    const found = opps.length + discardedList.length;
    return {
      resultsBySource: { title: 'Results by source', sub: 'Relevant opportunities each portal returned.', body: barChartHTML(sourceRows, { label: 'sources' }),
        foot: sourceRows.length ? `<b>${escapeHtml(sourceRows[0].name)}</b> supplies ${share(sourceRows, opps.length)}% of relevant results.` : '' },
      opportunitiesByTheme: { title: 'Opportunities by theme', sub: 'Relevant opportunities per Aceso thematic pillar.', body: barChartHTML(pillarRows, { label: 'themes' }),
        foot: pillarRows.length ? `<b>${escapeHtml(pillarRows[0].name)}</b> is the most active theme.` : '' },
      topCountries: { title: 'Top countries', sub: 'Where the relevant opportunities are.', body: barChartHTML(countryRows, { label: 'countries' }) },
      pipelineOverview: pipeline ? { title: 'Pipeline overview', sub: 'Opportunities currently in each stage.', note: 'Example data', body: funnelHTML(pipeline.stages, pipeline.counts) } : null,
      fitVsValue: { title: 'Fit score vs. potential value', sub: 'Each dot is an opportunity with a published budget; color = theme.', note: scatterIsExample ? 'Example data' : '', body: scatterHTML(scatterPoints),
        foot: scatterIsExample ? 'Too few real opportunities publish a budget to plot yet, so this shows illustrative points.' : '' },
      upcomingDeadlines: { title: 'Upcoming deadlines', sub: 'Relevant opportunities closing each week, next 10 weeks.', body: heatmapHTML(dueDates) },
      commonThemes: { title: 'Most common themes', sub: 'Keywords the agent extracted; larger = more frequent.', body: wordCloudHTML(keywords) },
      fitTiers: { title: 'Fit tier breakdown', sub: 'Strong ≥ 85 · Potential 65–84 · Low < 65.', body: donutHTML(tierCounts) },
      fitDistribution: { title: 'Fit score distribution', sub: 'Relevant opportunities per 10-point fit bucket.', body: histogramHTML(scores) },
      fitBySource: { title: 'Average fit by source', sub: 'Which portals bring the best-matching work.', body: radarHTML(avgScoreBySource),
        foot: bestSource ? `<b>${escapeHtml(bestSource.name)}</b> has the highest average fit (${Math.round(bestSource.value)}%).` : '' },
      valueByTheme: { title: 'Potential value by theme', sub: 'Sum of published budgets per theme.', body: treemapHTML(valueByPillarRows) },
      sourcesToThemes: { title: 'Which sources surface which themes', sub: 'Thicker arcs = more opportunities from that source in that theme.', body: arcDiagramHTML(sourcePillarEdges) },
      searchToDecision: { title: 'From search to decision', sub: 'Everything found, split by the screening rules and then by fit.', body: flowHTML(found, opps.length, discardedList.length, tierCounts),
        foot: found ? `${Math.round(discardedList.length / found * 100)}% of notices were excluded automatically, each with a traceable reason.` : '' }
    };
  }

  // Copilot-facing description of every chart in the "What this search found"
  // section: what each shows, how it is computed, and its current values.
  function describeForCopilot() {
    const d = computeData();
    const now = new Date();
    const weeks = Array.from({ length: 10 }, (_, i) => { const s = new Date(now); s.setDate(now.getDate() + i * 7); return { weekOf: s.toISOString().slice(0, 10), deadlines: 0 }; });
    d.dueDates.forEach(due => { const t = new Date(due); if (Number.isNaN(t.getTime())) return; const days = Math.floor((t - now) / 86400000); if (days >= 0 && days < 70) weeks[Math.floor(days / 7)].deadlines += 1; });
    const buckets = Array.from({ length: 10 }, (_, i) => ({ range: `${i * 10}-${i * 10 + 9}`, count: 0 }));
    d.scores.forEach(s => { buckets[Math.min(9, Math.floor(s / 10))].count += 1; });
    const kw = new Map(); d.keywords.forEach(k => { const key = k.trim(); if (key) kw.set(key, (kw.get(key) || 0) + 1); });
    const round = rows => rows.map(r => ({ name: r.name, value: Math.round(r.value * 10) / 10 }));
    return {
      resultsBySource: { chart: 'Horizontal bars "Results by source"', how: 'Count of relevant opportunities per data source in the current search.', data: d.sourceRows },
      opportunitiesByTheme: { chart: 'Horizontal bars "Opportunities by theme"', how: 'Count of relevant opportunities per Aceso thematic pillar assigned by the agent.', data: d.pillarRows },
      topCountries: { chart: 'Horizontal bars "Top countries"', how: 'Count of relevant opportunities per country.', data: d.countryRows },
      pipelineOverview: d.pipeline ? { chart: 'Funnel "Pipeline overview"', how: 'Opportunities currently in each pipeline stage.', isExampleData: true, stages: d.pipeline.stages, counts: d.pipeline.counts } : null,
      fitVsValueScatter: { chart: 'Scatter "Fit score vs. potential value"', how: 'Each dot is an opportunity: x = fit score (0-100), y = published budget, color = theme. Only opportunities with a published budget can be plotted.', isExampleData: d.scatterIsExample, note: d.scatterIsExample ? 'Fewer than 3 real opportunities publish a budget, so the chart shows illustrative example points.' : undefined, points: d.scatterPoints.map(p => ({ title: p.title, fitScore: p.score, value: fmtMoney(p.value), theme: p.pillar })) },
      upcomingDeadlinesHeatmap: { chart: 'Heatmap "Upcoming deadlines"', how: 'Ten cells, one per week starting today; darker blue = more relevant opportunities closing that week.', weeks },
      mostCommonThemes: { chart: 'Word cloud "Most common themes"', how: 'Keywords the agent extracted from relevant opportunities; bigger and darker = more frequent (top 12).', data: [...kw.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12).map(([word, count]) => ({ word, count })) },
      fitTierBreakdown: { chart: 'Donut "Fit tier breakdown"', how: 'Relevant opportunities by fit tier: Strong Fit = score ≥ 85, Potential Fit = 65-84, Low Fit < 65.', counts: d.tierCounts },
      fitScoreDistribution: { chart: 'Histogram "Fit score distribution"', how: 'Relevant opportunities per 10-point fit-score bucket; green ≥ 80, blue 50-79, grey < 50.', buckets },
      averageFitBySource: { chart: 'Radar "Average fit by source"', how: 'Average fit score of the relevant opportunities each source returned — which sources bring the best-matching work.', data: round(d.avgScoreBySource) },
      potentialValueByTheme: { chart: 'Treemap "Potential value by theme"', how: 'Sum of published budgets per theme; shows "not enough data" with fewer than 3 themes that publish budgets.', data: d.valueByPillarRows.map(r => ({ name: r.name, value: fmtMoney(r.value) })) },
      sourcesToThemes: { chart: 'Arc diagram "Which sources surface which themes"', how: 'Arcs connect a source (blue) to a theme (orange); thicker = more opportunities from that source in that theme.', edges: d.sourcePillarEdges },
      searchToDecisionFlow: { chart: 'Flow (Sankey) "From search to decision"', how: 'Everything found splits into relevant vs discarded by the screening rules; relevant then splits by fit tier.', found: d.opps.length + d.discardedList.length, relevant: d.opps.length, discarded: d.discardedList.length, relevantByFitTier: d.tierCounts }
    };
  }

  window.dashboardChartData = describeForCopilot;
  // Rendering and re-rendering on new searches is driven by dashboard-layout.js.
  window.dashboardChartCards = chartCards;
})();
