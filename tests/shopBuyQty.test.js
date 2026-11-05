import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { shopScene, SHOP_BUY_QTY_MAX } from '../src/scenes/shop.js';
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

function rationsRow(html) {
  return html.split('<tr>').find((chunk) => chunk.includes('data-arg="rations"')) || '';
}

test('SHOP_BUY_QTY_MAX is exported as 99', () => {
  assert.equal(SHOP_BUY_QTY_MAX, 99);
});

test('onEnter resets the buy quantity; default render shows a ×1 picker and plain Buy buttons', () => {
  const game = fakeGame();
  game.shopQty = 7;
  shopScene.onEnter(game, {});
  assert.equal(game.shopQty, 1);
  const html = shopScene.render(game);
  assert.ok(html.includes('shop-qty'), 'quantity picker present');
  assert.ok(html.includes('Buy quantity ×1'), 'picker shows ×1');
  assert.ok(rationsRow(html).includes('>Buy</button>'), 'plain Buy label at quantity 1');
  assert.ok(!rationsRow(html).includes('aria-label="Buy 1'), 'no redundant aria-label at quantity 1');
  assert.ok(!html.includes('undefined'), 'no undefined leaking into markup');
});

test('stepper clamps to 1..99 and ignores invalid args', () => {
  const game = fakeGame();
  game.shopQty = 1;
  shopScene.actions.shopQty(game, { dataset: { arg: 'dec' } });
  assert.equal(game.shopQty, 1, 'cannot go below 1');
  shopScene.actions.shopQty(game, { dataset: { arg: 'inc' } });
  assert.equal(game.shopQty, 2);
  shopScene.actions.shopQty(game, { dataset: { arg: 'sideways' } });
  assert.equal(game.shopQty, 2, 'invalid arg keeps the previous value');
  game.shopQty = SHOP_BUY_QTY_MAX;
  shopScene.actions.shopQty(game, { dataset: { arg: 'inc' } });
  assert.equal(game.shopQty, SHOP_BUY_QTY_MAX, 'cannot exceed the cap');
  shopScene.actions.shopQty(game, { dataset: { arg: 'dec' } });
  assert.equal(game.shopQty, SHOP_BUY_QTY_MAX - 1);
});

test('Buy purchases the picked quantity exactly', () => {
  const game = fakeGame();
  game.shopQty = 3;
  shopScene.actions.buy(game, { dataset: { arg: 'rations' } });
  assert.equal(game.state.gold, 2, '20 gold minus 3 × 6');
  assert.equal(countItem(game.state.inventory, 'rations'), 3);
  assert.equal(game.shopMessage, 'Bought Trail Rations x3 for 18 gold.');
});

test('an unaffordable picked quantity fails without changing state', () => {
  const game = fakeGame();
  game.shopQty = 4;
  shopScene.actions.buy(game, { dataset: { arg: 'rations' } });
  assert.equal(game.shopMessage, 'Not enough gold (need 24, have 20).');
  assert.equal(game.state.gold, 20);
  assert.equal(countItem(game.state.inventory, 'rations'), 0);
});

test('Buy 5 and Buy & equip ignore the picker', () => {
  const game = fakeGame();
  game.shopQty = 1;
  shopScene.actions.buy5(game, { dataset: { arg: 'rations' } });
  assert.match(game.shopMessage, /x3/, 'buy 5 stocks up to five as gold allows (3 × 6g = 18)');
  assert.equal(game.state.gold, 2);

  const game2 = fakeGame();
  game2.shopQty = 3;
  shopScene.actions.buyEquip(game2, { dataset: { arg: 'padded_vest' } });
  assert.equal(game2.shopMessage, 'Bought and equipped Padded Vest.');
  assert.equal(game2.state.gold, 0, 'exactly one vest bought (20 gold, all the starting purse)');
  assert.equal(countItem(game2.state.inventory, 'padded_vest'), 0, 'no spare stack');
  assert.equal(game2.state.party[0].equipment.armor, 'padded_vest');
});

test('picker renders only on the Buy tab and persists across tab switches until re-entry', () => {
  const game = fakeGame();
  shopScene.onEnter(game, {});
  game.shopQty = 5;
  shopScene.actions.setMode(game, { dataset: { arg: 'sell' } });
  const sellHtml = shopScene.render(game);
  assert.ok(!sellHtml.includes('shop-qty'), 'no picker on the sell tab');
  shopScene.actions.setMode(game, { dataset: { arg: 'buy' } });
  assert.equal(game.shopQty, 5, 'tab switches keep the picked quantity');
  assert.ok(shopScene.render(game).includes('Buy quantity ×5'));
  shopScene.onEnter(game, {});
  assert.equal(game.shopQty, 1, 're-entering the shop resets it');
});

test('Buy button label and aria-label reflect the picked quantity', () => {
  const game = fakeGame();
  game.shopQty = 4;
  const html = shopScene.render(game);
  const row = rationsRow(html);
  assert.ok(row.includes('>Buy ×4</button>'), 'label shows the multiplier');
  assert.ok(row.includes('aria-label="Buy 4 Trail Rations"'), 'aria-label names the quantity');
});

test('buy-mode render stays egg-free with the picker present', () => {
  const game = fakeGame();
  game.shopQty = 7;
  assertEggFree(shopScene.render(game));
});
