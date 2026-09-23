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
      return `<span class="tag source-tag ${SOURCE_META[source].cls}">${escapeHtml(source)}</span> `;
    }
    return `<span class="tag">${escapeHtml(source)}</span> `;
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
          <span class="excluded-case-title"><small>${sourceBadge(d[4])}${escapeHtml(d[1])} · ${escapeHtml(d[2])}</small><b>${escapeHtml(d[0])}</b></span>
          <span class="excluded-case-reason">${escapeHtml(d[3])}</span><span class="case-chevron">›</span>
        </button>
        <div class="excluded-explanation"><small>WHY THIS IS NOT A MATCH</small><p>${escapeHtml(d[3])}</p><div><button class="keep-excluded">Keep excluded</button><button class="recover-case">Recover for human review</button></div></div>
      </article>`).join('');
    container.querySelectorAll('.excluded-case-head').forEach(btn => btn.onclick = () => {
      const card = btn.closest('.excluded-case');
      card.classList.toggle('open');
      btn.setAttribute('aria-expanded', card.classList.contains('open'));
    });
    container.querySelectorAll('.keep-excluded').forEach(btn => btn.onclick = () => btn.closest('.excluded-case').classList.remove('open'));
    container.querySelectorAll('.recover-case').forEach(btn => btn.onclick = () => { btn.textContent = 'Sent to human review'; btn.disabled = true; });
  }

  function parsePublishedValue(list) {
    return list.reduce((sum, o) => {
      const match = /\$([0-9.]+)\s?(million|M|thousand|K)\b/i.exec(o.value || '');
      if (!match) return sum;
      const unit = match[2].toLowerCase();
      const mult = unit === 'million' || unit === 'm' ? 1e6 : unit === 'thousand' || unit === 'k' ? 1e3 : 1;
      return sum + Number(match[1]) * mult;
    }, 0);
  }

  function fmtCurrency(n) {
    if (n >= 1e6) return `$${(n / 1e6).toFixed(1)}M`;
    if (n >= 1e3) return `$${Math.round(n / 1e3)}K`;
    return `$${n}`;
  }

  function refreshHeroCopy() {
    if (typeof opportunities === 'undefined' || typeof discarded === 'undefined') return;
    const countryCount = new Set(opportunities.map(o => o.country)).size;
    const screenedCopy = document.querySelector('#heroScreenedCopy');
    if (screenedCopy) screenedCopy.textContent = `The agent screened ${opportunities.length + discarded.length} opportunities across ${countryCount} countries and documented why every opportunity qualified or was excluded.`;
    const briefingText = document.querySelector('#heroBriefingText');
    if (briefingText) briefingText.textContent = opportunities.length ? `${opportunities.length} opportunities are ready for your review.` : 'No opportunities matched this search.';
    const bidsExcluded = document.querySelector('#impactBidsExcluded');
    if (bidsExcluded) bidsExcluded.textContent = String(discarded.length);
    const impactValue = document.querySelector('#impactValue');
    if (impactValue) impactValue.textContent = fmtCurrency(parsePublishedValue(opportunities));
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
    refreshHeroCopy();
    renderExcludedContent();
    document.dispatchEvent(new CustomEvent('aceso:live-search-complete', { detail: data }));
  }

  let geminiConfigured = null;
  fetch('/api/health').then(r => r.json()).then(d => { geminiConfigured = Boolean(d.geminiConfigured); }).catch(() => {});

  async function runLiveSearch(keyword) {
    const button = document.querySelector('#searchNow');
    const original = button ? button.textContent : null;
    // With Gemini enabled, every opportunity that passes the non-AI filter
    // gets a real (rate-limited) Gemini call — a full search can genuinely
    // take several minutes on the free tier's request-per-minute quota, so
    // the button needs to say so instead of looking stuck on "Searching…".
    if (button) { button.textContent = geminiConfigured ? 'Searching… (AI scoring, can take several minutes)' : 'Searching…'; button.disabled = true; }
    if (geminiConfigured && typeof toast === 'function') {
      toast('Running the full AI evaluation — every opportunity that clears the non-AI filter gets a real Gemini call, paced to the free-tier rate limit. This can take several minutes.');
    }
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

  // Paints the last saved search instantly on load instead of an empty
  // page — no fresh search runs automatically; the user starts one with
  // the "Search now" button.
  async function loadLatestSavedSearch() {
    try {
      const res = await fetch('/api/search-history/latest');
      if (!res.ok) return;
      const { enabled, search } = await res.json();
      if (!enabled || !search) return;
      applyResults(search);
      if (typeof toast === 'function') {
        const ago = search.searchedAt ? new Date(search.searchedAt).toLocaleString() : 'a previous search';
        toast(`Showing the last saved search (${ago}). Click "Search now" to run a fresh one.`);
      }
    } catch (err) {
      console.error('[live-search] could not load the last saved search:', err);
    }
  }

  function init() {
    const button = document.querySelector('#searchNow');
    if (button) {
      button.onclick = () => runLiveSearch(document.querySelector('#todaySearch')?.value || '');
    }
    // Other scripts set placeholder counts (e.g. "9 opportunities ready")
    // before any real data exists — correct those to the true "nothing
    // loaded yet" state immediately, instead of leaving a stale number
    // visible for the whole (potentially multi-minute) first search.
    refreshCountBadges();
    refreshHeroCopy();
    // Only paint the last saved search — never trigger a fresh (multi-minute,
    // Gemini-backed) search automatically. A new search only ever starts
    // when the user clicks "Search now".
    loadLatestSavedSearch();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  window.runLiveSearch = runLiveSearch;
})();
