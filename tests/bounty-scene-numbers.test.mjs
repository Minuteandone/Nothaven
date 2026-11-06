import test from 'node:test';
import assert from 'node:assert/strict';
import { bountiesScene } from '../src/scenes/bounties.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('bounty board renders numeric counts as plain escaped text', () => {
  const s = createInitialState();
  s.bestiary = { storm_rat: 1 }; s.scene = 'bounties'; s.combat = null;
  const game = { state: s, setScene() {} };
  bountiesScene.onEnter(game);
  let html = bountiesScene.render(game);
  assert.match(html, /<p class="bounties__total">Contracts claimed: 0<\/p>/);
  assert.match(html, /<p class="bounty__terms">Defeat 4 × Storm Rat ·/);
  game.bountyRegion = 'Ridge Road';
  html = bountiesScene.render(game);
  assert.match(html, /role="status">1 contract roams Ridge Road\./);
  assertEggFree(html, 'bounty board numbers');
});
