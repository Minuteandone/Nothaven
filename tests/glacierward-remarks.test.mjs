import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRemark } from '../src/party/remarks.js';
import { GUIDE_SECTIONS } from '../src/scenes/guide.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const IDS = ['tamsin', 'iven', 'bram', 'sela'];
const story = { stage: 'complete', flags: { calibration_reward: true, spire_reward: true, rescue_reward: true } };

test('companions remark on a recorded Glacierward Colossus victory after calibration', () => {
  const seen = new Set();
  for (const id of IDS) {
    const before = companionRemark(id, story, { thunderhoof: 1 });
    const after = companionRemark(id, story, { thunderhoof: 1, glacierward_colossus: 1 });
    assert.notEqual(after, before, `${id} has a Glacierward line`);
    assert.match(after, /Colossus|Glacier/, `${id} names the foe`);
    assertEggFree(after);
    seen.add(after);
  }
  assert.equal(seen.size, IDS.length);
});

test('Glacierward remarks need calibration and a real victory; Stormborn still comes first', () => {
  for (const id of IDS) {
    const base = companionRemark(id, story, {});
    assert.equal(companionRemark(id, story, { glacierward_colossus: 0 }), base);
    assert.equal(companionRemark(id, story, { glacierward_colossus: 'x' }), base);
    const noCal = { stage: 'complete', flags: { spire_reward: true, rescue_reward: true } };
    assert.doesNotMatch(companionRemark(id, noCal, { glacierward_colossus: 1 }), /Colossus|Glacier/);
    const sb = companionRemark(id, story, { glacierward_colossus: 1 }, { stormbornBossVictories: 1 });
    assert.match(sb, /Stormborn|hardest/i);
  }
});

test('guide names the Thaw the Sentinel feat on the Glacierward line', () => {
  const text = JSON.stringify(GUIDE_SECTIONS);
  assert.match(text, /Glacierward Colossus[^"]*Thaw the Sentinel/);
});
