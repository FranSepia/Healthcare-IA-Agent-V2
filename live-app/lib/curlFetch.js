// Shared helper for sites that block Node's built-in fetch (undici) at the
// TLS-fingerprint level but allow curl through with the identical headers
// — confirmed on both coefficientgiving.org and unitaid.org. Falls back to
// native fetch if curl isn't on PATH, so it still degrades gracefully.

const { execFile } = require('child_process');
const { promisify } = require('util');

const execFileAsync = promisify(execFile);

const DEFAULT_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

async function curlFetchText(url, { userAgent = DEFAULT_USER_AGENT, timeoutMs = 15000 } = {}) {
  try {
    const { stdout } = await execFileAsync('curl', ['-s', '-A', userAgent, url], { maxBuffer: 1024 * 1024 * 20, timeout: timeoutMs });
    if (stdout && stdout.length > 200) return stdout;
    throw new Error('curl returned an empty or too-short response');
  } catch (curlErr) {
    const res = await fetch(url, { headers: { 'User-Agent': userAgent, 'Accept': 'text/html,application/xhtml+xml' } });
    if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url} (curl also failed: ${curlErr.message})`);
    return res.text();
  }
}

module.exports = { curlFetchText, DEFAULT_USER_AGENT };
