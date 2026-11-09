import test from 'node:test';
import assert from 'node:assert/strict';
import { EXCHANGE_OFFERS, exchangeMarks, exchangeOwnedText } from '../src/core/bounties.js';
import { bountiesScene } from '../src/scenes/bounties.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const withClaims = (completed, spent = 0) => { const s = createInitialState(); s.bestiary = {}; s.bounties = { active: null, progress: 0, completed, spent }; return s; };
const offer = (id) => EXCHANGE_OFFERS.find((o) => o.id === id);

test('exchangeOwnedText counts the offered item in the pack', () => {
  const s = createInitialState();
  s.inventory = [{ id: 'field_dressing', qty: 3 }, { id: 'storm_glass', qty: 1 }];
  assert.equal(exchangeOwnedText(s, offer('dressings')), 'In pack: 3.');
  assert.equal(exchangeOwnedText(s, offer('glass')), 'In pack: 1.');
  assert.equal(exchangeOwnedText(s, offer('iron')), 'In pack: 0.');
  for (const o of EXCHANGE_OFFERS) assertEggFree(exchangeOwnedText(s, o), `owned ${o.id}`);
});

test('exchangeOwnedText tolerates malformed inventories', () => {
  assert.equal(exchangeOwnedText({}, offer('flask')), 'In pack: 0.');
  assert.equal(exchangeOwnedText(null, offer('flask')), 'In pack: 0.');
  assert.equal(exchangeOwnedText({ inventory: [null, { id: 'highland_flask', qty: 'x' }, { id: 'highland_flask', qty: -2 }] }, offer('flask')), 'In pack: 0.');
});

test('each exchange offer renders an In pack line that updates after an exchange', () => {
  const s = withClaims({ ridge_rats: 5 });
  s.inventory = [];
  let html = bountiesScene.render({ state: s });
  assert.equal((html.match(/<p class="exchange__owned">In pack: \d+\.<\/p>/g) || []).length, EXCHANGE_OFFERS.length);
  assert.ok(html.includes('<p class="exchange__owned">In pack: 0.</p>'));
  const r = exchangeMarks(s, 'dressings');
  assert.equal(r.ok ?? true, true);
  html = bountiesScene.render({ state: s });
  assert.ok(html.includes('<p class="exchange__owned">In pack: 2.</p>'));
});

test('guide documents the In pack line once', async () => {
  const { readFileSync } = await import('node:fs');
  const { guideScene } = await import('../src/scenes/guide.js');
  const { escapeHTML } = await import('../src/ui/components.js');
  const DOC = 'Each offer also shows how many of that item are already in your pack.';
  assert.equal(readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8').split(DOC).length - 1, 1);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(DOC)));
  assertEggFree(DOC, 'owned doc');
});
