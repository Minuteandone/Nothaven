import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { EXCHANGE_OFFERS, exchangeAffordText, exchangeMarks } from '../src/core/bounties.js';
import { bountiesScene } from '../src/scenes/bounties.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const withClaims = (completed, spent = 0) => { const s = createInitialState(); s.bestiary = {}; s.bounties = { active: null, progress: 0, completed, spent }; return s; };

test('exchangeAffordText counts affordable offers and names the cheapest out of reach', () => {
  assert.equal(EXCHANGE_OFFERS.length, 7);
  assert.equal(exchangeAffordText(withClaims({})), 'You can afford 0 of 7 offers. Cheapest out of reach: Field Dressing at 2 marks (2 more needed).');
  assert.equal(exchangeAffordText(withClaims({ ridge_rats: 1 })), 'You can afford 0 of 7 offers. Cheapest out of reach: Field Dressing at 2 marks (1 more needed).');
  assert.equal(exchangeAffordText(withClaims({ ridge_rats: 4 })), 'You can afford 3 of 7 offers. Cheapest out of reach: Storm Glass at 5 marks (1 more needed).');
  assert.equal(exchangeAffordText(withClaims({ ridge_rats: 9 }, 3)), 'You can afford 4 of 7 offers. Cheapest out of reach: Relay Brass at 7 marks (1 more needed).');
  assert.equal(exchangeAffordText(withClaims({ ridge_rats: 9 })), 'You can afford every offer (7 of 7).');
  for (const n of [0, 1, 3, 5, 8, 9]) assertEggFree(exchangeAffordText(withClaims({ ridge_rats: n })), `afford ${n}`);
});

test('exchangeAffordText applies the Warden discount', () => {
  const s = withClaims({ ridge_rats: 25 }, 18);
  assert.equal(exchangeAffordText(s), 'You can afford 6 of 7 offers. Cheapest out of reach: Thunder Iron at 8 marks (1 more needed).');
  s.bounties.spent = 24;
  assert.equal(exchangeAffordText(s), 'You can afford 1 of 7 offers. Cheapest out of reach: Highland Flask at 2 marks (1 more needed).');
});

test('exchangeAffordText tolerates malformed saves', () => {
  assert.match(exchangeAffordText({}), /^You can afford 0 of 7 offers\./);
  assert.match(exchangeAffordText(withClaims({}, 50)), /^You can afford 0 of 7 offers\. Cheapest out of reach: Field Dressing at 2 marks \(2 more needed\)\.$/);
});

test('the bounties scene renders the afford line after the perk and updates after an exchange', () => {
  const s = withClaims({ ridge_rats: 5 });
  let html = bountiesScene.render({ state: s });
  const perk = html.indexOf('class="exchange__perk"');
  const afford = html.indexOf('<p class="exchange__afford">You can afford 4 of 7 offers.');
  assert.ok(perk > -1 && afford > perk && afford < html.indexOf('class="exchange__offers"'));
  assert.equal(exchangeMarks(s, 'glass').ok, true);
  html = bountiesScene.render({ state: s });
  assert.ok(html.includes('<p class="exchange__afford">You can afford 0 of 7 offers. Cheapest out of reach: Field Dressing at 2 marks (2 more needed).</p>'));
});

test('the player guide describes the afford line', () => {
  const DOC = 'Above the offers, a line counts how many you can afford with your available marks and names the cheapest one still out of reach with the marks it needs.';
  assert.equal(readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8').split(DOC).length - 1, 1);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(DOC)));
  assertEggFree(DOC, 'afford doc');
});
