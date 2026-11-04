import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, knownSkills, createCombat, heroAction, enemyTurn } from '../src/combat/rules.js';

const mkHero = (level) => ({ id: 'hero', name: 'Wren', hp: 200, maxHp: 200, mp: 40, maxMp: 40, atk: 20, def: 5, spd: 6, level, statuses: [], equipment: {} });
const mkAlly = () => ({ id: 'bram', name: 'Bram', hp: 200, maxHp: 200, mp: 4, maxMp: 4, atk: 6, def: 4, spd: 3, level: 9, statuses: [], equipment: {}, role: 'guardian' });

test('Beacon Aegis unlocks at level 9 and costs 8 MP', () => {
  assert.ok(!knownSkills({ level: 8 }).some((s) => s.id === 'beacon_aegis'));
  assert.ok(knownSkills({ level: 9 }).some((s) => s.id === 'beacon_aegis'));
  assert.equal(SKILLS.beacon_aegis.mp, 8);
  assert.equal(SKILLS.beacon_aegis.kind, 'party_ward');
});

test('Beacon Aegis halves damage to every party member for three enemy turns', () => {
  const rng = () => 0.99; // plain hits, deterministic target
  const plain = createCombat({ enemyId: 'stormcrown_tyrant' });
  const warded = createCombat({ enemyId: 'stormcrown_tyrant' });
  warded.aegisTurns = 3;
  const run = (c) => { const p = [mkHero(9), mkAlly()]; enemyTurn(c, p[0], rng, p); return p.reduce((n, m) => n + (200 - m.hp), 0); };
  const full = run(plain);
  const half = run(warded);
  assert.ok(full > 1);
  assert.equal(half, Math.max(1, Math.floor(full / 2)));
  assert.equal(warded.aegisTurns, 2);
});

test('casting Beacon Aegis spends MP and sets the ward', () => {
  const c = createCombat({ enemyId: 'ashen_raider' });
  const hero = mkHero(9);
  const res = heroAction(c, hero, { type: 'skill', skillId: 'beacon_aegis' }, () => 0.99, [hero]);
  assert.ok(res.ok !== false);
  assert.equal(hero.mp, 32);
  assert.ok(res.lines.some((l) => l.includes('Beacon Aegis')));
  assert.equal(c.aegisTurns, 2); // one enemy action already consumed a turn
});
