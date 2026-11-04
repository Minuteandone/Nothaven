// Tests for src/items/ — run with: npm test (or: node --test tests/)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ITEMS, getItem, GOLD_ID, TYPES, SLOTS } from '../src/items/items.js';
import {
  createInventory, addItem, removeItem, countItem, hasItems,
  grantRewards, takeRewards, serializeInventory, deserializeInventory,
} from '../src/items/inventory.js';
import {
  createEquipment, equipItem, unequipItem, totalStats, effectiveStats, canActorEquip,
} from '../src/items/equipment.js';
import { rollLoot, rollLootForEnemies } from '../src/items/loot.js';

const makeActor = () => ({
  id: 'hero', name: 'Wren', hp: 30, maxHp: 30, mp: 10, maxMp: 10, atk: 6, def: 3, spd: 5,
  level: 1, xp: 0, equipment: createEquipment(),
});

test('addItem merges stacks and returns new objects', () => {
  const inv = createInventory();
  const a = addItem(inv, 'healing_herb', 2);
  assert.equal(a.ok, true);
  const b = addItem(a.inv, 'healing_herb', 3);
  assert.equal(b.ok, true);
  assert.equal(b.inv.length, 1);
  assert.equal(countItem(b.inv, 'healing_herb'), 5);
  // original untouched
  assert.equal(countItem(inv, 'healing_herb'), 0);
});

test('removeItem is atomic and prunes empty stacks', () => {
  let inv = addItem(createInventory(), 'iron_sword', 2).inv;
  const fail = removeItem(inv, 'iron_sword', 3);
  assert.equal(fail.ok, false);
  assert.equal(countItem(fail.inv, 'iron_sword'), 2, 'nothing removed on failure');
  const okRes = removeItem(inv, 'iron_sword', 2);
  assert.equal(okRes.ok, true);
  assert.equal(okRes.inv.length, 0, 'empty stack pruned');
});

test('gold is not inventoried', () => {
  const res = addItem(createInventory(), GOLD_ID, 5);
  assert.equal(res.ok, false);
  assert.equal(countItem(createInventory(), GOLD_ID), 0);
});

test('hasItems and takeRewards work atomically', () => {
  let inv = grantRewards(createInventory(), { scrap_metal: 3, storm_glass: 1 }).inv;
  assert.equal(hasItems(inv, { scrap_metal: 3, storm_glass: 1 }), true);
  assert.equal(hasItems(inv, { scrap_metal: 4 }), false);
  const fail = takeRewards(inv, { scrap_metal: 4 });
  assert.equal(fail.ok, false);
  assert.equal(countItem(fail.inv, 'scrap_metal'), 3, 'atomic: nothing taken on failure');
  const okRes = takeRewards(inv, { scrap_metal: 3, storm_glass: 1 });
  assert.equal(okRes.ok, true);
  assert.equal(okRes.inv.length, 0);
});

test('grantRewards accepts maps and stack arrays, fails cleanly on unknown ids', () => {
  const a = grantRewards(createInventory(), { bandage: 2, rations: 1 });
  assert.equal(a.ok, true);
  assert.equal(a.messages.length, 2);
  assert.equal(countItem(a.inv, 'bandage'), 2);
  const arr = grantRewards(createInventory(), [{ id: 'rations', qty: 2 }]);
  assert.equal(arr.ok, true);
  assert.equal(countItem(arr.inv, 'rations'), 2);
  const bad = grantRewards(createInventory(), { nonexistent_thing: 1 });
  assert.equal(bad.ok, false);
  assert.equal(bad.inv.length, 0, 'atomic: nothing granted on unknown id');
});

test('serialize / deserialize round-trip and validation', () => {
  const inv = grantRewards(createInventory(), { healing_herb: 3, warden_blade: 1 }).inv;
  const str = serializeInventory(inv);
  const back = deserializeInventory(str);
  assert.equal(back.ok, true);
  assert.deepEqual(back.inv, inv);
  assert.equal(deserializeInventory('not json').ok, false);
  assert.equal(deserializeInventory('{"a":1}').ok, false);
  assert.equal(deserializeInventory('[{"id":"healing_herb","qty":0}]').ok, false, 'rejects qty 0');
  assert.equal(deserializeInventory('[{"id":"healing_herb","qty":-2}]').ok, false, 'rejects negative');
  assert.equal(deserializeInventory('[{"id":"fake_item","qty":1}]').ok, false, 'rejects unknown id');
  assert.equal(deserializeInventory('[{"id":"healing_herb","qty":1},{"id":"healing_herb","qty":1}]').ok, false, 'rejects duplicate stacks');
});

