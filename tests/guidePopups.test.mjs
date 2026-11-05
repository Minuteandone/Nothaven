import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as guide from '../src/scenes/guide.js';

test('field guide and player guide explain the Break! and Braced! popups', () => {
  const src = readFileSync(new URL('../src/scenes/guide.js', import.meta.url), 'utf8');
  const doc = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  for (const text of [src, doc]) {
    assert.match(text, /Break!/);
    assert.match(text, /Braced!/);
  }
  assert.match(doc, /Thunderhoof and the Glacierward Colossus; and twice/);
  const battle = guide.GUIDE_SECTIONS.find(sec => sec.title === 'Battle').lines.join(' ');
  assert.match(battle, /Break! flash over the foe/);
  assert.match(battle, /Braced! appears over a hero/);
});
