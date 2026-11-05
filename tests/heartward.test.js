import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOPS } from '../src/items/shop.js';
import { ITEMS, getItem, isKnownItem, canEquip } from '../src/items/items.js';
import { RECIPES, validateRecipes, craft } from '../src/items/crafting.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';

import { EGG_RE } from './helpers/eggGuard.mjs';

test('heartward_charm is a well-formed recipe-only trinket', () => {
  const it = getItem('heartward_charm');
  assert.equal(it.type, ITEMS.heartward_charm.type);
  assert.equal(it.slot, 'trinket');
  assert.deepEqual(it.stats, { def: 3, hp: 12, spd: 1 });
  assert.ok(it.price > 0 && it.sellPrice > 0);
  // recipe-only: the boss shard is never stocked anywhere
  for (const shop of Object.values(SHOPS)) {
    assert.ok(!shop.stock.includes('heartward_charm'), 'charm must not be buyable');
    assert.ok(!shop.stock.includes('stormcrown_shard'), 'shard stays boss-only');
  }
  assert.equal(canEquip('heartward_charm'), true);
  assert.equal(canEquip('stormcrown_shard'), false);
});

test('string_heartward_charm recipe is valid and crafts atomically', () => {
  validateRecipes();
  const r = RECIPES.find((x) => x.id === 'string_heartward_charm');
  assert.ok(r, 'recipe registered');
  for (const side of ['inputs', 'outputs']) {
    for (const { id } of r[side]) assert.ok(isKnownItem(id), `${side} unknown ${id}`);
  }

  const state = createInitialState();
  state.inventory = grantRewards(state.inventory, [
    { id: 'stormcrown_shard', qty: 1 }, { id: 'salvaged_wiring', qty: 2 }, { id: 'storm_glass', qty: 1 },
  ]).inv;
  const res = craft(state.inventory, 'string_heartward_charm');
  assert.equal(res.ok, true);
  state.inventory = res.inv;
  assert.ok(state.inventory.some((s) => s.id === 'heartward_charm' && s.qty === 1));
  assert.ok(!state.inventory.some((s) => s.id === 'stormcrown_shard'));
  assert.ok(!state.inventory.some((s) => s.id === 'salvaged_wiring'));
  assert.ok(!state.inventory.some((s) => s.id === 'storm_glass'));

  // short by one wiring: rejected, nothing consumed
  state.inventory = grantRewards(state.inventory, [
    { id: 'stormcrown_shard', qty: 1 }, { id: 'salvaged_wiring', qty: 1 },
  ]).inv;
  const bad = craft(state.inventory, 'string_heartward_charm');
  assert.equal(bad.ok, false);
  assert.equal(state.inventory.filter((s) => s && s.id === 'stormcrown_shard').length, 1);
});

test('heartward charm content carries no egg vocabulary', () => {
  const it = getItem('heartward_charm');
  const r = RECIPES.find((x) => x.id === 'string_heartward_charm');
  const blob = [it.name, it.description, r.name, r.description].join(' ');
  assert.ok(!EGG_RE.test(blob), `egg reference found: ${blob.match(EGG_RE)}`);
});
