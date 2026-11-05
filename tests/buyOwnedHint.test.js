import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';
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
  game.shopId = 'greyhaven_shop';
  return game;
}

function buyRow(html, id) {
  return html.split('<tr>').find((chunk) => chunk.includes(`data-action="buy" data-arg="${id}"`));
}

test('buy rows show how many of each item the party already owns', () => {
  const game = fakeGame();
  game.state.inventory = grantRewards(game.state.inventory, { rations: 2, bandage: 1 }).inv;
  game.shopMode = 'buy';
  const html = shopScene.render(game);
  const rations = buyRow(html, 'rations');
  assert.ok(rations, 'rations buy row renders');
  assert.ok(rations.includes('<small class="buy-owned">owned 2</small>'), 'count rides the price cell');
  const bandage = buyRow(html, 'bandage');
  assert.ok(bandage.includes('<small class="buy-owned">owned 1</small>'));
  assert.ok(!buyRow(html, 'tin_whistle').includes('buy-owned'), 'nothing carried -> no hint');
});

test('no owned hints render on a fresh inventory', () => {
  const game = fakeGame();
  game.shopMode = 'buy';
  const html = shopScene.render(game);
  assert.ok(!html.includes('buy-owned'));
});

test('owned counts update immediately after a purchase', () => {
  const game = fakeGame();
  game.state.inventory = grantRewards(game.state.inventory, { rations: 2 }).inv;
  game.shopMode = 'buy';
  shopScene.actions.buy(game, { dataset: { arg: 'rations' } });
  const html = shopScene.render(game);
  assert.ok(buyRow(html, 'rations').includes('owned 3'), '2 carried + 1 bought = 3');
});

test('owned hints stay out of the sell tab', () => {
  const game = fakeGame();
  game.state.inventory = grantRewards(game.state.inventory, { rations: 2 }).inv;
  game.shopMode = 'sell';
  const html = shopScene.render(game);
  assert.ok(!html.includes('buy-owned'));
  assert.ok(html.includes('data-action="sell" data-arg="rations"'));
});

test('buy view with owned hints stays egg-free and leak-free', () => {
  const game = fakeGame();
  game.state.inventory = grantRewards(game.state.inventory, { rations: 2, storm_tonic: 1 }).inv;
  game.shopMode = 'buy';
  const html = shopScene.render(game);
  assertEggFree(html, 'buy tab with owned hints');
  assert.ok(!html.includes('undefined'), 'no undefined leaking into markup');
});
