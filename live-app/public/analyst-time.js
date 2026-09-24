// Analyst time saved — how many hours of manual portal searching and
// screening the agent's searches replace. Shared by the Opportunities hero
// card and the Dashboard history chart so the two can never disagree.
//
// Model (kept deliberately simple and visible in the UI):
//   hours = notices screened × minutes an analyst would spend finding,
//           opening and screening one notice by hand ÷ 60
// Notices come from the real saved search history (/api/search-history).
// Re-running a search on the same day finds the same notices, so each day
// counts once, at its largest search — repeated clicks don't inflate it.
(() => {
  const DEFAULT_MINUTES = 12;
  const listeners = new Set();
  let minutesPerNotice = DEFAULT_MINUTES;
  let searches = null; // [{ at: Date, notices: number }]
  let loading = null;

  function dayKey(d) { return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; }
  function weekStart(d) { const s = new Date(d); s.setHours(0, 0, 0, 0); s.setDate(s.getDate() - ((s.getDay() + 6) % 7)); return s; }

  function currentSearchNotices() {
    const active = typeof opportunities !== 'undefined' ? opportunities.length : 0;
    const excluded = typeof discarded !== 'undefined' ? discarded.length : 0;
    return active + excluded;
  }

  function load(force) {
    if (loading && !force) return loading;
    loading = fetch('/api/search-history?limit=100')
      .then(r => r.json())
      .then(d => {
        searches = (d.searches || [])
          .map(s => ({ at: new Date(s.searchedAt), notices: Number(s.resultCount) || 0 }))
          .filter(s => !Number.isNaN(s.at.getTime()) && s.notices > 0);
      })
      .catch(() => { searches = []; })
      .then(() => { listeners.forEach(fn => fn()); });
    return loading;
  }

  // Largest search per calendar day. Falls back to the search on screen when
  // no history is stored (e.g. Firestore not configured).
  function days() {
    const byDay = new Map();
    (searches || []).forEach(s => {
      const key = dayKey(s.at);
      const prev = byDay.get(key);
      if (!prev || s.notices > prev.notices) byDay.set(key, { date: new Date(s.at), notices: s.notices, searches: (prev ? prev.searches : 0) + 1 });
      else prev.searches += 1;
    });
    if (!byDay.size && currentSearchNotices()) {
      const now = new Date();
      byDay.set(dayKey(now), { date: now, notices: currentSearchNotices(), searches: 1 });
    }
    return [...byDay.values()].sort((a, b) => a.date - b.date);
  }

  function hours(notices) { return notices * minutesPerNotice / 60; }

  // Real, per-week totals (Monday-start) — only weeks that had searches.
  function weeks() {
    const byWeek = new Map();
    days().forEach(d => {
      const start = weekStart(d.date);
      const key = dayKey(start);
      const w = byWeek.get(key) || { start, notices: 0, searches: 0, days: 0 };
      w.notices += d.notices; w.searches += d.searches; w.days += 1;
      byWeek.set(key, w);
    });
    return [...byWeek.values()].sort((a, b) => a.start - b.start);
  }

  // Trailing 7 days, for the "~X h / week" hero card.
  function lastSevenDays() {
    const cutoff = Date.now() - 7 * 86400000;
    const recent = days().filter(d => d.date.getTime() >= cutoff);
    const notices = recent.reduce((s, d) => s + d.notices, 0);
    return { notices, hours: hours(notices), searches: recent.reduce((s, d) => s + d.searches, 0) };
  }

  function setMinutes(n) {
    minutesPerNotice = Math.max(1, Number(n) || DEFAULT_MINUTES);
    listeners.forEach(fn => fn());
  }

  function fmtHours(h) { return h >= 10 ? String(Math.round(h)) : h >= 1 ? h.toFixed(1).replace(/\.0$/, '') : h.toFixed(1); }

  function renderHeroCard() {
    const el = document.querySelector('#impactHoursSaved');
    if (!el) return;
    const week = lastSevenDays();
    el.textContent = week.notices ? `~${Math.max(1, Math.round(week.hours))} h / week` : '—';
    const card = el.closest('div');
    if (card) card.title = week.notices
      ? `${week.notices} notices screened by the agent in the last 7 days × ${minutesPerNotice} min an analyst would spend finding and screening each one by hand.`
      : 'No searches in the last 7 days.';
  }

  function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

  window.AcesoAnalystTime = {
    load, weeks, lastSevenDays, hours, fmtHours, onChange, setMinutes,
    get minutesPerNotice() { return minutesPerNotice; },
    DEFAULT_MINUTES
  };

  onChange(renderHeroCard);
  // A new search is saved to history server-side before the event fires.
  document.addEventListener('aceso:live-search-complete', () => load(true));
  document.addEventListener('click', e => {
    const card = e.target.closest('[data-hours-card]');
    if (!card || typeof window.showView !== 'function') return;
    window.showView('dashboard');
    setTimeout(() => document.querySelector('#analystHours')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 350);
  });
  load();
})();
