import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';
import { getItem } from '../src/items/items.js';
import { createCombat, checkBossPhase } from '../src/combat/rules.js';

const EGG_RE = /\b(eggs?|yolks?|shells?|hatch\w*|nests?|chicks?|hens?|omelet\w*|scrambl\w*|boil\w*|poach\w*|fried|devil\w*|golden|pearl|basket|oval|quail|goose|crack\w*|easter)\b/i;

test('chapter 4 foes exist with sensible late-game stats', () => {
  for (const id of ['ashen_raider', 'spire_sentry', 'stormcrown_tyrant']) {
    const e = ENEMIES[id];
    assert.ok(e, id);
    assert.ok(e.hp >= 80 && e.atk >= 17, `${id} is tougher than chapter 3 regulars`);
    for (const drop of e.loot) assert.ok(getItem(drop.id), `${id} drops known item ${drop.id}`);
  }
  assert.deepEqual(ENEMIES.spire_sentry.tags, ['construct']);
  assert.equal(ENEMIES.stormcrown_tyrant.boss, true);
  assert.ok(ENEMIES.stormcrown_tyrant.hp > ENEMIES.relay_warden.hp);
});

test('Stormcrown Tyrant enrages once below 40% HP', () => {
  const c = createCombat({ enemyId: 'stormcrown_tyrant' });
  const baseAtk = c.enemy.atk;
  c.enemy.hp = Math.floor(c.enemy.maxHp * 0.4);
  checkBossPhase(c);
  assert.ok(c.enraged);
  assert.equal(c.enemy.atk, baseAtk + 4);
  checkBossPhase(c);
  assert.equal(c.enemy.atk, baseAtk + 4, 'only once');
  assert.equal(ENEMIES.stormcrown_tyrant.atk, baseAtk, 'base data untouched');
});

test('chapter 4 text stays clear of egg wording', () => {
  const texts = [];
  for (const id of ['ashen_raider', 'spire_sentry', 'stormcrown_tyrant']) {
    const e = ENEMIES[id];
    texts.push(e.name, e.ability.name, e.intro || '', e.defeat || '', e.enrage?.line || '');
  }
  for (const id of ['thunder_iron', 'stormcrown_shard']) { const it = getItem(id); texts.push(it.name, it.description); }
  for (const t of texts) assert.ok(!EGG_RE.test(t), t);
});
