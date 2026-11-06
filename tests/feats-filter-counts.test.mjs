import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATS, featsScene } from '../src/scenes/feats.js';
import { createInitialState } from '../src/state.js';

function labels(html) {
  return [...html.matchAll(/data-action="filterFeats" data-arg="(\w+)" aria-pressed="(?:true|false)">([^<]*)<\/button>/g)]
    .map(m => [m[1], m[2]]);
}

test('feat filter buttons show how many feats each would list', () => {
  const game = { state: createInitialState(), featsReturn: 'town', scenes: {} };
  assert.deepEqual(labels(featsScene.render(game)), [
    ['all', `All (${FEATS.length})`], ['earned', 'Earned (0)'], ['pending', `Not yet (${FEATS.length})`],
  ]);
  game.state.story = { ...(game.state.story || {}), stage: 'complete', flags: { ...(game.state.story?.flags || {}) } };
  const html = featsScene.render(game);
  const earned = Number(html.match(/<p class="feats__count">(\d+) of/)[1]);
  assert.ok(earned >= 1);
  assert.deepEqual(labels(html), [
    ['all', `All (${FEATS.length})`], ['earned', `Earned (${earned})`], ['pending', `Not yet (${FEATS.length - earned})`],
  ]);
});

test('counts stay the same whichever filter is selected', () => {
  const game = { state: createInitialState(), featsReturn: 'town', scenes: {}, featsFilter: 'earned' };
  featsScene.actions.filterFeats(game, { dataset: { arg: 'earned' } });
  assert.deepEqual(labels(featsScene.render(game)).map(l => l[1]), [`All (${FEATS.length})`, 'Earned (0)', `Not yet (${FEATS.length})`]);
});
