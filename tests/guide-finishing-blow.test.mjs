import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = ' Once a foe is down to half health or less, a “Finishing blow:” line names the attacks and skills you can use now whose estimate reaches its remaining health: “will defeat” when even the lowest roll is enough, or “could defeat … on a high roll” when only the top of the range is.';

test('player guide documents the finishing blow line exactly once', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
});

test('in-game guide renders the finishing blow sentence', () => {
  const html = guideScene.render({ state: {} });
  assert.ok(html.includes(escapeHTML(SENTENCE)));
});

test('finishing blow guide sentence is egg-free', () => {
  assertEggFree(SENTENCE, 'finishing blow guide sentence');
});

test('the finishing blow sentence directly follows the knockout sentence', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.ok(md.includes('a gathered heavy blow.' + SENTENCE));
});

test('the documented label matches the combat UI label', () => {
  const src = readFileSync(new URL('../src/ui/combat.js', import.meta.url), 'utf8');
  assert.ok(src.includes('<span class="finishing-blow-hint__label">Finishing blow:</span>'));
});
