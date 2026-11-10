import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';
import { getItem } from '../src/items/items.js';
import { useEffectLine } from '../src/items/items.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function fakeGame() {
  const game = {
    state: createInitialState(),
    shopMode: undefined,
    shopMessage: '',
    shopReturnScene: undefined,
    lastScene: null,
    registered: {},
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered[name] = scene; },
  };
  return game;
}

function sellHtml(game, items) {
  game.state.inventory = grantRewards(game.state.inventory, items).inv;
  game.shopMode = 'sell';
  return shopScene.render(game);
}

function sellRow(html, id) {
  return html.split('<tr>').find((chunk) => chunk.includes(`data-action="sell" data-arg="${id}"`));
}

test('useEffectLine describes consumable effects and skips non-consumables', () => {
  assert.equal(useEffectLine(getItem('rations')), 'Use: restores 10 HP');
  assert.equal(useEffectLine(getItem('bandage')), 'Use: restores 15 HP · cures Bleeding');
  assert.equal(useEffectLine(getItem('storm_tonic')), 'Use: restores 20 MP · cures Shocked');
  assert.equal(useEffectLine(getItem('field_dressing')), 'Use: restores 20 HP · cures Bleeding');
  assert.equal(useEffectLine(getItem('tempest_salve')), 'Use: restores 75 HP · cures Shocked');
  assert.equal(useEffectLine(getItem('iron_sword')), '');
  assert.equal(useEffectLine(getItem('scrap_metal')), '');
  assert.equal(useEffectLine(null), '');
});

test('sell rows show a consumable use-effect line under the item name', () => {
  const game = fakeGame();
  const html = sellHtml(game, { rations: 2, bandage: 1 });
  const rationsRow = sellRow(html, 'rations');
  assert.ok(rationsRow, 'rations sell row renders');
  assert.ok(
    rationsRow.includes('<span class="bag-use">Use: restores 10 HP</span>'),
    'rations sell row shows its HP restore effect'
  );
  const bandageRow = sellRow(html, 'bandage');
  assert.ok(bandageRow, 'bandage sell row renders');
  assert.ok(
    bandageRow.includes('<span class="bag-use">Use: restores 15 HP · cures Bleeding</span>'),
    'bandage sell row shows restore + cure effects'
  );
});

test('sell rows for gear and materials get no use-effect span', () => {
  const game = fakeGame();
  const html = sellHtml(game, { iron_sword: 1, scrap_metal: 4 });
  for (const id of ['iron_sword', 'scrap_metal']) {
    const row = sellRow(html, id);
    assert.ok(row, `${id} sell row renders`);
    assert.ok(!row.includes('bag-use'), `${id} has no use-effect span`);
  }
  assert.ok(!html.includes('<span class="bag-use">'), 'no use-effect spans without consumables');
});

test('use-effect line sits inside the first name cell of the sell row', () => {
  const game = fakeGame();
  const html = sellHtml(game, { storm_tonic: 1 });
  const row = sellRow(html, 'storm_tonic');
  assert.ok(row, 'storm_tonic sell row renders');
  const cell = row.slice(0, row.indexOf('</td>'));
  assert.ok(
    cell.includes('<span class="bag-use">Use: restores 20 MP · cures Shocked</span>'),
    'use line renders inside the first cell'
  );
});

test('gear sell rows keep their stats summary instead of a use line', () => {
  const game = fakeGame();
  const html = sellHtml(game, { iron_sword: 1 });
  const row = sellRow(html, 'iron_sword');
  assert.ok(row, 'iron_sword sell row renders');
  const cell = row.slice(0, row.indexOf('</td>'));
  assert.ok(cell.includes('<small>ATK'), 'gear stats summary in first cell');
  assert.ok(!cell.includes('bag-use'), 'no use line on gear');
});

test('sell view with use-effect lines stays egg-free and leak-free', () => {
  const game = fakeGame();
  const html = sellHtml(game, { rations: 2, storm_tonic: 1, iron_sword: 1, scrap_metal: 3 });
  assertEggFree(html, 'sell tab with use-effect lines');
  assert.ok(!html.includes('undefined'), 'no undefined leaking into markup');
});
