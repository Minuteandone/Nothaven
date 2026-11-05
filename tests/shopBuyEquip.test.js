import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { GREYHAVEN_SHOP, shopCatalog } from '../src/items/shop.js';
import { getItem } from '../src/items/items.js';
import { createEquipment } from '../src/items/equipment.js';
import { createCompanionMember } from '../src/party/companions.js';
import { EGG_RE, assertEggFree } from './helpers/eggGuard.mjs';

function fakeGame() {
  const game = {
    state: createInitialState(),
    shopMode: 'buy',
    shopMessage: '',
    shopReturnScene: 'town',
    shopId: 'greyhaven_shop',
    shopMemberIndex: 0,
    lastScene: null,
    registered: {},
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered[name] = scene; },
  };
  return game;
}

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function buyTable(html) {
  return html.split('<table aria-label="Items for sale">')[1].split('</table>')[0];
}

function rowFor(html, itemId) {
  return buyTable(html)
    .split('<tr>')
    .find((chunk) => chunk.includes(`data-action="buy" data-arg="${itemId}"`));
}

test('buy tab offers Buy & equip only on equippable gear rows', () => {
  const game = fakeGame();
  game.state.gold = 300;
  const html = shopScene.render(game);
  for (const consumable of ['rations', 'bandage', 'healing_herb', 'storm_tonic']) {
    const row = rowFor(html, consumable);
    assert.ok(row, consumable);
    assert.ok(!row.includes('buyEquip'), `${consumable} must not offer Buy & equip`);
  }
  for (const gear of ['rusted_pipe', 'padded_vest', 'leather_armor', 'scout_compass', 'gale_charm', 'tin_whistle']) {
    const row = rowFor(html, gear);
    assert.ok(row, gear);
    assert.ok(row.includes('data-action="buyEquip"'), `${gear} must offer Buy & equip`);
    assert.ok(row.includes(`aria-label="Buy and equip ${esc(getItem(gear).name)}"`), gear);
    assert.ok(!row.includes('disabled'), `${gear} must be enabled at full gold`);
  }
});

test('buyEquip purchases and equips on the selected member', () => {
  const game = fakeGame();
  const price = shopCatalog(GREYHAVEN_SHOP).find((r) => r.id === 'rusted_pipe').price;
  shopScene.actions.buyEquip(game, { dataset: { arg: 'rusted_pipe' } });
  assert.equal(game.state.party[0].equipment.weapon, 'rusted_pipe');
  assert.equal(game.state.gold, 20 - price);
  assert.deepEqual(game.state.inventory, []);
  assert.equal(game.shopMessage, 'Bought and equipped Rusted Pipe.');
});

test('the replaced piece returns to the pack', () => {
  const game = fakeGame();
  const hero = game.state.party[0];
  hero.equipment = createEquipment();
  hero.equipment.armor = 'padded_vest';
  game.state.gold = 200;
  shopScene.actions.buyEquip(game, { dataset: { arg: 'leather_armor' } });
  const after = game.state.party[0];
  assert.notEqual(after, hero, 'equipItem must replace the member object, and the state must be re-read');
  assert.equal(after.equipment.armor, 'leather_armor');
  assert.deepEqual(game.state.inventory, [{ id: 'padded_vest', qty: 1 }]);
  assert.equal(game.shopMessage, 'Bought and equipped Leather Armor.');
});

test('buyEquip refuses unaffordable, unstocked or non-gear items without changing state', () => {
  const game = fakeGame();
  game.state.gold = 0;
  shopScene.actions.buyEquip(game, { dataset: { arg: 'leather_armor' } });
  assert.equal(game.state.gold, 0);
  assert.deepEqual(game.state.inventory, []);
  assert.match(game.shopMessage, /^Not enough gold \(need \d+, have 0\)\.$/);

  game.state.gold = 200;
  const snapshot = JSON.stringify(game.state);
  shopScene.actions.buyEquip(game, { dataset: { arg: 'tempest_edge' } });
  assert.equal(game.state.gold, 200);
  assert.equal(JSON.stringify(game.state), snapshot, 'unstocked gear must not mutate state');

  shopScene.actions.buyEquip(game, { dataset: { arg: 'rations' } });
  assert.equal(game.shopMessage, 'That cannot be equipped.');
  assert.equal(JSON.stringify(game.state), snapshot, 'consumable must not be bought via buyEquip');

  shopScene.actions.buyEquip(game, { dataset: {} });
  assert.equal(JSON.stringify(game.state), snapshot);
});

test('already wearing the piece blocks a duplicate purchase', () => {
  const game = fakeGame();
  const hero = game.state.party[0];
  hero.equipment = createEquipment();
  hero.equipment.weapon = 'rusted_pipe';
  game.state.gold = 200;
  shopScene.actions.buyEquip(game, { dataset: { arg: 'rusted_pipe' } });
  assert.equal(game.shopMessage, 'Rusted Pipe is already equipped.');
  assert.equal(game.state.gold, 200);
  assert.deepEqual(game.state.inventory, []);
  const html = shopScene.render(game);
  const row = rowFor(html, 'rusted_pipe');
  assert.ok(/data-action="buyEquip"[^>]*disabled/.test(row), 'button must render disabled while worn');
});

test('buy & equip is disabled while unaffordable', () => {
  const game = fakeGame();
  game.state.gold = 5;
  const row = rowFor(shopScene.render(game), 'rusted_pipe');
  assert.ok(/data-action="buyEquip"[^>]*disabled/.test(row), 'unaffordable gear must render disabled');
});

test('buyEquip targets the selected ally', () => {
  const game = fakeGame();
  game.state.party.push(createCompanionMember('tamsin', 1));
  game.state.gold = 300;
  shopScene.actions.selectMember(game, { dataset: { arg: '1' } });
  shopScene.actions.buyEquip(game, { dataset: { arg: 'gale_charm' } });
  assert.equal(game.state.party[1].equipment.trinket, 'gale_charm');
  assert.equal(game.state.party[0].equipment?.trinket ?? null, null);
  assert.equal(game.shopMessage, 'Bought and equipped Gale Charm for Tamsin.');
  assert.deepEqual(game.state.inventory, []);
});

test('shop buy tab HTML stays egg-free', () => {
  const game = fakeGame();
  game.state.gold = 300;
  assertEggFree(shopScene.render(game), 'shop buy tab HTML');
  assert.ok(!EGG_RE.test(game.shopMessage));
});
