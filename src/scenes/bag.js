// Bag scene — full inventory screen for Beacon of Stormhaven.
// Thin UI over the pure item helpers in src/items/. Mirrors the shop
// scene's rules: every rendered string is escaped, every mutation goes
// through the pure helpers, and results are written back to state.

import { getItem, isKnownItem, canEquip, TYPES, SLOTS } from '../items/items.js';
import { equipItem, unequipItem, effectiveStats, createEquipment, statDeltaSummary } from '../items/equipment.js';
import { useConsumable } from '../items/consumables.js';
import { recipesUsingItem, listRecipes, recipeInputsMet, recipeSummary, craft as craftRecipe } from '../items/crafting.js';
import { countItem } from '../items/inventory.js';
import { craftInField } from '../map/mapState.js';
import { sellValueOf, shopsStocking, isScarceItem } from '../items/shop.js';
import { FITTING_SLOTS, MAX_FITTING, fittingLevel, fittingEffectText } from '../items/forge.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const SLOT_LABELS = { weapon: 'Weapon', armor: 'Armor', trinket: 'Trinket' };

const TYPE_ORDER = [TYPES.CONSUMABLE, TYPES.EQUIPMENT, TYPES.MATERIAL, TYPES.KEY];
const TYPE_TITLES = {
  [TYPES.CONSUMABLE]: 'Consumables',
  [TYPES.EQUIPMENT]: 'Gear',
  [TYPES.MATERIAL]: 'Materials',
  [TYPES.KEY]: 'Key items',
};

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

/** Forge fitting badge for an equipped weapon/armour slot (empty when unfitted). */
function fittingNote(member, slot) {
  if (!FITTING_SLOTS.includes(slot)) return '';
  const level = fittingLevel(member, slot);
  if (level <= 0) return '';
  return ` <span class="bag-fitting" data-fitting-level="${level}">Fitting +${level} of ${MAX_FITTING} · ${esc(fittingEffectText(slot, level))}</span>`;
}

/** Active party member for bag operations, clamped into range (hero default). */
function activeMember(game) {
  const party = game.state?.party || [];
  let index = Number.isInteger(game.bagMemberIndex) ? game.bagMemberIndex : 0;
  if (index < 0 || index >= party.length) index = 0;
  const member = party[index] || party[0] || null;
  if (member && !member.equipment) member.equipment = createEquipment();
  return { member, index, party };
}

function memberTabs(party, index) {
  if (party.length <= 1) return '';
  const tabs = party
    .map((m, i) =>
      `<button data-action="selectMember" data-arg="${i}"${i === index ? ' disabled' : ''}>${esc(m.name || `Member ${i + 1}`)}${m.companion ? ' (ally)' : ''}</button>`)
    .join('');
  return `<div class="bag-members" role="group" aria-label="Choose whose bag to use">${tabs}</div>`;
}


/** "Used in:" hint listing the recipes that consume this item (max 2 + more). */
function craftHint(itemId) {
  const uses = recipesUsingItem(itemId);
  if (!uses.length) return '';
  const names = uses.slice(0, 2).map((r) => r.name);
  const rest = uses.length - names.length;
  return 'Used in: ' + names.join(' · ') + (rest > 0 ? ` (+${rest} more)` : '');
}

function bagRow(item, stack, member) {
  const sum = statSummary(item.stats);
  let controls = '';
  if (item.type === TYPES.CONSUMABLE) {
    controls = `<button data-action="use" data-arg="${esc(item.id)}">Use</button>`;
  } else if (item.type === TYPES.EQUIPMENT && canEquip(item.id)) {
    const equippedHere = member?.equipment?.[item.slot] === item.id;
    let delta = '';
    if (!equippedHere) {
      const curId = member?.equipment?.[item.slot];
      const curItem = curId && isKnownItem(curId) ? getItem(curId) : null;
      delta = statDeltaSummary(curItem, item);
    }
    controls =
      `<button data-action="equip" data-arg="${esc(item.id)}">Equip</button>` +
      (delta ? ` <small>${esc(delta)}</small>` : '') +
      (equippedHere ? ` <button data-action="unequip" data-arg="${esc(item.slot)}">Unequip ${SLOT_LABELS[item.slot] || esc(item.slot)}</button>` : '');
  }
  return (
    `<li class="bag-row">` +
    `<span class="bag-name">${esc(item.name)} ×${stack.qty}</span>` +
    (item.description ? ` <span class="bag-desc">${esc(item.description)}</span>` : '') +
    (sum ? ` <span class="bag-stats">${esc(sum)}</span>` : '') +
    (craftHint(item.id) ? ` <span class="bag-craft">${esc(craftHint(item.id))}</span>` : '') +
    (item.type !== TYPES.KEY && sellValueOf(item) > 0
      ? ` <span class="bag-worth">Sell value: ${sellValueOf(item) * stack.qty}g</span>` : '') +
    (controls ? `<span class="bag-controls">${controls}</span>` : '') +
    `</li>`
  );
}

