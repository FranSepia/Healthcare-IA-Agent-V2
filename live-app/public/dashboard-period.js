// Dashboard reporting period (Week / Month / Year / Custom). Filters every
// Dashboard number — KPIs, globe and all chart cards — by each opportunity's
// publication date. Other screens always show the full search.
//
// window.dashboardScope() → { all, opps, excluded, total, undated, label }
//   all      every opportunity from the search published in the period
//   opps     the active (relevant) ones among them
//   excluded discarded notices published in the period
(() => {
  const q = (s, r = document) => r.querySelector(s);
  const DAYS = { week: 7, month: 30, year: 365 };
  const LABEL = { week: 'Last 7 days', month: 'Last 30 days', year: 'Last 12 months' };
  let mode = 'year';
  let custom = { from: '', to: '' };

  const fmt = d => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

  function range() {
    const end = new Date(); end.setHours(23, 59, 59, 999);
    if (mode === 'custom' && custom.from && custom.to) {
      const from = new Date(`${custom.from}T00:00:00`), to = new Date(`${custom.to}T23:59:59`);
      return { from, to, label: `${fmt(from)} – ${fmt(to)}` };
    }
    const from = new Date(end); from.setDate(from.getDate() - (DAYS[mode] || 365) + 1); from.setHours(0, 0, 0, 0);
    return { from, to: end, label: `${fmt(from)} – ${fmt(end)}` };
  }

  function published(item) {
    const parse = window.acesoParseDate;
    const text = item && item.meta && item.meta.pubDate;
    return parse && text ? parse(text) : null;
  }

  function scope() {
    const allOpps = typeof opportunities !== 'undefined' ? opportunities : [];
    const active = typeof window.activeOpportunities === 'function' ? window.activeOpportunities() : allOpps;
    const out = typeof discarded !== 'undefined' ? discarded : [];
    const { from, to, label } = range();
    let undated = 0;
    const keep = item => { const d = published(item); if (!d) { undated += 1; return false; } return d >= from && d <= to; };
    const all = allOpps.filter(keep);
    const excluded = out.filter(keep);
    const opps = active.filter(o => all.includes(o));
    return { all, opps, excluded, total: allOpps.length + out.length, undated, label, mode, from, to };
  }
  window.dashboardScope = scope;

  function controlHTML() {
    const s = scope(), shown = s.all.length + s.excluded.length;
    const r = range();
    return `<div class="period-card">
      <div class="period-summary"><i aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/></svg></i>
        <span><small>Reporting period</small><strong>${mode === 'custom' && !(custom.from && custom.to) ? 'Choose dates' : (mode === 'custom' ? r.label : LABEL[mode])}</strong></span></div>
      <div class="period-tabs" role="tablist" aria-label="Reporting period">${['week', 'month', 'year', 'custom'].map(m => `<button type="button" role="tab" aria-selected="${mode === m}" class="${mode === m ? 'active' : ''}" data-period="${m}">${m[0].toUpperCase() + m.slice(1)}</button>`).join('')}</div>
      ${mode === 'custom' ? `<form class="period-custom"><label><span>From</span><input type="date" name="from" value="${custom.from || iso(new Date(Date.now() - 90 * 864e5))}" required></label><label><span>To</span><input type="date" name="to" value="${custom.to || iso(new Date())}" required></label><button type="submit">Apply</button></form>` : ''}
    </div>
    <p class="period-note">${shown} of ${s.total} notices published in this period${s.undated ? ` · ${s.undated} without a publication date not shown` : ''} · updated ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}</p>`;
  }

  function mountControl() {
    const slot = q('#dashboardView .dashboard-title-row > div:last-child');
    if (!slot) return;
    slot.classList.add('period-slot');
    slot.innerHTML = controlHTML();
  }

  // Re-render the whole Dashboard for the new period, keeping the scroll position.
  function apply() {
    const y = window.scrollY;
    if (typeof window.rebuildDashboard === 'function') window.rebuildDashboard();
    window.scrollTo(0, y);
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('#dashboardView [data-period]');
    if (!btn) return;
    mode = btn.dataset.period;
    if (mode === 'custom' && !(custom.from && custom.to)) { mountControl(); return; }
    apply();
  });
  document.addEventListener('submit', e => {
    const form = e.target.closest('#dashboardView .period-custom');
    if (!form) return;
    e.preventDefault();
    const from = form.from.value, to = form.to.value;
    if (!from || !to || from > to) { if (typeof toast === 'function') toast('Choose a start date before the end date.'); return; }
    custom = { from, to };
    apply();
  });
  document.addEventListener('aceso:dashboard-ready', mountControl);

  // Leaving the Dashboard: the shared globe goes back to the full search.
  const priorShow = window.showView;
  if (typeof priorShow === 'function') {
    window.showView = function (name) { priorShow(name); if (name !== 'dashboard' && typeof window.refreshGlobeActivity === 'function') window.refreshGlobeActivity(); };
    document.querySelectorAll('.navlinks button').forEach(b => b.onclick = () => window.showView(b.dataset.view));
  }
})();
