import test from 'node:test';
import assert from 'node:assert/strict';
import { bagDetailsLines } from '../src/scenes/bag.js';
import { EXCHANGE_OFFERS } from '../src/core/bounties.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('every Board Exchange item names its exchange price in bag details', () => {
  assert.equal(EXCHANGE_OFFERS.length, 7);
  for (const o of EXCHANGE_OFFERS) {
    const line = `Board Exchange: ${o.qty}× for ${o.cost} Board Marks (1 less as Warden of the Board)`;
    const lines = bagDetailsLines(o.itemId);
    assert.equal(lines.filter((l) => l === line).length, 1, o.itemId);
    assertEggFree(line, `exchange source ${o.id}`);
  }
  assert.ok(bagDetailsLines('field_dressing').includes('Board Exchange: 2× for 2 Board Marks (1 less as Warden of the Board)'));
});

test('items the Exchange never offers get no exchange line', () => {
  for (const id of ['bandage', 'scrap_metal', 'stormcrown_shard', 'iron_sword']) {
    assert.ok(!bagDetailsLines(id).some((l) => l.startsWith('Board Exchange')), id);
  }
});

test('the exchange line follows the shop and trade lines', () => {
  assert.deepEqual(bagDetailsLines('thunder_iron'), [
    "Buy at: Stormcrown Trading Post · Storm's Eye Post — 44g each",
    'Board Exchange: 1× for 9 Board Marks (1 less as Warden of the Board)',
  ]);
});
