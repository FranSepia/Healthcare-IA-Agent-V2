import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import {feature} from 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm';
import world from 'https://esm.sh/@d3-maps/atlas@1.0.0/world/countries/countries-110m';

const countries = feature(world, world.objects.features).features;

// Small alias table for the country-name spellings our live connectors
// actually return (Grants.gov/World Bank/UNDP/UNGM text) that don't match
// the atlas's own labels verbatim. Matching itself is substring-based
// below, so this only needs to bridge the handful of real mismatches.
const ALIASES = {
  'united states': 'united states of america',
  'usa': 'united states of america',
  'russia': 'russian federation',
  'south korea': 'republic of korea',
  'north korea': "dem. people's republic of korea",
  'laos': 'lao pdr',
  'syria': 'syrian arab republic',
  'iran': 'iran (islamic republic of)',
  'vietnam': 'viet nam',
  'ivory coast': "côte d'ivoire",
  'congo, democratic republic of': 'dem. rep. congo',
  'democratic republic of the congo': 'dem. rep. congo',
  'congo, republic of': 'congo',
  'tanzania': 'united republic of tanzania',
  'bolivia': 'bolivia (plurinational state of)',
  'venezuela': 'venezuela (bolivarian republic of)',
  'moldova': 'republic of moldova',
  'czech republic': 'czechia',
  'palestine (west bank)': 'palestine',
  'west bank': 'palestine',
  'united kingdom': 'united kingdom of great britain and northern ireland'
};

function normalize(name) {
  return (name || '').toLowerCase().replace(/[^a-z]+/g, ' ').trim();
}

const centroidCache = new Map();

// Resolves a free-text country string (as returned by any of the six live
// connectors) to a real [lon, lat] centroid, computed from the same world
// geometry the globe already renders — no separate hardcoded coordinate
// table to keep in sync.
function countryCentroid(rawName) {
  if (!rawName) return null;
  const key = normalize(rawName);
  if (centroidCache.has(key)) return centroidCache.get(key);

  const aliased = ALIASES[key] ? normalize(ALIASES[key]) : key;
  let match = countries.find(c => normalize(c.properties?.name) === aliased)
    || countries.find(c => normalize(c.properties?.name) === key);
  if (!match) {
    // fall back to substring match in either direction (handles "Congo,
    // Democratic Republic of" vs "Dem. Rep. Congo", "Korea" vs "Republic
    // of Korea", etc.) — first significant word only, to avoid "in"/"of"
    // matching everything.
    const tokens = key.split(' ').filter(t => t.length > 3);
    match = countries.find(c => {
      const n = normalize(c.properties?.name);
      return tokens.some(t => n.includes(t)) || tokens.some(t => key.includes(n)) && n.length > 3;
    });
  }
  const result = match ? d3.geoCentroid(match) : null;
  centroidCache.set(key, result);
  return result;
}

// Builds the globe's activity points from the app's real, live opportunity
// data (window.opportunities, mutated in place by live-search.js after
// every /api/search call) — grouped by country, one glowing point each.
function computeActivity() {
  const opps = (typeof window.activeOpportunities === 'function' ? window.activeOpportunities() : window.opportunities) || [];
  const byCountry = new Map();
  for (const o of opps) {
    const country = (o.country || '').split(',')[0].split('(')[0].trim();
    if (!country || /^(global|not specified|not disclosed)$/i.test(country)) continue;
    if (!byCountry.has(country)) byCountry.set(country, { count: 0, bestScore: 0, sources: new Set() });
    const entry = byCountry.get(country);
    entry.count += 1;
    entry.bestScore = Math.max(entry.bestScore, o.score || 0);
    if (o.source) entry.sources.add(o.source);
  }

  const points = [];
  for (const [name, entry] of byCountry) {
    const centroid = countryCentroid(name);
    if (!centroid) continue;
    points.push({
      name,
      lon: centroid[0],
      lat: centroid[1],
      count: entry.count,
      bestScore: entry.bestScore,
      detail: `${entry.count} active opportunit${entry.count === 1 ? 'y' : 'ies'} · ${entry.bestScore}% highest fit`
    });
  }
  return points.sort((a, b) => b.bestScore - a.bestScore);
}

let activity = [];
let activityReady = false;

function refreshActivity() {
  activity = computeActivity();
  activityReady = true;
  document.querySelectorAll('[data-interactive-globe]').forEach(el => {
    const redraw = el._globeRedraw;
    if (redraw) redraw();
  });
  document.querySelectorAll('[data-globe-country-count]').forEach(el => { el.textContent = String(activity.length); });
  document.querySelectorAll('[data-globe-top-countries]').forEach(el => {
    const top = activity.slice(0, 3);
    el.innerHTML = top.length
      ? top.map(a => `<span><b>${a.count}</b>${a.name}</span>`).join('')
      : '<span><b>0</b>No active opportunities</span>';
  });
  document.querySelectorAll('[data-globe-selection]').forEach(el => {
    const top = activity[0];
    const b = el.querySelector('b'), span = el.querySelector('span');
    if (top) { b.textContent = top.name; span.textContent = top.detail; }
    else { b.textContent = '—'; span.textContent = 'No active opportunities in this search'; }
  });
}

