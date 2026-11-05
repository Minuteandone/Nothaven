import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';
import { getItem } from '../src/items/items.js';
import { SHOPS } from '../src/items/shop.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('Thunderhoof can drop the unique Sparkrack Tine trinket, which no shop stocks', () => {
  const item = getItem('sparkrack_tine');
  assert.equal(item.slot, 'trinket');
  assert.deepEqual(item.stats, { atk: 3, mp: 6, spd: 3 });
  assert.equal(item.price, 320);
  assert.equal(item.sellPrice, 160);
  const drop = ENEMIES.thunderhoof.loot.find((l) => l.id === 'sparkrack_tine');
  assert.ok(drop, 'Thunderhoof lists the tine');
  assert.equal(drop.chance, 0.35);
  assert.equal(drop.minQty, 1);
  assert.equal(drop.maxQty, 1);
  for (const [id, enemy] of Object.entries(ENEMIES)) {
    if (id !== 'thunderhoof') assert.ok(!(enemy.loot || []).some((l) => l.id === 'sparkrack_tine'), id);
  }
  assert.ok(!JSON.stringify(SHOPS).includes('sparkrack_tine'));
  assertEggFree(`${item.name} ${item.description}`, 'sparkrack tine');
});
