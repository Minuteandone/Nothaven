import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { closestFeatText, featStatus, featsScene } from '../src/scenes/feats.js';
import { createInitialState } from '../src/state.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'Beneath the next unearned feat, a second line names the unearned feat whose target is closest to complete, by share of the target already reached (for example “Closest to earning: Full Muster (2 of 3).”).';

test('fresh save: the started feat with the highest share wins', () => {
  const s = createInitialState();
  assert.equal(closestFeatText(s), 'Closest to earning: Full Muster (1 of 3).');
  assertEggFree(closestFeatText(s), 'closest fresh');
});

test('higher share beats list order; ties keep list order', () => {
  const s = createInitialState();
  s.bestiary = { briar_boar: 1, lens_wisp: 1 };
  assert.equal(closestFeatText(s), 'Closest to earning: Roadwise (2 of 4).');
  s.bestiary = { briar_boar: 1, lens_wisp: 1, old_tusk: 1, gloomfin: 1 };
  assert.equal(closestFeatText(s), 'Closest to earning: Roadwise (2 of 4).');
  s.bestiary = { briar_boar: 1, old_tusk: 1, gloomfin: 1, frostmane: 1 };
  assert.match(closestFeatText(s), /^Closest to earning: (?!Roadwise)/);
});

test('earned, unstarted, complete-but-unearned and unknown rows are skipped', () => {
  const s = createInitialState();
  assert.equal(closestFeatText(s, []), null);
  assert.equal(closestFeatText(s, featStatus(s).map(r => ({ ...r, done: true }))), null);
  assert.equal(closestFeatText(s, [{ id: 'wanderers', title: 'Roadwise', done: false }]), null);
  assert.equal(closestFeatText(s, [{ id: 'first_light', title: 'x', done: false }, { id: 'toString', title: 'y', done: false }]), null);
  s.bestiary = { briar_boar: 1, lens_wisp: 1, wrack_eel: 1, rime_wight: 1 };
  assert.equal(closestFeatText(s, [{ id: 'wanderers', title: 'Roadwise', done: false }]), null);
  assert.equal(closestFeatText(null, [{ id: 'muster', title: 'Full Muster', done: false }]), null);
});

test('feats scene renders the line after the next-feat line', () => {
  const html = featsScene.render({ state: createInitialState(), featsReturn: 'town', scenes: {} });
  const m = html.match(/<p class="feats__closest">([^<]*)<\/p>/);
  assert.ok(m);
  assert.equal(m[1], 'Closest to earning: Full Muster (1 of 3).');
  assert.ok(html.indexOf('feats__next') < html.indexOf('feats__closest'));
  assert.ok(html.indexOf('feats__closest') < html.indexOf('feats__filters'));
});

test('guide documents the closest-feat line', () => {
  const md = readFileSync('docs/PLAYER_GUIDE.md', 'utf8');
  assert.equal(md.split(SENTENCE).length, 2);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(SENTENCE)));
  assertEggFree(SENTENCE, 'closest doc');
});
