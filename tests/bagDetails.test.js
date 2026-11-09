// Bag details drawer: pure bagDetailsLines sourcing helper + row toggle wiring.
// Each pack row gets a Details button; choosing it reveals a short sourcing
// note (shops, trades, rare drops, story items) and choosing it again hides it.
import test from 'node:test';
import assert from 'node:assert/strict';

import { bagScene, bagDetailsLines } from '../src/scenes/bag.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function fakeGame(inventory = []) {
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
  return game;
}

const STOCK = [
  { id: 'storm_glass', qty: 2 },
  { id: 'relay_brass', qty: 1 },
  { id: 'bandage', qty: 3 },
  { id: 'rations', qty: 5 },
];

test('bagDetailsLines lists stocking shops with the buy price', () => {
  assert.deepEqual(bagDetailsLines('bandage'), ["Buy at: Hesta's Goods — 10g each"]);
  assert.deepEqual(bagDetailsLines('relay_brass'), [
    'Buy at: Relay Outpost Stores — 30g each',
    'Board Exchange: 1× for 7 Board Marks (1 less as Warden of the Board)',
  ]);
  assert.deepEqual(bagDetailsLines('storm_glass'), [
    "Buy at: Storm's Eye Post — 25g each",
    'Trade for it: Scrap for storm glass (Scrap Metal ×4) at Saltmere Trading Post · Relay Outpost Stores',
    'Board Exchange: 1× for 5 Board Marks (1 less as Warden of the Board)',
  ]);
});

test('bagDetailsLines separates trading away from buying, with no fallback line', () => {
  const lines = bagDetailsLines('scrap_metal');
  assert.deepEqual(lines, [
    'Trades away: Scrap for storm glass (for Storm Glass ×1) at Saltmere Trading Post · Relay Outpost Stores',
  ]);
  assert.equal(lines.length, 1, 'a traded-away item gets no generic fallback line');
});

test('bagDetailsLines marks rare drops that shops never stock', () => {
  assert.deepEqual(bagDetailsLines('stormcrown_shard'), ['Rare drop — shops never stock it.']);
});

test('bagDetailsLines distinguishes story items from unsold gear', () => {
  assert.deepEqual(bagDetailsLines('observatory_lens'), ['Story item — gained through the journey, not sold.']);
  assert.deepEqual(bagDetailsLines('iron_sword'), ['Not sold in shops — comes from foes, caches, rewards or crafting.']);
});

test('bagDetailsLines returns an empty list for unknown ids', () => {
  assert.deepEqual(bagDetailsLines('mystery_part'), []);
  assert.deepEqual(bagDetailsLines(''), []);
});

test('render shows Details buttons and no drawer before anything is opened', () => {
  const game = fakeGame(STOCK);
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.match(html, /<button data-action="bagDetails" data-arg="storm_glass" aria-expanded="false">Details<\/button>/);
  assert.doesNotMatch(html, /Hide details/, 'nothing is open on a fresh bag visit');
  assert.doesNotMatch(html, /class="bag-details"/, 'no drawer is rendered while closed');
  assertEggFree(html, 'bag details idle');
});

test('choosing Details opens one drawer with escaped sourcing lines and a Hide details button', () => {
  const game = fakeGame(STOCK);
  bagScene.onEnter(game, {});
  bagScene.actions.bagDetails(game, { dataset: { arg: 'storm_glass' } });
  assert.equal(game.bagDetailsId, 'storm_glass');
  const html = bagScene.render(game);
  assert.equal(html.split('class="bag-details"').length - 1, 1, 'exactly one drawer is open');
  assert.match(html, /<button data-action="bagDetails" data-arg="storm_glass" aria-expanded="true">Hide details<\/button>/);
  const drawer = html.split('class="bag-details"')[1].split('</div>')[0];
  assert.match(drawer, /<p>Buy at: Storm&#39;s Eye Post — 25g each<\/p>/);
  assert.match(drawer, /<p>Trade for it: Scrap for storm glass \(Scrap Metal ×4\) at Saltmere Trading Post · Relay Outpost Stores<\/p>/);
  assert.match(html, /<button data-action="bagDetails" data-arg="bandage" aria-expanded="false">Details<\/button>/, 'other rows stay closed');
  assertEggFree(html, 'bag details open');
});

test('choosing Details again closes the drawer, and another item swaps the drawer over', () => {
  const game = fakeGame(STOCK);
  bagScene.onEnter(game, {});
  bagScene.actions.bagDetails(game, { dataset: { arg: 'storm_glass' } });
  bagScene.actions.bagDetails(game, { dataset: { arg: 'storm_glass' } });
  assert.equal(game.bagDetailsId, '');
  assert.doesNotMatch(bagScene.render(game), /class="bag-details"/);

  bagScene.actions.bagDetails(game, { dataset: { arg: 'bandage' } });
  assert.equal(game.bagDetailsId, 'bandage');
  const html = bagScene.render(game);
  assert.match(html, /<p>Buy at: Hesta&#39;s Goods — 10g each<\/p>/);
  assert.doesNotMatch(html, /Buy at: Storm&#39;s Eye Post/, 'only the open row lists its sourcing');
});

test('bagDetails ignores missing or unknown ids', () => {
  const game = fakeGame(STOCK);
  bagScene.onEnter(game, {});
  bagScene.actions.bagDetails(game, {});
  assert.equal(game.bagDetailsId, '', 'no arg is a no-op');
  bagScene.actions.bagDetails(game, { dataset: { arg: 'mystery_part' } });
  assert.equal(game.bagDetailsId, '', 'unknown id is a no-op');
});

test('reopening the bag clears any open drawer, while render tolerates a missing value', () => {
  const game = fakeGame(STOCK);
  bagScene.onEnter(game, {});
  bagScene.actions.bagDetails(game, { dataset: { arg: 'storm_glass' } });
  assert.equal(game.bagDetailsId, 'storm_glass');
  bagScene.onEnter(game, {});
  assert.equal(game.bagDetailsId, '');

  const fresh = fakeGame(STOCK);
  fresh.bagDetailsId = undefined;
  assert.match(bagScene.render(fresh), /Details<\/button>/, 'a missing value renders as fully closed');
  assert.doesNotMatch(bagScene.render(fresh), /class="bag-details"/);
});
