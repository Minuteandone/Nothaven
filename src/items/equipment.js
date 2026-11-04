// Equipment helpers for Beacon of Stormhaven.
// An actor's equipment is stored on the actor as `equipment = { weapon, armor, trinket }`
// where each slot holds an item id (string) or null. Works for party members and enemies.
// All functions are pure: they return new objects and never mutate inputs.

import { ITEMS, getItem, canEquip } from './items.js';
import { addItem, removeItem } from './inventory.js';

/** @returns {{weapon: string|null, armor: string|null, trinket: string|null}} */
export function createEquipment() {
  return { weapon: null, armor: null, trinket: null };
}

/**
 * @param {object} actor
 * @param {string} itemId
 * @returns {boolean} true if actor can equip this item (known, equipment, valid slot)
 */
export function canActorEquip(itemId) {
  return canEquip(itemId);
}

/**
 * Equip an item from the inventory: takes it out of the inventory, swaps whatever is
 * in that slot back into the inventory.
 * @param {object} actor must have `.equipment` (use createEquipment() to initialize)
 * @param {Array<{id:string,qty:number}>} inv
 * @param {string} itemId
 * @returns {{ok: boolean, actor: object, inv: Array, unequipped: string|null, message: string}}
 */
export function equipItem(actor, inv, itemId) {
  let item;
  try { item = getItem(itemId); } catch { return { ok: false, actor, inv, unequipped: null, message: `Unknown item: ${itemId}.` }; }
  if (!canEquip(itemId)) {
    return { ok: false, actor, inv, unequipped: null, message: `${item.name} cannot be equipped.` };
  }
  const have = inv.find((s) => s.id === itemId);
  if (!have) {
    return { ok: false, actor, inv, unequipped: null, message: `You do not have a ${item.name}.` };
  }
  const slot = item.slot;
  const previous = actor.equipment?.[slot] || null;
  let outInv = inv;
  let unequipped = null;
  if (previous) {
    const back = addItem(outInv, previous);
    outInv = back.inv;
    unequipped = previous;
  }
  const takeRes = removeItem(outInv, itemId);
  if (!takeRes.ok) {
    return { ok: false, actor, inv, unequipped: null, message: takeRes.message };
  }
  const outActor = {
    ...actor,
    equipment: { ...(actor.equipment || createEquipment()), [slot]: itemId },
  };
  return {
    ok: true,
    actor: outActor,
    inv: takeRes.inv,
    unequipped,
    message: `Equipped ${item.name}${unequipped ? ` (put away ${ITEMS[unequipped]?.name ?? unequipped})` : ''}.`,
  };
}

/**
 * Unequip a slot back into the inventory.
 * @param {object} actor
 * @param {Array<{id:string,qty:number}>} inv
 * @param {'weapon'|'armor'|'trinket'} slot
 * @returns {{ok: boolean, actor: object, inv: Array, message: string}}
 */
export function unequipItem(actor, inv, slot) {
  const current = actor.equipment?.[slot];
  if (!current) return { ok: false, actor, inv, message: 'Nothing equipped in that slot.' };
  const addRes = addItem(inv, current);
  if (!addRes.ok) return { ok: false, actor, inv, message: addRes.message };
  const outActor = { ...actor, equipment: { ...(actor.equipment || createEquipment()), [slot]: null } };
  return { ok: true, actor: outActor, inv: addRes.inv, message: `Unequipped ${ITEMS[current]?.name ?? current}.` };
}

/**
 * Sum of equipment stat bonuses across all three slots.
 * @param {object} actor
 * @returns {{atk: number, def: number, hp: number, mp: number}}
 */
export function totalStats(actor) {
  const totals = { atk: 0, def: 0, hp: 0, mp: 0 };
  const eq = actor.equipment || {};
  for (const id of [eq.weapon, eq.armor, eq.trinket]) {
    if (!id) continue;
    const stats = ITEMS[id]?.stats || {};
    for (const key of Object.keys(totals)) totals[key] += stats[key] || 0;
  }
  return totals;
}

/**
 * Actor stats including equipment bonuses. The actor's own atk/def are the base;
 * hp/mp bonuses raise maxHp/maxMp.
 * @param {object} actor
 * @returns {{atk: number, def: number, maxHp: number, maxMp: number, spd: number}}
 */
export function effectiveStats(actor) {
  const bonus = totalStats(actor);
  return {
    atk: (actor.atk || 0) + bonus.atk,
    def: (actor.def || 0) + bonus.def,
    maxHp: (actor.maxHp || 0) + bonus.hp,
    maxMp: (actor.maxMp || 0) + bonus.mp,
    spd: actor.spd || 0,
  };
}
