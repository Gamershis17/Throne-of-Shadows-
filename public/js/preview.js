// preview.js — Oct 10 batch preview flag (?preview=1).
// External file because the game's CSP (script-src 'self') blocks inline
// <script> tags. Loaded as a classic script before the module scripts, so
// window.__PREVIEW is set before any module reads it (all reads happen
// inside functions called at boot, never at module top level).
window.__PREVIEW = new URLSearchParams(location.search).get('preview') === '1';
