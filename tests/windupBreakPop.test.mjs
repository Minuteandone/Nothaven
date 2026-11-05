import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, heroAction, enemyTurn, enemyWindingUp } from '../src/combat/rules.js';
import { createInitialState } from '../src/state.js';
import { emitWindupBreak } from '../src/scenes/combat.js';
import { installAnimations } from '../src/ui/animations.js';

function makeBus() {
  const h = {};
  return { h, on(e, f) { (h[e] ||= []).push(f); }, off(e, f) { h[e] = (h[e] || []).filter((x) => x !== f); }, emit(e, p) { (h[e] || []).forEach((f) => f(p)); } };
}
function makeGame() {
  const events = [];
  const bus = makeBus();
  bus.on('combat:windupbreak', (p) => events.push(p));
  return { events, bus };
}
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

test('Stillpoint Strike scattering a windup announces combat:windupbreak', () => {
  const hero = { id: 'hero', name: 'Wren', level: 20, hp: 150, maxHp: 150, mp: 60, maxMp: 60, atk: 40, def: 10, spd: 5, statuses: [], equipment: {} };
  const c = createCombat({ enemyId: 'storm_heart' });
  c.windup = { name: c.enemy.windup.name };
  const r = heroAction(c, hero, { type: 'skill', skillId: 'stillpoint_strike' }, () => 0.5, [hero]);
  const g = makeGame();
  assert.equal(emitWindupBreak(g, r.lines), true);
  assert.equal(g.events.length, 1);
});

test('a stun breaking a gathered blow announces combat:windupbreak', () => {
  const c = createCombat({ enemyId: 'last_squall' });
  const h = createInitialState().party[0];
  h.hp = h.maxHp = 500;
  enemyTurn(c, h, seq(0.01), [h]);
  assert.ok(enemyWindingUp(c));
  c.enemy.statuses.push('stunned');
  const lines = enemyTurn(c, h, seq(0.5), [h]);
  const g = makeGame();
  assert.equal(emitWindupBreak(g, lines), true);
  assert.equal(g.events.length, 1);
});

test('ordinary actions and malformed logs do not announce a break', () => {
  const g = makeGame();
  assert.equal(emitWindupBreak(g, ['Wren strikes for 12!', 'Storm Rat is stunned and loses its turn.']), false);
  assert.equal(emitWindupBreak(g, null), false);
  assert.equal(emitWindupBreak(g, undefined), false);
  assert.equal(emitWindupBreak({}, ['Gathering Vortex scatters before it can land!']), true, 'no bus is tolerated');
  assert.equal(g.events.length, 0);
});

test('installAnimations listens for combat:windupbreak and cleans up', () => {
  const bus = makeBus();
  const off = installAnimationsSafe(bus);
  assert.equal((bus.h['combat:windupbreak'] || []).length, 1);
  assert.doesNotThrow(() => bus.emit('combat:windupbreak', {}), 'Node (no document) is safe');
  off();
  assert.equal((bus.h['combat:windupbreak'] || []).length, 0);
});

function installAnimationsSafe(bus) {
  const hadDoc = 'document' in globalThis;
  if (!hadDoc) globalThis.document = { createElement: () => ({}), head: { appendChild() {} } };
  try { return installAnimations({ bus, state: {} }); }
  finally { if (!hadDoc) delete globalThis.document; }
}
