import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = ' When the foe’s next blow could knock out your leader at their current health, a “Knockout risk:” line appears beneath that estimate, naming the threat and what still helps: Defend or a ward to halve it, healing before it lands, or a stun or Stillpoint Strike to break a gathered heavy blow.';

test('player guide documents the knockout risk line exactly once', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
});

test('in-game guide renders the knockout risk sentence', () => {
  const html = guideScene.render({ state: {} });
  assert.ok(html.includes(escapeHTML(SENTENCE)));
});

test('knockout risk guide sentence is egg-free', () => {
  assertEggFree(SENTENCE, 'knockout guide sentence');
});

test('the documented label matches the combat UI label', () => {
  const src = readFileSync(new URL('../src/ui/combat.js', import.meta.url), 'utf8');
  assert.ok(src.includes('<span class="knockout-warning__label">Knockout risk:</span>'));
});
