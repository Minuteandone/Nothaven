// Shop / trading for Beacon of Stormhaven.
// A shop is plain data: `{ id, name, greeting, stock: [itemId...] }`. Buying spends
// state.gold, selling earns sellPrice. All functions are pure and JSON-safe.

import { ITEMS, getItem, GOLD_ID, isKnownItem } from './items.js';
import { addItem } from './inventory.js';

/** The Greyhaven general trader's starting stock. */
export const GREYHAVEN_SHOP = Object.freeze({
  id: 'greyhaven_trader',
  name: "Hesta's Goods",
  greeting: 'Hesta the trader looks up from her ledgers. "Storm took half my roof, but the shelves held. What do you need?"',
  stock: ['rations', 'bandage', 'healing_herb', 'storm_tonic', 'field_dressing', 'highland_flask', 'rusted_pipe', 'padded_vest', 'leather_armor', 'scout_compass', 'gale_charm'],
});

/** The Saltmere coastal salvage stall (chapter two). Keyed in SHOPS by the map
 * interaction id, since the map's triggerShop passes the interactable id. */
export const SALTMERE_POST = Object.freeze({
  id: 'saltmere_post',
  name: 'Saltmere Trading Post',
  greeting: 'The salvage stall smells of tar and brine. "Everything here floats or cuts," the keeper says. "Mostly both."',
  stock: ['hearty_chowder', 'field_dressing', 'saltweather_jerkin', 'tidebound_cutlass', 'pearl_focus', 'rations'],
});

/** All shops, keyed by the map interaction id that opens them. */
export const SHOPS = Object.freeze({
  greyhaven_shop: GREYHAVEN_SHOP,
  saltmere_post: SALTMERE_POST,
});

/**
 * @param {string} id shop id (the map interaction id)
 * @returns {object|null} the shop, or null when unknown
 */
export function getShop(id) {
  return typeof id === 'string' && Object.hasOwn(SHOPS, id) ? SHOPS[id] : null;
}

/**
 * @param {object} shop a shop definition
 * @param {string} itemId
 * @returns {boolean} true if the shop stocks this item
 */
export function shopSells(shop, itemId) {
  return Array.isArray(shop.stock) && shop.stock.includes(itemId);
}

/**
 * Buy one or more of an item from a shop.
 * @param {{gold: number, inventory: Array<{id:string,qty:number}>}} state
 * @param {object} shop
 * @param {string} itemId
 * @param {number} [qty=1]
 * @returns {{ok: boolean, state: object, message: string}} new state (gold + inventory)
 */
export function buyItem(state, shop, itemId, qty = 1) {
  if (!Number.isInteger(qty) || qty <= 0) {
    return { ok: false, state, message: 'That is not a quantity you can buy.' };
  }
  if (!shopSells(shop, itemId)) {
    return { ok: false, state, message: 'The trader does not stock that.' };
  }
  let item;
  try { item = getItem(itemId); } catch { return { ok: false, state, message: `Unknown item: ${itemId}.` }; }
  const cost = (item.price || 0) * qty;
  if (state.gold < cost) {
    return { ok: false, state, message: `Not enough gold (need ${cost}, have ${state.gold}).` };
  }
  const invRes = addItem(state.inventory, itemId, qty);
  if (!invRes.ok) return { ok: false, state, message: invRes.message };
  return {
    ok: true,
    state: { ...state, gold: state.gold - cost, inventory: invRes.inv },
    message: `Bought ${item.name} x${qty} for ${cost} gold.`,
  };
}

/**
 * Sell one or more of an item from the inventory for its sellPrice.
 * @param {{gold: number, inventory: Array<{id:string,qty:number}>}} state
 * @param {string} itemId
 * @param {number} [qty=1]
 * @returns {{ok: boolean, state: object, message: string}}
 */
export function sellItem(state, itemId, qty = 1) {
  if (!Number.isInteger(qty) || qty <= 0) {
    return { ok: false, state, message: 'That is not a quantity you can sell.' };
  }
  let item;
  try { item = getItem(itemId); } catch { return { ok: false, state, message: `Unknown item: ${itemId}.` }; }
  if (item.type === 'key') {
    return { ok: false, state, message: 'The trader will not touch that.' };
  }
  const sellPrice = item.sellPrice ?? Math.floor((item.price || 0) / 2);
  const have = state.inventory.find((s) => s.id === itemId);
  if (!have || have.qty < qty) {
    return { ok: false, state, message: `You do not have ${qty} x ${item.name}.` };
  }
  // Reuse the pure inventory removal via a small local import-free clone.
  const out = state.inventory
    .map((s) => (s.id === itemId ? { ...s, qty: s.qty - qty } : s))
    .filter((s) => s.qty > 0);
  const earned = sellPrice * qty;
  return {
    ok: true,
    state: { ...state, gold: state.gold + earned, inventory: out },
    message: `Sold ${item.name} x${qty} for ${earned} gold.`,
  };
}

/**
 * Price list for rendering a shop UI (escaped by the UI layer).
 * @param {object} shop
 * @returns {Array<{id:string, name:string, price:number, sellPrice:number, type:string, description:string}>}
 */
export function shopCatalog(shop) {
  return (shop.stock || []).map((id) => {
    const it = isKnownItem(id) ? ITEMS[id] : null;
    return it ? { id, name: it.name, price: it.price ?? 0, sellPrice: it.sellPrice ?? 0, type: it.type, description: it.description } : null;
  }).filter(Boolean);
}

export { GOLD_ID };
