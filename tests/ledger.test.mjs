import test from 'node:test';
import assert from 'node:assert/strict';
import { ledgerOf, recordVictory, recordDefeat, recordEscape, installLedger, SERVICE_ROWS } from '../src/core/ledger.js';
import { FEATS, featStatus, featsScene } from '../src/scenes/feats.js';
import { combatScene } from '../src/scenes/combat.js';
import { createInitialState } from '../src/state.js';
import { findEggWords } from './helpers/eggGuard.mjs';

// Only the shared layout class token is scrubbed; every other word is scanned.
const assertEggFree = (text, label) => assert.deepEqual(findEggWords(String(text).replace(/\bgame-shell\b/g, 'app-frame')), [], label);
function createBus() {
  const h = {};
  return { on(e, f) { (h[e] ||= []).push(f); }, emit(e, p) { (h[e] || []).forEach(f => f(p)); } };
}

const done = (s, id) => featStatus(s).find(f => f.id === id).done;

test('fresh and malformed saves read as an all-zero ledger without mutation', () => {
  const s = createInitialState();
  assert.deepEqual(ledgerOf(s), { victories: 0, bossVictories: 0, defeats: 0, escapes: 0, comebacks: 0, streak: 0, bestStreak: 0, stormbornBossVictories: 0, pendingComeback: false });
  assert.equal('ledger' in s, false);
  const bad = { ledger: { victories: -3, defeats: 'x', streak: 2.5, bestStreak: 1, escapes: Infinity } };
  const l = ledgerOf(bad);
  assert.equal(l.victories + l.defeats + l.streak + l.escapes, 0);
  assert.equal(ledgerOf({ ledger: { streak: 4, bestStreak: 1 } }).bestStreak, 4);
  assert.deepEqual(bad.ledger.victories, -3);
});

test('victories count streaks and bosses; defeats reset streak and arm a comeback', () => {
  const s = createInitialState();
  recordVictory(s, 'storm_rat');
  recordVictory(s, 'tide_wraith');
  assert.equal(s.ledger.victories, 2);
  assert.equal(s.ledger.bossVictories, 1);
  assert.equal(s.ledger.bestStreak, 2);
  recordDefeat(s);
  assert.equal(s.ledger.streak, 0);
  assert.equal(s.ledger.bestStreak, 2);
  assert.equal(s.ledger.pendingComeback, true);
  recordEscape(s);
  assert.equal(s.ledger.escapes, 1);
  assert.equal(s.ledger.pendingComeback, true, 'withdrawal keeps the comeback armed');
  recordVictory(s, 'not_a_foe');
  assert.equal(s.ledger.comebacks, 1);
  assert.equal(s.ledger.pendingComeback, false);
  assert.equal(s.ledger.bossVictories, 1, 'unknown ids are never bosses');
  recordVictory(s, 'storm_rat');
  assert.equal(s.ledger.comebacks, 1, 'one comeback per defeat');
});

test('installLedger tallies bus events and is a no-op without a bus', () => {
  assert.doesNotThrow(() => installLedger({}));
  const game = { state: createInitialState(), bus: createBus() };
  installLedger(game);
  game.bus.emit('combat:victory', { enemyId: 'storm_heart', encounterId: null });
  game.bus.emit('combat:defeat', { reason: 'hp' });
  game.bus.emit('combat:escape', { enemyId: 'storm_rat' });
  assert.deepEqual([game.state.ledger.victories, game.state.ledger.bossVictories, game.state.ledger.defeats, game.state.ledger.escapes], [1, 1, 1, 1]);
});

test('Undaunted and Steady Road feats follow the ledger', () => {
  assert.ok(FEATS.some(f => f.id === 'undaunted'));
  assert.ok(FEATS.some(f => f.id === 'steady_road'));
  const s = createInitialState();
  assert.equal(done(s, 'undaunted'), false);
  recordDefeat(s); recordVictory(s, 'storm_rat');
  assert.equal(done(s, 'undaunted'), true);
  for (let i = 0; i < 13; i += 1) recordVictory(s, 'storm_rat');
  assert.equal(done(s, 'steady_road'), false);
  recordEscape(s);
  recordVictory(s, 'storm_rat');
  assert.equal(s.ledger.bestStreak, 15);
  assert.equal(done(s, 'steady_road'), true);
  recordDefeat(s);
  assert.equal(done(s, 'steady_road'), true, 'the best run is kept after a later defeat');
});

