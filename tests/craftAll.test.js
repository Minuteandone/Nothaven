import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bagScene } from '../src/scenes/bag.js';
import { createInitialState } from '../src/state.js';
import { listRecipes } from '../src/items/crafting.js';

import { assertEggFree } from './helpers/eggGuard.mjs';

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

test('craft all repeats until inputs run out and reports the total', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'healing_herb', qty: 7 },
    { id: 'storm_glass', qty: 7 },
  ];
  bagScene.onEnter(game, {});
  bagScene.actions.craftAll(game, { dataset: { arg: 'distill_tonic' } });
  assert.deepEqual(game.state.inventory, [{ id: 'storm_tonic', qty: 7 }]);
  assert.equal(game.bagMessage, 'Crafted: Distill Storm Tonic x7.');
});

test('craft all stops at a partial batch and keeps leftovers', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'rations', qty: 5 },
    { id: 'healing_herb', qty: 3 },
  ];
  bagScene.onEnter(game, {});
  // Brew Hearty Chowder needs 2 rations + 1 healing herb per craft.
  bagScene.actions.craftAll(game, { dataset: { arg: 'brew_chowder' } });
  assert.deepEqual(game.state.inventory, [
    { id: 'rations', qty: 1 },
    { id: 'healing_herb', qty: 1 },
    { id: 'hearty_chowder', qty: 2 },
  ]);
  assert.equal(game.bagMessage, 'Crafted: Brew Hearty Chowder x2.');
});

test('craft all with missing materials leaves inventory untouched', () => {
  const game = fakeGame();
  game.state.inventory = [{ id: 'rations', qty: 4 }];
  const before = JSON.stringify(game.state.inventory);
  bagScene.onEnter(game, {});
  bagScene.actions.craftAll(game, { dataset: { arg: 'distill_tonic' } });
  assert.equal(JSON.stringify(game.state.inventory), before, 'no partial consumption');
  assert.match(game.bagMessage, /Missing materials: healing_herb \(have 0, need 1\), storm_glass \(have 0, need 1\)\./);
  assert.doesNotMatch(game.bagMessage, /^Crafted:/);
});

test('craft all records a single exploration log entry, not one per craft', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'healing_herb', qty: 6 },
    { id: 'storm_glass', qty: 6 },
  ];
  bagScene.onEnter(game, {});
  bagScene.actions.craftAll(game, { dataset: { arg: 'distill_tonic' } });
  const log = game.state.map?.log || [];
  const crafted = log.filter((line) => line.startsWith('Crafted:'));
  assert.equal(crafted.length, 1, `expected one log line, got ${crafted.length}`);
});

test('every recipe row offers a Craft all button that mirrors Craft availability', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'healing_herb', qty: 2 },
    { id: 'storm_glass', qty: 2 },
  ];
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  const recipes = listRecipes();
  const craftAllButtons = (html.match(/data-action="craftAll"/g) || []).length;
  assert.equal(craftAllButtons, recipes.length, 'one Craft all button per recipe');
  // Affordable recipe: both buttons enabled and adjacent in the same cell.
  const row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="distill_tonic"'));
  assert.ok(row, 'distill_tonic row rendered');
  assert.match(row, /<button data-action="craft" data-arg="distill_tonic">Craft<\/button> <button data-action="craftAll" data-arg="distill_tonic">Craft all<\/button>/);
  // Unaffordable recipe: Craft all disabled alongside Craft.
  const missing = html.split('<tr>').find((chunk) => chunk.includes('data-arg="reforge_blade"'));
  assert.ok(missing, 'reforge_blade row rendered');
  assert.match(missing, /data-action="craftAll" data-arg="reforge_blade" disabled/);
});

test('craft all render stays free of egg words', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'healing_herb', qty: 4 },
    { id: 'storm_glass', qty: 4 },
  ];
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assertEggFree(html, 'bag render');
});
