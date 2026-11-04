import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { createCompanionMember } from '../src/party/companions.js';
import { effectiveStats } from '../src/items/equipment.js';

const EGG_RE = /\b(eggs?|nests?|nest(ed|ing)?|hatch(ed|ing|es|lings?)?|yolk|chickens?|roosters?|hen|easter|scrambl(e|ed|ing)|omelet(te)?s?|peep(s|ing)?|shells?|shell(ed|ing)?|albumen|ovoid|quiche|meringue|custard|poach(ed|ing)?|frittata)\b/i;

function fakeGame() {
  const game = {
    state: createInitialState(),
    shopMode: 'buy',
    shopMessage: '',
    shopReturnScene: 'town',
    shopMemberIndex: 0,
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered ??= {}; game.registered[name] = scene; },
  };
  return game;
}

function partyWithTamsin(game) {
  game.state.party.push(createCompanionMember('tamsin', 1));
  return game.state.party;
}

test('wardrobe shows member tabs only when companions are in the party', () => {
  const game = fakeGame();
  shopScene.onEnter(game, {});
  let html = shopScene.render(game);
  assert.ok(!html.includes('data-action="selectMember"'), 'no tabs for solo hero');

  partyWithTamsin(game);
  html = shopScene.render(game);
  assert.ok(html.includes('data-action="selectMember"'));
  assert.ok(html.includes('data-arg="1"'));
  assert.ok(html.includes('(ally)'));
  assert.ok(html.includes('Wardrobe — Wren'));
});

test('selectMember targets the companion for equip and leaves the hero untouched', () => {
  const game = fakeGame();
  partyWithTamsin(game);
  game.state.inventory = [{ id: 'iron_sword', qty: 1 }];
  const heroBefore = JSON.stringify(game.state.party[0]);
  shopScene.actions.selectMember(game, { dataset: { arg: '1' } });
  assert.equal(game.shopMemberIndex, 1);
  shopScene.actions.equip(game, { dataset: { arg: 'iron_sword' } });
  assert.equal(game.state.party[1].equipment.weapon, 'iron_sword', 'companion got the sword');
  assert.equal(JSON.stringify(game.state.party[0]), heroBefore, 'hero untouched');
  assert.deepEqual(game.state.inventory, []);
  assert.match(game.shopMessage, /Salvaged Blade|Iron Sword|equipped/i);
});

test('equipping a companion changes their effective stats and render', () => {
  const game = fakeGame();
  const [, tamsin] = partyWithTamsin(game);
  game.state.inventory = [{ id: 'iron_sword', qty: 1 }];
  shopScene.actions.selectMember(game, { dataset: { arg: '1' } });
  const before = effectiveStats(game.state.party[1]).atk;
  shopScene.actions.equip(game, { dataset: { arg: 'iron_sword' } });
  const after = effectiveStats(game.state.party[1]).atk;
  assert.equal(after, before + 7, 'iron_sword grants atk +7');
  const html = shopScene.render(game);
  assert.ok(html.includes(`ATK ${after}`));
});

test('unequip from a companion returns the item to the shared inventory', () => {
  const game = fakeGame();
  const [, tamsin] = partyWithTamsin(game);
  game.state.inventory = [{ id: 'iron_sword', qty: 1 }];
  shopScene.actions.selectMember(game, { dataset: { arg: '1' } });
  shopScene.actions.equip(game, { dataset: { arg: 'iron_sword' } });
  shopScene.actions.unequip(game, { dataset: { arg: 'weapon' } });
  assert.equal(game.state.party[1].equipment.weapon, null, 'companion slot cleared');
  assert.deepEqual(game.state.inventory, [{ id: 'iron_sword', qty: 1 }]);
});

test('stale or out-of-range member index clamps to the hero', () => {
  const game = fakeGame();
  partyWithTamsin(game);
  game.state.inventory = [{ id: 'iron_sword', qty: 1 }];
  game.shopMemberIndex = 7;
  let html = shopScene.render(game);
  assert.ok(html.includes('Wardrobe — Wren'), 'clamped to hero');
  shopScene.actions.equip(game, { dataset: { arg: 'iron_sword' } });
  assert.equal(game.state.party[0].equipment.weapon, 'iron_sword');
  game.shopMemberIndex = -3;
  html = shopScene.render(game);
  assert.ok(html.includes('Wardrobe — Wren'));
});

test('entering the shop resets the selection to the hero', () => {
  const game = fakeGame();
  partyWithTamsin(game);
  shopScene.actions.selectMember(game, { dataset: { arg: '1' } });
  assert.equal(game.shopMemberIndex, 1);
  shopScene.onEnter(game, { mode: 'sell' });
  assert.equal(game.shopMemberIndex, 0);
  assert.equal(game.shopMode, 'sell');
});

test('legacy hero without an equipment field still renders and equips', () => {
  const game = fakeGame();
  partyWithTamsin(game);
  delete game.state.party[0].equipment;
  game.state.inventory = [{ id: 'padded_vest', qty: 1 }];
  const html = shopScene.render(game);
  assert.ok(html.includes('Wardrobe'));
  shopScene.actions.equip(game, { dataset: { arg: 'padded_vest' } });
  assert.equal(game.state.party[0].equipment.armor, 'padded_vest');
});

test('wardrobe html escapes names and contains no egg references', () => {
  const game = fakeGame();
  game.state.party[0].name = 'Wren <img src=x onerror=alert(1)>';
  partyWithTamsin(game);
  shopScene.actions.selectMember(game, { dataset: { arg: '1' } });
  const html = shopScene.render(game);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!EGG_RE.test(html.replace(/&[a-z]+;|&#\d+;/g, ' ')));
});
