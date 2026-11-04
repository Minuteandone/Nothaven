import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRemark } from '../src/party/remarks.js';

const IDS = ['tamsin', 'iven', 'bram', 'sela'];

test('companions speak of the calmed storm after the Storm’s Heart falls', () => {
  for (const id of IDS) {
    const spire = companionRemark(id, { flags: { spire_reward: true, spire_summit: true } });
    const heart = companionRemark(id, { flags: { spire_reward: true, spire_summit: true, victory_storm_heart: true } });
    assert.ok(heart.length > 0);
    assert.notEqual(heart, spire, id);
  }
});

test('heart remarks require the exact boolean victory flag', () => {
  const spire = companionRemark('iven', { flags: { spire_summit: true } });
  assert.equal(companionRemark('iven', { flags: { spire_summit: true, victory_storm_heart: 'yes' } }), spire);
});