document.addEventListener('aceso:live-search-complete', refreshActivity);
window.refreshGlobeActivity = refreshActivity;

const initialized = new WeakSet();

function mount(container) {
  if (!container || initialized.has(container)) return;
  initialized.add(container);
  const svg = d3.select(container.querySelector('svg'));
  let rotation = [-18, -8, 0], dragging = false, lastInteraction = Date.now(), selected = null;

  function draw() {
    if (!container.isConnected) return;
    const w = container.clientWidth, h = container.clientHeight || w;
    // Wide hero cards (image was a "curved horizon" crop) get a bigger,
    // more zoomed-in globe that fills the rectangle via slice-cropping;
    // the small circular dashboard widget keeps the classic "whole globe
    // fits inside" framing.
    const wide = w > h * 1.25;
    const size = Math.max(w, h);
    const scale = wide ? size * 0.62 : Math.min(w, h) * 0.455;
    const projection = d3.geoOrthographic().translate([w / 2, h / 2]).scale(scale).rotate(rotation).clipAngle(90).precision(.5);
    const path = d3.geoPath(projection);
    svg.attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', 'xMidYMid slice').selectAll('*').remove();
    svg.append('path').datum({type: 'Sphere'}).attr('class', 'globe-sphere').attr('d', path);
    svg.append('path').datum(d3.geoGraticule10()).attr('class', 'globe-grid').attr('d', path);
    svg.append('g').selectAll('path').data(countries).join('path').attr('class', 'globe-land').attr('d', path);
    svg.append('path').datum({type: 'Sphere'}).attr('class', 'globe-edge').attr('d', path);

    const visible = activity.filter(d => d3.geoDistance([-rotation[0], -rotation[1]], [d.lon, d.lat]) < Math.PI / 2);
    const points = svg.append('g').selectAll('g').data(visible, d => d.name).join('g').attr('transform', d => `translate(${projection([d.lon, d.lat])})`);
    points.append('circle').attr('class', d => `globe-halo${d.bestScore >= 85 ? '' : d.bestScore >= 65 ? ' mid' : ' low'}`).attr('r', d => 8 + Math.min(10, d.count * 1.5));
    points.append('circle')
      .attr('class', d => `globe-point${d.bestScore >= 85 ? '' : d.bestScore >= 65 ? ' mid' : ' low'}${d.name === selected ? ' selected' : ''}`)
      .attr('r', d => 4 + Math.min(5, d.count))
      .attr('role', 'button').attr('tabindex', 0)
      .attr('aria-label', d => `${d.name}: ${d.detail}`)
      .on('click', (event, d) => select(d));

    if (!activityReady) {
      svg.append('text').attr('class', 'globe-loading-label').attr('x', w / 2).attr('y', h - 14).attr('text-anchor', 'middle').text('Running the first live search…');
    } else if (!activity.length) {
      svg.append('text').attr('class', 'globe-loading-label').attr('x', w / 2).attr('y', h - 14).attr('text-anchor', 'middle').text('No active opportunities in this search');
    }
  }

  function select(d) {
    selected = d.name; lastInteraction = Date.now();
    const card = container.closest('.dashboard-world, .radar-card, .dashboard-map')?.querySelector('[data-globe-selection], .globe-selection');
    if (card) { card.querySelector('b').textContent = d.name; card.querySelector('span').textContent = d.detail; }
    draw();
  }

  container._globeRedraw = draw;

  svg.call(d3.drag().on('start', () => { dragging = true; lastInteraction = Date.now(); }).on('drag', event => { rotation[0] += event.dx * .38; rotation[1] = Math.max(-75, Math.min(75, rotation[1] - event.dy * .38)); draw(); }).on('end', () => { dragging = false; lastInteraction = Date.now(); }));
  new ResizeObserver(draw).observe(container);
  d3.timer(() => { if (!container.isConnected) return true; if (!dragging && Date.now() - lastInteraction > 1800) { rotation[0] += .035; draw(); } return false; });
  draw();
}

function mountAll() { document.querySelectorAll('[data-interactive-globe]').forEach(mount); }
document.addEventListener('aceso:dashboard-ready', mountAll);
new MutationObserver(mountAll).observe(document.body, {childList: true, subtree: true});
mountAll();
// This is a deferred module script, so it can execute after the page's own
// initial auto-search already ran and dispatched aceso:live-search-complete
// — meaning our listener above would miss it. Compute activity once from
// whatever window.opportunities already holds by the time we get here, so
// the first render isn't stuck showing "Running the first live search…".
refreshActivity();
