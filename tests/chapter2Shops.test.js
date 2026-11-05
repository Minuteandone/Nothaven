import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOPS, getShop, shopCatalog, buyItem } from '../src/items/shop.js';
import { ITEMS, getItem, isKnownItem } from '../src/items/items.js';
import { RECIPES, validateRecipes, craft } from '../src/items/crafting.js';
import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';
import { interactWith } from '../src/map/index.js';
import { ensureMapState } from '../src/map/mapState.js';

import { EGG_RE } from './eggGuard.mjs';

function fakeGame() {
  const game = {
    state: createInitialState(),
    shopMode: undefined,
    shopMessage: '',
    shopReturnScene: undefined,
    shopId: undefined,
    lastScene: null,
    registered: {},
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered[name] = scene; },
  };
  return game;
}

test('SHOPS registry keys map interactable ids and getShop rejects unknowns', () => {
  assert.deepEqual(Object.keys(SHOPS).sort(), ['greyhaven_shop', 'relay_outpost', 'saltmere_post', 'stormcrown_post', 'storms_eye_post']);
  assert.equal(getShop('saltmere_post').name, 'Saltmere Trading Post');
  assert.equal(getShop('constructor'), null);
  assert.equal(getShop(42), null);
  assert.equal(getShop(undefined), null);
});

test('every shop stock and recipe endpoint references known items', () => {
  validateRecipes();
  for (const [id, shop] of Object.entries(SHOPS)) {
    assert.ok(Array.isArray(shop.stock) && shop.stock.length > 0, id);
    for (const itemId of shop.stock) {
      assert.ok(isKnownItem(itemId), `${id} stocks unknown item ${itemId}`);
      assert.ok(ITEMS[itemId].price > 0, `${id} item ${itemId} has no price`);
    }
  }
  for (const r of RECIPES) {
    for (const side of ['inputs', 'outputs']) {
      for (const { id } of r[side]) assert.ok(isKnownItem(id), `${r.id} ${side} unknown ${id}`);
    }
  }
});

test('buyItem at Saltmere Trading Post spends gold and delivers the item', () => {
  const state = createInitialState();
  state.gold = 200;
  const res = buyItem(state, SHOPS.saltmere_post, 'tidebound_cutlass');
  assert.equal(res.ok, true);
  assert.equal(res.state.gold, 200 - getItem('tidebound_cutlass').price);
  assert.ok(res.state.inventory.some((s) => s.id === 'tidebound_cutlass' && s.qty === 1));
});

test('shop scene resolves shopId from onEnter data and falls back safely', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { shopId: 'saltmere_post', returnScene: 'explore' });
  assert.equal(game.shopId, 'saltmere_post');
  let html = shopScene.render(game);
  assert.match(html, /Saltmere Trading Post/);

  // town entry without data resets to Hesta's
  shopScene.onEnter(game, {});
  assert.equal(game.shopId, 'greyhaven_shop');
  html = shopScene.render(game);
  assert.match(html, /Hesta&#39;s Goods/);

  // hostile / unknown shopId falls back rather than crashing
  shopScene.onEnter(game, { shopId: 'constructor' });
  assert.equal(game.shopId, 'greyhaven_shop');
});

test('craft message names the current shop, not Hesta specifically', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { shopId: 'saltmere_post', returnScene: 'explore' });
  game.state.inventory = grantRewards(game.state.inventory, [{ id: 'bandage', qty: 2 }]).inv;
  shopScene.actions.craft(game, { dataset: { arg: 'pack_field_dressing' } });
  assert.match(game.shopMessage, /Saltmere Trading Post — crafted 1 Field Dressing\./);
  assert.ok(game.state.inventory.some((s) => s.id === 'field_dressing' && s.qty === 1));
  assert.equal(game.state.inventory.some((s) => s.id === 'bandage'), false);
});

test('chapter-two recipes craft atomically end to end', () => {
  const state = createInitialState();
  state.inventory = grantRewards(state.inventory, [
    { id: 'salvaged_blade', qty: 1 }, { id: 'scrap_metal', qty: 2 }, { id: 'storm_glass', qty: 1 },
  ]).inv;
  const res = craft(state.inventory, 'forge_cutlass');
  assert.equal(res.ok, true);
  state.inventory = res.inv;
  assert.ok(state.inventory.some((s) => s.id === 'tidebound_cutlass' && s.qty === 1));
  assert.equal(state.inventory.some((s) => s.id === 'salvaged_blade'), false);
  assert.equal(countOf(state.inventory, 'scrap_metal'), 0);

  state.inventory = grantRewards(state.inventory, [{ id: 'storm_tonic', qty: 1 }, { id: 'storm_glass', qty: 1 }]).inv;
  const res2 = craft(state.inventory, 'mull_highland_flask');
  assert.equal(res2.ok, true);
  state.inventory = res2.inv;
  assert.ok(state.inventory.some((s) => s.id === 'highland_flask' && s.qty === 1));
});

function countOf(inv, id) {
  return (inv || []).filter((s) => s && s.id === id).reduce((n, s) => n + s.qty, 0);
}

test('greyhaven shop interactable reports its shopId for the scene handoff', () => {
  const state = createInitialState();
  ensureMapState(state);
  state.map.x = 4; state.map.y = 5; // greyhaven_shop tile
  const res = interactWith(state, 'interact', 'greyhaven_shop', { ignoreProximity: true });
  assert.deepEqual(res.triggerShop, { shopId: 'greyhaven_shop' });
});

test('new chapter-two content carries no egg vocabulary', () => {
  const blob = [
    ...Object.values(ITEMS).flatMap((it) => [it.name, it.description || '']),
    ...RECIPES.flatMap((r) => [r.name, r.description]),
    ...Object.values(SHOPS).flatMap((sh) => [sh.name, sh.greeting]),
  ].join(' ');
  assert.ok(!EGG_RE.test(blob), 'no egg references in new items, recipes, or shops');
});

test('shop buy action uses the displayed shop stock, including safe fallback', () => {
  const game = fakeGame();
  game.state.gold = 200;
  shopScene.onEnter(game, { shopId: 'saltmere_post' });
  shopScene.actions.buy(game, { dataset: { arg: 'tidebound_cutlass' } });
  assert.equal(game.state.gold, 200 - getItem('tidebound_cutlass').price);
  assert.equal(countOf(game.state.inventory, 'tidebound_cutlass'), 1);
  const after = structuredClone(game.state);
  shopScene.actions.buy(game, { dataset: { arg: 'rusted_pipe' } });
  assert.deepEqual(game.state, after, 'coastal shop cannot sell Greyhaven-only stock');
  assert.match(game.shopMessage, /does not stock/);
  shopScene.onEnter(game, { shopId: 'constructor' });
  shopScene.actions.buy(game, { dataset: { arg: 'rusted_pipe' } });
  assert.equal(game.state.gold, after.gold - getItem('rusted_pipe').price);
  assert.equal(countOf(game.state.inventory, 'rusted_pipe'), 1);
});

test('saltmere post stocks an MP item and a shocked cure for squall revenants', () => {
  const stock = SHOPS.saltmere_post.stock.map(getItem);
  assert.ok(stock.some((it) => it.use && it.use.mp > 0), 'MP consumable in stock');
  assert.ok(stock.some((it) => it.use && it.use.cure === 'shocked'), 'shocked cure in stock');
});
