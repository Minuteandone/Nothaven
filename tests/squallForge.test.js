import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOPS } from '../src/items/shop.js';
import { ITEMS, getItem, isKnownItem, canEquip } from '../src/items/items.js';
import {
  RECIPES, validateRecipes, craft, recipeInputsMet, recipesUsingItem, listRecipes,
} from '../src/items/crafting.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';
import { recipeBookEntries } from '../src/scenes/recipes.js';
import { shopScene } from '../src/scenes/shop.js';

import { EGG_RE } from './eggGuard.mjs';

const NEW_ITEMS = [
  { id: 'squall_cleaver', slot: 'weapon', stats: { atk: 24 }, price: 480, sellPrice: 240 },
  { id: 'squall_bulwark', slot: 'armor', stats: { def: 17, hp: 18 }, price: 490, sellPrice: 245 },
  { id: 'squall_sigil', slot: 'trinket', stats: { atk: 2, mp: 10, spd: 4 }, price: 350, sellPrice: 175 },
];
const NEW_RECIPE_IDS = ['forge_squall_cleaver', 'hammer_squall_bulwark', 'cut_squall_sigil'];

function countOf(inv, id) {
  const row = inv.find((s) => s && s.id === id);
  return row ? row.qty : 0;
}

test('squall endgame items are well-formed craft-only gear', () => {
  validateRecipes();
  for (const spec of NEW_ITEMS) {
    const it = getItem(spec.id);
    assert.equal(it.id, spec.id);
    assert.ok(it.name && it.description, `${spec.id} has name and description`);
    assert.equal(it.type, ITEMS.tempest_edge.type);
    assert.equal(it.slot, spec.slot);
    assert.deepEqual(it.stats, spec.stats);
    assert.equal(it.price, spec.price);
    assert.equal(it.sellPrice, spec.sellPrice);
    assert.equal(canEquip(spec.id), true);
    // craft-only: never stocked in any shop
    for (const shop of Object.values(SHOPS)) {
      assert.ok(!shop.stock.includes(spec.id), `${spec.id} must not be buyable`);
    }
  }
  // the shard stays boss-only: no shop stocks it
  for (const shop of Object.values(SHOPS)) {
    assert.ok(!shop.stock.includes('stormcrown_shard'), 'shard stays boss-only');
  }
});

test('squall recipes are valid and registered', () => {
  validateRecipes();
  for (const id of NEW_RECIPE_IDS) {
    const r = RECIPES.find((x) => x.id === id);
    assert.ok(r, `${id} registered`);
    for (const side of ['inputs', 'outputs']) {
      for (const { id: itemId } of r[side]) assert.ok(isKnownItem(itemId), `${side} unknown ${itemId}`);
    }
  }
  const cleaver = RECIPES.find((x) => x.id === 'forge_squall_cleaver');
  assert.deepEqual(cleaver.inputs, [
    { id: 'tempest_edge', qty: 1 }, { id: 'thunder_iron', qty: 3 }, { id: 'stormcrown_shard', qty: 1 },
  ]);
  assert.deepEqual(cleaver.outputs, [{ id: 'squall_cleaver', qty: 1 }]);
  const bulwark = RECIPES.find((x) => x.id === 'hammer_squall_bulwark');
  assert.deepEqual(bulwark.inputs, [
    { id: 'maelstrom_plate', qty: 1 }, { id: 'thunder_iron', qty: 3 }, { id: 'stormcrown_shard', qty: 1 },
  ]);
  const sigil = RECIPES.find((x) => x.id === 'cut_squall_sigil');
  assert.deepEqual(sigil.inputs, [
    { id: 'stormeye_signet', qty: 1 }, { id: 'thunder_iron', qty: 2 }, { id: 'storm_glass', qty: 2 },
  ]);
});

test('recipe inputs unmet without the crown shard (and without base gear)', () => {
  const state = createInitialState();
  state.inventory = grantRewards(state.inventory, [
    { id: 'tempest_edge', qty: 1 }, { id: 'thunder_iron', qty: 3 },
  ]).inv;
  assert.equal(recipeInputsMet(state.inventory, RECIPES.find((x) => x.id === 'forge_squall_cleaver')).ok, false,
    'no shard -> not craftable');
  state.inventory = grantRewards(state.inventory, [{ id: 'stormcrown_shard', qty: 1 }]).inv;
  assert.equal(recipeInputsMet(state.inventory, RECIPES.find((x) => x.id === 'forge_squall_cleaver')).ok, true,
    'shard + gear + iron -> craftable');
  const noBase = createInitialState();
  noBase.inventory = grantRewards(noBase.inventory, [
    { id: 'thunder_iron', qty: 3 }, { id: 'stormcrown_shard', qty: 1 },
  ]).inv;
  assert.equal(recipeInputsMet(noBase.inventory, RECIPES.find((x) => x.id === 'forge_squall_cleaver')).ok, false,
    'missing tempest_edge -> not craftable');
});

