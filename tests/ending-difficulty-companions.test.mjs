import test from 'node:test';
import assert from 'node:assert/strict';
import { difficultyText, companionsText, endingScene } from '../src/scenes/ending.js';

test('difficultyText names the preset and falls back to Standard', () => {
  assert.equal(difficultyText({}), 'Current difficulty: Standard');
  assert.equal(difficultyText({ settings: { difficulty: 'stormborn' } }), 'Current difficulty: Stormborn');
  assert.equal(difficultyText({ settings: { difficulty: 'story' } }), 'Current difficulty: Story');
  assert.equal(difficultyText({ settings: { difficulty: '__proto__' } }), 'Current difficulty: Standard');
  assert.equal(difficultyText(null), 'Current difficulty: Standard');
});

test('companionsText lists unlocked companions in roster order, or null', () => {
  assert.equal(companionsText({}), null);
  assert.equal(companionsText({ story: { flags: {} } }), null);
  assert.equal(companionsText({ story: { flags: { rescue_victory_heights: true, victory_ridge_patrol: true } } }),
    'Companions recruited: Tamsin, Sela');
  assert.equal(companionsText({ story: { flags: {
    victory_ridge_patrol: true, victory_observatory_sentinel: true, rescue_victory_coast: true, rescue_victory_heights: true } } }),
    'Companions recruited: Tamsin, Iven, Bram, Sela');
});

test('ending renders difficulty always and companions only once any joined', () => {
  const base = { party: [{ name: 'Wren', level: 5 }], gold: 0, inventory: [], story: { flags: {} }, settings: { difficulty: 'veteran' } };
  const html = endingScene.render({ state: base });
  assert.match(html, /<li class="ending-difficulty">Current difficulty: Veteran<\/li>/);
  assert.doesNotMatch(html, /ending-companions/);
  const joined = endingScene.render({ state: { ...base, story: { flags: { victory_observatory_sentinel: true } } } });
  assert.match(joined, /<li class="ending-companions">Companions recruited: Iven<\/li>/);
  assert.ok(joined.indexOf('ending-difficulty') < joined.indexOf('ending-companions'));
  assert.ok(joined.indexOf('ending-companions') < joined.indexOf('ending-battles'));
});
