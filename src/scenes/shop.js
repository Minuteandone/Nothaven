// Shop scene — Hesta's Goods in Greyhaven (Beacon of Stormhaven).
// Thin UI over the pure trading logic in src/items/shop.js and the
// equipment helpers in src/items/equipment.js. All rendered strings
// are escaped; all state mutations go through the pure helpers.

import { GREYHAVEN_SHOP, getShop, shopCatalog, buyItem, buyUpTo, sellItem, isScarceItem } from '../items/shop.js';
import { getItem, isKnownItem, canEquip } from '../items/items.js';
import { countItem } from '../items/inventory.js';
import { equipItem, unequipItem, effectiveStats, createEquipment, statDeltaSummary } from '../items/equipment.js';
import { listRecipes, recipeInputsMet, recipeSummary, craft, recipesUsingItem } from '../items/crafting.js';
import { tradesFor, tradeInputsMet, performTrade } from '../items/trade.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SLOT_LABELS = { weapon: 'Weapon', armor: 'Armor', trinket: 'Trinket' };

/** Largest quantity the Buy tab's stepper can queue for one purchase. */
export const SHOP_BUY_QTY_MAX = 99;

function typeLabel(type) {
  return { consumable: 'Consumable', equipment: 'Gear', key: 'Key item', material: 'Material' }[type] || 'Goods';
}

function statSummary(stats) {
  if (!stats) return '';
  const parts = [];
  if (stats.atk) parts.push(`ATK+${stats.atk}`);
  if (stats.def) parts.push(`DEF+${stats.def}`);
  if (stats.hp) parts.push(`HP+${stats.hp}`);
  if (stats.mp) parts.push(`MP+${stats.mp}`);
  if (stats.spd) parts.push(`SPD+${stats.spd}`);
  return parts.join(' · ');
}

function sellPriceOf(item) {
  return item.sellPrice ?? Math.floor((item.price || 0) / 2);
}

function sellableStacks(inv) {
  return (inv || [])
    .filter((s) => s && isKnownItem(s.id))
    .map((s) => ({ stack: s, item: getItem(s.id) }))
    .filter(({ item }) => item.type !== 'key' && sellPriceOf(item) > 0);
}

function getRecipeSafe(id) {
  return listRecipes().find((r) => r.id === id) || null;
}

function normalizeShopQty(value) {
  return Number.isInteger(value) && value >= 1 ? Math.min(SHOP_BUY_QTY_MAX, value) : 1;
}

function activeMember(game) {
  const party = Array.isArray(game.state?.party) && game.state.party.length ? game.state.party : [];
  let index = Number.isInteger(game.shopMemberIndex) ? game.shopMemberIndex : 0;
  if (index < 0 || index >= party.length) index = 0;
  const member = party[index] || party[0] || null;
  if (member && !member.equipment) member.equipment = createEquipment();
  return { member, index, party };
}

