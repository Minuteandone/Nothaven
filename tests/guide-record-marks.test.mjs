import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const PHRASE = 'keeps a board record of your total claims, current rank, mastered contracts and lifetime Board Marks earned.';

test('guide names lifetime Board Marks in the board record', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(PHRASE).length - 1, 1);
  const html = guideScene.render({ state: {} });
  assert.ok(html.includes(escapeHTML(PHRASE)));
  assertEggFree(PHRASE, 'guide record marks phrase');
});
