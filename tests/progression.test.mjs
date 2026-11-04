import test from 'node:test';
import assert from 'node:assert/strict';
import { applyLevelUps, xpForLevel, xpToNext } from '../src/core/progression.js';

test('thresholds increase', () => {
  assert.equal(xpForLevel(1), 0);
  assert.ok(xpForLevel(3) > xpForLevel(2));
});
test('levels up and heals, possibly multiple times', () => {
  const m = { name: 'W', level: 1, xp: xpForLevel(3), hp: 1, maxHp: 30, mp: 0, maxMp: 10, atk: 6, def: 3, spd: 5 };
  const log = applyLevelUps(m);
  assert.equal(m.level, 3); assert.equal(log.length, 2);
  assert.equal(m.hp, m.maxHp); assert.equal(m.maxHp, 42);
});
test('no level up below threshold', () => {
  const m = { name: 'W', level: 1, xp: 1, hp: 5, maxHp: 30, mp: 0, maxMp: 10, atk: 6, def: 3, spd: 5 };
  assert.deepEqual(applyLevelUps(m), []); assert.equal(xpToNext(m), xpForLevel(2) - 1);
});
