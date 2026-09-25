// Opportunities hub: the hero (headline, figures, map) always stays on top;
// Today / All opportunities / Discarded / History open *below* it as a
// collapsible panel instead of switching to another screen. The page starts
// collapsed, so only the top part shows until a tab is chosen.
//
// All / Discarded / History reuse their existing renderers (which draw into
// #opportunitiesView); their content is then moved under the tabs here.
// Moving nodes keeps their event handlers.
(() => {
  const q = (s, r = document) => r.querySelector(s);
  const qa = (s, r = document) => [...r.querySelectorAll(s)];
  const tabs = q('#opportunityHubTabs');
  const view = q('#todayView');
  if (!tabs || !view) return;

  // The original tab handlers render each list; keep them to reuse.
  const render = {};
  qa('[data-hub]', tabs).forEach(b => { render[b.dataset.hub] = b.onclick; });

  let open = null; // null = collapsed, otherwise the open tab

  tabs.insertAdjacentHTML('beforeend', '<button type="button" class="hub-toggle" aria-expanded="false"><span>Show</span><i aria-hidden="true">⌄</i></button>');
  tabs.insertAdjacentHTML('afterend', '<section class="page-shell hub-panel" id="hubPanel" hidden></section>');
  const panel = q('#hubPanel'), toggle = q('.hub-toggle', tabs), zone = q('.today-zone', view);

  function paint() {
    const collapsed = open === null;
    view.classList.toggle('hub-collapsed', collapsed);
    if (zone) zone.hidden = open !== 'today';
    panel.hidden = collapsed || open === 'today';
    qa('[data-hub]', tabs).forEach(b => b.classList.toggle('active', b.dataset.hub === open));
    toggle.setAttribute('aria-expanded', String(!collapsed));
    q('span', toggle).textContent = collapsed ? 'Show' : 'Hide';
  }

  function fill(tab) {
    if (tab === 'today' || !render[tab]) return;
    // Empty the panel first: the previous list holds the same element ids the
    // renderers look up, so it would otherwise receive the new content.
    panel.replaceChildren();
    render[tab]();                        // draws into #opportunitiesView and switches to it
    const source = q('#opportunitiesView');
    panel.replaceChildren(...[...source.children].filter(el => !el.matches('.opportunity-hub-tabs,.opportunities-master-head,.opportunities-tabs,.subnav')));
    window.showView('today');             // stay on the hub, hero intact
  }

  // Switching tabs never moves the page: the scroll position is restored
  // after the renderers (which briefly switch screens) have run.
  function keepScroll(fn) {
    const y = window.scrollY;
    fn();
    window.scrollTo(0, y);
    requestAnimationFrame(() => window.scrollTo(0, y));
  }
  function choose(tab) {
    keepScroll(() => {
      if (open === tab) { open = null; paint(); return; } // clicking the open tab folds it
      open = tab;
      fill(tab);
      paint();
    });
  }

  qa('[data-hub]', tabs).forEach(b => { b.onclick = () => choose(b.dataset.hub); });
  toggle.onclick = () => { if (open === null) choose('today'); else keepScroll(() => { open = null; paint(); }); };
  const review = q('.daily-brief [data-jump]'); if (review) review.onclick = () => choose('all');
  const history = q('#historyFromToday'); if (history) history.onclick = () => choose('history');

  // A new search refreshes whichever list is open.
  document.addEventListener('aceso:live-search-complete', () => { if (open && open !== 'today') keepScroll(() => { fill(open); paint(); }); });

  paint();
})();
