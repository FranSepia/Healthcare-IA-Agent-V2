// Source 5: UNDP Procurement Notices — no public API, but the listing page
// is plain server-rendered HTML (an old ColdFusion site), no bot
// protection, and lists every currently-open notice worldwide (500+) in
// one page load. Filtered by keyword here before scoring, since sending
// all 500+ through Gemini would be slow and expensive.

const cheerio = require('cheerio');

const LIST_URL = 'https://procurement-notices.undp.org/';

function parseDate(text) {
  if (!text) return null;
  // format like "02-Oct-26"
  const d = new Date(text.trim().replace(/-(\d{2})$/, '-20$1'));
  if (Number.isNaN(d.getTime())) return text.trim();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function searchUndp({ keyword = 'health', limit = 15 } = {}) {
  const res = await fetch(LIST_URL);
  if (!res.ok) throw new Error(`UNDP fetch failed: HTTP ${res.status}`);
  const html = await res.text();
  const $ = cheerio.load(html);

  const all = [];
  $('a.vacanciesTableLink').each((_, el) => {
    const row = $(el);
    const cell = (label) => row.find(`.vacanciesTable__cell__label:contains("${label}")`).parent().find('span').first().text().replace(/\s+/g, ' ').trim();
    const title = cell('Title');
    if (!title) return;
    const href = row.attr('href');
    const idMatch = /(?:notice|negotiation)_id=(\d+)/.exec(href || '');
    const officeCountry = cell('UNDP Office/Country') || cell('Country');
    const process = cell('Process');
    const deadline = cell('Deadline');
    const posted = cell('Posted');
    const refNo = cell('Ref No');

    all.push({
      id: `undp-${idMatch ? idMatch[1] : refNo || title.slice(0, 20)}`,
      title,
      org: 'UNDP',
      country: (officeCountry.split('/').pop() || 'Not specified').trim(),
      type: /individual/i.test(process) ? 'Individual Consultant' : 'RFP',
      value: 'Not disclosed',
      due: parseDate(deadline) || 'Not specified',
      source: 'UNDP',
      sourceUrl: href ? new URL(href, LIST_URL).toString() : LIST_URL,
      raw: {
        description: `${process}. UNDP office: ${officeCountry}.`,
        eligibility: null,
        pubDate: parseDate(posted),
        sourceOpportunityId: refNo,
        language: 'English',
        procurementMethod: process
      }
    });
  });

  const kw = keyword.toLowerCase();
  const filtered = kw
    ? all.filter(o => o.title.toLowerCase().includes(kw) || o.raw.description.toLowerCase().includes(kw) || /health|medical|hospital|nutrition|disease|pandemic|clinic/i.test(o.title))
    : all;

  return filtered.slice(0, limit);
}

module.exports = { searchUndp };
