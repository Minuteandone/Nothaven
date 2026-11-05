import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopScene } from '../src/scenes/shop.js';
import { recipesScene } from '../src/scenes/recipes.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';

const EGG_RE = /\b(eggs?|nests?|nest(ed|ing)?|hatch(ed|ing|es|lings?)?|yolk|chickens?|roosters?|hen|easter|scrambl(e|ed|ing)|omelet(te)?s?|peep(s|ing)?|shells?|shell(ed|ing)?)\b/i;

function fakeGame() {
  const game = {
    state: createInitialState(),
    shopMode: 'buy',
    shopMessage: 'Bought Trail Rations x1.',
    shopReturnScene: 'town',
    shopMemberIndex: 0,
    shopId: 'greyhaven_shop',
    recipesReturn: 'town',
    lastScene: null,
    registered: {},
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered[name] = scene; },
  };
  const res = grantRewards(game.state.inventory, [{ id: 'rations', qty: 2 }]);
  game.state.inventory = res.inv;
  return game;
}

test('shop render announces its message as a status region and labels tables', () => {
  const game = fakeGame();
  game.state.party.push({ name: 'Tamsin', companion: true, hp: 24, maxHp: 24 });
  const html = shopScene.render(game);
  assert.ok(html.includes('<p role="status">Bought Trail Rations x1.</p>'));
  assert.ok(html.includes('role="group" aria-label="Shop sections"'));
  assert.ok(html.includes('role="group" aria-label="Choose whose gear to view"'));
  assert.ok(!html.includes('tablist'));
  assert.ok(html.includes('aria-label="Items for sale"'));
  assert.ok(!EGG_RE.test(html));
});

test('craft mode labels its recipe table like the sell table does', () => {
  const game = fakeGame();
  game.shopMode = 'craft';
  const html = shopScene.render(game);
  assert.ok(html.includes('<table class="craft-table" aria-label="Crafting recipes">'));
  assert.ok(!EGG_RE.test(html));
});

test('field recipe book renders as a labelled region', () => {
  const game = fakeGame();
  recipesScene.onEnter(game, { returnScene: 'town' });
  const html = recipesScene.render(game);
  assert.ok(html.includes('role="region" aria-label="Field Recipe Book"'));
  assert.ok(!EGG_RE.test(html));
});
