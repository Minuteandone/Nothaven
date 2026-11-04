// Shop scene — Hesta's Goods in Greyhaven (Beacon of Stormhaven).
// Thin UI over the pure trading logic in src/items/shop.js and the
// equipment helpers in src/items/equipment.js. All rendered strings
// are escaped; all state mutations go through the pure helpers.

import { GREYHAVEN_SHOP, shopCatalog, buyItem, sellItem } from '../items/shop.js';
import { getItem, isKnownItem, canEquip } from '../items/items.js';
import { countItem } from '../items/inventory.js';
import { equipItem, unequipItem, effectiveStats, createEquipment } from '../items/equipment.js';

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

export const shopScene = {
  onEnter(game, data) {
    game.shopMode = data?.mode === 'sell' ? 'sell' : 'buy';
    game.shopMessage = data?.message || '';
    game.shopReturnScene = data?.returnScene || 'town';
  },

  render(game) {
    const s = game.state;
    const hero = s.party[0];
    const shop = GREYHAVEN_SHOP;
    const mode = game.shopMode === 'sell' ? 'sell' : 'buy';
    const gold = s.gold ?? 0;
    const eff = effectiveStats(hero);
    const eq = hero.equipment || createEquipment();

    const buyRows = shopCatalog(shop)
      .map((it) => {
        const stats = isKnownItem(it.id) ? getItem(it.id).stats : null;
        return `<tr>
          <td><strong>${esc(it.name)}</strong><br>
            <small>${esc(it.description)}</small><br>
            <small>${esc(typeLabel(it.type))}${stats ? ' · ' + esc(statSummary(stats)) : ''}</small></td>
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
            return `<button data-action="equip" data-arg="${esc(it.id)}">Equip ${esc(it.name)}</button>`;
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
        <div>
          <button data-action="setMode" data-arg="buy" ${mode === 'buy' ? 'disabled' : ''}>Buy</button>
          <button data-action="setMode" data-arg="sell" ${mode === 'sell' ? 'disabled' : ''}>Sell</button>
        </div>
        ${
          mode === 'buy'
            ? `<table>${buyRows}</table>`
            : sellRows
              ? `<table>${sellRows}</table>`
              : '<p>You carry nothing Hesta would pay for.</p>'
        }
        <h3>Wardrobe</h3>
        <table>${gearRows}</table>
        <div style="margin-top:0.5rem;">
          <button data-action="leave">Back to ${game.shopReturnScene === 'explore' ? 'the streets' : 'town square'}</button>
        </div>
      </div>`;
  },

  actions: {
    setMode(game, el) {
      game.shopMode = el?.dataset?.arg === 'sell' ? 'sell' : 'buy';
    },
    buy(game, el) {
      const id = el?.dataset?.arg;
      if (!id) return;
      const res = buyItem(game.state, GREYHAVEN_SHOP, id, 1);
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
    equip(game, el) {
      const id = el?.dataset?.arg;
      if (!id) return;
      const res = equipItem(game.state.party[0], game.state.inventory, id);
      game.shopMessage = res.message;
      if (res.ok) {
        game.state.party[0] = res.actor;
        game.state.inventory = res.inv;
      }
    },
    unequip(game, el) {
      const slot = el?.dataset?.arg;
      if (!slot) return;
      const res = unequipItem(game.state.party[0], game.state.inventory, slot);
      game.shopMessage = res.message;
      if (res.ok) {
        game.state.party[0] = res.actor;
        game.state.inventory = res.inv;
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
