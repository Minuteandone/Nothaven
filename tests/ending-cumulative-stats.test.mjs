import test from 'node:test';
import assert from 'node:assert/strict';
import { endingScene, cumulativeStatsText, battlesText, journalText } from '../src/scenes/ending.js';
import { recordVictory, ledgerOf } from '../src/core/ledger.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function finished() {
  const s = createInitialState();
  s.story.stage = 'complete'; s.story.ending = 'share_signal';
  return s;
}
const render = (s) => endingScene.render({ state: s, endingReturn: null });

test('cumulativeStatsText returns null when no stats have been recorded', () => {
  assert.equal(cumulativeStatsText(createInitialState()), null);
  assert.equal(cumulativeStatsText({ ledger: {} }), null);
  assert.equal(cumulativeStatsText({ ledger: { totalRounds: 0, totalDealt: 0 } }), null);
  assert.equal(cumulativeStatsText(null), null);
});

test('cumulativeStatsText returns individual lines for each non-zero stat', () => {
  const state = { ledger: { totalRounds: 42, totalDealt: 0, totalTaken: 120, totalBursts: 0, totalItemsUsed: 7 } };
  const lines = cumulativeStatsText(state);
  assert.deepEqual(lines, [
    'Rounds fought: 42',
    'Damage taken: 120',
    'Items used in battle: 7',
  ]);
  assert.equal(lines.length, 3);
});

test('cumulativeStatsText handles all five stats when non-zero', () => {
  const state = { ledger: { totalRounds: 100, totalDealt: 2500, totalTaken: 1800, totalBursts: 5, totalItemsUsed: 12 } };
  const lines = cumulativeStatsText(state);
  assert.equal(lines.length, 5);
  assert.ok(lines.includes('Rounds fought: 100'));
  assert.ok(lines.includes('Damage dealt: 2500'));
  assert.ok(lines.includes('Damage taken: 1800'));
  assert.ok(lines.includes('Beacon Bursts fired: 5'));
  assert.ok(lines.includes('Items used in battle: 12'));
});

test('cumulativeStatsText returns null when all ledger values sanitize to zero', () => {
  // ledgerOf uses count() which rejects negatives, non-integers, NaN, Infinity
  const state = { ledger: { totalRounds: -5, totalDealt: 'x', totalTaken: 3.7, totalBursts: Infinity, totalItemsUsed: NaN } };
  const lines = cumulativeStatsText(state);
  assert.equal(lines, null, 'all values sanitize to zero, so no lines');
});

test('ending HTML includes cumulative stats lines when ledger has values', () => {
  const s = finished();
  s.ledger = { victories: 12, bossVictories: 3, totalRounds: 85, totalTaken: 420 };
  const html = render(s);
  // Should appear between Your journey and Credits
  const journeyIdx = html.indexOf('<h3>Your journey</h3>');
  const creditsIdx = html.indexOf('<h3>Credits</h3>');
  assert.ok(journeyIdx >= 0);
  assert.ok(creditsIdx > journeyIdx);
  const roundsLine = '<li class="ending-cumulative">Rounds fought: 85</li>';
  const takenLine = '<li class="ending-cumulative">Damage taken: 420</li>';
  assert.ok(html.includes(roundsLine), 'rounds line present');
  assert.ok(html.includes(takenLine), 'taken line present');
  assert.ok(html.indexOf(roundsLine) > journeyIdx);
  assert.ok(html.indexOf(roundsLine) < creditsIdx);
  assert.ok(html.indexOf(takenLine) > journeyIdx);
  assert.ok(html.indexOf(takenLine) < creditsIdx);
  // Damage dealt is zero, should not appear
  assert.ok(!html.includes('Damage dealt'), 'zero stat not rendered');
});

test('cumulative stats accumulate across multiple recordVictory calls', () => {
  const state = createInitialState();
  recordVictory(state, 'storm_rat', { rounds: 3, dealt: 45, taken: 18, bursts: 0, itemsUsed: 1 });
  recordVictory(state, 'tide_wraith', { rounds: 5, dealt: 120, taken: 40, bursts: 1, itemsUsed: 2 });
  recordVictory(state, 'storm_rat', { rounds: 2, dealt: 38, taken: 12, bursts: 0, itemsUsed: 0 });
  const l = ledgerOf(state);
  assert.equal(l.totalRounds, 10);
  assert.equal(l.totalDealt, 203);
  assert.equal(l.totalTaken, 70);
  assert.equal(l.totalBursts, 1);
  assert.equal(l.totalItemsUsed, 3);
});

test('recordVictory with missing or malformed stats does not crash', () => {
  const state = createInitialState();
  assert.doesNotThrow(() => recordVictory(state, 'storm_rat', null));
  assert.doesNotThrow(() => recordVictory(state, 'storm_rat', undefined));
  assert.doesNotThrow(() => recordVictory(state, 'storm_rat', 'nope'));
  assert.doesNotThrow(() => recordVictory(state, 'storm_rat', { rounds: 'x', dealt: -3, taken: NaN }));

  // All stats should still be zero
  const l = ledgerOf(state);
  assert.equal(l.totalRounds, 0);
  assert.equal(l.totalDealt, 0);
});

test('recordVictory only counts positive integer stat values', () => {
  const state = createInitialState();
  recordVictory(state, 'storm_rat', { rounds: 3.7, dealt: 0, taken: -10, bursts: Infinity, itemsUsed: 2 });
  const l = ledgerOf(state);
  assert.equal(l.totalRounds, 3);     // 3.7 → floor → 3
  assert.equal(l.totalDealt, 0);       // 0 is skipped
  assert.equal(l.totalTaken, 0);       // -10 is skipped
  assert.equal(l.totalBursts, 0);      // Infinity coerces to 0
  assert.equal(l.totalItemsUsed, 2);   // 2 is fine
});

test('cumulative stats lines in ending are egg-free', () => {
  const s = finished();
  s.ledger = { victories: 1, totalRounds: 100, totalDealt: 500, totalTaken: 300, totalBursts: 4, totalItemsUsed: 10 };
  const html = render(s);
  assertEggFree(html, 'ending with cumulative stats');
});

test('backward compatible: ledger without cumulative fields returns null from cumulativeStatsText', () => {
  const s = finished();
  s.ledger = { victories: 57, bossVictories: 11 };
  assert.equal(cumulativeStatsText(s), null);
  // But battles text still works
  assert.ok(battlesText(s).includes('57'));
});

test('SERVICE_ROWS includes the five cumulative stat labels', async () => {
  const { SERVICE_ROWS } = await import('../src/core/ledger.js');
  const keys = SERVICE_ROWS.map(r => r.key);
  assert.ok(keys.includes('totalRounds'));
  assert.ok(keys.includes('totalDealt'));
  assert.ok(keys.includes('totalTaken'));
  assert.ok(keys.includes('totalBursts'));
  assert.ok(keys.includes('totalItemsUsed'));
  // Labels are egg-free
  for (const row of SERVICE_ROWS) assertEggFree(row.label, `service row ${row.key}`);
});
