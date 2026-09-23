// Opportunity data comes from six external, untrusted sources (scraped
// pages and third-party APIs) and gets interpolated into innerHTML all
// over this app. escapeHtml() neutralizes HTML metacharacters so a
// malicious title/org/description from a source can't inject markup or
// script into the page. Loaded first so every other script can use it.
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
window.escapeHtml = escapeHtml;
