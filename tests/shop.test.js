import { test } from 'node:test';
import assert from 'node:assert/strict';
import { GREYHAVEN_SHOP, buyItem, sellItem, shopSells, shopCatalog } from '../src/items/shop.js';

const makeState = () => ({ gold: 100, inventory: [{ id: 'rations', qty: 3 }, { id: 'scrap_metal', qty: 2 }] });

test('buyItem charges gold and adds to inventory', () => {
  const state = makeState();
  const res = buyItem(state, GREYHAVEN_SHOP, 'healing_herb', 2);
  assert.equal(res.ok, true);
  assert.equal(res.state.gold, 100 - 36);
  assert.equal(res.state.inventory.find((s) => s.id === 'healing_herb').qty, 2);
  assert.equal(state.gold, 100, 'original state untouched');
  assert.equal(buyItem(state, GREYHAVEN_SHOP, 'iron_sword').ok, false, 'not in stock');
  assert.equal(buyItem({ gold: 5, inventory: [] }, GREYHAVEN_SHOP, 'storm_tonic').ok, false, 'too poor');
  assert.equal(buyItem(state, GREYHAVEN_SHOP, 'healing_herb', 0).ok, false, 'bad qty');
});

test('sellItem pays sellPrice and refuses key items', () => {
  let state = makeState();
  const res = sellItem(state, 'scrap_metal', 2);
  assert.equal(res.ok, true);
  assert.equal(res.state.gold, 100 + 8);
  assert.equal(res.state.inventory.find((s) => s.id === 'scrap_metal'), undefined, 'stack pruned');
  assert.equal(sellItem(state, 'scrap_metal', 5).ok, false, 'not enough to sell');
  assert.equal(sellItem(state, 'rations', 10).ok, false);
  // key items cannot be sold
  state = { gold: 0, inventory: [{ id: 'observatory_lens', qty: 1 }] };
  assert.equal(sellItem(state, 'observatory_lens').ok, false);
});

test('shop helpers expose the catalog safely', () => {
  assert.equal(shopSells(GREYHAVEN_SHOP, 'bandage'), true);
  assert.equal(shopSells(GREYHAVEN_SHOP, 'warden_blade'), false);
  const catalog = shopCatalog(GREYHAVEN_SHOP);
  assert.ok(catalog.length >= 5);
  for (const entry of catalog) {
    assert.ok(entry.name && entry.price >= 0 && typeof entry.description === 'string');
  }
});
