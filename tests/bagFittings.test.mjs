import { test } from 'node:test';
import assert from 'node:assert/strict';

import { bagScene } from '../src/scenes/bag.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function fakeGame() {
  const game = {
    state: createInitialState(),
    bagMemberIndex: 0,
    bagMessage: '',
    bagReturnScene: 'town',
    setScene(name, data) { game.lastScene = { name, data }; },
  };
  return game;
}

test('equipped weapon and armour show their forge fitting level in the bag', () => {
  const game = fakeGame();
  const hero = game.state.party[0];
  hero.equipment = { weapon: 'iron_sword', armor: 'leather_armor', trinket: null };
  hero.temper = { weapon: 2, armor: 1 };
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.match(html, /<span class="bag-fitting" data-fitting-level="2">Fitting \+2 of 3 · \+4 atk<\/span>/);
  assert.match(html, /<span class="bag-fitting" data-fitting-level="1">Fitting \+1 of 3 · \+1 def, \+4 HP<\/span>/);
  assertEggFree(html, 'bag fittings html');
});

test('unfitted or trinket slots show no fitting badge', () => {
  const game = fakeGame();
  const hero = game.state.party[0];
  hero.equipment = { weapon: 'iron_sword', armor: null, trinket: 'tin_whistle' };
  hero.temper = { weapon: 0, armor: 3, trinket: 3 };
  bagScene.onEnter(game, {});
  const html = bagScene.render(game);
  assert.doesNotMatch(html, /bag-fitting/);
});
