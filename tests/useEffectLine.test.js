// Consumable use effects: pure useEffectLine helper + row rendering.
// Pack rows and shop buy rows show a one-line mechanical effect summary.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { useEffectLine, getItem } from '../src/items/items.js';
import { bagScene } from '../src/scenes/bag.js';
import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function bagGame(inventory = []) {
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

function shopGame() {
  const game = {
    state: createInitialState(),
    shopMode: 'buy',
    shopMessage: '',
    shopReturnScene: 'town',
    shopId: 'greyhaven_shop',
    shopMemberIndex: 0,
    lastScene: null,
    registered: {},
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered[name] = scene; },
  };
  game.state.gold = 300;
  return game;
}

function buyTable(html) {
  return html.split('aria-label="Items for sale">')[1].split('</table>')[0];
}

function rowFor(html, itemId) {
  return buyTable(html)
    .split('<tr>')
    .find((chunk) => chunk.includes(`data-action="buy" data-arg="${itemId}"`));
}

test('useEffectLine summarizes hp, mp and cure parts in order', () => {
  assert.equal(useEffectLine(getItem('bandage')), 'Use: restores 15 HP · cures Bleeding');
  assert.equal(useEffectLine(getItem('storm_tonic')), 'Use: restores 20 MP · cures Shocked');
  assert.equal(useEffectLine(getItem('rations')), 'Use: restores 10 HP');
  assert.equal(useEffectLine(getItem('hearty_chowder')), 'Use: restores 45 HP');
  assert.equal(useEffectLine(getItem('field_dressing')), 'Use: restores 20 HP · cures Bleeding');
});

test('useEffectLine returns an empty string without a usable effect', () => {
  assert.equal(useEffectLine(null), '');
  assert.equal(useEffectLine(undefined), '');
  assert.equal(useEffectLine({}), '');
  assert.equal(useEffectLine({ use: null }), '');
  assert.equal(useEffectLine({ use: 'swig' }), '');
  assert.equal(useEffectLine(getItem('iron_sword')), '', 'equipment has no use line');
  assert.equal(useEffectLine(getItem('storm_glass')), '', 'materials have no use line');
});

test('useEffectLine ignores non-positive values and empty cure strings', () => {
  assert.equal(useEffectLine({ use: { hp: 0 } }), '');
  assert.equal(useEffectLine({ use: { hp: -5 } }), '');
  assert.equal(useEffectLine({ use: { mp: 0, cure: 'shocked' } }), 'Use: cures Shocked');
  assert.equal(useEffectLine({ use: { hp: 4, cure: '' } }), 'Use: restores 4 HP');
});

test('pack rows show the use effect and gear rows do not', () => {
  const game = bagGame([
    { id: 'bandage', qty: 3 },
    { id: 'rations', qty: 2 },
    { id: 'iron_sword', qty: 1 },
  ]);
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.ok(
    html.includes('<span class="bag-use">Use: restores 15 HP · cures Bleeding</span>'),
    'bandage row shows its effect'
  );
  assert.ok(
    html.includes('<span class="bag-use">Use: restores 10 HP</span>'),
    'rations row shows its effect'
  );
  assert.equal(html.split('class="bag-use"').length - 1, 2, 'exactly the two consumable rows show effects');
  assertEggFree(html, 'bag use effects');
});

test('shop buy rows show the use effect and gear rows do not', () => {
  const game = shopGame();
  const html = shopScene.render(game);
  const bandageRow = rowFor(html, 'bandage');
  assert.ok(bandageRow, 'bandage is stocked at Greyhaven');
  assert.ok(
    bandageRow.includes('<br><small>Use: restores 15 HP · cures Bleeding</small>'),
    'bandage buy row shows its effect'
  );
  const vestRow = rowFor(html, 'padded_vest');
  assert.ok(vestRow, 'padded vest is stocked at Greyhaven');
  assert.ok(!vestRow.includes('Use:'), 'gear buy rows never show a use line');
  assertEggFree(html, 'shop use effects');
});
