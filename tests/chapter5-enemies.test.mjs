import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';
import { createCombat } from '../src/combat/rules.js';
import { fieldTip } from '../src/data/fieldTips.js';

test('chapter 5 foes are defined with escalating stats', () => {
  for (const id of ['tempest_shade', 'thunderhead_colossus', 'storm_heart']) {
    assert.ok(ENEMIES[id], id);
    assert.ok(ENEMIES[id].atk > ENEMIES.stormcrown_tyrant.atk, `${id} out-hits the Tyrant`);
    assert.ok(fieldTip(id).length > 0, `${id} has a field tip`);
    assert.equal(createCombat({ enemyId: id }).enemy.id, id);
  }
  assert.ok(ENEMIES.thunderhead_colossus.tags.includes('construct'));
  const boss = ENEMIES.storm_heart;
  assert.equal(boss.boss, true);
  assert.ok(boss.hp > ENEMIES.stormcrown_tyrant.hp);
  assert.ok(boss.intro && boss.defeat && boss.enrage.line);
});
