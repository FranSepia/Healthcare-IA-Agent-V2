// Source 3: Coefficient Giving — no public API, so this is a web-monitoring
// connector. Verified live: the site returns 403 without a browser-like
// User-Agent header, and 200 with one. The Global Health & Wellbeing
// Opportunities page links to individual "request-for-proposals-*" pages,
// which is where actual RFPs live (the general research-and-news page is
// blog/news content, not opportunities).

const cheerio = require('cheerio');
const { callGemini, hasGeminiKey } = require('../lib/gemini');
const { buildCoefficientPrompt } = require('../lib/scoring');
const { curlFetchText } = require('../lib/curlFetch');

const PRIORITY_PAGE = 'https://coefficientgiving.org/funds/global-health-wellbeing-opportunities/';

// coefficientgiving.org sits behind bot protection that fingerprints the TLS
// handshake: Node's built-in fetch (undici) gets a 403, curl gets a 200 with
// the identical headers — see lib/curlFetch.js.
const fetchPage = curlFetchText;

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/g, ' ')
    .replace(/<style[\s\S]*?<\/style>/g, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&rsquo;|&lsquo;/g, "'")
    .replace(/&rdquo;|&ldquo;/g, '"')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function heuristicClassify(pageTitle, text) {
  const lower = text.toLowerCase();
  const looksLikeRfp = /request for proposals|apply by|deadline|letter of interest|eligib/.test(lower);
  const deadlineMatch = text.match(/deadline[:\s]+([A-Za-z]+ \d{1,2},? \d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i);
  return {
    isRfp: looksLikeRfp,
    classification: /clos(ed|es)/i.test(lower) && deadlineMatch ? 'Closed RFP' : 'Open RFP',
    title: pageTitle,
    objective: text.slice(0, 220),
    amount: (text.match(/\$[0-9][0-9,.]*\s?(million|billion|thousand|M|K)\b/i) || [])[0] || 'Not disclosed',
    eligibility: 'See official listing',
    deadline: deadlineMatch ? deadlineMatch[1] : 'Not specified',
    thematicArea: 'Global health & wellbeing'
  };
}

async function classifyPage(url, pageTitle, text) {
  if (hasGeminiKey()) {
    try {
      const result = await callGemini(buildCoefficientPrompt(pageTitle, url, text));
      return result;
    } catch (err) {
      console.error(`[coefficient giving] Gemini classification failed for ${url}: ${err.message}. Falling back to heuristic.`);
    }
  }
  return heuristicClassify(pageTitle, text);
}

const RFP_STATUS_MAP = {
  'Open RFP': 'Open RFP',
  'Closed RFP': 'Closed RFP',
  'Informational Announcement': 'Informational Announcement',
  'Potential Future Opportunity': 'Potential Future Opportunity'
};

async function searchCoefficientGiving({ pageLimit = 6 } = {}) {
  const html = await fetchPage(PRIORITY_PAGE);
  const $ = cheerio.load(html);

  const links = new Set();
  $('a[href*="/funds/global-health-wellbeing-opportunities/"]').each((_, el) => {
    const href = $(el).attr('href');
    if (href && href !== PRIORITY_PAGE && !href.includes('#') && href.split('/funds/global-health-wellbeing-opportunities/')[1]) {
      links.add(href.split('?')[0].split('#')[0]);
    }
  });

  const candidates = [...links].slice(0, pageLimit);
  const results = [];

  for (const url of candidates) {
    try {
      const pageHtml = await fetchPage(url);
      const $$ = cheerio.load(pageHtml);
      const pageTitle = $$('h1').first().text().trim() || $$('title').text().trim() || url;
      const bodyText = stripHtml(pageHtml);
      if (bodyText.length < 200) continue; // too thin to be a real notice

      const classified = await classifyPage(url, pageTitle, bodyText);
      if (!classified.isRfp) continue; // blog post / news — spec says ignore these

      const rfpStatus = RFP_STATUS_MAP[classified.classification] || 'Informational Announcement';

      results.push({
        id: `cg-${Buffer.from(url).toString('base64url').slice(0, 16)}`,
        title: classified.title || pageTitle,
        org: 'Coefficient Giving',
        country: 'Global',
        type: 'RFP',
        value: classified.amount || 'Not disclosed',
        due: classified.deadline || 'Not specified',
        source: 'Coefficient Giving',
        rfpStatus,
        sourceUrl: url,
        raw: {
          description: classified.objective || bodyText.slice(0, 400),
          eligibility: classified.eligibility || null,
          pubDate: null,
          sourceOpportunityId: null,
          language: 'English',
          thematicArea: classified.thematicArea || null
        }
      });
    } catch (err) {
      console.error(`[coefficient giving] failed to process ${url}: ${err.message}`);
    }
  }

  return results;
}

module.exports = { searchCoefficientGiving };
