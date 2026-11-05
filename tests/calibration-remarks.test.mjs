import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRemark } from '../src/party/remarks.js';

const IDS = ['tamsin', 'iven', 'bram', 'sela'];
const done = { victory_storm_heart: true, heart_reward: true, watch_reward: true, victory_last_squall: true };

test('each companion remarks on a reported Signal Calibration ahead of older milestones', () => {
  const seen = new Set();
  for (const id of IDS) {
    const before = companionRemark(id, { stage: 'complete', flags: { ...done } });
    const after = companionRemark(id, { stage: 'complete', flags: { ...done, calibration_accepted: true, calibration_reward: true } });
    assert.ok(after.length > 20, `${id} has a line`);
    assert.notEqual(after, before, `${id} line changes after the report`);
    assert.match(after, /interval|timing|timed|flashes/i, `${id} mentions the signal timing`);
    seen.add(after);
  }
  assert.equal(seen.size, IDS.length);
});

test('calibration remarks need the paid report, strictly true', () => {
  for (const id of IDS) {
    const base = companionRemark(id, { stage: 'complete', flags: { ...done } });
    assert.equal(companionRemark(id, { stage: 'complete', flags: { ...done, calibration_accepted: true, calibration_relay: true } }), base);
    assert.equal(companionRemark(id, { stage: 'complete', flags: { ...done, calibration_reward: 'yes' } }), base);
  }
});
