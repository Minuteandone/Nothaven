import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, heroAction, enemyTurn, enemyWindingUp } from '../src/combat/rules.js';
import { createInitialState } from '../src/state.js';
import { emitWindupBraced } from '../src/scenes/combat.js';
import { installAnimations } from '../src/ui/animations.js';

function makeBus() {
  const h = {};
  return { h, on(e, f) { (h[e] ||= []).push(f); }, off(e, f) { h[e] = (h[e] || []).filter((x) => x !== f); }, emit(e, p) { (h[e] || []).forEach((f) => f(p)); } };
}
function makeGame(party = []) {
  const events = [];
  const bus = makeBus();
  bus.on('combat:windupbraced', (p) => events.push(p));
  return { events, bus, state: { party } };
}
const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };

test('a windup released into a Defend announces combat:windupbraced on the hero', () => {
  const c = createCombat({ enemyId: 'last_squall' });
  const h = createInitialState().party[0];
  h.hp = h.maxHp = 500;
  enemyTurn(c, h, seq(0.01), [h]);
  assert.ok(enemyWindingUp(c));
  const r = heroAction(c, h, { type: 'defend' }, seq(0.5), [h]);
  const lines = [...(r?.lines || []), ...enemyTurn(c, h, seq(0.5), [h])];
  assert.ok(lines.some((l) => /braced against the worst of it/.test(l)), lines.join(' | '));
  const g = makeGame([h]);
  assert.equal(emitWindupBraced(g, lines), true);
  assert.deepEqual(g.events, [{ target: 0 }]);
});

test('an unguarded release does not announce a brace', () => {
  const c = createCombat({ enemyId: 'last_squall' });
  const h = createInitialState().party[0];
  h.hp = h.maxHp = 500;
  enemyTurn(c, h, seq(0.01), [h]);
  const lines = enemyTurn(c, h, seq(0.5), [h]);
  assert.ok(lines.some((l) => /unleashes/.test(l)));
  const g = makeGame([h]);
  assert.equal(emitWindupBraced(g, lines), false);
  assert.equal(g.events.length, 0);
});

test('the braced target follows the named party member, falling back to 0', () => {
  const party = [{ name: 'Wren' }, { name: 'Mara' }];
  const g = makeGame(party);
  assert.equal(emitWindupBraced(g, ['Last Squall unleashes Rolling Front! Mara takes 9, braced against the worst of it.']), true);
  assert.equal(emitWindupBraced(g, ['Last Squall unleashes Rolling Front! Stranger takes 9, braced against the worst of it.']), true);
  assert.deepEqual(g.events, [{ target: 1 }, { target: 0 }]);
  assert.equal(emitWindupBraced(g, null), false);
  assert.equal(emitWindupBraced(g, ['Wren defends.']), false);
  assert.equal(emitWindupBraced({}, ['X unleashes Y! Wren takes 3, braced against the worst of it.']), true, 'no bus or state is tolerated');
  assert.equal(g.events.length, 2);
});

test('installAnimations listens for combat:windupbraced and cleans up', () => {
  const bus = makeBus();
  const hadDoc = 'document' in globalThis;
  if (!hadDoc) globalThis.document = { createElement: () => ({}), head: { appendChild() {} } };
  let off;
  try { off = installAnimations({ bus, state: {} }); } finally { if (!hadDoc) delete globalThis.document; }
  assert.equal((bus.h['combat:windupbraced'] || []).length, 1);
  assert.doesNotThrow(() => bus.emit('combat:windupbraced', { target: 0 }), 'Node (no document) is safe');
  off();
  assert.equal((bus.h['combat:windupbraced'] || []).length, 0);
});
