// "Warden's Field Journal": a bestiary of every foe the party has defeated.
// installBestiary(game) records victories (state.bestiary[enemyId] = count)
// from the combat:victory event and registers the 'bestiary' scene.
import { ENEMIES } from '../data/enemies.js';
import { BESTIARY_COMPARISON_LIMIT, bestiaryComparisonIds, renderBestiary } from '../ui/bestiary.js';

const own = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);

export function recordDefeat(state, enemyId) {
  if (!state || typeof enemyId !== 'string' || !own(ENEMIES, enemyId)) return false;
  if (!state.bestiary || typeof state.bestiary !== 'object' || Array.isArray(state.bestiary)) state.bestiary = {};
  const prev = Number.isInteger(state.bestiary[enemyId]) && state.bestiary[enemyId] > 0 ? state.bestiary[enemyId] : 0;
  state.bestiary[enemyId] = prev + 1;
  return true;
}

export function bestiaryEntries(state) {
  const book = state?.bestiary && typeof state.bestiary === 'object' ? state.bestiary : {};
  return Object.keys(ENEMIES).map((id) => ({ enemy: ENEMIES[id], count: own(book, id) && Number.isInteger(book[id]) ? book[id] : 0 }));
}

function currentComparison(game) {
  return bestiaryComparisonIds(bestiaryEntries(game.state), game.bestiaryComparison);
}

export const bestiaryScene = {
  onEnter(game, data = {}) {
    game.bestiaryReturn = data.returnScene || game.bestiaryReturn || 'town';
  },
  render(game) {
    return renderBestiary({ entries: bestiaryEntries(game.state), returnScene: game.bestiaryReturn || 'town', compareIds: game.bestiaryComparison });
  },
  actions: {
    compareFoe(game, el) {
      const current = currentComparison(game);
      if (current.length >= BESTIARY_COMPARISON_LIMIT || current.includes(el?.dataset?.arg)) {
        game.bestiaryComparison = current;
        return;
      }
      game.bestiaryComparison = bestiaryComparisonIds(bestiaryEntries(game.state), [...current, el?.dataset?.arg]);
    },
    removeComparedFoe(game, el) {
      game.bestiaryComparison = currentComparison(game).filter(id => id !== el?.dataset?.arg);
    },
    clearComparison(game) { game.bestiaryComparison = []; },
    leave(game) { game.setScene(game.bestiaryReturn || 'town'); },
  },
};

export function installBestiary(game) {
  game.registerScene('bestiary', bestiaryScene);
  const handler = (ev) => { if (ev && game.state) recordDefeat(game.state, ev.enemyId); };
  game.bus.on('combat:victory', handler);
  return () => game.bus.off('combat:victory', handler);
}
