import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bountyAnsweredText, bountiesScene } from '../src/scenes/bounties.js';
import { BOUNTIES } from '../src/core/bounties.js';
import { featStatus } from '../src/scenes/feats.js';
import { escapeHTML } from '../src/ui/components.js';
import { guideScene } from '../src/scenes/guide.js';
import { assertEggFree } from './helpers/eggGuard.mjs';
import { createInitialState } from '../src/state.js';

const SENTENCE = 'After your first claim, a “Notices answered:” line counts how many different contracts you have claimed at least once, toward the “Every Notice Answered” feat.';

test('bountyAnsweredText counts distinct claimed contracts and is null before any claim', () => {
  assert.equal(bountyAnsweredText({}), null);
  assert.equal(bountyAnsweredText(null), null);
  assert.equal(bountyAnsweredText({ bounties: { completed: {} } }), null);
  assert.equal(bountyAnsweredText({ bounties: { completed: { ridge_rats: 0 } } }), null);
  const two = bountyAnsweredText({ bounties: { completed: { ridge_rats: 5, howling_pass: 1, not_a_contract: 3 } } });
  assert.equal(two, 'Notices answered: 2 of 18 — claim the other 16 once each to earn “Every Notice Answered”.');
  assertEggFree(two, 'answered line');
});

test('bountyAnsweredText agrees with the Every Notice Answered feat progress', () => {
  const completed = {};
  for (const [i, b] of BOUNTIES.entries()) {
    completed[b.id] = 1;
    const s = { bounties: { completed: { ...completed } } };
    const st = featStatus(s).find((f) => f.id === 'bounties');
    const text = bountyAnsweredText(s);
    assert.ok(text.startsWith(`Notices answered: ${i + 1} of ${BOUNTIES.length}`), text);
    if (i + 1 === BOUNTIES.length) {
      assert.equal(text, 'Notices answered: 18 of 18 — “Every Notice Answered” earned.');
      assert.equal(st.done, true);
    } else {
      assert.equal(st.done, false);
    }
  }
});

test('the board renders the answered line once, after the posted count, only after a claim', () => {
  const s = createInitialState();
  s.bestiary = { storm_rat: 1 };
  s.scene = 'bounties'; s.combat = null;
  const game = { state: s, setScene() {} };
  bountiesScene.onEnter(game);
  assert.ok(!bountiesScene.render(game).includes('bounties__answered'));
  s.bounties = { ...(s.bounties || {}), completed: { ridge_rats: 1 } };
  const html = bountiesScene.render(game);
  const lines = [...html.matchAll(/<p class="bounties__answered">([^<]*)<\/p>/g)].map((m) => m[1]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0], escapeHTML('Notices answered: 1 of 18 — claim the other 17 once each to earn “Every Notice Answered”.'));
  assert.ok(html.indexOf('bounties__posted') < html.indexOf('bounties__answered'));
  assert.ok(html.indexOf('bounties__answered') < html.indexOf('bounties__rank'));
});

test('answered sentence is documented once in both guides, after the posted sentence', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  assert.ok(md.includes('opened so far. ' + SENTENCE));
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(SENTENCE)));
  assertEggFree(SENTENCE, 'answered sentence');
});
