import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat } from '../src/combat/rules.js';
import { difficultyNote } from '../src/ui/combat.js';

test('combat records the difficulty it was created with', () => {
  assert.equal(createCombat({ enemyId: 'storm_rat' }).difficulty, 'standard');
  assert.equal(createCombat({ enemyId: 'storm_rat', difficulty: 'veteran' }).difficulty, 'veteran');
  assert.equal(createCombat({ enemyId: 'storm_rat', difficulty: 'bogus' }).difficulty, 'standard');
});

test('HUD notes only non-standard difficulty', () => {
  assert.equal(difficultyNote(createCombat({ enemyId: 'storm_rat' })), '');
  assert.equal(difficultyNote(createCombat({ enemyId: 'storm_rat', difficulty: 'story' })), ' · Story mode');
  assert.equal(difficultyNote(createCombat({ enemyId: 'storm_rat', difficulty: 'veteran' })), ' · Veteran mode');
  assert.equal(difficultyNote({}), '');
  assert.equal(difficultyNote(null), '');
});
