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
  const dealt = Number(r.lines.find((l) => /finds the stillpoint/.test(l)).match(/for (\d+)!/)[1]);
  assert.equal(dealt, Math.floor(heroStats(hero).atk * 2) + 1, 'armour is ignored; rng 0.5 gives +1 variance');
  assert.ok(before - c.enemy.hp >= dealt, 'the strike lands in full');
  assert.equal(c.windup, null);
  assert.ok(r.lines.some((l) => /Gathering Vortex scatters before it can land!/.test(l)));
});

test('a broken windup is not released on the foe’s next turn', () => {
  const hero = member();
  const c = createCombat({ enemyId: 'storm_heart' });
  c.windup = { name: c.enemy.windup.name };
  // heroAction already runs the foe’s immediate reply; it must not release the broken blow.
  const r = heroAction(c, hero, { type: 'skill', skillId: 'stillpoint_strike' }, () => 0.99, [hero]);
  assert.equal(r.ok, true);
  assert.doesNotMatch(r.lines.join(' '), /unleashes/);
  assert.equal(c.windup, null);
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
