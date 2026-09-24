// Simplified view for directors. A "Simplify" switch at the top right turns
// it on; the choice is remembered in this browser.
//
// When on, each screen shows only what a director needs to decide, built
// from the same live data as the full view:
//   Opportunities  the ones that need a decision (hero and map unchanged)
//   Summary panel  why it fits, what to watch, three actions
//   Full record    one page: facts, why, watch-outs, what to confirm
//   Pipeline       stage counts and what is waiting on leadership
//   Criteria       how the agent works and what people decide, read-only
//   Dashboard      the key charts only (hidden via CSS; map unchanged)
// Nothing is deleted: switching Simplify off shows the full view again.
(() => {
  const KEY = 'aceso_simple_mode';
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = v => (typeof escapeHtml === 'function' ? escapeHtml(String(v ?? '')) : String(v ?? ''));
  const say = m => (typeof toast === 'function' ? toast(m) : null);

  let on = false;
  try { on = localStorage.getItem(KEY) === '1'; } catch (e) { /* default off */ }

  const active = () => (typeof window.activeOpportunities === 'function' ? window.activeOpportunities() : (typeof opportunities !== 'undefined' ? opportunities : [])) || [];
  const daysLeft = due => { const t = Date.parse(due || ''); return Number.isNaN(t) ? null : Math.ceil((t - Date.now()) / 864e5); };
  const dueLabel = due => { const d = daysLeft(due); return d == null ? (due && !/not/i.test(due) ? due : 'No deadline published') : d < 0 ? 'Closed' : d === 0 ? 'Closes today' : `${d} day${d === 1 ? '' : 's'} left`; };
  const firstSentence = t => { const s = String(t || '').split(/(?<=[.!?])\s/)[0]; return s.length > 220 ? s.slice(0, 217) + '…' : s; };

  // Opportunities a director should look at: recommended or awaiting a decision.
  function toDecide() {
    return active().filter(o => o.status === 'Recommended' || o.status === 'Decision needed')
      .sort((a, b) => (b.score || 0) - (a.score || 0));
  }

  // ---- Opportunities -----------------------------------------------------------
  let showAll = false;
  function listHTML() {
    const list = toDecide(), shown = showAll ? list : list.slice(0, 8);
    const rec = list.filter(o => o.status === 'Recommended').length;
    const soon = list.filter(o => { const d = daysLeft(o.due); return d != null && d >= 0 && d <= 14; }).length;
    return `<section class="simple-panel simple-decide page-shell">
      <header><h2>Needs your decision</h2><p>${list.length} opportunit${list.length === 1 ? 'y' : 'ies'} · ${rec} recommended · ${soon} closing within 14 days</p></header>
      ${list.length ? `<ol class="simple-list">${shown.map(o => `<li><button type="button" data-simple-open="${o.id}">
        <span class="simple-fit ${o.score >= 85 ? 'high' : 'mid'}">${o.score}%</span>
        <span class="simple-main"><b>${esc(o.title)}</b><small>${esc(o.org)} · ${esc(o.country)}</small></span>
        <span class="simple-due">${esc(dueLabel(o.due))}</span>
        <span class="simple-status ${o.status === 'Recommended' ? 'rec' : 'dec'}">${o.status === 'Recommended' ? 'Recommended' : 'Decide'}</span></button></li>`).join('')}</ol>
        ${list.length > 8 ? `<button type="button" class="simple-link" data-simple-all>${showAll ? 'Show fewer' : `Show all ${list.length}`}</button>` : ''}`
      : '<p class="simple-empty">Nothing needs a decision right now.</p>'}
    </section>`;
  }
  function renderToday() {
    const view = q('#todayView'); if (!view) return;
    q('.simple-decide', view)?.remove();
    q('.today-hero', view)?.insertAdjacentHTML('afterend', listHTML());
  }
  function renderOpportunities() {
    const view = q('#opportunitiesView'); if (!view) return;
    q('.simple-panel', view)?.remove();
    view.insertAdjacentHTML('afterbegin', `<header class="simple-panel simple-head"><h1>Opportunities</h1></header>` + listHTML().replace('simple-decide page-shell', 'simple-decide'));
  }

  // ---- Summary panel -------------------------------------------------------------
  function watchOuts(o) {
    const m = o.meta || {}, flags = (m.reviewFlags || []).slice(0, 3);
    const d = daysLeft(o.due);
    if (d != null && d >= 0 && d < 14 && !flags.some(f => /deadline/i.test(f))) flags.unshift(`Closes in ${d} days`);
    return flags.slice(0, 3);
  }
  function renderDrawer(o) {
    const root = q('#drawerContent'); if (!root) return;
    const m = o.meta || {}, w = watchOuts(o);
    root.innerHTML = `<div class="simple-panel simple-summary">
      <p class="simple-kicker">${esc(o.org)} · ${esc(o.country)}</p>
      <h2>${esc(o.title)}</h2>
      <div class="simple-facts"><div><small>Fit</small><b class="simple-fig">${o.score}%</b></div><div><small>Deadline</small><b>${esc(dueLabel(o.due))}</b></div><div><small>Value</small><b>${esc(o.value || 'Not disclosed')}</b></div></div>
      <h3>Why it fits</h3><p>${esc(firstSentence(m.explanation || m.objective || 'The agent found a match with Aceso’s focus areas.'))}</p>
      ${w.length ? `<h3>Watch out</h3><ul class="simple-watch">${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
      <div class="simple-actions"><button type="button" class="simple-primary" data-simple-decide="pursue">Pursue</button><button type="button" data-simple-decide="clarify">Ask a question</button><button type="button" data-simple-decide="pass">Not for us</button></div>
      <button type="button" class="simple-link" data-simple-record>Open the one-page record →</button>
    </div>`;
    q('[data-simple-record]', root).onclick = () => window.openDetail(o);
  }

  // ---- Full record ---------------------------------------------------------------
  function toConfirm(o) {
    const m = o.meta || {}, f = new Set(m.reviewFlags || []), out = [];
    if (m.rfpAvailable === false || f.has('Missing or incomplete TOR/RFP')) out.push('Get the full terms of reference');
    if (f.has('Unclear eligibility') || /restrict|registered|local/i.test(m.eligibility || '')) out.push('Confirm Aceso is eligible to bid');
    if (!o.value || o.value === 'Not disclosed' || f.has('Budget not published')) out.push('Estimate the budget and effort');
    out.push('Confirm the team is available');
    return out.slice(0, 3);
  }
  function renderRecord(o) {
    const root = q('#detailContent'); if (!root) return;
    const m = o.meta || {}, w = watchOuts(o);
    root.innerHTML = `<article class="simple-panel simple-record">
      <p class="simple-kicker">${esc(o.org)} · ${esc(o.country)}</p>
      <h1>${esc(o.title)}</h1>
      <div class="simple-facts wide"><div><small>Fit</small><b class="simple-fig">${o.score}%</b></div><div><small>Agent says</small><b>${esc(o.status)}</b></div><div><small>Deadline</small><b>${esc(dueLabel(o.due))}</b></div><div><small>Value</small><b>${esc(o.value || 'Not disclosed')}</b></div></div>
      <section><h2>What it is</h2><p>${esc(firstSentence(m.objective || 'No summary published.'))}</p></section>
      <section><h2>Why it fits Aceso</h2><p>${esc(firstSentence(m.explanation || 'The agent found a match with Aceso’s focus areas.'))}</p></section>
      ${w.length ? `<section><h2>Watch out</h2><ul class="simple-watch">${w.map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>` : ''}
      <section><h2>Before saying yes</h2><ul class="simple-checks">${toConfirm(o).map(x => `<li>${esc(x)}</li>`).join('')}</ul></section>
      <div class="simple-actions"><button type="button" class="simple-primary" data-simple-decide="pursue">Pursue</button><button type="button" data-simple-decide="clarify">Ask a question</button><button type="button" data-simple-decide="pass">Not for us</button></div>
      ${o.sourceUrl ? `<a class="simple-link" href="${esc(o.sourceUrl)}" target="_blank" rel="noopener">Original publication ↗</a>` : ''}
    </article>`;
  }

  // ---- Pipeline --------------------------------------------------------------------
  function renderPipeline() {
    const view = q('#pipelineView'); if (!view) return;
    q('.simple-panel', view)?.remove();
    const p = typeof window.pipelineStats === 'function' ? window.pipelineStats() : null;
    if (!p) return;
    const labels = { Qualified: 'To decide', Proposal: 'Writing', Submitted: 'Submitted', Awarded: 'Won' };
    const waiting = p.items.filter(x => x.stage === 'Qualified' || x.stage === 'Submitted');
    view.insertAdjacentHTML('afterbegin', `<section class="simple-panel simple-pipeline">
      <h1>Pipeline</h1><p class="simple-note">Example data until approvals are tracked in the app.</p>
      <div class="simple-stages">${p.stages.map((s, i) => `<div><b class="simple-fig">${p.counts[i]}</b><small>${labels[s] || s}</small></div>`).join('')}<div><b class="simple-fig">${p.fmtValue(p.totalValue)}</b><small>Total value</small></div></div>
      <h2>Waiting on leadership</h2>
      <ol class="simple-list">${waiting.map(x => `<li><div class="simple-row"><span class="simple-main"><b>${esc(x.title)}</b><small>${esc(x.funder)} · ${esc(x.country)} · ${esc(x.value)}</small></span><span class="simple-due">${esc(x.stage === 'Submitted' ? 'Awaiting funder' : x.nextAction)}</span><span class="simple-status ${x.stage === 'Submitted' ? 'rec' : 'dec'}">${x.stage === 'Submitted' ? 'Submitted' : 'Decide'}</span></div></li>`).join('')}</ol>
    </section>`);
  }

  // ---- Criteria ----------------------------------------------------------------------
  function renderCriteria() {
    const view = q('#criteriaView'); if (!view) return;
    q('.simple-panel', view)?.remove();
    let st = {};
    try { st = JSON.parse(localStorage.getItem('aceso_criteria_state_v2') || '{}') || {}; } catch (e) { /* defaults below */ }
    const sources = st.sources || {}, srcOn = ['grantsGov', 'worldBank', 'coefficientGiving', 'unitaid', 'undp', 'ungm'].filter(k => sources[k] !== false).length;
    const rules = (st.knockouts || []).filter(x => x.enabled !== false).length, flags = (st.reviewFlags || []).filter(x => x.enabled !== false).length;
    const focus = (st.focusAreas || []).slice(0, 4).join(', ');
    view.insertAdjacentHTML('afterbegin', `<section class="simple-panel simple-criteria page-shell">
      <h1>How decisions are made</h1>
      <div class="simple-split">
        <div><h2>The agent</h2><ol class="simple-steps">
          <li><b>Collects</b>Open notices from ${srcOn} public sources.</li>
          <li><b>Filters</b>Removes what clearly doesn’t fit (${rules} rules), and flags what needs a closer look (${flags} flags).</li>
          <li><b>Scores</b>Rates each one 0–100 against Aceso’s focus${focus ? `: ${esc(focus)}…` : ''}</li>
          <li><b>Recommends</b>85+ recommended · 65–84 needs a decision · below 65 low fit.</li></ol></div>
        <div><h2>The team</h2><ol class="simple-steps human">
          <li><b>Reviews</b>Analysts read what the agent recommends.</li>
          <li><b>Decides</b>Leadership approves or declines each pursuit.</li>
          <li><b>Staffs and submits</b>People own the proposal and the submission.</li>
          <li><b>Adjusts the rules</b>Criteria can be changed at any time; they apply to the next search.</li></ol></div>
      </div>
      <p class="simple-rule">The agent recommends. People decide.</p>
      <button type="button" class="simple-link" data-simple-off>Edit the criteria in the full view →</button>
    </section>`);
  }

  // ---- wiring ------------------------------------------------------------------------
  function renderFor(name) {
    if (!on) return;
    if (name === 'today') renderToday();
    if (name === 'opportunities') renderOpportunities();
    if (name === 'pipeline') renderPipeline();
    if (name === 'criteria') renderCriteria();
  }
  const currentView = () => (q('.view.active') || {}).dataset?.page;

  function apply() {
    document.body.classList.toggle('simple-mode', on);
    const t = q('#simplifyToggle'); if (t) { t.setAttribute('aria-checked', String(on)); t.classList.toggle('on', on); }
    if (!on) { qa('.simple-panel').forEach(el => { if (!el.closest('#drawerContent,#detailContent')) el.remove(); }); }
    const view = currentView();
    // Views whose content is rebuilt by their own renderer need a fresh render.
    if (view === 'detail' && window.__simpleLastRecord) { window.openDetail(window.__simpleLastRecord); return; }
    if (typeof window.showView === 'function' && view) window.showView(view);
  }

  function installToggle() {
    const bar = q('.masthead .mast-actions'); if (!bar || q('#simplifyToggle')) return;
    bar.insertAdjacentHTML('afterbegin', `<button type="button" id="simplifyToggle" class="simplify-toggle" role="switch" aria-checked="${on}" title="A simpler view for leadership"><span>Simplify</span><i aria-hidden="true"></i></button>`);
    q('#simplifyToggle').onclick = () => {
      on = !on;
      try { localStorage.setItem(KEY, on ? '1' : '0'); } catch (e) { /* session only */ }
      apply();
      say(on ? 'Simplified view on.' : 'Full view on.');
    };
  }

  // Record and summary: replace the rich version when simple mode is on.
  const priorDetail = window.openDetail;
  window.openDetail = function (o) { window.__simpleLastRecord = o; priorDetail(o); if (on) { renderRecord(o || {}); window.scrollTo(0, 0); } };
  const priorDrawer = window.openDrawer;
  window.openDrawer = function (o) { priorDrawer(o); if (on) renderDrawer(o || {}); };

  const priorShow = window.showView;
  window.showView = function (name) { priorShow(name); setTimeout(() => renderFor(name)); };
  qa('.navlinks button').forEach(b => b.onclick = () => window.showView(b.dataset.view));

  document.addEventListener('click', e => {
    const open = e.target.closest('[data-simple-open]');
    if (open) { const o = active().find(x => String(x.id) === open.dataset.simpleOpen); if (o) window.openDrawer(o); return; }
    if (e.target.closest('[data-simple-all]')) { showAll = !showAll; renderFor(currentView()); return; }
    if (e.target.closest('[data-simple-off]')) { q('#simplifyToggle')?.click(); return; }
    const d = e.target.closest('[data-simple-decide]');
    if (d) say({ pursue: 'Marked to pursue. The team has been notified.', clarify: 'Question added to the record for the team.', pass: 'Marked as not for us, with the reason kept.' }[d.dataset.simpleDecide]);
  });
  document.addEventListener('aceso:live-search-complete', () => renderFor(currentView()));

  installToggle();
  apply();
})();
