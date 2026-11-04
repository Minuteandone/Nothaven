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

// --- Effective-cap regressions (GPT-6 review) ---
const keeperEquipped = () => ({ weapon: null, armor: 'keeper_coat', trinket: null });

test('heal caps at effective maxHp (base + equipment), not base maxHp', () => {
  const actor = mk({ hp: 12, equipment: keeperEquipped() }); // base maxHp 30, effective 40 (keeper_coat hp+10)
  const res = useConsumable(actor, inv(), 'healing_herb'); // heals 30
  assert.equal(res.ok, true);
  assert.equal(res.actor.hp, 40, 'filled to effective cap 30+10, not base 30');
});

test('healing never reduces HP of a hero above the effective cap', () => {
  const actor = mk({ hp: 45, equipment: keeperEquipped() }); // hp above effective maxHp 40 (e.g. gear swapped mid-scene)
  const res = useConsumable(actor, inv(), 'healing_herb');
  assert.equal(res.ok, true);
  assert.equal(res.actor.hp, 45, 'unchanged — a potion never drains HP');
});
