import test from 'node:test';
import assert from 'node:assert/strict';
import { hpSnapshot, emitHpChanges } from '../src/scenes/combat.js';
import { combatAnchor, installAnimations } from '../src/ui/animations.js';

function makeBus() {
  const h = {};
  return { h, on(e, f) { (h[e] ||= []).push(f); }, off(e, f) { h[e] = (h[e] || []).filter((x) => x !== f); }, emit(e, p) { (h[e] || []).forEach((f) => f(p)); } };
}
function makeGame() {
  const events = [];
  const bus = makeBus();
  bus.on('combat:hp', (p) => events.push(p));
  return { events, bus, state: { combat: { enemy: { hp: 100 } }, party: [{ hp: 30 }, { hp: 20 }] } };
}

test('hpSnapshot reads foe and party HP and tolerates missing combat', () => {
  assert.deepEqual(hpSnapshot(makeGame()), { enemy: 100, party: [30, 20] });
  assert.deepEqual(hpSnapshot({ state: {} }), { enemy: 0, party: [] });
});

test('emitHpChanges reports damage and healing deltas, then re-baselines', () => {
  const g = makeGame();
  assert.deepEqual(emitHpChanges(g), [], 'first call only takes a baseline');
  assert.equal(g.events.length, 0);
  g.state.combat.enemy.hp = 88; g.state.party[0].hp = 24; g.state.party[1].hp = 26;
  const ch = emitHpChanges(g);
  assert.deepEqual(ch, [{ target: 'enemy', delta: -12 }, { target: 0, delta: -6 }, { target: 1, delta: 6 }]);
  assert.deepEqual(g.events, [{ changes: ch }]);
  assert.deepEqual(emitHpChanges(g), [], 'no change, no event');
  assert.equal(g.events.length, 1);
});

test('emitHpChanges is safe without a bus and ignores members added after the baseline', () => {
  const g = makeGame(); delete g.bus;
  emitHpChanges(g);
  g.state.party.push({ hp: 15 });
  assert.deepEqual(emitHpChanges(g), []);
});

test('combatAnchor is null outside a browser', () => {
  assert.equal(combatAnchor('enemy'), null);
  assert.equal(combatAnchor(0), null);
});

test('combat:hp spawns red damage and green heal numbers on the matching unit cards', () => {
  const origDoc = globalThis.document, origWin = globalThis.window, origST = globalThis.setTimeout;
  const spawned = [];
  const card = (name) => ({ name, getBoundingClientRect: () => ({ left: 0, top: 0, width: 10 }) });
  const enemyCard = card('enemy'), heroCard = card('hero'), allyCard = card('ally');
  globalThis.setTimeout = (f) => { f(); return 0; };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.document = {
    documentElement: { getAttribute: () => null },
    head: { appendChild() {} },
    body: { appendChild() {} },
    contains: () => true,
    getElementById: () => null,
    querySelector: (q) => (q === '.combat-side--enemy .unit' ? enemyCard : null),
    querySelectorAll: (q) => (q === '.party-units .unit' ? [heroCard, allyCard] : []),
    createElement() {
      const el = { style: {}, setAttribute() {}, addEventListener() {}, remove() {}, appendChild(child) { spawned.push(child); } };
      return el;
    },
  };
  try {
    const bus = makeBus();
    const cleanup = installAnimations({ bus });
    assert.equal(combatAnchor('enemy'), enemyCard);
    assert.equal(combatAnchor(1), allyCard);
    assert.equal(combatAnchor(5), null);
    bus.emit('combat:hp', { changes: [{ target: 'enemy', delta: -12 }, { target: 1, delta: 6 }, { target: 0, delta: 0 }] });
    const pops = spawned.filter((e) => /damage-pop/.test(e.className || ''));
    assert.deepEqual(pops.map((p) => [p.className, p.textContent]), [
      ['damage-pop damage-pop--damage', '12'],
      ['damage-pop damage-pop--heal', '+6'],
    ]);
    cleanup();
    assert.equal((bus.h['combat:hp'] || []).length, 0, 'cleanup unsubscribes');
  } finally {
    globalThis.document = origDoc; globalThis.window = origWin; globalThis.setTimeout = origST;
  }
});
