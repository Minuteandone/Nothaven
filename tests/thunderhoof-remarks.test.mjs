import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRemark } from '../src/party/remarks.js';

const IDS = ['tamsin', 'iven', 'bram', 'sela'];
const done = { victory_storm_heart: true, heart_reward: true, watch_reward: true, victory_last_squall: true, calibration_accepted: true, calibration_reward: true };

test('each companion remarks on a Thunderhoof victory ahead of the calibration line', () => {
  const seen = new Set();
  for (const id of IDS) {
    const before = companionRemark(id, { stage: 'complete', flags: { ...done } }, {});
    const after = companionRemark(id, { stage: 'complete', flags: { ...done } }, { thunderhoof: 1 });
    assert.ok(after.length > 20, `${id} has a line`);
    assert.notEqual(after, before, `${id} line changes after the fight`);
    assert.match(after, /thunderhoof|antlers|stampede|hoofbeats/i, `${id} mentions the elk`);
    seen.add(after);
  }
  assert.equal(seen.size, IDS.length);
});

test('Thunderhoof remarks need the paid calibration and a recorded victory', () => {
  for (const id of IDS) {
    const unpaid = { ...done, calibration_reward: 'yes' };
    const base = companionRemark(id, { stage: 'complete', flags: unpaid }, {});
    assert.equal(companionRemark(id, { stage: 'complete', flags: unpaid }, { thunderhoof: 1 }), base);
    const paid = companionRemark(id, { stage: 'complete', flags: { ...done } }, {});
    assert.equal(companionRemark(id, { stage: 'complete', flags: { ...done } }, { thunderhoof: 0 }), paid);
  }
});
