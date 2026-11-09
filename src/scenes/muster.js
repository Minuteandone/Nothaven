// "Watch House Muster Board": recruit or dismiss companions in Greyhaven.
import { recruitCompanion, dismissCompanion, moveActiveCompanion, isUnlocked } from '../party/companions.js';
import { renderMuster } from '../ui/muster.js';

export const musterScene = {
  onEnter(game, data = {}) {
    game.musterReturn = data.returnScene || game.musterReturn || 'town';
    game.musterMessage = '';
    game.musterTalk = null;
  },
  render(game) {
    return renderMuster(game);
  },
  actions: {
    recruit(game, el) { game.musterMessage = recruitCompanion(game.state, el?.dataset?.arg).message; },
    dismiss(game, el) { game.musterMessage = dismissCompanion(game.state, el?.dataset?.arg).message; },
    moveCompanionEarlier(game, el) {
      if (game.state?.scene !== 'muster') return;
      game.musterMessage = moveActiveCompanion(game.state, el?.dataset?.arg, 'earlier').message;
    },
    moveCompanionLater(game, el) {
      if (game.state?.scene !== 'muster') return;
      game.musterMessage = moveActiveCompanion(game.state, el?.dataset?.arg, 'later').message;
    },
    talk(game, el) {
      const id = el?.dataset?.arg;
      game.musterTalk = isUnlocked(game.state, id) ? id : null;
    },
    leave(game) {
      const target = game.scenes?.[game.musterReturn] ? game.musterReturn : 'town';
      game.setScene(target);
    },
  },
};

export function installCompanions(game) {
  game.registerScene('muster', musterScene);
}
