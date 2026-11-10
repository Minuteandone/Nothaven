import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { shopScene } from '../src/scenes/shop.js';
import { addItem, grantRewards } from '../src/items/inventory.js';
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

function sellModeGame() {
  const game = fakeGame();
  shopScene.onEnter(game, { mode: 'sell' });
  return game;
}

function rowFor(html, id) {
  return html.split('<tr>').find((chunk) => chunk.includes(`data-arg="${id}"`)) || '';
}

test('scarce Sell 1 arms a confirm, then sells on the second press', () => {
  const game = sellModeGame();
  game.state.inventory = grantRewards(game.state.inventory, { stormcrown_shard: 1, rations: 1 }).inv;
  const goldBefore = game.state.gold;

  shopScene.actions.sell(game, { dataset: { arg: 'stormcrown_shard' } });
  assert.equal(game.state.gold, goldBefore, 'no gold on the arming press');
  assert.equal(game.sellConfirm, 'stormcrown_shard:1');
  assert.match(game.shopMessage, /rare drop that is hard to replace/);

  let html = shopScene.render(game);
  let row = rowFor(html, 'stormcrown_shard');
  assert.ok(row.includes('>Confirm sell 1?</button>'), 'armed label');
  assert.ok(row.includes('aria-pressed="true"'), 'armed aria state');
  assert.ok(row.includes('class="shop-confirm-armed"'), 'armed styling hook');

  shopScene.actions.sell(game, { dataset: { arg: 'stormcrown_shard' } });
  assert.equal(game.state.gold, goldBefore + 60, 'sold on the confirming press');
  assert.deepEqual(game.state.inventory, [{ id: 'rations', qty: 1 }]);
  assert.equal(game.sellConfirm, null);
  assert.match(game.shopMessage, /Sold Stormcrown Shard x1/);

  html = shopScene.render(game);
  row = rowFor(html, 'rations');
  assert.ok(!html.includes('Confirm sell'), 'no armed label after the sale');
  assert.ok(row.includes('aria-pressed="false"'), 'unarmed aria state on a remaining row');
  assert.ok(!html.includes('data-arg="stormcrown_shard"'), 'sold-out row is gone');
});

test('unarmed rows keep the exact pinned labels', () => {
  const game = sellModeGame();
  game.state.inventory = grantRewards(game.state.inventory, { scrap_metal: 4 }).inv;
  const html = shopScene.render(game);
  const row = rowFor(html, 'scrap_metal');
  assert.ok(row.includes('data-action="sell" data-arg="scrap_metal" aria-pressed="false"'));
  assert.ok(row.includes('Sell 1</button>'));
  assert.ok(row.includes('data-action="sellAll" data-arg="scrap_metal">Sell all (16g)</button>'));
  assert.ok(!html.includes('Confirm'), 'nothing armed yet');
  assert.ok(!html.includes('undefined'), 'no undefined leaking into markup');
});

test('stocked items sell immediately with no confirm', () => {
  const game = sellModeGame();
  game.state.inventory = addItem(game.state.inventory, 'rations', 3).inv;
  const goldBefore = game.state.gold;
  shopScene.actions.sell(game, { dataset: { arg: 'rations' } });
  assert.equal(game.state.gold, goldBefore + 2, 'rations are stocked, so no guard');
  assert.equal(game.sellConfirm, null);
});

test('last copy of a stocked-nowhere item needs confirmation', () => {
  const game = sellModeGame();
  game.state.inventory = addItem(game.state.inventory, 'iron_sword', 1).inv;
  const goldBefore = game.state.gold;

  shopScene.actions.sell(game, { dataset: { arg: 'iron_sword' } });
  assert.equal(game.state.gold, goldBefore, 'arming press does not sell');
  assert.equal(game.sellConfirm, 'iron_sword:1');
  assert.match(game.shopMessage, /your last Iron Sword, and no shop stocks it/);

  shopScene.actions.sell(game, { dataset: { arg: 'iron_sword' } });
  assert.equal(game.state.gold, goldBefore + 30, 'sold on the confirming press');
  assert.deepEqual(game.state.inventory, []);
  assert.equal(game.sellConfirm, null);
});

test('arming switches to the newest guarded press', () => {
  const game = sellModeGame();
  game.state.inventory = grantRewards(game.state.inventory, { stormcrown_shard: 1, scrap_metal: 1 }).inv;

  shopScene.actions.sell(game, { dataset: { arg: 'stormcrown_shard' } });
  assert.equal(game.sellConfirm, 'stormcrown_shard:1');
  shopScene.actions.sell(game, { dataset: { arg: 'scrap_metal' } });
  assert.equal(game.sellConfirm, 'scrap_metal:1', 'newest guarded press takes over');

  shopScene.actions.sell(game, { dataset: { arg: 'scrap_metal' } });
  assert.match(game.shopMessage, /Sold Scrap Metal x1/);
  assert.equal(countId(game.state.inventory, 'stormcrown_shard'), 1, 'earlier armed row still owned');
  assert.equal(countId(game.state.inventory, 'scrap_metal'), 0);
});

