import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ITEMS, isKnownItem } from '../src/items/items.js';
import { SALTMERE_POST, shopSells, shopsStocking } from '../src/items/shop.js';
import { ENEMIES } from '../src/data/enemies.js';
import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { countItem } from '../src/items/inventory.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function fakeGame() {
  const game = {
    state: createInitialState(),
    shopMode: undefined,
    shopMessage: '',
    shopReturnScene: undefined,
    lastScene: null,
    registered: {},
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered[name] = scene; },
  };
  return game;
}

function enterShop(game, shopId, mode) {
  shopScene.onEnter(game, { shopId, returnScene: 'explore', ...(mode ? { mode } : {}) });
}

test('salted roe is a defined consumable with sensible economy', () => {
  const it = ITEMS.salted_roe;
  assert.ok(it, 'catalog entry exists');
  assert.equal(it.type, 'consumable');
  assert.equal(it.name, 'Salted Roe');
  assert.deepEqual(it.use, { hp: 25 });
  assert.equal(it.price, 17);
  assert.equal(it.sellPrice, 8);
  assert.ok(isKnownItem('salted_roe'));
  assertEggFree(`${it.name} ${it.description}`, 'salted roe catalog text');
});

test('the saltmere trading post stocks salted roe', () => {
  assert.ok(shopSells(SALTMERE_POST, 'salted_roe'), 'saltmere_post stocks salted_roe');
  assert.deepEqual(shopsStocking('salted_roe'), ['Saltmere Trading Post']);
});

test('buying salted roe at the post charges 17 gold and stocks the bag', () => {
  const game = fakeGame();
  enterShop(game, 'saltmere_post', 'buy');
  shopScene.actions.buy(game, { dataset: { arg: 'salted_roe' } });
  assert.equal(game.shopMessage, 'Bought Salted Roe x1 for 17 gold.');
  assert.equal(game.state.gold, 3, '20 - 17 gold spent');
  assert.equal(countItem(game.state.inventory, 'salted_roe'), 1);
});

test('wrack eels carry salted roe in their loot table', () => {
  const loot = ENEMIES.wrack_eel.loot || [];
  const entry = loot.find((l) => l.id === 'salted_roe');
  assert.ok(entry, 'wrack_eel drops salted_roe');
  assert.ok(entry.chance > 0 && entry.chance <= 1, 'chance in range');
  assert.equal(entry.minQty, 1);
  assert.equal(entry.maxQty, 1);
});

test('the shop render lists salted roe and stays egg-free', () => {
  const game = fakeGame();
  enterShop(game, 'saltmere_post', 'buy');
  const html = shopScene.render(game);
  assert.ok(html.includes('Salted Roe'), 'buy row rendered');
  assertEggFree(html, 'saltmere shop render');
});
