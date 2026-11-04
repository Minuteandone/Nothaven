import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';
import { ITEMS } from '../src/items/items.js';
import { createCombat, checkBossPhase } from '../src/combat/rules.js';

const IDS = ['dust_marauder', 'relay_drone', 'relay_warden'];

test('chapter three enemies exist with loot that references real items', () => {
  for (const id of IDS) {
    const e = ENEMIES[id];
    assert.ok(e, id);
    for (const drop of e.loot) assert.ok(ITEMS[drop.id], `${id} drops unknown ${drop.id}`);
  }
  assert.ok(ITEMS.relay_brass && ITEMS.sunscar_glass);
});

test('relay warden is a construct boss that enrages once at half hp', () => {
  const c = createCombat({ enemyId: 'relay_warden', encounterId: 'relay_warden' });
  assert.ok(c.enemy.boss);
  assert.ok(c.enemy.tags.includes('construct'));
  assert.ok(ENEMIES.relay_drone.tags.includes('construct'));
  const baseAtk = c.enemy.atk;
  c.enemy.hp = Math.floor(c.enemy.maxHp * 0.5);
  checkBossPhase(c);
  assert.ok(c.enraged);
  assert.equal(c.enemy.atk, baseAtk + 3);
  assert.equal(ENEMIES.relay_warden.atk, 22);
});

test('bosses log a defeat line on victory', async () => {
  const { createCombat, heroAction } = await import('../src/combat/rules.js');
  const { ENEMIES } = await import('../src/data/enemies.js');
  for (const id of ['tide_wraith', 'pass_warlord', 'drowned_harbormaster', 'relay_warden']) {
    assert.equal(typeof ENEMIES[id].defeat, 'string', id);
    const c = createCombat({ enemyId: id });
    c.enemy.hp = 1;
    const hero = { id: 'hero', name: 'Wren', hp: 30, maxHp: 30, mp: 10, maxMp: 10, atk: 50, def: 3, spd: 5, level: 5, statuses: [], equipment: {} };
    const res = heroAction(c, hero, { type: 'attack' }, () => 0.5, [hero]);
    assert.equal(c.over, 'victory', id);
    assert.ok([...(res.lines || []), ...c.log].includes(ENEMIES[id].defeat), id);
  }
});
