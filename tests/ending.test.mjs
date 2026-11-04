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
  g.bus.emit('story:updated', {});
  assert.equal(g.state.scene, 'title');
  g.state.story.stage = 'complete';
  g.state.story.ending = 'share_signal';
  g.bus.emit('story:updated', {});
  assert.equal(g.state.scene, 'ending');
  assert.equal(g.state.flags.endingShown, true);
  g.state.scene = 'town';
  g.bus.emit('story:updated', {});
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

test('ending fires when story completes via direct dispatchStoryEvent (UI path)', async () => {
  const { dispatchStoryEvent } = await import('../src/story/integration.js');
  const handlers = new Map();
  const bus = {
    on(k, fn) { if (!handlers.has(k)) handlers.set(k, new Set()); handlers.get(k).add(fn); },
    off(k, fn) { handlers.get(k)?.delete(fn); },
    emit(k, e) { handlers.get(k)?.forEach(fn => fn(e)); },
  };
  const scenes = [];
  const game = { bus, state: { gold: 0, flags: {}, story: { stage: 'complete' } }, setScene: (n) => scenes.push(n) };
  const cleanup = installEnding(game);
  // Simulate the observer notification the adapter emits after any reduction.
  bus.emit('story:updated', { event: { type: 'noop' }, state: game.state.story });
  assert.deepEqual(scenes, ['ending']);
  bus.emit('story:updated', {});
  assert.deepEqual(scenes, ['ending'], 'only once');
  assert.equal(typeof dispatchStoryEvent, 'function');
  cleanup();
});

test('finale shows once after spire report with chapter epilogues', async () => {
  const { epilogueLines, isFinale } = await import('../src/scenes/ending.js');
  const g = fakeGame();
  installEnding(g);
  g.state.story.stage = 'complete';
  g.state.story.ending = 'share_signal';
  g.bus.emit('story:updated', {});
  assert.equal(g.state.scene, 'ending');
  g.state.scene = 'town';
  Object.assign(g.state.story.flags ||= {}, { rescue_reward: true, relay_choice: 'route_network' });
  g.bus.emit('story:updated', {});
  assert.equal(g.state.scene, 'town');
  assert.equal(isFinale(g.state), false);
  assert.equal(epilogueLines(g.state).length, 2);
  g.state.story.flags.spire_reward = true;
  g.bus.emit('story:updated', {});
  assert.equal(g.state.scene, 'ending');
  assert.equal(g.state.flags.finaleShown, true);
  const html = endingScene.render(g);
  assert.match(html, /Stormhaven Endures/);
  assert.match(html, /Lanterns on the Horizon/);
  assert.match(html, /guides patrols/);
  assert.match(html, /forecast dangerous weather together/);
  g.state.scene = 'town';
  g.bus.emit('story:updated', {});
  assert.equal(g.state.scene, 'town');
});
