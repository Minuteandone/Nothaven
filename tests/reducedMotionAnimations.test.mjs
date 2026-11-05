import test from 'node:test';
import assert from 'node:assert/strict';
import { prefersReducedMotion, crossfadeScene, enemyDeathFade, tweenMeter, screenShake, damagePopup } from '../src/ui/animations.js';

function withEnv({ media = false, attr = null } = {}, fn) {
  const origDoc = globalThis.document, origWin = globalThis.window;
  const body = { appendChild() {} };
  globalThis.document = {
    documentElement: { getAttribute: (n) => (n === 'data-motion' ? attr : null) },
    createElement() { return { style: {}, setAttribute() {}, appendChild() {}, addEventListener() { this.listened = true; }, remove() { this.removed = true; }, getBoundingClientRect: () => ({ left: 0, top: 0, width: 0 }) }; },
    contains() { return true; }, body, head: body,
    getElementById() { throw new Error('screenShake should not touch #app when reduced'); },
  };
  globalThis.window = { matchMedia: () => ({ matches: media }) };
  try { return fn(); } finally { globalThis.document = origDoc; globalThis.window = origWin; }
}

test('prefersReducedMotion is false and safe without a browser', () => {
  assert.equal(prefersReducedMotion(), false);
});

test('prefersReducedMotion honours the OS query and the in-game data-motion attribute', () => {
  assert.equal(withEnv({ media: true }, prefersReducedMotion), true);
  assert.equal(withEnv({ attr: 'reduced' }, prefersReducedMotion), true);
  assert.equal(withEnv({}, prefersReducedMotion), false);
});

test('crossfadeScene swaps content immediately with no fade when reduced', () => {
  withEnv({ media: true }, () => {
    const c = { style: {}, innerHTML: 'old' };
    crossfadeScene(c, 'new', 250);
    assert.equal(c.innerHTML, 'new');
    assert.equal(c.style.opacity, undefined);
    assert.equal(c.style.transition, undefined);
  });
});

test('enemyDeathFade hides instantly without flash or transition when reduced', () => {
  withEnv({ attr: 'reduced' }, () => {
    const el = { style: {} };
    enemyDeathFade(el);
    assert.equal(el.style.opacity, '0');
    assert.equal(el.style.filter, undefined);
    assert.equal(el.style.transition, undefined);
  });
});

test('tweenMeter jumps without a transition when reduced, and animates otherwise', () => {
  const mk = () => { const fill = { style: {} }; return { fill, el: { querySelector: (q) => (q === '.meter__fill' ? fill : null) } }; };
  withEnv({ media: true }, () => { const m = mk(); tweenMeter(m.el, 5, 10); assert.equal(m.fill.style.transition, 'none'); assert.equal(m.fill.style.width, '50%'); });
  withEnv({}, () => { const m = mk(); tweenMeter(m.el, 5, 10, 300); assert.equal(m.fill.style.transition, 'width 300ms ease-out'); });
});

test('screenShake does nothing when reduced', () => {
  withEnv({ media: true }, () => assert.doesNotThrow(() => screenShake(8, 500)));
});

test('damagePopup cleans itself up on a timer when reduced (no animationend)', () => {
  const origST = globalThis.setTimeout; let scheduled = null;
  globalThis.setTimeout = (f, ms) => { scheduled = { f, ms }; return 0; };
  try {
    withEnv({ media: true }, () => damagePopup({ getBoundingClientRect: () => ({ left: 0, top: 0, width: 0 }) }, 7));
    assert.ok(scheduled, 'removal scheduled');
    assert.equal(scheduled.ms, 700);
  } finally { globalThis.setTimeout = origST; }
});
