import test from 'node:test';
import assert from 'node:assert/strict';
import { endingScene, installEnding, endingInfo, CREDITS } from '../src/scenes/ending.js';
import { createInitialState } from '../src/state.js';

function fakeGame() {
  const handlers = {};
  return {
    state: createInitialState(),
    scenes: { title: {}, town: {}, ending: endingScene },
    bus: {
      on: (e, f) => ((handlers[e] ||= []).push(f)),
      off: (e, f) => (handlers[e] = (handlers[e] || []).filter((x) => x !== f)),
      emit: (e, d) => (handlers[e] || []).forEach((f) => f(d)),
    },
    setScene(name) { this.state.scene = name; },
  };
}

test('ending scene shows once when story completes', () => {
  const g = fakeGame();
  installEnding(g);
  g.bus.emit('story:event', {});
  assert.equal(g.state.scene, 'title');
  g.state.story.stage = 'complete';
  g.state.story.ending = 'share_signal';
  g.bus.emit('story:event', {});
  assert.equal(g.state.scene, 'ending');
  assert.equal(g.state.flags.endingShown, true);
  g.state.scene = 'town';
  g.bus.emit('story:event', {});
  assert.equal(g.state.scene, 'town');
});

test('ending render includes ending title and all credits', () => {
  const g = fakeGame();
  g.state.story.ending = 'protect_town';
  const html = endingScene.render(g);
  assert.match(html, /The Shielded Town/);
  for (const [, who] of CREDITS) assert.ok(html.includes(who));
  assert.equal(endingInfo({}).title, 'The Beacon Burns');
});

test('keepExploring falls back to town when no explore scene', () => {
  const g = fakeGame();
  endingScene.actions.keepExploring(g);
  assert.equal(g.state.scene, 'town');
});
