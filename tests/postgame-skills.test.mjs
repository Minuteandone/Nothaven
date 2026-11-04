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