function countId(inventory, id) {
  return inventory.filter((s) => s.id === id).reduce((n, s) => n + s.qty, 0);
}

test('sellQty covering the last stack of a stocked-nowhere item confirms first', () => {
  const game = sellModeGame();
  game.shopQty = 4;
  game.state.inventory = grantRewards(game.state.inventory, { scrap_metal: 4 }).inv;
  const goldBefore = game.state.gold;

  shopScene.actions.sellQty(game, { dataset: { arg: 'scrap_metal' } });
  assert.equal(game.state.gold, goldBefore, 'arming press does not sell');
  assert.equal(game.sellConfirm, 'scrap_metal:4');
  let row = rowFor(shopScene.render(game), 'scrap_metal');
  assert.ok(row.includes('>Confirm sell 4?</button>'), 'armed Sell N label');

  shopScene.actions.sellQty(game, { dataset: { arg: 'scrap_metal' } });
  assert.equal(game.state.gold, goldBefore + 16, 'whole stack sold on confirming press');
  assert.deepEqual(game.state.inventory, []);
});

test('sellAll of a stocked-nowhere stack confirms first', () => {
  const game = sellModeGame();
  game.state.inventory = grantRewards(game.state.inventory, { scrap_metal: 4 }).inv;
  const goldBefore = game.state.gold;

  shopScene.actions.sellAll(game, { dataset: { arg: 'scrap_metal' } });
  assert.equal(game.state.gold, goldBefore, 'arming press does not sell');
  assert.equal(game.sellConfirm, 'scrap_metal:4');
  const row = rowFor(shopScene.render(game), 'scrap_metal');
  assert.ok(row.includes('>Confirm sell all?</button>'), 'armed Sell all label');

  shopScene.actions.sellAll(game, { dataset: { arg: 'scrap_metal' } });
  assert.equal(game.state.gold, goldBefore + 16, 'sold on the confirming press');
  assert.deepEqual(game.state.inventory, []);
});

test('scarce sellAll invoked directly still bypasses the guard', () => {
  const game = sellModeGame();
  game.state.inventory = grantRewards(game.state.inventory, { stormcrown_shard: 2 }).inv;
  const goldBefore = game.state.gold;
  shopScene.actions.sellAll(game, { dataset: { arg: 'stormcrown_shard' } });
  assert.equal(game.state.gold, goldBefore + 120, 'legacy direct override keeps working');
  assert.deepEqual(game.state.inventory, []);
  assert.equal(game.sellConfirm, null);
});

test('stale armed key re-arms for the new quantity', () => {
  const game = sellModeGame();
  game.state.inventory = grantRewards(game.state.inventory, { scrap_metal: 4 }).inv;
  shopScene.actions.sellAll(game, { dataset: { arg: 'scrap_metal' } });
  assert.equal(game.sellConfirm, 'scrap_metal:4');

  shopScene.actions.sell(game, { dataset: { arg: 'scrap_metal' } });
  assert.match(game.shopMessage, /Sold Scrap Metal x1/, 'unguarded Sell 1 still sells one');
  shopScene.actions.sellAll(game, { dataset: { arg: 'scrap_metal' } });
  assert.equal(game.sellConfirm, 'scrap_metal:3', 're-armed for the remaining stack');
  assert.equal(countId(game.state.inventory, 'scrap_metal'), 3);
});

test('onEnter, setMode and leave clear an armed confirm', () => {
  const game = sellModeGame();
  game.state.inventory = grantRewards(game.state.inventory, { stormcrown_shard: 1 }).inv;
  shopScene.actions.sell(game, { dataset: { arg: 'stormcrown_shard' } });
  assert.equal(game.sellConfirm, 'stormcrown_shard:1');

  shopScene.onEnter(game, { mode: 'sell' });
  assert.equal(game.sellConfirm, null, 'new shop entry clears the guard');

  shopScene.actions.sell(game, { dataset: { arg: 'stormcrown_shard' } });
  shopScene.actions.setMode(game, { dataset: { arg: 'buy' } });
  assert.equal(game.sellConfirm, null, 'tab change clears the guard');

  shopScene.actions.setMode(game, { dataset: { arg: 'sell' } });
  shopScene.actions.sell(game, { dataset: { arg: 'stormcrown_shard' } });
  shopScene.actions.leave(game);
  assert.equal(game.sellConfirm, null, 'leaving clears the guard');
  assert.equal(game.lastScene.name, 'town');
});