test('fleeing a real battle emits combat:escape; drill exits do not', () => {
  const events = [];
  const make = drill => {
    const state = createInitialState();
    state.combat = { over: 'fled', enemy: { id: 'storm_rat' }, returnScene: 'town', encounterId: null, drill };
    return { state, combatMenu: 'main', scenes: { town: {}, drills: {} }, bus: { emit: (e, p) => events.push([e, p]) }, setScene() {} };
  };
  combatScene.actions.finish(make(undefined));
  assert.deepEqual(events, [['combat:escape', { enemyId: 'storm_rat' }]]);
  combatScene.actions.finish(make(true));
  assert.equal(events.length, 1);
});

test('repeating Finish or finishing with no battle never adds an escape', () => {
  const state = createInitialState();
  const bus = { handlers: {}, on(e, f) { (this.handlers[e] ||= []).push(f); }, emit(e, p) { for (const f of this.handlers[e] || []) f(p); } };
  const game = { state, combatMenu: 'main', scenes: { town: {}, drills: {} }, bus, setScene() {} };
  installLedger(game);
  state.combat = { over: 'fled', enemy: { id: 'storm_rat' }, returnScene: 'town', encounterId: null };
  combatScene.actions.finish(game);
  assert.equal(ledgerOf(state).escapes, 1);
  assert.equal(state.combat, null);
  combatScene.actions.finish(game);
  combatScene.actions.finish(game);
  assert.equal(ledgerOf(state).escapes, 1);
});

test('feats page shows an escaped, egg-free service record', () => {
  const state = createInitialState();
  recordVictory(state, 'tide_wraith');
  recordDefeat(state);
  const html = featsScene.render({ state });
  assert.match(html, /<h2 id="service-record-title">Service record<\/h2>/);
  assert.match(html, /<dt>Battles won<\/dt><dd>1<\/dd>/);
  assert.match(html, /<dt>Times carried home<\/dt><dd>1<\/dd>/);
  assert.equal((html.match(/<dt>/g) || []).length, SERVICE_ROWS.length + 2);
  assert.match(html, /<dt>Bounties claimed<\/dt><dd>0<\/dd>/);
  assert.match(html, /<dt>Board rank<\/dt><dd>Notice Runner<\/dd>/);
  assertEggFree(html, 'feats page');
  assertEggFree(SERVICE_ROWS.map(r => r.label).join(' '), 'service labels');
  for (const f of FEATS.filter(f => ['undaunted', 'steady_road'].includes(f.id))) assertEggFree(`${f.title} ${f.detail}`, f.id);
});

test('service record counts every claimed bounty, ignoring junk counts', () => {
  const state = createInitialState();
  state.bounties = { active: null, progress: 0, completed: { ridge_rats: 3, bandit_toll: 1, wolf_trail: 'x', no_such: 5 } };
  const html = featsScene.render({ state });
  const m = html.match(/<dt>Bounties claimed<\/dt><dd>(\d+)<\/dd>/);
  assert.ok(m, 'bounty row present');
  assertEggFree(html, 'feats page with bounties');
  assert.equal(m[1], '4');
});

test('service record shows the board rank earned from valid claims', () => {
  const state = createInitialState();
  state.bounties = { active: null, progress: 0, completed: { ridge_rats: 3, bandit_toll: 1, wolf_trail: 'x', no_such: 5 } };
  assert.match(featsScene.render({ state }), /<dt>Board rank<\/dt><dd>Contract Hand<\/dd>/);
  state.bounties.completed = { ridge_rats: 20, bandit_toll: 5 };
  assert.match(featsScene.render({ state }), /<dt>Board rank<\/dt><dd>Warden of the Board<\/dd>/);
});
