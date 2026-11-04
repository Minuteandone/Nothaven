// Shop scene — Hesta's Goods in Greyhaven (Beacon of Stormhaven).
// Thin UI over the pure trading logic in src/items/shop.js and the
// equipment helpers in src/items/equipment.js. All rendered strings
// are escaped; all state mutations go through the pure helpers.

import { GREYHAVEN_SHOP, getShop, shopCatalog, buyItem, sellItem } from '../items/shop.js';
import { getItem, isKnownItem, canEquip } from '../items/items.js';
import { countItem } from '../items/inventory.js';
import { equipItem, unequipItem, effectiveStats, createEquipment, statDeltaSummary } from '../items/equipment.js';
import { listRecipes, recipeInputsMet, recipeSummary, craft, recipesUsingItem } from '../items/crafting.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SLOT_LABELS = { weapon: 'Weapon', armor: 'Armor', trinket: 'Trinket' };

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
    game.shopMode = ['sell', 'craft'].includes(data?.mode) ? data.mode : 'buy';
    game.shopMessage = data?.message || '';
    game.shopReturnScene = data?.returnScene || 'town';
    game.shopMemberIndex = 0;
    game.shopId = data?.shopId && getShop(data.shopId) ? data.shopId : 'greyhaven_shop';
  },

  render(game) {
    const s = game.state;
    const hero = s.party[0];
    const shop = getShop(game.shopId) || GREYHAVEN_SHOP;
    const mode = ['sell', 'craft'].includes(game.shopMode) ? game.shopMode : 'buy';
    const gold = s.gold ?? 0;
    const { member, index, party } = activeMember(game);
    const eff = effectiveStats(member);
    const eq = member.equipment || createEquipment();

    const buyRows = shopCatalog(shop)
      .map((it) => {
        const stats = isKnownItem(it.id) ? getItem(it.id).stats : null;
        let cmpLine = '';
        if (isKnownItem(it.id) && canEquip(it.id)) {
          const curId = eq[getItem(it.id).slot];
          const curItem = curId && isKnownItem(curId) ? getItem(curId) : null;
          const delta = statDeltaSummary(curItem, getItem(it.id));
          if (delta) cmpLine = `<br><small>vs ${esc(curItem.name)}: ${esc(delta)}</small>`;
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
          <td><button data-action="buy" data-arg="${esc(it.id)}" ${gold < it.price ? 'disabled' : ''}>Buy</button></td>
        </tr>`;
      })
      .join('');

    const sellRows = sellableStacks(s.inventory)
      .map(({ stack, item }) => {
        const unit = sellPriceOf(item);
        return `<tr>
          <td><strong>${esc(item.name)}</strong> ×${stack.qty}
            ${item.stats ? `<br><small>${esc(statSummary(item.stats))}</small>` : ''}</td>
          <td style="white-space:nowrap;">${unit}g each</td>
          <td>
            <button data-action="sell" data-arg="${esc(item.id)}">Sell 1</button>
            ${stack.qty > 1 ? `<button data-action="sellAll" data-arg="${esc(item.id)}">Sell all (${unit * stack.qty}g)</button>` : ''}
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


    const craftRows = listRecipes()
      .map((recipe) => {
        const { ok: met, missing } = recipeInputsMet(s.inventory, recipe);
        const checklist = recipe.inputs
          .map(({ id, qty }) => {
            const have = Math.min(qty, countItem(s.inventory, id));
            const it = isKnownItem(id) ? getItem(id) : null;
            const label = it ? it.name : id;
            return `<li class="${have >= qty ? 'have' : 'need'}">${esc(label)} ×${qty} <small>(have ${have})</small></li>`;
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
          <td><button data-action="craft" data-arg="${esc(recipe.id)}" ${met ? '' : 'disabled'}>Craft</button></td>
        </tr>`;
      })
      .join('');

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
        <p>${esc(game.shopMessage || '')}</p>
        <div class="shop-tabs">
          <button class="shop-tab${mode === 'buy' ? ' shop-tab--active' : ''}" data-action="setMode" data-arg="buy" ${mode === 'buy' ? 'aria-current="true"' : ''}>Buy</button>
          <button class="shop-tab${mode === 'sell' ? ' shop-tab--active' : ''}" data-action="setMode" data-arg="sell" ${mode === 'sell' ? 'aria-current="true"' : ''}>Sell</button>
          <button class="shop-tab${mode === 'craft' ? ' shop-tab--active' : ''}" data-action="setMode" data-arg="craft" ${mode === 'craft' ? 'aria-current="true"' : ''}>Craft</button>
        </div>
        ${
          mode === 'buy'
            ? `<table>${buyRows}</table>`
            : mode === 'sell'
              ? sellRows
                ? `<table class="shop-sell" aria-label="Items available to sell">${sellRows}</table>`
                : '<p>You carry nothing Hesta would pay for.</p>'
              : `<table class="craft-table">${craftRows}</table>`
        }
        <h3>Wardrobe${party.length > 1 ? ` — ${esc(member.name)}` : ''}</h3>
        ${
          party.length > 1
            ? `<div>${party
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
      game.shopMode = ['sell', 'craft'].includes(arg) ? arg : 'buy';
    },
    buy(game, el) {
      const id = el?.dataset?.arg;
      if (!id) return;
      const shop = getShop(game.shopId) || GREYHAVEN_SHOP;
      const res = buyItem(game.state, shop, id, 1);
      game.shopMessage = res.message;
      if (res.ok) {
        game.state.gold = res.state.gold;
        game.state.inventory = res.state.inventory;
      }
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
    leave(game) {
      game.setScene(game.shopReturnScene || 'town');
    },
  },
};

/** Register the shop scene (call once during boot). */
export function installShop(game) {
  game.registerScene('shop', shopScene);
}
