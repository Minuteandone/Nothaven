import test from 'node:test';
import assert from 'node:assert/strict';
import { installAnimations } from '../src/ui/animations.js';

function makeBus() {
  const h = {};
  return { h, on(e, f) { (h[e] ||= []).push(f); }, off(e, f) { h[e] = (h[e] || []).filter((x) => x !== f); }, emit(e, p) { (h[e] || []).forEach((f) => f(p)); } };
}

function withDom(reduced, fn) {
  const origDoc = globalThis.document, origWin = globalThis.window, origST = globalThis.setTimeout;
  const enemyCard = { style: {} };
  const asked = [];
  globalThis.setTimeout = (f) => { f(); return 0; };
  globalThis.window = { matchMedia: () => ({ matches: false }) };
  globalThis.document = {
    documentElement: { getAttribute: (k) => (k === 'data-motion' && reduced ? 'reduced' : null) },
    head: { appendChild() {} },
    body: { appendChild() {}, style: {} },
    contains: () => true,
    getElementById: () => null,
    querySelector: (q) => { asked.push(q); return q === '.combat-side--enemy .unit' ? enemyCard : null; },
    querySelectorAll: () => [],
    createElement: () => ({ style: {}, setAttribute() {}, addEventListener() {}, remove() {}, appendChild() {} }),
  };
  try { fn(enemyCard, asked); } finally {
    globalThis.document = origDoc; globalThis.window = origWin; globalThis.setTimeout = origST;
  }
}

test('combat:victory fades the defeated foe card', () => {
  withDom(false, (card, asked) => {
    const bus = makeBus();
    const cleanup = installAnimations({ bus });
    bus.emit('combat:victory', { enemyId: 'tide_wraith' });
    assert.ok(asked.includes('.combat-side--enemy .unit'), 'looks up the foe card');
    assert.match(card.style.transition, /opacity/);
    assert.equal(card.style.opacity, '0');
    cleanup();
    assert.equal((bus.h['combat:victory'] || []).length, 0, 'cleanup unsubscribes');
  });
});

test('combat:victory hides the foe card instantly under reduced motion', () => {
  withDom(true, (card) => {
    const bus = makeBus();
    const cleanup = installAnimations({ bus });
    bus.emit('combat:victory', { enemyId: 'tide_wraith' });
    assert.equal(card.style.opacity, '0');
    assert.equal(card.style.transition, undefined);
    assert.equal(card.style.filter, undefined);
    cleanup();
  });
});

test('combat:victory is safe outside a browser', () => {
  const bus = makeBus();
  const cleanup = installAnimations({ bus });
  assert.doesNotThrow(() => bus.emit('combat:victory', { enemyId: 'tide_wraith' }));
  cleanup();
});
