// Bag screen sort control: pure sortStacks helper + render/action wiring.
import test from 'node:test';
import assert from 'node:assert/strict';

import { bagScene, sortStacks, BAG_SORTS } from '../src/scenes/bag.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function fakeGame(inventory = []) {
  const game = {
    state: createInitialState(),
    bagMemberIndex: 0,
    bagMessage: '',
    bagReturnScene: 'town',
    setScene() {},
    registerScene() {},
  };
  game.state.inventory = inventory;
  return game;
}

function namesIn(html, label) {
  const seg = html.split(`aria-label="${label}"`)[1].split('</section>')[0];
  return [...seg.matchAll(/bag-name">([^<]*?) ×/g)].map((m) => m[1]);
}

const MATERIALS = [{ id: 'storm_glass', qty: 2 }, { id: 'relay_brass', qty: 1 }, { id: 'scrap_metal', qty: 4 }];

test('BAG_SORTS pins the mode list and sortStacks keeps insertion order for type/unknown', () => {
  assert.deepEqual([...BAG_SORTS], ['type', 'name', 'value']);
  const stacks = [...MATERIALS];
  const out = sortStacks(stacks, 'type');
  assert.deepEqual(out.map((s) => s.id), ['storm_glass', 'relay_brass', 'scrap_metal']);
  assert.notEqual(out, stacks, 'returns a new array');
  assert.deepEqual(sortStacks(stacks).map((s) => s.id), ['storm_glass', 'relay_brass', 'scrap_metal'], 'default mode is type');
  assert.deepEqual(sortStacks(stacks, 'nonsense').map((s) => s.id), ['storm_glass', 'relay_brass', 'scrap_metal']);
  assert.deepEqual(stacks, MATERIALS, 'input array untouched');
});

test('sortStacks name mode sorts case-insensitively with an id tie-break', () => {
  const stacks = [{ id: 'rations', qty: 2 }, { id: 'tempest_salve', qty: 1 }, { id: 'bandage', qty: 5 }];
  assert.deepEqual(sortStacks(stacks, 'name').map((s) => s.id), ['bandage', 'tempest_salve', 'rations']);
  const tied = [{ id: 'gale_charm', qty: 1 }, { id: 'lens_shard', qty: 1 }];
  assert.deepEqual(sortStacks(tied, 'name').map((s) => s.id), ['gale_charm', 'lens_shard']);
});

test('sortStacks value mode sorts by stack sell total, name on ties', () => {
  // Tempest Salve sells for 33, Trail Rations 2, Linen Bandage 5.
  const stacks = [{ id: 'rations', qty: 3 }, { id: 'tempest_salve', qty: 1 }, { id: 'bandage', qty: 2 }];
  assert.deepEqual(sortStacks(stacks, 'value').map((s) => s.id), ['tempest_salve', 'bandage', 'rations']);
  const tied = [{ id: 'rations', qty: 5 }, { id: 'bandage', qty: 2 }]; // 10 vs 10
  assert.deepEqual(sortStacks(tied, 'value').map((s) => s.id), ['bandage', 'rations']);
});

test('sortStacks tolerates unknown item ids', () => {
  const stacks = [{ id: 'bandage', qty: 1 }, { id: 'mystery_id', qty: 9 }];
  assert.deepEqual(sortStacks(stacks, 'name').map((s) => s.id), ['bandage', 'mystery_id']);
  assert.deepEqual(sortStacks(stacks, 'value').map((s) => s.id), ['bandage', 'mystery_id']);
  assert.equal(sortStacks(null, 'name').length, 0);
});

test('render defaults to Type order with the Type button pressed', () => {
  const game = fakeGame(MATERIALS);
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.ok(html.includes('aria-label="Sort bag items"'), 'sort group present');
  assert.ok(html.includes('data-arg="type" aria-pressed="true"'), 'Type pressed');
  assert.ok(!html.includes('data-arg="name" aria-pressed'), 'Name not pressed');
  assert.deepEqual(namesIn(html, 'Materials'), ['Storm Glass', 'Relay Brass', 'Scrap Metal']);
});

test('bagSort action switches the pressed button and reorders rows; bad args are ignored', () => {
  const game = fakeGame(MATERIALS);
  bagScene.onEnter(game, {});
  bagScene.actions.bagSort(game, { dataset: { arg: 'name' } });
  let html = bagScene.render(game);
  assert.ok(html.includes('data-arg="name" aria-pressed="true"'));
  assert.deepEqual(namesIn(html, 'Materials'), ['Relay Brass', 'Scrap Metal', 'Storm Glass']);
  bagScene.actions.bagSort(game, { dataset: { arg: 'not-a-mode' } });
  assert.equal(game.bagSort, 'name', 'invalid arg keeps the previous mode');
  bagScene.actions.bagSort(game, { dataset: { arg: 'value' } });
  html = bagScene.render(game);
  assert.ok(html.includes('data-arg="value" aria-pressed="true"'));
});

test('value mode renders priciest stacks first inside a section', () => {
  const game = fakeGame([{ id: 'rations', qty: 3 }, { id: 'tempest_salve', qty: 1 }, { id: 'bandage', qty: 2 }]);
  bagScene.onEnter(game, {});
  bagScene.actions.bagSort(game, { dataset: { arg: 'value' } });
  const html = bagScene.render(game);
  assert.deepEqual(namesIn(html, 'Consumables'), ['Tempest Salve', 'Linen Bandage', 'Trail Rations']);
});

test('sort control renders on an empty bag and sections stay grouped by type', () => {
  const game = fakeGame([]);
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.ok(html.includes('aria-label="Sort bag items"'));
  assert.ok(html.includes('Your bag is empty.'));
  assert.ok(!html.includes('aria-label="Materials"'), 'no empty sections');
});

test('sort mode persists across onEnter within a session', () => {
  const game = fakeGame(MATERIALS);
  bagScene.onEnter(game, {});
  bagScene.actions.bagSort(game, { dataset: { arg: 'name' } });
  bagScene.onEnter(game, {});
  assert.equal(game.bagSort, 'name', 'onEnter does not reset the sort choice');
  const html = bagScene.render(game);
  assert.deepEqual(namesIn(html, 'Materials'), ['Relay Brass', 'Scrap Metal', 'Storm Glass']);
});

test('rendered bag stays egg-free with the sort control', () => {
  const game = fakeGame([...MATERIALS, { id: 'rations', qty: 2 }, { id: 'iron_sword', qty: 1 }]);
  bagScene.onEnter(game, {});
  bagScene.actions.bagSort(game, { dataset: { arg: 'name' } });
  assertEggFree(bagScene.render(game));
});
