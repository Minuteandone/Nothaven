import test from 'node:test';
import assert from 'node:assert/strict';
import { endingScene } from '../src/scenes/ending.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function render(state) { return endingScene.render({ state, endingReturn: null }); }

test('ending omits the board record before the first claim', () => {
  const s = createInitialState();
  s.story.stage = 'complete'; s.story.ending = 'share_signal';
  assert.equal(render(s).includes('ending-bounty-record'), false);
});

test('ending lists the board record under Your journey after claims', () => {
  const s = createInitialState();
  s.story.stage = 'complete'; s.story.ending = 'share_signal';
  s.bounties = { active: null, progress: {}, completed: { ridge_rats: 3, pier_clearance: 4, wolf_trail: 2 } };
  const html = render(s);
  const line = '<li class="ending-bounty-record">Board record: 9 claims · Board Regular · 2 of 18 contracts mastered.</li>';
  assert.ok(html.includes(line), html);
  assert.ok(html.indexOf(line) > html.indexOf('<h3>Your journey</h3>'));
  assert.ok(html.indexOf(line) < html.indexOf('<h3>Credits</h3>'));
  assertEggFree(line, 'ending board record');
});
