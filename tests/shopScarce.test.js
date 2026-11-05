import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopScene } from '../src/scenes/shop.js';
import { isScarceItem } from '../src/items/shop.js';
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
  return game;
}

test('isScarceItem flags only catalog items marked scarce', () => {
  assert.equal(isScarceItem('stormcrown_shard'), true);
  assert.equal(isScarceItem('scrap_metal'), false);
  assert.equal(isScarceItem('rations'), false);
  assert.equal(isScarceItem('lens_shard'), false);
  assert.equal(isScarceItem('no_such_item'), false);
  assert.equal(isScarceItem(42), false);
});

test('sell view suppresses Sell all for scarce stacks and tags them as rare drops', () => {
  const game = fakeGame();
  game.shopMode = 'sell';
  game.state.inventory = grantRewards(game.state.inventory, { stormcrown_shard: 3 }).inv;
  const html = shopScene.render(game);
  assert.match(html, /class="sell-scarce">rare drop<\/small>/);
  const row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="stormcrown_shard"'));
  assert.ok(row, 'stormcrown_shard sell row rendered');
  assert.match(row, /data-action="sell" data-arg="stormcrown_shard"/);
  assert.match(row, /aria-label="Sell 1 Stormcrown Shard \(rare drop, hard to replace\)"/);
  assert.ok(!row.includes('data-action="sellAll"'), 'Sell all suppressed for scarce stack');
  assert.match(row, /Sell 1<\/button>/);
});

test('ordinary stacks keep the Sell all button', () => {
  const game = fakeGame();
  game.shopMode = 'sell';
  game.state.inventory = grantRewards(game.state.inventory, { scrap_metal: 3 }).inv;
  const html = shopScene.render(game);
  const row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="scrap_metal"'));
  assert.ok(row, 'scrap_metal sell row rendered');
  assert.match(row, /data-action="sellAll" data-arg="scrap_metal"/);
  assert.ok(!row.includes('sell-scarce'), 'no rare-drop tag on ordinary materials');
});

test('sellAll action still works on scarce items when invoked directly', () => {
  const game = fakeGame();
  game.state.inventory = grantRewards(game.state.inventory, { stormcrown_shard: 2 }).inv;
  const goldBefore = game.state.gold;
  shopScene.actions.sellAll(game, { dataset: { arg: 'stormcrown_shard' } });
  assert.equal(game.state.gold, goldBefore + 120);
  assert.deepEqual(game.state.inventory, []);
  assert.match(game.shopMessage, /Sold Stormcrown Shard/);
});

test('scarce sell view is egg-free', () => {
  const game = fakeGame();
  game.shopMode = 'sell';
  game.state.inventory = grantRewards(game.state.inventory, { stormcrown_shard: 2 }).inv;
  const html = shopScene.render(game);
  assertEggFree(html, 'shop sell view with scarce tag');
});
