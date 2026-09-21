// Source 6: UNGM (UN Global Marketplace) — aggregates procurement notices
// across every UN agency (UNDP, WHO, UNICEF, UNFPA, ...). No public API,
// and unlike the other sources the search/results page renders its notice
// table via client-side JavaScript after load, so a real browser is
// required to read it (a plain HTTP fetch only gets the empty app shell).
// Confirmed live: the search page itself has no bot-protection wall — it
// just needs JS execution, which the shared Puppeteer browser provides.

const { getBrowser } = require('../lib/browser');

const SEARCH_URL = 'https://www.ungm.org/Public/Notice';

function parseDate(text) {
  if (!text) return null;
  const d = new Date(text.trim());
  if (Number.isNaN(d.getTime())) return text.trim();
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

async function searchUngm({ keyword = 'health', limit = 15, timeoutMs = 25000 } = {}) {
  const browser = await getBrowser();
  const page = await browser.newPage();
  try {
    await page.goto(SEARCH_URL, { waitUntil: 'networkidle2', timeout: timeoutMs });
    await page.waitForSelector('#txtNoticeFilterTitle', { timeout: timeoutMs });
    if (keyword) {
      await page.click('#txtNoticeFilterTitle');
      await page.type('#txtNoticeFilterTitle', keyword, { delay: 20 });
    }
    // the results table re-renders asynchronously after typing; give it a moment
    await new Promise(r => setTimeout(r, 2500));
    await page.waitForSelector('.tableRow.dataRow.notice-table', { timeout: timeoutMs }).catch(() => null);

    const rows = await page.evaluate(() => {
      return [...document.querySelectorAll('.tableRow.dataRow.notice-table')].map(row => {
        const cells = [...row.querySelectorAll('[role="cell"]')].map(c => c.textContent.replace(/\s+/g, ' ').trim());
        return { noticeId: row.getAttribute('data-noticeid'), cells };
      });
    });

    return rows.slice(0, limit).map(({ noticeId, cells }) => {
      // Cell layout confirmed live: [0] save-tooltip, [1] title, [2] deadline
      // (with countdown text mixed in), [3] published date, [4] org,
      // [5] notice type, [6] reference, [7] country.
      const title = (cells[1] || '').replace(/Open in a new window$/i, '').trim();
      const deadlineRaw = (cells[2] || '').match(/\d{1,2}-[A-Za-z]{3}-\d{4}/);
      return {
        id: `ungm-${noticeId}`,
        title: title || `UNGM notice ${noticeId}`,
        org: cells[4] || 'UN agency',
        country: cells[7] || 'Not specified',
        type: cells[5] || 'Procurement notice',
        value: 'Not disclosed',
        due: deadlineRaw ? parseDate(deadlineRaw[0]) : 'Not specified',
        source: 'UNGM',
        sourceUrl: `https://www.ungm.org/Public/Notice/${noticeId}`,
        raw: {
          description: `${cells[5] || 'Procurement notice'} from ${cells[4] || 'a UN agency'} in ${cells[7] || 'an unspecified location'}.`,
          eligibility: null,
          pubDate: cells[3] ? parseDate(cells[3]) : null,
          sourceOpportunityId: cells[6] || noticeId,
          language: 'English'
        }
      };
    });
  } finally {
    await page.close().catch(() => {});
  }
}

module.exports = { searchUngm };
