import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bagScene, installBag } from '../src/scenes/bag.js';
import { createInitialState } from '../src/state.js';
import { createCompanionMember } from '../src/party/companions.js';

const EGG_RE = /\b(eggs?|nests?|nest(ed|ing)?|hatch(ed|ing|es|lings?)?|yolk|chickens?|roosters?|hen|easter|scrambl(e|ed|ing)|omelet(te)?s?|peep(s|ing)?|shells?|shell(ed|ing)?|albumen|ovoid|quiche|meringue|custard|poach(ed|ing)?|frittata)\b/i;

function fakeGame() {
  const game = {
    state: createInitialState(),
    bagMemberIndex: 3,
    bagMessage: 'stale',
    bagReturnScene: 'stale',
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered ??= {}; game.registered[name] = scene; },
  };
  return game;
}

test('onEnter sets return scene, resets selection and message', () => {
  const game = fakeGame();
  bagScene.onEnter(game, { returnScene: 'explore', message: 'hello' });
  assert.equal(game.bagReturnScene, 'explore');
  assert.equal(game.bagMemberIndex, 0);
  assert.equal(game.bagMessage, 'hello');

  bagScene.onEnter(game, {});
  assert.equal(game.bagReturnScene, 'town');
  assert.equal(game.bagMessage, '');
});

test('empty inventory renders an empty-bag note', () => {
  const game = fakeGame();
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.match(html, /Your bag is empty\./);
});

test('using a consumable heals the hero and removes the spent stack', () => {
  const game = fakeGame();
  game.state.party[0].hp = 10;
  game.state.inventory = [{ id: 'healing_herb', qty: 1 }];
  bagScene.onEnter(game, {});
  bagScene.actions.use(game, { dataset: { arg: 'healing_herb' } });
  assert.equal(game.state.party[0].hp, 30, 'healed to base cap');
  assert.deepEqual(game.state.inventory, [], 'stack consumed');
  assert.match(game.bagMessage, /Wren — Healing Herb: restored 20 hp\./);
});

test('using a consumable on the selected companion leaves the hero untouched', () => {
  const game = fakeGame();
  game.state.party.push(createCompanionMember('tamsin', 1));
  game.state.party[1].hp = 5;
  game.state.inventory = [{ id: 'healing_herb', qty: 2 }];
  const heroBefore = JSON.stringify(game.state.party[0]);
  bagScene.onEnter(game, {});
  bagScene.actions.selectMember(game, { dataset: { arg: '1' } });
  bagScene.actions.use(game, { dataset: { arg: 'healing_herb' } });
  assert.equal(game.state.party[1].hp, 24, 'tamsin healed to her cap');
  assert.deepEqual(game.state.inventory, [{ id: 'healing_herb', qty: 1 }]);
  assert.equal(JSON.stringify(game.state.party[0]), heroBefore, 'hero untouched');
  assert.match(game.bagMessage, /Tamsin — Healing Herb/);
});

test('equip and unequip round-trip through the bag on the active member', () => {
  const game = fakeGame();
  game.state.party.push(createCompanionMember('tamsin', 1));
  game.state.inventory = [{ id: 'iron_sword', qty: 1 }];
  bagScene.onEnter(game, {});
  bagScene.actions.selectMember(game, { dataset: { arg: '1' } });
  bagScene.actions.equip(game, { dataset: { arg: 'iron_sword' } });
  assert.equal(game.state.party[1].equipment.weapon, 'iron_sword');
  assert.deepEqual(game.state.inventory, []);
  bagScene.actions.unequip(game, { dataset: { arg: 'weapon' } });
  assert.equal(game.state.party[1].equipment.weapon, null);
  assert.deepEqual(game.state.inventory, [{ id: 'iron_sword', qty: 1 }]);
});

test('key items and materials render without use or equip buttons', () => {
  const game = fakeGame();
  game.state.inventory = [{ id: 'observatory_lens', qty: 1 }, { id: 'scrap_metal', qty: 3 }];
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.match(html, /Observatory Lens/);
  assert.match(html, /Scrap Metal ×3/);
  assert.ok(!html.includes('data-action="use" data-arg="observatory_lens"'));
  assert.ok(!html.includes('data-action="equip" data-arg="scrap_metal"'));
});

test('equipped gear shows an unequip control in the bag', () => {
  const game = fakeGame();
  game.state.party[0].equipment = { weapon: 'rusted_pipe', armor: null, trinket: null };
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.match(html, /Rusted Pipe/);
  assert.match(html, /data-action="unequip" data-arg="weapon"/);
});

test('member tabs appear only in a party and out-of-range indices clamp to the hero', () => {
  const game = fakeGame();
  bagScene.onEnter(game, {});
  let html = bagScene.render(game);
  assert.ok(!html.includes('data-action="selectMember"'), 'no tabs for solo hero');

  game.state.party.push(createCompanionMember('iven', 1));
  game.bagMemberIndex = 9;
  html = bagScene.render(game);
  assert.ok(html.includes('data-action="selectMember"'));
  assert.match(html, /Wren — /, 'clamped back to the hero');

  game.state.inventory = [{ id: 'iron_sword', qty: 1 }];
  bagScene.actions.selectMember(game, { dataset: { arg: '-2' } });
  bagScene.actions.equip(game, { dataset: { arg: 'iron_sword' } });
  assert.equal(game.state.party[0].equipment.weapon, 'iron_sword', 'negative index clamps to hero');
});

test('leave returns to the configured scene', () => {
  const game = fakeGame();
  bagScene.onEnter(game, {});
  bagScene.actions.leave(game);
  assert.equal(game.lastScene.name, 'town');

  bagScene.onEnter(game, { returnScene: 'explore' });
  bagScene.actions.leave(game);
  assert.equal(game.lastScene.name, 'explore');
});

test('unknown or missing item ids are handled safely', () => {
  const game = fakeGame();
  game.state.inventory = [{ id: 'healing_herb', qty: 1 }];
  bagScene.onEnter(game, {});
  bagScene.actions.use(game, { dataset: { arg: 'constructor' } });
  assert.match(game.bagMessage, /Unknown item\./);
  bagScene.actions.use(game, { dataset: {} });
  assert.equal(game.state.inventory.length, 1, 'inventory untouched');
  bagScene.actions.equip(game, { dataset: {} });
  bagScene.actions.unequip(game, { dataset: {} });
});

test('bag html escapes hostile names and contains no egg references', () => {
  const game = fakeGame();
  game.state.party[0].name = 'Wren <img src=x onerror=alert(1)>';
  game.state.party.push(createCompanionMember('tamsin', 1));
  game.state.inventory = [{ id: 'healing_herb', qty: 1 }, { id: 'iron_sword', qty: 1 }];
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!EGG_RE.test(html.replace(/class="[^"]*"/g, ' ').replace(/&[a-z]+;|&#\d+;/g, ' ')), 'no egg references outside class names');
});

test('installBag registers the bag scene once during boot', () => {
  const game = fakeGame();
  installBag(game);
  assert.equal(game.registered.bag, bagScene);
});
