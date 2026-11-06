import test from 'node:test';
import assert from 'node:assert/strict';
import { drillsScene, DRILL_FOES, GAUNTLET_MIN } from '../src/scenes/drills.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const render = (bestiary) => drillsScene.render({ state: { bestiary } });

test('locked Yard Gauntlet note counts drills unlocked so far', () => {
  assert.equal(GAUNTLET_MIN, 3);
  const none = render({}).match(/<p class="drills__gauntlet-progress">([^<]*)<\/p>/);
  assert.ok(none, 'progress note renders when locked');
  assert.equal(none[1], 'Unlock 3 drills to open the gauntlet (0 of 3 unlocked so far).');
  const two = render({ [DRILL_FOES[0]]: 1, [DRILL_FOES[1]]: 4 }).match(/<p class="drills__gauntlet-progress">([^<]*)<\/p>/);
  assert.equal(two[1], 'Unlock 3 drills to open the gauntlet (2 of 3 unlocked so far).');
  assertEggFree(two[1], 'gauntlet progress note');
});

test('progress note disappears once the gauntlet opens', () => {
  const html = render({ [DRILL_FOES[0]]: 1, [DRILL_FOES[1]]: 1, [DRILL_FOES[2]]: 1 });
  assert.ok(!html.includes('drills__gauntlet-progress'));
  assert.ok(html.includes('data-action="startGauntlet"'));
});
