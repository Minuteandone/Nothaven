import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, heroAction, battleSummary, BEACON_CHARGE_MAX } from '../src/combat/rules.js';
import { createInitialState } from '../src/state.js';
import { summaryLine, renderCombat } from '../src/ui/combat.js';

test('battleSummary tracks rounds, damage both ways and Bursts', () => {
  const hero = createInitialState().party[0];
  hero.hp = 999; hero.maxHp = 999; hero.atk = 40;
  const c = createCombat({ enemyId: 'storm_heart' });
  const sm0 = battleSummary(c);
  assert.equal(sm0.rounds, 0);
  assert.equal(sm0.dealt, 0);
  assert.equal(sm0.taken, 0);
  assert.equal(sm0.bursts, 0);
  assert.equal(typeof sm0.companionDamage, 'object');
  assert.equal(Object.keys(sm0.companionDamage).length, 0);
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
  const smNull = battleSummary(null);
  assert.equal(smNull.rounds, 0);
  assert.equal(smNull.dealt, 0);
  assert.equal(smNull.taken, 0);
  assert.equal(smNull.bursts, 0);
  assert.equal(typeof smNull.companionDamage, 'object');
  assert.equal(Object.keys(smNull.companionDamage).length, 0);
});

test('summaryLine pluralises and only mentions Bursts when fired', () => {
  const one = summaryLine({ enemy: { hp: 0, maxHp: 12 }, stats: { rounds: 1, taken: 3, bursts: 0 } });
  assert.match(one, /1 round · 12 damage dealt · 3 damage taken/);
  assert.doesNotMatch(one, /Burst/);
  const two = summaryLine({ enemy: { hp: 0, maxHp: 50 }, stats: { rounds: 4, taken: 0, bursts: 2 } });
  assert.match(two, /4 rounds · 50 damage dealt · 0 damage taken · 2 Beacon Bursts/);
});

test('damage taken counts only HP actually lost (overkill on a 1-HP ally)', async () => {
  const { createCompanionMember } = await import('../src/party/companions.js');
  for (const r of [0.01, 0.3, 0.5, 0.7, 0.99]) {
    const hero = createInitialState().party[0];
    hero.hp = 999; hero.maxHp = 999;
    const ally = createCompanionMember('bram', 1);
    ally.hp = 1;
    const party = [hero, ally];
    const c = createCombat({ enemyId: 'storm_heart' });
    const before = hero.hp + ally.hp;
    heroAction(c, hero, { type: 'defend' }, () => r, party);
    assert.equal(battleSummary(c).taken, before - (hero.hp + ally.hp), `rng ${r}`);
  }
});

test('damage taken caps at the hero’s remaining HP on a fatal hit', () => {
  const hero = createInitialState().party[0];
  hero.hp = 1;
  const c = createCombat({ enemyId: 'storm_heart' });
  heroAction(c, hero, { type: 'attack' }, () => 0.5);
  assert.equal(hero.hp, 0);
  assert.equal(battleSummary(c).taken, 1);
});


test('summaryLine separates Wren and companion shares using actual HP removed in a real turn', () => {
  const hero = createInitialState().party[0];
  hero.hp = 999; hero.maxHp = 999; hero.atk = 18;
  const bram = { id: 'bram', name: 'Bram', hp: 80, maxHp: 80, mp: 10, atk: 12, def: 8, spd: 6, level: 3, role: 'guardian' };
  const party = [hero, bram];
  const c = createCombat({ enemyId: 'storm_heart' });
  const startingHp = c.enemy.hp;
  const result = heroAction(c, hero, { type: 'attack' }, () => 0.99, party);
  assert.equal(result.ok, true);
  const sm = battleSummary(c);
  assert.ok(sm.companionDamage.bram > 0, 'the real companion turn dealt damage');
  const wrenShare = sm.dealt - sm.companionDamage.bram;
  assert.ok(wrenShare > 0, 'the real hero action dealt damage');
  assert.equal(sm.dealt, startingHp - c.enemy.hp);
  const line = summaryLine(c, party);
  assert.match(line, new RegExp(`Wren: ${wrenShare} · Companions: Bram: ${sm.companionDamage.bram}`));
  assert.equal(wrenShare + sm.companionDamage.bram, sm.dealt);
});

test('summaryLine shows a zero Wren share for companion-only damage and omits the share without companions', () => {
  const companionOnly = summaryLine({
    enemy: { hp: 50, maxHp: 100 },
    stats: { rounds: 3, taken: 12, bursts: 0, companionDamage: Object.assign(Object.create(null), { bram: 32, tamsin: 18 }) },
  }, [{ id: 'bram', name: 'Bram' }, { id: 'tamsin', name: 'Tamsin' }]);
  assert.match(companionOnly, /Wren: 0 · Companions: Bram: 32, Tamsin: 18/);
  const solo = summaryLine({ enemy: { hp: 0, maxHp: 12 }, stats: { rounds: 1, taken: 3, bursts: 0 } });
  assert.doesNotMatch(solo, /Wren:|Companions:/);
});

test('summaryLine caps Wren’s share at zero for inconsistent imported statistics', () => {
  const line = summaryLine({
    enemy: { hp: 90, maxHp: 100 },
    stats: { rounds: 1, taken: 0, bursts: 0, companionDamage: Object.assign(Object.create(null), { bram: 12 }) },
  }, [{ id: 'bram', name: 'Bram' }]);
  assert.match(line, /10 damage dealt · 0 damage taken · Wren: 0 · Companions: Bram: 12/);
});