/** Crafting section: every recipe with a have/need checklist and a craft button. */
function craftSection(inv) {
  const rows = listRecipes().map((recipe) => {
    const check = recipeInputsMet(inv, recipe);
    const usesScarce = (recipe.inputs || []).some((input) => isScarceItem(input.id));
    const checklist = (recipe.inputs || []).map((input) => {
      const have = countItem(inv, input.id);
      const label = isKnownItem(input.id) ? getItem(input.id).name : input.id;
      const sources = shopsStocking(input.id);
      const sourceHint = sources.length ? ` <small class="craft-source">at ${esc(sources.join(' · '))}</small>` : '';
      const scarceHint = isScarceItem(input.id) ? ' <small class="craft-scarce">rare drop</small>' : '';
      return `<li class="${have >= input.qty ? 'have' : 'need'}">${esc(label)} ×${input.qty} <small>(have ${have})</small>${sourceHint}${scarceHint}</li>`;
    }).join('');
    const outputs = (recipe.outputs || []).map((out) => {
      const item = isKnownItem(out.id) ? getItem(out.id) : null;
      const sum = item ? statSummary(item.stats) : '';
      return `${esc(item?.name ?? out.id)} ×${out.qty}${sum ? ` <small>(${esc(sum)})</small>` : ''}`;
    }).join(', ');
    return (
      `<tr>` +
      `<td><strong>${esc(recipe.name)}</strong>` +
      (recipe.description ? `<br><small>${esc(recipe.description)}</small>` : '') +
      `<br><small>Needs: ${esc(recipeSummary(recipe))}</small></td>` +
      `<td><ul class="craft-checklist">${checklist}</ul></td>` +
      `<td><strong>${outputs}</strong></td>` +
      `<td><button data-action="craft" data-arg="${esc(recipe.id)}"${check.ok ? '' : ' disabled'}>Craft</button>` +
      (usesScarce ? '' : ` <button data-action="craftAll" data-arg="${esc(recipe.id)}"${check.ok ? '' : ' disabled'}>Craft all</button>`) +
      `</td>` +
      `</tr>`
    );
  }).join('');
  return `<section class="bag-group" aria-label="Crafting"><h3>Crafting</h3><table class="craft-table">${rows}</table></section>`;
}

