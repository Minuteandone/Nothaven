import test from 'node:test';
import assert from 'node:assert/strict';
import { endingScene, epilogueLines, installEnding } from '../src/scenes/ending.js';
import { townScene } from '../src/scenes/town.js';
import { createInitialState } from '../src/state.js';

function fakeGame() {
  const handlers = {};
  const g = {
    state: createInitialState(),
    scenes: { title: {}, town: townScene, explore: {}, ending: endingScene },
    bus: {
      on: (e, f) => ((handlers[e] ||= []).push(f)),
      off: (e, f) => (handlers[e] = (handlers[e] || []).filter((x) => x !== f)),
      emit: (e, d) => (handlers[e] || []).forEach((f) => f(d)),
    },
    setScene(name, data) { this.state.scene = name; this.scenes[name]?.onEnter?.(this, data); },
  };
  return g;
}

test('heart epilogue appears only after the exact heart_reward flag', () => {
  const base = { story: { flags: { spire_reward: true } } };
  assert.equal(epilogueLines(base).length, 1);
  assert.equal(epilogueLines({ story: { flags: { spire_reward: true, heart_reward: 'yes' } } }).length, 1);
  const lines = epilogueLines({ story: { flags: { spire_reward: true, heart_reward: true } } });
  assert.equal(lines.length, 2);
  assert.match(lines[1], /Storm’s Heart lies still/);
});

test('chronicle button appears in town only after an ending was shown', () => {
  const g = fakeGame();
  assert.ok(!townScene.render(g).includes('data-action="chronicle"'));
  g.state.flags = { ...(g.state.flags || {}), endingShown: true };
  assert.ok(townScene.render(g).includes('data-action="chronicle"'));
});

test('rereading the chronicle returns to town and never replays the finale', () => {
  const g = fakeGame();
  installEnding(g);
  g.state.story.stage = 'complete';
  g.state.story.ending = 'share_signal';
  g.state.flags = { ...(g.state.flags || {}), endingShown: true };
  g.state.story.flags = { ...(g.state.story.flags || {}), spire_reward: true, heart_reward: true };
  g.bus.emit('story:updated', {});
  assert.equal(g.state.scene, 'ending');
  assert.match(endingScene.render(g), /Keep exploring/);
  endingScene.actions.keepExploring(g);
  assert.equal(g.state.scene, 'explore');
  g.bus.emit('story:updated', {});
  assert.equal(g.state.scene, 'explore');
  g.state.scene = 'town';
  townScene.actions.chronicle(g);
  assert.equal(g.state.scene, 'ending');
  const html = endingScene.render(g);
  assert.match(html, /Back to Greyhaven/);
  assert.match(html, /Storm’s Heart lies still/);
  endingScene.actions.keepExploring(g);
  assert.equal(g.state.scene, 'town');
  assert.equal(g.endingReturn, null);
});
