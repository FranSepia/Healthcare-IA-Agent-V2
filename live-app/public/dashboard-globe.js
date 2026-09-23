import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import {feature} from 'https://cdn.jsdelivr.net/npm/topojson-client@3.1.0/+esm';
import world from 'https://esm.sh/@d3-maps/atlas@1.0.0/world/countries/countries-110m';

const countries = feature(world, world.objects.features).features;

// One shared set of gradient/blur defs, injected once into the document so
// every globe instance (Today hero + Dashboard widget) can reference the
// same glow via url(#id) — SVG fragment refs resolve document-wide, so this
// doesn't need to live inside each mounted <svg>.
function injectGlobeDefs() {
  if (document.getElementById('globe-defs-root')) return;
  const svgNS = 'http://www.w3.org/2000/svg';
  const holder = document.createElementNS(svgNS, 'svg');
  holder.setAttribute('id', 'globe-defs-root');
  holder.setAttribute('aria-hidden', 'true');
  holder.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden';
  holder.innerHTML = `<defs>
    <radialGradient id="globeGlow-high" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#fff3d0" stop-opacity=".95"/>
      <stop offset="42%" stop-color="#ffd34f" stop-opacity=".4"/>
      <stop offset="100%" stop-color="#ffd34f" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="globeGlow-mid" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#d9f2ff" stop-opacity=".9"/>
      <stop offset="42%" stop-color="#5ec6ff" stop-opacity=".36"/>
      <stop offset="100%" stop-color="#5ec6ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="globeGlow-low" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="#dbe6f0" stop-opacity=".75"/>
      <stop offset="42%" stop-color="#5c7c9e" stop-opacity=".3"/>
      <stop offset="100%" stop-color="#5c7c9e" stop-opacity="0"/>
    </radialGradient>
    <filter id="globePointShine" x="-90%" y="-90%" width="280%" height="280%">
      <feGaussianBlur in="SourceGraphic" stdDeviation="1" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
  </defs>`;
  document.body.appendChild(holder);
}
injectGlobeDefs();

