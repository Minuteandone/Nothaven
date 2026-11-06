import test from 'node:test';
import assert from 'node:assert/strict';
import { endingScene, battlesText } from '../src/scenes/ending.js';
import { FEATS, featsEarned } from '../src/scenes/feats.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function finished() {
  const s = createInitialState();
  s.story.stage = 'complete'; s.story.ending = 'share_signal';
  return s;
}
const render = (s) => endingScene.render({ state: s, endingReturn: null });

test('battlesText reads the Service Record and sanitises bad counts', () => {
  assert.equal(battlesText(createInitialState()), 'Battles won: 0');
  assert.equal(battlesText({ ledger: { victories: 42, bossVictories: 9 } }), 'Battles won: 42 (9 against bosses)');
  assert.equal(battlesText({ ledger: { victories: -3, bossVictories: 'x' } }), 'Battles won: 0');
  assert.equal(battlesText(null), 'Battles won: 0');
});

test('ending lists battles and feats under Your journey, before Credits', () => {
  const s = finished();
  s.ledger = { victories: 57, bossVictories: 11 };
  const html = render(s);
  const battles = '<li class="ending-battles">Battles won: 57 (11 against bosses)</li>';
  const feats = `<li class="ending-feats">Wardens’ Feats earned: ${featsEarned(s)} of ${FEATS.length}</li>`;
  for (const line of [battles, feats]) {
    assert.ok(html.includes(line), line);
    assert.ok(html.indexOf(line) > html.indexOf('<h3>Your journey</h3>'));
    assert.ok(html.indexOf(line) < html.indexOf('<h3>Credits</h3>'));
    assertEggFree(line, 'ending journey line');
  }
  assert.equal(FEATS.length, 31);
});
