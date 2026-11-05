import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { grantRewards, countItem } from '../src/items/inventory.js';
import { tradesFor } from '../src/items/trade.js';
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

function withScrap(qty) {
  return grantRewards([], [{ id: 'scrap_metal', qty }]).inv;
}

test('tradeAll repeats a trade while materials last and writes the inventory once', () => {
  const game = fakeGame();
  game.state.inventory = withScrap(12);
  enterShop(game, 'saltmere_post', 'trade');
  shopScene.actions.tradeAll(game, { dataset: { arg: 'scrap_to_glass' } });
  assert.equal(countItem(game.state.inventory, 'storm_glass'), 3, 'three storm glass granted');
  assert.equal(countItem(game.state.inventory, 'scrap_metal'), 0, 'scrap spent');
  assert.equal(game.state.inventory.filter((s) => s.id === 'storm_glass').length, 1, 'stacks deduped');
  assert.equal(game.shopMessage, 'Saltmere Trading Post — traded Scrap for storm glass x3.');
});

test('tradeAll stops cleanly when a partially filled stack runs out', () => {
  const game = fakeGame();
  game.state.inventory = withScrap(10);
  enterShop(game, 'saltmere_post', 'trade');
  shopScene.actions.tradeAll(game, { dataset: { arg: 'scrap_to_glass' } });
  assert.equal(countItem(game.state.inventory, 'storm_glass'), 2);
  assert.equal(countItem(game.state.inventory, 'scrap_metal'), 2, 'leftover scrap kept');
  assert.equal(game.shopMessage, 'Saltmere Trading Post — traded Scrap for storm glass x2.');
});

test('tradeAll refuses with the canonical shortfall message and changes nothing', () => {
  const game = fakeGame();
  game.state.inventory = withScrap(2);
  enterShop(game, 'saltmere_post', 'trade');
  const before = JSON.parse(JSON.stringify(game.state.inventory));
  shopScene.actions.tradeAll(game, { dataset: { arg: 'scrap_to_glass' } });
  assert.equal(game.shopMessage, 'Missing materials: scrap_metal (have 2, need 4).');
  assert.deepEqual(game.state.inventory, before);
});

test('tradeAll mirrors the single-trade guards: unknown trade, wrong shop, missing argument', () => {
  const game = fakeGame();
  game.state.inventory = withScrap(8);
  enterShop(game, 'saltmere_post', 'trade');
  shopScene.actions.tradeAll(game, { dataset: { arg: 'not_a_trade' } });
  assert.equal(game.shopMessage, 'That trade is not offered here.');
  enterShop(game, 'greyhaven_shop', 'buy');
  shopScene.actions.tradeAll(game, { dataset: { arg: 'scrap_to_glass' } });
  assert.equal(game.shopMessage, 'That trade is not offered here.');
  const snapshot = JSON.parse(JSON.stringify(game.state));
  shopScene.actions.tradeAll(game, {});
  assert.deepEqual(game.state, snapshot);
});

test('tradeAll caps at 99 trades', () => {
  const game = fakeGame();
  game.state.inventory = withScrap(400);
  enterShop(game, 'saltmere_post', 'trade');
  shopScene.actions.tradeAll(game, { dataset: { arg: 'scrap_to_glass' } });
  assert.equal(countItem(game.state.inventory, 'storm_glass'), 99);
  assert.equal(countItem(game.state.inventory, 'scrap_metal'), 4, 'exactly 99 trades spent 396 scrap');
  assert.match(game.shopMessage, / x99\.$/);
});

test('trade rows render Trade all beside Trade, disabled exactly when unmet', () => {
  const game = fakeGame();
  enterShop(game, 'saltmere_post', 'trade');
  let html = shopScene.render(game);
  let row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="scrap_to_glass"'));
  assert.ok(row, 'scrap trade row present');
  assert.match(row, /<button data-action="trade" data-arg="scrap_to_glass" disabled>/);
  assert.match(row, /<button data-action="tradeAll" data-arg="scrap_to_glass" disabled>/);
  assertEggFree(html, 'shop trade-all render (unmet)');

  game.state.inventory = withScrap(4);
  enterShop(game, 'saltmere_post', 'trade');
  html = shopScene.render(game);
  row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="scrap_to_glass"'));
  assert.match(row, /<button data-action="trade" data-arg="scrap_to_glass" >/);
  assert.match(row, /<button data-action="tradeAll" data-arg="scrap_to_glass" >/);
  assertEggFree(html, 'shop trade-all render (met)');
});

test('non-trade shops never render a Trade all button', () => {
  const game = fakeGame();
  enterShop(game, 'greyhaven_shop', 'buy');
  const html = shopScene.render(game);
  assert.equal(html.includes('data-action="tradeAll"'), false, 'no trade-all anywhere at greyhaven');
  assert.equal(tradesFor('greyhaven_shop').length, 0);
});
