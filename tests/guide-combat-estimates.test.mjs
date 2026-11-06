import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'Attack and damaging skills show an estimated damage range, items show what they would restore on their target right now (for example “On Wren now: +12 HP.”), and a line beneath the foe estimates its basic hit, or an unleashed heavy blow, against your current defenses.';

test('guide documents combat damage, item and incoming-hit estimates once', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  const html = guideScene.render({ state: {} });
  assert.equal(html.split(escapeHTML(SENTENCE)).length - 1, 1);
  assertEggFree(SENTENCE, 'combat estimates sentence');
});

test('the documented estimates exist in the combat UI', () => {
  const ui = readFileSync(new URL('../src/ui/combat.js', import.meta.url), 'utf8');
  assert.ok(ui.includes('now: ${parts.join'));
  assert.ok(ui.includes('Basic hit vs ${target}'));
  assert.ok(ui.includes('Unleashed ${windupName} vs ${target}'));
  assert.ok(ui.includes('Estimate using current defenses'));
  assert.ok(ui.includes('damage-preview-badge'));
  assert.ok(ui.includes('class="damage-range"'));
});
