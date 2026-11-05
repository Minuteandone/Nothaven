import test from 'node:test';
import assert from 'node:assert/strict';
import { installAnimations, levelUpTargets } from '../src/ui/animations.js';

function makeBus() {
  const h = {};
  return { h, on(e, f) { (h[e] ||= []).push(f); }, off(e, f) { h[e] = (h[e] || []).filter((x) => x !== f); }, emit(e, p) { (h[e] || []).forEach((f) => f(p)); } };
}

const PARTY = [{ name: 'Wren' }, { name: 'Tamsin' }, { name: 'Iven' }];

test('levelUpTargets maps level-up lines to party indexes and keeps the highest level', () => {
  const lines = [
    'Wren reached level 5! (+6 HP, +2 ATK, +1 DEF)',
    'Iven reached level 4! (+6 HP, +2 ATK, +1 DEF)',
    'Wren reached level 6! (+6 HP, +2 ATK, +1 DEF)',
    'Drill complete! +40 XP.',
    'Stranger reached level 9! (+6 HP)',
  ];
  assert.deepEqual(levelUpTargets(PARTY, lines), [{ index: 0, level: 6 }, { index: 2, level: 4 }]);
  assert.deepEqual(levelUpTargets(PARTY, []), []);
  assert.deepEqual(levelUpTargets(null, lines), []);
  assert.deepEqual(levelUpTargets(PARTY, undefined), []);
});

function withDom(fn) {
  const origDoc = globalThis.document, origWin = globalThis.window, origST = globalThis.setTimeout;
  const cards = [{ getBoundingClientRect: () => ({ left: 10, top: 100, width: 80 }) },
    { getBoundingClientRect: () => ({ left: 110, top: 100, width: 80 }) },
    { getBoundingClientRect: () => ({ left: 210, top: 100, width: 80 }) }];
  const made = [];
  globalThis.setTimeout = (f) => { f(); return 0; };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.document = {
    documentElement: { getAttribute: () => null },
    head: { appendChild() {} },
    body: { appendChild() {}, style: {} },
    contains: () => true,
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: (q) => (q === '.party-units .unit' ? cards : []),
    createElement: () => { const el = { style: {}, setAttribute() {}, addEventListener() {}, remove() {}, appendChild(c) { made.push(c); } }; return el; },
  };
  try { fn(made); } finally {
    globalThis.document = origDoc; globalThis.window = origWin; globalThis.setTimeout = origST;
  }
}

test('party:levelup floats a gold Lv popup over each levelled member card', () => {
  withDom((made) => {
    const bus = makeBus();
    const cleanup = installAnimations({ bus, state: { party: PARTY } });
    bus.emit('party:levelup', { lines: ['Tamsin reached level 7! (+6 HP, +2 ATK, +1 DEF)'] });
    const pops = made.filter((el) => /damage-pop--level/.test(el.className || ''));
    assert.equal(pops.length, 1);
    assert.equal(pops[0].textContent, 'Lv 7!');
    assert.equal(pops[0].style.left, `${110 + 40 - 20}px`);
    cleanup();
    assert.equal((bus.h['party:levelup'] || []).length, 0, 'cleanup unsubscribes');
  });
});

test('party:levelup is safe outside a browser and without a party', () => {
  const bus = makeBus();
  const cleanup = installAnimations({ bus });
  assert.doesNotThrow(() => bus.emit('party:levelup', { lines: ['Wren reached level 2!'] }));
  assert.doesNotThrow(() => bus.emit('party:levelup'));
  cleanup();
});
