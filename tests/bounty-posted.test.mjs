import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bountyPostedText, bountiesScene } from '../src/scenes/bounties.js';
import { bountyRows } from '../src/core/bounties.js';
import { escapeHTML } from '../src/ui/components.js';
import { guideScene } from '../src/scenes/guide.js';
import { assertEggFree } from './helpers/eggGuard.mjs';
import { createInitialState } from '../src/state.js';

const SENTENCE = 'Beneath the claim count, a line such as “Notices posted: 5 of 18.” shows how many contracts the board has opened so far.';

test('bountyPostedText counts unlocked rows out of all rows', () => {
  assert.equal(bountyPostedText([{ unlocked: true }, { unlocked: false }, { unlocked: true }]), 'Notices posted: 2 of 3.');
  assert.equal(bountyPostedText([]), 'Notices posted: 0 of 0.');
  assert.equal(bountyPostedText(null), 'Notices posted: 0 of 0.');
  const fresh = bountyRows({ bestiary: {} });
  assert.equal(bountyPostedText(fresh), 'Notices posted: 0 of 18.');
  const one = bountyRows({ bestiary: { storm_rat: 1 } });
  assert.equal(bountyPostedText(one), 'Notices posted: 1 of 18.');
  assertEggFree(bountyPostedText(one), 'posted line');
});

test('posted-count sentence is documented in both guides', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(SENTENCE)));
  assertEggFree(SENTENCE, 'posted sentence');
});

test('the board renders the posted count once, below the claim count', () => {
  const s = createInitialState();
  s.bestiary = { storm_rat: 1, gale_hound: 2 };
  s.scene = 'bounties'; s.combat = null;
  const game = { state: s, setScene() {} };
  bountiesScene.onEnter(game);
  const html = bountiesScene.render(game);
  const lines = [...html.matchAll(/<p class="bounties__posted">([^<]*)<\/p>/g)].map((m) => m[1]);
  assert.deepEqual(lines, ['Notices posted: 2 of 18.']);
  assert.ok(html.indexOf('bounties__total') < html.indexOf('bounties__posted'));
  assert.ok(html.indexOf('bounties__posted') < html.indexOf('bounties__rank'));
});