export const bagScene = {
  onEnter(game, data = {}) {
    game.bagReturnScene = data.returnScene ?? 'town';
    game.bagMemberIndex = 0;
    game.bagMessage = data.message ?? '';
  },

  render(game) {
    const s = game.state || {};
    const { member, index, party } = activeMember(game);
    const eff = member ? effectiveStats(member) : null;
    const statsLine = member && eff
      ? `HP ${member.hp ?? 0}/${eff.maxHp} · MP ${member.mp ?? 0}/${eff.maxMp} · ATK ${eff.atk} · DEF ${eff.def} · SPD ${eff.spd}`
      : '';

    const equippedRows = member
      ? SLOTS.map((slot) => {
          const id = member.equipment?.[slot];
          if (!id) return '';
          const item = isKnownItem(id) ? getItem(id) : null;
          const label = SLOT_LABELS[slot] || slot;
          return (
            `<li class="bag-row">` +
            `<span class="bag-name">${esc(item?.name ?? id)}</span>` +
            ` <span class="bag-desc">${esc(label)}</span>` +
            fittingNote(member, slot) +
            ` <span class="bag-controls"><button data-action="unequip" data-arg="${esc(slot)}">Unequip ${esc(label)}</button></span>` +
            `</li>`
          );
        }).join('')
      : '';
    const equippedSection = equippedRows
      ? `<section class="bag-group" aria-label="Equipped"><h3>Equipped</h3><ul class="bag-list">${equippedRows}</ul></section>`
      : '';

    const sections = TYPE_ORDER.map((type) => {
      const stacks = (s.inventory || []).filter(
        (st) => isKnownItem(st.id) && getItem(st.id).type === type,
      );
      if (!stacks.length) return '';
      const rows = stacks.map((st) => bagRow(getItem(st.id), st, member)).join('');
      return `<section class="bag-group" aria-label="${TYPE_TITLES[type]}"><h3>${TYPE_TITLES[type]}</h3><ul class="bag-list">${rows}</ul></section>`;
    }).join('');

    return `<main class="game-shell bag-screen">
      <h2>Bag</h2>
      <p class="bag-gold">Gold: ${esc(s.gold ?? 0)}</p>
      ${memberTabs(party, index)}
      ${member ? `<p class="bag-member-stats">${esc(member.name)} — ${esc(statsLine)}</p>` : ''}
      ${game.bagMessage ? `<p class="bag-message" role="status">${esc(game.bagMessage)}</p>` : ''}
      ${equippedSection}
      ${sections || '<p class="bag-empty">Your bag is empty.</p>'}
      ${craftSection(s.inventory)}
      <div class="actions"><button data-action="recipes">Recipe book</button><button data-action="leave">Back</button></div>
    </main>`;
  },

  actions: {
    selectMember(game, el) {
      const n = Number.parseInt(el?.dataset?.arg, 10);
      if (Number.isInteger(n)) game.bagMemberIndex = n;
    },

    use(game, el) {
      const id = el?.dataset?.arg;
      if (!id || !isKnownItem(id)) { game.bagMessage = 'Unknown item.'; return; }
      const { member, index } = activeMember(game);
      if (!member) return;
      const res = useConsumable(member, game.state.inventory, id);
      game.bagMessage = res.ok ? `${res.actor.name} — ${res.message}` : res.message;
      if (res.ok) {
        game.state.party[index] = res.actor;
        game.state.inventory = res.inv;
      }
    },

    equip(game, el) {
      const id = el?.dataset?.arg;
      if (!id || !isKnownItem(id)) { game.bagMessage = 'Unknown item.'; return; }
      const { member, index } = activeMember(game);
      if (!member) return;
      const res = equipItem(member, game.state.inventory, id);
      game.bagMessage = res.message || '';
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
      game.bagMessage = res.message || '';
      if (res.ok) {
        game.state.party[index] = res.actor;
        game.state.inventory = res.inv;
      }
    },

    craft(game, el) {
      const recipeId = el?.dataset?.arg;
      if (!recipeId) return;
      const res = craftInField(game.state, recipeId);
      game.bagMessage = res?.log?.[0] || (res?.ok ? 'Crafted.' : 'Crafting failed.');
    },

    craftAll(game, el) {
      const recipeId = el?.dataset?.arg;
      if (!recipeId) return;
      const recipe = listRecipes().find((r) => r.id === recipeId);
      if (recipe && (recipe.inputs || []).some((input) => isScarceItem(input.id))) {
        game.bagMessage = 'Craft all is disabled for recipes that use rare drops.';
        return;
      }
      const first = craftInField(game.state, recipeId);
      if (!first?.ok) {
        game.bagMessage = first?.log?.[0] || 'Crafting failed.';
        return;
      }
      let n = 1;
      let inv = game.state.inventory;
      while (n < 99) {
        const res = craftRecipe(inv, recipeId);
        if (!res?.ok) break;
        inv = res.inv;
        n += 1;
      }
      game.state.inventory = inv;
      game.bagMessage = `Crafted: ${recipe ? recipe.name : recipeId} x${n}.`;
    },

    recipes(game) { game.setScene('recipes', { returnScene: 'bag' }); },

    leave(game) {
      game.setScene(game.bagReturnScene || 'town');
    },
  },
};

/** Register the bag scene (call once during boot). */
export function installBag(game) {
  game.registerScene('bag', bagScene);
}
