import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXCHANGE_OFFERS, WARDEN_EXCHANGE_DISCOUNT, boardMarks, bountyRank, exchangeCost, exchangeMarks, exchangeOfferText, exchangePerkText } from '../src/core/bounties.js';
import { bountiesScene } from '../src/scenes/bounties.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const withClaims = (completed, spent = 0) => { const s = createInitialState(); s.bestiary = {}; s.bounties = { active: null, progress: 0, completed, spent }; return s; };
const qty = (s, id) => (s.inventory.find((e) => e.id === id) || { qty: 0 }).qty;
const PERK_DOC = 'Reaching the Warden of the Board rank takes one mark off the price of every offer.';

test('below Warden rank every offer costs its list price', () => {
  const s = withClaims({ ridge_rats: 24 });
  assert.equal(bountyRank(s).rank.id, 'tracker');
  for (const o of EXCHANGE_OFFERS) assert.equal(exchangeCost(s, o), o.cost);
  assert.equal(exchangePerkText(s), 'Reach Warden of the Board (1 more claim) and every offer costs 1 mark less.');
  assert.equal(exchangePerkText(withClaims({})), 'Reach Warden of the Board (25 more claims) and every offer costs 1 mark less.');
});

test('a Warden of the Board pays one mark less for every offer', () => {
  assert.equal(WARDEN_EXCHANGE_DISCOUNT, 1);
  const s = withClaims({ ridge_rats: 25 });
  assert.equal(bountyRank(s).rank.id, 'warden');
  assert.deepEqual(EXCHANGE_OFFERS.map((o) => exchangeCost(s, o)), [1, 2, 3, 4, 6, 7, 8]);
  assert.equal(exchangeOfferText(EXCHANGE_OFFERS[0], 1), '2× Field Dressing for 1 mark');
  assert.equal(exchangePerkText(s), 'Warden of the Board: every offer costs 1 mark less.');
  assert.equal(exchangeCost(s, { cost: 1 }), 1);
});

test('Warden exchanges spend the discounted price atomically', () => {
  const s = withClaims({ ridge_rats: 25 }, 16);
  assert.equal(boardMarks(s).available, 9);
  const before = qty(s, 'thunder_iron');
  const r = exchangeMarks(s, 'iron');
  assert.equal(r.ok, true);
  assert.equal(r.message, 'Exchanged 8 Board Marks for 1× Thunder Iron. 1 left.');
  assert.equal(qty(s, 'thunder_iron'), before + 1);
  assert.equal(s.bounties.spent, 24);
  const d = exchangeMarks(s, 'dressings');
  assert.equal(d.message, 'Exchanged 1 Board Mark for 2× Field Dressing. 0 left.');
  const snapshot = JSON.stringify(s);
  assert.equal(exchangeMarks(s, 'dressings').message, 'You need 1 Board Mark for that; you have 0.');
  assert.equal(JSON.stringify(s), snapshot);
});

test('the board shows discounted prices and the perk line', () => {
  const s = withClaims({ ridge_rats: 25 }, 22);
  s.scene = 'bounties'; s.combat = null;
  const game = { state: s, setScene() {} };
  bountiesScene.onEnter(game);
  const html = bountiesScene.render(game);
  assert.ok(html.includes('class="exchange__perk"'));
  assert.ok(html.includes(escapeHTML('Warden of the Board: every offer costs 1 mark less.')));
  assert.ok(html.includes('Exchange: 1× Highland Flask for 2 marks'));
  const buttons = html.match(/data-action="exchangeMarks"[^>]*>/g) || [];
  assert.equal(buttons.length, 7);
  assert.equal(buttons.filter((b) => b.includes('disabled')).length, 4);
});

test('guide documents the Warden discount', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(PERK_DOC).length, 2);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(PERK_DOC)));
  assertEggFree(PERK_DOC, 'warden discount docs');
  assertEggFree('Reach Warden of the Board (1 more claim) and every offer costs 1 mark less. Warden of the Board: every offer costs 1 mark less.', 'perk text');
});
