import test from 'node:test';
import assert from 'node:assert/strict';
import { incomingDamagePreview } from '../src/combat/damagePreview.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

// Hero skeleton used by tests — only what heroStats/def logic needs
function makeHero(level = 10) {
  return { level, hp: 120, maxHp: 120, atk: 18, def: 8, spd: 10, maxMp: 30, mp: 30 };
}

function makeCombat(overrides = {}) {
  return {
    enemy: { name: 'Test Foe', atk: 14, hp: 80, maxHp: 80, def: 6, element: 'fire' },
    defending: false,
    wardTurns: 0,
    aegisTurns: 0,
    windup: null,
    over: false,
    turn: 1,
    log: [],
    ...overrides,
  };
}

test('incomingDamagePreview returns null for missing combat', () => {
  assert.equal(incomingDamagePreview(null, makeHero()), null);
});

test('incomingDamagePreview returns null for missing hero', () => {
  assert.equal(incomingDamagePreview(makeCombat(), null), null);
});

test('incomingDamagePreview returns null when enemy has no atk', () => {
  const c = makeCombat({ enemy: { name: 'Ghost', hp: 1, maxHp: 10, def: 0 } });
  assert.equal(incomingDamagePreview(c, makeHero()), null);
});

test('incomingDamagePreview returns null when enemy is dead', () => {
  const c = makeCombat({ enemy: { name: 'Dead', atk: 10, hp: 0, maxHp: 50, def: 5 } });
  assert.equal(incomingDamagePreview(c, makeHero()), null);
});

test('incomingDamagePreview basic attack range (no windup, no ward)', () => {
  const hero = makeHero(10);  // def=8
  const c = makeCombat();     // enemy atk=14
  const result = incomingDamagePreview(c, hero);
  assert.ok(result, 'should return a preview object');
  // base = floor(14*1) - 8 = 6; min = max(1, 6-1) = 5; max = max(1, 6+2) = 8
  assert.equal(result.min, 5);
  assert.equal(result.max, 8);
  assert.equal(result.warded, false);
  assert.equal(result.windupName, null);
});

test('incomingDamagePreview with defending hero halves damage', () => {
  const hero = makeHero(10);
  const c = makeCombat({ defending: true });
  const result = incomingDamagePreview(c, hero);
  assert.ok(result);
  assert.equal(result.warded, true);
  // raw: 5-8, halved: floor(5/2)=2, floor(8/2)=4
  assert.equal(result.min, 2);
  assert.equal(result.max, 4);
});

test('incomingDamagePreview with wardTurns > 0 halves damage', () => {
  const hero = makeHero(10);
  const c = makeCombat({ wardTurns: 2 });
  const result = incomingDamagePreview(c, hero);
  assert.ok(result);
  assert.equal(result.warded, true);
  assert.equal(result.min, 2);
  assert.equal(result.max, 4);
});

test('incomingDamagePreview with aegisTurns > 0 halves damage', () => {
  const hero = makeHero(10);
  const c = makeCombat({ aegisTurns: 3 });
  const result = incomingDamagePreview(c, hero);
  assert.ok(result);
  assert.equal(result.warded, true);
  assert.equal(result.min, 2);
  assert.equal(result.max, 4);
});

test('incomingDamagePreview during windup uses windup multiplier', () => {
  const hero = makeHero(10);
  const enemy = { name: 'Boss', atk: 20, hp: 200, maxHp: 200, def: 12, element: 'ice', windup: { name: 'Crush', mult: 2.5, chance: 0.4 } };
  const c = makeCombat({ enemy, windup: { name: 'Crush' } });
  const result = incomingDamagePreview(c, hero);
  assert.ok(result);
  assert.equal(result.windupName, 'Crush');
  // base = floor(20*2.5) - 8 = 50 - 8 = 42; min = 41, max = 44
  assert.equal(result.min, 41);
  assert.equal(result.max, 44);
  assert.equal(result.warded, false);
});

test('incomingDamagePreview during windup with ward halves the big hit', () => {
  const hero = makeHero(10);
  const enemy = { name: 'Boss', atk: 20, hp: 200, maxHp: 200, def: 12, element: 'ice', windup: { name: 'Crush', mult: 2.5, chance: 0.4 } };
  const c = makeCombat({ enemy, windup: { name: 'Crush' }, wardTurns: 1 });
  const result = incomingDamagePreview(c, hero);
  assert.ok(result);
  assert.equal(result.warded, true);
  // raw: 41-44, halved: floor(41/2)=20, floor(44/2)=22
  assert.equal(result.min, 20);
  assert.equal(result.max, 22);
});

test('incomingDamagePreview windup defaults to 2x when no mult specified', () => {
  const hero = makeHero(10);
  const enemy = { name: 'Boss', atk: 15, hp: 200, maxHp: 200, def: 12, element: 'fire', windup: { name: 'Slam', chance: 0.3 } };
  const c = makeCombat({ enemy, windup: { name: 'Slam' } });
  const result = incomingDamagePreview(c, hero);
  assert.ok(result);
  // base = floor(15*2) - 8 = 22; min = 21, max = 24
  assert.equal(result.min, 21);
  assert.equal(result.max, 24);
});

test('incomingDamagePreview min damage clamped to 1', () => {
  const hero = makeHero(10); // def=8
  const c = makeCombat({ enemy: { name: 'Weakling', atk: 2, hp: 10, maxHp: 10, def: 0, element: null } });
  const result = incomingDamagePreview(c, hero);
  assert.ok(result);
  // base = floor(2*1) - 8 = -6; min = max(1, -7) = 1; max = max(1, -4) = 1
  assert.equal(result.min, 1);
  assert.equal(result.max, 1);
});

test('incomingDamagePreview is egg-free', () => {
  const hero = makeHero(20);
  const c = makeCombat();
  const result = incomingDamagePreview(c, hero);
  assert.ok(result);
  assertEggFree(JSON.stringify(result), 'incomingDamagePreview result');
});
