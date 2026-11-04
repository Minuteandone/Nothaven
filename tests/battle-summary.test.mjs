import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, heroAction, battleSummary, BEACON_CHARGE_MAX } from '../src/combat/rules.js';
import { createInitialState } from '../src/state.js';
import { summaryLine, renderCombat } from '../src/ui/combat.js';

test('battleSummary tracks rounds, damage both ways and Bursts', () => {
  const hero = createInitialState().party[0];
  hero.hp = 999; hero.maxHp = 999; hero.atk = 40;
  const c = createCombat({ enemyId: 'storm_heart' });
  assert.deepEqual(battleSummary(c), { rounds: 0, dealt: 0, taken: 0, bursts: 0 });
  const before = hero.hp;
  heroAction(c, hero, { type: 'attack' }, () => 0.5);
  c.charge = BEACON_CHARGE_MAX;
  heroAction(c, hero, { type: 'burst' }, () => 0.5);
  const sm = battleSummary(c);
  assert.equal(sm.rounds, 2);
  assert.equal(sm.bursts, 1);
  assert.equal(sm.dealt, c.enemy.maxHp - c.enemy.hp);
  assert.ok(sm.dealt > 0);
  assert.equal(sm.taken, before - hero.hp);
});

test('failed actions do not count as rounds; summary tolerates bare state', () => {
  const hero = createInitialState().party[0];
  const c = createCombat({ enemyId: 'storm_rat' });
  heroAction(c, hero, { type: 'burst' }, () => 0.5);
  assert.equal(battleSummary(c).rounds, 0);
  assert.deepEqual(battleSummary(null), { rounds: 0, dealt: 0, taken: 0, bursts: 0 });
});

test('summaryLine pluralises and only mentions Bursts when fired', () => {
  const one = summaryLine({ enemy: { hp: 0, maxHp: 12 }, stats: { rounds: 1, taken: 3, bursts: 0 } });
  assert.match(one, /1 round · 12 damage dealt · 3 damage taken/);
  assert.doesNotMatch(one, /Burst/);
  const two = summaryLine({ enemy: { hp: 0, maxHp: 50 }, stats: { rounds: 4, taken: 0, bursts: 2 } });
  assert.match(two, /4 rounds · 50 damage dealt · 0 damage taken · 2 Beacon Bursts/);
});