test('equip / unequip swap through the inventory and aggregate stats', () => {
  let actor = makeActor();
  let inv = grantRewards(createInventory(), { iron_sword: 1, keeper_coat: 1, scout_compass: 1, warden_blade: 1 }).inv;
  let res = equipItem(actor, inv, 'iron_sword');
  assert.equal(res.ok, true);
  actor = res.actor; inv = res.inv;
  assert.equal(countItem(inv, 'iron_sword'), 0, 'equipped item leaves inventory');
  assert.equal(actor.equipment.weapon, 'iron_sword');
  assert.deepEqual(totalStats(actor), { atk: 7, def: 0, hp: 0, mp: 0 });
  // full set
  res = equipItem(actor, inv, 'keeper_coat'); actor = res.actor; inv = res.inv;
  res = equipItem(actor, inv, 'scout_compass'); actor = res.actor; inv = res.inv;
  const eff = effectiveStats(actor);
  assert.equal(eff.atk, 6 + 7, 'base atk + sword (compass gives def/hp)');
  assert.equal(eff.def, 3 + 8 + 1);
  assert.equal(eff.maxHp, 30 + 10 + 5);
  // swapping weapon returns the old one to the inventory
  res = equipItem(actor, inv, 'warden_blade'); actor = res.actor; inv = res.inv;
  assert.equal(actor.equipment.weapon, 'warden_blade');
  assert.equal(res.unequipped, 'iron_sword');
  assert.equal(countItem(inv, 'iron_sword'), 1, 'old weapon back in inventory');
  // unequip trinket
  res = unequipItem(actor, inv, 'trinket'); actor = res.actor; inv = res.inv;
  assert.equal(actor.equipment.trinket, null);
  assert.equal(countItem(inv, 'scout_compass'), 1);
  // cannot equip a consumable
  inv = addItem(inv, 'bandage', 1).inv;
  assert.equal(equipItem(actor, inv, 'bandage').ok, false);
  assert.equal(canActorEquip('bandage'), false);
  assert.equal(canActorEquip('iron_sword'), true);
});

test('rollLoot is deterministic with a stubbed rng and merges across enemies', () => {
  const table = [
    { id: 'scrap_metal', chance: 0.5, minQty: 1, maxQty: 3 },
    { id: 'iron_sword', chance: 0.9, minQty: 1, maxQty: 1 },
  ];
  // rng always returns 0.1 -> first entry drops, qty = 1 + floor(0.1*3)=1
  assert.deepEqual(rollLoot(table, () => 0.1), [{ id: 'scrap_metal', qty: 1 }, { id: 'iron_sword', qty: 1 }]);
  // rng 0.8: first entry skipped (0.8 >= 0.5), second drops (0.8 < 0.9)
  const drop2 = rollLoot(table, () => 0.8);
  assert.deepEqual(drop2, [{ id: 'iron_sword', qty: 1 }]);
  const enemies = [
    { id: 'rat', loot: [{ id: 'scrap_metal', chance: 1, minQty: 2, maxQty: 2 }] },
    { id: 'rat2', loot: [{ id: 'rations', chance: 1 }] },
    { id: 'rat3' },
  ];
  const merged = rollLootForEnemies(enemies, () => 0.01);
  assert.deepEqual(merged, [{ id: 'scrap_metal', qty: 2 }, { id: 'rations', qty: 1 }]);
  assert.deepEqual(rollLootForEnemies([{}], () => 0.5), []);
  assert.deepEqual(rollLoot(null), []);
});

test('catalog hygiene: valid ids, types, slots and no off-theme words', () => {
  const banned = /\b(eggs?|nests?|nest(ed|ing)?|hatch(ed|ing|es|lings?)?|yolk|chickens?|roosters?|hen|easter|scrambl(e|ed|ing)|omelet(te)?s?|peep(s|ing)?|shells?|shell(ed|ing)?)\b/i;
  for (const [id, item] of Object.entries(ITEMS)) {
    assert.match(id, /^[a-z][a-z0-9_]*$/, `bad id: ${id}`);
    assert.ok(Object.values(TYPES).includes(item.type), `${id} has valid type`);
    assert.equal(id, item.id, `${id} id matches key`);
    assert.ok(typeof item.description === 'string' && item.description.length > 10, `${id} has description`);
    assert.ok(!banned.test(item.name) && !banned.test(item.description), `${id} is on-theme`);
    if (item.type === TYPES.EQUIPMENT) assert.ok(SLOTS.includes(item.slot), `${id} has valid slot`);
    if (item.price) assert.ok(item.price > 0 && item.sellPrice > 0 && item.sellPrice <= item.price, `${id} priced sensibly`);
  }
  assert.ok(getItem('healing_herb'));
  assert.throws(() => getItem('nope'));
});
