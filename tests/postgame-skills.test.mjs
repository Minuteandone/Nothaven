import test from 'node:test';
import assert from 'node:assert/strict';
import { SKILLS, knownSkills, createCombat, heroAction } from '../src/combat/rules.js';

const ids = (lvl) => knownSkills({ level: lvl }).map((s) => s.id);

test('postgame skills unlock at levels 11 and 13', () => {
  assert.ok(!ids(10).includes('signal_flare'));
  assert.ok(ids(11).includes('signal_flare'));
  assert.ok(!ids(12).includes('tempest_cleave'));
  assert.ok(ids(13).includes('tempest_cleave'));
  assert.equal(SKILLS.signal_flare.kind, 'magic');
  assert.equal(SKILLS.tempest_cleave.kind, 'damage');
});

test('Signal Flare ignores armour and is stronger against constructs', () => {
  const hero = () => ({ id: 'hero', name: 'Wren', level: 11, hp: 200, maxHp: 200, mp: 40, maxMp: 40, atk: 20, def: 10, spd: 5, statuses: [], equipment: {} });
  const rng = () => 0;
  const c1 = createCombat({ enemyId: 'tempest_shade' });
  const h1 = hero();
  const before1 = c1.enemy.hp;
  assert.ok(heroAction(c1, h1, { type: 'skill', skillId: 'signal_flare' }, rng).ok);
  assert.equal(h1.mp, 32);
  assert.equal(before1 - c1.enemy.hp, 20 + 22);
  const c2 = createCombat({ enemyId: 'thunderhead_colossus' });
  const before2 = c2.enemy.hp;
  heroAction(c2, hero(), { type: 'skill', skillId: 'signal_flare' }, rng);
  assert.equal(before2 - c2.enemy.hp, Math.floor(42 * 1.5));
});

test('Tempest Cleave hits harder than Stormbreaker', () => {
  const hero = { id: 'hero', name: 'Wren', level: 13, hp: 200, maxHp: 200, mp: 40, maxMp: 40, atk: 30, def: 10, spd: 5, statuses: [], equipment: {} };
  const rng = () => 0.5;
  const c = createCombat({ enemyId: 'storm_heart' });
  const before = c.enemy.hp;
  assert.ok(heroAction(c, hero, { type: 'skill', skillId: 'tempest_cleave' }, rng).ok);
  assert.equal(hero.mp, 29);
  assert.ok(before - c.enemy.hp > Math.floor(30 * 2.2) - c.enemy.def + 2);
});

test('Rekindle (L15) revives fallen allies and Skyfire Lance (L17) pierces armour', async () => {
  const { SKILLS, SKILL_UNLOCKS, knownSkills, heroAction, createCombat } = await import('../src/combat/rules.js');
  const ids = lvl => knownSkills({ level: lvl }).map(s => s.id);
  assert.equal(SKILL_UNLOCKS.rekindle, 15); assert.equal(SKILL_UNLOCKS.skyfire_lance, 17);
  assert.ok(!ids(14).includes('rekindle')); assert.ok(ids(15).includes('rekindle'));
  assert.ok(!ids(16).includes('skyfire_lance')); assert.ok(ids(17).includes('skyfire_lance'));
  const mk = () => {
    const hero = { id: 'hero', name: 'Wren', level: 17, hp: 200, maxHp: 200, mp: 60, maxMp: 60, atk: 30, def: 10, spd: 5, statuses: [], equipment: {} };
    const ally = { id: 'bram', name: 'Bram', level: 17, hp: 0, maxHp: 101, mp: 4, maxMp: 4, atk: 10, def: 4, spd: 3, statuses: ['bleeding'], equipment: {} };
    const c = createCombat({ enemyId: 'storm_heart' });
    return { hero, ally, c };
  };
  const rng = () => 0.99;
  let { hero, ally, c } = mk();
  const live = { ...ally, hp: 50, statuses: [] };
  const refused = heroAction(c, hero, { type: 'skill', skillId: 'rekindle' }, rng, [hero, live]);
  assert.equal(refused.ok, false); assert.equal(hero.mp, 60, 'no MP spent when nobody is down');
  ({ hero, ally, c } = mk());
  const r = heroAction(c, hero, { type: 'skill', skillId: 'rekindle' }, rng, [hero, ally]);
  assert.notEqual(r.ok, false);
  assert.ok(ally.hp > 0, 'ally is back on their feet');
  assert.ok(r.lines.some(l => /Bram rises with \d+ HP/.test(l)));
  assert.equal(hero.mp, 60 - SKILLS.rekindle.mp);
  ({ hero, ally, c } = mk());
  const before = c.enemy.hp;
  heroAction(c, hero, { type: 'skill', skillId: 'skyfire_lance' }, () => 0.5, [hero]);
  assert.ok(before - c.enemy.hp >= Math.floor(30 * 2.6) - 1, 'lance ignores the enemy defence');
  const EGG = /\b(eggs?|yolks?|shells?|hatch\w*|nests?|chicks?|hens?|omelet\w*|scrambl\w*|poach\w*|fried|easter|oval|boil\w*|crack\w*|golden|birds?|feathers?)\b/i;
  for (const id of ['rekindle', 'skyfire_lance']) assert.doesNotMatch(`${SKILLS[id].name} ${SKILLS[id].description}`, EGG);
});
