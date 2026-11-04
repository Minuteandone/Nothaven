// Consumable use for Beacon of Stormhaven.
// Applies a consumable item's `use` effect ({hp, mp, cure}) to an actor.
// Pure: returns new actor/inventory. Combat (DeepSeek) and town scenes can call this
// for "use item" actions.

import { getItem, TYPES } from './items.js';
import { removeItem } from './inventory.js';
import { effectiveStats } from './equipment.js';

/**
 * Use a consumable from the inventory on an actor.
 * @param {object} actor e.g. a party member {hp, maxHp, mp, maxMp, ...}
 * @param {Array<{id:string,qty:number}>} inv
 * @param {string} itemId
 * @returns {{ok: boolean, actor: object, inv: Array, effects: {hp?: number, mp?: number, cure?: string}, message: string}}
 */
export function useConsumable(actor, inv, itemId) {
  let item;
  try { item = getItem(itemId); } catch {
    return { ok: false, actor, inv, effects: {}, message: `Unknown item: ${itemId}.` };
  }
  if (item.type !== TYPES.CONSUMABLE) {
    return { ok: false, actor, inv, effects: {}, message: `${item.name} cannot be used like that.` };
  }
  const held = inv.find((s) => s.id === itemId);
  if (!held) {
    return { ok: false, actor, inv, effects: {}, message: `You have no ${item.name}.` };
  }
  const use = item.use || {};
  const effects = {};
  if (use.hp) effects.hp = use.hp;
  if (use.mp) effects.mp = use.mp;
  if (use.cure) effects.cure = use.cure;

  const outActor = { ...actor };
  const notes = [];
  if (use.hp) {
    const before = outActor.hp ?? 0;
    // Cap at the effective max (base + equipment bonuses) and never reduce HP.
    const cap = effectiveStats(outActor).maxHp || before;
    outActor.hp = Math.max(before, Math.min(cap, before + use.hp));
    notes.push(`restored ${outActor.hp - before} hp`);
  }
  if (use.mp) {
    const before = outActor.mp ?? 0;
    // Cap at the effective max (base + equipment bonuses) and never reduce MP.
    const cap = effectiveStats(outActor).maxMp || before;
    outActor.mp = Math.max(before, Math.min(cap, before + use.mp));
    notes.push(`restored ${outActor.mp - before} mp`);
  }
  if (use.cure) {
    if (Array.isArray(outActor.statuses)) {
      outActor.statuses = outActor.statuses.filter((s) => s !== use.cure);
    }
    notes.push(`cured ${use.cure}`);
  }
  const takeRes = removeItem(inv, itemId);
  if (!takeRes.ok) return { ok: false, actor, inv, effects: {}, message: takeRes.message };
  return {
    ok: true,
    actor: outActor,
    inv: takeRes.inv,
    effects,
    message: `${item.name}: ${notes.length ? notes.join(', ') : 'no effect'}.`,
  };
}
