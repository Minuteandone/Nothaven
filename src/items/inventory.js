// Inventory functions for Beacon of Stormhaven.
// Inventory shape (see src/state.js): an array of stacks `{ id: string, qty: number }`.
// Gold is NOT stored in the inventory — it lives in `state.gold` (see GOLD_ID in items.js).
// Every function here is pure: it returns new objects and never mutates its inputs,
// so the engine can keep `game.state` JSON-serializable and easily undo-able.

import { ITEMS, getItem, GOLD_ID } from './items.js';

/** @returns {Array<{id: string, qty: number}>} a fresh empty inventory */
export function createInventory() {
  return [];
}

function clone(inv) {
  return inv.map((stack) => ({ ...stack }));
}

/**
 * @param {Array<{id:string,qty:number}>} inv
 * @param {string} itemId
 * @returns {number} total quantity of itemId held (0 if none, and 0 for gold)
 */
export function countItem(inv, itemId) {
  if (itemId === GOLD_ID) return 0;
  const stack = inv.find((s) => s.id === itemId);
  return stack ? stack.qty : 0;
}

/**
 * Add qty of an item to the inventory, merging with an existing stack.
 * @param {Array<{id:string,qty:number}>} inv
 * @param {string} itemId must be a known item id (gold is not inventoried)
 * @param {number} [qty=1] positive integer
 * @returns {{ok: boolean, inv: Array<{id:string,qty:number}>, message: string}}
 */
export function addItem(inv, itemId, qty = 1) {
  if (itemId === GOLD_ID) {
    return { ok: false, inv: clone(inv), message: 'Gold is tracked separately in state.gold.' };
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    return { ok: false, inv: clone(inv), message: `Cannot add ${qty} of ${itemId}.` };
  }
  try { getItem(itemId); } catch { return { ok: false, inv: clone(inv), message: `Unknown item: ${itemId}.` }; }
  const out = clone(inv);
  const stack = out.find((s) => s.id === itemId);
  if (stack) stack.qty += qty;
  else out.push({ id: itemId, qty });
  const item = ITEMS[itemId];
  return { ok: true, inv: out, message: `Received ${item.name} x${qty}.` };
}

/**
 * Remove qty of an item. Atomic: removes nothing unless the full amount is held.
 * @returns {{ok: boolean, inv: Array<{id:string,qty:number}>, message: string}}
 */
export function removeItem(inv, itemId, qty = 1) {
  if (itemId === GOLD_ID) {
    return { ok: false, inv: clone(inv), message: 'Gold is tracked separately in state.gold.' };
  }
  if (!Number.isInteger(qty) || qty <= 0) {
    return { ok: false, inv: clone(inv), message: `Cannot remove ${qty} of ${itemId}.` };
  }
  const have = countItem(inv, itemId);
  if (have < qty) {
    return { ok: false, inv: clone(inv), message: `Not enough of ${itemId} (have ${have}, need ${qty}).` };
  }
  const out = clone(inv)
    .map((s) => (s.id === itemId ? { ...s, qty: s.qty - qty } : s))
    .filter((s) => s.qty > 0);
  return { ok: true, inv: out, message: `Removed ${itemId} x${qty}.` };
}

/**
 * @param {Array<{id:string,qty:number}>} inv
 * @param {Record<string, number>} requirements map of itemId -> required qty
 * @returns {boolean} true if every requirement is met
 */
export function hasItems(inv, requirements) {
  return Object.entries(requirements).every(([id, qty]) => countItem(inv, id) >= qty);
}

/**
 * Apply a reward map `{ itemId: qty }` (or array of stacks) to the inventory in one call.
 * If any id is unknown the whole grant fails with no changes (atomic).
 * @param {Array<{id:string,qty:number}>} inv
 * @param {Record<string, number>|Array<{id:string,qty:number}>} rewards
 * @returns {{ok: boolean, inv: Array<{id:string,qty:number}>, messages: string[]}}
 */
export function grantRewards(inv, rewards) {
  const list = Array.isArray(rewards)
    ? rewards.map((s) => ({ id: s.id, qty: s.qty }))
    : Object.entries(rewards || {}).map(([id, qty]) => ({ id, qty }));
  const messages = [];
  let out = clone(inv);
  for (const { id, qty } of list) {
    const res = addItem(out, id, qty);
    if (!res.ok) return { ok: false, inv: clone(inv), messages: [res.message] };
    out = res.inv;
    messages.push(res.message);
  }
  return { ok: true, inv: out, messages };
}

/**
 * Remove a set of requirements all-or-nothing (atomic), e.g. for crafting or payment.
 * @param {Array<{id:string,qty:number}>} inv
 * @param {Record<string, number>} requirements
 * @returns {{ok: boolean, inv: Array<{id:string,qty:number}>, message: string}}
 */
export function takeRewards(inv, requirements) {
  if (!hasItems(inv, requirements)) {
    return { ok: false, inv: clone(inv), message: 'Missing required items.' };
  }
  let out = clone(inv);
  for (const [id, qty] of Object.entries(requirements)) {
    const res = removeItem(out, id, qty);
    out = res.inv;
  }
  return { ok: true, inv: out, message: 'Handed over the required items.' };
}

/**
 * Serialize an inventory to a compact JSON string (for src/state.js saves).
 * @param {Array<{id:string,qty:number}>} inv
 * @returns {string}
 */
export function serializeInventory(inv) {
  return JSON.stringify(inv);
}

/**
 * Parse and validate a serialized inventory. Rejects malformed, negative or
 * unknown-id data instead of trusting it.
 * @param {string} str
 * @returns {{ok: boolean, inv: Array<{id:string,qty:number}>|null, message: string}}
 */
export function deserializeInventory(str) {
  let data;
  try { data = JSON.parse(str); } catch { return { ok: false, inv: null, message: 'Corrupt inventory (not JSON).' }; }
  if (!Array.isArray(data)) return { ok: false, inv: null, message: 'Corrupt inventory (not a list).' };
  const seen = new Set();
  for (const stack of data) {
    if (!stack || typeof stack !== 'object' || typeof stack.id !== 'string') {
      return { ok: false, inv: null, message: 'Corrupt inventory (bad stack).' };
    }
    if (!Number.isInteger(stack.qty) || stack.qty <= 0) {
      return { ok: false, inv: null, message: `Corrupt inventory (bad qty for ${stack.id}).` };
    }
    if (!ITEMS[stack.id] || seen.has(stack.id)) {
      return { ok: false, inv: null, message: `Corrupt inventory (bad id ${stack.id}).` };
    }
    seen.add(stack.id);
  }
  return { ok: true, inv: data.map((s) => ({ id: s.id, qty: s.qty })), message: 'Loaded.' };
}
