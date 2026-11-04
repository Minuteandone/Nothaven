import test from 'node:test';
import assert from 'node:assert/strict';
import { migrateSave, fillDefaults, SAVE_VERSION } from '../src/core/save.js';
import { createInitialState } from '../src/state.js';

test('fillDefaults adds missing nested keys but keeps existing values', () => {
  const out = fillDefaults({ a: 1, b: { c: 2 } }, { a: 9, b: { c: 9, d: 4 }, e: [1] });
  assert.deepEqual(out, { a: 1, b: { c: 2, d: 4 }, e: [1] });
});

test('migrateSave upgrades a v1 save missing story/location', () => {
  const v1 = { scene: 'town', gold: 55, party: [{ id: 'hero', name: 'Wren', hp: 12, maxHp: 30 }], inventory: [{ id: 'bandage', qty: 2 }] };
  const m = migrateSave(v1, createInitialState);
  assert.equal(m.saveVersion, SAVE_VERSION);
  assert.equal(m.gold, 55);
  assert.equal(m.location, 'greyhaven');
  assert.ok(m.story);
  assert.equal(m.party[0].hp, 12);
  assert.equal(m.party[0].level, 1);
  assert.equal(m.combat, null);
  assert.deepEqual(m.inventory, [{ id: 'bandage', qty: 2 }]);
});

test('migrateSave rejects junk and future versions', () => {
  assert.equal(migrateSave(null, createInitialState), null);
  assert.equal(migrateSave([1, 2], createInitialState), null);
  assert.equal(migrateSave({ saveVersion: SAVE_VERSION + 1 }, createInitialState), null);
});

test('initial state carries current save version', () => {
  assert.equal(createInitialState().saveVersion, SAVE_VERSION);
});