test('all three squall recipes craft atomically end to end', () => {
  const cases = [
    { recipe: 'forge_squall_cleaver', inputs: [['tempest_edge', 1], ['thunder_iron', 3], ['stormcrown_shard', 1]], out: 'squall_cleaver' },
    { recipe: 'hammer_squall_bulwark', inputs: [['maelstrom_plate', 1], ['thunder_iron', 3], ['stormcrown_shard', 1]], out: 'squall_bulwark' },
    { recipe: 'cut_squall_sigil', inputs: [['stormeye_signet', 1], ['thunder_iron', 2], ['storm_glass', 2]], out: 'squall_sigil' },
  ];
  for (const c of cases) {
    const state = createInitialState();
    state.inventory = grantRewards(state.inventory, c.inputs.map(([id, qty]) => ({ id, qty }))).inv;
    const res = craft(state.inventory, c.recipe);
    assert.equal(res.ok, true, `${c.recipe} crafts: ${res.log ? res.log.join(' ') : ''}`);
    state.inventory = res.inv;
    assert.equal(countOf(state.inventory, c.out), 1, `${c.out} gained`);
    for (const [id] of c.inputs) {
      assert.equal(countOf(state.inventory, id), 0, `${id} consumed`);
    }
    // short by one shard: rejected, nothing consumed
    const poor = createInitialState();
    poor.inventory = grantRewards(poor.inventory, c.inputs.map(([id, qty]) => ({ id, qty }))).inv;
    poor.inventory = grantRewards(poor.inventory, [{ id: 'scrap_metal', qty: 1 }]).inv;
    poor.inventory = poor.inventory.filter((s) => s.id !== 'stormcrown_shard' && s.id !== 'storm_glass');
    const bad = craft(poor.inventory, c.recipe);
    assert.equal(bad.ok, false, `${c.recipe} rejected when short`);
    assert.equal(countOf(poor.inventory, c.inputs[0][0]), c.inputs[0][1], 'nothing consumed on failure');
  }
});

test('shard recipes are discoverable via recipesUsingItem', () => {
  const shardUsers = recipesUsingItem('stormcrown_shard').map((r) => r.id);
  assert.ok(shardUsers.includes('forge_squall_cleaver'));
  assert.ok(shardUsers.includes('hammer_squall_bulwark'));
  const signetUsers = recipesUsingItem('stormeye_signet').map((r) => r.id);
  assert.ok(signetUsers.includes('cut_squall_sigil'));
});

test('squall gear shows up in the field recipe book', () => {
  const state = createInitialState();
  state.inventory = grantRewards(state.inventory, [
    { id: 'tempest_edge', qty: 1 }, { id: 'maelstrom_plate', qty: 1 },
    { id: 'stormeye_signet', qty: 1 }, { id: 'thunder_iron', qty: 8 },
    { id: 'storm_glass', qty: 2 }, { id: 'stormcrown_shard', qty: 2 },
  ]).inv;
  const entries = recipeBookEntries(state.inventory);
  assert.equal(entries.length, listRecipes().length, 'book lists every recipe');
  for (const id of NEW_RECIPE_IDS) {
    const row = entries.find((e) => e.recipe.id === id);
    assert.ok(row, `${id} in the book`);
    assert.equal(row.ready, true, `${id} shows Ready with full materials`);
  }
});

test('squall gear and recipes carry no egg vocabulary', () => {
  const blobs = [];
  for (const spec of NEW_ITEMS) {
    const it = getItem(spec.id);
    blobs.push(it.name, it.description);
  }
  for (const id of NEW_RECIPE_IDS) {
    const r = RECIPES.find((x) => x.id === id);
    blobs.push(r.name, r.description);
  }
  const blob = blobs.join(' ');
  assert.ok(!EGG_RE.test(blob), `egg reference found: ${blob.match(EGG_RE)}`);
});

test('squall cleaver crafts through the shop craft tab', () => {
  const game = {
    state: createInitialState(),
    shopMode: undefined,
    shopMessage: '',
    shopReturnScene: undefined,
    shopId: undefined,
    lastScene: null,
    registered: {},
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered[name] = scene; },
  };
  shopScene.onEnter(game, { shopId: 'stormcrown_post', returnScene: 'explore' });
  game.state.inventory = grantRewards(game.state.inventory, [
    { id: 'tempest_edge', qty: 1 }, { id: 'thunder_iron', qty: 3 }, { id: 'stormcrown_shard', qty: 1 },
  ]).inv;
  shopScene.actions.craft(game, { dataset: { arg: 'forge_squall_cleaver' } });
  assert.match(game.shopMessage, /— crafted 1 Squall Cleaver\./);
  assert.equal(countOf(game.state.inventory, 'squall_cleaver'), 1);
  assert.equal(countOf(game.state.inventory, 'stormcrown_shard'), 0);
});
