import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRemark } from '../src/party/remarks.js';

const IDS = ['tamsin', 'iven', 'bram', 'sela'];
const HEART = { spire_reward: true, spire_summit: true, victory_storm_heart: true, heart_reward: true };

test('companions remark on the Last Squall after it falls', () => {
  const seen = new Set();
  for (const id of IDS) {
    const heart = companionRemark(id, { flags: HEART });
    const squall = companionRemark(id, { flags: { ...HEART, victory_last_squall: true } });
    assert.ok(squall.includes('Last Squall'), id);
    assert.notEqual(squall, heart, id);
    seen.add(squall);
  }
  assert.equal(seen.size, IDS.length);
});

test('squall remarks require the exact boolean victory flag', () => {
  const heart = companionRemark('bram', { flags: HEART });
  assert.equal(companionRemark('bram', { flags: { ...HEART, victory_last_squall: 'yes' } }), heart);
  assert.equal(companionRemark('bram', { flags: { ...HEART, victory_last_squall: 1 } }), heart);
});
