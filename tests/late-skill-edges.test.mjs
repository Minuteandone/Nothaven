import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, heroAction, heroStats } from '../src/combat/rules.js';

// Synthetic rules fixtures: stun isolates restoration from the enemy reply.
const member = (id, hp = 0) => ({
  id, name: id, level: 17, hp, maxHp: 101, mp: 30, maxMp: 60,
  atk: 30, def: 10, spd: 5, statuses: ['bleeding', 'shocked'],
  equipment: { weapon: null, armor: 'maelstrom_plate', trinket: 'heartward_charm' },
});
function setup() {
  const hero = { ...member('hero', 101), statuses: [], mp: 60 };
  const a = member('bram'), b = member('sela');
  const c = createCombat({ enemyId: 'last_squall' });
  c.enemy.statuses = ['stunned'];
  c.allyTimers = { bram: { bleeding: 3, shocked: 4 }, sela: { bleeding: 2, shocked: 5 } };
  return { hero, a, b, c, party: [hero, a, b] };
}
const cast = (s, id = 'rekindle') => heroAction(s.c, s.hero, { type: 'skill', skillId: id }, () => 0.5, s.party);

test('Rekindle restores both fallen allies using effective HP and clears all their conditions/timers', () => {
  const s = setup(), result = cast(s);
  assert.equal(result.ok, true);
  for (const m of [s.a, s.b]) {
    assert.equal(heroStats(m).maxHp, 127);
    assert.equal(m.hp, Math.ceil(heroStats(m).maxHp * 0.4));
    assert.equal(m.hp, 51);
    assert.deepEqual(m.statuses, []);
    assert.equal(s.c.allyTimers[m.id], undefined);
    assert.equal(m.mp, 30, 'revival does not refill MP');
    assert.ok(result.lines.some(line => line.startsWith(`${m.name} strikes for `)), 'revived ally acts this round');
  }
  assert.equal(s.hero.mp, 48);
  assert.equal(s.c.charge, 15);
  assert.equal(s.c.stats.rounds, 1);
  assert.equal(s.c.turn, 2);
});

test('Rekindle leaves a standing ally unchanged apart from ordinary round effects', () => {
  const s = setup();
  s.b.hp = 80; s.b.statuses = ['shocked']; s.c.allyTimers.sela = { shocked: 3 };
  assert.equal(cast(s).ok, true);
  assert.equal(s.b.hp, 80); assert.equal(s.b.mp, 30);
  assert.deepEqual(s.b.statuses, ['shocked']);
  assert.deepEqual(s.c.allyTimers.sela, { shocked: 2 });
  assert.equal(s.a.hp, 51); assert.deepEqual(s.a.statuses, []);
});

for (const [label, mutate] of [
  ['nobody fallen', s => { s.a.hp = 80; s.b.hp = 80; }],
  ['below level 15', s => { s.hero.level = 14; }],
  ['insufficient MP', s => { s.hero.mp = 11; }],
  ['Wren shocked', s => { s.hero.statuses = ['shocked']; s.c.heroTimers.shocked = 3; }],
]) {
  test(`Rekindle refusal is state-atomic: ${label}`, () => {
    const s = setup(); mutate(s);
    const before = structuredClone(s);
    assert.equal(cast(s).ok, false);
    assert.deepEqual(s, before, 'no MP, charge, turns, HP, statuses, timers or enemy changes');
  });
}

test('Skyfire uses effective attack, ignores armour and remains usable while shocked', () => {
  for (const def of [0, 999]) {
    const s = setup(); s.party = [s.hero];
    s.hero.equipment.weapon = 'tempest_edge';
    s.hero.statuses = ['shocked']; s.c.heroTimers.shocked = 3; s.c.enemy.def = def;
    const hp = s.c.enemy.hp, damage = Math.floor(heroStats(s.hero).atk * 2.6) + 1;
    assert.equal(cast(s, 'skyfire_lance').ok, true);
    assert.equal(hp - s.c.enemy.hp, damage);
    assert.equal(s.hero.mp, 46);
    assert.equal(s.c.charge, 15);
    assert.deepEqual(s.hero.statuses, ['shocked']);
    assert.equal(s.c.heroTimers.shocked, 2);
  }
});

for (const [label, mutate] of [
  ['below level 17', s => { s.hero.level = 16; }],
  ['insufficient MP', s => { s.hero.mp = 13; }],
]) {
  test(`Skyfire refusal is state-atomic: ${label}`, () => {
    const s = setup(); mutate(s);
    const before = structuredClone(s);
    assert.equal(cast(s, 'skyfire_lance').ok, false);
    assert.deepEqual(s, before);
  });
}
