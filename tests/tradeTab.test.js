import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';
import { getItem } from '../src/items/items.js';
import {
  TRADES,
  TRADE_LOCATIONS,
  tradesFor,
  getTrade,
  tradeLoss,
  tradeInputsMet,
  performTrade,
  assertTradeCatalogue,
} from '../src/items/trade.js';
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

test('trade catalogue passes its own invariants and is frozen', () => {
  assertTradeCatalogue();
  assert.ok(Object.isFrozen(TRADES));
  for (const trade of TRADES) {
    assert.ok(Object.isFrozen(trade));
    assert.ok(tradeLoss(trade) > 0, `trade must be lossy: ${trade.id}`);
  }
});

test('only trading posts offer the Trade tab, with the full catalogue', () => {
  assert.equal(tradesFor('greyhaven_shop').length, 0);
  assert.equal(tradesFor('storms_eye_post').length, 0);
  assert.equal(tradesFor('stormcrown_post').length, 0);
  assert.equal(tradesFor('saltmere_post').length, TRADES.length);
  assert.equal(tradesFor('relay_outpost').length, TRADES.length);
  assert.equal(tradesFor('not_a_shop').length, 0);
  assert.deepEqual(TRADE_LOCATIONS, ['saltmere_post', 'relay_outpost']);
});

test('getTrade resolves known ids and nulls unknown ones', () => {
  assert.equal(getTrade('scrap_to_glass').id, 'scrap_to_glass');
  assert.equal(getTrade('made_up_trade'), null);
});

test('tradeInputsMet reports shortfalls in give order', () => {
  const inv = [{ id: 'scrap_metal', qty: 2 }];
  const res = tradeInputsMet(inv, getTrade('scrap_to_glass'));
  assert.equal(res.ok, false);
  assert.deepEqual(res.missing, [{ id: 'scrap_metal', have: 2, qty: 4 }]);
  const ok = tradeInputsMet([{ id: 'scrap_metal', qty: 5 }], getTrade('scrap_to_glass'));
  assert.equal(ok.ok, true);
  assert.deepEqual(ok.missing, []);
});

test('performTrade swaps materials atomically and reports the exchange', () => {
  const { inv } = grantRewards([], [{ id: 'scrap_metal', qty: 4 }]);
  const res = performTrade(inv, 'scrap_to_glass');
  assert.equal(res.ok, true);
  assert.match(res.message, /^Traded 4 Scrap Metal for 1 Storm Glass\.$/);
  assert.deepEqual(res.inv, [{ id: 'storm_glass', qty: 1 }]);
});

test('performTrade leaves the inventory untouched when short', () => {
  const { inv } = grantRewards([], [{ id: 'scrap_metal', qty: 2 }]);
  const before = JSON.stringify(inv);
  const res = performTrade(inv, 'scrap_to_glass');
  assert.equal(res.ok, false);
  assert.equal(res.message, 'Missing materials: scrap_metal (have 2, need 4).');
  assert.deepEqual(JSON.parse(JSON.stringify(res.inv)), JSON.parse(before));
  assert.deepEqual(res.inv, [{ id: 'scrap_metal', qty: 2 }]);
});

test('performTrade rejects unknown trade ids', () => {
  const res = performTrade([], 'made_up_trade');
  assert.equal(res.ok, false);
  assert.equal(res.message, 'Unknown trade: made_up_trade.');
});

test('trade shops render the Trade tab with offers, worth lines and shortfalls', () => {
  const game = fakeGame();
  enterShop(game, 'saltmere_post', 'trade');
  const html = shopScene.render(game);
  assert.ok(html.includes('data-action="setMode" data-arg="trade"'), 'Trade tab button present');
  assert.ok(html.includes('class="shop-trade"'), 'trade table rendered');
  assert.ok(html.includes('Worth 32g') && html.includes('32g &rarr; 25g'), 'scrap trade worth line');
  assert.ok(html.includes('Worth 36g') && html.includes('36g &rarr; 34g'), 'wiring trade worth line');
  const row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="scrap_to_glass"'));
  assert.ok(row, 'scrap trade row present');
  assert.match(row, /<button data-action="trade" data-arg="scrap_to_glass" disabled>/);
  assert.ok(row.includes('Needs: 4 Scrap Metal (have 0)'), 'shortfall text');
  assertEggFree(html, 'shop trade render');
});

