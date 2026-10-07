(function() {
  function esc(s) {
    if (s == null) return '';
    return String(s).replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
  const $ = (id) => document.getElementById(id);
  const api = async (path, opts) => {
    const r = await fetch(path, { credentials: 'include', headers: { 'Content-Type': 'application/json' }, ...opts });
    return r.json().then(j => ({ ok: r.ok, j }));
  };
  // Global bind helper
  function bind(id, handler) {
    const el = document.getElementById(id);
    if (el && !el.dataset.wired) { el.dataset.wired = '1'; el.addEventListener('click', handler); }
  }

  // Clock
  setInterval(() => { const c = $('owner-clock'); if (c) c.textContent = new Date().toLocaleString(); }, 1000);

  // Tabs with Back button history
  let tabHistory = ['search'];
  function showTab(tabName, pushHistory = true) {
    document.querySelectorAll('.owner-tab-btn').forEach(x => x.classList.remove('active'));
    const btn = document.querySelector(`[data-tab="${tabName}"]`);
    if (btn) btn.classList.add('active');
    document.querySelectorAll('.owner-tab-pane').forEach(p => p.classList.add('hidden'));
    const pane = $('tab-' + tabName);
    if (pane) pane.classList.remove('hidden');
    if (pushHistory && tabHistory[tabHistory.length - 1] !== tabName) {
      tabHistory.push(tabName);
      if (tabHistory.length > 20) tabHistory.shift();
    }
    // Update back button state
    const backBtn = $('tab-back-btn');
    if (backBtn) backBtn.style.opacity = tabHistory.length > 1 ? '1' : '0.4';
  }
  document.querySelectorAll('.owner-tab-btn[data-tab]').forEach(b => {
    b.addEventListener('click', () => showTab(b.dataset.tab));
  });
  // Back button
  function goBackTab() {
    if (tabHistory.length > 1) {
      tabHistory.pop();
      const prev = tabHistory[tabHistory.length - 1];
      showTab(prev, false);
    } else {
      // Fallback: go to search tab if no history
      showTab('search', false);
    }
  }
  // Make globally accessible for emergency
  window.ownerGoBack = goBackTab;
  window.ownerShowTab = showTab;
  $('tab-back-btn')?.addEventListener('click', goBackTab);
  $('mail-back-btn')?.addEventListener('click', goBackTab);

  // Login
  async function doLogin() {
    $('login-err').textContent = '';
    const { ok, j } = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: $('login-user').value.trim(), password: $('login-pass').value }) });
    if (!ok || !j.user) { $('login-err').textContent = (j && j.error) || 'Login failed.'; return; }
    const me = await api('/api/auth/me').then(r => r.j.user || r.j);
    if (!me || (me.role !== 'owner' && me.role !== 'admin')) {
      $('login-err').textContent = '⛔ Owner/Admin only. Your role: ' + ((me && me.role) || 'unknown');
      return;
    }
    $('login-pane').classList.add('hidden');
    $('owner-pane').classList.remove('hidden');
    $('owner-who').textContent = 'Signed in as ' + me.username + ' (' + me.role + ')';
    // Welcome banner
    const wu = $('welcome-username');
    if (wu) wu.textContent = me.username;
    const wr = $('welcome-role');
    if (wr) wr.textContent = '(' + me.role + ')';
    const wt = $('welcome-time');
    if (wt) wt.textContent = new Date().toLocaleString();
    // Update welcome time every second
    setInterval(() => {
      const w = $('welcome-time');
      if (w) w.textContent = new Date().toLocaleString();
    }, 1000);
    // Hide owner-only sections from admins
    if (me.role === 'admin') {
      document.querySelectorAll('[data-owner-only]').forEach(el => {
        el.style.display = 'none';
      });
      const banner = document.createElement('div');
      banner.style.cssText = 'background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.2);border-radius:8px;padding:8px 16px;margin-bottom:12px;text-align:center;color:#fff';
      banner.textContent = '👁️ Admin view — owner-only sections hidden';
      const pane = $('owner-pane');
      if (pane) pane.insertBefore(banner, pane.firstChild);
    }
  }
  bind('login-btn', doLogin);
  $('login-pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  $('login-user').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });

  // Helper for error display
  function setErr(id, msg, isOk) {
    const el = $(id);
    if (el) {
      el.textContent = msg;
      el.style.color = isOk ? '#4f4' : '#f66';
    }
  }
  const getUser = (id) => (($(id) || {}).value || '').trim();

  // Player Search & Inspect
  bind('btn-search-player', async () => {
    const u = getUser('player-search-input');
    if (!u) { setErr('search-err', '❌ Enter a username.'); return; }
    setErr('search-err', 'Searching...');
    try {
      const r = await fetch('/api/gm/inspect', { method: 'POST', credentials: 'include', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: u }) });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) { setErr('search-err', `❌ Search failed (HTTP ${r.status}): ${j.error || 'Unknown error'}`); return; }
      const d = j.dossier || j.data || j;
      if (!d || !d.username) { setErr('search-err', '❌ No player data returned.'); return; }
      $('search-result-card').classList.remove('hidden');
      $('target-name').textContent = d.username || u;
      $('target-level').textContent = 'Lv ' + (d.level || 1) + ' / ' + (d.xp || 0) + ' XP';
      $('target-rebirths').textContent = d.rebirthCount || 0;
      $('target-gold').textContent = d.gold || 0;
      $('target-stage').textContent = d.stage || 1;
      // Also fill the powers username
      if ($('pow-user')) $('pow-user').value = d.username || u;
      if ($('forge-user')) $('forge-user').value = d.username || u;
      setErr('search-err', '✅ Found ' + (d.username || u), true);
    } catch (e) {
      setErr('search-err', '❌ Network error: ' + e.message);
    }
  });

  // Powers: Give Gold
  bind('pow-gold-btn', async () => {
    const u = getUser('pow-user');
    const amt = parseInt(($('pow-gold') || {}).value) || 0;
    if (!u || !amt) { setErr('powers-err', '❌ Enter username and amount.'); return; }
    const { ok, j } = await api('/api/gm/set-gold', { method: 'POST', body: JSON.stringify({ username: u, amount: amt }) });
    setErr('powers-err', ok ? `✅ Gave ${amt} gold to ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });

  // Powers: Set Level & XP
  bind('pow-level-btn', async () => {
    const u = getUser('pow-user');
    const lvl = Math.floor(Number(($('pow-level') || {}).value));
    const xp = Math.floor(Number(($('pow-xp') || {}).value)) || 0;
    if (!u || !lvl) { setErr('powers-err', '❌ Enter username and level.'); return; }
    const { ok, j } = await api('/api/gm/set-level', { method: 'POST', body: JSON.stringify({ username: u, level: lvl }) });
    if (ok && xp > 0) {
      await api('/api/gm/set-xp', { method: 'POST', body: JSON.stringify({ username: u, xp }) });
    }
    setErr('powers-err', ok ? `✅ Set ${u} to level ${lvl}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });

  // Powers: Set Rebirth
  bind('pow-rebirth-btn', async () => {
    const u = getUser('pow-user');
    const rb = Math.floor(Number(($('pow-rebirth') || {}).value));
    if (!u || isNaN(rb)) { setErr('powers-err', '❌ Enter username and rebirth count.'); return; }
    const { ok, j } = await api('/api/gm/set-rebirth', { method: 'POST', body: JSON.stringify({ username: u, count: rb }) });
    setErr('powers-err', ok ? `✅ Set ${u} rebirths to ${rb}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });

  // Powers: Set Stage
  bind('pow-stage-btn', async () => {
    const u = getUser('pow-user');
    const st = Math.floor(Number(($('pow-stage') || {}).value));
    if (!u || !st) { setErr('powers-err', '❌ Enter username and stage.'); return; }
    const { ok, j } = await api('/api/gm/set-stage', { method: 'POST', body: JSON.stringify({ username: u, stage: st }) });
    setErr('powers-err', ok ? `✅ Set ${u} to stage ${st}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });

  // Powers: Heal
  bind('pow-heal-btn', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('powers-err', '❌ Enter username.'); return; }
    const { ok, j } = await api('/api/gm/heal', { method: 'POST', body: JSON.stringify({ username: u }) });
    setErr('powers-err', ok ? `✅ Healed ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });

  // Powers: Grant Buff
  bind('pow-buff-btn', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('powers-err', '❌ Enter username.'); return; }
    const { ok, j } = await api('/api/gm/grant-buff', { method: 'POST', body: JSON.stringify({ username: u, buffType: 'damage', value: 100, duration: 3600 }) });
    setErr('powers-err', ok ? `✅ Granted god-buff to ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });

  // Powers: Clear Inventory
  bind('pow-clear-btn', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('powers-err', '❌ Enter username.'); return; }
    if (!confirm(`Clear ${u}'s inventory?`)) return;
    const { ok, j } = await api('/api/gm/clear-bags', { method: 'POST', body: JSON.stringify({ username: u }) });
    const count = (j && j.cleared) || 0;
    setErr('powers-err', ok ? `✅ Cleared ${count} items from ${u}'s inventory (equipped/GM gear kept)` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });

  // GM God Powers: God Mode
  bind('pow-godmode-btn', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('powers-err', '❌ Enter username.'); return; }
    const { ok, j } = await api('/api/gm/godmode', { method: 'POST', body: JSON.stringify({ username: u }) });
    setErr('powers-err', ok ? `✅ Toggled God Mode for ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
    refreshGMLog();
  });

  // GM God Powers: Smite (set HP to 1)
  bind('pow-smite-btn', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('powers-err', '❌ Enter username.'); return; }
    if (!confirm(`Smite ${u}? (Set HP to 1)`)) return;
    const { ok, j } = await api('/api/gm/smite', { method: 'POST', body: JSON.stringify({ username: u }) });
    setErr('powers-err', ok ? `✅ Smote ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
    refreshGMLog();
  });

  // GM God Powers: 10k Gold
  bind('pow-gold10k-btn', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('powers-err', '❌ Enter username.'); return; }
    const { ok, j } = await api('/api/gm/grant', { method: 'POST', body: JSON.stringify({ username: u, kind: 'gold', amount: 10000 }) });
    setErr('powers-err', ok ? `✅ Granted 10k gold to ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
    refreshGMLog();
  });

  // Fun Powers: Make It Rain (1M Gold)
  bind('pow-rain-btn', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('powers-err', '❌ Enter username.'); return; }
    const { ok, j } = await api('/api/gm/grant', { method: 'POST', body: JSON.stringify({ username: u, kind: 'gold', amount: 1000000 }) });
    setErr('powers-err', ok ? `🌧️ Made it rain 1M gold on ${u}!` : '❌ ' + ((j && j.error) || 'failed'), ok);
    refreshGMLog();
  });

  // Fun Powers: Instant Level 255 (WoW GM style)
  bind('pow-maxlevel-btn', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('powers-err', '❌ Enter username.'); return; }
    const { ok, j } = await api('/api/gm/set-level', { method: 'POST', body: JSON.stringify({ username: u, level: 255 }) });
    setErr('powers-err', ok ? `🚀 ${u} is now level 255!` : '❌ ' + ((j && j.error) || 'failed'), ok);
    refreshGMLog();
  });

  // GM God Powers: GM Gear Set
  bind('pow-gmgear-btn', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('powers-err', '❌ Enter username.'); return; }
    const { ok, j } = await api('/api/gm/grant-gm-gear', { method: 'POST', body: JSON.stringify({ username: u }) });
    setErr('powers-err', ok ? `✅ Granted GM Gear Set to ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
    refreshGMLog();
  });

  // GM Action Log
  async function refreshGMLog() {
    const { ok, j } = await api('/api/gm/audit');
    const el = document.getElementById('gm-action-log');
    if (!el) return;
    if (ok && (j.log || j.entries)) {
      const entries = (j.log || j.entries).slice(-50); // Last 50 only (performance)
      el.innerHTML = entries.map(e =>
        `<div>[${new Date(e.at).toLocaleString()}] <b>${e.by}</b>: ${e.action} — ${e.detail}</div>`
      ).join('') || '<div class="muted">No actions yet</div>';
    } else {
      el.innerHTML = '<div class="muted">Failed to load log</div>';
    }
  }
  bind('pow-log-refresh', refreshGMLog);

  // Stage Reset
  bind('reset-stages-btn', async () => {
    const confirmText = (($('reset-confirm') || {}).value || '').trim();
    if (confirmText !== 'RESET-TO-STAGE-1') {
      setErr('reset-err', '❌ Type RESET-TO-STAGE-1 in the box first.');
      return;
    }
    if (!confirm('Reset ALL players to Stage 1? This will backup first.')) return;
    setErr('reset-err', 'Working...');
    try {
      const { ok, j } = await api('/api/gm/reset-all-stages', { method: 'POST', body: JSON.stringify({ confirm: 'RESET-TO-STAGE-1' }) });
      setErr('reset-err', ok ? `✅ Backed up ${j.backedUp}, reset ${j.reset} players to Stage 1.` : '❌ ' + ((j && j.error) || 'failed'), ok);
    } catch (e) {
      setErr('reset-err', '❌ ' + e.message);
    }
  });

  // Restore Player
  bind('restore-btn', async () => {
    const u = getUser('restore-user');
    if (!u) { setErr('restore-err', '❌ Enter a username.'); return; }
    setErr('restore-err', 'Restoring...');
    try {
      const { ok, j } = await api('/api/gm/restore-player', { method: 'POST', body: JSON.stringify({ username: u }) });
      setErr('restore-err', ok ? `✅ Restored ${u}'s progress${j.live ? ' (live!)' : ''}.` : '❌ ' + ((j && j.error) || 'failed'), ok);
    } catch (e) {
      setErr('restore-err', '❌ ' + e.message);
    }
  });

  // Forge OP Gear
  bind('forge-btn', async () => {
    const u = getUser('forge-user');
    const name = (($('forge-name') || {}).value || '').trim();
    const slot = ($('forge-slot') || {}).value || 'weapon';
    const rarity = ($('forge-rarity') || {}).value || 'rainbowstar';
    const atk = parseFloat(($('forge-atk') || {}).value) || 0;
    const def = parseFloat(($('forge-def') || {}).value) || 0;
    const crit = parseFloat(($('forge-crit') || {}).value) || 0;
    if (!u || !name) { setErr('forge-err', '❌ Enter username and item name.'); return; }
    setErr('forge-err', 'Forging...');
    const { ok, j } = await api('/api/gm/create-op-gear', {
      method: 'POST',
      body: JSON.stringify({ username: u, name, slot, rarity, stats: { attack: atk, defense: def, critChance: crit } })
    });
    setErr('forge-err', ok ? `✅ Forged ${name} for ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });

  // Broadcast
  bind('broadcast-btn', async () => {
    const msg = (($('broadcast-msg') || {}).value || '').trim();
    if (!msg) { setErr('broadcast-err', '❌ Enter a message.'); return; }
    const { ok, j } = await api('/api/gm/broadcast', { method: 'POST', body: JSON.stringify({ message: msg }) });
    setErr('broadcast-err', ok ? '✅ Broadcast sent!' : '❌ ' + ((j && j.error) || 'failed'), ok);
    if (ok) $('broadcast-msg').value = '';
  });

  // Moderation
  const getModUser = () => { const el = document.getElementById('mod-user'); return el ? el.value.trim() : ''; };
  bind('mod-ban-btn', async () => {
    const u = getModUser();
    if (!u) { setErr('mod-err', '❌ Enter username.'); return; }
    if (!confirm(`Ban ${u}?`)) return;
    const { ok, j } = await api('/api/gm/ban', { method: 'POST', body: JSON.stringify({ username: u }) });
    setErr('mod-err', ok ? `🔨 Banned ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
    refreshGMLog();
  });
  bind('mod-unban-btn', async () => {
    const u = getModUser();
    if (!u) { setErr('mod-err', '❌ Enter username.'); return; }
    const { ok, j } = await api('/api/gm/unban', { method: 'POST', body: JSON.stringify({ username: u }) });
    setErr('mod-err', ok ? `✅ Unbanned ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
    refreshGMLog();
  });
  bind('mod-mute-btn', async () => {
    const u = getModUser();
    if (!u) { setErr('mod-err', '❌ Enter username.'); return; }
    const mins = parseInt((document.getElementById('mod-mute-mins') || {}).value || '60', 10);
    const { ok, j } = await api('/api/gm/mute', { method: 'POST', body: JSON.stringify({ username: u, minutes: mins }) });
    setErr('mod-err', ok ? `🔇 Muted ${u} for ${mins}m` : '❌ ' + ((j && j.error) || 'failed'), ok);
    refreshGMLog();
  });
  bind('mod-unmute-btn', async () => {
    const u = getModUser();
    if (!u) { setErr('mod-err', '❌ Enter username.'); return; }
    const { ok, j } = await api('/api/gm/unmute', { method: 'POST', body: JSON.stringify({ username: u }) });
    setErr('mod-err', ok ? `🔊 Unmuted ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
    refreshGMLog();
  });
  bind('mod-kick-btn', async () => {
    const u = getModUser();
    if (!u) { setErr('mod-err', '❌ Enter username.'); return; }
    if (!confirm(`Kick ${u}? (disconnect)`)) return;
    const { ok, j } = await api('/api/gm/kick', { method: 'POST', body: JSON.stringify({ username: u }) });
    setErr('mod-err', ok ? `👢 Kicked ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
    refreshGMLog();
  });

  // Server
  async function refreshServerInfo() {
    try {
      const { ok, j } = await api('/api/online-count');
      const el = document.getElementById('server-online');
      if (el && ok) el.textContent = j.onlineCount ?? j.count ?? '?';
    } catch (e) {}
  }
  bind('server-refresh-btn', refreshServerInfo);
  bind('server-maint-on-btn', async () => {
    const msg = (document.getElementById('server-maint-msg') || {}).value || 'Server under maintenance.';
    if (!confirm('Enable maintenance mode? Players will be locked out.')) return;
    const { ok, j } = await api('/api/gm/maintenance', { method: 'POST', body: JSON.stringify({ enabled: true, message: msg }) });
    setErr('server-err', ok ? '🔧 Maintenance enabled' : '❌ ' + ((j && j.error) || 'failed'), ok);
  });
  bind('server-maint-off-btn', async () => {
    const { ok, j } = await api('/api/gm/maintenance', { method: 'POST', body: JSON.stringify({ enabled: false }) });
    setErr('server-err', ok ? '✅ Maintenance disabled' : '❌ ' + ((j && j.error) || 'failed'), ok);
  });

  // Grant Protection Buffs
  bind('pow-priest-shield-btn', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('patch-err', '❌ Enter username in Target Player Username.'); return; }
    const { ok, j } = await api('/api/gm/grant-buff', { method: 'POST', body: JSON.stringify({ username: u, buffType: 'priest_shield', value: 5000, duration: 300 }) });
    setErr('patch-err', ok ? `✅ Granted Power Word: Shield to ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });
  bind('pow-pally-bubble-btn', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('patch-err', '❌ Enter username in Target Player Username.'); return; }
    const { ok, j } = await api('/api/gm/grant-buff', { method: 'POST', body: JSON.stringify({ username: u, buffType: 'pally_bubble', value: 10000, duration: 300 }) });
    setErr('patch-err', ok ? `✅ Granted Divine Shield to ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });
  bind('pow-dmg-boost-btn', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('patch-err', '❌ Enter username in Target Player Username.'); return; }
    const { ok, j } = await api('/api/gm/grant-buff', { method: 'POST', body: JSON.stringify({ username: u, buffType: 'damage', value: 50, duration: 300 }) });
    setErr('patch-err', ok ? `✅ Granted Damage Boost to ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });
  bind('pow-heal-btn2', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('patch-err', '❌ Enter username in Target Player Username.'); return; }
    const { ok, j } = await api('/api/gm/grant-buff', { method: 'POST', body: JSON.stringify({ username: u, buffType: 'heal', value: 0, duration: 30 }) });
    setErr('patch-err', ok ? `✅ Healed ${u}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });

  // Push Patch Notes
  bind('pow-patch-btn', async () => {
    const { ok, j } = await api('/api/gm/push-patch-notes', { method: 'POST', body: JSON.stringify({}) });
    setErr('broadcast-patch-err', ok ? '✅ Patch notes pushed!' : '❌ ' + ((j && j.error) || 'failed'), ok);
  });

  // Check Buffs
  bind('buff-check-btn', async () => {
    const u = getUser('buff-check-user');
    if (!u) { setErr('patch-err', '❌ Enter username.'); return; }
    const { ok, j } = await api('/api/gm/inspect', { method: 'POST', body: JSON.stringify({ username: u }) });
    if (!ok) { setErr('patch-err', '❌ ' + ((j && j.error) || 'failed')); return; }
    const buffs = (j.dossier && j.dossier.buffs) || (j.data && j.data.buffs) || j.buffs || [];
    setErr('patch-err', `✅ ${u} has ${buffs.length} active buffs: ${buffs.map(b => b.id || b).join(', ') || 'none'}`, true);
  });

  // Player View - Direct Controls (Player Inspect tab)
  const pvUser = () => {
    const input = $('player-search-input');
    return input ? input.value.trim() : '';
  };
  bind('pv-reset-stats-btn', async () => {
    const u = pvUser();
    if (!u) { setErr('pv-err', '❌ Enter a username in Player Search first.'); return; }
    if (!confirm(`Reset ${u}'s bonus stats? (Base stats from level/class remain)`)) return;
    const { ok, j } = await api('/api/gm/reset-stats', { method: 'POST', body: JSON.stringify({ username: u }) });
    setErr('pv-err', ok ? `✅ ${u}'s bonus stats reset${j.live ? ' (live)' : ''}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });
  bind('pv-reset-stage-btn', async () => {
    const u = pvUser();
    if (!u) { setErr('pv-err', '❌ Enter a username in Player Search first.'); return; }
    if (!confirm(`Reset ${u}'s stage to 1?`)) return;
    const { ok, j } = await api('/api/gm/set-stage', { method: 'POST', body: JSON.stringify({ username: u, stage: 1 }) });
    setErr('pv-err', ok ? `✅ ${u}'s stage reset to 1` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });
  bind('pv-reset-level-btn', async () => {
    const u = pvUser();
    if (!u) { setErr('pv-err', '❌ Enter a username in Player Search first.'); return; }
    if (!confirm(`Reset ${u}'s level to 1? (XP will also reset to 0)`)) return;
    const { ok, j } = await api('/api/gm/set-level', { method: 'POST', body: JSON.stringify({ username: u, level: 1 }) });
    setErr('pv-err', ok ? `✅ ${u}'s level reset to 1${j.live ? ' (live)' : ''}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });
  bind('pv-reset-xp-btn', async () => {
    const u = pvUser();
    if (!u) { setErr('pv-err', '❌ Enter a username in Player Search first.'); return; }
    if (!confirm(`Reset ${u}'s XP to 0?`)) return;
    const { ok, j } = await api('/api/gm/reset-xp', { method: 'POST', body: JSON.stringify({ username: u }) });
    setErr('pv-err', ok ? `✅ ${u}'s XP reset to 0${j.live ? ' (live)' : ''}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });
  bind('pv-reset-gold-btn', async () => {
    const u = pvUser();
    if (!u) { setErr('pv-err', '❌ Enter a username in Player Search first.'); return; }
    if (!confirm(`Reset ${u}'s Gold to 0?`)) return;
    const { ok, j } = await api('/api/gm/reset-gold', { method: 'POST', body: JSON.stringify({ username: u }) });
    setErr('pv-err', ok ? `✅ ${u}'s Gold reset to 0${j.live ? ' (live)' : ''}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });
  bind('pv-reset-rebirth-btn', async () => {
    const u = pvUser();
    if (!u) { setErr('pv-err', '❌ Enter a username in Player Search first.'); return; }
    if (!confirm(`Reset ${u}'s Rebirths to 0?`)) return;
    const { ok, j } = await api('/api/gm/set-rebirth', { method: 'POST', body: JSON.stringify({ username: u, count: 0 }) });
    setErr('pv-err', ok ? `✅ ${u}'s Rebirths reset to 0${j.live ? ' (live)' : ''}` : '❌ ' + ((j && j.error) || 'failed'), ok);
  });
  bind('pv-give-stats-btn', async () => {
    const u = pvUser();
    if (!u) { setErr('pv-err', '❌ Enter a username in Player Search first.'); return; }
    setErr('pv-err', '⏳ Give stats backend coming soon...', false);
  });
  bind('pv-buff-btn', async () => {
    const u = pvUser();
    if (!u) { setErr('pv-err', '❌ Enter a username in Player Search first.'); return; }
    setErr('pv-err', '⏳ Buff selector coming soon...', false);
  });
  bind('pv-debuff-btn', async () => {
    const u = pvUser();
    if (!u) { setErr('pv-err', '❌ Enter a username in Player Search first.'); return; }
    setErr('pv-err', '⏳ Debuff system coming soon...', false);
  });




  // Event toggles (Realm tab) - Seasonal & Special
  const eventBtn = (btnId, type, label) => {
    bind(btnId, async () => {
      const { ok, j } = await api('/api/gm/event-buff', { method: 'POST', body: JSON.stringify({ type, hours: 24 }) });
      setErr('event-err', ok ? `✅ ${label} toggled` : '❌ ' + ((j && j.error) || 'failed'), ok);
    });
  };
  eventBtn('event-halloween-btn', 'halloween', '🎃 Halloween Hunt');
  eventBtn('event-winter-btn', 'winter', '❄️ Winter Veil');
  eventBtn('event-spring-btn', 'spring', '🌸 Spring Bloom');
  eventBtn('event-summer-btn', 'summer', '☀️ Summer Surge');
  eventBtn('event-bossrush-btn', 'bossrush', '💀 Boss Rush');
  eventBtn('event-lucky-btn', 'lucky', '🌟 Lucky Drops');

  // Backup
  bind('backup-btn', async () => {
    setErr('backup-err', 'Backing up...');
    const { ok, j } = await api('/api/gm/reset-all-stages', { method: 'POST', body: JSON.stringify({ confirm: 'BACKUP-ONLY' }) });
    setErr('backup-err', ok ? '✅ Backup complete' : '❌ ' + ((j && j.error) || 'failed'), ok);
  });

  // ===== Mail & Tickets =====
  const $m = (id) => document.getElementById(id);

  // Item picker: add selected item with stats to the textarea
  // Format: "Name x Qty [attack:500, defense:100]"
  bind('mail-item-add-btn', () => {
    const picker = $m('mail-item-picker');
    const custom = $m('mail-item-custom');
    const ta = $m('mail-items');
    // Use custom name if typed, otherwise picker value
    const itemName = (custom && custom.value.trim()) || (picker && picker.value);
    if (!ta || !itemName) return;
    // Collect stats from inputs
    const statKeys = ['attack', 'defense', 'maxHp', 'critChance', 'critDamage', 'lifesteal'];
    const stats = {};
    for (const k of statKeys) {
      const el = $m('mail-stat-' + k);
      const v = el ? Number(el.value) : 0;
      if (v > 0) stats[k] = v;
    }
    let line = itemName;
    if (Object.keys(stats).length) {
      line += ' [' + Object.entries(stats).map(([k, v]) => k + ':' + v).join(', ') + ']';
    }
    const cur = ta.value.trim();
    ta.value = cur ? cur + '\n' + line : line;
    if (picker) picker.value = '';
    if (custom) custom.value = '';
    // Clear stat inputs
    for (const k of statKeys) { const el = $m('mail-stat-' + k); if (el) el.value = ''; }
  });

  // Send mail
  bind('mail-send-btn', async () => {
    const to = ($m('mail-to').value || '').trim();
    const subject = ($m('mail-subject').value || '').trim();
    const body = ($m('mail-body').value || '').trim();
    const gold = Math.max(0, Math.floor(Number($m('mail-gold').value) || 0));
    // Parse items: "Name x Qty [stat:val, ...]" per line
    const itemsText = ($m('mail-items').value || '').trim();
    const items = [];
    const VALID_STATS = ['attack', 'defense', 'maxHp', 'critChance', 'critDamage', 'parry', 'dodge', 'lifesteal', 'attackSpeed', 'regen', 'goldBonus', 'xpBonus'];
    if (itemsText) {
      itemsText.split('\n').forEach(line => {
        line = line.trim();
        if (!line) return;
        // Extract [stats] block if present
        let stats = {};
        const statMatch = line.match(/\[([^\]]+)\]\s*$/);
        if (statMatch) {
          statMatch[1].split(',').forEach(pair => {
            const [k, v] = pair.split(':').map(s => s.trim());
            if (k && v && VALID_STATS.includes(k)) {
              const num = Number(v);
              if (Number.isFinite(num) && num > 0) stats[k] = num;
            }
          });
          line = line.slice(0, statMatch.index).trim();
        }
        const match = line.match(/^(.+?)\s*[x×]\s*(\d+)$/i);
        if (match) {
          items.push({ name: match[1].trim(), qty: Math.max(1, parseInt(match[2])), stats });
        } else {
          items.push({ name: line, qty: 1, stats });
        }
      });
    }
    if (!to) { setErr('mail-err', '❌ Enter recipient(s).'); return; }
    const isBulk = to === '__ALL__' || to === '__ONLINE__' || to.includes(',');
    const label = to === '__ALL__' ? 'ALL players' : to === '__ONLINE__' ? 'all ONLINE players' : to;
    if (!confirm(`Send mail to ${label}?` + (gold ? ` Gold: ${gold} each.` : '') + (items.length ? ` Items: ${items.length} each.` : ''))) return;
    const { ok, j } = await api('/api/gm/mail/send', {
      method: 'POST',
      body: JSON.stringify({ to, subject: subject || 'From the Owner', body, gold, items })
    });
    setErr('mail-err', ok ? `✅ Mail sent to ${j.sent || 1} player(s)${j.failed && j.failed.length ? ` (${j.failed.length} failed: ${j.failed.join(', ')})` : ''}` : '❌ ' + ((j && j.error) || 'failed'), ok);
    if (ok) {
      $m('mail-to').value = ''; $m('mail-subject').value = '';
      $m('mail-body').value = ''; $m('mail-gold').value = '0'; $m('mail-items').value = '';
    }
  });

  // Bulk recipient buttons (legacy)
  bind('mail-to-all-btn', () => { $m('mail-to').value = '__ALL__'; setErr('mail-err', '📢 Will send to ALL players.', true); });
  bind('mail-to-online-btn', () => { $m('mail-to').value = '__ONLINE__'; setErr('mail-err', '🟢 Will send to online players.', true); });

  // Player List Sidebar
  let selectedPlayers = new Set();
  let allPlayersCache = [];
  async function loadMailPlayerList() {
    const listEl = $m('mail-player-list');
    if (!listEl) return;
    listEl.innerHTML = '<p class="muted small">Loading...</p>';
    const { ok, j } = await api('/api/gm/players?limit=200');
    if (!ok) { listEl.innerHTML = '<p class="owner-err small">❌ Failed.</p>'; return; }
    allPlayersCache = j.players || [];
    renderMailPlayerList();
  }
  function renderMailPlayerList() {
    const listEl = $m('mail-player-list');
    if (!listEl) return;
    listEl.innerHTML = allPlayersCache.map(p => {
      const sel = selectedPlayers.has(p.username);
      return `<div data-player="${esc(p.username)}" style="padding:6px 8px;margin:2px 0;border-radius:6px;cursor:pointer;${sel ? 'background:#7c3aed;color:#fff' : 'background:rgba(255,255,255,0.05)'};${p.online ? 'border-left:3px solid #22c55e' : ''}">
        ${p.online ? '🟢' : '⚫'} ${esc(p.username)} <span class="muted small">Lv${p.level}</span>
      </div>`;
    }).join('') || '<p class="muted small">No players.</p>';
    // Wire clicks
    listEl.querySelectorAll('[data-player]').forEach(el => {
      el.addEventListener('click', () => {
        const u = el.dataset.player;
        if (selectedPlayers.has(u)) selectedPlayers.delete(u);
        else selectedPlayers.add(u);
        updateMailRecipients();
        renderMailPlayerList();
      });
    });
    $m('mail-selected-count').textContent = selectedPlayers.size;
  }
  function updateMailRecipients() {
    $m('mail-to').value = Array.from(selectedPlayers).join(', ');
  }
  bind('mail-select-all-btn', () => {
    selectedPlayers = new Set(allPlayersCache.map(p => p.username));
    $m('mail-to').value = '__ALL__';
    setErr('mail-err', '📢 Will send to ALL players.', true);
    renderMailPlayerList();
  });
  bind('mail-select-online-btn', () => {
    const online = allPlayersCache.filter(p => p.online).map(p => p.username);
    selectedPlayers = new Set(online);
    updateMailRecipients();
    setErr('mail-err', `🟢 Selected ${online.length} online players.`, true);
    renderMailPlayerList();
  });
  bind('mail-clear-btn', () => {
    selectedPlayers.clear();
    $m('mail-to').value = '';
    renderMailPlayerList();
  });
  // Load player list when mail tab opens
  document.querySelector('[data-tab="mail"]')?.addEventListener('click', loadMailPlayerList);

  // Tickets
  async function loadTickets() {
    const listEl = $m('tickets-list');
    if (!listEl) return;
    listEl.innerHTML = '<p class="muted">Loading tickets...</p>';
    const { ok, j } = await api('/api/gm/tickets');
    if (!ok) { listEl.innerHTML = '<p class="owner-err">❌ Failed to load tickets.</p>'; return; }
    const tickets = j.tickets || [];
    if (!tickets.length) { listEl.innerHTML = '<p class="muted">No open tickets. 🎉</p>'; return; }
    listEl.innerHTML = tickets.map(t =>
      `<div class="ticket-row" style="border:1px solid #3a2f52;border-radius:8px;padding:10px;margin:8px 0;cursor:pointer" data-ticket="${t.id}">
        <div><b>#${t.id}</b> ${esc(t.subject || 'No subject')} <span class="muted small">by ${esc(t.player)}</span></div>
        <div class="muted small">${esc((t.message || '').slice(0, 100))}${(t.message || '').length > 100 ? '...' : ''} · ${t.reply_count || 0} replies · ${esc(t.status)}</div>
      </div>`
    ).join('');
    // Click to view
    listEl.querySelectorAll('.ticket-row').forEach(row => {
      row.addEventListener('click', () => viewTicket(row.dataset.ticket));
    });
  }

  async function viewTicket(id) {
    const detailEl = $m('ticket-detail');
    detailEl.innerHTML = '<p class="muted">Loading...</p>';
    const { ok, j } = await api(`/api/gm/tickets/${id}`);
    if (!ok) { detailEl.innerHTML = '<p class="owner-err">❌ Failed to load ticket.</p>'; return; }
    const t = j.ticket;
    const replies = (t.replies || []).map(r =>
      `<div style="border-left:3px solid ${r.is_gm ? '#f0c75e' : '#3a2f52'};padding:8px;margin:8px 0;background:rgba(0,0,0,0.2);border-radius:4px">
        <div class="muted small">${esc(r.author)} ${r.is_gm ? '👑' : ''} · ${new Date(r.created_at).toLocaleString()}</div>
        <div>${esc(r.message)}</div>
      </div>`
    ).join('');
    detailEl.innerHTML = `
      <div style="border:2px solid #f0c75e;border-radius:12px;padding:16px;background:rgba(240,199,94,0.05)">
        <h3>#${t.id} ${esc(t.subject || 'No subject')}</h3>
        <p class="muted small">From: ${esc(t.player)} · Status: ${esc(t.status)} · ${new Date(t.created_at).toLocaleString()}</p>
        <p>${esc(t.message)}</p>
        <h4>Replies (${(t.replies || []).length})</h4>
        ${replies || '<p class="muted">No replies yet.</p>'}
        <div style="margin-top:12px">
          <textarea id="ticket-reply-text" class="owner-input" rows="3" placeholder="Type your reply..."></textarea>
          <div style="margin-top:8px;display:flex;gap:8px">
            <button id="ticket-reply-btn" class="owner-btn gold">💬 Reply</button>
            <button id="ticket-close-btn" class="owner-btn danger">🔒 Close Ticket</button>
            <button id="ticket-back-btn" class="owner-btn info">← Back to list</button>
          </div>
        </div>
      </div>`;
    $m('ticket-reply-btn').addEventListener('click', async () => {
      const msg = ($m('ticket-reply-text').value || '').trim();
      if (!msg) return;
      const { ok: rok, j: rj } = await api(`/api/gm/tickets/${id}/reply`, {
        method: 'POST', body: JSON.stringify({ message: msg })
      });
      if (rok) viewTicket(id); else alert('❌ ' + ((rj && rj.error) || 'Reply failed'));
    });
    $m('ticket-close-btn').addEventListener('click', async () => {
      if (!confirm('Close this ticket?')) return;
      const { ok: cok } = await api(`/api/gm/tickets/${id}/close`, { method: 'POST' });
      if (cok) { loadTickets(); detailEl.innerHTML = '<p class="muted">Ticket closed.</p>'; }
    });
    $m('ticket-back-btn').addEventListener('click', () => { detailEl.innerHTML = ''; });
  }

  bind('tickets-refresh-btn', loadTickets);
  // Auto-load tickets when mail tab is opened
  document.querySelector('[data-tab="mail"]')?.addEventListener('click', () => { loadTickets(); loadReports(); });

  // ===== Bug Reports & Feedback =====
  let reportsFilter = '';
  async function loadReports() {
    const listEl = $m('reports-list');
    if (!listEl) return;
    listEl.innerHTML = '<p class="muted">Loading reports...</p>';
    const q = reportsFilter ? `?kind=${reportsFilter}` : '';
    const { ok, j } = await api(`/api/gm/reports${q}`);
    if (!ok) { listEl.innerHTML = '<p class="owner-err">❌ Failed to load reports.</p>'; return; }
    const reports = j.reports || [];
    if (!reports.length) { listEl.innerHTML = '<p class="muted">No reports. 🎉</p>'; return; }
    listEl.innerHTML = reports.map(r =>
      `<div style="border:1px solid #3a2f52;border-radius:8px;padding:10px;margin:8px 0">
        <div><b>#${r.id}</b> ${r.kind === 'bug' ? '🐞' : '💬'} <b>${esc(r.title || 'No title')}</b>
          <span class="muted small">by ${esc(r.username)} · ${new Date(r.created_at).toLocaleString()}</span></div>
        <div style="margin:6px 0">${esc(r.body || '')}</div>
        <div style="display:flex;gap:8px;align-items:center">
          <span class="muted small">Status: ${esc(r.status)}</span>
          ${r.status !== 'resolved' ? `<button class="owner-btn success" style="padding:4px 12px;font-size:12px" data-resolve="${r.id}">✅ Resolve</button>` : ''}
          ${r.status !== 'closed' && r.status !== 'resolved' ? `<button class="owner-btn danger" style="padding:4px 12px;font-size:12px" data-close-report="${r.id}">🔒 Close</button>` : ''}
        </div>
      </div>`
    ).join('');
    // Wire resolve/close buttons
    listEl.querySelectorAll('[data-resolve]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api(`/api/gm/reports/${btn.dataset.resolve}`, { method: 'PATCH', body: JSON.stringify({ status: 'resolved' }) });
        loadReports();
      });
    });
    listEl.querySelectorAll('[data-close-report]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await api(`/api/gm/reports/${btn.dataset.closeReport}`, { method: 'PATCH', body: JSON.stringify({ status: 'closed' }) });
        loadReports();
      });
    });
  }
  bind('reports-refresh-btn', loadReports);
  bind('reports-filter-bug', () => { reportsFilter = 'bug'; loadReports(); });
  bind('reports-filter-feedback', () => { reportsFilter = 'feedback'; loadReports(); });
  bind('reports-filter-all', () => { reportsFilter = ''; loadReports(); });

  // ===== GM World Chat =====
  let gmChatPoll = null;
  async function loadGmWorldChat() {
    const box = $m('gm-world-chat-box');
    if (!box) return;
    const { ok, j } = await api('/api/gm/world-chat?limit=50');
    if (!ok) { box.innerHTML = '<p class="owner-err">❌ Failed to load.</p>'; return; }
    const msgs = (j.messages || []).slice().reverse();
    box.innerHTML = msgs.map(m =>
      `<div style="margin:4px 0">
        ${m.is_gm ? '<span style="background:#ffd700;color:#000;font-weight:bold;padding:1px 6px;border-radius:4px;font-size:11px">&lt;GM&gt;</span> ' : ''}
        <b>${esc(m.username)}</b>: ${esc(m.message)}
        <span class="muted small">${new Date(m.created_at).toLocaleTimeString()}</span>
      </div>`
    ).join('') || '<p class="muted">No messages yet.</p>';
    box.scrollTop = box.scrollHeight;
  }
  async function sendGmWorldChat() {
    const input = $m('gm-world-chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    const { ok, j } = await api('/api/gm/world-chat', {
      method: 'POST',
      body: JSON.stringify({ message: msg })
    });
    if (ok) { input.value = ''; loadGmWorldChat(); }
    else setErr('mail-err', '❌ ' + ((j && j.error) || 'failed'), false);
  }
  bind('gm-world-chat-send', sendGmWorldChat);
  bind('gm-world-chat-refresh', loadGmWorldChat);
  $m('gm-world-chat-input')?.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') sendGmWorldChat();
  });
  // Auto-load and poll when mail tab opens
  document.querySelector('[data-tab="mail"]')?.addEventListener('click', () => {
    loadGmWorldChat();
    if (gmChatPoll) clearInterval(gmChatPoll);
    gmChatPoll = setInterval(loadGmWorldChat, 5000);
  });
})();