test('a worn copy satisfies the last-of-kind guard', () => {
  const game = sellModeGame();
  game.state.inventory = addItem(game.state.inventory, 'iron_sword', 1).inv;
  game.state.party[0].equipment = { weapon: 'iron_sword', armor: null, trinket: null };
  const goldBefore = game.state.gold;

  shopScene.actions.sell(game, { dataset: { arg: 'iron_sword' } });
  assert.equal(game.state.gold, goldBefore + 30, 'packed copy sells with no confirm while one is worn');
  assert.equal(game.sellConfirm, null);
  assert.ok(!/last Iron Sword/.test(game.shopMessage), 'no false last-of-kind claim');
  assert.equal(game.state.party[0].equipment.weapon, 'iron_sword', 'worn copy untouched');
});

test('a reserve member wearing the item counts too', () => {
  const game = sellModeGame();
  game.state.inventory = addItem(game.state.inventory, 'iron_sword', 1).inv;
  game.state.reserve = {
    bram: { id: 'bram', name: 'Bram', equipment: { weapon: 'iron_sword', armor: null, trinket: null } },
  };
  const goldBefore = game.state.gold;

  shopScene.actions.sell(game, { dataset: { arg: 'iron_sword' } });
  assert.equal(game.state.gold, goldBefore + 30, 'reserve ownership makes the packed copy sellable');
  assert.equal(game.sellConfirm, null);
  game.state.reserve = {};
});

test('armed buttons expose the confirm state in their accessible names', () => {
  const game = sellModeGame();
  game.state.inventory = grantRewards(game.state.inventory, { stormcrown_shard: 1, scrap_metal: 4 }).inv;

  shopScene.actions.sell(game, { dataset: { arg: 'stormcrown_shard' } });
  let row = rowFor(shopScene.render(game), 'stormcrown_shard');
  assert.ok(row.includes('aria-label="Confirm sell 1 Stormcrown Shard (rare drop, hard to replace)"'), 'armed scarce accessible name');

  game.sellConfirm = null;
  shopScene.actions.sellAll(game, { dataset: { arg: 'scrap_metal' } });
  row = rowFor(shopScene.render(game), 'scrap_metal');
  assert.ok(row.includes('aria-label="Confirm sell all Scrap Metal (16g)"'), 'armed sellAll accessible name');
  assert.ok(row.includes('aria-pressed="true"'), 'armed sellAll aria state');
  assert.ok(row.includes('class="shop-confirm-armed"'), 'armed sellAll styling hook');

  game.sellConfirm = null;
  game.shopQty = 4;
  shopScene.actions.sellQty(game, { dataset: { arg: 'scrap_metal' } });
  row = rowFor(shopScene.render(game), 'scrap_metal');
  assert.ok(row.includes('aria-label="Confirm sell 4 Scrap Metal"'), 'armed sellQty accessible name');
  assert.ok(row.includes('class="shop-confirm-armed"'), 'armed sellQty styling hook');
});

test('an intervening sale releases an armed confirm', () => {
  const game = sellModeGame();
  game.state.inventory = grantRewards(game.state.inventory, { stormcrown_shard: 1, rations: 1 }).inv;
  shopScene.actions.sell(game, { dataset: { arg: 'stormcrown_shard' } });
  assert.equal(game.sellConfirm, 'stormcrown_shard:1');

  shopScene.actions.sell(game, { dataset: { arg: 'rations' } });
  assert.match(game.shopMessage, /Sold Trail Rations x1/, 'ordinary sale completes');
  assert.equal(game.sellConfirm, null, 'armed confirm cleared by the intervening sale');
  const html = shopScene.render(game);
  assert.ok(!html.includes('Confirm sell'), 'no stale armed label after the ordinary sale');
  assert.equal(countId(game.state.inventory, 'stormcrown_shard'), 1, 'shard still owned');
});

test('armed and unarmed sell tabs are egg-free', () => {
  const game = sellModeGame();
  game.state.inventory = grantRewards(game.state.inventory, { stormcrown_shard: 1, scrap_metal: 4 }).inv;
  assertEggFree(shopScene.render(game), 'sell tab before arming');
  shopScene.actions.sell(game, { dataset: { arg: 'stormcrown_shard' } });
  const html = shopScene.render(game);
  assertEggFree(html, 'sell tab with armed confirm');
  assert.ok(!html.includes('undefined'), 'no undefined leaking into markup');
});
