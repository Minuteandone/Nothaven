import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, companionTurn, battleSummary } from '../src/combat/rules.js';
import { summaryLine } from '../src/ui/combat.js';
import { createInitialState } from '../src/state.js';

function fixed(r) { return () => r; }

test('companionTurn records damage per companion in battleSummary', () => {
  const hero = createInitialState().party[0];
  hero.hp = 999; hero.maxHp = 999;
  const c = createCombat({ enemyId: 'storm_rat' });
  const e = c.enemy;
  // Simulate a guardian landing a Shield Bash — rng < 0.25 triggers guardian branch
  const bram = { id: 'bram', name: 'Bram', hp: 30, maxHp: 30, mp: 10, atk: 12, def: 8, spd: 6, level: 3, role: 'guardian' };
  const lines = companionTurn(c, bram, [hero, bram], fixed(0.1));
  assert.ok(lines.length > 0 && lines[0].includes('Bram'), 'guardian should act');
  const sm = battleSummary(c);
  assert.ok(sm.companionDamage.bram > 0, 'bram damage recorded');
  assert.equal(sm.dealt, sm.companionDamage.bram, 'all dealt damage came from bram');
});

test('companionDamage object is never mutated through battleSummary return value', () => {
  const c = createCombat({ enemyId: 'storm_rat' });
  const sm1 = battleSummary(c);
  sm1.companionDamage.hacker = 999;
  const sm2 = battleSummary(c);
  assert.equal(Object.prototype.hasOwnProperty.call(sm2.companionDamage, 'hacker'), false, 'returned object is a copy');
});

test('battleSummary(null) returns empty companionDamage', () => {
  const cd = battleSummary(null).companionDamage;
  assert.equal(typeof cd, 'object');
  assert.equal(Object.keys(cd).length, 0);
});

test('companionDamage is a null-prototype plain object', () => {
  const c = createCombat({ enemyId: 'storm_rat' });
  const sm = battleSummary(c);
  assert.equal(Object.getPrototypeOf(sm.companionDamage), null);
  const ownKeys = Object.keys(sm.companionDamage);
  assert.deepEqual(ownKeys, []);
});

test('summaryLine includes companion breakdown when companions dealt damage', () => {
  const c = createCombat({ enemyId: 'storm_rat' });
  c.enemy.hp = 50; c.enemy.maxHp = 100;
  c.stats = { rounds: 3, taken: 12, bursts: 0, companionDamage: Object.assign(Object.create(null), { bram: 32, tamsin: 18 }) };
  const line = summaryLine(c, [{ id: 'bram', name: 'Bram' }, { id: 'tamsin', name: 'Tamsin' }]);
  assert.match(line, /3 rounds · 50 damage dealt · 12 damage taken/);
  assert.match(line, /Companions: Bram: 32, Tamsin: 18/);
});

test('summaryLine omits companion breakdown when empty', () => {
  const line = summaryLine({ enemy: { hp: 0, maxHp: 12 }, stats: { rounds: 1, taken: 3, bursts: 0, companionDamage: Object.create(null) } }, []);
  assert.doesNotMatch(line, /Companions/);
});

test('summaryLine companion list is sorted by damage descending', () => {
  const c = createCombat({ enemyId: 'storm_rat' });
  c.enemy.hp = 30; c.enemy.maxHp = 100;
  c.stats = { rounds: 2, taken: 5, bursts: 0, companionDamage: Object.assign(Object.create(null), { tamsin: 20, bram: 50 }) };
  const line = summaryLine(c, [{ id: 'bram', name: 'Bram' }, { id: 'tamsin', name: 'Tamsin' }]);
  const idxBram = line.indexOf('Bram: 50');
  const idxTamsin = line.indexOf('Tamsin: 20');
  assert.ok(idxBram > 0 && idxTamsin > 0, 'both companions present');
  assert.ok(idxBram < idxTamsin, 'Bram (50 dmg) comes before Tamsin (20 dmg)');
});

test('summaryLine falls back to raw id when companion not in party', () => {
  const c = createCombat({ enemyId: 'storm_rat' });
  c.enemy.hp = 50; c.enemy.maxHp = 100;
  c.stats = { rounds: 1, taken: 0, bursts: 0, companionDamage: Object.assign(Object.create(null), { unknown: 10 }) };
  const line = summaryLine(c, []);
  assert.match(line, /Companions: unknown: 10/);
});

test('companionTurn does not track damage for dead companions', () => {
  const hero = createInitialState().party[0];
  hero.hp = 999; hero.maxHp = 999;
  const c = createCombat({ enemyId: 'storm_rat' });
  const dead = { id: 'ghost', name: 'Ghost', hp: 0, maxHp: 1, mp: 0, atk: 5, def: 3, spd: 4, level: 1, role: 'scout' };
  const lines = companionTurn(c, dead, [hero, dead], fixed(0.1));
  assert.deepEqual(lines, []);
  const sm = battleSummary(c);
  assert.equal(Object.prototype.hasOwnProperty.call(sm.companionDamage, 'ghost'), false, 'no damage tracked for KO companion');
});

test('companionTurn caps damage at remaining foe HP (no overkill inflation)', () => {
  const hero = createInitialState().party[0];
  hero.hp = 999; hero.maxHp = 999;
  const c = createCombat({ enemyId: 'storm_rat' });
  // storm_rat starts with some HP. Set it to 1 so any hit would be overkill.
  c.enemy.hp = 1; c.enemy.maxHp = 1;
  // Give Bram very high ATK so physicalDamage returns a large number
  const bram = { id: 'bram', name: 'Bram', hp: 30, maxHp: 30, mp: 10, atk: 40, def: 8, spd: 6, level: 3, role: 'guardian' };
  // rng < 0.25 triggers Guardian Shield Bash
  companionTurn(c, bram, [hero, bram], fixed(0.1));
  assert.equal(c.enemy.hp, 0, 'foe should be dead after overkill hit');
  const sm = battleSummary(c);
  // companionDamage should be exactly 1 (the actual HP removed), not the full rolled damage
  assert.equal(sm.companionDamage.bram, 1, `companion damage capped at 1, got ${sm.companionDamage.bram}`);
  assert.equal(sm.dealt, 1, 'total dealt should also be 1');
});

test('overkill capping works with default basic strike', () => {
  const hero = createInitialState().party[0];
  hero.hp = 999; hero.maxHp = 999;
  const c = createCombat({ enemyId: 'storm_rat' });
  c.enemy.hp = 1; c.enemy.maxHp = 1;
  // rng 0.99 is too high for any special, falls through to default strike
  const bram = { id: 'bram', name: 'Bram', hp: 30, maxHp: 30, mp: 10, atk: 40, def: 8, spd: 6, level: 3, role: 'guardian' };
  companionTurn(c, bram, [hero, bram], fixed(0.99));
  assert.equal(c.enemy.hp, 0, 'foe should be dead');
  const sm = battleSummary(c);
  assert.equal(sm.companionDamage.bram, 1, `default-strike capped at 1, got ${sm.companionDamage.bram}`);
});
