import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { endingScene } from '../src/scenes/ending.js';
import { closestFeatText } from '../src/scenes/feats.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'Beneath the feats tally, a “Closest to earning:” line names the unearned feat you are nearest to completing, matching the hint on the feats screen.';
const base = { party: [{ name: 'Wren', level: 5 }], gold: 0, inventory: [], story: { flags: {} } };

test('ending shows the closest feat once, right after the feats tally', () => {
  const text = closestFeatText(base);
  assert.ok(text && text.startsWith('Closest to earning: '));
  const html = endingScene.render({ state: base });
  const li = `<li class="ending-feats-next">${escapeHTML(text)}</li>`;
  assert.equal(html.split(li).length - 1, 1);
  const feats = html.indexOf('<li class="ending-feats">');
  const next = html.indexOf(li);
  assert.ok(feats >= 0 && feats < next);
  assert.doesNotMatch(html.slice(feats, next), /<li class="ending-(drills|bounty-record)"/);
});

test('ending follows the same tie-breaks as the feats screen when progress changes', () => {
  const state = { ...base, party: [{ name: 'Wren', level: 9 }] };
  const html = endingScene.render({ state });
  assert.ok(html.includes(`<li class="ending-feats-next">${escapeHTML(closestFeatText(state))}</li>`));
});

test('ending omits the line when no countable feat has started', () => {
  const state = { party: [], gold: 0, inventory: [], story: { flags: {} } };
  assert.equal(closestFeatText(state), null);
  const html = endingScene.render({ state });
  assert.match(html, /<li class="ending-feats">/);
  assert.doesNotMatch(html, /ending-feats-next/);
});

test('both guides describe the line once and it renders escaped', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  assert.ok(md.includes(`your bounty board record. ${SENTENCE}`));
  const html = guideScene.render({ state: {} });
  assert.equal(html.split(escapeHTML(SENTENCE)).length - 1, 1);
  assertEggFree(SENTENCE);
});
