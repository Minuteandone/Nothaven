import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ANIM_CSS,
  injectAnimCSS,
  installAnimations,
  damagePopup,
  screenShake,
  tweenMeter,
  crossfadeScene,
  enemyDeathFade,
} from '../src/ui/animations.js';

// Egg guard: animations ship no Easter eggs in their rendered CSS or UI text.
const EGG_RE = /\b(egg|yolk|shell|hatch|nest|chick|hen|omelet|scrambl|poach|fried|boil|golden|feather|bird|rooster|clutch|cackl|cluck|goose|quail|pearl|basket|easter)\b/i;

test('ANIM_CSS is egg-free and defines damage pop keyframes', () => {
  assert.doesNotMatch(ANIM_CSS, EGG_RE);
  assert.match(ANIM_CSS, /@keyframes popUp/);
  assert.match(ANIM_CSS, /prefers-reduced-motion/);
});

test('installAnimations returns a no-op cleanup when the game has no bus', () => {
  const cleanup = installAnimations({});
  assert.equal(typeof cleanup, 'function');
  assert.doesNotThrow(() => cleanup());
  assert.equal(installAnimations(null)(), undefined);
});


test('installAnimations wires combat:defeat for screenShake', () => {
  // Minimal DOM mocks for Node test environment
  const origDoc = globalThis.document;
  const origWin = globalThis.window;
  globalThis.document = {
    createElement() { return { setAttribute() {}, appendChild() {} }; },
    head: { appendChild() {} },
    body: { appendChild() {} },
    contains() { return false; },
    getElementById() { return null; },
    documentElement: { getAttribute() { return null; } },
    querySelector() { return null; }
  };
  globalThis.window = {
    matchMedia() { return { matches: true }; }  // prefers-reduced-motion → short-circuit return
  };
  
  try {
    const listeners = {};
    const mockBus = {
      on(event, fn) {
        if (!listeners[event]) listeners[event] = [];
        listeners[event].push(fn);
      },
      emit(event, data) {
        if (listeners[event]) listeners[event].forEach(fn => fn(data));
      },
      off() {}
    };
    const game = { bus: mockBus, state: { player: { hp: 1, maxHp: 30 } } };
    
    const cleanup = installAnimations(game);
    assert.equal(typeof cleanup, 'function');
    
    // Verify combat:defeat listener was registered
    assert.ok(listeners['combat:defeat'], 'combat:defeat listener should be registered');
    assert.equal(listeners['combat:defeat'].length, 1);
    
    // Emit combat:defeat — screenShake returns early due to reduced-motion match
    assert.doesNotThrow(() => {
      listeners['combat:defeat'][0]({ reason: 'hp' });
    });
    
    cleanup();
  } finally {
    globalThis.document = origDoc;
    globalThis.window = origWin;
  }
});

test('effect helpers are functions and are DOM-guarded', () => {
  assert.equal(typeof damagePopup, 'function');
  assert.equal(typeof screenShake, 'function');
  assert.equal(typeof tweenMeter, 'function');
  assert.equal(typeof crossfadeScene, 'function');
  assert.equal(typeof enemyDeathFade, 'function');
  assert.equal(typeof injectAnimCSS, 'function');
  // Missing anchors/elements are ignored rather than throwing.
  assert.doesNotThrow(() => damagePopup(null, 10));
  assert.doesNotThrow(() => enemyDeathFade(null));
});
