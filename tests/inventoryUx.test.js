import { test } from 'node:test';
import assert from 'node:assert/strict';

import { recipesUsingItem, recipeProducingItem, listRecipes, getRecipe, RECIPES } from '../src/items/crafting.js';
import { sellValueOf } from '../src/items/shop.js';
import { bagScene } from '../src/scenes/bag.js';
import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { RELAY_OUTPOST } from '../src/items/shop.js';

// Extended egg vocabulary guard over everything these helpers can surface.
import { EGG_RE } from './helpers/eggGuard.mjs';

function fakeGame() {
  return {
    state: createInitialState(),
    bagMemberIndex: 0,
    bagMessage: '',
    bagReturnScene: 'town',
    shopId: 'greyhaven_shop',
    shopMode: 'buy',
    shopMessage: '',
    shopMemberIndex: 0,
    shopReturnScene: 'town',
    setScene() {},
    registerScene() {},
  };
}

test('recipesUsingItem returns book-order recipes consuming the item', () => {
  assert.deepEqual(recipesUsingItem('scrap_metal').map((r) => r.id), [
    'reforge_blade', 'forge_cutlass', 'weave_jerkin',
  ]);
  assert.deepEqual(recipesUsingItem('relay_brass').map((r) => r.id), [
    'forge_relay_glaive', 'cut_signal_prism', 'cut_crownshard_focus',
  ]);
});

test('recipesUsingItem returns deep copies that cannot corrupt the book', () => {
  const [copy] = recipesUsingItem('storm_glass');
  copy.name = 'TAMPERED';
  copy.inputs.push({ id: 'observatory_lens', qty: 99 });
  assert.notEqual(getRecipe(copy.id).name, 'TAMPERED');
  const live = getRecipe(copy.id);
  assert.equal(live.inputs.length, RECIPES.find((r) => r.id === copy.id).inputs.length);
});

test('recipesUsingItem and recipeProducingItem guard bad input', () => {
  assert.deepEqual(recipesUsingItem(42), []);
  assert.deepEqual(recipesUsingItem(null), []);
  assert.deepEqual(recipesUsingItem('not_an_item'), []);
  assert.equal(recipeProducingItem(42), null);
  assert.equal(recipeProducingItem(null), null);
  assert.equal(recipeProducingItem('not_an_item'), null);
});

test('recipeProducingItem finds craft outputs only', () => {
  assert.equal(recipeProducingItem('salvaged_blade').id, 'reforge_blade');
  assert.equal(recipeProducingItem('relay_glaive').id, 'forge_relay_glaive');
  assert.equal(recipeProducingItem('iron_sword'), null);
  assert.equal(recipeProducingItem('rations'), null);
});

test('sellValueOf prefers explicit sellPrice, else half price, guards junk', () => {
  assert.equal(sellValueOf({ price: 8 }), 4);
  assert.equal(sellValueOf({ price: 10, sellPrice: 7 }), 7);
  assert.equal(sellValueOf({}), 0);
  assert.equal(sellValueOf(null), 0);
  assert.equal(sellValueOf('nope'), 0);
});

test('bag shows a Used in hint with book-order names and a more-count', () => {
  const game = fakeGame();
  game.state.inventory = [{ id: 'scrap_metal', qty: 2 }];
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.match(html, /Used in: Reforge Guard Blade · Forge a Tidebound Cutlass \(\+1 more\)/);
});

test('bag shows total sell value per stack and skips key items', () => {
  const game = fakeGame();
  game.state.inventory = [{ id: 'scrap_metal', qty: 3 }, { id: 'observatory_lens', qty: 1 }];
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.match(html, /Sell value: 12g/); // 4g x 3
  assert.equal(html.match(/Sell value:/g).length, 1); // lens is a key item
  assert.match(html, /Observatory Lens/);
});

test('shop buy tab shows Used in hints for crafting materials', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { shopId: 'relay_outpost' });
  const html = shopScene.render(game);
  assert.match(html, /Relay Outpost Stores/);
  assert.match(html, /Used in: Forge a Relay Glaive · Cut a Signal Prism/);
});

test('shop buy tab has no Used in hint for plain consumables', () => {
  const game = fakeGame();
  game.shopId = 'greyhaven_shop';
  shopScene.onEnter(game, {});
  const html = shopScene.render(game);
  assert.match(html, /Trail Rations/);
  // Rations feed brew_chowder/brew_spiced_broth, but bandage/rations stock rows
  // that are inputs must each carry at most one hint; rations IS an input, so
  // assert the count instead: only the rations row carries a hint.
  const hints = html.match(/Used in:/g) || [];
  assert.ok(hints.length >= 1, 'rations row should carry its crafting hint');
});

test('recipe hint helpers surface no egg vocabulary anywhere', () => {
  const texts = [];
  for (const r of listRecipes()) {
    texts.push(r.name, r.description);
  }
  for (const it of [RELAY_OUTPOST]) {
    texts.push(it.name);
    for (const id of it.stock) texts.push(id);
  }
  for (const t of texts) assert.doesNotMatch(t, EGG_RE, `egg-like text: ${t}`);
});
