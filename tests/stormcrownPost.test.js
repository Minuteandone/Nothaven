import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOPS, getShop, buyItem } from '../src/items/shop.js';
import { ITEMS, getItem, isKnownItem } from '../src/items/items.js';
import { RECIPES, validateRecipes, craft } from '../src/items/crafting.js';
import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';

const EGG_RE = /\b(eggs?|yolks?|shells?|hatch\w*|nests?|chicks?|chickens?|hens?|omelet\w*|scrambl\w*|humpty|benedict|faberg\w*|clutch|incubat\w*|ovum|oeuf|huevo|quail|poach\w*|fried|devil\w*|albumen|easter|roosters?|goose|oval|ovoid|sunny|boil\w*|crack\w*|whisk|cackl\w*|pearl|golden|basket|peeps?|quiche|meringue|custard|frittata)\b/i;

const NEW_ITEM_IDS = ['ember_broth', 'skyward_flask', 'stormforged_blade', 'stormcrown_plate', 'crownshard_focus'];
const NEW_RECIPE_IDS = ['forge_stormforged_blade', 'hammer_stormcrown_plate', 'cut_crownshard_focus', 'distill_skyward_flask'];

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

test('SHOPS registry includes stormcrown_post and getShop rejects unknowns', () => {
  assert.deepEqual(Object.keys(SHOPS).sort(), ['greyhaven_shop', 'relay_outpost', 'saltmere_post', 'stormcrown_post', 'storms_eye_post']);
  assert.equal(getShop('stormcrown_post').name, 'Stormcrown Trading Post');
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

test('buyItem at the Stormcrown post delivers gear and raw Thunder Iron', () => {
  const state = createInitialState();
  state.gold = 900;
  const gear = buyItem(state, SHOPS.stormcrown_post, 'stormforged_blade');
  assert.equal(gear.ok, true);
  assert.equal(gear.state.gold, 900 - getItem('stormforged_blade').price);
  assert.ok(gear.state.inventory.some((s) => s.id === 'stormforged_blade' && s.qty === 1));

  const mats = buyItem(gear.state, SHOPS.stormcrown_post, 'thunder_iron', 3);
  assert.equal(mats.ok, true);
  assert.equal(mats.state.gold, gear.state.gold - 3 * getItem('thunder_iron').price);
  assert.equal(countOf(mats.state.inventory, 'thunder_iron'), 3);

  // the crown shard itself is boss-only: never stocked
  assert.ok(!SHOPS.stormcrown_post.stock.includes('stormcrown_shard'));
});

test('shop scene resolves stormcrown_post shopId and falls back safely', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { shopId: 'stormcrown_post', returnScene: 'explore' });
  assert.equal(game.shopId, 'stormcrown_post');
  let html = shopScene.render(game);
  assert.match(html, /Stormcrown Trading Post/);

  // town entry without data resets to Hesta's
  shopScene.onEnter(game, {});
  assert.equal(game.shopId, 'greyhaven_shop');
  html = shopScene.render(game);
  assert.match(html, /Hesta&#39;s Goods/);

  // hostile / unknown shopId falls back rather than crashing
  shopScene.onEnter(game, { shopId: 'constructor' });
  assert.equal(game.shopId, 'greyhaven_shop');
});

test('craft message names the Stormcrown stall', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { shopId: 'stormcrown_post', returnScene: 'explore' });
  game.state.inventory = grantRewards(game.state.inventory, [
    { id: 'highland_flask', qty: 1 }, { id: 'storm_glass', qty: 2 },
  ]).inv;
  shopScene.actions.craft(game, { dataset: { arg: 'distill_skyward_flask' } });
  assert.match(game.shopMessage, /Stormcrown Trading Post — crafted 1 Skyward Flask\./);
  assert.ok(game.state.inventory.some((s) => s.id === 'skyward_flask' && s.qty === 1));
  assert.equal(countOf(game.state.inventory, 'highland_flask'), 0);
  assert.equal(countOf(game.state.inventory, 'storm_glass'), 0);
});

test('chapter-four recipes craft atomically end to end', () => {
  const state = createInitialState();

  // forge_stormforged_blade: salvaged_blade + 3 thunder_iron
  state.inventory = grantRewards(state.inventory, [
    { id: 'salvaged_blade', qty: 1 }, { id: 'thunder_iron', qty: 3 },
  ]).inv;
  let res = craft(state.inventory, 'forge_stormforged_blade');
  assert.equal(res.ok, true);
  state.inventory = res.inv;
  assert.equal(countOf(state.inventory, 'stormforged_blade'), 1);
  assert.equal(countOf(state.inventory, 'salvaged_blade'), 0);
  assert.equal(countOf(state.inventory, 'thunder_iron'), 0);

  // hammer_stormcrown_plate: frostward_cloak + 3 thunder_iron
  state.inventory = grantRewards(state.inventory, [
    { id: 'frostward_cloak', qty: 1 }, { id: 'thunder_iron', qty: 3 },
  ]).inv;
  res = craft(state.inventory, 'hammer_stormcrown_plate');
  assert.equal(res.ok, true);
  state.inventory = res.inv;
  assert.equal(countOf(state.inventory, 'stormcrown_plate'), 1);
  assert.equal(countOf(state.inventory, 'frostward_cloak'), 0);

  // cut_crownshard_focus: lens_shard + stormcrown_shard + relay_brass
  state.inventory = grantRewards(state.inventory, [
    { id: 'lens_shard', qty: 1 }, { id: 'stormcrown_shard', qty: 1 }, { id: 'relay_brass', qty: 1 },
  ]).inv;
  res = craft(state.inventory, 'cut_crownshard_focus');
  assert.equal(res.ok, true);
  state.inventory = res.inv;
  assert.equal(countOf(state.inventory, 'crownshard_focus'), 1);
  assert.equal(countOf(state.inventory, 'stormcrown_shard'), 0);

  // distill_skyward_flask covered by the craft-message test above
});

test('stormcrown post buy action uses its own stock, including safe fallback', () => {
  const game = fakeGame();
  game.state.gold = 900;
  shopScene.onEnter(game, { shopId: 'stormcrown_post' });
  shopScene.actions.buy(game, { dataset: { arg: 'crownshard_focus' } });
  assert.equal(game.state.gold, 900 - getItem('crownshard_focus').price);
  assert.equal(countOf(game.state.inventory, 'crownshard_focus'), 1);

  const after = structuredClone(game.state);
  shopScene.actions.buy(game, { dataset: { arg: 'rusted_pipe' } });
  assert.deepEqual(game.state, after, 'stormcrown post cannot sell Greyhaven-only stock');
  assert.match(game.shopMessage, /does not stock/);

  shopScene.onEnter(game, { shopId: 'constructor' });
  shopScene.actions.buy(game, { dataset: { arg: 'rusted_pipe' } });
  assert.equal(game.state.gold, after.gold - getItem('rusted_pipe').price);
  assert.equal(countOf(game.state.inventory, 'rusted_pipe'), 1);
});

test('new chapter-four shop content carries no egg vocabulary', () => {
  const parts = [];
  for (const id of NEW_ITEM_IDS) {
    const it = getItem(id);
    parts.push(it.name, it.description || '');
  }
  for (const rid of NEW_RECIPE_IDS) {
    const r = RECIPES.find((x) => x.id === rid);
    parts.push(r.name, r.description);
  }
  parts.push(SHOPS.stormcrown_post.name, SHOPS.stormcrown_post.greeting);
  const blob = parts.join(' ');
  assert.ok(!EGG_RE.test(blob), `egg reference found in chapter-four content: ${blob.match(EGG_RE)}`);
});
