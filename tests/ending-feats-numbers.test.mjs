import test from 'node:test';
import assert from 'node:assert/strict';
import { endingScene } from '../src/scenes/ending.js';
import { FEATS, featsScene } from '../src/scenes/feats.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('ending journey numbers render as plain escaped text with safe fallbacks', () => {
  const state = { party: [{ name: 'Wren', level: 7 }], gold: 125, inventory: [{ id: 'linen_bandage', qty: 2 }, { id: 'tonic', qty: 3 }], story: { flags: {} } };
  const html = endingScene.render({ state });
  assert.match(html, /<li>Wren reached level 7<\/li>/);
  assert.match(html, /<li>Gold carried home: 125<\/li>/);
  assert.match(html, /<li>Items in pack: 5<\/li>/);
  const bad = endingScene.render({ state: { party: [{ name: 'Wren', level: 'x' }], gold: 'lots', inventory: [{ id: 'a', qty: 'n' }], story: { flags: {} } } });
  assert.match(bad, /reached level 1<\/li>/);
  assert.match(bad, /Gold carried home: 0<\/li>/);
  assert.match(bad, /Items in pack: 0<\/li>/);
  assertEggFree(html, 'ending journey numbers');
});

test('feats count line stays exact after escaping', () => {
  const html = featsScene.render({ state: createInitialState(), featsReturn: 'town', scenes: {} });
  assert.match(html, new RegExp(`<p class="feats__count">0 of ${FEATS.length} feats earned</p>`));
});
