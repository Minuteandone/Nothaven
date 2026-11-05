import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { GREYHAVEN_SHOP, getShop, shopCatalog, buyUpTo } from '../src/items/shop.js';
import { getItem } from '../src/items/items.js';

import { EGG_RE } from './eggGuard.mjs';

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

test('buyUpTo buys the full cap when gold allows', () => {
  const state = createInitialState();
  state.gold = 300;
  const res = buyUpTo(state, GREYHAVEN_SHOP, 'storm_tonic', 5);
  assert.equal(res.ok, true);
  assert.equal(res.qty, 5);
  assert.equal(res.state.gold, 300 - 5 * getItem('storm_tonic').price);
  assert.deepEqual(res.state.inventory, [{ id: 'storm_tonic', qty: 5 }]);
  assert.match(res.message, /Bought Storm Tonic x5 for 110 gold\./);
});

test('buyUpTo buys only what gold affords when short of the cap', () => {
  const state = createInitialState();
  state.gold = 50;
  const res = buyUpTo(state, GREYHAVEN_SHOP, 'storm_tonic', 5);
  assert.equal(res.ok, true);
  assert.equal(res.qty, 2);
  assert.equal(res.state.gold, 6);
  assert.deepEqual(res.state.inventory, [{ id: 'storm_tonic', qty: 2 }]);
  assert.match(res.message, /Bought Storm Tonic x2 for 44 gold\./);
});

test('buyUpTo bulk-buys crafting materials at the Stormcrown post', () => {
  const state = createInitialState();
  state.gold = 200;
  const shop = getShop('stormcrown_post');
  assert.ok(shop, 'stormcrown post should be reachable through the registry');
  assert.ok(shop.stock.includes('thunder_iron'), 'thunder_iron is stocked there');
  const res = buyUpTo(state, shop, 'thunder_iron', 5);
  assert.equal(res.ok, true);
  assert.equal(res.qty, 4);
  assert.equal(res.state.gold, 200 - 4 * getItem('thunder_iron').price);
  assert.deepEqual(res.state.inventory, [{ id: 'thunder_iron', qty: 4 }]);
});

test('buyUpTo falls back to the canonical single-buy refusal when even one is unaffordable', () => {
  const state = createInitialState();
  state.gold = 10;
  const res = buyUpTo(state, GREYHAVEN_SHOP, 'storm_tonic', 5);
  assert.equal(res.ok, false);
  assert.match(res.message, /Not enough gold \(need 22, have 10\)\./);
  assert.equal(state.gold, 10, 'input state stays untouched');
});

test('buyUpTo rejects unstocked items and bad caps without changes', () => {
  const state = createInitialState();
  const unstocked = buyUpTo(state, GREYHAVEN_SHOP, 'keeper_coat', 5);
  assert.equal(unstocked.ok, false);
  assert.match(unstocked.message, /does not stock/);
  const badCap = buyUpTo(state, GREYHAVEN_SHOP, 'rations', 0);
  assert.equal(badCap.ok, false);
  assert.match(badCap.message, /not a quantity/);
  const badCap2 = buyUpTo(state, GREYHAVEN_SHOP, 'rations', 1.5);
  assert.equal(badCap2.ok, false);
  assert.deepEqual(state.inventory, []);
});

test('buyUpTo never mutates the caller state', () => {
  const state = createInitialState();
  state.gold = 120;
  const snapshot = structuredClone(state);
  const res = buyUpTo(state, GREYHAVEN_SHOP, 'healing_herb', 5);
  assert.equal(res.ok, true);
  assert.deepEqual(state, snapshot, 'buyUpTo returns new state instead of mutating');
});

test('shop buy rows offer Buy 5 with an accessible label and matching disabled state', () => {
  const game = fakeGame();
  game.shopMode = 'buy';
  const html = shopScene.render(game);
  assert.ok(html.includes('data-action="buy5" data-arg="rations"'), 'Buy 5 button per row');
  assert.ok(html.includes('aria-label="Buy 5 Trail Rations"'), 'accessible label names the item');
  const priceyRow = html.split('<tr>').find((chunk) => chunk.includes('data-arg="leather_armor"'));
  assert.ok(priceyRow, 'leather armor row rendered');
  const disabledCount = (priceyRow.match(/disabled/g) || []).length;
  assert.equal(disabledCount, 2, 'both Buy and Buy 5 disable when unaffordable');
  assert.ok(priceyRow.includes('data-action="buy5"'));
  const cheapRow = html.split('<tr>').find((chunk) => chunk.includes('data-arg="rations"'));
  assert.ok(!cheapRow.includes('disabled'), 'affordable rows enable both buttons');
});

test('buy5 scene action bulk-buys consumables through the shop scene', () => {
  const game = fakeGame();
  game.state.gold = 300;
  game.shopMode = 'buy';
  shopScene.actions.buy5(game, { dataset: { arg: 'storm_tonic' } });
  assert.equal(game.state.gold, 190);
  assert.deepEqual(game.state.inventory, [{ id: 'storm_tonic', qty: 5 }]);
  assert.equal(game.shopMessage, 'Bought Storm Tonic x5 for 110 gold.');
});

test('buy5 scene action buys a partial stack when gold runs short', () => {
  const game = fakeGame();
  game.state.gold = 50;
  game.shopMode = 'buy';
  shopScene.actions.buy5(game, { dataset: { arg: 'storm_tonic' } });
  assert.equal(game.state.gold, 6);
  assert.deepEqual(game.state.inventory, [{ id: 'storm_tonic', qty: 2 }]);
  assert.equal(game.shopMessage, 'Bought Storm Tonic x2 for 44 gold.');
});

test('buy5 scene action surfaces the refusal message when nothing is affordable', () => {
  const game = fakeGame();
  game.state.gold = 0;
  shopScene.actions.buy5(game, { dataset: { arg: 'leather_armor' } });
  assert.equal(game.state.gold, 0);
  assert.deepEqual(game.state.inventory, []);
  assert.match(game.shopMessage, /Not enough gold/);
});

test('bulk-buy UI and messages stay free of egg references', () => {
  const game = fakeGame();
  game.state.gold = 300;
  game.shopMode = 'buy';
  let html = shopScene.render(game);
  shopScene.actions.buy5(game, { dataset: { arg: 'storm_tonic' } });
  shopScene.actions.buy5(game, { dataset: { arg: 'leather_armor' } });
  const scanned = html.replace(/class="[^"]*"/g, '') + game.shopMessage;
  const rows = shopCatalog(GREYHAVEN_SHOP).map((r) => `${r.name} ${r.description}`).join(' ');
  assert.equal(EGG_RE.test(scanned), false, `egg reference leaked into shop UI: ${scanned.match(EGG_RE)?.[0]}`);
  assert.equal(EGG_RE.test(rows), false, `egg reference leaked into catalog data: ${rows.match(EGG_RE)?.[0]}`);
  html = '';
});
