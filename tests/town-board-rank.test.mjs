import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { townBoardRankText, bountyRankText } from '../src/core/bounties.js';
import { createInitialState } from '../src/state.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'After your first claim, the town square also shows your board rank and how many more claims the next rank needs.';
const withClaims = (n) => { const s = createInitialState(); s.bounties = { active: null, progress: 0, completed: { ridge_rats: n }, spent: 0 }; return s; };

test('town board rank line is null before the first claim and for malformed saves', () => {
  assert.equal(townBoardRankText(createInitialState()), null);
  assert.equal(townBoardRankText(null), null);
  assert.equal(townBoardRankText({}), null);
  assert.equal(townBoardRankText({ bounties: { completed: { ridge_rats: -2, nope: 5 } } }), null);
});

test('town board rank line reuses the board rank text after claims', () => {
  assert.equal(townBoardRankText(withClaims(1)), 'Board rank: Notice Runner (+0% gold). 2 more claims to Contract Hand (+10% gold).');
  assert.equal(townBoardRankText(withClaims(7)), 'Board rank: Contract Hand (+10% gold). 1 more claim to Board Regular (+20% gold).');
  assert.equal(townBoardRankText(withClaims(25)), 'Board rank: Warden of the Board (+40% gold). The highest rank on the board.');
  for (const n of [1, 3, 8, 15, 25, 40]) {
    assert.equal(townBoardRankText(withClaims(n)), bountyRankText(withClaims(n)));
    assertEggFree(townBoardRankText(withClaims(n)), 'town board rank line');
  }
});

test('town renders the board rank line only with a bounties scene and a claim', async () => {
  const { townScene } = await import('../src/scenes/town.js');
  const s = createInitialState();
  s.scene = 'town'; s.combat = null;
  const game = { state: s, scenes: { bounties: {} }, message: '' };
  assert.ok(!townScene.render(game).includes('town-bounty-rank'));
  s.bounties = { active: null, progress: 0, completed: { ridge_rats: 3 }, spent: 0 };
  const html = townScene.render(game);
  assert.ok(html.includes(`<p class="town-bounty-rank">${escapeHTML(townBoardRankText(s))}</p>`), html);
  assert.ok(html.indexOf('town-bounty-rank') > html.indexOf('town-bounty-idle'));
  assert.ok(!townScene.render({ ...game, scenes: {} }).includes('town-bounty-rank'));
});

test('guide documents the town board rank line', async () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  const { guideScene } = await import('../src/scenes/guide.js');
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(SENTENCE)));
  assertEggFree(SENTENCE, 'town board rank guide sentence');
});
