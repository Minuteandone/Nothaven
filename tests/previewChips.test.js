import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { previewText } from '../src/items/items.js';
import { shopScene } from '../src/scenes/shop.js';
import { bagScene } from '../src/scenes/bag.js';
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

function chipCount(html) {
  return html.split('class="preview-chip"').length - 1;
}

test('previewText composes type, stat line, use effect and sell value', () => {
  assert.equal(previewText(null), '');
  assert.equal(previewText({}), 'Goods');
  const herb = { name: 'Healing Herb', type: 'consumable', use: { hp: 30 }, price: 18, sellPrice: 9 };
  assert.equal(previewText(herb), 'Consumable · Use: restores 30 HP · Sell 9g each');
  const blade = { name: 'Sword', type: 'equipment', stats: { atk: 6, def: 1 }, price: 60, sellPrice: 30 };
  assert.equal(previewText(blade), 'Gear · ATK+6 · DEF+1 · Sell 30g each');
});

test('previewText hides the sell value for key items and zero-value goods', () => {
  assert.equal(previewText({ name: 'Lens', type: 'key' }), 'Key item');
  assert.equal(previewText({ name: 'Rock', type: 'material', price: 0 }), 'Material');
  assert.equal(previewText({ name: 'Mystery', type: 'trinket', price: 7 }), 'Goods · Sell 3g each');
});

test('trade rows show a preview chip on the received goods', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { shopId: 'saltmere_post', returnScene: 'town', mode: 'trade' });
  const html = shopScene.render(game);
  const row = html.split('<tr>').find((chunk) => chunk.includes('data-arg="scrap_to_glass"')) || '';
  assert.ok(row.includes('preview-chip'), 'chip present on the received item');
  assert.match(row, /data-preview="Material · Sell 12g each"/);
  assert.ok(row.includes('>Storm Glass</span>'), 'chip labels the received item');
  assertEggFree(html);
});

test('shop craft outputs carry preview chips with use effect and sell value', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { shopId: 'greyhaven_shop', returnScene: 'town', mode: 'craft' });
  const html = shopScene.render(game);
  assert.ok(chipCount(html) >= 20, `expected most recipes to chip their outputs, got ${chipCount(html)}`);
  assert.match(html, /data-preview="Consumable · Use: restores 45 HP · Sell 12g each"/);
  assertEggFree(html);
});

test('bag craft outputs carry the same preview chips', () => {
  const game = fakeGame();
  bagScene.onEnter(game, {});
  game.state.scene = 'bag';
  const html = bagScene.render(game);
  assert.ok(chipCount(html) >= 20, `expected most recipes to chip their outputs, got ${chipCount(html)}`);
  assert.match(html, /data-preview="Consumable · Use: restores 45 HP · Sell 12g each"/);
  assertEggFree(html);
});

test('unknown output ids still render a chip with an empty preview', () => {
  assert.equal(previewText(null), '');
  const game = fakeGame();
  shopScene.onEnter(game, { shopId: 'greyhaven_shop', returnScene: 'town', mode: 'craft' });
  const html = shopScene.render(game);
  assert.ok(!html.includes('data-preview="undefined"'));
  assert.ok(!html.includes('data-preview="null"'));
});
