import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATS, featsScene, nextFeatText } from '../src/scenes/feats.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('nextFeatText names the first unearned feat in list order', () => {
  const state = createInitialState();
  assert.equal(nextFeatText(state), `Next unearned feat: ${FEATS[0].title} — ${FEATS[0].detail}`);
  state.story = { ...(state.story || {}), stage: 'complete', flags: { ...(state.story?.flags || {}) } };
  assert.equal(nextFeatText(state), `Next unearned feat: ${FEATS[1].title} — ${FEATS[1].detail}`);
  assert.equal(nextFeatText(null), `Next unearned feat: ${FEATS[0].title} — ${FEATS[0].detail}`);
});

test('feats scene renders the next-feat line under the earned count', () => {
  const game = { state: createInitialState(), featsReturn: 'town', scenes: {} };
  const html = featsScene.render(game);
  const line = html.match(/<p class="feats__next">([^<]*)<\/p>/);
  assert.ok(line, 'next-feat line should render');
  assert.equal(line[1], 'Next unearned feat: First Light — Relight the Greyhaven beacon and choose how its light is used.');
  assert.ok(html.indexOf('feats__count') < html.indexOf('feats__next'));
  assertEggFree(line[1], 'next-feat line');
});
