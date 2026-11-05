import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { addItem } from '../src/items/inventory.js';
import { listRecipes } from '../src/items/crafting.js';
import { isScarceItem } from '../src/items/shop.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function fakeGame() {
  const game = {
    state: createInitialState(),
    shopMode: 'craft',
    shopMessage: '',
    shopReturnScene: 'town',
    shopId: undefined,
    lastScene: null,
    registered: {},
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered[name] = scene; },
  };
  return game;
}

function countOf(inv, id) {
  const row = (inv || []).find((s) => s.id === id);
  return row ? row.qty : 0;
}

function bulkEligibleRecipes() {
  return listRecipes().filter((r) => !(r.inputs || []).some((i) => isScarceItem(i.id)));
}

test('craft tab renders one Craft all button per bulk-eligible recipe and none for rare-drop recipes', () => {
  const game = fakeGame();
  const html = shopScene.render(game);
  const expected = bulkEligibleRecipes().length;
  assert.equal(html.split('data-action="craftAll"').length - 1, expected);
  const scarceRow = html.split('<tr>').find((chunk) => chunk.includes('data-arg="cut_crownshard_focus"'));
  assert.ok(scarceRow, 'scarce recipe row rendered');
  assert.ok(scarceRow.includes('>Craft</button>'), 'scarce row keeps single Craft');
  assert.ok(!scarceRow.includes('data-action="craftAll"'), 'scarce row has no Craft all');
  assert.ok(scarceRow.includes('craft-scarce'), 'scarce input carries rare drop note');
});

test('Craft all mirrors Craft disabled state when materials are missing', () => {
  const game = fakeGame();
  const html = shopScene.render(game);
  const row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="pack_field_dressing"'));
  assert.ok(row, 'field dressing row rendered');
  assert.ok(row.includes('data-action="craftAll" data-arg="pack_field_dressing" disabled'), 'Craft all disabled without materials');
});

test('craftAll repeats a recipe while materials last and reports the total', () => {
  const game = fakeGame();
  const res = addItem(game.state.inventory, 'bandage', 5);
  assert.ok(res.ok, 'bandages granted');
  game.state.inventory = res.inv;
  shopScene.actions.craftAll(game, { dataset: { arg: 'pack_field_dressing' } });
  assert.equal(countOf(game.state.inventory, 'field_dressing'), 2);
  assert.equal(countOf(game.state.inventory, 'bandage'), 1);
  assert.match(game.shopMessage, /Hesta's Goods — crafted Pack a Field Dressing x2\./);
});

test('craftAll stops at materials it cannot cover and still crafts what it can', () => {
  const game = fakeGame();
  const res = addItem(game.state.inventory, 'bandage', 3);
  assert.ok(res.ok);
  game.state.inventory = res.inv;
  shopScene.actions.craftAll(game, { dataset: { arg: 'pack_field_dressing' } });
  assert.equal(countOf(game.state.inventory, 'field_dressing'), 1);
  assert.equal(countOf(game.state.inventory, 'bandage'), 1);
  assert.match(game.shopMessage, /x1\./);
});

test('craftAll refuses rare-drop recipes even from the raw action', () => {
  const game = fakeGame();
  let inv = addItem(game.state.inventory, 'lens_shard', 2).inv;
  inv = addItem(inv, 'stormcrown_shard', 2).inv;
  inv = addItem(inv, 'relay_brass', 4).inv;
  game.state.inventory = inv;
  shopScene.actions.craftAll(game, { dataset: { arg: 'cut_crownshard_focus' } });
  assert.equal(game.shopMessage, 'Craft all is disabled for recipes that use rare drops.');
  assert.equal(countOf(game.state.inventory, 'stormcrown_shard'), 2, 'shards untouched');
  assert.equal(countOf(game.state.inventory, 'crownshard_focus'), 0, 'nothing crafted');
});

test('craftAll with missing materials surfaces the missing-materials message', () => {
  const game = fakeGame();
  shopScene.actions.craftAll(game, { dataset: { arg: 'pack_field_dressing' } });
  assert.match(game.shopMessage, /^Missing materials: bandage \(have 0, need 2\)\.$/);
});

test('craft tab copy is free of egg vocabulary', () => {
  const game = fakeGame();
  const html = shopScene.render(game).replace(/class="[^"]*"/g, '');
  assertEggFree([html], 'shop craft tab render');
});
