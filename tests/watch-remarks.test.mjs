import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRemark } from '../src/party/remarks.js';

const EGG_RE = /\b(eggs?|yolks?|shells?|hatch\w*|nests?|chicks?|hens?|omelet\w*|scrambl\w*|clutch|poach\w*|fried|easter|oval|boil\w*|crack\w*|golden|birds?|feathers?|basket)\b/i;
const IDS = ['tamsin', 'iven', 'bram', 'sela'];

test('Long Watch remarks sit between the Last Squall and the Storm’s Heart', () => {
  for (const id of IDS) {
    const heart = companionRemark(id, { flags: { victory_storm_heart: true, heart_reward: true } });
    const watch = companionRemark(id, { flags: { victory_storm_heart: true, heart_reward: true, watch_reward: true } });
    const squall = companionRemark(id, { flags: { victory_storm_heart: true, heart_reward: true, watch_reward: true, victory_last_squall: true } });
    assert.notEqual(watch, heart, id);
    assert.notEqual(squall, watch, id);
    assert.match(watch, /Long Watch|forecast stand/, id);
    assert.ok(!EGG_RE.test(watch), id);
    assert.equal(companionRemark(id, { flags: { victory_storm_heart: true, watch_reward: 'yes' } }), heart, `${id} strict flag`);
  }
});
