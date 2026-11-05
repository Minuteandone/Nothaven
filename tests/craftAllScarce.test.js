import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bagScene } from '../src/scenes/bag.js';
import { createInitialState } from '../src/state.js';
import { listRecipes } from '../src/items/crafting.js';
import { isScarceItem } from '../src/items/shop.js';

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

test('recipes using rare drops list exactly the expected set', () => {
  const scarce = listRecipes().filter((r) => (r.inputs || []).some((i) => isScarceItem(i.id)));
  assert.deepEqual(
    scarce.map((r) => r.id).sort(),
    ['cut_crownshard_focus', 'forge_squall_cleaver', 'hammer_squall_bulwark', 'string_heartward_charm'],
  );
});

test('each rare-drop recipe renders Craft without a Craft all button', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'lens_shard', qty: 2 },
    { id: 'stormcrown_shard', qty: 3 },
    { id: 'relay_brass', qty: 2 },
    { id: 'salvaged_wiring', qty: 4 },
    { id: 'storm_glass', qty: 4 },
    { id: 'thunder_iron', qty: 6 },
    { id: 'maelstrom_plate', qty: 1 },
    { id: 'tempest_edge', qty: 1 },
  ];
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  for (const recipeId of ['cut_crownshard_focus', 'string_heartward_charm', 'forge_squall_cleaver', 'hammer_squall_bulwark']) {
    const row = html.split('<tr>').find((chunk) => chunk.includes(`data-arg="${recipeId}"`));
    assert.ok(row, `${recipeId} row rendered`);
    assert.doesNotMatch(row, /data-action="craftAll"/, `${recipeId} has no Craft all button`);
    assert.match(row, /craft-scarce/, `${recipeId} checklist tags the rare drop`);
    assert.match(row, /rare drop/);
  }
});

test('non-scarce recipes keep both buttons adjacent', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'healing_herb', qty: 2 },
    { id: 'storm_glass', qty: 2 },
  ];
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  const row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="distill_tonic"'));
  assert.ok(row, 'distill_tonic row rendered');
  assert.match(row, /<button data-action="craft" data-arg="distill_tonic">Craft<\/button> <button data-action="craftAll" data-arg="distill_tonic">Craft all<\/button>/);
});

test('craftAll action refuses rare-drop recipes even when materials are plentiful', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'lens_shard', qty: 2 },
    { id: 'stormcrown_shard', qty: 3 },
    { id: 'relay_brass', qty: 2 },
  ];
  const before = JSON.stringify(game.state.inventory);
  bagScene.onEnter(game, {});
  bagScene.actions.craftAll(game, { dataset: { arg: 'cut_crownshard_focus' } });
  assert.equal(game.bagMessage, 'Craft all is disabled for recipes that use rare drops.');
  assert.equal(JSON.stringify(game.state.inventory), before, 'inventory untouched by the guard');
  assert.doesNotMatch(game.bagMessage, /^Crafted:/);
});

test('single Craft still works for rare-drop recipes while Craft all is blocked', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'lens_shard', qty: 2 },
    { id: 'stormcrown_shard', qty: 3 },
    { id: 'relay_brass', qty: 2 },
  ];
  bagScene.onEnter(game, {});
  bagScene.actions.craftAll(game, { dataset: { arg: 'cut_crownshard_focus' } });
  assert.equal(game.bagMessage, 'Craft all is disabled for recipes that use rare drops.');
  bagScene.actions.craft(game, { dataset: { arg: 'cut_crownshard_focus' } });
  const qty = (inv, id) => inv.find((s) => s.id === id)?.qty || 0;
  assert.equal(qty(game.state.inventory, 'crownshard_focus'), 1, 'one focus crafted');
  assert.equal(qty(game.state.inventory, 'stormcrown_shard'), 2, 'one shard consumed');
});

test('scarce craft-all render stays free of egg words', () => {
  const game = fakeGame();
  game.state.inventory = [
    { id: 'stormcrown_shard', qty: 2 },
    { id: 'lens_shard', qty: 1 },
    { id: 'relay_brass', qty: 1 },
  ];
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assertEggFree(html, 'bag scarce render');
});
