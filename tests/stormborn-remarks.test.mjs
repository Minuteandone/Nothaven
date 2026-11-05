import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRemark } from '../src/party/remarks.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const IDS = ['tamsin', 'iven', 'bram', 'sela'];
const done = { victory_storm_heart: true, watch_reward: true, victory_last_squall: true, calibration_reward: true };

test('each companion remarks on a Stormborn boss victory ahead of every other line', () => {
  const seen = new Set();
  for (const id of IDS) {
    const before = companionRemark(id, { stage: 'complete', flags: { ...done } }, { thunderhoof: 1 });
    const after = companionRemark(id, { stage: 'complete', flags: { ...done } }, { thunderhoof: 1 }, { stormbornBossVictories: 1 });
    assert.ok(after.length > 20, `${id} has a line`);
    assert.notEqual(after, before, `${id} line changes`);
    assert.match(after, /stormborn|hardest/i, `${id} mentions the difficulty`);
    assertEggFree(after);
    seen.add(after);
  }
  assert.equal(seen.size, IDS.length);
});

test('Stormborn remarks need at least one recorded Stormborn boss victory', () => {
  for (const id of IDS) {
    const base = companionRemark(id, { stage: 'complete', flags: { ...done } }, {});
    assert.equal(companionRemark(id, { stage: 'complete', flags: { ...done } }, {}, { stormbornBossVictories: 0 }), base);
    assert.equal(companionRemark(id, { stage: 'complete', flags: { ...done } }, {}, { stormbornBossVictories: 'x' }), base);
    assert.equal(companionRemark(id, { stage: 'complete', flags: { ...done } }, {}, null), base);
    for (const bad of [true, '1', 1.5, Infinity, -1, NaN, [1], { n: 1 }]) {
      assert.equal(companionRemark(id, { stage: 'complete', flags: { ...done } }, {}, { stormbornBossVictories: bad }), base, `${id} ignores ${String(bad)}`);
    }
    assert.equal(companionRemark(id, { stage: 'complete', flags: { ...done } }, {}), base);
  }
});

test('Stormborn remark works even early in the story and ignores unknown companions', () => {
  assert.match(companionRemark('iven', {}, {}, { stormbornBossVictories: 2 }), /Stormborn/);
  assert.equal(companionRemark('stranger', {}, {}, { stormbornBossVictories: 2 }), '');
});
