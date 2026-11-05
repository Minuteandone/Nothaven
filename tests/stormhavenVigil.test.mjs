import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, SKILL_UNLOCKS, knownSkills, createCombat, heroAction, heroStats } from '../src/combat/rules.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const member = (id, name, extra = {}) => ({ id, name, level: 19, hp: 40, maxHp: 200, mp: 60, maxMp: 60, atk: 30, def: 10, spd: 5, statuses: [], equipment: {}, ...extra });

test('Stormhaven Vigil unlocks at level 19 as the last skill', () => {
  assert.equal(SKILL_UNLOCKS.stormhaven_vigil, 19);
  assert.equal(Object.keys(SKILL_UNLOCKS).at(-1), 'stormhaven_vigil');
  assert.ok(!knownSkills({ level: 18 }).some((s) => s.id === 'stormhaven_vigil'));
  assert.ok(knownSkills({ level: 19 }).some((s) => s.id === 'stormhaven_vigil'));
  assert.equal(SKILLS.stormhaven_vigil.kind, 'vigil');
  assert.equal(SKILLS.stormhaven_vigil.mp, 16);
  assertEggFree(`${SKILLS.stormhaven_vigil.name} ${SKILLS.stormhaven_vigil.description}`);
});

test('Stormhaven Vigil heals standing allies by 35% of max HP and clears bleeding and shock', () => {
  const hero = member('hero', 'Wren', { statuses: ['bleeding'] });
  const bram = member('bram', 'Bram', { hp: 190, statuses: ['shocked', 'bleeding'] });
  const fallen = member('iven', 'Iven', { hp: 0 });
  const c = createCombat({ enemyId: 'storm_rat' });
  c.heroTimers = { bleeding: 2 };
  c.allyTimers = { bram: { shocked: 1, bleeding: 2 } };
  const r = heroAction(c, hero, { type: 'skill', skillId: 'stormhaven_vigil' }, () => 0.5, [hero, bram, fallen]);
  assert.equal(r.ok, true);
  assert.equal(hero.mp, 44);
  const heal = Math.ceil(heroStats(hero).maxHp * 0.35);
  assert.equal(hero.hp, Math.min(heroStats(hero).maxHp, 40 + heal));
  assert.ok(r.lines.includes('Bram recovers 10 HP.'), 'healing is capped at max HP');
  assert.ok(!r.lines.some((l) => l.startsWith('Iven recovers')), 'fallen allies are skipped');
  assert.equal(fallen.hp, 0, 'the vigil does not revive');
  assert.deepEqual(hero.statuses, []);
  assert.deepEqual(bram.statuses, []);
  assert.equal(c.heroTimers.bleeding, undefined);
  assert.deepEqual(c.allyTimers.bram, {});
});

test('Stormhaven Vigil works while shocked but needs enough MP', () => {
  const hero = member('hero', 'Wren', { statuses: ['shocked'] });
  const c = createCombat({ enemyId: 'storm_heart' });
  assert.equal(heroAction(c, hero, { type: 'skill', skillId: 'stormhaven_vigil' }, () => 0.5, [hero]).ok, true);
  assert.ok(!hero.statuses.includes('shocked'));
  const tired = member('hero', 'Wren', { mp: 15 });
  const before = tired.hp;
  assert.equal(heroAction(createCombat({ enemyId: 'storm_heart' }), tired, { type: 'skill', skillId: 'stormhaven_vigil' }, () => 0.5, [tired]).ok, false);
  assert.equal(tired.mp, 15); assert.equal(tired.hp, before);
  const young = member('hero', 'Wren', { level: 18 });
  assert.equal(heroAction(createCombat({ enemyId: 'storm_heart' }), young, { type: 'skill', skillId: 'stormhaven_vigil' }, () => 0.5, [young]).ok, false);
});
