import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bagScene } from '../src/scenes/bag.js';
import { createInitialState } from '../src/state.js';
import { listRecipes } from '../src/items/crafting.js';

import { EGG_RE } from './eggGuard.mjs';

function fakeGame() {
  const game = {
    state: createInitialState(),
    bagMemberIndex: 0,
    bagMessage: '',
    bagReturnScene: 'town',
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered ??= {}; game.registered[name] = scene; },
  };
  return game;
}

test('bag renders a Crafting section listing every recipe with checklists', () => {
  const game = fakeGame();
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.match(html, /<section class="bag-group" aria-label="Crafting"><h3>Crafting<\/h3><table class="craft-table">/);
  for (const recipe of listRecipes()) {
    assert.match(html, new RegExp(`data-arg="${recipe.id}"`), `craft button for ${recipe.id}`);
  }
  // Unmet input shows a need row with have 0 and a disabled button.
  assert.match(html, /<li class="need">Healing Herb ×1 <small>\(have 0\)<\/small><\/li>/);
  assert.match(html, /data-arg="distill_tonic"[^>]*disabled/);
});

test('bag craft button is enabled when every input is owned', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'healing_herb', qty: 1 },
    { id: 'storm_glass', qty: 1 },
  ];
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  const row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="distill_tonic"'));
  assert.ok(row, 'distill_tonic row rendered');
  assert.doesNotMatch(row, /disabled/);
  assert.match(row, /<li class="have">Healing Herb ×1 <small>\(have 1\)<\/small><\/li>/);
  assert.match(row, /<li class="have">Storm Glass ×1 <small>\(have 1\)<\/small><\/li>/);
});

test('craft action consumes inputs and adds the output to the shared inventory', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'healing_herb', qty: 1 },
    { id: 'storm_glass', qty: 1 },
  ];
  bagScene.onEnter(game, {});
  bagScene.actions.craft(game, { dataset: { arg: 'distill_tonic' } });
  assert.deepEqual(game.state.inventory, [{ id: 'storm_tonic', qty: 1 }]);
  assert.match(game.bagMessage, /^Crafted: /);
  assert.match(game.bagMessage, /Received Storm Tonic x1\./);
});

test('craft with unmet inputs leaves the inventory untouched and explains why', () => {
  const game = fakeGame();
  game.state.inventory = [{ id: 'healing_herb', qty: 1 }];
  bagScene.onEnter(game, {});
  const before = JSON.stringify(game.state.inventory);
  bagScene.actions.craft(game, { dataset: { arg: 'distill_tonic' } });
  assert.equal(JSON.stringify(game.state.inventory), before, 'no partial consumption');
  assert.match(game.bagMessage, /Missing materials: storm_glass \(have 0, need 1\)/);
  assert.doesNotMatch(game.bagMessage, /^Crafted:/);
});

test('re-render after a craft reflects updated have counts', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'healing_herb', qty: 1 },
    { id: 'storm_glass', qty: 1 },
  ];
  bagScene.onEnter(game, {});
  bagScene.actions.craft(game, { dataset: { arg: 'distill_tonic' } });
  const html = bagScene.render(game);
  const row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="distill_tonic"'));
  assert.match(row, /data-arg="distill_tonic"[^>]*disabled/, 'inputs spent, button re-disabled');
  assert.match(html, /<li class="bag-row"><span class="bag-name">Storm Tonic ×1<\/span>/, 'output appears as a bag row');
});

test('bag crafting surface stays egg-clean', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'healing_herb', qty: 1 },
    { id: 'storm_glass', qty: 1 },
    { id: 'scrap_metal', qty: 3 },
    { id: 'iron_sword', qty: 1 },
  ];
  bagScene.onEnter(game, {});
  const html = bagScene.render(game).replace(/class="[^"]*"/g, '');
  assert.equal(EGG_RE.test(html), false, 'no egg words in bag render');
});
