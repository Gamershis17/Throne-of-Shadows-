// GM Quick Panel (Q / . hotkey) — in-game overlay for Game Masters
// Press Q or . to toggle. Only visible to GM+ roles.
// Provides: quick commands, buffs, debuffs, testing tools.

const F5Panel = (() => {
  let panelEl = null;
  let isOpen = false;

  function isGM() {
    const role = window.App && App.user && App.user.role;
    return role === 'gm' || role === 'admin' || role === 'owner';
  }

  function toggle() {
    // Note: role is enforced server-side on all /api/gm/* endpoints.
    // Client gate removed: isGM() was unreliable (App.user timing) and blocked the owner.
    isOpen ? close() : open();
  }

  function open() {
    if (panelEl) {
      panelEl.classList.remove('hidden');
      isOpen = true;
      return;
    }
    build();
    isOpen = true;
  }

  function close() {
    if (panelEl) panelEl.classList.add('hidden');
    isOpen = false;
  }

  function build() {
    panelEl = document.createElement('div');
    panelEl.id = 'f5-gm-panel';
    panelEl.innerHTML = `
      <div class="f5-gm-header">
        <span>🛠️ GM Quick Panel</span>
        <button class="f5-gm-close" id="f5-gm-close">✕</button>
      </div>
      <div class="f5-gm-body">
        <div class="f5-gm-section">
          <h4>⚡ Quick Commands</h4>
          <div class="f5-gm-btns">
            <button class="btn small gold" data-cmd="godmode">🛡️ God Mode</button>
            <button class="btn small gold" data-cmd="heal">💚 Heal</button>
            <button class="btn small" data-cmd="pauseatk">⏸️ Pause Attacks</button>
            <button class="btn small" data-cmd="resumeatk">▶️ Resume Attacks</button>
          </div>
        </div>
        <div class="f5-gm-section">
          <h4>💪 Buffs (self)</h4>
          <div class="f5-gm-btns">
            <button class="btn small" data-buff="dmg" data-pct="100" data-sec="300">+100% DMG (5m)</button>
            <button class="btn small" data-buff="def" data-pct="100" data-sec="300">+100% DEF (5m)</button>
            <button class="btn small" data-buff="xp" data-pct="200" data-sec="300">+200% XP (5m)</button>
            <button class="btn small" data-buff="gold" data-pct="200" data-sec="300">+200% Gold (5m)</button>
            <button class="btn small" data-buff="speed" data-pct="50" data-sec="300">+50% Speed (5m)</button>
            <button class="btn small ghost" data-buff="clear">🧹 Clear Buffs</button>
          </div>
        </div>
        <div class="f5-gm-section">
          <h4>☠️ Debuffs (testing)</h4>
          <div class="f5-gm-btns">
            <button class="btn small" data-debuff="bleed">🩸 Bleed (self)</button>
            <button class="btn small" data-debuff="poison">☠️ Poison (self)</button>
            <button class="btn small" data-debuff="burn">🔥 Burn (self)</button>
            <button class="btn small" data-debuff="stun">💫 Stun (self)</button>
            <button class="btn small ghost" data-debuff="clear">🧹 Clear Debuffs</button>
          </div>
          <p class="muted tiny">Apply to enemy:</p>
          <div class="f5-gm-btns">
            <button class="btn small" data-edebuff="bleed">🩸 Bleed (enemy)</button>
            <button class="btn small" data-edebuff="poison">☠️ Poison (enemy)</button>
            <button class="btn small" data-edebuff="burn">🔥 Burn (enemy)</button>
          </div>
        </div>
        <div class="f5-gm-section">
          <h4>🧪 Testing</h4>
          <div class="f5-gm-btns">
            <button class="btn small gold" data-test="gold">💰 +10k Gold</button>
            <button class="btn small gold" data-test="level">⬆️ +1 Level</button>
            <button class="btn small" data-test="killenemy">💀 Kill Enemy</button>
            <button class="btn small" data-test="respawn">🔄 Respawn Enemy</button>
          </div>
        </div>
        <div class="f5-gm-section">
          <h4>⚔️ Forge Custom Weapon</h4>
          <div class="f5-gm-form">
            <input id="f5-forge-user" placeholder="Player username" class="f5-gm-input">
            <input id="f5-forge-name" placeholder="Weapon name (e.g. ELOF)" class="f5-gm-input">
            <div class="f5-gm-row">
              <select id="f5-forge-slot" class="f5-gm-input">
                <option value="weapon">Weapon</option>
                <option value="armor">Armor</option>
                <option value="helmet">Helmet</option>
                <option value="boots">Boots</option>
                <option value="trinket">Trinket</option>
              </select>
              <select id="f5-forge-rarity" class="f5-gm-input">
                <option value="common">Common</option>
                <option value="rare">Rare</option>
                <option value="epic">Epic</option>
                <option value="legendary">Legendary</option>
                <option value="mythic">Mythic</option>
              </select>
            </div>
            <div class="f5-gm-row">
              <input id="f5-forge-atk" type="number" placeholder="ATK" class="f5-gm-input small">
              <input id="f5-forge-hp" type="number" placeholder="HP" class="f5-gm-input small">
              <input id="f5-forge-def" type="number" placeholder="DEF" class="f5-gm-input small">
            </div>
            <div class="f5-gm-row">
              <input id="f5-forge-crit" type="number" placeholder="Crit%" class="f5-gm-input small">
              <input id="f5-forge-ls" type="number" placeholder="Lifesteal%" class="f5-gm-input small">
              <input id="f5-forge-spd" type="number" placeholder="AtkSpd%" class="f5-gm-input small">
            </div>
            <button class="btn gold wide" id="f5-forge-btn">🔨 Forge & Give</button>
            <div id="f5-forge-result" class="muted small" style="margin-top:6px"></div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(panelEl);

    panelEl.querySelector('#f5-gm-close').addEventListener('click', close);

    // Wire buttons
    panelEl.querySelectorAll('[data-cmd]').forEach(b => {
      b.addEventListener('click', () => runCommand(b.dataset.cmd));
    });
    panelEl.querySelectorAll('[data-buff]').forEach(b => {
      b.addEventListener('click', () => applyBuff(b.dataset.buff, b.dataset.pct, b.dataset.sec));
    });
    panelEl.querySelectorAll('[data-debuff]').forEach(b => {
      b.addEventListener('click', () => applyDebuff(b.dataset.debuff, false));
    });
    panelEl.querySelectorAll('[data-edebuff]').forEach(b => {
      b.addEventListener('click', () => applyDebuff(b.dataset.edebuff, true));
    });
    panelEl.querySelectorAll('[data-test]').forEach(b => {
      b.addEventListener('click', () => runTest(b.dataset.test));
    });
    // Forge button
    const forgeBtn = panelEl.querySelector('#f5-forge-btn');
    if (forgeBtn) forgeBtn.addEventListener('click', forgeWeapon);
  }

  async function forgeWeapon() {
    const val = (id) => panelEl.querySelector('#' + id).value.trim();
    const num = (id) => { const v = Number(val(id)); return Number.isFinite(v) && v !== 0 ? v : null; };
    const result = panelEl.querySelector('#f5-forge-result');
    const username = val('f5-forge-user');
    const name = val('f5-forge-name');
    const slot = val('f5-forge-slot');
    const rarity = val('f5-forge-rarity');
    const stats = {};
    const atk = num('f5-forge-atk'), hp = num('f5-forge-hp'), def = num('f5-forge-def');
    const crit = num('f5-forge-crit'), ls = num('f5-forge-ls'), spd = num('f5-forge-spd');
    if (atk) stats.attack = atk;
    if (hp) stats.maxHp = hp;
    if (def) stats.defense = def;
    if (crit) stats.critChance = crit;
    if (ls) stats.lifesteal = ls;
    if (spd) stats.attackSpeed = spd;
    if (!username || !name) { result.textContent = 'Enter player username and weapon name.'; return; }
    if (!Object.keys(stats).length) { result.textContent = 'Enter at least one stat.'; return; }
    result.textContent = 'Forging...';
    try {
      const r = await fetch('/api/gm/create-op-gear', {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, name, slot, rarity, stats }),
      });
      const j = await r.json();
      if (!r.ok || !j.ok) throw new Error(j.error || 'Forge failed');
      result.textContent = `Forged "${j.item.name}" for ${username}!`;
      toast(`⚔️ ${name} given to ${username}!`);
    } catch (e) { result.textContent = '❌ ' + e.message; }
  }

  async function runCommand(cmd) {
    const s = window.App && App.state;
    try {
      if (cmd === 'godmode') {
        const res = await fetch('/api/gm/godmode', { method: 'POST', credentials: 'include' });
        const j = await res.json();
        toast(j.godmode ? '🛡️ God Mode ON' : '🛡️ God Mode OFF');
      } else if (cmd === 'heal') {
        if (s) { s.hp = s.maxHp || s.hp; if (window.UI) UI.toast('💚 Healed!', 'success'); }
        if (typeof saveNow === 'function') saveNow();
      } else if (cmd === 'pauseatk') {
        if (window.GMState) GMState.pauseAutoAttack = true;
        toast('⏸️ Auto-attacks paused');
      } else if (cmd === 'resumeatk') {
        if (window.GMState) GMState.pauseAutoAttack = false;
        toast('▶️ Auto-attacks resumed');
      }
    } catch (e) { toast('❌ ' + e.message); }
  }

  function applyBuff(kind, pct, sec) {
    const s = window.App && App.state;
    if (!s) return toast('❌ No game state');
    if (kind === 'clear') {
      s.buffs = [];
      toast('🧹 Buffs cleared');
    } else {
      // Map to engine buff kinds
      const kindMap = { dmg: 'dmgPct', def: 'dmgTakenPct', xp: 'xpPct', gold: 'goldPct', speed: 'speedPct' };
      const engineKind = kindMap[kind] || kind;
      // def is inverted (less damage taken = negative pct)
      const val = kind === 'def' ? -Number(pct) : Number(pct);
      if (window.Engine && Engine.addBuff) {
        Engine.addBuff(s, engineKind, val, Number(sec) || 300);
        toast(`💪 +${pct}% ${kind.toUpperCase()} applied!`);
      }
    }
    if (typeof saveNow === 'function') saveNow();
  }

  function applyDebuff(kind, toEnemy) {
    if (kind === 'clear') {
      const s = window.App && App.state;
      if (s) s.debuffs = [];
      toast('🧹 Debuffs cleared');
      return;
    }
    const target = toEnemy ? (window.App && App.enemy) : (window.App && App.state);
    if (!target) return toast('❌ No target');
    if (window.Engine && Engine.addDebuff) {
      Engine.addDebuff(target, kind, 10, 30);
      toast(`☠️ ${kind} applied to ${toEnemy ? 'enemy' : 'self'}!`);
    }
  }

  async function runTest(action) {
    try {
      if (action === 'gold') {
        const res = await fetch('/api/gm/grant', {
          method: 'POST', credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ type: 'gold', amount: 10000 })
        });
        toast(res.ok ? '💰 +10k Gold!' : '❌ Failed');
      } else if (action === 'level') {
        if (window.Engine && App.state) {
          App.state.xp = (App.state.xpNext || 100);
          toast('⬆️ XP set to level-up!');
          if (typeof saveNow === 'function') saveNow();
        }
      } else if (action === 'killenemy') {
        if (window.App && App.enemy) {
          App.enemy.hp = 0;
          // Clear the spawn guard in case it's stuck, then trigger real death logic
          App.spawnPending = false;
          if (typeof window.onKillEnemy === 'function') {
            window.onKillEnemy();
          } else {
            toast('❌ onKillEnemy not loaded — hard refresh (Ctrl+F5)');
          }
          toast('💀 Enemy killed');
        } else toast('❌ No enemy');
      } else if (action === 'respawn') {
        if (typeof spawnEnemy === 'function') { spawnEnemy(); toast('🔄 Enemy respawned'); }
        else toast('❌ Respawn not available here');
      }
    } catch (e) { toast('❌ ' + e.message); }
  }

  function toast(msg) {
    if (window.UI && UI.toast) UI.toast(msg, 'success');
    else console.log('[F5]', msg);
  }

  // Hotkey listener — Q or . opens GM panel (GM+ roles only)
  document.addEventListener('keydown', (e) => {
    // Don't trigger while typing in inputs
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
    if (e.key === 'q' || e.key === 'Q' || e.key === '.') {
      e.preventDefault();
      toggle();
    }
    if (e.key === 'Escape' && isOpen) close();
  });

  // Mobile fallback: floating GM button (only for GM+ roles, no F2 key on mobile)
  function addMobileButton() {
    if (!isGM() || document.getElementById('f5-gm-fab')) return;
    const fab = document.createElement('button');
    fab.id = 'f5-gm-fab';
    fab.innerHTML = '🛠️';
    fab.title = 'GM Panel';
    fab.style.cssText = 'position:fixed;bottom:80px;right:12px;z-index:99998;width:48px;height:48px;border-radius:50%;background:#1a1428;border:2px solid #ffd700;font-size:22px;cursor:pointer;box-shadow:0 2px 12px rgba(0,0,0,.5);';
    fab.addEventListener('click', toggle);
    document.body.appendChild(fab);
  }
  // Check on load and periodically (role loads async)
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(addMobileButton, 2000));
  } else {
    setTimeout(addMobileButton, 2000);
  }
  setInterval(() => { if (isGM()) addMobileButton(); }, 5000);

  return { toggle, open, close, isOpen: () => isOpen };
})();

// Expose globally
window.F5Panel = F5Panel;
