import { test } from 'node:test';
import assert from 'node:assert/strict';

import { recipesScene, recipeBookEntries, installRecipeBook } from '../src/scenes/recipes.js';
import { RECIPES } from '../src/items/crafting.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';

// Full egg-family guard (mirrors the repo-wide discipline for rendered prose).
const EGG_RE = /\b(eggs?|nests?|nest(ed|ing)?|hatch(ed|ing|es|lings?)?|yolk|chickens?|roosters?|hen|easter|scrambl(e|ed|ing)|omelet(te)?s?|peep(s|ing)?|shells?|shell(ed|ing)?|albumen|oval|ovoid|quiche|meringue|custard|poach(ed|ing)?|frittata|boil\w*|crack\w*|whisk|cackl\w*|pearl|golden|basket|quail|goose|sunny|fried|devil\w*|clutch|incubat\w*|humpty|benedict|faberg\w*|ovum|oeuf|huevo)\b/i;

function fakeGame() {
  const game = {
    state: createInitialState(),
    recipesReturn: undefined,
    bagReturnScene: 'town',
    lastScene: null,
    registered: {},
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered[name] = scene; },
  };
  return game;
}

test('recipeBookEntries lists every recipe in book order with have/need counts', () => {
  const entries = recipeBookEntries([]);
  assert.equal(entries.length, RECIPES.length);
  assert.deepEqual(entries.map((e) => e.recipe.id), RECIPES.map((r) => r.id));
  for (const entry of entries) {
    assert.equal(entry.ready, false);
    assert.ok(entry.missing > 0);
    for (const input of entry.inputs) {
      assert.equal(input.have, 0);
      assert.ok(input.qty > 0);
      assert.ok(input.label && input.label.length > 0);
    }
  }
});

test('entries flip to ready when the inventory covers every input', () => {
  const game = fakeGame();
  // distill_tonic needs 1 healing_herb + 1 storm_glass.
  const res = grantRewards(game.state.inventory, [
    { id: 'healing_herb', qty: 2 }, { id: 'storm_glass', qty: 1 },
  ]);
  assert.ok(res.ok, 'grantRewards should succeed');
  game.state.inventory = res.inv;
  const entries = recipeBookEntries(game.state.inventory);
  const distill = entries.find((e) => e.recipe.id === 'distill_tonic');
  assert.equal(distill.ready, true);
  assert.equal(distill.missing, 0);
  const herb = distill.inputs.find((i) => i.id === 'healing_herb');
  assert.equal(herb.have, 2);
  const othersReady = entries.filter((e) => e.recipe.id !== 'distill_tonic' && e.ready);
  assert.deepEqual(othersReady, []);
});

test('render lists the whole book, marks readiness, and escapes recipe prose', () => {
  const game = fakeGame();
  const html = recipesScene.render(game);
  assert.match(html, /Field Recipe Book/);
  assert.match(html, new RegExp(`Ready with what you carry: <strong>0/${RECIPES.length}</strong>`));
  assert.match(html, /Missing materials/);
  assert.ok(!html.includes('Ready to craft'));
  // "Line a Keeper's Coat" must be escaped, never raw.
  assert.match(html, /Keeper&#39;s Coat/);
  assert.ok(!EGG_RE.test(html), 'egg-family terms must not appear');
});

test('render flags ready recipes with the ready chip and have/need classes', () => {
  const game = fakeGame();
  const res = grantRewards(game.state.inventory, [
    { id: 'healing_herb', qty: 1 }, { id: 'storm_glass', qty: 1 },
  ]);
  assert.ok(res.ok);
  game.state.inventory = res.inv;
  const html = recipesScene.render(game);
  assert.match(html, /Ready with what you carry: <strong>1\//);
  assert.match(html, /Ready to craft/);
  const row = html.split('<li class="recipe-entry">').find((c) => c.includes('Distill Storm Tonic'));
  assert.ok(row, 'distill entry present');
  assert.match(row, /class="have"/);
});

test('onEnter stores returnScene and keeps the previous one when omitted', () => {
  const game = fakeGame();
  recipesScene.onEnter(game, { returnScene: 'bag' });
  assert.equal(game.recipesReturn, 'bag');
  recipesScene.onEnter(game, {});
  assert.equal(game.recipesReturn, 'bag');
  const fresh = fakeGame();
  recipesScene.onEnter(fresh, {});
  assert.equal(fresh.recipesReturn, 'town');
});

test('leave returns to town by default and preserves the bag chain when opened from the bag', () => {
  const game = fakeGame();
  recipesScene.actions.leave(game);
  assert.equal(game.lastScene.name, 'town');

  // explore -> bag -> recipe book: going back must restore the bag's own return scene.
  const chained = fakeGame();
  chained.bagReturnScene = 'explore';
  chained.recipesReturn = 'bag';
  recipesScene.actions.leave(chained);
  assert.equal(chained.lastScene.name, 'bag');
  assert.deepEqual(chained.lastScene.data, { returnScene: 'explore' });
});

test('installRecipeBook registers the recipes scene', () => {
  const game = fakeGame();
  installRecipeBook(game);
  assert.equal(game.registered.recipes, recipesScene);
});
