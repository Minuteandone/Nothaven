import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';
import { shopsStocking } from '../src/items/shop.js';
import { getItem } from '../src/items/items.js';
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

function sellHtml(game, items) {
  game.state.inventory = grantRewards(game.state.inventory, items).inv;
  game.shopMode = 'sell';
  return shopScene.render(game);
}

test('shopsStocking lists display names in canonical SHOPS order', () => {
  assert.deepEqual(shopsStocking('rations'), ['Hesta\'s Goods', 'Saltmere Trading Post', 'Relay Outpost Stores']);
  assert.deepEqual(shopsStocking('storm_tonic'), ['Hesta\'s Goods', 'Saltmere Trading Post']);
  assert.deepEqual(shopsStocking('iron_sword'), []);
  assert.deepEqual(shopsStocking('not_an_item'), []);
});

test('sell rows hint where to buy the item back, at its buy price', () => {
  const game = fakeGame();
  const html = sellHtml(game, { rations: 2 });
  const row = html.split('<tr>').find((chunk) => chunk.includes('data-action="sell" data-arg="rations"'));
  assert.ok(row, 'rations sell row renders');
  assert.match(row, /2g each/);
  assert.ok(
    row.includes('<small class="sell-stock">at Hesta&#39;s Goods · Saltmere Trading Post · Relay Outpost Stores (6g)</small>'),
    'hint names every stocking shop and the buy-back price'
  );
});

test('multi-shop items join every stocking shop in canonical order', () => {
  const game = fakeGame();
  const html = sellHtml(game, { storm_tonic: 1, healing_herb: 1 });
  const tonicRow = html.split('<tr>').find((chunk) => chunk.includes('data-action="sell" data-arg="storm_tonic"'));
  assert.ok(tonicRow.includes('(22g)'), 'buy price, not the 11g sell price');
  assert.ok(tonicRow.includes('Hesta&#39;s Goods · Saltmere Trading Post'));
  const herbRow = html.split('<tr>').find((chunk) => chunk.includes('data-action="sell" data-arg="healing_herb"'));
  assert.ok(herbRow.includes('(18g)'));
  assert.ok(herbRow.includes('at Hesta&#39;s Goods (18g)</small>'), 'single-shop hint names one shop');
});

test('items stocked nowhere get no buy-back hint', () => {
  const game = fakeGame();
  const html = sellHtml(game, { iron_sword: 1, scrap_metal: 4, lens_shard: 1 });
  for (const id of ['iron_sword', 'scrap_metal', 'lens_shard']) {
    const row = html.split('<tr>').find((chunk) => chunk.includes(`data-action="sell" data-arg="${id}"`));
    assert.ok(row, `${id} still sells`);
  }
  assert.ok(!html.includes('sell-stock'), 'no hint when no shop stocks the item');
});

test('buy-back hints stay out of the buy tab', () => {
  const game = fakeGame();
  game.state.inventory = grantRewards(game.state.inventory, { rations: 2 }).inv;
  game.shopMode = 'buy';
  const html = shopScene.render(game);
  assert.ok(!html.includes('sell-stock'));
  assert.ok(html.includes('data-action="buy" data-arg="rations"'));
});

test('sell view with buy-back hints stays egg-free and leak-free', () => {
  const game = fakeGame();
  const html = sellHtml(game, { rations: 2, storm_tonic: 1, iron_sword: 1, scrap_metal: 3 });
  assertEggFree(html, 'sell tab with buy-back hints');
  assert.ok(!html.includes('undefined'), 'no undefined leaking into markup');
  assert.equal(getItem('rations').price, 6);
});