test('afforded trades enable their buttons and drop the shortfall text', () => {
  const game = fakeGame();
  game.state.inventory = [{ id: 'scrap_metal', qty: 4 }];
  enterShop(game, 'saltmere_post', 'trade');
  const html = shopScene.render(game);
  const row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="scrap_to_glass"'));
  assert.ok(row);
  assert.ok(!row.includes('disabled'), 'button enabled when materials met');
  assert.ok(!row.includes('trade-shortfall'), 'no shortfall when met');
});

test('non-trade shops show no Trade tab anywhere', () => {
  const game = fakeGame();
  enterShop(game, 'greyhaven_shop');
  const html = shopScene.render(game);
  assert.ok(!html.includes('data-arg="trade"'));
  assert.ok(!html.includes('class="shop-trade"'));
  assertEggFree(html, 'greyhaven render');
});

test('onEnter accepts the trade mode and falls back safely without offers', () => {
  const game = fakeGame();
  enterShop(game, 'saltmere_post', 'trade');
  assert.equal(game.shopMode, 'trade');
  const html = shopScene.render(game);
  assert.ok(html.includes('class="shop-trade"'));

  const other = fakeGame();
  enterShop(other, 'greyhaven_shop', 'trade');
  const otherHtml = shopScene.render(other);
  assert.ok(otherHtml.includes('No trades are on offer right now.'));
  assert.ok(!otherHtml.includes('data-arg="trade"'));
});

test('setMode switches into the trade tab', () => {
  const game = fakeGame();
  enterShop(game, 'saltmere_post');
  shopScene.actions.setMode(game, { dataset: { arg: 'trade' } });
  assert.equal(game.shopMode, 'trade');
});

test('trade action performs the exchange and writes inventory back', () => {
  const game = fakeGame();
  game.state.inventory = [{ id: 'scrap_metal', qty: 4 }];
  enterShop(game, 'saltmere_post');
  shopScene.actions.trade(game, { dataset: { arg: 'scrap_to_glass' } });
  assert.match(game.shopMessage, /^Traded 4 Scrap Metal for 1 Storm Glass\.$/);
  assert.deepEqual(game.state.inventory, [{ id: 'storm_glass', qty: 1 }]);
});

test('trade action refuses trades not offered at the current shop', () => {
  const game = fakeGame();
  game.state.inventory = [{ id: 'scrap_metal', qty: 4 }];
  enterShop(game, 'greyhaven_shop');
  const before = JSON.stringify(game.state.inventory);
  shopScene.actions.trade(game, { dataset: { arg: 'scrap_to_glass' } });
  assert.equal(game.shopMessage, 'That trade is not offered here.');
  assert.deepEqual(JSON.parse(before), game.state.inventory);
});

test('trade action with no argument is a no-op', () => {
  const game = fakeGame();
  enterShop(game, 'saltmere_post');
  shopScene.actions.trade(game, {});
  assert.equal(game.shopMessage, '');
});

test('trade names hide no guarded vocabulary and carry no acrostic', () => {
  const names = TRADES.map((t) => t.name);
  assertEggFree(names.join(' | '), 'trade names');
  const initials = names.map((n) => n.trim()[0]).join('');
  assert.equal(initials, 'SW');
  // Every referenced item resolves to a real catalogue entry with prices.
  for (const trade of TRADES) {
    for (const stack of trade.give) assert.ok(getItem(stack.id)?.price > 0, stack.id);
    assert.ok(getItem(trade.receive.id)?.price > 0, trade.receive.id);
  }
});
