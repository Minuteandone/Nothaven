import { test } from 'node:test';
import assert from 'node:assert/strict';

import { SHOPS, getShop, buyItem } from '../src/items/shop.js';
import { ITEMS, getItem, isKnownItem } from '../src/items/items.js';
import { RECIPES, validateRecipes, craft } from '../src/items/crafting.js';
import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';

const EGG_RE = /\b(eggs?|yolks?|shells?|hatch\w*|nests?|chicks?|chickens?|hens?|omelet\w*|scrambl\w*|humpty|benedict|faberg\w*|clutch|incubat\w*|ovum|oeuf|huevo|quail|poach\w*|fried|devil\w*|albumen|easter|roosters?|goose|oval|ovoid|sunny|boil\w*|crack\w*|whisk|cackl\w*|pearl|golden|basket|peeps?|quiche|meringue|custard|frittata)\b/i;

const NEW_ITEM_IDS = ['tempest_salve', 'tempest_edge', 'maelstrom_plate', 'stormeye_signet'];
const NEW_RECIPE_IDS = ['forge_tempest_edge', 'hammer_maelstrom_plate', 'cut_stormeye_signet'];

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

test('SHOPS registry includes storms_eye_post and getShop resolves it', () => {
  assert.deepEqual(Object.keys(SHOPS).sort(), ['greyhaven_shop', 'relay_outpost', 'saltmere_post', 'stormcrown_post', 'storms_eye_post']);
  assert.equal(getShop('storms_eye_post').name, "Storm's Eye Post");
  assert.ok(Array.isArray(SHOPS.storms_eye_post.stock) && SHOPS.storms_eye_post.stock.length === 5);
});

test('every storms-eye stock and recipe endpoint references known items', () => {
  validateRecipes();
  for (const itemId of SHOPS.storms_eye_post.stock) {
    assert.ok(isKnownItem(itemId), `storms_eye_post stocks unknown item ${itemId}`);
    assert.ok(ITEMS[itemId].price > 0, `${itemId} has no price`);
  }
  for (const rid of NEW_RECIPE_IDS) {
    const r = RECIPES.find((x) => x.id === rid);
    assert.ok(r, `missing recipe ${rid}`);
    for (const side of ['inputs', 'outputs']) {
      for (const { id } of r[side]) assert.ok(isKnownItem(id), `${rid} ${side} unknown ${id}`);
    }
  }
});

test('tempest-tier equipment escalates the chapter-four ladder', () => {
  const salve = getItem('tempest_salve');
  assert.equal(salve.type, ITEMS.tempest_salve.type);
  assert.deepEqual(salve.use, { hp: 75, cure: 'shocked' });

  const edge = getItem('tempest_edge');
  assert.equal(edge.slot, 'weapon');
  assert.equal(edge.stats.atk, 21);
  assert.ok(edge.stats.atk > getItem('stormforged_blade').stats.atk, 'tempest_edge must beat stormforged_blade');

  const plate = getItem('maelstrom_plate');
  assert.equal(plate.slot, 'armor');
  assert.equal(plate.stats.def, 15);
  assert.equal(plate.stats.hp, 14);
  assert.ok(plate.stats.def > getItem('stormcrown_plate').stats.def, 'maelstrom_plate must beat stormcrown_plate');

  const signet = getItem('stormeye_signet');
  assert.equal(signet.slot, 'trinket');
  assert.deepEqual(signet.stats, { mp: 8, spd: 3 });
});

test('crafting the tempest tier stays cheaper than buying direct', () => {
  const blade = getItem('stormforged_blade').price + 2 * getItem('thunder_iron').price;
  assert.ok(blade < getItem('tempest_edge').price, `forge_tempest_edge cost ${blade} must undercut direct price`);
  const plate = getItem('stormcrown_plate').price + 2 * getItem('thunder_iron').price;
  assert.ok(plate < getItem('maelstrom_plate').price, `hammer_maelstrom_plate cost ${plate} must undercut direct price`);
  const signet = getItem('crownshard_focus').price + getItem('storm_glass').price;
  assert.ok(signet < getItem('stormeye_signet').price, `cut_stormeye_signet cost ${signet} must undercut direct price`);
});

test('buyItem at the Storm\'s Eye post delivers gear, salve and raw Thunder Iron', () => {
  const state = createInitialState();
  state.gold = 1400;
  const gear = buyItem(state, SHOPS.storms_eye_post, 'tempest_edge');
  assert.equal(gear.ok, true);
  assert.equal(gear.state.gold, 1400 - getItem('tempest_edge').price);
  assert.ok(gear.state.inventory.some((s) => s.id === 'tempest_edge' && s.qty === 1));

  const salve = buyItem(gear.state, SHOPS.storms_eye_post, 'tempest_salve', 2);
  assert.equal(salve.ok, true);
  assert.equal(countOf(salve.state.inventory, 'tempest_salve'), 2);

  const mats = buyItem(salve.state, SHOPS.storms_eye_post, 'thunder_iron', 2);
  assert.equal(mats.ok, true);
  assert.equal(mats.state.gold, salve.state.gold - 2 * getItem('thunder_iron').price);
  assert.equal(countOf(mats.state.inventory, 'thunder_iron'), 2);
});

