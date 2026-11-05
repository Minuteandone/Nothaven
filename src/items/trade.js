// Trade tab — data-driven material exchanges offered at trading posts.
// Trades are deliberately lossy: the goods you hand over are always worth
// somewhat more than what you receive, so trading is a convenience, not a
// moneymaking scheme. Rare drops (scarce items) are never tradable here.

import { getItem, isKnownItem } from './items.js';
import { takeRewards, grantRewards } from './inventory.js';

/**
 * Frozen trade catalogue. Each trade: { id, name, give: [{id, qty}], receive: {id, qty} }.
 */
export const TRADES = Object.freeze([
  Object.freeze({
    id: 'scrap_to_glass',
    name: 'Scrap for storm glass',
    give: Object.freeze([Object.freeze({ id: 'scrap_metal', qty: 4 })]),
    receive: Object.freeze({ id: 'storm_glass', qty: 1 }),
  }),
  Object.freeze({
    id: 'wiring_to_sunscar',
    name: 'Wiring for sunscar glass',
    give: Object.freeze([Object.freeze({ id: 'salvaged_wiring', qty: 3 })]),
    receive: Object.freeze({ id: 'sunscar_glass', qty: 1 }),
  }),
]);

/** Shop interactable ids that offer the Trade tab. */
export const TRADE_LOCATIONS = Object.freeze(['saltmere_post', 'relay_outpost']);

/** Trades offered at a given shop (empty when the shop has no Trade tab). */
export function tradesFor(shopId) {
  if (!TRADE_LOCATIONS.includes(shopId)) return [];
  return TRADES;
}

/** Look up a trade by id; null when unknown. */
export function getTrade(tradeId) {
  return TRADES.find((t) => t.id === tradeId) || null;
}

/** Price-basis value of a stack list, using catalogue shop prices. */
function stackValue(stack) {
  return (getItem(stack.id)?.price || 0) * stack.qty;
}

/** Total give value minus receive value; negative means the trade creates value (never allowed). */
export function tradeLoss(trade) {
  const give = trade.give.reduce((sum, s) => sum + stackValue(s), 0);
  return give - stackValue(trade.receive);
}

/**
 * Check every give entry against an inventory (same shape as recipeInputsMet).
 * @returns {{ok: boolean, missing: Array<{id: string, have: number, qty: number}>}}
 */
export function tradeInputsMet(inv, trade) {
  const missing = [];
  for (const stack of trade.give) {
    const have = inv.filter((s) => s.id === stack.id).reduce((sum, s) => sum + s.qty, 0);
    if (have < stack.qty) missing.push({ id: stack.id, have, qty: stack.qty });
  }
  return { ok: missing.length === 0, missing };
}

/**
 * Perform a trade all-or-nothing (atomic): removes every give entry, then adds
 * the receive stack. The returned inv must be written back by the caller.
 * @returns {{ok: boolean, inv: Array<{id:string,qty:number}>, message: string}}
 */
export function performTrade(inv, tradeId) {
  const trade = getTrade(tradeId);
  if (!trade) {
    return { ok: false, inv, message: `Unknown trade: ${tradeId}.` };
  }
  const { ok: met, missing } = tradeInputsMet(inv, trade);
  if (!met) {
    const detail = missing.map((m) => `${m.id} (have ${m.have}, need ${m.qty})`).join(', ');
    return { ok: false, inv, message: `Missing materials: ${detail}.` };
  }
  const requirements = Object.fromEntries(trade.give.map((s) => [s.id, s.qty]));
  const take = takeRewards(inv, requirements);
  if (!take.ok) {
    return { ok: false, inv, message: take.message };
  }
  const give = grantRewards(take.inv, [trade.receive]);
  if (!give.ok) {
    return { ok: false, inv, message: give.messages[0] };
  }
  const giveText = trade.give.map((s) => `${s.qty} ${getItem(s.id)?.name || s.id}`).join(', ');
  const receiveText = `${trade.receive.qty} ${getItem(trade.receive.id)?.name || trade.receive.id}`;
  return { ok: true, inv: give.inv, message: `Traded ${giveText} for ${receiveText}.` };
}

/** Validate catalogue invariants on demand (used by tests). */
export function assertTradeCatalogue() {
  const ids = new Set();
  for (const trade of TRADES) {
    if (ids.has(trade.id)) throw new Error(`Duplicate trade id: ${trade.id}`);
    ids.add(trade.id);
    if (!isKnownItem(trade.receive.id) || trade.receive.qty < 1) {
      throw new Error(`Invalid receive side: ${trade.id}`);
    }
    if (!trade.give.length) throw new Error(`Empty give side: ${trade.id}`);
    for (const stack of trade.give) {
      if (!isKnownItem(stack.id) || !Number.isInteger(stack.qty) || stack.qty < 1) {
        throw new Error(`Invalid give side: ${trade.id}`);
      }
    }
    if (tradeLoss(trade) <= 0) {
      throw new Error(`Trade must be lossy: ${trade.id}`);
    }
  }
}
