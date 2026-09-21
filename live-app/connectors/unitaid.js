// Source 4: Unitaid — no public API, but the Consultancies & RFPs page is
// plain server-rendered HTML with clean structure (title, objective,
// deadline, reference and — usefully — the real official UNGM link for
// each notice). Like coefficientgiving.org, it 403s Node's native fetch
// on TLS fingerprint alone (same headers pass fine via curl) — see
// lib/curlFetch.js.

const cheerio = require('cheerio');
const { curlFetchText } = require('../lib/curlFetch');

const PAGE_URL = 'https://unitaid.org/consultancies-and-rfps/';

function parseDeadline(text) {
  if (!text) return null;
  const d = new Date(text.trim());
  if (Number.isNaN(d.getTime())) return text.trim();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function searchUnitaid() {
  const html = await curlFetchText(PAGE_URL);
  const $ = cheerio.load(html);

  const items = [];
  $('.rfp-item').each((_, el) => {
    const block = $(el);
    const title = block.find('.page-header-title, p strong').first().text().trim();
    if (!title) return;
    const paragraphs = block.find('.col-lg-7 p').map((__, p) => $(p).text().trim()).get().filter(Boolean);
    const objective = paragraphs.find(p => p !== title) || '';
    const deadlineRaw = block.find('h6:contains("Deadline")').next('p').text().trim();
    const officialLink = block.find('a[href*="ungm.org"]').attr('href') || null;
    const reference = (block.text().match(/Reference:\s*([A-Z0-9/._-]+)/i) || [])[1] || null;

    items.push({
      id: `unitaid-${reference || title.slice(0, 20)}`,
      title,
      org: 'Unitaid',
      country: 'Global',
      type: 'RFP',
      value: 'Not disclosed',
      due: parseDeadline(deadlineRaw) || 'Not specified',
      source: 'Unitaid',
      sourceUrl: officialLink || PAGE_URL,
      raw: {
        description: objective,
        eligibility: null,
        pubDate: null,
        sourceOpportunityId: reference,
        language: 'English'
      }
    });
  });

  return items;
}

module.exports = { searchUnitaid };
