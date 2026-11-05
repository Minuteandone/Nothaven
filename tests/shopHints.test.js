import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { bagScene } from '../src/scenes/bag.js';
import { shopsStocking } from '../src/items/shop.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('shopsStocking lists every shop that stocks an item in canonical order', () => {
  assert.deepEqual(shopsStocking('rations'), ['Hesta\'s Goods', 'Saltmere Trading Post', 'Relay Outpost Stores']);
  assert.deepEqual(shopsStocking('storm_tonic'), ['Hesta\'s Goods', 'Saltmere Trading Post']);
  assert.deepEqual(shopsStocking('bandage'), ['Hesta\'s Goods']);
  assert.deepEqual(shopsStocking('relay_brass'), ['Relay Outpost Stores']);
});

test('shopsStocking returns empty for unstocked, unknown and non-string ids', () => {
  assert.deepEqual(shopsStocking('stormcrown_shard'), []); // boss-only material, never stocked
  assert.deepEqual(shopsStocking('scrap_metal'), []);
  assert.deepEqual(shopsStocking('no_such_item'), []);
  assert.deepEqual(shopsStocking(42), []);
  assert.deepEqual(shopsStocking(null), []);
});

test('shopsStocking is a pure read over the shop registry', () => {
  const first = shopsStocking('rations');
  const second = shopsStocking('rations');
  assert.deepEqual(first, second);
  assert.notEqual(first, second, 'must hand out fresh arrays, not a shared reference');
});

function renderBag() {
  const game = {
    state: createInitialState(),
    bagMemberIndex: 3,
    bagReturnScene: 'stale',
    bagMessage: 'stale',
    setScene() {},
    registerScene() {},
  };
  bagScene.onEnter(game, {});
  return bagScene.render(game);
}

test('bag craft checklist shows which shops stock a recipe ingredient', () => {
  const html = renderBag();
  const rows = html.split('<tr>');
  const chowderRow = rows.find((r) => r.includes('Rations ×'));
  assert.ok(chowderRow, 'brew chowder recipe row with a Rations input is rendered');
  assert.match(
    chowderRow,
    /<small class="craft-source">at Hesta&#39;s Goods · Saltmere Trading Post · Relay Outpost Stores<\/small>/,
    'multi-shop hint joins display names with middots'
  );
  const tonicRow = rows.find((r) => r.includes('Healing Herb ×'));
  assert.match(
    tonicRow,
    /<small class="craft-source">at Hesta&#39;s Goods<\/small>/,
    'single-shop hint uses the escaped shop display name'
  );
});

test('field- and boss-only ingredients get no shop hint', () => {
  const html = renderBag();
  const rows = html.split('<tr>');
  const scrapRow = rows.find((r) => r.includes('Scrap Metal ×'));
  assert.ok(scrapRow, 'a recipe with a scrap metal input is rendered');
  assert.ok(!scrapRow.includes('craft-source'), 'scrap metal is not stocked anywhere, so no hint');
});

test('rendered bag with shop hints stays egg-free', () => {
  assertEggFree(renderBag(), 'bag scene with craft-source hints');
});
