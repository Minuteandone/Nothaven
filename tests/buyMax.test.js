import { test } from 'node:test';
import assert from 'node:assert/strict';

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

test('buyMax buys as many as the gold allows and writes gold and inventory back', () => {
  const game = fakeGame();
  assert.equal(game.state.gold, 20, 'starting gold');
  enterShop(game, 'greyhaven_shop', 'buy');
  shopScene.actions.buyMax(game, { dataset: { arg: 'rations' } });
  assert.equal(countItem(game.state.inventory, 'rations'), 3, 'floor(20 / 6) = 3 rations');
  assert.equal(game.state.gold, 2, '20 - 18 gold spent');
  assert.equal(game.shopMessage, 'Bought Trail Rations x3 for 18 gold.');
});

test('buyMax caps the purchase at 99 in one go', () => {
  const game = fakeGame();
  game.state.gold = 4000;
  enterShop(game, 'greyhaven_shop', 'buy');
  shopScene.actions.buyMax(game, { dataset: { arg: 'rations' } });
  assert.equal(countItem(game.state.inventory, 'rations'), 99, 'capped at 99');
  assert.equal(game.state.gold, 3406, '4000 - 594 gold spent');
  assert.match(game.shopMessage, /Bought Trail Rations x99 for 594 gold\./);
});

test('buyMax keeps the canonical shortfall message and changes nothing', () => {
  const game = fakeGame();
  game.state.gold = 4;
  enterShop(game, 'greyhaven_shop', 'buy');
  shopScene.actions.buyMax(game, { dataset: { arg: 'rations' } });
  assert.equal(game.shopMessage, 'Not enough gold (need 6, have 4).');
  assert.equal(game.state.gold, 4);
  assert.equal(countItem(game.state.inventory, 'rations'), 0);
});

test('buyMax refuses items the trader does not stock', () => {
  const game = fakeGame();
  enterShop(game, 'greyhaven_shop', 'buy');
  shopScene.actions.buyMax(game, { dataset: { arg: 'stormcrown_shard' } });
  assert.equal(game.shopMessage, 'The trader does not stock that.');
  assert.equal(game.state.gold, 20);
});

test('buyMax without an argument is a no-op', () => {
  const game = fakeGame();
  enterShop(game, 'greyhaven_shop', 'buy');
  shopScene.actions.buyMax(game, { dataset: {} });
  assert.equal(game.shopMessage, '');
  assert.equal(game.state.gold, 20);
});

test('buy rows render a Buy max button with the affordable count', () => {
  const game = fakeGame();
  enterShop(game, 'greyhaven_shop', 'buy');
  const html = shopScene.render(game);
  const row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="rations"'));
  assert.ok(row, 'rations row rendered');
  assert.match(row, /data-action="buyMax" data-arg="rations" aria-label="Buy max Trail Rations"/);
  assert.match(row, /Buy max \(3\)<\/button>/, 'floor(20 / 6) = 3 shown in the label');
  assert.doesNotMatch(row, /<button data-action="buyMax"[^>]*disabled/);
  assertEggFree(html);
});

test('Buy max renders disabled when the gold cannot cover one unit', () => {
  const game = fakeGame();
  game.state.gold = 4;
  enterShop(game, 'greyhaven_shop', 'buy');
  const html = shopScene.render(game);
  const row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="rations"'));
  assert.ok(row, 'rations row rendered');
  assert.match(row, /Buy max<\/button>/, 'no count shown when nothing is affordable');
  assert.match(row, /data-action="buyMax"[^>]*disabled/);
  assertEggFree(html);
});
