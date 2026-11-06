import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'A fight that is not yet open, because it awaits a story step or landmark inspections, appears on the map as a “Sealed challenge” and keeps its foe’s name hidden until it unlocks.';

test('both guides explain Sealed challenge map labels exactly once', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  const html = guideScene.render({ state: {} });
  assert.equal(md.split(SENTENCE).length - 1, 1);
  assert.equal(html.split(escapeHTML(SENTENCE)).length - 1, 1);
  assertEggFree(SENTENCE, 'sealed challenge guide sentence');
});

test('the documented label is the one the map code uses', () => {
  const src = readFileSync(new URL('../src/map/mapState.js', import.meta.url), 'utf8');
  assert.ok(src.includes("'Sealed challenge'"));
  assert.ok(src.includes('requiresStoryFlag') && src.includes('requiresInteractions'));
});
