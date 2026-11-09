import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { bountyRecordText, boardMarks } from '../src/core/bounties.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('board record counts Board Marks earned, unaffected by marks spent at the Exchange', () => {
  const s = createInitialState();
  assert.equal(bountyRecordText(s), null);
  s.bounties = { active: null, progress: 0, completed: { ridge_rats: 1 }, spent: 0 };
  assert.match(bountyRecordText(s), / · 1 Board Mark earned\.$/);
  s.bounties.completed = { ridge_rats: 1, colossus_thunder: 2 };
  s.bounties.spent = 5;
  assert.deepEqual(boardMarks(s), { earned: 7, spent: 5, available: 2 });
  const line = bountyRecordText(s);
  assert.equal(line, 'Board record: 3 claims · Notice Runner · 0 of 18 contracts mastered · 7 Board Marks earned.');
  assertEggFree(line, 'board record marks');
});
