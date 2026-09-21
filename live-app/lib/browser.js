// Shared headless-browser instance for connectors that need real rendering
// (currently just UNGM, whose search results load via client-side JS).
// Launched once and reused across searches so repeat searches don't pay a
// multi-second browser-startup cost every time.

const fs = require('fs');

const CANDIDATE_PATHS = [
  process.env.PUPPETEER_EXECUTABLE_PATH,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/microsoft-edge',
  '/usr/bin/google-chrome',
  '/usr/bin/google-chrome-stable',
  '/usr/bin/chromium-browser',
  '/usr/bin/chromium'
].filter(Boolean);

function findExecutable() {
  for (const p of CANDIDATE_PATHS) {
    try { if (fs.existsSync(p)) return p; } catch (e) { /* ignore */ }
  }
  return null;
}

let browserPromise = null;

// Returns a shared Puppeteer browser instance, launching it on first call.
// Throws a clear error (never crashes the process) if no Chrome/Edge
// install can be found — callers should catch this and report the source
// as unavailable, same pattern as every other connector.
async function getBrowser() {
  if (browserPromise) return browserPromise;
  const executablePath = findExecutable();
  if (!executablePath) {
    throw new Error('No Chrome or Edge install found for browser automation. Set PUPPETEER_EXECUTABLE_PATH in live-app/.env to your browser\'s path, or this source will stay unavailable.');
  }
  const puppeteer = require('puppeteer-core');
  browserPromise = puppeteer.launch({ executablePath, headless: 'new', args: ['--no-sandbox'] });
  browserPromise.catch(() => { browserPromise = null; }); // allow retry on next call if launch itself failed
  return browserPromise;
}

async function closeBrowser() {
  if (!browserPromise) return;
  try {
    const browser = await browserPromise;
    await browser.close();
  } catch (e) { /* already closed or never launched */ }
  browserPromise = null;
}

module.exports = { getBrowser, closeBrowser };
