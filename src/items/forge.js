// Greyhaven forge fittings for Beacon of Stormhaven.
// Each party member can have their weapon and armour slots fitted up to +3.
// Fittings belong to the wearer and the slot (Hesta refits them whenever gear
// is swapped), so upgrading to a new blade never wastes earlier work. A fitting
// only adds its bonus while something is equipped in that slot.

import { getItem } from './items.js';
import { countItem, removeItem } from './inventory.js';

export const MAX_FITTING = 3;
export const FITTING_SLOTS = Object.freeze(['weapon', 'armor']);

/** Bonus granted per fitting level, by slot. */
export const FITTING_BONUS = Object.freeze({
  weapon: Object.freeze({ atk: 2 }),
  armor: Object.freeze({ def: 1, hp: 4 }),
});

/** Cost to reach each level (index 0 = +1). */
export const FITTING_COSTS = Object.freeze({
  weapon: Object.freeze([
    Object.freeze({ gold: 30, items: Object.freeze([{ id: 'scrap_metal', qty: 2 }]) }),
    Object.freeze({ gold: 70, items: Object.freeze([{ id: 'storm_glass', qty: 2 }, { id: 'scrap_metal', qty: 1 }]) }),
    Object.freeze({ gold: 140, items: Object.freeze([{ id: 'relay_brass', qty: 2 }, { id: 'storm_glass', qty: 1 }]) }),
  ]),
  armor: Object.freeze([
    Object.freeze({ gold: 30, items: Object.freeze([{ id: 'scrap_metal', qty: 2 }]) }),
    Object.freeze({ gold: 70, items: Object.freeze([{ id: 'storm_glass', qty: 2 }, { id: 'scrap_metal', qty: 1 }]) }),
    Object.freeze({ gold: 140, items: Object.freeze([{ id: 'relay_brass', qty: 2 }, { id: 'storm_glass', qty: 1 }]) }),
  ]),
});

export const SLOT_LABELS = Object.freeze({ weapon: 'Weapon', armor: 'Armour' });

/** Current fitting level (0..MAX_FITTING) for a member's slot. Tolerates bad saves. */
export function fittingLevel(actor, slot) {
  if (!FITTING_SLOTS.includes(slot)) return 0;
  const raw = actor?.temper?.[slot];
  return Number.isInteger(raw) ? Math.max(0, Math.min(MAX_FITTING, raw)) : 0;
}

/** Stat bonus from fittings on slots that currently hold equipment. */
export function fittingBonus(actor) {
  const totals = { atk: 0, def: 0, hp: 0, mp: 0, spd: 0 };
  for (const slot of FITTING_SLOTS) {
    if (!actor?.equipment?.[slot]) continue;
    const level = fittingLevel(actor, slot);
    for (const [key, per] of Object.entries(FITTING_BONUS[slot])) totals[key] += per * level;
  }
  return totals;
}

/** Short text such as "+4 atk" or "+2 def, +8 HP" for a slot at a level. */
export function fittingEffectText(slot, level) {
  if (!level) return 'No fitting';
  const per = FITTING_BONUS[slot] || {};
  const parts = [];
  if (per.atk) parts.push(`+${per.atk * level} atk`);
  if (per.def) parts.push(`+${per.def * level} def`);
  if (per.hp) parts.push(`+${per.hp * level} HP`);
  return parts.join(', ');
}

/** Cost of the next fitting for a slot, or null at the maximum. */
export function nextFittingCost(actor, slot) {
  const level = fittingLevel(actor, slot);
  if (!FITTING_SLOTS.includes(slot) || level >= MAX_FITTING) return null;
  return FITTING_COSTS[slot][level];
}

export function costText(cost) {
  if (!cost) return '';
  const items = cost.items.map(({ id, qty }) => `${qty} ${getItem(id).name}`);
  return [`${cost.gold} gold`, ...items].join(' · ');
}

function memberById(state, memberId) {
  return Array.isArray(state?.party) ? state.party.find((m) => m && m.id === memberId) || null : null;
}

/** Whether a fitting can be applied now, with a player-facing reason when not. */
export function fittingCheck(state, memberId, slot) {
  const member = memberById(state, memberId);
  if (!member) return { ok: false, reason: 'That party member is not with you.' };
  if (!FITTING_SLOTS.includes(slot)) return { ok: false, reason: 'Only weapons and armour can be fitted.' };
  if (!member.equipment?.[slot]) return { ok: false, reason: `Equip ${slot === 'weapon' ? 'a weapon' : 'armour'} first.` };
  const cost = nextFittingCost(member, slot);
  if (!cost) return { ok: false, reason: 'Already fully fitted.' };
  if ((state.gold || 0) < cost.gold) return { ok: false, reason: `Needs ${cost.gold} gold.` };
  const inv = Array.isArray(state.inventory) ? state.inventory : [];
  for (const { id, qty } of cost.items) {
    if (countItem(inv, id) < qty) return { ok: false, reason: `Needs ${qty} ${getItem(id).name}.` };
  }
  return { ok: true, reason: '', member, cost };
}

/** Pay for and apply the next fitting. Mutates state on success only. */
export function applyFitting(state, memberId, slot) {
  const check = fittingCheck(state, memberId, slot);
  if (!check.ok) return { ok: false, message: check.reason };
  const { member, cost } = check;
  let inv = state.inventory;
  for (const { id, qty } of cost.items) {
    const res = removeItem(inv, id, qty);
    if (!res.ok) return { ok: false, message: res.message };
    inv = res.inv;
  }
  const level = fittingLevel(member, slot) + 1;
  state.inventory = inv;
  state.gold -= cost.gold;
  member.temper = { ...(member.temper && typeof member.temper === 'object' ? member.temper : {}), [slot]: level };
  const hpGain = FITTING_BONUS[slot].hp || 0;
  if (hpGain && Number.isFinite(member.hp) && member.hp > 0) member.hp += hpGain;
  return { ok: true, message: `${member.name}’s ${SLOT_LABELS[slot].toLowerCase()} fitting is now +${level} (${fittingEffectText(slot, level)}).` };
}
