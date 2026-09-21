function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .split(' ')
    .slice(0, 8)
    .join(' ');
}

// Groups opportunities by normalized title + funder. Exact repeats collapse
// into one record; matches across different sources are kept as one primary
// record with every detecting source preserved (per the ROI-validation dedup
// requirement — never double-count the same opportunity).
function dedupe(opportunities) {
  const groups = new Map();
  for (const opp of opportunities) {
    const key = `${normalizeTitle(opp.title)}::${(opp.org || '').toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(opp);
  }

  const result = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      group[0].dupStatus = 'New';
      group[0].mergedSources = [];
      result.push(group[0]);
      continue;
    }
    const sources = new Set(group.map(g => g.source));
    const primary = group.reduce((best, g) => (g.raw?.description?.length || 0) > (best.raw?.description?.length || 0) ? g : best, group[0]);
    primary.dupStatus = sources.size > 1 ? 'Possible Duplicate' : 'Repeated';
    primary.mergedSources = group
      .filter(g => g !== primary)
      .map(g => ({ source: g.source, detectedAt: g.raw?.pubDate || 'This run', sourceUrl: g.sourceUrl }));
    result.push(primary);
  }
  return result;
}

module.exports = { dedupe, normalizeTitle };
