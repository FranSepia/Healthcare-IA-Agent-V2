// Dashboard additions brought over from Yael's prototype, rebuilt on live
// data: analyst hours saved over time, pursuit decision quality, publication
// trend, deadline readiness, conversion funnel, top funders and submission
// deadlines by month. Same rule as dashboard-charts.js — real numbers first,
// clearly labeled example data only where no real source exists yet.
(() => {
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = s => (typeof escapeHtml === 'function' ? escapeHtml(String(s)) : String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])));

  // Illustrative adoption curve (notices screened per period) used only for
  // periods with no saved search, so the chart reads before history builds up.
  const EXAMPLE_WEEKLY = [14, 19, 17, 24, 28, 26, 33, 31, 38, 36, 42, 44];
  const EXAMPLE_MONTHLY = [52, 71, 96, 118, 137, 160];
  const MIN_REAL_PERIODS = 4;

  let hoursMode = 'week';
  let trendMode = 'count';

  // ------------------------------------------------------------ parsing

  const MONTHS = [['jan', 'ene', 'janv'], ['feb', 'fev', 'fév'], ['mar'], ['apr', 'abr', 'avr'], ['may', 'mai'], ['jun', 'juin'], ['jul', 'juil'], ['aug', 'ago', 'aoû', 'aou'], ['sep', 'set'], ['oct', 'out'], ['nov'], ['dec', 'dic', 'dez', 'déc']];
  function monthIndex(word) {
    const w = word.toLowerCase();
    return MONTHS.findIndex(prefixes => prefixes.some(p => w.startsWith(p)));
  }
  // Handles "2 Oct 2026", "30 Sept 2026", "sept. 2026", "ago.-2026", ISO.
  // Dates without a year ("August 21st") are ambiguous and skipped.
  function parseDate(text) {
    if (!text) return null;
    const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(text);
    if (iso) return new Date(Number(iso[1]), Number(iso[2]) - 1, Number(iso[3]));
    const m = /(?:(\d{1,2})\s*(?:st|nd|rd|th)?[\s.\-/]+)?([A-Za-zÀ-ÿ]{3,})\.?[\s.\-/,]*(?:(\d{1,2})(?:st|nd|rd|th)?,?\s+)?(\d{4})/.exec(text);
    if (!m) return null;
    const month = monthIndex(m[2]);
    if (month < 0) return null;
    return new Date(Number(m[4]), month, Number(m[1] || m[3] || 1));
  }
  // Lower bound of a published budget: "$10-30 million" → 10,000,000.
  function parseValue(text) {
    const m = /\$\s?([\d.,]+)\s*(?:[-–]\s*\$?[\d.,]+\s*)?(million|billion|thousand|m|k|b)?\b/i.exec(text || '');
    if (!m) return null;
    const n = Number(m[1].replace(/,/g, ''));
    if (!n) return null;
    const unit = (m[2] || '').toLowerCase();
    return n * (unit === 'billion' || unit === 'b' ? 1e9 : unit === 'million' || unit === 'm' ? 1e6 : unit === 'thousand' || unit === 'k' ? 1e3 : 1);
  }
  function fmtMoney(n) {
    if (n >= 1e9) return `$${(n / 1e9).toFixed(1)}B`;
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
    return `$${Math.round(n)}`;
  }
  const monthLabel = d => d.toLocaleDateString('en-US', { month: 'short' });
  const empty = label => `<div class="chart-empty">Not enough data yet for ${label} — run a search with more results.</div>`;

  function liveData() {
    if (typeof window.dashboardScope === 'function') { const s = window.dashboardScope(); return { opps: s.opps, excluded: s.excluded }; }
    const opps = (typeof window.activeOpportunities === 'function' ? window.activeOpportunities() : (typeof opportunities !== 'undefined' ? opportunities : [])) || [];
    const excluded = (typeof discarded !== 'undefined' ? discarded : []) || [];
    return { opps, excluded };
  }

  // ------------------------------------------------------------ analyst hours

  function hoursSeries() {
    const time = window.AcesoAnalystTime;
    const realWeeks = time ? time.weeks() : [];
    const now = new Date();
    if (hoursMode === 'week') {
      const thisWeek = new Date(now); thisWeek.setHours(0, 0, 0, 0); thisWeek.setDate(thisWeek.getDate() - ((thisWeek.getDay() + 6) % 7));
      const count = 12;
      const useExample = realWeeks.length < MIN_REAL_PERIODS;
      return Array.from({ length: count }, (_, i) => {
        const start = new Date(thisWeek); start.setDate(start.getDate() - (count - 1 - i) * 7);
        const real = realWeeks.find(w => w.start.getTime() === start.getTime());
        const end = new Date(start); end.setDate(end.getDate() + 6);
        const label = start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        const range = `${label} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
        if (real) return { label, range, notices: real.notices, searches: real.searches, live: true };
        return { label, range, notices: useExample ? EXAMPLE_WEEKLY[i] : 0, searches: 0, live: false, example: useExample };
      });
    }
    const byMonth = new Map();
    realWeeks.forEach(w => { const key = `${w.start.getFullYear()}-${w.start.getMonth()}`; const m = byMonth.get(key) || { notices: 0, searches: 0 }; m.notices += w.notices; m.searches += w.searches; byMonth.set(key, m); });
    const count = 6;
    const useExample = byMonth.size < 3;
    return Array.from({ length: count }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - (count - 1 - i), 1);
      const real = byMonth.get(`${d.getFullYear()}-${d.getMonth()}`);
      const label = monthLabel(d);
      const range = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
      if (real) return { label, range, notices: real.notices, searches: real.searches, live: true };
      return { label, range, notices: useExample ? EXAMPLE_MONTHLY[i] : 0, searches: 0, live: false, example: useExample };
    });
  }

  function hoursChartHTML() {
    const time = window.AcesoAnalystTime;
    const series = hoursSeries().map(p => ({ ...p, hours: time.hours(p.notices) }));
    const anyExample = series.some(p => p.example);
    const total = series.reduce((s, p) => s + p.hours, 0);
    const best = series.reduce((a, b) => (b.hours > a.hours ? b : a), series[0]);
    const unit = hoursMode === 'week' ? 'week' : 'month';
    const w = 1300, h = 250, pad = { l: 44, r: 56, t: 22, b: 34 };
    const maxH = Math.max(...series.map(p => p.hours), 1);
    const niceMax = Math.ceil(maxH / 5) * 5 || 5;
    const bw = (w - pad.l - pad.r) / series.length;
    const y = v => h - pad.b - (v / niceMax) * (h - pad.t - pad.b);
    let running = 0;
    const cumulative = series.map(p => (running += p.hours));
    const yc = v => h - pad.b - (v / (running || 1)) * (h - pad.t - pad.b);
    const grid = [0, 0.5, 1].map(f => { const v = niceMax * f; return `<line x1="${pad.l}" x2="${w - pad.r}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="viz-grid"/><text x="${pad.l - 8}" y="${(y(v) + 4).toFixed(1)}" class="viz-axis-label" text-anchor="end">${Math.round(v)}h</text>`; }).join('');
    const bars = series.map((p, i) => {
      const x = pad.l + i * bw + bw * 0.18, bwInner = bw * 0.64, top = y(p.hours);
      const cls = p.live ? 'hours-bar live' : 'hours-bar example';
      return `<rect class="${cls}" x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bwInner.toFixed(1)}" height="${Math.max(0, h - pad.b - top).toFixed(1)}" rx="5" style="--i:${i}"/>
        <text x="${(x + bwInner / 2).toFixed(1)}" y="${h - pad.b + 18}" class="viz-axis-label" text-anchor="middle">${esc(p.label)}</text>`;
    }).join('');
    const pts = series.map((p, i) => [pad.l + i * bw + bw / 2, yc(cumulative[i])]);
    const line = pts.map((pt, i) => `${i ? 'L' : 'M'}${pt[0].toFixed(1)},${pt[1].toFixed(1)}`).join(' ');
    const area = `${line} L${pts[pts.length - 1][0].toFixed(1)},${h - pad.b} L${pts[0][0].toFixed(1)},${h - pad.b} Z`;
    const dots = pts.map((pt, i) => `<circle cx="${pt[0].toFixed(1)}" cy="${pt[1].toFixed(1)}" r="3.5" class="hours-dot" data-i="${i}"/>`).join('');
    const hits = series.map((p, i) => `<rect class="hours-hit" data-i="${i}" x="${(pad.l + i * bw).toFixed(1)}" y="${pad.t}" width="${bw.toFixed(1)}" height="${h - pad.t - pad.b}" tabindex="0" aria-label="${esc(p.range)}: ${time.fmtHours(p.hours)} hours saved"/>`).join('');
    const cumLabel = `<text x="${w - pad.r + 8}" y="${(pts[pts.length - 1][1] + 4).toFixed(1)}" class="hours-cum-label">${time.fmtHours(running)}h</text>`;

    const title = `<p class="eyebrow">ANALYST TIME SAVED${anyExample ? ' <span class="chart-card-note">(example data where no search was recorded)</span>' : ''}</p>
          <h2>${time.fmtHours(total)} analyst hours saved</h2>
          <p>Time the team did not spend searching portals and screening notices by hand, ${hoursMode === 'week' ? 'week by week' : 'month by month'}.</p>`;
    const body = `
      <div class="hours-kpis">
        <div><small>Total over ${series.length} ${unit}s</small><b>${time.fmtHours(total)}h</b></div>
        <div><small>Average per ${unit}</small><b>${time.fmtHours(total / series.length)}h</b></div>
        <div><small>Best ${unit}</small><b>${time.fmtHours(best.hours)}h</b><em>${esc(best.range)}</em></div>
        <div><small>Analyst workdays freed</small><b>${(total / 8).toFixed(1)}</b><em>at 8 h per day</em></div>
      </div>
      <div class="hours-plot">
        <svg viewBox="0 0 ${w} ${h}" class="hours-svg" role="img" aria-label="Analyst hours saved per ${unit}, with cumulative total">
          <defs><linearGradient id="hoursArea" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#f5bb27" stop-opacity=".28"/><stop offset="1" stop-color="#f5bb27" stop-opacity="0"/></linearGradient>
          <pattern id="hoursHatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" fill="#dcebf8"/><line x1="0" y1="0" x2="0" y2="6" stroke="#b9d4ee" stroke-width="3"/></pattern></defs>
          ${grid}${bars}<path d="${area}" fill="url(#hoursArea)"/><path d="${line}" class="hours-line"/>${dots}${cumLabel}${hits}
        </svg>
        <div class="hours-tip" hidden></div>
      </div>
      <div class="viz-legend"><span><i style="background:#1c6fc0"></i>Live search history</span>${anyExample ? '<span><i class="hatch"></i>Example — no search recorded</span>' : ''}<span><i style="background:#f5bb27"></i>Cumulative hours</span></div>
      <p class="hours-note">Each notice the agent screens replaces ~${time.minutesPerNotice} minutes of an analyst finding, opening and checking it by hand. Same-day re-runs count once. Drag the slider to match your team's reality.</p>`;
    return { title, body };
  }

  // Toggle and slider live outside the re-rendered area so a slider drag
  // isn't interrupted by the chart redrawing underneath it.
  function controlsHTML(time) {
    return `<div class="hours-toggle" role="tablist" aria-label="Period">
        <button type="button" data-hours-mode="week">Weekly</button>
        <button type="button" data-hours-mode="month">Monthly</button>
      </div>
      <label class="hours-slider"><small>Manual time per notice</small><b><output>${time.minutesPerNotice}</output> min</b><input type="range" min="5" max="30" step="1" value="${time.minutesPerNotice}" aria-label="Minutes an analyst spends finding and screening one notice by hand"></label>`;
  }

  function bindControls(root) {
    const time = window.AcesoAnalystTime;
    qa('[data-hours-mode]', root).forEach(b => b.onclick = () => { hoursMode = b.dataset.hoursMode; renderHours(true); });
    const slider = q('.hours-slider input', root);
    slider.oninput = () => { q('.hours-slider output', root).textContent = slider.value; time.setMinutes(slider.value); };
  }

  function bindHours(root) {
    const time = window.AcesoAnalystTime;
    const series = hoursSeries().map(p => ({ ...p, hours: time.hours(p.notices) }));
    const tip = q('.hours-tip', root), plot = q('.hours-plot', root);
    const show = el => {
      const i = Number(el.dataset.i), p = series[i];
      qa('.hours-bar', root).forEach((b, j) => b.classList.toggle('dim', j !== i));
      tip.innerHTML = `<b>${esc(p.range)}</b><span>${time.fmtHours(p.hours)} hours saved</span><small>${p.notices} notices screened${p.live ? ` · ${p.searches} search${p.searches === 1 ? '' : 'es'}` : p.example ? ' · example' : ''}</small>`;
      tip.hidden = false;
      const box = el.getBoundingClientRect(), outer = plot.getBoundingClientRect();
      tip.style.left = `${box.left - outer.left + box.width / 2}px`;
    };
    const hide = () => { tip.hidden = true; qa('.hours-bar', root).forEach(b => b.classList.remove('dim')); };
    qa('.hours-hit', root).forEach(el => { el.onmouseenter = () => show(el); el.onfocus = () => show(el); el.onmouseleave = hide; el.onblur = hide; });
  }

  // animate: replay the bars growing (first paint, period switch) — not on
  // every slider step, where the bars should just resize.
  function renderHours(animate) {
    const root = q('#analystHours');
    const time = window.AcesoAnalystTime;
    if (!root || !time) return;
    if (!q('.hours-body', root)) {
      root.innerHTML = `<header class="hours-head"><div class="hours-title"></div><div class="hours-controls">${controlsHTML(time)}</div></header><div class="hours-body"></div>`;
      bindControls(root);
      animate = true;
    }
    qa('[data-hours-mode]', root).forEach(b => b.classList.toggle('active', b.dataset.hoursMode === hoursMode));
    const { title, body } = hoursChartHTML();
    q('.hours-title', root).innerHTML = title;
    const target = q('.hours-body', root);
    if (animate) target.classList.remove('grown');
    target.innerHTML = body;
    bindHours(target);
    if (animate) requestAnimationFrame(() => requestAnimationFrame(() => target.classList.add('grown')));
  }

  // ------------------------------------------------------------ Yael's charts

  // Each chart = a data function (also read by Aceso Copilot) + an HTML
  // function that draws exactly that data.

  // Pursuit decision quality — reads the example pipeline (no live pipeline yet).
  function decisionQualityData() {
    const pipeline = typeof window.pipelineStats === 'function' ? window.pipelineStats() : null;
    if (!pipeline) return null;
    // counts are "currently in stage"; reached = in this stage or any later one.
    const reached = pipeline.counts.map((_, i) => pipeline.counts.slice(i).reduce((a, b) => a + b, 0));
    const steps = pipeline.stages.slice(1).map((stage, i) => ({ name: `${pipeline.stages[i]} → ${stage}`, from: reached[i], to: reached[i + 1], pct: reached[i] ? Math.round(reached[i + 1] / reached[i] * 100) : 0 }));
    const best = steps.reduce((a, b) => (b.pct > a.pct ? b : a), steps[0]);
    // Headline: share of qualified pursuits that reached proposal production,
    // however many review stages sit in between.
    const p = pipeline.stages.indexOf('Proposal');
    const toProposal = p > 0 && reached[0] ? Math.round(reached[p] / reached[0] * 100) : steps[0].pct;
    return { steps, best, toProposal };
  }
  function decisionQualityCard() {
    const d = decisionQualityData();
    const card = { title: 'Pursuit decision quality', sub: 'How qualified pursuits progress after human review.', note: 'Example data' };
    if (!d) return { ...card, body: empty('pursuit decision quality') };
    const { steps, best } = d;
    return { ...card,
      body: `<div class="dq-headline"><b>${d.toProposal}%</b><span><strong>of qualified pursuits</strong>reach proposal production</span></div>
      <div class="dq-steps">${steps.map(s => `<div tabindex="0" title="${s.to} of ${s.from}"><span>${esc(s.name)}</span><i><em style="width:${s.pct}%"></em></i><b>${s.pct}%</b></div>`).join('')}</div>`,
      foot: `<b>Strongest handoff:</b> ${esc(best.name)} converts ${best.pct}% (${best.to} of ${best.from}).` };
  }

  // Relevant opportunities by publication month, last 12 months.
  function trendData(opps) {
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 11 + i, 1); return { d, count: 0, scoreSum: 0 }; });
    let placed = 0;
    opps.forEach(o => {
      const d = parseDate(o.meta && o.meta.pubDate);
      if (!d) return;
      const m = months.find(x => x.d.getFullYear() === d.getFullYear() && x.d.getMonth() === d.getMonth());
      if (!m) return;
      m.count += 1; m.scoreSum += Number(o.score) || 0; placed += 1;
    });
    const peak = months.reduce((a, b) => (b.count > a.count ? b : a));
    return { months, placed, peak };
  }
  function trendCard(opps) {
    const { months, placed, peak } = trendData(opps);
    const aside = `<div class="insight-toggle"><button type="button" class="${trendMode === 'count' ? 'active' : ''}" data-trend="count">Count</button><button type="button" class="${trendMode === 'fit' ? 'active' : ''}" data-trend="fit">Avg. fit</button></div>`;
    const card = { title: 'Publication trend', sub: 'Relevant opportunities by the month the funder published them.', aside };
    if (placed < 3) return { ...card, body: empty('a publication trend') };
    const val = m => (trendMode === 'count' ? m.count : (m.count ? Math.round(m.scoreSum / m.count) : 0));
    const max = trendMode === 'count' ? Math.max(...months.map(val), 1) : 100;
    const w = 400, h = 180, pad = { l: 4, r: 4, t: 18, b: 22 };
    const bw = (w - pad.l - pad.r) / 12;
    const y = v => h - pad.b - (v / max) * (h - pad.t - pad.b);
    const bars = months.map((m, i) => {
      const v = val(m), x = pad.l + i * bw + 3, top = y(v);
      return `<g tabindex="0"><title>${m.d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: ${m.count} published${m.count ? ` · ${Math.round(m.scoreSum / m.count)}% avg. fit` : ''}</title>
        <rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${(bw - 6).toFixed(1)}" height="${Math.max(0, h - pad.b - top).toFixed(1)}" rx="3" class="trend-bar${m.count ? '' : ' none'}"/>
        ${v ? `<text x="${(x + (bw - 6) / 2).toFixed(1)}" y="${(top - 5).toFixed(1)}" class="viz-value-label" text-anchor="middle">${v}${trendMode === 'fit' ? '%' : ''}</text>` : ''}
        <text x="${(x + (bw - 6) / 2).toFixed(1)}" y="${h - 6}" class="viz-axis-label" text-anchor="middle">${monthLabel(m.d).slice(0, 3)}</text></g>`;
    }).join('');
    return { ...card,
      body: `<svg viewBox="0 0 ${w} ${h}" class="insight-svg" role="img" aria-label="Opportunities by publication month">${bars}</svg>`,
      foot: `<b>${monthLabel(peak.d)} ${peak.d.getFullYear()}</b> is the busiest month — ${peak.count} of ${placed} dated opportunities.` };
  }

  // Deadline readiness over the next 90 days, from real deadlines and flags.
  function readinessData(opps) {
    const today = new Date(); today.setHours(0, 0, 0, 0);
    let undated = 0;
    const items = [];
    opps.forEach(o => {
      const d = parseDate(o.due);
      if (!d) { undated += 1; return; }
      const days = Math.round((d - today) / 86400000);
      if (days < 0 || days > 90) return;
      const flags = (o.meta && o.meta.reviewFlags) || [];
      const incomplete = flags.some(f => /TOR|RFP|Limited information/i.test(f));
      const status = days <= 7 ? 'risk' : (days <= 21 || incomplete ? 'attention' : 'ready');
      items.push({ title: o.title, org: o.org, due: o.due, daysLeft: days, incompleteNotice: incomplete, status });
    });
    const counts = { ready: 0, attention: 0, risk: 0 };
    items.forEach(i => { counts[i.status] += 1; });
    const pct = items.length ? Math.round(counts.ready / items.length * 100) : 0;
    return { items, counts, pct, undated };
  }
  function readinessCard(opps) {
    const { items, counts: c, pct, undated } = readinessData(opps);
    const card = { title: 'Deadline readiness', sub: 'Relevant opportunities due in the next 90 days.' };
    if (items.length < 2) return { ...card, body: empty('deadline readiness') };
    const r = 52, circ = 2 * Math.PI * r;
    let offset = 0;
    const arcs = [['ready', '#26a978'], ['attention', '#f5bb27'], ['risk', '#e34948']].map(([k, color]) => {
      const dash = c[k] / items.length * circ;
      const el = dash ? `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${color}" stroke-width="16" stroke-dasharray="${dash.toFixed(1)} ${(circ - dash).toFixed(1)}" stroke-dashoffset="${(-offset).toFixed(1)}" transform="rotate(-90 70 70)"/>` : '';
      offset += dash; return el;
    }).join('');
    return { ...card,
      body: `<div class="dr-readiness">
      <svg viewBox="0 0 140 140" class="dr-ring" role="img" aria-label="${pct}% on track"><circle cx="70" cy="70" r="${r}" fill="none" stroke="#edf2f7" stroke-width="16"/>${arcs}<text x="70" y="72" text-anchor="middle" class="dr-pct">${pct}%</text><text x="70" y="90" text-anchor="middle" class="dr-label">on track</text></svg>
      <ul>
        <li><i style="background:#26a978"></i><b>${c.ready} ready</b><span>3+ weeks left, complete notice</span></li>
        <li><i style="background:#f5bb27"></i><b>${c.attention} need attention</b><span>Under 3 weeks, or TOR/RFP incomplete</span></li>
        <li><i style="background:#e34948"></i><b>${c.risk} at risk</b><span>Due within 7 days</span></li>
      </ul></div>`,
      foot: `<b>${items.length}</b> due in 90 days · <b>${undated}</b> without a published deadline.` };
  }

  // Search conversion funnel: screened → passed rules → worth a look → strong fit.
  function funnelData(opps, excluded) {
    return [
      { name: 'Screened', count: opps.length + excluded.length },
      { name: 'Passed rules', count: opps.length },
      { name: 'Fit ≥ 65', count: opps.filter(o => o.score >= 65).length },
      { name: 'Strong fit ≥ 85', count: opps.filter(o => o.score >= 85).length }
    ];
  }
  function funnelCard(opps, excluded) {
    const colors = ['#0a4c82', '#1672b8', '#1594d4', '#f5bb27'];
    const stages = funnelData(opps, excluded).map((s, i) => [s.name, s.count, colors[i]]);
    const card = { title: 'Conversion funnel', sub: 'From every notice screened to the strongest fits.' };
    if (stages[0][1] < 4) return { ...card, body: empty('a conversion funnel') };
    const w = 400, rowH = 40, gap = 6, top = stages[0][1];
    const width = n => Math.max(90, (n / top) * (w - 20));
    const shapes = stages.map(([name, n, color], i) => {
      const w1 = width(n), w2 = i < stages.length - 1 ? width(stages[i + 1][1]) : w1 * 0.8;
      const y0 = i * (rowH + gap), cx = w / 2;
      const dark = color === '#f5bb27' ? ' dark' : '';
      return `<g tabindex="0"><title>${name}: ${n}${i ? ` (${Math.round(n / top * 100)}% of screened)` : ''}</title>
        <path d="M${cx - w1 / 2},${y0} L${cx + w1 / 2},${y0} L${cx + w2 / 2},${y0 + rowH} L${cx - w2 / 2},${y0 + rowH} Z" fill="${color}"/>
        <text x="${cx}" y="${y0 + 18}" text-anchor="middle" class="funnel-n${dark}">${n}</text>
        <text x="${cx}" y="${y0 + 32}" text-anchor="middle" class="funnel-name${dark}">${name}</text></g>`;
    }).join('');
    const strong = stages[3][1];
    return { ...card,
      body: `<svg viewBox="0 0 ${w} ${stages.length * (rowH + gap) - gap}" class="insight-svg funnel-svg" role="img" aria-label="Conversion funnel">${shapes}</svg>`,
      foot: `<b>${strong}</b> strong fit${strong === 1 ? '' : 's'} out of ${top} notices screened (${Math.round(strong / top * 100)}%).` };
  }

  // Funders with the most relevant opportunities; published value where given.
  function fundersData(opps) {
    const by = new Map();
    // Same funder published under its Spanish/French name (PNUD = UNDP).
    const ALIASES = { PNUD: 'UNDP' };
    opps.forEach(o => {
      const raw = (o.org || 'Unknown').trim();
      const key = ALIASES[raw] || raw;
      const f = by.get(key) || { name: key, count: 0, value: 0 };
      f.count += 1; f.value += parseValue(o.value) || 0;
      by.set(key, f);
    });
    return [...by.values()].sort((a, b) => b.count - a.count || b.value - a.value).slice(0, 6);
  }
  function fundersCard(opps) {
    const rows = fundersData(opps);
    const card = { title: 'Top funders', sub: 'Who publishes the relevant opportunities · published budget.' };
    if (rows.length < 2) return { ...card, body: empty('a funder ranking') };
    const max = rows[0].count;
    return { ...card,
      body: `<ol class="ins-funders">${rows.map((f, i) => `<li tabindex="0" title="${esc(f.name)}: ${f.count} opportunit${f.count === 1 ? 'y' : 'ies'}${f.value ? `, ${fmtMoney(f.value)} published` : ''}"><span>${esc(f.name)}</span><i><em style="width:${Math.max(6, Math.round(f.count / max * 100))}%"></em></i><strong>${f.count}</strong><small>${f.value ? fmtMoney(f.value) : '—'}</small></li>`).join('')}</ol>`,
      foot: 'Budget is the published lower bound; “—” = not disclosed.' };
  }

  // Deadlines per month over the next six months, split by fit.
  function deadlinesData(opps) {
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, i) => ({ d: new Date(now.getFullYear(), now.getMonth() + i, 1), strong: 0, other: 0 }));
    let placed = 0;
    opps.forEach(o => {
      const d = parseDate(o.due);
      if (!d || d < new Date(now.getFullYear(), now.getMonth(), now.getDate())) return;
      const m = months.find(x => x.d.getFullYear() === d.getFullYear() && x.d.getMonth() === d.getMonth());
      if (!m) return;
      if (o.score >= 85) m.strong += 1; else m.other += 1;
      placed += 1;
    });
    const peak = months.reduce((a, b) => (b.strong + b.other > a.strong + a.other ? b : a));
    return { months, placed, peak };
  }
  function deadlinesCard(opps) {
    const { months, placed, peak } = deadlinesData(opps);
    const card = { title: 'Submission deadlines', sub: `Closing each month, ${monthLabel(months[0].d)} – ${monthLabel(months[5].d)} ${months[5].d.getFullYear()}.` };
    if (placed < 2) return { ...card, body: empty('deadlines by month') };
    const max = Math.max(...months.map(m => m.strong + m.other), 1);
    const w = 400, h = 170, pad = { t: 18, b: 22 };
    const bw = w / 6;
    const y = v => (v / max) * (h - pad.t - pad.b);
    const bars = months.map((m, i) => {
      const x = i * bw + 12, bwi = bw - 24, total = m.strong + m.other;
      const hs = y(m.strong), ho = y(m.other), base = h - pad.b;
      return `<g tabindex="0"><title>${m.d.toLocaleDateString('en-US', { month: 'long' })}: ${total} closing (${m.strong} strong fit)</title>
        <rect x="${x}" y="${(base - hs).toFixed(1)}" width="${bwi}" height="${hs.toFixed(1)}" fill="#1672b8"/>
        <rect x="${x}" y="${(base - hs - ho).toFixed(1)}" width="${bwi}" height="${ho.toFixed(1)}" fill="#7cc3ec"/>
        ${total ? `<text x="${x + bwi / 2}" y="${(base - hs - ho - 5).toFixed(1)}" text-anchor="middle" class="viz-value-label">${total}</text>` : ''}
        <text x="${x + bwi / 2}" y="${h - 6}" text-anchor="middle" class="viz-axis-label">${monthLabel(m.d)}</text></g>`;
    }).join('');
    return { ...card,
      body: `<svg viewBox="0 0 ${w} ${h}" class="insight-svg" role="img" aria-label="Submission deadlines by month">${bars}</svg>
      <div class="viz-legend"><span><i style="background:#1672b8"></i>Strong fit</span><span><i style="background:#7cc3ec"></i>Other relevant</span></div>`,
      foot: `<b>${peak.d.toLocaleDateString('en-US', { month: 'long' })}</b> is the peak month — plan reviewer capacity before it starts.` };
  }

  // Copilot-facing description of the analyst-hours chart and the six
  // insight cards: what each shows, how it's computed, current values.
  function describeForCopilot() {
    const time = window.AcesoAnalystTime;
    const { opps, excluded } = liveData();
    const ym = d => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const seriesFor = mode => { const keep = hoursMode; hoursMode = mode; const s = hoursSeries(); hoursMode = keep; return s; };
    const hoursRows = list => list.map(p => ({ period: p.range, noticesScreened: p.notices, hoursSaved: Math.round(time.hours(p.notices) * 10) / 10, source: p.live ? 'live search history' : p.example ? 'example data (no search recorded)' : 'no searches' }));
    const dq = decisionQualityData(), tr = trendData(opps), rd = readinessData(opps), dl = deadlinesData(opps);
    const week = time ? time.lastSevenDays() : null;
    return {
      analystTimeSaved: time ? {
        where: 'Opportunities hero card "~X h / week — Analyst time saved from search and screening", and the Dashboard section "Analyst time saved" (Weekly/Monthly toggle, minutes-per-notice slider, bars + cumulative line).',
        how: `hours saved = notices the agent screened × ${time.minutesPerNotice} minutes an analyst would spend finding, opening and screening each one by hand ÷ 60. Re-running a search on the same day counts once (the largest search that day). The slider (5-30 min) lets the user change that assumption; it is currently ${time.minutesPerNotice} min. Solid blue bars are real search history; hatched bars are illustrative example data for periods with no recorded search (shown while there are fewer than 4 weeks / 3 months of real history). The gold line is the running cumulative total.`,
        heroCardLast7Days: { noticesScreened: week.notices, hoursSaved: Math.round(week.hours * 10) / 10 },
        weekly: hoursRows(seriesFor('week')),
        monthly: hoursRows(seriesFor('month'))
      } : null,
      pursuitDecisionQuality: dq ? { chart: 'Card "Pursuit decision quality"', isExampleData: true, how: 'Conversion between stages of the example pipeline: the share of pursuits that reached a stage and then also reached the next one.', steps: dq.steps, strongestHandoff: dq.best } : null,
      pipelineValueTrend: (d => ({ chart: 'Bars + line "Pipeline value & opportunities trend" (toggle Opportunities / Value ($))', isExampleData: d.isExample, how: 'Relevant opportunities per month by publication date, last 12 months, with the sum of published budgets as the second series. Uses example figures while fewer than six months have notices. The takeaway compares the last six months with the six before.', months: d.months.map(m => ({ month: m.d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' }), opportunities: m.count, potentialValue: fmtMoney(m.value) })), opportunitiesChangePct: d.countChange, valueChangePct: d.valueChange }))(pipelineTrendData()),
      deadlineReadiness: { chart: 'Donut "Deadline readiness" (% on track)', how: 'Relevant opportunities with a parseable deadline in the next 90 days. At risk = due within 7 days; Needs attention = 8-21 days left, or the notice has an incomplete TOR/RFP or limited information; Ready = more than 3 weeks left and a complete notice. "On track" = ready ÷ all dated in the next 90 days.', onTrackPct: rd.pct, counts: rd.counts, noPublishedDeadline: rd.undated, items: rd.items },
      opportunityConversionFunnel: { chart: 'Funnel "Opportunity conversion funnel"', how: 'Screened = every notice found; Passed rules = not excluded by the knockout rules; then fit score ≥ 65 and ≥ 85.', stages: funnelData(opps, excluded) },
      topFunders: { chart: 'Ranked list "Top funders"', how: 'Relevant opportunities per funder (PNUD merged into UNDP); the value column is the published budget lower bound, "—" when undisclosed.', rows: fundersData(opps).map(f => ({ funder: f.name, opportunities: f.count, publishedValue: f.value ? fmtMoney(f.value) : 'not disclosed' })) },
      submissionDeadlines: { chart: 'Stacked bars "Submission deadlines"', how: 'Relevant opportunities closing each month for the next 6 months; dark = strong fit (≥ 85), light = other relevant.', months: dl.months.map(m => ({ month: ym(m.d), strongFit: m.strong, otherRelevant: m.other })), peakMonth: ym(dl.peak.d) }
    };
  }
  window.dashboardInsightData = describeForCopilot;

  // Pipeline value & opportunities trend: relevant opportunities per month
  // (by publication date) as bars, published value as the line — or the
  // other way round with the toggle. Real data when at least six of the last
  // twelve months have notices; otherwise a clearly labelled example series.
  let pvtMode = 'count';
  const PVT_EXAMPLE_COUNTS = [13, 17, 14, 18, 22, 17, 24, 27, 30, 40, 31, 27];
  const PVT_EXAMPLE_VALUES = [3.1, 4.4, 3.0, 4.9, 5.8, 5.2, 6.0, 7.6, 8.0, 9.9, 7.4, 8.3].map(v => v * 1e6);
  function pipelineTrendData() {
    const opps = (typeof window.activeOpportunities === 'function' ? window.activeOpportunities() : (typeof opportunities !== 'undefined' ? opportunities : [])) || [];
    const now = new Date();
    const months = Array.from({ length: 12 }, (_, i) => ({ d: new Date(now.getFullYear(), now.getMonth() - 11 + i, 1), count: 0, value: 0 }));
    opps.forEach(o => {
      const d = parseDate(o.meta && o.meta.pubDate); if (!d) return;
      const m = months.find(x => x.d.getFullYear() === d.getFullYear() && x.d.getMonth() === d.getMonth()); if (!m) return;
      m.count += 1; m.value += parseValue(o.value) || 0;
    });
    const isExample = months.filter(m => m.count > 0).length < 6;
    if (isExample) months.forEach((m, i) => { m.count = PVT_EXAMPLE_COUNTS[i]; m.value = PVT_EXAMPLE_VALUES[i]; });
    const sum = (list, k) => list.reduce((a, m) => a + m[k], 0);
    const change = (k) => { const prev = sum(months.slice(0, 6), k), last = sum(months.slice(6), k); return prev ? Math.round((last - prev) / prev * 100) : null; };
    return { months, isExample, countChange: change('count'), valueChange: change('value') };
  }
  function pipelineTrendCard() {
    const { months, isExample, countChange, valueChange } = pipelineTrendData();
    const aside = `<div class="insight-toggle"><button type="button" class="${pvtMode === 'count' ? 'active' : ''}" data-pvt="count">Opportunities</button><button type="button" class="${pvtMode === 'value' ? 'active' : ''}" data-pvt="value">Value ($)</button></div>`;
    const bar = m => (pvtMode === 'count' ? m.count : m.value), line = m => (pvtMode === 'count' ? m.value : m.count);
    const w = 820, h = 250, pad = { l: 8, r: 8, t: 30, b: 26 };
    const bw = (w - pad.l - pad.r) / 12, maxB = Math.max(...months.map(bar), 1), maxL = Math.max(...months.map(line), 1);
    const yB = v => h - pad.b - (v / maxB) * (h - pad.t - pad.b);
    const yL = v => h - pad.b - (v / maxL) * (h - pad.t - pad.b) * 0.92;
    const label = v => (pvtMode === 'count' ? String(v) : fmtMoney(v));
    const bars = months.map((m, i) => {
      const x = pad.l + i * bw + bw * 0.16, bwi = bw * 0.68, top = yB(bar(m));
      return `<g tabindex="0"><title>${m.d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}: ${m.count} opportunit${m.count === 1 ? 'y' : 'ies'} · ${fmtMoney(m.value)} published value</title>
        <rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${bwi.toFixed(1)}" height="${Math.max(0, h - pad.b - top).toFixed(1)}" rx="4" fill="url(#pvtGrad)"/>
        <text x="${(x + bwi / 2).toFixed(1)}" y="${pad.t - 12}" class="viz-value-label" text-anchor="middle">${label(bar(m))}</text>
        <text x="${(x + bwi / 2).toFixed(1)}" y="${h - 6}" class="viz-axis-label" text-anchor="middle">${m.d.toLocaleDateString('en-US', { month: 'short' })}</text></g>`;
    }).join('');
    const pts = months.map((m, i) => [pad.l + i * bw + bw / 2, yL(line(m))]);
    const path = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
    const up = (countChange ?? 0) >= 0;
    const pct = v => (v == null ? '—' : `${Math.abs(v)}%`);
    return {
      title: 'Pipeline value & opportunities trend',
      sub: `${pvtMode === 'count' ? 'Bars: relevant opportunities per month · line: potential value' : 'Bars: potential value per month · line: relevant opportunities'}. Last 12 months.`,
      note: isExample ? 'Example data' : '',
      aside,
      body: `<svg viewBox="0 0 ${w} ${h}" class="insight-svg pvt-svg" role="img" aria-label="Pipeline value and opportunities by month"><defs><linearGradient id="pvtGrad" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#3fa4e0"/><stop offset="1" stop-color="#1c78c4"/></linearGradient></defs>${bars}<path d="${path}" fill="none" stroke="#f5bb27" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg>
        <div class="viz-legend"><span><i style="background:#2a8fd6"></i>${pvtMode === 'count' ? 'Opportunities' : 'Potential value'}</span><span><i style="background:#f5bb27"></i>${pvtMode === 'count' ? 'Potential value' : 'Opportunities'}</span></div>`,
      foot: `<b>${up ? '↗ Momentum is building.' : '↘ Momentum is slowing.'}</b> Opportunities are ${up ? 'up' : 'down'} ${pct(countChange)} and potential value ${(valueChange ?? 0) >= 0 ? 'up' : 'down'} ${pct(valueChange)} in the last six months versus the six before.${isExample ? ' Example figures until six months of search history exist.' : ''}`
    };
  }

  function insightCards() {
    const { opps, excluded } = liveData();
    return {
      decisionQuality: decisionQualityCard(), publicationTrend: trendCard(opps), pipelineTrend: pipelineTrendCard(), deadlineReadiness: readinessCard(opps),
      conversionFunnel: funnelCard(opps, excluded), topFunders: fundersCard(opps), submissionDeadlines: deadlinesCard(opps)
    };
  }


  // Mounting and re-rendering are driven by dashboard-layout.js.
  window.dashboardInsightCards = insightCards;
  window.acesoParseDate = parseDate;
  window.renderAnalystHours = renderHours;
  window.setInsightTrendMode = mode => { trendMode = mode; };
  window.setPipelineTrendMode = mode => { pvtMode = mode; };
  if (window.AcesoAnalystTime) window.AcesoAnalystTime.onChange(() => renderHours(false));
})();