function tier(d) { return d.bestScore >= 85 ? 'high' : d.bestScore >= 65 ? 'mid' : 'low'; }
function tierClass(d) { const t = tier(d); return t === 'high' ? '' : ` ${t}`; }
function tierColor(d) { const t = tier(d); return t === 'high' ? '#ffd34f' : t === 'mid' ? '#5ec6ff' : '#5c7c9e'; }

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
    if (!byCountry.has(country)) byCountry.set(country, { count: 0, bestScore: 0, sources: new Set(), opportunities: [] });
    const entry = byCountry.get(country);
    entry.count += 1;
    entry.bestScore = Math.max(entry.bestScore, o.score || 0);
    if (o.source) entry.sources.add(o.source);
    entry.opportunities.push(o);
  }

  const points = [];
  for (const [name, entry] of byCountry) {
    const centroid = countryCentroid(name);
    if (!centroid) continue;
    entry.opportunities.sort((a, b) => (b.score || 0) - (a.score || 0));
    points.push({
      name,
      lon: centroid[0],
      lat: centroid[1],
      count: entry.count,
      bestScore: entry.bestScore,
      opportunities: entry.opportunities,
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
}

document.addEventListener('aceso:live-search-complete', refreshActivity);
window.refreshGlobeActivity = refreshActivity;

const initialized = new WeakSet();

// Angle-aware lerp so a jump from, say, 170° to -170° travels the short way
// (10°) across the antimeridian instead of spinning the long way around.
function angleLerp(a, b) {
  const diff = ((b - a + 540) % 360) - 180;
  return t => a + diff * t;
}

const TRAVEL_MS = 2600;   // how long one slow jump between points takes
const DWELL_MS = 3400;    // how long the globe rests on a point before jumping again
const RESUME_DELAY = 2200; // grace period after a manual drag before auto-jumping resumes

function mount(container) {
  if (!container || initialized.has(container)) return;
  initialized.add(container);
  const svg = d3.select(container.querySelector('svg'));
  let rotation = [-18, -8, 0], dragging = false, lastInteraction = Date.now(), selected = null;
  let travel = null, focusIdx = -1, nextActionAt = Date.now() + 1200;

  function clampLat(l) { return Math.max(-70, Math.min(70, l)); }

  // A small text tooltip that only ever appears right where the user
  // clicked a point — nothing shows until then, and nothing persists
  // as a fixed panel over the map.
  const tip = document.createElement('div');
  tip.className = 'globe-point-tip';
  tip.hidden = true;
  container.appendChild(tip);

  function hideTip() { tip.hidden = true; }

  function showTip(x, y, d) {
    const opps = d.opportunities || [];
    tip.innerHTML = `<b>${escapeHtml(d.name)}</b>` + (opps.length
      ? opps.slice(0, 5).map((o, i) => `<a data-globe-opp="${i}"><em>${o.score}%</em>${escapeHtml(o.title)}</a>`).join('')
      : `<span>${escapeHtml(d.detail)}</span>`);
    tip.querySelectorAll('[data-globe-opp]').forEach(a => {
      a.onclick = (e) => {
        e.stopPropagation();
        const o = opps[Number(a.dataset.globeOpp)];
        if (o && typeof window.openDetail === 'function') window.openDetail(o);
      };
    });
    tip.hidden = false;
    const w = container.clientWidth, h = container.clientHeight;
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    let left = x + 12, top = y - th / 2;
    if (left + tw > w - 4) left = x - tw - 12;
    left = Math.max(4, left);
    top = Math.max(4, Math.min(top, h - th - 4));
    tip.style.left = `${left}px`;
    tip.style.top = `${top}px`;
  }

  function beginTravelTo(d) {
    travel = { fromLon: rotation[0], fromLat: rotation[1], toLon: -d.lon, toLat: clampLat(-d.lat), start: Date.now() };
    selected = d.name;
  }

  function draw() {
    if (!container.isConnected) return;
    const w = container.clientWidth, h = container.clientHeight || w;
    // Wide hero cards (image was a "curved horizon" crop) get a bigger,
    // more zoomed-in globe that fills the rectangle via slice-cropping;
    // the small circular dashboard widget keeps the classic "whole globe
    // fits inside" framing. Both are scaled down from before so there's
    // visible frame around the sphere and points read as bigger/brighter
    // relative to the globe's surface.
    const wide = w > h * 1.25;
    const size = Math.max(w, h);
    const scale = wide ? size * 0.48 : Math.min(w, h) * 0.36;
    const projection = d3.geoOrthographic().translate([w / 2, h / 2]).scale(scale).rotate(rotation).clipAngle(90).precision(.5);
    const path = d3.geoPath(projection);
    svg.attr('viewBox', `0 0 ${w} ${h}`).attr('preserveAspectRatio', 'xMidYMid slice').selectAll('*').remove();
    svg.append('path').datum({type: 'Sphere'}).attr('class', 'globe-sphere').attr('d', path);
    svg.append('path').datum(d3.geoGraticule10()).attr('class', 'globe-grid').attr('d', path);
    svg.append('g').selectAll('path').data(countries).join('path').attr('class', 'globe-land').attr('d', path);
    svg.append('path').datum({type: 'Sphere'}).attr('class', 'globe-edge').attr('d', path);

    const visible = activity.filter(d => d3.geoDistance([-rotation[0], -rotation[1]], [d.lon, d.lat]) < Math.PI / 2);
    const points = svg.append('g').selectAll('g').data(visible, d => d.name).join('g').attr('transform', d => `translate(${projection([d.lon, d.lat])})`);
    points.append('circle').attr('class', d => `globe-halo${tierClass(d)}`).style('fill', d => `url(#globeGlow-${tier(d)})`).attr('r', d => 12 + Math.min(16, d.count * 2));
    const ping = points.append('circle').attr('class', 'globe-ping').attr('r', d => 5 + Math.min(6, d.count)).style('fill', 'none').style('stroke', tierColor).style('stroke-width', 1.4).style('opacity', .6);
    ping.append('animate').attr('attributeName', 'r').attr('values', d => { const r = 5 + Math.min(6, d.count); return `${r};${r + 11}`; }).attr('dur', '2.4s').attr('repeatCount', 'indefinite');
    ping.append('animate').attr('attributeName', 'opacity').attr('values', '.6;0').attr('dur', '2.4s').attr('repeatCount', 'indefinite');
    points.append('circle')
      .attr('class', d => `globe-point${tierClass(d)}${d.name === selected ? ' selected' : ''}`)
      .attr('r', d => 5 + Math.min(6, d.count))
      .style('stroke', '#fff').style('stroke-width', d => d.name === selected ? 2.2 : 1.4)
      .attr('role', 'button').attr('tabindex', 0)
      .attr('aria-label', d => `${d.name}: ${d.detail}`)
      .on('click', (event, d) => {
        lastInteraction = Date.now();
        focusIdx = activity.findIndex(a => a.name === d.name);
        beginTravelTo(d);
        const [x, y] = d3.pointer(event, container);
        showTip(x, y, d);
      });

    if (!activityReady) {
      svg.append('text').attr('class', 'globe-loading-label').attr('x', w / 2).attr('y', h - 14).attr('text-anchor', 'middle').text('Running the first live search…');
    } else if (!activity.length) {
      svg.append('text').attr('class', 'globe-loading-label').attr('x', w / 2).attr('y', h - 14).attr('text-anchor', 'middle').text('No active opportunities in this search');
    }
  }

  container._globeRedraw = draw;

  svg.call(d3.drag().on('start', () => { dragging = true; lastInteraction = Date.now(); hideTip(); }).on('drag', event => { rotation[0] += event.dx * .38; rotation[1] = Math.max(-75, Math.min(75, rotation[1] - event.dy * .38)); draw(); }).on('end', () => { dragging = false; lastInteraction = Date.now(); }));
  new ResizeObserver(draw).observe(container);

  // Instead of spinning continuously, the globe rests on the current point,
  // then slowly eases its way to the next-most-relevant one (highest fit
  // first, cycling through), pausing between each jump. Dragging suspends
  // this for a couple of seconds so it never fights the user.
  d3.timer(() => {
    if (!container.isConnected) return true;
    if (dragging) return false;
    const now = Date.now();

    if (travel) {
      const t = Math.min(1, (now - travel.start) / TRAVEL_MS);
      const eased = d3.easeCubicInOut(t);
      rotation[0] = angleLerp(travel.fromLon, travel.toLon)(eased);
      rotation[1] = travel.fromLat + (travel.toLat - travel.fromLat) * eased;
      draw();
      if (t >= 1) { travel = null; nextActionAt = now + DWELL_MS; }
      return false;
    }

    if (now - lastInteraction < RESUME_DELAY || now < nextActionAt) return false;

    if (activity.length) {
      focusIdx = (focusIdx + 1) % activity.length;
      beginTravelTo(activity[focusIdx]);
      hideTip();
    } else {
      // No data yet — gentle fallback spin instead of sitting still.
      rotation[0] += .035;
      draw();
      nextActionAt = now;
    }
    return false;
  });
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
