// Wires the "Search now" button (and the initial page load) to the real
// backend at /api/search — replaces the static mock `opportunities` /
// `discarded` arrays with live results from Grants.gov, World Bank
// procurement notices and Coefficient Giving, scored by Gemini (or the
// heuristic fallback if no GEMINI_API_KEY is configured).
// Loaded last, after every other script, so it can safely override
// #searchNow's click handler and reach every render function by name.
(() => {
  const CRITERIA_STATE_KEY = 'aceso_criteria_state_v2';

  function readCriteriaState() {
    try {
      const raw = localStorage.getItem(CRITERIA_STATE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }

  function mapResultToOpportunity(r, index) {
    return {
      id: index + 1,
      score: r.score,
      type: r.type,
      org: r.org,
      country: r.country,
      title: r.title,
      pillar: r.pillar,
      status: r.status,
      value: r.value,
      due: r.due,
      state: r.state,
      source: r.source,
      sourceUrl: r.sourceUrl,
      rfpStatus: r.rfpStatus,
      meta: r.meta
    };
  }

  function mapResultToDiscarded(r) {
    return [r.title, r.org, r.country, r.knockoutReason || 'Knocked out by a hard criteria rule', r.source];
  }

  function sourceBadge(source) {
    if (!source) return '';
    if (typeof SOURCE_META !== 'undefined' && SOURCE_META[source]) {
      return `<span class="tag source-tag ${SOURCE_META[source].cls}">${source}</span> `;
    }
    return `<span class="tag">${source}</span> `;
  }

  // Picks the Today digest so it always represents the sources that actually
  // returned results this search (best item per source first, then backfills
  // by score) — a pure global top-5-by-score list can end up all-Grants.gov
  // when that source's scores happen to cluster at the top.
  function diverseTopPicks(list, n) {
    const usedSources = new Set();
    const picked = [];
    for (const o of list) {
      if (picked.length >= n) break;
      if (!usedSources.has(o.source)) { picked.push(o); usedSources.add(o.source); }
    }
    for (const o of list) {
      if (picked.length >= n) break;
      if (!picked.includes(o)) picked.push(o);
    }
    return picked;
  }

  function renderTodayDiverse() {
    const list = document.querySelector('#todayList');
    if (!list || typeof activeOpportunities !== 'function' || typeof oppRow !== 'function' || typeof bindOppRows !== 'function') return;
    const picks = diverseTopPicks(activeOpportunities(), 5);
    list.innerHTML = picks.map(o => oppRow(o)).join('');
    bindOppRows(list);
    const zone = document.querySelector('.today-zone');
    if (zone) {
      let panel = document.getElementById('todayWatchlist');
      if (!panel && typeof watchlistHTML === 'function' && watchlistHTML()) {
        zone.insertAdjacentHTML('beforeend', `<div id="todayWatchlist">${watchlistHTML()}</div>`);
      } else if (panel && typeof watchlistHTML === 'function') {
        panel.innerHTML = watchlistHTML();
      }
      if (typeof bindWatchlist === 'function') bindWatchlist(zone);
    }
  }
  window.renderToday = renderTodayDiverse;

  // Replaces the "37 automatically excluded" accordion (which otherwise
  // still shows today-enhancements.js's 6 hardcoded example cases) with the
  // real knock-outs from this search, so the count badge and the panel
  // content never disagree again.
  function renderExcludedContent() {
    const container = document.querySelector('#excludedContent');
    if (!container || typeof discarded === 'undefined') return;
    if (!discarded.length) {
      container.innerHTML = '<p style="padding:18px 4px;color:var(--muted);font-size:13px">No opportunities were excluded in this search.</p>';
      return;
    }
    container.innerHTML = discarded.map((d, i) => `
      <article class="excluded-case ${i === 0 ? 'open' : ''}">
        <button class="excluded-case-head no-flag" aria-expanded="${i === 0}">
          <span class="excluded-case-title"><small>${sourceBadge(d[4])}${d[1]} · ${d[2]}</small><b>${d[0]}</b></span>
          <span class="excluded-case-reason">${d[3]}</span><span class="case-chevron">›</span>
        </button>
        <div class="excluded-explanation"><small>WHY THIS IS NOT A MATCH</small><p>${d[3]}</p><div><button class="keep-excluded">Keep excluded</button><button class="recover-case">Recover for human review</button></div></div>
      </article>`).join('');
    container.querySelectorAll('.excluded-case-head').forEach(btn => btn.onclick = () => {
      const card = btn.closest('.excluded-case');
      card.classList.toggle('open');
      btn.setAttribute('aria-expanded', card.classList.contains('open'));
    });
    container.querySelectorAll('.keep-excluded').forEach(btn => btn.onclick = () => btn.closest('.excluded-case').classList.remove('open'));
    container.querySelectorAll('.recover-case').forEach(btn => btn.onclick = () => { btn.textContent = 'Sent to human review'; btn.disabled = true; });
  }

  function refreshCountBadges() {
    const activeCount = typeof activeOpportunities === 'function' ? activeOpportunities().length : (typeof opportunities !== 'undefined' ? opportunities.length : 0);
    document.querySelectorAll('.today-nine').forEach(el => { el.textContent = String(activeCount); });
    const todayTab = document.querySelector('[data-hub="today"] b');
    const allTab = document.querySelector('[data-hub="all"] b');
    if (todayTab) todayTab.textContent = String(activeCount);
    if (allTab) allTab.textContent = String(activeCount);
    const discardedTab = document.querySelector('[data-hub="discarded"] b');
    if (discardedTab && typeof discarded !== 'undefined') discardedTab.textContent = String(discarded.length);
    const excludedToggleLabel = document.querySelector('#excludedToggle b');
    if (excludedToggleLabel && typeof discarded !== 'undefined') excludedToggleLabel.textContent = `${discarded.length} automatically excluded opportunities`;
  }

  function applyResults(data) {
    if (typeof opportunities === 'undefined' || typeof discarded === 'undefined') {
      console.error('[live-search] global `opportunities`/`discarded` arrays not found — is app.js loaded first?');
      return;
    }
    const active = data.results.filter(r => !r.knockedOut);
    const excluded = data.results.filter(r => r.knockedOut);

    // Mutate the SAME array objects in place (never reassign) — every other
    // script captured a reference to these exact arrays at load time.
    opportunities.length = 0;
    active.forEach((r, i) => opportunities.push(mapResultToOpportunity(r, i)));
    discarded.length = 0;
    excluded.forEach(r => discarded.push(mapResultToDiscarded(r)));

    if (typeof selected !== 'undefined') selected.clear();
    if (typeof window !== 'undefined') window.selectedOpp = opportunities[0] || {};

    if (typeof renderToday === 'function') renderToday();
    const oppView = document.querySelector('#opportunitiesView');
    if (oppView && oppView.classList.contains('active') && typeof window.renderUnifiedOpportunities === 'function') {
      window.renderUnifiedOpportunities();
    }
    if (typeof renderPipeline === 'function') { try { renderPipeline(); } catch (e) { /* pipeline uses its own mock stage data — safe to ignore */ } }

    refreshCountBadges();
    renderExcludedContent();
    document.dispatchEvent(new CustomEvent('aceso:live-search-complete', { detail: data }));
  }

  async function runLiveSearch(keyword) {
    const button = document.querySelector('#searchNow');
    const original = button ? button.textContent : null;
    if (button) { button.textContent = 'Searching…'; button.disabled = true; }
    try {
      const res = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: keyword || 'health systems', criteria: readCriteriaState() })
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      applyResults(data);
      if (button) button.textContent = '✓ Search complete';
      if (typeof toast === 'function') {
        const summary = Object.entries(data.sources).map(([k, v]) => `${k}: ${v.ok ? v.count : 'unavailable'}`).join(' · ');
        const geminiNote = data.geminiConfigured ? '' : ' (no Gemini key — using the fallback scorer)';
        toast(`Live search complete — ${data.results.length} opportunities found. ${summary}${geminiNote}`);
      }
    } catch (err) {
      console.error('[live-search] search failed:', err);
      if (button) button.textContent = '⚠ Search failed';
      if (typeof toast === 'function') toast(`Live search failed: ${err.message}. Is the server running?`);
    } finally {
      if (button) setTimeout(() => { button.textContent = original || '✦ Search now'; button.disabled = false; }, 2400);
    }
  }

  function init() {
    const button = document.querySelector('#searchNow');
    if (button) {
      button.onclick = () => runLiveSearch(document.querySelector('#todaySearch')?.value || '');
    }
    // Open the app with real data instead of the static mock set.
    runLiveSearch('');
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.runLiveSearch = runLiveSearch;
})();
