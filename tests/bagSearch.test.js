// Bag screen search: pure filterStacksByQuery helper + render/action wiring.
// Mirrors the recipe-book search semantics (!218): names only, trim + slice,
// applied on Search, reset on reopen.
import test from 'node:test';
import assert from 'node:assert/strict';

import { bagScene, filterStacksByQuery } from '../src/scenes/bag.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function fakeGame(inventory = [], rootValue) {
  const game = {
    state: createInitialState(),
    bagMemberIndex: 0,
    bagMessage: '',
    bagReturnScene: 'town',
    bagQuery: '',
    setScene() {},
    registerScene() {},
  };
  game.state.inventory = inventory;
  game.state.scene = 'bag';
  if (rootValue !== undefined) game.root = { querySelector: () => ({ value: rootValue }) };
  return game;
}

const STOCK = [
  { id: 'storm_glass', qty: 2 },
  { id: 'relay_brass', qty: 1 },
  { id: 'rations', qty: 5 },
];

test('filterStacksByQuery with an empty query returns a copy and never mutates input', () => {
  const stacks = [...STOCK];
  const out = filterStacksByQuery(stacks, '');
  assert.deepEqual(out.map((s) => s.id), ['storm_glass', 'relay_brass', 'rations']);
  assert.notEqual(out, stacks, 'returns a new array');
  assert.deepEqual(filterStacksByQuery(stacks).map((s) => s.id), ['storm_glass', 'relay_brass', 'rations'], 'query defaults to empty');
  assert.deepEqual(stacks, STOCK, 'input array untouched');
});

test('filterStacksByQuery matches display names case-insensitively after trim', () => {
  assert.deepEqual(filterStacksByQuery(STOCK, '  STORM Glass  ').map((s) => s.id), ['storm_glass']);
  assert.deepEqual(filterStacksByQuery(STOCK, 'ration').map((s) => s.id), ['rations']);
  assert.deepEqual(filterStacksByQuery(STOCK, 'brass').map((s) => s.id), ['relay_brass']);
  assert.deepEqual(filterStacksByQuery(STOCK, 'no such item'), []);
});

test('filterStacksByQuery tolerates unknown ids and null stacks', () => {
  assert.deepEqual(filterStacksByQuery([{ id: 'mystery_part', qty: 1 }], 'mystery').length, 1, 'unknown ids fall back to the raw id');
  assert.deepEqual(filterStacksByQuery(null, 'x'), []);
  assert.deepEqual(filterStacksByQuery(undefined), []);
});

test('render without a query shows the search controls with Clear disabled and no count lines', () => {
  const game = fakeGame(STOCK);
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.match(html, /<label for="bag-search-input">Search bag<\/label>/);
  assert.match(html, /Search item or recipe names, then choose Search\./);
  assert.match(html, /<input type="search" id="bag-search-input" maxlength="120"/);
  assert.match(html, /<button data-action="bagSearchApply">Search<\/button>/);
  assert.match(html, /<button data-action="bagSearchClear" disabled>Clear search<\/button>/);
  assert.doesNotMatch(html, /Showing \d+ of \d+ items\./);
  assert.doesNotMatch(html, /Showing \d+ of \d+ recipes\./);
  assertEggFree(html, 'bag search idle');
});

test('render with a query filters groups, shows item and craft count lines', () => {
  const game = fakeGame(STOCK);
  bagScene.onEnter(game, {});
  game.bagQuery = 'storm glass';
  const html = bagScene.render(game);
  assert.match(html, /<p class="bag-count" role="status">Showing 1 of 3 items\.<\/p>/);
  assert.match(html, /Showing 10 of 26 recipes\./);
  const materials = html.split('aria-label="Materials"')[1].split('</section>')[0];
  assert.match(materials, /bag-name">Storm Glass ×2</);
  assert.doesNotMatch(materials, /Relay Brass/);
  assert.doesNotMatch(html, /aria-label="Supplies"/, 'groups with no matches are omitted');
  assert.match(html, /value="storm glass"/, 'query echoed into the input');
  assert.match(html, /<button data-action="bagSearchClear">Clear search<\/button>/, 'Clear enabled once a query exists');
  assertEggFree(html, 'bag search active');
});

test('render with a query matching nothing shows the no-match line and keeps the empty-bag message distinct', () => {
  const game = fakeGame(STOCK);
  bagScene.onEnter(game, {});
  game.bagQuery = 'zzz';
  const html = bagScene.render(game);
  assert.match(html, /No items match &quot;zzz&quot;\./);
  assert.match(html, /Showing 0 of 26 recipes\./);
  assert.doesNotMatch(html, /Your bag is empty\./);
  const game2 = fakeGame([]);
  bagScene.onEnter(game2, {});
  assert.match(bagScene.render(game2), /Your bag is empty\./);
});

test('bagSearchApply reads the input value, trims it and slices to 120 characters', () => {
  const game = fakeGame(STOCK, '  STORM glass  ');
  bagScene.actions.bagSearchApply(game, {});
  assert.equal(game.bagQuery, 'STORM glass');
  const long = fakeGame(STOCK, 'x'.repeat(130));
  bagScene.actions.bagSearchApply(long, {});
  assert.equal(long.bagQuery.length, 120);
});

test('bagSearchApply is a no-op without a readable input, off-scene, or in combat', () => {
  const noRoot = fakeGame(STOCK);
  noRoot.bagQuery = 'keep';
  bagScene.actions.bagSearchApply(noRoot, {});
  assert.equal(noRoot.bagQuery, 'keep', 'missing root leaves the query alone');

  const offScene = fakeGame(STOCK, 'hello');
  offScene.state.scene = 'town';
  bagScene.actions.bagSearchApply(offScene, {});
  assert.equal(offScene.bagQuery, '', 'off-scene no-op');

  const fighting = fakeGame(STOCK, 'hello');
  fighting.state.combat = {};
  bagScene.actions.bagSearchApply(fighting, {});
  assert.equal(fighting.bagQuery, '', 'combat no-op');
});

test('bagSearchClear resets the query and honors the same guards', () => {
  const game = fakeGame(STOCK);
  game.bagQuery = 'storm glass';
  bagScene.actions.bagSearchClear(game, {});
  assert.equal(game.bagQuery, '');
  const fighting = fakeGame(STOCK);
  fighting.bagQuery = 'storm glass';
  fighting.state.combat = {};
  bagScene.actions.bagSearchClear(fighting, {});
  assert.equal(fighting.bagQuery, 'storm glass', 'combat no-op');
});

test('reopening the bag resets the query, while sort changes keep it inside the scene', () => {
  const game = fakeGame(STOCK);
  bagScene.onEnter(game, {});
  game.bagQuery = 'storm glass';
  game.bagSort = 'value';
  assert.match(bagScene.render(game), /Showing 1 of 3 items\./, 'query survives sort changes');
  bagScene.onEnter(game, {});
  assert.equal(game.bagQuery, '');
  assert.doesNotMatch(bagScene.render(game), /Showing \d+ of \d+ items\./);
});
