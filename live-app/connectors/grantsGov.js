// Source 1: Grants.gov — official public search API, no API key required.
// https://www.grants.gov/api-guide (search2 + fetchOpportunity endpoints)

const SEARCH_URL = 'https://api.grants.gov/v1/api/search2';
const DETAIL_URL = 'https://api.grants.gov/v1/api/fetchOpportunity';

function formatUsDate(mdY) {
  if (!mdY) return null;
  const [m, d, y] = mdY.split('/');
  if (!m || !d || !y) return null;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function fetchDetail(id) {
  try {
    const res = await fetch(DETAIL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ opportunityId: Number(id) })
    });
    if (!res.ok) return null;
    const json = await res.json();
    const synopsis = json?.data?.synopsis || {};
    const eligible = (json?.data?.eligibleApplicants || []).map(e => e.description).filter(Boolean);
    return {
      description: synopsis.synopsisDesc || '',
      awardCeiling: synopsis.awardCeiling && synopsis.awardCeiling !== 'none' ? Number(synopsis.awardCeiling) : null,
      eligibility: eligible.join('; ') || null
    };
  } catch (err) {
    console.error(`[grants.gov] detail fetch failed for ${id}: ${err.message}`);
    return null;
  }
}

async function searchGrantsGov({ keyword = 'health', rows = 12, detailLimit = 10 } = {}) {
  const res = await fetch(SEARCH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      keyword,
      rows,
      oppStatuses: 'forecasted|posted',
      fundingCategories: 'HL'
    })
  });
  if (!res.ok) throw new Error(`Grants.gov search failed: HTTP ${res.status}`);
  const json = await res.json();
  const hits = json?.data?.oppHits || [];

  return Promise.all(hits.map(async (hit, i) => {
    const detail = i < detailLimit ? await fetchDetail(hit.id) : null;
    return {
      id: `gg-${hit.id}`,
      title: hit.title,
      org: hit.agency || 'U.S. Government',
      country: 'United States',
      type: hit.docType === 'forecast' ? 'Forecast' : 'Grant',
      value: detail?.awardCeiling ? `$${detail.awardCeiling.toLocaleString('en-US')}` : 'Not disclosed',
      due: formatUsDate(hit.closeDate) || 'Not yet set',
      source: 'Grants.gov',
      sourceUrl: `https://www.grants.gov/search-results-detail/${hit.id}`,
      raw: {
        description: detail?.description || '',
        eligibility: detail?.eligibility || null,
        pubDate: formatUsDate(hit.openDate),
        sourceOpportunityId: hit.number,
        language: 'English'
      }
    };
  }));
}

module.exports = { searchGrantsGov };
