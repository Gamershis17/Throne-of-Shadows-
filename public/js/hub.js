(function () {
  'use strict';
  function $(id) { return document.getElementById(id); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function fmt(n) {
    n = Math.floor(Number(n) || 0);
    if (n < 1000) return String(n);
    const u = ['K', 'M', 'B', 'T', 'Q'];
    let i = -1, v = n;
    while (v >= 1000 && i < u.length - 1) { v /= 1000; i++; }
    return (v >= 100 ? v.toFixed(0) : v.toFixed(1)) + u[i];
  }
  async function get(url) {
    const r = await fetch(url, { credentials: 'same-origin' });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return r.json();
  }

  // --- server status (existing endpoint) ---
  get('/api/status').then(function (d) {
    const on = !d.maintenance;
    $('status-body').innerHTML =
      '<div><span class="status-dot ' + (on ? 'on' : 'off') + '"></span>' +
      (on ? '<b>Online</b>' : '<b style="color:var(--red)">Maintenance</b>') + '</div>' +
      (d.message ? '<div class="muted small" style="margin-top:0.3rem">' + esc(d.message) + '</div>' : '') +
      (d.commit ? '<div class="muted small" style="margin-top:0.3rem">Build: <code>' + esc(String(d.commit).slice(0, 8)) + '</code></div>' : '');
  }).catch(function () { $('status-body').innerHTML = '<div class="err">Could not reach the server.</div>'; });

  // --- live stats ---
  get('/api/hub/stats').then(function (d) {
    $('stats-body').innerHTML =
      '<div class="stat"><div class="v">' + fmt(d.online) + '</div><div class="l">Online</div></div>' +
      '<div class="stat"><div class="v">' + fmt(d.totalAccounts) + '</div><div class="l">Accounts</div></div>' +
      '<div class="stat"><div class="v">' + fmt(d.ahActive) + '</div><div class="l">AH Listings</div></div>';
  }).catch(function () { $('stats-body').innerHTML = '<div class="err">Stats unavailable.</div>'; });

  // --- leaderboards ---
  const lbLabels = { level: 'Level', stage: 'Stage', bosses: 'Bosses' };
  function loadLB(by) {
    $('lb-body').innerHTML = '<div class="loading">Loading…</div>';
    get('/api/hub/leaderboard?by=' + encodeURIComponent(by) + '&limit=10').then(function (d) {
      if (!d.entries.length) { $('lb-body').innerHTML = '<div class="muted">No entries yet.</div>'; return; }
      $('lb-body').innerHTML = d.entries.map(function (e) {
        const rc = e.rank <= 3 ? ' r' + e.rank : '';
        const val = by === 'level' ? 'Lv ' + fmt(e.level)
          : by === 'stage' ? 'Stage ' + fmt(e.stage)
          : fmt(e.bosses) + ' kills';
        const sub = (e.guild ? '[' + esc(e.guild) + '] ' : '') +
          'Lv ' + fmt(e.level) + ' · ' + fmt(e.gold) + ' gold';
        return '<div class="lb-row"><div class="rank' + rc + '">' + e.rank + '</div>' +
          '<div class="lb-name">' + esc(e.username) + '<div class="lb-sub">' + sub + '</div></div>' +
          '<div class="lb-val">' + esc(val) + '</div></div>';
      }).join('');
    }).catch(function () { $('lb-body').innerHTML = '<div class="err">Leaderboard unavailable.</div>'; });
  }
  document.querySelectorAll('[data-lb]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      document.querySelectorAll('[data-lb]').forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      loadLB(btn.getAttribute('data-lb'));
    });
  });
  loadLB('level');

  // --- events ---
  get('/api/hub/holidays').then(function (d) {
    $('events-body').innerHTML = d.events.map(function (e) {
      return '<div class="event-row"><div class="event-emoji">' + esc(e.emoji) + '</div>' +
        '<div class="event-body"><div class="event-name">' + esc(e.name) + '</div>' +
        '<div class="event-dates">' + esc(e.label) + '</div>' +
        '<div class="event-fx">' + esc(e.effect) + '</div></div>' +
        (e.active ? '<span class="now-badge">NOW</span>' : '') + '</div>';
    }).join('');
  }).catch(function () { $('events-body').innerHTML = '<div class="err">Events unavailable.</div>'; });

  // --- patch notes ---
  get('/api/hub/changelog').then(function (d) {
    if (!d.entries.length) { $('pn-body').innerHTML = '<div class="muted">No patch notes yet.</div>'; return; }
    $('pn-body').innerHTML = d.entries.map(function (e) {
      return '<div class="pn-block"><div class="pn-title">' + esc(e.title) + '</div>' +
        '<div class="pn-date">' + esc([e.date, e.time].filter(Boolean).join(' · ')) + '</div>' +
        e.changes.map(function (c) { return '<div class="pn-change">' + esc(c) + '</div>'; }).join('') +
        '</div>';
    }).join('');
  }).catch(function () { $('pn-body').innerHTML = '<div class="err">Patch notes unavailable.</div>'; });

  // --- owner gate + activity ---
  get('/api/hub/me').then(function (d) {
    if (d.role === 'owner') {
      document.body.classList.add('is-owner');
      return get('/api/hub/activity').then(function (a) {
        $('act-ah').innerHTML = a.recentAuctions.length ? a.recentAuctions.map(function (x) {
          return '<div class="act-row">' + esc(x.seller) + ' listed <b>' + esc(x.item) + '</b> x' + x.qty +
            ' — ' + fmt(x.price) + 'g <span class="muted">(' + esc(x.status) + ')</span></div>';
        }).join('') : '<div class="muted">No auctions yet.</div>';
        $('act-users').innerHTML = a.newAccounts.length ? a.newAccounts.map(function (u) {
          return '<div class="act-row">' + esc(u.username) + ' <span class="muted">(' + esc(u.role) + ')</span></div>';
        }).join('') : '<div class="muted">No accounts yet.</div>';
      }).catch(function () {
        $('act-ah').innerHTML = '<div class="err">Unavailable.</div>';
        $('act-users').innerHTML = '<div class="err">Unavailable.</div>';
      });
    }
  }).catch(function () { /* not logged in — owner sections stay hidden */ });
})();
