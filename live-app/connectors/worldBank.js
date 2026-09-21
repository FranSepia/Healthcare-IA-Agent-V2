// Source 2 (replaces DevelopmentAid, which requires a paid membership Aceso
// hasn't authorized yet): World Bank Procurement Notices — public, free,
// no API key, and directly relevant since the World Bank is Aceso's #1
// preferred funder. https://search.worldbank.org/api/v2/procnotices

const BASE_URL = 'https://search.worldbank.org/api/v2/procnotices';
const RELEVANT_TYPES = new Set(['Request for Expression of Interest', 'Invitation for Bids', 'General Procurement Notice', 'Request for Proposals']);

function formatIsoDate(iso) {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]+>/g, ' ').replace(/&rsquo;|&lsquo;/g, "'").replace(/&rdquo;|&ldquo;/g, '"').replace(/&amp;/g, '&').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

async function searchWorldBank({ keyword = 'health', rows = 12 } = {}) {
  const url = `${BASE_URL}?format=json&rows=${rows}&qterm=${encodeURIComponent(keyword)}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`World Bank procurement search failed: HTTP ${res.status}`);
  const json = await res.json();
  const notices = json?.procnotices || [];

  return notices
    .filter(n => !RELEVANT_TYPES.size || RELEVANT_TYPES.has(n.notice_type))
    .map(n => {
      const title = n.bid_description || n.project_name || 'World Bank procurement notice';
      return {
        id: `wb-${n.id || n.bid_reference_no}`,
        title,
        org: 'World Bank',
        country: n.project_ctry_name || 'Not specified',
        type: n.notice_type || 'Procurement notice',
        value: 'Not disclosed',
        due: formatIsoDate(n.submission_deadline_date) || 'Not yet set',
        source: 'World Bank',
        sourceUrl: `https://projects.worldbank.org/en/projects-operations/procurement?searchTerm=${encodeURIComponent(n.project_id || n.bid_reference_no || '')}`,
        raw: {
          description: stripHtml(n.notice_text).slice(0, 4000),
          eligibility: null,
          pubDate: formatIsoDate(n.noticedate) || n.noticedate || null,
          sourceOpportunityId: n.bid_reference_no || n.id,
          language: n.notice_lang_name || 'English',
          projectId: n.project_id,
          projectName: n.project_name,
          procurementMethod: n.procurement_method_name || null
        }
      };
    });
}

module.exports = { searchWorldBank };
