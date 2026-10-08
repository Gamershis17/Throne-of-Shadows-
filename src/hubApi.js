'use strict';

/**
 * Community Hub API (v1):
 *   GET  /api/hub/stats        (public)  — players online, total accounts, active AH listings
 *   GET  /api/hub/leaderboard  (public)  — top players (?by=level|stage|bosses, ?limit=)
 *   GET  /api/hub/changelog    (public)  — patch notes from public/changelog.json
 *   GET  /api/hub/holidays     (public)  — holiday events with dates + effects
 *   GET  /api/hub/me           (auth)    — current user's role (to gate owner sections)
 *   GET  /api/hub/activity     (owner)   — recent AH listings + new accounts
 *
 * Server status (maintenance/version) is served by the existing GET /api/status.
 */

const express = require('express');
const fs = require('fs');
const path = require('path');
const { requireAuth, asyncHandler } = require('./auth');
const {
  pool,
  getPlayerCount,
  getLeaderboardRows,
} = require('./db');

const router = express.Router();

// Players online = saved state within the last 5 minutes (same convention as parties).
const ONLINE_MS = 5 * 60 * 1000;

function escName(s) {
  return String(s || '—').slice(0, 24);
}

router.get('/hub/stats', asyncHandler(async (req, res) => {
  const total = await getPlayerCount();
  let online = 0;
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM player_state WHERE updated_at > NOW() - INTERVAL '5 minutes'`
    );
    online = r.rows[0] ? r.rows[0].n : 0;
  } catch (e) { /* table may not exist yet — report 0 */ }
  let ahActive = 0;
  try {
    const r = await pool.query(
      `SELECT COUNT(*)::int AS n FROM auctions WHERE status = 'active' AND expires_at > NOW()`
    );
    ahActive = r.rows[0] ? r.rows[0].n : 0;
  } catch (e) { /* no auctions table yet */ }
  res.json({ ok: true, totalAccounts: total, online, ahActive });
}));

const HUB_LB_OK = new Set(['level', 'stage', 'bosses']);
router.get('/hub/leaderboard', asyncHandler(async (req, res) => {
  const by = typeof req.query.by === 'string' && HUB_LB_OK.has(req.query.by) ? req.query.by : 'level';
  const limit = Math.max(1, Math.min(25, Math.floor(Number(req.query.limit) || 10)));
  const rows = await getLeaderboardRows(limit, by);
  const entries = rows.map((r, i) => {
    let gold = 0;
    let playerClass = null;
    try {
      const blob = JSON.parse(r.state_json || '{}');
      gold = Math.floor(Number(blob.gold) || 0);
      playerClass = blob.playerClass || null;
    } catch { /* defaults */ }
    return {
      rank: i + 1,
      username: escName(r.username),
      level: Number(r.level) || 1,
      stage: Number(r.stage) || 1,
      bosses: Number(r.bosses_killed) || 0,
      gold,
      playerClass,
      guild: r.guild_tag ? String(r.guild_tag).slice(0, 12) : null,
    };
  });
  res.json({ ok: true, by, entries });
}));

router.get('/hub/changelog', asyncHandler(async (req, res) => {
  const p = path.join(__dirname, '..', 'public', 'changelog.json');
  try {
    const raw = fs.readFileSync(p, 'utf8');
    const items = JSON.parse(raw);
    const out = (Array.isArray(items) ? items : []).slice(0, 15).map((e) => ({
      date: e.date || null,
      time: e.time || null,
      title: String(e.title || '').slice(0, 120),
      changes: (Array.isArray(e.changes) ? e.changes : []).slice(0, 12).map((c) => String(c).slice(0, 300)),
    }));
    res.json({ ok: true, entries: out });
  } catch (e) {
    res.json({ ok: true, entries: [] });
  }
}));

// Holiday events mirror the in-game calendar (see public/js/ui.js HOLIDAYS).
// Effects are the design targets; some are still being wired into gameplay.
const HOLIDAYS = [
  { id: 'valentines',   name: 'Valentines',      emoji: '💘', label: 'Feb 10 – Feb 16',  effect: '+10% gold from kills' },
  { id: 'luck',         name: 'Luck Festival',   emoji: '🍀', label: 'Mar 10 – Mar 17',  effect: '+10% loot drop chance' },
  { id: 'spring',       name: 'Spring Bloom',    emoji: '🌸', label: 'Apr 15 – Apr 22',  effect: '+10% XP from kills' },
  { id: 'solstice',     name: 'Summer Solstice', emoji: '☀️', label: 'Jul 1 – Jul 7',    effect: '+10% damage' },
  { id: 'halloween',    name: 'Halloween',       emoji: '🎃', label: 'Oct 3 – Oct 31',   effect: '+pumpkin shard drops from tower bosses' },
  { id: 'harvest',      name: 'Harvest Feast',   emoji: '🌽', label: 'Nov 20 – Nov 30',  effect: '+10% consumable drops' },
  { id: 'winter-veil',  name: 'Winter Veil',     emoji: '❄️', label: 'Dec 20 – Jan 5',   effect: '+10% gold from all sources' },
];

function holidayActive(h) {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  const inRange = (sm, sd, em, ed) => {
    if (sm < em || (sm === em && sd <= ed)) {
      return (m > sm || (m === sm && d >= sd)) && (m < em || (m === em && d <= ed));
    }
    // wraps the year boundary (Winter Veil)
    return (m > sm || (m === sm && d >= sd)) || (m < em || (m === em && d <= ed));
  };
  const bounds = {
    valentines: [2, 10, 2, 16], luck: [3, 10, 3, 17], spring: [4, 15, 4, 22],
    solstice: [7, 1, 7, 7], halloween: [10, 3, 10, 31],
    harvest: [11, 20, 11, 30], 'winter-veil': [12, 20, 1, 5],
  }[h.id];
  return bounds ? inRange(...bounds) : false;
}

router.get('/hub/holidays', asyncHandler(async (req, res) => {
  res.json({ ok: true, events: HOLIDAYS.map((h) => ({ ...h, active: holidayActive(h) })) });
}));

router.get('/hub/me', requireAuth, asyncHandler(async (req, res) => {
  res.json({ ok: true, username: req.user.username, role: req.user.role || 'player' });
}));

function ownerOnly(req, res, next) {
  requireAuth(req, res, () => {
    if (req.user.role !== 'owner') {
      return res.status(403).json({ error: 'Owner only.' });
    }
    next();
  });
}

router.get('/hub/activity', ownerOnly, asyncHandler(async (req, res) => {
  const out = { ok: true, recentAuctions: [], newAccounts: [] };
  try {
    const r = await pool.query(
      `SELECT seller, item_name, quantity, buyout_price, created_at, status
       FROM auctions ORDER BY created_at DESC LIMIT 10`
    );
    out.recentAuctions = r.rows.map((a) => ({
      seller: escName(a.seller),
      item: String(a.item_name || '').slice(0, 60),
      qty: Number(a.quantity) || 1,
      price: Number(a.buyout_price) || 0,
      status: String(a.status || 'active'),
      at: a.created_at,
    }));
  } catch (e) { /* no auctions table */ }
  try {
    const r = await pool.query(
      `SELECT username, role, created_at FROM users ORDER BY created_at DESC LIMIT 10`
    );
    out.newAccounts = r.rows.map((u) => ({
      username: escName(u.username),
      role: String(u.role || 'player'),
      at: u.created_at,
    }));
  } catch (e) { /* users table shape differs */ }
  res.json(out);
}));

module.exports = { hubRouter: router };
