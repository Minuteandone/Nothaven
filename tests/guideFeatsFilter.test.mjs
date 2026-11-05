import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('in-game guide and player guide both describe the feats filter', () => {
  const guide = readFileSync(new URL('../src/scenes/guide.js', import.meta.url), 'utf8');
  const doc = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.match(guide, /the All, Earned and Not yet buttons narrow the list/);
  assert.match(doc, /\*\*All\*\*, \*\*Earned\*\* and \*\*Not yet\*\*/);
});
