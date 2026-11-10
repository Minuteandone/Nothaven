import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { featsScene } from '../src/scenes/feats.js';
import { guideScene } from '../src/scenes/guide.js';
import { bountyAnsweredText } from '../src/scenes/bounties.js';
import { BOUNTIES } from '../src/core/bounties.js';
import { escapeHTML } from '../src/ui/components.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'Beside them, a “Notices answered” row counts the different contracts you have claimed at least once, out of all eighteen.';
const row = (n) => `<div><dt>Notices answered</dt><dd>${n} of 18</dd></div>`;

test('service record shows 0 of 18 notices answered on a fresh save, after the mastery row', () => {
  const html = featsScene.render({ state: createInitialState() });
  assert.equal(html.split(row(0)).length - 1, 1);
  assert.ok(html.indexOf('<dt>Contracts mastered</dt>') < html.indexOf('<dt>Notices answered</dt>'));
  assertEggFree(html, 'feats page');
});

test('notices answered counts distinct own-key contracts with at least one claim', () => {
  const s = createInitialState();
  s.bounties = { active: null, progress: 0, completed: { ridge_rats: 3, pier_clearance: 1, wolf_trail: 0, bandit_toll: 'x', no_such: 5 } };
  assert.ok(featsScene.render({ state: s }).includes(row(2)));
});

test('notices answered row agrees with the board line across all contracts', () => {
  const s = createInitialState();
  s.bounties = { active: null, progress: 0, completed: {} };
  BOUNTIES.forEach((b, i) => {
    s.bounties.completed[b.id] = 1 + (i % 3);
    const html = featsScene.render({ state: s });
    assert.ok(html.includes(row(i + 1)), `${b.id}`);
    assert.ok(bountyAnsweredText(s).startsWith(`Notices answered: ${i + 1} of 18`));
  });
});

test('guide documents the service record row in both guides', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  const html = guideScene.render({ state: {} });
  assert.equal(html.split(escapeHTML(SENTENCE)).length - 1, 1);
  assertEggFree(SENTENCE, 'service answered sentence');
});
