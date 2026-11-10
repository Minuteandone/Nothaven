import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { endingScene } from '../src/scenes/ending.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function render(state) { return endingScene.render({ state, endingReturn: null }); }
function finished() {
  const s = createInitialState();
  s.story.stage = 'complete'; s.story.ending = 'share_signal';
  return s;
}
const SENTENCE = 'Beneath the bounty board record, a “Notices answered:” line counts the different contracts you have claimed at least once, as on the board itself.';

test('ending omits Notices answered before the first claim', () => {
  assert.equal(render(finished()).includes('ending-bounty-answered'), false);
});

test('ending lists Notices answered right after the board record', () => {
  const s = finished();
  s.bounties = { active: null, progress: {}, completed: { ridge_rats: 3, pier_clearance: 4, wolf_trail: 2 } };
  const html = render(s);
  const line = '<li class="ending-bounty-answered">Notices answered: 3 of 18 — claim the other 15 once each to earn “Every Notice Answered”.</li>';
  assert.ok(html.includes(line), html);
  const rec = html.indexOf('<li class="ending-bounty-record">');
  assert.ok(rec >= 0 && rec < html.indexOf(line));
  assert.ok(html.indexOf(line) < html.indexOf('<h3>Credits</h3>'));
  assert.equal(html.split('ending-bounty-answered').length, 2);
  assertEggFree(line, 'ending notices answered');
});

test('ending Notices answered sentence appears in both guides', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length, 2);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(SENTENCE)));
  assertEggFree(SENTENCE, 'ending notices guide');
});
