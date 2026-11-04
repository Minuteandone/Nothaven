import test from 'node:test';
import assert from 'node:assert/strict';
import { ITEMS, TYPES } from '../src/items/items.js';
import { SHOPS } from '../src/items/shop.js';
import { RECIPES } from '../src/items/crafting.js';
import { ENEMIES } from '../src/data/enemies.js';
import { createInitialState } from '../src/state.js';
import { buyItem } from '../src/items/shop.js';

// observatory_lens and beacon_core are narrative McGuffins: the story tracks
// them through flags in the stage machine (src/story/index.js), never as
// inventory entries, so they are intentionally excluded here. The two dispatch
// key items are collectible drops and are pinned explicitly below.
test('every equippable, consumable and material has at least one acquisition source', () => {
  const fromShops = new Set(Object.values(SHOPS).flatMap((s) => s.stock));
  const fromCrafting = new Set(RECIPES.flatMap((r) => r.outputs.map((o) => o.id)));
  const fromLoot = new Set(
    Object.values(ENEMIES).flatMap((e) => (e.loot || []).map((l) => l.id))
  );
  const missing = [];
  for (const item of Object.values(ITEMS)) {
    if (item.type === TYPES.KEY) continue;
    if (!fromShops.has(item.id) && !fromCrafting.has(item.id) && !fromLoot.has(item.id)) {
      missing.push(item.id);
    }
  }
  assert.deepEqual(missing, [], 'items with no shop, craft or loot source');
});

test('both dispatch keys are findable: b mirrors a as a rust_sentinel drop', () => {
  const a = (ENEMIES.ridge_bandit.loot || []).find((l) => l.id === 'storm_dispatch_a');
  const b = (ENEMIES.rust_sentinel.loot || []).find((l) => l.id === 'storm_dispatch_b');
  assert.ok(a, 'storm_dispatch_a drops from ridge_bandit');
  assert.ok(b, 'storm_dispatch_b drops from rust_sentinel');
  assert.equal(b.chance, a.chance);
  assert.equal(b.minQty, 1);
  assert.equal(b.maxQty, 1);
});

test('greyhaven stocks the Tin Whistle and Saltmere stocks the Warden Blade', () => {
  assert.ok(SHOPS.greyhaven_shop.stock.includes('tin_whistle'));
  assert.ok(SHOPS.saltmere_post.stock.includes('warden_blade'));
});

test('the new stock entries are purchasable end to end', () => {
  for (const [shopId, itemId] of [
    ['greyhaven_shop', 'tin_whistle'],
    ['saltmere_post', 'warden_blade'],
  ]) {
    const state = createInitialState();
    state.gold = 1000;
    const res = buyItem(state, SHOPS[shopId], itemId, 1);
    assert.equal(res.ok, true, `${itemId} at ${shopId}: ${res.message}`);
    assert.ok(res.state.inventory.some((s) => s.id === itemId));
  }
});
