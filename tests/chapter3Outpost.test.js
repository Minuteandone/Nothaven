import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOPS, getShop, buyItem } from '../src/items/shop.js';
import { ITEMS, getItem, isKnownItem } from '../src/items/items.js';
import { RECIPES, validateRecipes, craft } from '../src/items/crafting.js';
import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';

const EGG_RE = /\b(eggs?|yolks?|shells?|hatch\w*|nests?|chicks?|chickens?|hens?|omelet\w*|scrambl\w*|humpty|benedict|faberg\w*|clutch|incubat\w*|ovum|oeuf|huevo|quail|poach\w*|fried|devil\w*|albumen|easter|roosters?|goose|oval|ovoid|sunny|boil\w*|crack\w*|whisk|cackl\w*|pearl|golden|basket|peeps?|quiche|meringue|custard|frittata)\b/i;

const NEW_ITEM_IDS = ['spiced_broth', 'relay_glaive', 'sunscar_mantle', 'signal_prism'];
const NEW_RECIPE_IDS = ['forge_relay_glaive', 'weave_sunscar_mantle', 'cut_signal_prism', 'brew_spiced_broth'];

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

function countOf(inv, id) {
  return (inv || []).filter((s) => s && s.id === id).reduce((n, s) => n + s.qty, 0);
}

test('SHOPS registry includes relay_outpost and getShop rejects unknowns', () => {
  assert.deepEqual(Object.keys(SHOPS).sort(), ['greyhaven_shop', 'relay_outpost', 'saltmere_post']);
  assert.equal(getShop('relay_outpost').name, 'Relay Outpost Stores');
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

test('buyItem at Relay Outpost delivers gear and raw materials', () => {
  const state = createInitialState();
  state.gold = 400;
  const gear = buyItem(state, SHOPS.relay_outpost, 'relay_glaive');
  assert.equal(gear.ok, true);
  assert.equal(gear.state.gold, 400 - getItem('relay_glaive').price);
  assert.ok(gear.state.inventory.some((s) => s.id === 'relay_glaive' && s.qty === 1));

  const mats = buyItem(gear.state, SHOPS.relay_outpost, 'relay_brass', 2);
  assert.equal(mats.ok, true);
  assert.equal(mats.state.gold, gear.state.gold - 2 * getItem('relay_brass').price);
  assert.equal(countOf(mats.state.inventory, 'relay_brass'), 2);
});

test('shop scene resolves relay_outpost shopId and falls back safely', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { shopId: 'relay_outpost', returnScene: 'explore' });
  assert.equal(game.shopId, 'relay_outpost');
  let html = shopScene.render(game);
  assert.match(html, /Relay Outpost Stores/);

  // town entry without data resets to Hesta's
  shopScene.onEnter(game, {});
  assert.equal(game.shopId, 'greyhaven_shop');
  html = shopScene.render(game);
  assert.match(html, /Hesta&#39;s Goods/);

  // hostile / unknown shopId falls back rather than crashing
  shopScene.onEnter(game, { shopId: 'constructor' });
  assert.equal(game.shopId, 'greyhaven_shop');
});

test('craft message names the Relay Outpost quartermaster stall', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { shopId: 'relay_outpost', returnScene: 'explore' });
  game.state.inventory = grantRewards(game.state.inventory, [
    { id: 'hearty_chowder', qty: 1 }, { id: 'rations', qty: 1 },
  ]).inv;
  shopScene.actions.craft(game, { dataset: { arg: 'brew_spiced_broth' } });
  assert.match(game.shopMessage, /Relay Outpost Stores — crafted 1 Spiced Broth\./);
  assert.ok(game.state.inventory.some((s) => s.id === 'spiced_broth' && s.qty === 1));
  assert.equal(countOf(game.state.inventory, 'hearty_chowder'), 0);
  assert.equal(countOf(game.state.inventory, 'rations'), 0);
});

