import test from 'node:test';
import assert from 'node:assert/strict';
import { recordDefeat, bestiaryEntries, bestiaryScene, installBestiary } from '../src/scenes/bestiary.js';
import { ENEMIES } from '../src/data/enemies.js';
import { createInitialState } from '../src/state.js';
import { bus } from '../src/events.js';

function fakeGame() {
  const g = { state: createInitialState(), scenes: {}, bus, last: null,
    registerScene(n, s) { this.scenes[n] = s; },
    setScene(n, d) { this.last = { n, d }; } };
  return g;
}

test('recordDefeat counts known enemies and ignores unknown/prototype ids', () => {
  const s = createInitialState();
  assert.equal(recordDefeat(s, 'storm_rat'), true);
  recordDefeat(s, 'storm_rat');
  assert.equal(s.bestiary.storm_rat, 2);
  assert.equal(recordDefeat(s, 'constructor'), false);
  assert.equal(recordDefeat(s, 'nope'), false);
  assert.equal(Object.keys(s.bestiary).length, 1);
});

test('entries cover every enemy, unknown ones stay hidden in render', () => {
  const g = fakeGame();
  recordDefeat(g.state, 'gale_hound');
  assert.equal(bestiaryEntries(g.state).length, Object.keys(ENEMIES).length);
  const html = bestiaryScene.render(g);
  assert.match(html, /Gale Hound/);
  assert.match(html, /Defeated: 1/);
  assert.ok(!html.includes('Tide Wraith'), 'undefeated boss is not spoiled');
  assert.match(html, new RegExp(`Entries: 1/${Object.keys(ENEMIES).length}`));
});

test('installBestiary records combat:victory and leave returns', () => {
  const g = fakeGame();
  const off = installBestiary(g);
  assert.ok(g.scenes.bestiary);
  bus.emit('combat:victory', { enemyId: 'ridge_bandit', encounterId: 'ridge_patrol' });
  off();
  bus.emit('combat:victory', { enemyId: 'ridge_bandit' });
  assert.equal(g.state.bestiary.ridge_bandit, 1);
  bestiaryScene.onEnter(g, { returnScene: 'explore' });
  bestiaryScene.actions.leave(g);
  assert.equal(g.last.n, 'explore');
});

test('bestiary text for all enemies has no egg references', () => {
  const g = fakeGame();
  for (const id of Object.keys(ENEMIES)) recordDefeat(g.state, id);
  const text = bestiaryScene.render(g).replace(/<[^>]+>/g, ' ');
  assert.ok(!/\b(eggs?|yolks?|hatch\w*|nests?|omelet\w*|hens?|chicks?|shells?)\b/i.test(text));
});
