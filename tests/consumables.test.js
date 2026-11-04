import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useConsumable } from '../src/items/consumables.js';

const mk = (over = {}) => ({ hp: 10, maxHp: 30, mp: 0, maxMp: 10, statuses: ['bleeding'], ...over });
const inv = () => [{ id: 'healing_herb', qty: 1 }, { id: 'bandage', qty: 1 }, { id: 'storm_tonic', qty: 2 }];

test('useConsumable heals up to max and consumes the item', () => {
  const actor = mk();
  const res = useConsumable(actor, inv(), 'healing_herb');
  assert.equal(res.ok, true);
  assert.equal(res.actor.hp, 40 > 30 ? 30 : 40, 'clamped to maxHp');
  assert.equal(res.effects.hp, 30);
  assert.equal(res.inv.find((s) => s.id === 'healing_herb'), undefined, 'consumed');
  assert.equal(actor.hp, 10, 'original untouched');
});

test('useConsumable restores mp and cures statuses', () => {
  const actor = mk({ mp: 2, statuses: ['shocked'] });
  const res = useConsumable(actor, inv(), 'storm_tonic');
  assert.equal(res.ok, true);
  assert.equal(res.actor.mp, 10, 'clamped to maxMp');
  assert.equal(res.effects.cure, 'shocked');
  assert.deepEqual(res.actor.statuses, [], 'status cured');
  const left = res.inv.find((s) => s.id === 'storm_tonic');
  assert.equal(left.qty, 1);
});

test('useConsumable refuses non-consumables and missing items', () => {
  assert.equal(useConsumable(mk(), inv(), 'iron_sword').ok, false, 'not consumable');
  assert.equal(useConsumable(mk(), [], 'healing_herb').ok, false, 'not held');
  assert.equal(useConsumable(mk(), inv(), 'nope').ok, false, 'unknown id');
});
