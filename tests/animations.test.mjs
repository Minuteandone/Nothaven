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
