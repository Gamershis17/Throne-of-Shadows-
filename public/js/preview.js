// preview.js — Oct 10 batch is now LIVE for everyone (2026-10-06).
// window.__PREVIEW = true unlocks all previously-gated features (Town, Raids,
// Bag tab, holidays, etc.). window.__TESTLAB tracks the ?preview=1 URL param
// for the Test Lab banner and dev-only tools (test mode).
// External file because the game's CSP (script-src 'self') blocks inline
// <script> tags. Loaded as a classic script before the module scripts, so
// these flags are set before any module reads them.
window.__PREVIEW = true;
window.__TESTLAB = new URLSearchParams(location.search).get('preview') === '1';

// Test Lab banner: show only when ?preview=1 is in the URL.
if (window.__TESTLAB) {
  document.addEventListener('DOMContentLoaded', function () {
    var banner = document.getElementById('testlab-banner');
    if (banner) banner.hidden = false;
  });
}
