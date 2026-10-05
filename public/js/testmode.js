// ============================================================
// testmode.js?v=20261005pv — Oct 10 batch: offline TEST MODE (?test=1&preview=1).
//
// Test mode boots a FRESH test character that NEVER touches the live
// account:
//   - all game state lives in localStorage under the 'tos_test_'
//     namespace (a single blob key, wiped on every test boot);
//   - EVERY server call is blocked at the api layer (api.js?v=20261005pv request()
//     throws offline when test mode is active), so no session lookup,
//     save, ping, or event-stream traffic can reach the server;
//   - server-gated UI (friends, parties, guilds, gift codes, account
//     management, GM console) degrades to the guest-style variants or
//     a "disabled in test mode" notice.
//
// ?test=1 WITHOUT ?preview=1 does nothing: isTestMode() is false and
// this module is inert. Iron rule holds — non-preview behavior is
// byte-for-byte identical.
//
// DOM-free except showTestBadge() (guarded, try/catch throughout), so
// this module is safe to import in Node unit tests: with no window,
// isTestMode() simply returns false.
// ============================================================

export const TEST_ROLE = 'test';
export const TEST_KEY = 'tos_test_state';
const TEST_PREFIX = 'tos_test_';

let _active = null;
// Active ONLY when BOTH flags are present. Lazy + cached: module eval
// order relative to the classic __PREVIEW script can never matter.
export function isTestMode() {
  if (_active !== null) return _active;
  try {
    _active = !!window.__PREVIEW &&
      new URLSearchParams(window.location.search).get('test') === '1';
  } catch {
    _active = false;
  }
  if (_active) {
    try { console.log('🧪 TEST MODE: offline, fresh character — live account untouched'); } catch {}
  }
  return _active;
}

function storage() {
  try { if (typeof localStorage !== 'undefined') return localStorage; } catch { /* ignore */ }
  return null;
}

// Fresh character every test boot: wipe the whole test namespace.
// Never touches any other key (session token, guest save, UI prefs).
export function clearTestState() {
  if (!isTestMode()) return;
  const ls = storage();
  if (!ls) return;
  try {
    const doomed = [];
    for (let i = 0; i < ls.length; i++) {
      let k = null;
      try { k = ls.key(i); } catch { k = null; }
      if (k && k.indexOf(TEST_PREFIX) === 0) doomed.push(k);
    }
    for (const k of doomed) { try { ls.removeItem(k); } catch { /* ignore */ } }
  } catch { /* ignore */ }
}

// Persist the test character into the test namespace. Returns true on
// success, false when storage is unavailable or full (game keeps running
// in memory).
export function saveTestState(state) {
  const ls = storage();
  if (!ls) return false;
  try {
    ls.setItem(TEST_KEY, JSON.stringify({ v: 1, state, lastSeen: Date.now() }));
    return true;
  } catch {
    return false;
  }
}

// Read back the test blob (used if a future change keeps test saves
// across reloads; today every test boot starts fresh via clearTestState).
export function loadTestState() {
  const ls = storage();
  if (!ls) return null;
  let raw = null;
  try { raw = ls.getItem(TEST_KEY); } catch { return null; }
  if (!raw) return null;
  try {
    const blob = JSON.parse(raw);
    if (!blob || typeof blob !== 'object' || !blob.state || typeof blob.state !== 'object') return null;
    return {
      state: blob.state,
      lastSeen: Number(blob.lastSeen) > 0 ? Number(blob.lastSeen) : null,
    };
  } catch {
    return null;
  }
}

// Small fixed badge so it's always obvious the session is a throwaway.
export function showTestBadge() {
  if (!isTestMode()) return;
  try {
    if (typeof document === 'undefined') return;
    if (document.getElementById('testmode-badge')) return;
    const el = document.createElement('div');
    el.id = 'testmode-badge';
    el.textContent = '🧪 TEST MODE — local only, live account untouched';
    el.setAttribute('style',
      'position:fixed;top:6px;left:50%;transform:translateX(-50%);z-index:99999;' +
      'background:#3a2b00;color:#ffd75e;border:1px solid #ffd75e;border-radius:8px;' +
      'padding:4px 12px;font-size:12px;font-weight:700;pointer-events:none;' +
      'font-family:system-ui,sans-serif;box-shadow:0 2px 8px rgba(0,0,0,.5);');
    if (document.body) document.body.appendChild(el);
  } catch { /* badge must never break boot */ }
}
