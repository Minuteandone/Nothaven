import { escapeHTML, sceneHeader, uiButton } from '../ui/components.js';
import { getItem } from '../items/items.js';
import { countItem } from '../items/inventory.js';
import {
  FITTING_SLOTS, MAX_FITTING, SLOT_LABELS, costText, fittingCheck, fittingEffectText, fittingLevel, nextFittingCost, applyFitting,
} from '../items/forge.js';

function itemName(id) {
  try { return getItem(id).name; } catch { return id; }
}

function slotRow(state, member, slot) {
  const equipped = member.equipment?.[slot] || null;
  const level = fittingLevel(member, slot);
  const cost = nextFittingCost(member, slot);
  const check = fittingCheck(state, member.id, slot);
  const inv = Array.isArray(state.inventory) ? state.inventory : [];
  const have = cost ? cost.items.map(({ id, qty }) => `${itemName(id)} ${Math.min(countItem(inv, id), 99)}/${qty}`).join(' · ') : '';
  const arg = `${member.id}:${slot}`;
  return `<li class="forge__slot">
      <div>
        <h3>${SLOT_LABELS[slot]} fitting +${level} <span class="forge__max">of ${MAX_FITTING}</span></h3>
        <p>${equipped ? `Fitted to: ${escapeHTML(itemName(equipped))}` : 'Nothing equipped here, so this fitting is resting.'} · ${escapeHTML(fittingEffectText(slot, level))}</p>
        ${cost ? `<p class="forge__cost">Next: +${level + 1} (${escapeHTML(fittingEffectText(slot, level + 1))}) for ${escapeHTML(costText(cost))}</p><p class="forge__have">You have: ${escapeHTML(have)}</p>` : '<p class="forge__cost">Fully fitted.</p>'}
        ${cost && !check.ok ? `<p class="forge__reason">${escapeHTML(check.reason)}</p>` : ''}
      </div>
      ${cost ? uiButton({ action: 'fit', arg, label: `Fit +${level + 1}`, iconName: 'sword', variant: 'ghost', disabled: !check.ok }) : ''}
    </li>`;
}

export const forgeScene = {
  onEnter(game, data = {}) {
    game.forgeMessage = typeof data.message === 'string' ? data.message : '';
    game.forgeReturn = typeof data.returnScene === 'string' ? data.returnScene : (game.forgeReturn || 'town');
  },
  render(game) {
    const s = game.state;
    const party = Array.isArray(s.party) ? s.party.filter(Boolean) : [];
    const members = party.map((m) => `<li class="panel forge__member" aria-labelledby="forge-${escapeHTML(m.id)}">
        <h2 id="forge-${escapeHTML(m.id)}">${escapeHTML(m.name)}</h2>
        <ul class="forge__slots">${FITTING_SLOTS.map((slot) => slotRow(s, m, slot)).join('')}</ul>
      </li>`).join('');
    const msg = game.forgeMessage ? `<p class="forge__message" role="status">${escapeHTML(game.forgeMessage)}</p>` : '';
    return `<main class="game-shell forge">
      ${sceneHeader({ eyebrow: 'Behind Hesta’s Goods', title: 'Greyhaven Forge', subtitle: 'Fit weapons and armour with salvage from the road.', iconName: 'shield' })}
      <section class="panel" aria-label="How fittings work">
        ${msg}
        <p class="forge__intro">Hesta keeps a forge behind her counter. She rivets reinforced grips onto blades and stitches plates into armour linings. Each fitting belongs to the wearer’s slot, so it moves with them when they change gear, and it only helps while something is equipped there. Gold: ${Number(s.gold) || 0}.</p>
      </section>
      <ul class="forge__members">${members}</ul>
      <div class="title-actions">${uiButton({ action: 'closeForge', label: 'Back to Greyhaven', iconName: 'compass', variant: 'primary' })}</div>
    </main>`;
  },
  actions: {
    fit(game, el) {
      const [memberId, slot] = String(el?.dataset?.arg || '').split(':');
      const result = applyFitting(game.state, memberId, slot);
      game.forgeMessage = result.message;
    },
    closeForge(game) { game.setScene(game.forgeReturn || 'town'); },
  },
};

export function installForge(game) {
  game.registerScene('forge', forgeScene);
}
