import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, checkBossPhase } from '../src/combat/rules.js';
import { emitEnrage } from '../src/scenes/combat.js';
import { installAnimations } from '../src/ui/animations.js';

function makeBus() {
  const h = {};
  return { h, on(e, f) { (h[e] ||= []).push(f); }, off(e, f) { h[e] = (h[e] || []).filter((x) => x !== f); }, emit(e, p) { (h[e] || []).forEach((f) => f(p)); } };
}
function makeGame(combat) {
  const events = [];
  const bus = makeBus();
  bus.on('combat:enrage', (p) => events.push(p));
  return { events, bus, state: { combat, party: [] }, combatEnraged: combat?.enraged === true };
}

test('a boss crossing its enrage threshold announces combat:enrage exactly once', () => {
  const c = createCombat({ enemyId: 'cinderclaw' });
  const g = makeGame(c);
  assert.equal(emitEnrage(g), false, 'healthy boss does not announce');
  c.enemy.hp = Math.floor(c.enemy.maxHp * 0.4);
  assert.ok(checkBossPhase(c).length > 0);
  assert.equal(c.enraged, true);
  assert.equal(emitEnrage(g), true);
  assert.equal(emitEnrage(g), false, 'never repeats in the same fight');
  assert.deepEqual(g.events, [{}]);
  assert.equal(g.combatEnraged, true);
});

test('no announcement on a killing blow, an already-enraged resume, or bad input', () => {
  const c = createCombat({ enemyId: 'cinderclaw' });
  const g = makeGame(c);
  c.enraged = true; c.over = 'victory'; c.enemy.hp = 0;
  assert.equal(emitEnrage(g), false);
  const resumed = createCombat({ enemyId: 'cinderclaw' });
  resumed.enraged = true;
  const g2 = makeGame(resumed);
  assert.equal(emitEnrage(g2), false, 'a fight entered already enraged stays quiet');
  const lookalike = createCombat({ enemyId: 'cinderclaw' });
  lookalike.enraged = 'true';
  assert.equal(emitEnrage(makeGame(lookalike)), false);
  assert.equal(emitEnrage(null), false);
  assert.equal(emitEnrage({ state: {} }), false);
  const nobus = { state: { combat: { enraged: true, enemy: { hp: 5 } } } };
  assert.equal(emitEnrage(nobus), true, 'a missing bus is tolerated');
  assert.equal(g.events.length + g2.events.length, 0);
});

test('a foe without an enrage phase never announces', () => {
  const c = createCombat({ enemyId: 'rust_sentinel' });
  const g = makeGame(c);
  c.enemy.hp = 1;
  checkBossPhase(c);
  assert.equal(emitEnrage(g), false);
  assert.equal(g.events.length, 0);
});

test('installAnimations listens for combat:enrage and cleans up', () => {
  const bus = makeBus();
  const hadDoc = 'document' in globalThis;
  if (!hadDoc) globalThis.document = { createElement: () => ({}), head: { appendChild() {} } };
  let off;
  try { off = installAnimations({ bus, state: {} }); } finally { if (!hadDoc) delete globalThis.document; }
  assert.equal((bus.h['combat:enrage'] || []).length, 1);
  assert.doesNotThrow(() => bus.emit('combat:enrage', {}), 'Node (no document) is safe');
  off();
  assert.equal((bus.h['combat:enrage'] || []).length, 0);
});
