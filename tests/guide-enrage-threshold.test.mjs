import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guideScene } from '../src/scenes/guide.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'Foes with such a second phase also show a tick on their HP bar and, beneath it, a line such as “Enrage threshold: 120 HP or lower.” naming exactly when that phase begins.';

test('player guide and in-game guide both describe the enrage threshold line', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  const html = guideScene.render({ state: {} });
  assert.equal(html.split(SENTENCE).length - 1, 1);
  assertEggFree(SENTENCE, 'enrage threshold guide sentence');
});

test('the guide example matches the in-combat wording', () => {
  const ui = readFileSync(new URL('../src/ui/combat.js', import.meta.url), 'utf8');
  assert.ok(ui.includes('`Enrage threshold: ${Math.floor(enrageMax * threshold)} HP or lower.`'));
});
