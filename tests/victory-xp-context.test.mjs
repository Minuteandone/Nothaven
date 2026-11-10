import test from 'node:test';
import assert from 'node:assert/strict';
import { xpContextLine } from '../src/ui/combat.js';
import { xpToNext, MAX_LEVEL } from '../src/core/progression.js';

test('xpContextLine returns empty string when combat is null/undefined', () => {
  assert.strictEqual(xpContextLine(null, { level: 1, xp: 0 }), '');
  assert.strictEqual(xpContextLine(undefined, { level: 1, xp: 0 }), '');
});

test('xpContextLine returns empty string when combat is not victory', () => {
  assert.strictEqual(xpContextLine({ over: 'active' }, { level: 1, xp: 0 }), '');
  assert.strictEqual(xpContextLine({ over: 'defeat' }, { level: 1, xp: 0 }), '');
  assert.strictEqual(xpContextLine({ over: 'fled' }, { level: 1, xp: 0 }), '');
});

test('xpContextLine returns empty string for drills', () => {
  assert.strictEqual(xpContextLine({ over: 'victory', drill: true }, { level: 1, xp: 0 }), '');
});

test('xpContextLine shows remaining XP to next level', () => {
  const hero = { level: 3, xp: 60 }; // Level 3, 60 XP
  const remaining = xpToNext(hero);
  const html = xpContextLine({ over: 'victory' }, hero);
  assert.ok(html.includes('XP to level 4'));
  assert.ok(html.includes(String(remaining)));
  assert.ok(html.includes('xp-context'));
});

test('xpContextLine shows max level message at level 20', () => {
  const hero = { level: 20, xp: 5000 };
  const html = xpContextLine({ over: 'victory' }, hero);
  assert.ok(html.includes('Level 20'));
  assert.ok(html.includes('maximum level reached'));
  assert.ok(!html.includes('XP to level'));
});

test('xpContextLine sanitizes missing hero data gracefully', () => {
  // Missing level/xp defaults to level 1, 0 XP
  const html = xpContextLine({ over: 'victory' }, {});
  assert.ok(html.includes('XP to level 2'));
});

test('xpContextLine handles non-finite level and xp values', () => {
  const html = xpContextLine({ over: 'victory' }, { level: null, xp: undefined });
  assert.ok(html.includes('XP to level 2')); // defaults to level 1, 0 XP -> level 2
});

test('xpContextLine in victory outcome (smoke)', () => {
  // When combat is over with victory, xpContextLine is called via the commands() template
  // Verify it produces valid HTML with the xp-context class
  const hero = { level: 3, xp: 60 };
  const html = xpContextLine({ over: 'victory' }, hero);
  assert.ok(html.includes('xp-context'));
  assert.ok(html.includes('XP to level'));
  assert.ok(!html.includes('undefined'));
  assert.ok(!html.includes('NaN'));
});


test('xpContextLine output is egg-free', () => {
  const hero = { level: 5, xp: 200 };
  const html = xpContextLine({ over: 'victory' }, hero);
  // No egg words or emoji
  assert.ok(!html.includes('egg'));
  // (unicode escape assertion not needed — JS strings can't contain raw '\u' literal)
  assert.doesNotMatch(html, /\u[0-9a-fA-F]{4}/);
  assert.ok(!html.includes('&#x'));
});

test('xpContextLine when hero is exactly at level-up threshold shows correct next level', () => {
  // Level 5 threshold: xpForLevel(5) = floor(10*4*5*0.75) = floor(150) = 150
  // xpForLevel(6) = floor(10*5*6*0.75) = floor(225) = 225
  // At exactly 150 XP, level 5, remaining = 225-150 = 75 to level 6
  const hero = { level: 5, xp: 150 };
  const remaining = xpToNext(hero);
  const html = xpContextLine({ over: 'victory' }, hero);
  assert.ok(html.includes(String(remaining)));
  assert.ok(html.includes('XP to level 6'));
});
