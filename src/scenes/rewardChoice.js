// Victory spoils scene — a one-time pick-one-of-three offer after certain
// hard-fought victories. The combat Finish action routes here when
// pendingRewardChoice finds an unclaimed pool; claiming or leaving returns
// the player to the scene the battle was fought in. Thin UI over the pure
// helpers in src/items/rewardChoice.js; all rendered strings are escaped.

import { getItem } from '../items/items.js';
import { claimRewardChoice, rewardChoicePool } from '../items/rewardChoice.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

function returnTarget(game) {
  const wanted = typeof game.rewardChoiceReturn === 'string' ? game.rewardChoiceReturn : 'town';
  return game.scenes?.[wanted] ? wanted : 'town';
}

const rewardChoiceScene = {
  onEnter(game, data) {
    game.rewardChoiceEncounterId = typeof data?.encounterId === 'string' ? data.encounterId : null;
    game.rewardChoiceReturn = typeof data?.returnScene === 'string' ? data.returnScene : 'town';
    game.rewardChoiceMessage = typeof data?.message === 'string' ? data.message : '';
    game.rewardChoiceCombatResult = typeof data?.combatResult === 'string' ? data.combatResult : 'victory';
    delete game.rewardChoiceNote;
  },

  render(game) {
    const pool = rewardChoicePool(game.state, game.rewardChoiceEncounterId);
    const parts = ['<div class="panel">', '<h2>Victory spoils</h2>'];
    if (game.rewardChoiceMessage) parts.push(`<p>${esc(game.rewardChoiceMessage)}</p>`);
    if (game.rewardChoiceNote) parts.push(`<p role="status">${esc(game.rewardChoiceNote)}</p>`);
    if (!pool) {
      // Defensive: unknown encounter or already claimed — never dead-end.
      parts.push('<p>The spoils have already been settled.</p>');
      parts.push('<button data-action="skip">Continue</button>');
      parts.push('</div>');
      return parts.join('');
    }
    parts.push('<p>You found more than the usual haul. Take one bundle, or leave them and continue on your way.</p>');
    parts.push('<div class="reward-options">');
    pool.options.forEach((option, index) => {
      const item = getItem(option.itemId);
      const qty = option.qty === 1 ? '' : ` ×${option.qty}`;
      parts.push(`<button class="reward-option" data-action="choose" data-arg="${index}">Take ${esc(item.name)}${esc(qty)}</button>`);
    });
    parts.push('</div>');
    parts.push('<button data-action="skip">Leave them</button>');
    parts.push('</div>');
    return parts.join('');
  },

  actions: {
    choose(game, el) {
      const res = claimRewardChoice(game.state, game.rewardChoiceEncounterId, el?.dataset?.arg);
      if (!res.ok) {
        game.rewardChoiceNote = res.message;
        return;
      }
      game.setScene(returnTarget(game), { message: res.message, encounterId: game.rewardChoiceEncounterId, combatResult: game.rewardChoiceCombatResult });
    },

    skip(game) {
      game.setScene(returnTarget(game), { message: game.rewardChoiceMessage || 'You continue on your way.', encounterId: game.rewardChoiceEncounterId, combatResult: game.rewardChoiceCombatResult });
    },
  },
};

export function installRewardChoice(game) {
  game.registerScene('rewardChoice', rewardChoiceScene);
}
