import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { skillRestorationPreview } from '../src/combat/restorationPreview.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'Healing, cleansing and revival skills likewise show their immediate effect on each target (for example “If used now: Wren +10 HP.”), capped at maximum HP and naming any conditions they would clear, before your companions act or the foe replies — not a prediction of end-of-turn health.';

const wren = (hp) => ({ id: 'wren', name: 'Wren', hp, maxHp: 30, mp: 10, atk: 6, def: 3, spd: 5, level: 1, statuses: [] });

test('player guide documents support-skill previews once', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
});

test('in-game guide renders the support-skill preview sentence', () => {
  const html = guideScene.render({ state: {} });
  assert.ok(html.includes(escapeHTML(SENTENCE)));
});

test('documented example matches skillRestorationPreview', () => {
  assert.equal(skillRestorationPreview('mend', [wren(20)]), 'If used now: Wren +10 HP.');
  assert.equal(skillRestorationPreview('mend', [wren(26)]), 'If used now: Wren +4 HP.');
});

test('support-preview sentence is egg-free', () => {
  assertEggFree(SENTENCE, 'guide support previews sentence');
});
