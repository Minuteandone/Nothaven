import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { townScene } from '../src/scenes/town.js';
import { exploreScene } from '../src/map/exploreScene.js';
import { featsScene, installFeats } from '../src/scenes/feats.js';

function game() {
  return { state: createInitialState(), scenes: { town: townScene, explore: exploreScene },
    registerScene(id, scene) { this.scenes[id] = scene; },
    setScene(id, data) { this.last = { id, data }; } };
}

test('explore screen offers Wardens’ Feats only once the feats scene is installed', () => {
  const g = game();
  assert.doesNotMatch(exploreScene.render(g), /data-action="openFeats"/);
  exploreScene.actions.openFeats(g);
  assert.equal(g.last, undefined);
  installFeats(g);
  assert.equal(g.scenes.feats, featsScene);
  const html = exploreScene.render(g);
  assert.match(html, /data-action="openFeats"/);
  assert.match(html, /Wardens’ Feats/);
  assert.match(html, /data-action="openJournal"/);
  exploreScene.actions.openFeats(g);
  assert.deepEqual(g.last, { id: 'feats', data: { returnScene: 'explore' } });
});

test('feats opened from explore return to the expedition', () => {
  const g = game();
  installFeats(g);
  featsScene.onEnter?.(g, { returnScene: 'explore' });
  assert.match(featsScene.render(g), /Back to expedition/);
  featsScene.actions.closeFeats(g);
  assert.equal(g.last.id, 'explore');
});
