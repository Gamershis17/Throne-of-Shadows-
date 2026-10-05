(function() {
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

  // Tabs
  document.querySelectorAll('.owner-tab-btn').forEach(b => b.addEventListener('click', () => {
    document.querySelectorAll('.owner-tab-btn').forEach(x => x.classList.remove('active'));
    b.classList.add('active');
    document.querySelectorAll('.owner-tab-pane').forEach(p => p.classList.add('hidden'));
    const pane = $('tab-' + b.dataset.tab);
    if (pane) pane.classList.remove('hidden');
  }));

  // Login
  async function doLogin() {
    $('login-err').textContent = '';
    const { ok, j } = await api('/api/auth/login', { method: 'POST', body: JSON.stringify({ username: $('login-user').value.trim(), password: $('login-pass').value }) });
    if (!ok || !j.user) { $('login-err').textContent = (j && j.error) || 'Login failed.'; return; }
    const me = await api('/api/auth/me').then(r => r.j.user || r.j);
    if (!me || me.role !== 'owner') {
      $('login-err').textContent = '⛔ Owner only. Your role: ' + ((me && me.role) || 'unknown');
      return;
    }
    $('login-pane').classList.add('hidden');
    $('owner-pane').classList.remove('hidden');
    $('owner-who').textContent = 'Signed in as ' + me.username + ' (owner)';
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
    const { ok, j } = await api('/api/gm/set-rebirth', { method: 'POST', body: JSON.stringify({ username: u, rebirths: rb }) });
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

  // Fun Powers: Instant Level 120
  bind('pow-maxlevel-btn', async () => {
    const u = getUser('pow-user');
    if (!u) { setErr('powers-err', '❌ Enter username.'); return; }
    const { ok, j } = await api('/api/gm/set-level', { method: 'POST', body: JSON.stringify({ username: u, level: 120 }) });
    setErr('powers-err', ok ? `🚀 ${u} is now level 120!` : '❌ ' + ((j && j.error) || 'failed'), ok);
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
    if (ok && j.log) {
      const entries = j.log.slice(-50); // Last 50 only (performance)
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

  // 2x Event Toggle
  bind('pow-2x-btn', async () => {
    const { ok, j } = await api('/api/gm/event-buff', { method: 'POST', body: JSON.stringify({ type: 'xp_gold', hours: 24 }) });
    setErr('patch-err', ok ? '✅ 2x event toggled (24h)' : '❌ ' + ((j && j.error) || 'failed'), ok);
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
    setErr('pv-err', '⏳ Reset stats backend coming soon...', false);
  });
  bind('pv-reset-stage-btn', async () => {
    const u = pvUser();
    if (!u) { setErr('pv-err', '❌ Enter a username in Player Search first.'); return; }
    if (!confirm(`Reset ${u}'s stage to 1?`)) return;
    const { ok, j } = await api('/api/gm/set-level', { method: 'POST', body: JSON.stringify({ username: u, level: 1 }) });
    setErr('pv-err', ok ? `✅ ${u}'s stage reset to 1` : '❌ ' + ((j && j.error) || 'failed'), ok);
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
  bind('pv-troll-shrink-btn', async () => {
    const u = pvUser();
    if (!u) { setErr('pv-err', '❌ Enter a username in Player Search first.'); return; }
    setErr('pv-err', '🤏 Trolling backend coming soon...', false);
  });
  bind('pv-troll-title-btn', async () => {
    const u = pvUser();
    if (!u) { setErr('pv-err', '❌ Enter a username in Player Search first.'); return; }
    setErr('pv-err', '🏷️ Funny titles coming soon...', false);
  });
  bind('pv-troll-gold-rain-btn', async () => {
    const u = pvUser();
    if (!u) { setErr('pv-err', '❌ Enter a username in Player Search first.'); return; }
    const { ok, j } = await api('/api/gm/grant', { method: 'POST', body: JSON.stringify({ username: u, kind: 'gold', amount: 10000 }) });
    setErr('pv-err', ok ? `🌧️ Made it rain 10k gold on ${u}!` : '❌ ' + ((j && j.error) || 'failed'), ok);
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

  // Discord Roster (live from widget API)
  const DISCORD_GUILD_ID = '1554286212897050804';
  async function loadDiscordRoster() {
    const el = $('discord-roster');
    if (!el) return;
    el.innerHTML = '<div class="muted">Loading roster...</div>';
    try {
      const r = await fetch(`https://discord.com/api/guilds/${DISCORD_GUILD_ID}/widget.json`);
      const d = await r.json();
      const members = d.members || [];
      if (!members.length) {
        el.innerHTML = '<div class="muted">No members online right now.</div>';
        return;
      }
      const statusEmoji = { online: '🟢', idle: '🌙', dnd: '🔴', offline: '⚫' };
      el.innerHTML = members.map(m => {
        const bot = m.bot ? ' <span class="muted tiny">[BOT]</span>' : '';
        const game = m.game ? ` <span class="muted tiny">🎮 ${esc(m.game.name || '')}</span>` : '';
        return `<div class="roster-member" style="padding:6px 0;border-bottom:1px solid rgba(255,255,255,0.05)">
          <span>${statusEmoji[m.status] || '⚫'}</span>
          <img src="${m.avatar_url}" alt="" style="width:24px;height:24px;border-radius:50%;vertical-align:middle;margin:0 8px">
          <b>${esc(m.username)}</b>${bot}${game}
        </div>`;
      }).join('');
    } catch (e) {
      el.innerHTML = '<div class="muted">Failed to load roster. Is the widget enabled?</div>';
    }
  }
  bind('roster-refresh-btn', loadDiscordRoster);
  // Auto-load when broadcast tab is opened
  document.querySelectorAll('.owner-tab-btn').forEach(b => {
    if (b.dataset.tab === 'broadcast') {
      b.addEventListener('click', () => setTimeout(loadDiscordRoster, 100));
    }
  });

  // Backup
  bind('backup-btn', async () => {
    setErr('backup-err', 'Backing up...');
    const { ok, j } = await api('/api/gm/reset-all-stages', { method: 'POST', body: JSON.stringify({ confirm: 'BACKUP-ONLY' }) });
    setErr('backup-err', ok ? '✅ Backup complete' : '❌ ' + ((j && j.error) || 'failed'), ok);
  });
})();
