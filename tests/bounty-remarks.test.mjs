import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRemark } from '../src/party/remarks.js';
import { BOUNTIES } from '../src/core/bounties.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const IDS = ['tamsin', 'iven', 'bram', 'sela'];
const all = () => ({ active: null, progress: 0, completed: Object.fromEntries(BOUNTIES.map(b => [b.id, 1])) });
const story = { stage: 'complete', ending: 'protect_town', flags: { victory_storm_heart: true } };

test('companions remark on a fully answered bounty board', () => {
  for (const id of IDS) {
    const base = companionRemark(id, story, {}, {});
    const line = companionRemark(id, story, {}, {}, all());
    assert.notEqual(line, base, id);
    assert.match(line, /bounty|contract|notice/i, id);
    assertEggFree(line, `${id} bounty remark`);
    // Stormborn and other late lines still yield to it only when every contract is claimed.
    assert.equal(companionRemark(id, story, {}, { stormbornBossVictories: 1 }, all()), line, id);
  }
});

test('partial, junk or missing bounty records keep the earlier remark', () => {
  for (const id of IDS) {
    const base = companionRemark(id, story, {}, {});
    const partial = all(); delete partial.completed[BOUNTIES.at(-1).id];
    const junk = all(); junk.completed[BOUNTIES[0].id] = 'x';
    for (const b of [undefined, null, [], 'all', partial, junk, { completed: [] }]) {
      assert.equal(companionRemark(id, story, {}, {}, b), base, `${id} ${JSON.stringify(b)}`);
    }
  }
});

test('reading a bounty remark never changes the record', () => {
  const b = all();
  const before = JSON.stringify(b);
  for (const id of IDS) companionRemark(id, story, {}, {}, b);
  assert.equal(JSON.stringify(b), before);
});

test('companions salute the Warden of the Board rank above every other remark', () => {
  const warden = { active: null, progress: 0, completed: { ridge_rats: 20, bandit_toll: 5 } };
  const almost = { active: null, progress: 0, completed: { ridge_rats: 20, bandit_toll: 4 } };
  const lines = new Set();
  for (const id of IDS) {
    const line = companionRemark(id, story, {}, { stormbornBossVictories: 1 }, warden);
    assert.match(line, /Warden of the Board|twenty-five|forty percent/i, id);
    assertEggFree(line, `${id} warden remark`);
    assert.notEqual(companionRemark(id, story, {}, {}, almost), line, id);
    assert.equal(companionRemark('mara', story, {}, {}, warden), companionRemark('mara', story, {}, {}), 'mara');
    lines.add(line);
  }
  assert.equal(lines.size, IDS.length);
});
