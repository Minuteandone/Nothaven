import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { shopScene, SHOP_BUY_QTY_MAX } from '../src/scenes/shop.js';
import { addItem } from '../src/items/inventory.js';
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

function sellModeGame(qty = 1) {
  const game = fakeGame();
  shopScene.onEnter(game, { mode: 'sell' });
  game.shopQty = qty;
  return game;
}

function rowFor(html, id) {
  return html.split('<tr>').find((chunk) => chunk.includes(`data-arg="${id}"`)) || '';
}

test('sell tab shows its own quantity picker when there is something to sell', () => {
  const game = sellModeGame();
  game.state.inventory = addItem(game.state.inventory, 'rations', 3).inv;
  const html = shopScene.render(game);
  assert.ok(html.includes('shop-qty'), 'picker present on the sell tab');
  assert.ok(html.includes('Sell quantity ×1'), 'sell picker shows ×1');
  assert.ok(html.includes('aria-label="Sell quantity"'), 'group is labelled for the sell tab');
  assert.ok(html.includes('Sell N button sells this many'), 'explain line present');
  assert.ok(!html.includes('Buy quantity'), 'no buy wording on the sell tab');
  assert.ok(!html.includes('undefined'), 'no undefined leaking into markup');
});

test('sell tab with an empty bag shows no picker', () => {
  const game = sellModeGame();
  const html = shopScene.render(game);
  assert.ok(html.includes('You carry nothing'), 'empty-bag message');
  assert.ok(!html.includes('shop-qty'), 'no picker without sellable stacks');
});

test('the picked quantity is shared across tabs and resets on re-entry', () => {
  const game = fakeGame();
  shopScene.onEnter(game, {});
  game.shopQty = 4;
  shopScene.actions.setMode(game, { dataset: { arg: 'sell' } });
  game.state.inventory = addItem(game.state.inventory, 'rations', 2).inv;
  assert.ok(shopScene.render(game).includes('Sell quantity ×4'), 'sell tab inherits the picker value');
  shopScene.actions.setMode(game, { dataset: { arg: 'buy' } });
  assert.equal(game.shopQty, 4, 'tab switches keep the picked quantity');
  shopScene.onEnter(game, {});
  assert.equal(game.shopQty, 1, 're-entering the shop resets it');
});

test('Sell N sells the picked quantity from a stack and pays the stack total', () => {
  const game = sellModeGame(2);
  game.state.inventory = addItem(game.state.inventory, 'rations', 3).inv;
  shopScene.actions.sellQty(game, { dataset: { arg: 'rations' } });
  assert.equal(game.shopMessage, 'Sold Trail Rations x2 for 4 gold.');
  assert.equal(game.state.gold, 24, '20 gold plus 2 × 2');
  assert.equal(countItem(game.state.inventory, 'rations'), 1, 'partial stack remains');
});

test('Sell N clamps to the stack size and empties the stack entirely at most', () => {
  const game = sellModeGame(SHOP_BUY_QTY_MAX);
  game.state.inventory = addItem(game.state.inventory, 'rations', 4).inv;
  shopScene.actions.sellQty(game, { dataset: { arg: 'rations' } });
  assert.equal(game.shopMessage, 'Sold Trail Rations x4 for 8 gold.');
  assert.equal(countItem(game.state.inventory, 'rations'), 0, 'stack entry removed');
  assert.equal(game.state.gold, 28);
});

test('Sell N button labels and disabled state follow the picker', () => {
  const game = sellModeGame(2);
  game.state.inventory = addItem(game.state.inventory, 'rations', 3).inv;
  let row = rowFor(shopScene.render(game), 'rations');
  assert.ok(row.includes('>Sell 2 (4g)</button>'), 'label names the picked count and payout');
  assert.ok(row.includes('aria-label="Sell 2 Trail Rations"'), 'aria-label names quantity and item');
  assert.ok(!row.includes('data-action="sellQty" data-arg="rations" aria-label="Sell 2 Trail Rations" disabled'), 'enabled at 2 of 3');
  game.shopQty = 3;
  row = rowFor(shopScene.render(game), 'rations');
  assert.ok(row.includes('data-action="sellQty" data-arg="rations" aria-label="Sell 3 Trail Rations" disabled'), 'disabled when the picker covers the whole stack');
  game.shopQty = 1;
  row = rowFor(shopScene.render(game), 'rations');
  assert.ok(!row.includes('sellQty'), 'no Sell N button at quantity 1');
});

test('rare drops get no Sell N button and the action refuses them outright', () => {
  const game = sellModeGame(5);
  game.state.inventory = addItem(game.state.inventory, 'stormcrown_shard', 2).inv;
  const html = shopScene.render(game);
  const row = rowFor(html, 'stormcrown_shard');
  assert.ok(row.includes('sell-scarce'), 'rare-drop marker still shown');
  assert.ok(!row.includes('sellQty'), 'no Sell N button for rare drops');
  assert.ok(!row.includes('sellAll'), 'Sell all still suppressed for rare drops');
  shopScene.actions.sellQty(game, { dataset: { arg: 'stormcrown_shard' } });
  assert.equal(game.shopMessage, 'Rare drops can only be sold one at a time.');
  assert.equal(countItem(game.state.inventory, 'stormcrown_shard'), 2, 'nothing sold');
  assert.equal(game.state.gold, 20);
});

test('Sell N guards: no arg, unknown or absent stacks are safe no-ops', () => {
  const game = sellModeGame(3);
  shopScene.actions.sellQty(game, { dataset: {} });
  assert.equal(game.shopMessage, '', 'no arg is a no-op');
  shopScene.actions.sellQty(game, { dataset: { arg: 'not_an_item' } });
  assert.equal(game.shopMessage, 'Nothing left to sell.');
  shopScene.actions.sellQty(game, { dataset: { arg: 'rations' } });
  assert.equal(game.shopMessage, 'Nothing left to sell.', 'known id with no stack');
  assert.equal(game.state.gold, 20, 'gold untouched');
});

test('Sell 1 and Sell all keep working beside the picker', () => {
  const game = sellModeGame(3);
  game.state.inventory = addItem(game.state.inventory, 'rations', 4).inv;
  shopScene.actions.sell(game, { dataset: { arg: 'rations' } });
  assert.equal(game.shopMessage, 'Sold Trail Rations x1 for 2 gold.');
  shopScene.actions.sellAll(game, { dataset: { arg: 'rations' } });
  assert.equal(game.shopMessage, 'Sold Trail Rations x3 for 6 gold.');
  assert.equal(countItem(game.state.inventory, 'rations'), 0);
  assert.equal(game.state.gold, 28);
});

test('sell-mode render stays egg-free with ordinary and rare stacks present', () => {
  const game = sellModeGame(7);
  game.state.inventory = addItem(game.state.inventory, 'rations', 2).inv;
  game.state.inventory = addItem(game.state.inventory, 'stormcrown_shard', 1).inv;
  assertEggFree(shopScene.render(game));
});
