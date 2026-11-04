import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopScene, installShop } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';
import { GREYHAVEN_SHOP, shopCatalog } from '../src/items/shop.js';
import { getItem } from '../src/items/items.js';

const EGG_RE = /\b(eggs?|nests?|nest(ed|ing)?|hatch(ed|ing|es|lings?)?|yolk|chickens?|roosters?|hen|easter|scrambl(e|ed|ing)|omelet(te)?s?|peep(s|ing)?|shells?|shell(ed|ing)?)\b/i;

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

test('buy action spends gold and adds to inventory through the scene', () => {
  const game = fakeGame();
  const price = shopCatalog(GREYHAVEN_SHOP).find((r) => r.id === 'rations').price;
  shopScene.actions.buy(game, { dataset: { arg: 'rations' } });
  assert.equal(game.state.gold, 20 - price);
  assert.deepEqual(game.state.inventory, [{ id: 'rations', qty: 1 }]);
  assert.match(game.shopMessage, /Bought Trail Rations/);
});

test('buy refuses unaffordable or unstocked items without changing state', () => {
  const game = fakeGame();
  game.state.gold = 0;
  shopScene.actions.buy(game, { dataset: { arg: 'leather_armor' } });
  assert.equal(game.state.gold, 0);
  assert.deepEqual(game.state.inventory, []);
  shopScene.actions.buy(game, { dataset: { arg: 'keeper_coat' } }); // not in stock
  assert.deepEqual(game.state.inventory, []);
});

test('sell and sellAll earn gold; key items are never listed for sale', () => {
  const game = fakeGame();
  game.state.inventory = grantRewards(game.state.inventory, { rations: 3, observatory_lens: 1 }).inv;
  const unit = getItem('rations').sellPrice ?? Math.floor(getItem('rations').price / 2);
  shopScene.actions.sell(game, { dataset: { arg: 'rations' } });
  assert.equal(game.state.gold, 20 + unit);
  shopScene.actions.sellAll(game, { dataset: { arg: 'rations' } });
  assert.equal(game.state.gold, 20 + unit * 3);
  assert.deepEqual(game.state.inventory, [{ id: 'observatory_lens', qty: 1 }]);
  game.shopMode = 'sell';
  const html = shopScene.render(game);
  assert.match(html, /Hesta&#39;s Goods/);
  assert.ok(!html.includes('data-action="sell" data-arg="observatory_lens"'), 'key items must not be sellable');
});

test('equip and unequip run through the wardrobe actions', () => {
  const game = fakeGame();
  game.state.inventory = grantRewards(game.state.inventory, { iron_sword: 1 }).inv;
  shopScene.actions.equip(game, { dataset: { arg: 'iron_sword' } });
  assert.equal(game.state.party[0].equipment.weapon, 'iron_sword');
  assert.deepEqual(game.state.inventory, []);
  shopScene.actions.unequip(game, { dataset: { arg: 'weapon' } });
  assert.equal(game.state.party[0].equipment.weapon, null);
  assert.deepEqual(game.state.inventory, [{ id: 'iron_sword', qty: 1 }]);
});

test('render escapes hostile hero names and item text', () => {
  const game = fakeGame();
  game.state.party[0].name = 'Wren <img src=x onerror=alert(1)>';
  const html = shopScene.render(game);
  assert.ok(!html.includes('<img'), 'raw markup must not survive escaping');
  assert.ok(html.includes('&lt;img'), 'escaped name is rendered as text');
});

test('render stays free of egg-themed words across both tabs', () => {
  const game = fakeGame();
  game.state.inventory = grantRewards(
    game.state.inventory,
    { rations: 2, bandage: 1, healing_herb: 2, storm_tonic: 1, rusted_pipe: 1, padded_vest: 1, scout_compass: 1, scrap_metal: 4 }
  ).inv;
  for (const mode of ['buy', 'sell']) {
    game.shopMode = mode;
    const html = shopScene.render(game);
    assert.ok(!EGG_RE.test(html), `no egg words in ${mode} tab`);
    assert.ok(!html.includes('undefined'), 'no undefined leaking into markup');
  }
});

test('affordability disables Buy buttons and mode tabs toggle', () => {
  const game = fakeGame();
  game.state.gold = 0;
  game.shopMode = 'buy';
  const html = shopScene.render(game);
  assert.ok(html.includes('disabled'), 'unaffordable buys render disabled');
  shopScene.actions.setMode(game, { dataset: { arg: 'sell' } });
  assert.equal(game.shopMode, 'sell');
  shopScene.actions.setMode(game, { dataset: { arg: 'buy' } });
  assert.equal(game.shopMode, 'buy');
});

test('leave returns to the configured scene and onEnter sets defaults', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { returnScene: 'explore', message: 'Welcome back.' });
  assert.equal(game.shopReturnScene, 'explore');
  assert.equal(game.shopMessage, 'Welcome back.');
  shopScene.actions.leave(game);
  assert.equal(game.lastScene.name, 'explore');
  const game2 = fakeGame();
  shopScene.onEnter(game2, {});
  assert.equal(game2.shopReturnScene, 'town');
  assert.equal(game2.shopMode, 'buy');
});

test('installShop registers the scene', () => {
  const game = fakeGame();
  installShop(game);
  assert.equal(game.registered.shop, shopScene);
});

test('all shop modes retain a labelled responsive wardrobe and spare gear actions', () => {
  const game = fakeGame();
  game.shopId = 'storms_eye_post';
  game.state.party[0].equipment = { weapon: 'tempest_edge', armor: 'maelstrom_plate', trinket: null };
  game.state.inventory = [{ id: 'stormforged_blade', qty: 1 }, { id: 'padded_vest', qty: 1 }];
  const before = structuredClone(game.state);
  for (const mode of ['buy', 'sell', 'craft']) {
    game.shopMode = mode;
    const html = shopScene.render(game);
    assert.match(html, /<table class="shop-wardrobe" aria-label="Equipped gear and spare equipment">/);
    assert.match(html, /Tempest Edge/); assert.match(html, /Maelstrom Plate/);
    assert.match(html, /data-action="equip" data-arg="stormforged_blade"/);
    assert.match(html, /data-action="equip" data-arg="padded_vest"/);
    assert.match(html, /data-action="unequip" data-arg="armor"/);
    assert.deepEqual(game.state, before);
  }
});