export const shopScene = {
  onEnter(game, data) {
    game.shopMode = ['sell', 'craft', 'trade'].includes(data?.mode) ? data.mode : 'buy';
    game.shopMessage = data?.message || '';
    game.shopReturnScene = data?.returnScene || 'town';
    game.shopMemberIndex = 0;
    game.shopQty = 1;
    game.shopId = data?.shopId && getShop(data.shopId) ? data.shopId : 'greyhaven_shop';
  },

  render(game) {
    const s = game.state;
    const hero = s.party[0];
    const shop = getShop(game.shopId) || GREYHAVEN_SHOP;
    const mode = ['sell', 'craft', 'trade'].includes(game.shopMode) ? game.shopMode : 'buy';
    const gold = s.gold ?? 0;
    const buyQty = normalizeShopQty(game.shopQty);
    const { member, index, party } = activeMember(game);
    const eff = effectiveStats(member);
    const eq = member.equipment || createEquipment();

    const buyRows = shopCatalog(shop)
      .map((it) => {
        const stats = isKnownItem(it.id) ? getItem(it.id).stats : null;
        let cmpLine = '';
        let wearingIt = false;
        if (isKnownItem(it.id) && canEquip(it.id)) {
          const curId = eq[getItem(it.id).slot];
          const curItem = curId && isKnownItem(curId) ? getItem(curId) : null;
          const delta = statDeltaSummary(curItem, getItem(it.id));
          if (delta) cmpLine = `<br><small>vs ${esc(curItem.name)}: ${esc(delta)}</small>`;
          wearingIt = curId === it.id;
        }
        let craftLine = '';
        if (isKnownItem(it.id)) {
          const uses = recipesUsingItem(it.id);
          if (uses.length) {
            const names = uses.slice(0, 2).map((r) => r.name);
            const rest = uses.length - names.length;
            craftLine = `<br><small>Used in: ${esc(names.join(' · '))}${rest > 0 ? ` (+${rest} more)` : ''}</small>`;
          }
        }
        return `<tr>
          <td><strong>${esc(it.name)}</strong><br>
            <small>${esc(it.description)}</small><br>
            <small>${esc(typeLabel(it.type))}${stats ? ' · ' + esc(statSummary(stats)) : ''}</small>${craftLine}${cmpLine}</td>
          <td style="white-space:nowrap;">${it.price}g</td>
          <td>
            <button data-action="buy" data-arg="${esc(it.id)}"${buyQty > 1 ? ` aria-label="Buy ${buyQty} ${esc(it.name)}"` : ''} ${gold < it.price ? 'disabled' : ''}>${buyQty > 1 ? `Buy ×${buyQty}` : 'Buy'}</button>
            <button data-action="buy5" data-arg="${esc(it.id)}" aria-label="Buy 5 ${esc(it.name)}" ${gold < it.price ? 'disabled' : ''}>Buy 5</button>
            ${wearingIt || (isKnownItem(it.id) && canEquip(it.id)) ? `<div style="margin-top:0.25rem;">
              <button data-action="buyEquip" data-arg="${esc(it.id)}" aria-label="Buy and equip ${esc(it.name)}" ${gold < it.price || wearingIt ? 'disabled' : ''}>Buy &amp; equip</button>
            </div>` : ''}
          </td>
        </tr>`;
      })
      .join('');

    const sellRows = sellableStacks(s.inventory)
      .map(({ stack, item }) => {
        const unit = sellPriceOf(item);
        const scarce = isScarceItem(item.id);
        return `<tr>
          <td><strong>${esc(item.name)}</strong> ×${stack.qty}${scarce ? ' <small class="sell-scarce">rare drop</small>' : ''}
            ${item.stats ? `<br><small>${esc(statSummary(item.stats))}</small>` : ''}</td>
          <td style="white-space:nowrap;">${unit}g each</td>
          <td>
            <button data-action="sell" data-arg="${esc(item.id)}"${scarce ? ' aria-label="Sell 1 ' + esc(item.name) + ' (rare drop, hard to replace)"' : ''}>Sell 1</button>
            ${stack.qty > 1 && !scarce && buyQty > 1 ? `<button data-action="sellQty" data-arg="${esc(item.id)}" aria-label="Sell ${Math.min(buyQty, stack.qty)} ${esc(item.name)}"${buyQty >= stack.qty ? ' disabled' : ''}>Sell ${buyQty} (${unit * Math.min(buyQty, stack.qty)}g)</button>` : ''}
            ${stack.qty > 1 && !scarce ? `<button data-action="sellAll" data-arg="${esc(item.id)}">Sell all (${unit * stack.qty}g)</button>` : ''}
          </td>
        </tr>`;
      })
      .join('');

    const gearRows = ['weapon', 'armor', 'trinket']
      .map((slot) => {
        const cur = eq[slot];
        const curItem = cur && isKnownItem(cur) ? getItem(cur) : null;
        const owned = (s.inventory || []).filter(
          (st) => st && isKnownItem(st.id) && canEquip(st.id) && getItem(st.id).slot === slot
        );
        const ownedButtons = owned
          .map((st) => {
            const it = getItem(st.id);
            const delta = statDeltaSummary(curItem, it);
            return `<button data-action="equip" data-arg="${esc(it.id)}">Equip ${esc(it.name)}</button>${delta && curItem ? ` <small>vs ${esc(curItem.name)}: ${esc(delta)}</small>` : ''}`;
          })
          .join(' ');
        return `<tr>
          <td><strong>${SLOT_LABELS[slot]}</strong></td>
          <td>${curItem ? `${esc(curItem.name)} <small>${esc(statSummary(curItem.stats))}</small>` : '<em>—</em>'}</td>
          <td>${cur ? `<button data-action="unequip" data-arg="${esc(slot)}">Unequip</button>` : ''}</td>
          <td>${ownedButtons || '<small>nothing in pack</small>'}</td>
        </tr>`;
      })
      .join('');


    const tradeOffers = tradesFor(shop.id);
    const tradeRows = tradeOffers
      .map((trade) => {
        const { ok: met, missing } = tradeInputsMet(s.inventory, trade);
        const giveText = trade.give.map((stack) => `${stack.qty} ${esc(getItem(stack.id)?.name || stack.id)}`).join(', ');
        const receiveText = `${trade.receive.qty} ${esc(getItem(trade.receive.id)?.name || trade.receive.id)}`;
        const giveValue = trade.give.reduce((sum, stack) => sum + (getItem(stack.id)?.price || 0) * stack.qty, 0);
        const receiveValue = (getItem(trade.receive.id)?.price || 0) * trade.receive.qty;
        const shortfall = met
          ? ''
          : `<small class="trade-shortfall">Needs: ${missing.map((m) => `${m.qty} ${esc(getItem(m.id)?.name || m.id)} (have ${m.have})`).join(', ')}</small>`;
        return `<tr>
          <td><strong>${esc(trade.name)}</strong><br><small>${giveText} &rarr; ${receiveText}</small><br><small class="trade-value">Worth ${giveValue}g &rarr; ${receiveValue}g</small>${shortfall}</td>
          <td><button data-action="trade" data-arg="${esc(trade.id)}" ${met ? '' : 'disabled'}>Trade</button> <button data-action="tradeAll" data-arg="${esc(trade.id)}" ${met ? '' : 'disabled'}>Trade all</button></td>
        </tr>`;
      })
      .join('');

    const craftRows = listRecipes()
      .map((recipe) => {
        const { ok: met, missing } = recipeInputsMet(s.inventory, recipe);
        const usesScarce = (recipe.inputs || []).some((input) => isScarceItem(input.id));
        const checklist = recipe.inputs
          .map(({ id, qty }) => {
            const have = Math.min(qty, countItem(s.inventory, id));
            const it = isKnownItem(id) ? getItem(id) : null;
            const label = it ? it.name : id;
            const scarceNote = isScarceItem(id) ? ' <small class="craft-scarce">rare drop</small>' : '';
            return `<li class="${have >= qty ? 'have' : 'need'}">${esc(label)} ×${qty} <small>(have ${have})</small>${scarceNote}</li>`;
          })
          .join('');
        const outputs = recipe.outputs
          .map(({ id, qty }) => {
            const it = isKnownItem(id) ? getItem(id) : null;
            const label = it ? it.name : id;
            const stats = it?.stats ? ` <small>(${esc(statSummary(it.stats))})</small>` : '';
            return `${esc(label)} ×${qty}${stats}`;
          })
          .join(', ');
        return `<tr>
          <td><strong>${esc(recipe.name)}</strong><br>
            <small>${esc(recipe.description)}</small><br>
            <small>Needs: ${esc(recipeSummary(recipe))}</small></td>
          <td><ul class="craft-checklist">${checklist}</ul></td>
          <td><strong>${outputs}</strong></td>
          <td><button data-action="craft" data-arg="${esc(recipe.id)}" ${met ? '' : 'disabled'}>Craft</button>${usesScarce ? '' : ` <button data-action="craftAll" data-arg="${esc(recipe.id)}" ${met ? '' : 'disabled'}>Craft all</button>`}</td>
        </tr>`;
      })
      .join('');

    const qtyPicker = `<div class="shop-qty" role="group" aria-label="Buy quantity">
          <span aria-live="polite">Buy quantity ×${buyQty}</span>
          <button data-action="shopQty" data-arg="dec" aria-label="Decrease buy quantity"${buyQty <= 1 ? ' disabled' : ''}>&minus;</button>
          <button data-action="shopQty" data-arg="inc" aria-label="Increase buy quantity"${buyQty >= SHOP_BUY_QTY_MAX ? ' disabled' : ''}>+</button>
          <small>The Buy button purchases this many at once; Buy 5 and Buy &amp; equip are unchanged.</small>
        </div>`;

    const sellPicker = `<div class="shop-qty" role="group" aria-label="Sell quantity">
          <span aria-live="polite">Sell quantity ×${buyQty}</span>
          <button data-action="shopQty" data-arg="dec" aria-label="Decrease sell quantity"${buyQty <= 1 ? ' disabled' : ''}>&minus;</button>
          <button data-action="shopQty" data-arg="inc" aria-label="Increase sell quantity"${buyQty >= SHOP_BUY_QTY_MAX ? ' disabled' : ''}>+</button>
          <small>The Sell N button sells this many from a stack; Sell 1 and Sell all are unchanged, and rare drops stay sell-one-at-a-time.</small>
        </div>`;

    return `
      <div class="panel">
        <h2>${esc(shop.name)}</h2>
        <div class="stats">
          <span>${esc(hero.name)} Lv ${hero.level ?? 1}</span>
          <span class="hp">HP ${hero.hp}/${eff.maxHp}</span>
          <span>MP ${hero.mp ?? 0}/${eff.maxMp}</span>
          <span>ATK ${eff.atk}</span><span>DEF ${eff.def}</span><span>SPD ${eff.spd}</span>
          <span>Gold ${gold}</span>
        </div>
        <p><em>${esc(shop.greeting)}</em></p>
        <p role="status">${esc(game.shopMessage || '')}</p>
        <div class="shop-tabs" role="group" aria-label="Shop sections">
          <button class="shop-tab${mode === 'buy' ? ' shop-tab--active' : ''}" data-action="setMode" data-arg="buy" ${mode === 'buy' ? 'aria-current="true"' : ''}>Buy</button>
          <button class="shop-tab${mode === 'sell' ? ' shop-tab--active' : ''}" data-action="setMode" data-arg="sell" ${mode === 'sell' ? 'aria-current="true"' : ''}>Sell</button>
          <button class="shop-tab${mode === 'craft' ? ' shop-tab--active' : ''}" data-action="setMode" data-arg="craft" ${mode === 'craft' ? 'aria-current="true"' : ''}>Craft</button>
          ${tradeOffers.length ? `<button class="shop-tab${mode === 'trade' ? ' shop-tab--active' : ''}" data-action="setMode" data-arg="trade" ${mode === 'trade' ? 'aria-current="true"' : ''}>Trade</button>` : ''}
        </div>
        ${
          mode === 'buy'
            ? `${qtyPicker}<table class="shop-buy" aria-label="Items for sale">${buyRows}</table>`
            : mode === 'sell'
              ? sellRows
                ? `${sellPicker}<table class="shop-sell" aria-label="Items available to sell">${sellRows}</table>`
                : '<p>You carry nothing Hesta would pay for.</p>'
              : mode === 'trade'
                ? tradeRows
                  ? `<table class="shop-trade" aria-label="Trade offers">${tradeRows}</table>`
                  : '<p>No trades are on offer right now.</p>'
                : `<table class="craft-table" aria-label="Crafting recipes">${craftRows}</table>`
        }
        <h3>Wardrobe${party.length > 1 ? ` — ${esc(member.name)}` : ''}</h3>
        ${
          party.length > 1
            ? `<div role="group" aria-label="Choose whose gear to view">${party
                .map((m, i) =>
                  m
                    ? `<button class="shop-tab${i === index ? ' shop-tab--active' : ''}" data-action="selectMember" data-arg="${i}" ${i === index ? 'aria-current="true"' : ''}>${esc(m.name || `Member ${i + 1}`)}${m.companion ? ' (ally)' : ''}</button>`
                    : ''
                )
                .join('')}</div>`
            : ''
        }
        <table class="shop-wardrobe" aria-label="Equipped gear and spare equipment">${gearRows}</table>
        <div style="margin-top:0.5rem;">
          <button data-action="leave">Back to ${game.shopReturnScene === 'explore' ? 'the streets' : 'town square'}</button>
        </div>
      </div>`;
  },

  actions: {
    setMode(game, el) {
      const arg = el?.dataset?.arg;
      game.shopMode = ['sell', 'craft', 'trade'].includes(arg) ? arg : 'buy';
    },
    trade(game, el) {
      const id = el?.dataset?.arg;
      if (!id) return;
      const shop = getShop(game.shopId) || GREYHAVEN_SHOP;
      if (!tradesFor(shop.id).some((t) => t.id === id)) {
        game.shopMessage = 'That trade is not offered here.';
        return;
      }
      const res = performTrade(game.state.inventory, id);
      game.shopMessage = res.message;
      if (res.ok) game.state.inventory = res.inv;
    },
    tradeAll(game, el) {
      const id = el?.dataset?.arg;
      if (!id) return;
      const shop = getShop(game.shopId) || GREYHAVEN_SHOP;
      const trade = tradesFor(shop.id).find((t) => t.id === id);
      if (!trade) {
        game.shopMessage = 'That trade is not offered here.';
        return;
      }
      const first = performTrade(game.state.inventory, id);
      if (!first.ok) {
        game.shopMessage = first.message;
        return;
      }
      let n = 1;
      let inv = first.inv;
      while (n < 99) {
        const res = performTrade(inv, id);
        if (!res.ok) break;
        inv = res.inv;
        n += 1;
      }
      game.state.inventory = inv;
      game.shopMessage = `${shop.name} — traded ${trade.name} x${n}.`;
    },
    shopQty(game, el) {
      const arg = el?.dataset?.arg;
      const current = normalizeShopQty(game.shopQty);
      if (arg === 'inc') game.shopQty = Math.min(SHOP_BUY_QTY_MAX, current + 1);
      else if (arg === 'dec') game.shopQty = Math.max(1, current - 1);
    },
    buy(game, el) {
      const id = el?.dataset?.arg;
      if (!id) return;
      const shop = getShop(game.shopId) || GREYHAVEN_SHOP;
      const qty = normalizeShopQty(game.shopQty);
      const res = buyItem(game.state, shop, id, qty);
      game.shopMessage = res.message;
      if (res.ok) {
        game.state.gold = res.state.gold;
        game.state.inventory = res.state.inventory;
      }
    },
    buy5(game, el) {
      const id = el?.dataset?.arg;
      if (!id) return;
      const shop = getShop(game.shopId) || GREYHAVEN_SHOP;
      const res = buyUpTo(game.state, shop, id, 5);
      game.shopMessage = res.message;
      if (res.ok) {
        game.state.gold = res.state.gold;
        game.state.inventory = res.state.inventory;
      }
    },
    buyEquip(game, el) {
      const id = el?.dataset?.arg;
      if (!id) return;
      const shop = getShop(game.shopId) || GREYHAVEN_SHOP;
      const s = game.state;
      if (!isKnownItem(id) || !canEquip(id)) {
        game.shopMessage = 'That cannot be equipped.';
        return;
      }
      const item = getItem(id);
      const { member, index, party } = activeMember(game);
      const wearing = (member.equipment || createEquipment())[item.slot];
      if (wearing === id) {
        game.shopMessage = `${item.name} is already equipped.`;
        return;
      }
      const buyRes = buyItem(s, shop, id, 1);
      game.shopMessage = buyRes.message;
      if (!buyRes.ok) return;
      s.gold = buyRes.state.gold;
      s.inventory = buyRes.state.inventory;
      const eqRes = equipItem(member, s.inventory, id);
      if (!eqRes.ok) {
        game.shopMessage = `Bought ${item.name}, but could not equip it: ${eqRes.message}`;
        return;
      }
      party[index] = eqRes.actor;
      s.inventory = eqRes.inv;
      game.shopMessage = `Bought and equipped ${item.name}${party.length > 1 ? ` for ${member.name || `member ${index + 1}`}` : ''}.`;
    },
    sell(game, el) {
      const id = el?.dataset?.arg;
      if (!id) return;
      const res = sellItem(game.state, id, 1);
      game.shopMessage = res.message;
      if (res.ok) {
        game.state.gold = res.state.gold;
        game.state.inventory = res.state.inventory;
      }
    },
    sellQty(game, el) {
      const id = el?.dataset?.arg;
      if (!id) return;
      if (isScarceItem(id)) {
        game.shopMessage = 'Rare drops can only be sold one at a time.';
        return;
      }
      const want = normalizeShopQty(game.shopQty);
      const have = countItem(game.state.inventory, id);
      const qty = Math.min(want, have);
      if (qty < 1) {
        game.shopMessage = 'Nothing left to sell.';
        return;
      }
      const res = sellItem(game.state, id, qty);
      game.shopMessage = res.message;
      if (res.ok) {
        game.state.gold = res.state.gold;
        game.state.inventory = res.state.inventory;
      }
    },
    sellAll(game, el) {
      const id = el?.dataset?.arg;
      if (!id) return;
      const qty = countItem(game.state.inventory, id);
      if (qty < 1) {
        game.shopMessage = 'Nothing left to sell.';
        return;
      }
      const res = sellItem(game.state, id, qty);
      game.shopMessage = res.message;
      if (res.ok) {
        game.state.gold = res.state.gold;
        game.state.inventory = res.state.inventory;
      }
    },
    selectMember(game, el) {
      const i = parseInt(el?.dataset?.arg, 10);
      const party = Array.isArray(game.state?.party) ? game.state.party : [];
      if (Number.isInteger(i) && i >= 0 && i < party.length && party[i]) game.shopMemberIndex = i;
    },
    equip(game, el) {
      const id = el?.dataset?.arg;
      if (!id) return;
      const { member, index } = activeMember(game);
      if (!member) return;
      const res = equipItem(member, game.state.inventory, id);
      game.shopMessage = res.message;
      if (res.ok) {
        game.state.party[index] = res.actor;
        game.state.inventory = res.inv;
      }
    },
    unequip(game, el) {
      const slot = el?.dataset?.arg;
      if (!slot) return;
      const { member, index } = activeMember(game);
      if (!member) return;
      const res = unequipItem(member, game.state.inventory, slot);
      game.shopMessage = res.message;
      if (res.ok) {
        game.state.party[index] = res.actor;
        game.state.inventory = res.inv;
      }
    },
    craft(game, el) {
      const recipeId = el?.dataset?.arg;
      if (!recipeId) return;
      const shop = getShop(game.shopId) || GREYHAVEN_SHOP;
      const recipe = getRecipeSafe(recipeId);
      const res = craft(game.state.inventory, recipeId);
      if (res.ok) {
        game.state.inventory = res.inv;
        const made = recipe
          ? recipe.outputs.map(({ id, qty }) => `${qty} ${(isKnownItem(id) ? getItem(id).name : id)}`).join(', ')
          : 'something';
        game.shopMessage = `${shop.name} — crafted ${made}.`;
      } else {
        game.shopMessage = res.messages.join(' ');
      }
    },
    craftAll(game, el) {
      const recipeId = el?.dataset?.arg;
      if (!recipeId) return;
      const shop = getShop(game.shopId) || GREYHAVEN_SHOP;
      const recipe = getRecipeSafe(recipeId);
      if (recipe && (recipe.inputs || []).some((input) => isScarceItem(input.id))) {
        game.shopMessage = 'Craft all is disabled for recipes that use rare drops.';
        return;
      }
      const first = craft(game.state.inventory, recipeId);
      if (!first?.ok) {
        game.shopMessage = (first?.messages || ['Crafting failed.']).join(' ');
        return;
      }
      let n = 1;
      let inv = first.inv;
      while (n < 99) {
        const res = craft(inv, recipeId);
        if (!res?.ok) break;
        inv = res.inv;
        n += 1;
      }
      game.state.inventory = inv;
      game.shopMessage = `${shop.name} — crafted ${recipe ? recipe.name : recipeId} x${n}.`;
    },
    leave(game) {
      game.setScene(game.shopReturnScene || 'town');
    },
  },
};

/** Register the shop scene (call once during boot). */
export function installShop(game) {
  game.registerScene('shop', shopScene);
}