test('shop scene resolves storms_eye_post shopId and falls back safely', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { shopId: 'storms_eye_post', returnScene: 'explore' });
  assert.equal(game.shopId, 'storms_eye_post');
  let html = shopScene.render(game);
  assert.match(html, /Storm&#39;s Eye Post/);

  // town entry without data resets to Hesta's
  shopScene.onEnter(game, {});
  assert.equal(game.shopId, 'greyhaven_shop');
  html = shopScene.render(game);
  assert.match(html, /Hesta&#39;s Goods/);

  // hostile / unknown shopId falls back rather than crashing
  shopScene.onEnter(game, { shopId: 'constructor' });
  assert.equal(game.shopId, 'greyhaven_shop');
});

test('craft message names the Storm\'s Eye post', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { shopId: 'storms_eye_post', returnScene: 'explore' });
  game.state.inventory = grantRewards(game.state.inventory, [
    { id: 'stormforged_blade', qty: 1 }, { id: 'thunder_iron', qty: 2 },
  ]).inv;
  shopScene.actions.craft(game, { dataset: { arg: 'forge_tempest_edge' } });
  assert.match(game.shopMessage, /Storm's Eye Post — crafted 1 Tempest Edge\./);
  assert.ok(game.state.inventory.some((s) => s.id === 'tempest_edge' && s.qty === 1));
  assert.equal(countOf(game.state.inventory, 'stormforged_blade'), 0);
  assert.equal(countOf(game.state.inventory, 'thunder_iron'), 0);
});

test('storms-eye recipes craft atomically end to end', () => {
  const state = createInitialState();

  // forge_tempest_edge covered by the craft-message test above

  // hammer_maelstrom_plate: stormcrown_plate + 2 thunder_iron
  state.inventory = grantRewards(state.inventory, [
    { id: 'stormcrown_plate', qty: 1 }, { id: 'thunder_iron', qty: 2 },
  ]).inv;
  let res = craft(state.inventory, 'hammer_maelstrom_plate');
  assert.equal(res.ok, true);
  state.inventory = res.inv;
  assert.equal(countOf(state.inventory, 'maelstrom_plate'), 1);
  assert.equal(countOf(state.inventory, 'stormcrown_plate'), 0);
  assert.equal(countOf(state.inventory, 'thunder_iron'), 0);

  // cut_stormeye_signet: crownshard_focus + storm_glass
  state.inventory = grantRewards(state.inventory, [
    { id: 'crownshard_focus', qty: 1 }, { id: 'storm_glass', qty: 1 },
  ]).inv;
  res = craft(state.inventory, 'cut_stormeye_signet');
  assert.equal(res.ok, true);
  state.inventory = res.inv;
  assert.equal(countOf(state.inventory, 'stormeye_signet'), 1);
  assert.equal(countOf(state.inventory, 'crownshard_focus'), 0);
  assert.equal(countOf(state.inventory, 'storm_glass'), 0);
});

test('storms-eye post buy action uses its own stock, including safe fallback', () => {
  const game = fakeGame();
  game.state.gold = 900;
  shopScene.onEnter(game, { shopId: 'storms_eye_post' });
  shopScene.actions.buy(game, { dataset: { arg: 'stormeye_signet' } });
  assert.equal(game.state.gold, 900 - getItem('stormeye_signet').price);
  assert.equal(countOf(game.state.inventory, 'stormeye_signet'), 1);

  const after = structuredClone(game.state);
  shopScene.actions.buy(game, { dataset: { arg: 'rusted_pipe' } });
  assert.deepEqual(game.state, after, 'storms-eye post cannot sell Greyhaven-only stock');
  assert.match(game.shopMessage, /does not stock/);

  shopScene.onEnter(game, { shopId: 'constructor' });
  shopScene.actions.buy(game, { dataset: { arg: 'rusted_pipe' } });
  assert.equal(game.state.gold, after.gold - getItem('rusted_pipe').price);
  assert.equal(countOf(game.state.inventory, 'rusted_pipe'), 1);
});

test('new storms-eye shop content carries no egg vocabulary', () => {
  const parts = [];
  for (const id of NEW_ITEM_IDS) {
    const it = getItem(id);
    parts.push(it.name, it.description || '');
  }
  for (const rid of NEW_RECIPE_IDS) {
    const r = RECIPES.find((x) => x.id === rid);
    parts.push(r.name, r.description);
  }
  parts.push(SHOPS.storms_eye_post.name, SHOPS.storms_eye_post.greeting);
  const blob = parts.join(' ');
  assert.ok(!EGG_RE.test(blob), `egg reference found in storms-eye content: ${blob.match(EGG_RE)}`);
});
