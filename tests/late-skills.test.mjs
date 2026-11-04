import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, knownSkills, createCombat, heroAction } from '../src/combat/rules.js';

const mkHero = (level, extra = {}) => ({ id: 'hero', name: 'Wren', hp: 60, maxHp: 60, mp: 30, maxMp: 30, atk: 20, def: 5, spd: 6, level, statuses: [], equipment: {}, ...extra });

test('late skills unlock at levels 6 and 7', () => {
  assert.ok(!knownSkills({ level: 5 }).some((s) => s.id === 'steady_signal'));
  assert.ok(knownSkills({ level: 6 }).some((s) => s.id === 'steady_signal'));
  assert.ok(!knownSkills({ level: 6 }).some((s) => s.id === 'beacon_lance'));
  assert.ok(knownSkills({ level: 7 }).some((s) => s.id === 'beacon_lance'));
});

test('Beacon Lance ignores enemy defence', () => {
  const c = createCombat({ enemyId: 'relay_warden' });
  const hero = mkHero(7);
  const before = c.enemy.hp;
  const res = heroAction(c, hero, { type: 'skill', skillId: 'beacon_lance' }, () => 0, [hero]);
  assert.ok(res.ok !== false);
  assert.equal(before - c.enemy.hp, Math.floor(20 * SKILLS.beacon_lance.mult) - 1);
  assert.equal(hero.mp, 30 - SKILLS.beacon_lance.mp);
});

test('Steady Signal works while shocked and clears party statuses', () => {
  const c = createCombat({ enemyId: 'relay_warden' });
  const hero = mkHero(6, { statuses: ['shocked', 'bleeding'] });
  const ally = { id: 'iven', name: 'Iven', hp: 20, maxHp: 20, mp: 14, maxMp: 14, atk: 4, def: 2, spd: 4, level: 6, statuses: ['shocked'], equipment: {} };
  c.heroTimers = { shocked: 2, bleeding: 2 };
  const res = heroAction(c, hero, { type: 'skill', skillId: 'steady_signal' }, () => 0.99, [hero, ally]);
  assert.ok(res.ok !== false);
  assert.ok(!hero.statuses.includes('bleeding'));
  assert.ok((res.lines || []).some((l) => /Steady Signal/.test(l)));
  assert.ok(!c.heroTimers.bleeding);
});
