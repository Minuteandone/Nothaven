import test from 'node:test';
import assert from 'node:assert/strict';
import { endingScene, journalText } from '../src/scenes/ending.js';
import { ENEMIES } from '../src/data/enemies.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const TOTAL = Object.keys(ENEMIES).length;

test('journalText counts distinct recorded foes and ignores bad or unknown entries', () => {
  assert.equal(journalText(createInitialState()), `Field Journal: 0 of ${TOTAL} foes recorded`);
  assert.equal(journalText({ bestiary: { storm_rat: 5, gale_hound: 1 } }), `Field Journal: 2 of ${TOTAL} foes recorded`);
  assert.equal(journalText({ bestiary: { storm_rat: 0, gale_hound: -2, ridge_bandit: 1.5, lens_wisp: 'x', not_a_foe: 9, __proto__: { storm_rat: 1 } } }), `Field Journal: 0 of ${TOTAL} foes recorded`);
  assert.equal(journalText({ bestiary: [1, 2] }), `Field Journal: 0 of ${TOTAL} foes recorded`);
  assert.equal(journalText(null), `Field Journal: 0 of ${TOTAL} foes recorded`);
  const all = Object.fromEntries(Object.keys(ENEMIES).map((id) => [id, 1]));
  assert.equal(journalText({ bestiary: all }), `Field Journal: ${TOTAL} of ${TOTAL} foes recorded`);
});

test('ending lists the Field Journal tally under Your journey, between battles and feats', () => {
  const s = createInitialState();
  s.story.stage = 'complete'; s.story.ending = 'share_signal';
  s.bestiary = { storm_rat: 3, rust_sentinel: 1, tempest_shade: 2 };
  const html = endingScene.render({ state: s, endingReturn: null });
  const line = `<li class="ending-journal">Field Journal: 3 of ${TOTAL} foes recorded</li>`;
  assert.ok(html.includes(line), line);
  assert.ok(html.indexOf(line) > html.indexOf('<li class="ending-battles">'));
  assert.ok(html.indexOf(line) < html.indexOf('<li class="ending-feats">'));
  assert.ok(html.indexOf(line) < html.indexOf('<h3>Credits</h3>'));
  assertEggFree(line, 'ending journal line');
});
