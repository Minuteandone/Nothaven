import test from 'node:test';
import assert from 'node:assert/strict';
import { bountiesScene, huntTotalText } from '../src/scenes/bounties.js';
import { createInitialState } from '../src/state.js';
import { BOUNTIES } from '../src/core/bounties.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('huntTotalText names the base HP total the Easiest hunt sort uses', () => {
  assert.equal(huntTotalText(BOUNTIES[0]), 'Hunt total: 48 base HP across 4 foes.');
  assert.equal(huntTotalText(BOUNTIES.find((b) => b.id === 'colossus_thunder')), 'Hunt total: 380 base HP across 2 foes.');
  assert.equal(huntTotalText({ enemyId: 'storm_rat', count: 1 }), 'Hunt total: 12 base HP across 1 foe.');
  assert.equal(huntTotalText({ enemyId: 'nobody', count: 2 }), '');
  assert.equal(huntTotalText({ enemyId: 'toString', count: 2 }), '');
  for (const b of BOUNTIES) assertEggFree(huntTotalText(b), `hunt total ${b.id}`);
});

test('posted notices show their hunt total; unposted notices never do', () => {
  const s = createInitialState();
  s.bestiary = { storm_rat: 1 };
  s.scene = 'bounties'; s.combat = null;
  const game = { state: s, setScene() {} };
  bountiesScene.onEnter(game);
  const html = bountiesScene.render(game);
  const lines = [...html.matchAll(/<p class="bounty__hunt-total">([^<]*)<\/p>/g)].map((m) => m[1]);
  assert.deepEqual(lines, ['Hunt total: 48 base HP across 4 foes.']);
  assertEggFree(html, 'hunt total board');
});
