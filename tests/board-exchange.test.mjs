import test from 'node:test';
import assert from 'node:assert/strict';
import { BOUNTIES, EXCHANGE_OFFERS, boardMarks, boardMarksText, bountyState, claimBounty, acceptBounty, recordBountyKill, exchangeMarks, exchangeOfferText, markValue } from '../src/core/bounties.js';
import { bountiesScene } from '../src/scenes/bounties.js';
import { readFileSync } from 'node:fs';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { getItem } from '../src/items/items.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const fresh = () => { const s = createInitialState(); s.bestiary = {}; return s; };
const qty = (s, id) => (s.inventory.find((e) => e.id === id) || { qty: 0 }).qty;

test('mark values follow the posting order in three tiers of six', () => {
  assert.equal(BOUNTIES.length, 18);
  BOUNTIES.forEach((b, i) => assert.equal(markValue(b.id), i < 6 ? 1 : i < 12 ? 2 : 3));
  assert.equal(markValue('nope'), 0);
  assert.equal(markValue(undefined), 0);
});

test('marks are derived from claims; spent is sanitised and clamped', () => {
  const s = fresh();
  assert.deepEqual(boardMarks(s), { earned: 0, spent: 0, available: 0 });
  s.bounties = { active: null, progress: 0, completed: { ridge_rats: 2, pier_clearance: 1, colossus_thunder: 1, bogus: 9 }, spent: 3 };
  assert.deepEqual(boardMarks(s), { earned: 7, spent: 3, available: 4 });
  assert.equal(boardMarksText(s), 'Board Marks: 4 available (7 earned, 3 spent).');
  s.bounties.spent = 99;
  assert.deepEqual(boardMarks(s), { earned: 7, spent: 7, available: 0 });
  for (const bad of [-1, 1.5, '3', NaN, null]) { s.bounties.spent = bad; assert.equal(boardMarks(s).spent, 0); }
});

test('claiming a contract announces its marks and keeps spent marks', () => {
  const s = fresh(); s.bestiary = { storm_rat: 1 };
  s.bounties = { active: null, progress: 0, completed: { ridge_rats: 1 }, spent: 1 };
  acceptBounty(s, 'ridge_rats');
  for (let i = 0; i < 4; i += 1) recordBountyKill(s, 'storm_rat');
  const r = claimBounty(s);
  assert.equal(r.ok, true);
  assert.match(r.message, / \+1 Board Mark\./);
  assert.equal(bountyState(s).spent, 1);
  assert.deepEqual(boardMarks(s), { earned: 2, spent: 1, available: 1 });
});

test('the exchange offers fixed supplies of real items with rising costs', () => {
  assert.ok(Object.isFrozen(EXCHANGE_OFFERS));
  assert.deepEqual(EXCHANGE_OFFERS.map((o) => o.cost), [2, 3, 4, 5, 7]);
  for (const o of EXCHANGE_OFFERS) { assert.ok(getItem(o.itemId), o.itemId); assert.ok(Object.isFrozen(o)); }
  assert.equal(exchangeOfferText(EXCHANGE_OFFERS[0]), '2× Field Dressing for 2 marks');
  assert.equal(exchangeOfferText(EXCHANGE_OFFERS[4]), '1× Relay Brass for 7 marks');
});

test('exchanging spends marks atomically and refuses when short', () => {
  const s = fresh();
  s.bounties = { active: null, progress: 0, completed: { colossus_thunder: 3 }, spent: 0 };
  const before = qty(s, 'relay_brass');
  let r = exchangeMarks(s, 'brass');
  assert.equal(r.ok, true);
  assert.equal(r.message, 'Exchanged 7 Board Marks for 1× Relay Brass. 2 left.');
  assert.equal(qty(s, 'relay_brass'), before + 1);
  assert.equal(boardMarks(s).available, 2);
  const snapshot = JSON.stringify(s);
  r = exchangeMarks(s, 'brass');
  assert.equal(r.ok, false);
  assert.equal(r.message, 'You need 7 Board Marks for that; you have 2.');
  assert.equal(exchangeMarks(s, 'nope').ok, false);
  assert.equal(JSON.stringify(s), snapshot);
  assert.equal(exchangeMarks(s, 'dressings').ok, true);
  assert.equal(boardMarks(s).available, 0);
});

test('the board renders the exchange and its action is scene-guarded', () => {
  const s = fresh(); s.bestiary = { storm_rat: 1 }; s.scene = 'bounties'; s.combat = null;
  s.bounties = { active: null, progress: 0, completed: { ridge_rats: 3 }, spent: 0 };
  const game = { state: s, setScene() {} };
  bountiesScene.onEnter(game);
  let html = bountiesScene.render(game);
  assert.match(html, /<h2 class="exchange__title">Board Exchange<\/h2>/);
  assert.match(html, /<p class="exchange__marks">Board Marks: 3 available \(3 earned, 0 spent\)\.<\/p>/);
  assert.match(html, /<p class="bounty__marks">Earns 1 Board Mark per claim\.<\/p>/);
  assert.equal((html.match(/data-action="exchangeMarks"/g) || []).length, 5);
  assert.equal((html.match(/data-action="exchangeMarks" data-arg="[a-z]+" disabled/g) || []).length, 3);
  assertEggFree(html, 'board exchange');
  s.scene = 'town';
  bountiesScene.actions.exchangeMarks(game, { dataset: { arg: 'dressings' } });
  assert.equal(boardMarks(s).spent, 0);
  s.scene = 'bounties';
  bountiesScene.actions.exchangeMarks(game, { dataset: { arg: 'dressings' } });
  assert.equal(boardMarks(s).spent, 2);
  assert.match(game.bountyMessage, /^Exchanged 2 Board Marks for 2× Field Dressing\. 1 left\.$/);
});

const EXCHANGE_DOC = 'Every claim also earns Board Marks — 1 for the first six postings, 2 for the next six and 3 for the last six — which the Board Exchange beneath the contracts trades for supplies: two Field Dressings, a Highland Flask, a Spiced Broth, Storm Glass or Relay Brass.';
test('the guide and player guide document the Board Exchange once each', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(EXCHANGE_DOC).length, 2);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(EXCHANGE_DOC)));
  for (const o of EXCHANGE_OFFERS) assert.ok(EXCHANGE_DOC.includes(getItem(o.itemId).name));
  assertEggFree(EXCHANGE_DOC, 'exchange docs');
});
