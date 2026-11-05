import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, SKILL_UNLOCKS, knownSkills, createCombat, heroAction, heroStats, enemyTurn } from '../src/combat/rules.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const member = (extra = {}) => ({ id: 'hero', name: 'Wren', level: 20, hp: 150, maxHp: 150, mp: 60, maxMp: 60, atk: 40, def: 10, spd: 5, statuses: [], equipment: {}, ...extra });

test('Stillpoint Strike is the level-20 capstone and the last unlock', () => {
  assert.equal(SKILL_UNLOCKS.stillpoint_strike, 20);
  assert.equal(Object.keys(SKILL_UNLOCKS).at(-1), 'stillpoint_strike');
  assert.equal(Object.keys(SKILL_UNLOCKS).length, 15);
  assert.ok(!knownSkills({ level: 19 }).some((s) => s.id === 'stillpoint_strike'));
  assert.ok(knownSkills({ level: 20 }).some((s) => s.id === 'stillpoint_strike'));
  assert.equal(SKILLS.stillpoint_strike.kind, 'break');
  assert.equal(SKILLS.stillpoint_strike.mp, 13);
  assertEggFree(`${SKILLS.stillpoint_strike.name} ${SKILLS.stillpoint_strike.description}`);
});

test('Stillpoint Strike ignores armour and breaks a gathered windup', () => {
  const hero = member();
  const c = createCombat({ enemyId: 'storm_heart' });
  c.windup = { name: c.enemy.windup.name };
  const before = c.enemy.hp;
  const r = heroAction(c, hero, { type: 'skill', skillId: 'stillpoint_strike' }, () => 0.5, [hero]);
  assert.equal(r.ok, true);
  assert.equal(hero.mp, 47);
  const expected = Math.floor(heroStats(hero).atk * 2) + 0; // randInt(-1..2) at 0.5 → 0 or +1
  assert.ok(before - c.enemy.hp >= expected - 1 && before - c.enemy.hp <= expected + 2, 'armour is ignored');
  assert.equal(c.windup, null);
  assert.ok(r.lines.some((l) => /Gathering Vortex scatters!/.test(l)));
});

test('a broken windup is not released on the foe’s next turn', () => {
  const hero = member();
  const c = createCombat({ enemyId: 'storm_heart' });
  c.windup = { name: c.enemy.windup.name };
  heroAction(c, hero, { type: 'skill', skillId: 'stillpoint_strike' }, () => 0.5, [hero]);
  assert.doesNotMatch(enemyTurn(c, hero, () => 0.99, [hero]).join(' '), /unleashes/);
  // Control: an unbroken windup does land.
  const c2 = createCombat({ enemyId: 'storm_heart' });
  c2.windup = { name: c2.enemy.windup.name };
  assert.match(enemyTurn(c2, member(), () => 0.99, [member()]).join(' '), /unleashes Gathering Vortex/);
});

test('Stillpoint Strike without a windup just strikes, and works while shocked', () => {
  const hero = member({ statuses: ['shocked'] });
  const c = createCombat({ enemyId: 'storm_heart' });
  const r = heroAction(c, hero, { type: 'skill', skillId: 'stillpoint_strike' }, () => 0.5, [hero]);
  assert.equal(r.ok, true);
  assert.ok(!r.lines.some((l) => /scatters/.test(l)));
  const tired = member({ mp: 12 });
  assert.equal(heroAction(createCombat({ enemyId: 'storm_heart' }), tired, { type: 'skill', skillId: 'stillpoint_strike' }, () => 0.5, [tired]).ok, false);
  assert.equal(tired.mp, 12);
  const young = member({ level: 19 });
  assert.equal(heroAction(createCombat({ enemyId: 'storm_heart' }), young, { type: 'skill', skillId: 'stillpoint_strike' }, () => 0.5, [young]).ok, false);
});