test('chapter-three recipes craft atomically end to end', () => {
  const state = createInitialState();

  // forge_relay_glaive: salvaged_blade + 2 relay_brass + storm_glass
  state.inventory = grantRewards(state.inventory, [
    { id: 'salvaged_blade', qty: 1 }, { id: 'relay_brass', qty: 2 }, { id: 'storm_glass', qty: 1 },
  ]).inv;
  let res = craft(state.inventory, 'forge_relay_glaive');
  assert.equal(res.ok, true);
  state.inventory = res.inv;
  assert.equal(countOf(state.inventory, 'relay_glaive'), 1);
  assert.equal(countOf(state.inventory, 'salvaged_blade'), 0);
  assert.equal(countOf(state.inventory, 'relay_brass'), 0);

  // weave_sunscar_mantle: frostward_cloak + 2 sunscar_glass
  state.inventory = grantRewards(state.inventory, [
    { id: 'frostward_cloak', qty: 1 }, { id: 'sunscar_glass', qty: 2 },
  ]).inv;
  res = craft(state.inventory, 'weave_sunscar_mantle');
  assert.equal(res.ok, true);
  state.inventory = res.inv;
  assert.equal(countOf(state.inventory, 'sunscar_mantle'), 1);
  assert.equal(countOf(state.inventory, 'frostward_cloak'), 0);

  // cut_signal_prism: lens_shard + 2 relay_brass
  state.inventory = grantRewards(state.inventory, [
    { id: 'lens_shard', qty: 1 }, { id: 'relay_brass', qty: 2 },
  ]).inv;
  res = craft(state.inventory, 'cut_signal_prism');
  assert.equal(res.ok, true);
  state.inventory = res.inv;
  assert.equal(countOf(state.inventory, 'signal_prism'), 1);
  assert.equal(countOf(state.inventory, 'lens_shard'), 0);

  // brew_spiced_broth: hearty_chowder + rations
  state.inventory = grantRewards(state.inventory, [
    { id: 'hearty_chowder', qty: 1 }, { id: 'rations', qty: 1 },
  ]).inv;
  res = craft(state.inventory, 'brew_spiced_broth');
  assert.equal(res.ok, true);
  state.inventory = res.inv;
  assert.equal(countOf(state.inventory, 'spiced_broth'), 1);
});

test('relay outpost buy action uses its own stock, including safe fallback', () => {
  const game = fakeGame();
  game.state.gold = 500;
  shopScene.onEnter(game, { shopId: 'relay_outpost' });
  shopScene.actions.buy(game, { dataset: { arg: 'signal_prism' } });
  assert.equal(game.state.gold, 500 - getItem('signal_prism').price);
  assert.equal(countOf(game.state.inventory, 'signal_prism'), 1);

  const after = structuredClone(game.state);
  shopScene.actions.buy(game, { dataset: { arg: 'rusted_pipe' } });
  assert.deepEqual(game.state, after, 'relay outpost cannot sell Greyhaven-only stock');
  assert.match(game.shopMessage, /does not stock/);

  shopScene.onEnter(game, { shopId: 'constructor' });
  shopScene.actions.buy(game, { dataset: { arg: 'rusted_pipe' } });
  assert.equal(game.state.gold, after.gold - getItem('rusted_pipe').price);
  assert.equal(countOf(game.state.inventory, 'rusted_pipe'), 1);
});

test('new chapter-three content carries no egg vocabulary', () => {
  const parts = [];
  for (const id of NEW_ITEM_IDS) {
    const it = getItem(id);
    parts.push(it.name, it.description || '');
  }
  for (const rid of NEW_RECIPE_IDS) {
    const r = RECIPES.find((x) => x.id === rid);
    parts.push(r.name, r.description);
  }
  parts.push(SHOPS.relay_outpost.name, SHOPS.relay_outpost.greeting);
  const blob = parts.join(' ');
  assert.ok(!EGG_RE.test(blob), `egg reference found in chapter-three content: ${blob.match(EGG_RE)}`);
});
