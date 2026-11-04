// Sparring Drills: Warden Mara restages boss battles the party has already won.
// Drills grant half the foe's experience only — no gold, no spoils, no story or
// bestiary changes — and a lost drill costs nothing but pride.
import { escapeHTML, sceneHeader, uiButton } from '../ui/components.js';
import { ENEMIES } from '../data/enemies.js';

export const DRILL_FOES = Object.freeze(Object.keys(ENEMIES).filter((id) => ENEMIES[id]?.boss === true));

export function drillXp(id) {
  return Math.floor((Number(ENEMIES[id]?.xp) || 0) / 2);
}

export function drillUnlocked(state, id) {
  if (!DRILL_FOES.includes(id)) return false;
  const n = state?.bestiary?.[id];
  return Number.isInteger(n) && n >= 1;
}

export function drillEntries(state) {
  return DRILL_FOES.map((id) => ({ id, name: ENEMIES[id].name, xp: drillXp(id), unlocked: drillUnlocked(state, id) }));
}

export const drillsScene = {
  onEnter(game, data = {}) {
    game.drillsMessage = typeof data.message === 'string' ? data.message : '';
  },
  render(game) {
    const rows = drillEntries(game.state).map((r) => `<li class="drill${r.unlocked ? '' : ' drill--locked'}">
        <div><h2>${escapeHTML(r.name)}</h2><p>${r.unlocked ? `+${r.xp} XP per drill` : 'Defeat this foe in the field first.'}</p></div>
        ${r.unlocked ? uiButton({ action: 'startDrill', arg: r.id, label: 'Begin drill', iconName: 'sword', variant: 'ghost' }) : ''}
      </li>`).join('');
    const msg = game.drillsMessage ? `<p class="drills__message" role="status">${escapeHTML(game.drillsMessage)}</p>` : '';
    return `<main class="game-shell drills">
      ${sceneHeader({ eyebrow: 'Watch House yard', title: 'Sparring Drills', subtitle: 'Practice against foes you have already beaten.', iconName: 'beacon' })}
      <section class="panel" aria-label="Drill roster">
        ${msg}
        <p class="drills__intro">Warden Mara restages battles you have already won, with straw targets and signal flags standing in for the real foe. Drills grant half the usual experience and nothing else — no gold, no spoils — and a lost drill costs nothing but pride.</p>
        <ul class="drills__list">${rows}</ul>
      </section>
      <div class="title-actions">${uiButton({ action: 'closeDrills', label: 'Back to Greyhaven', iconName: 'compass', variant: 'primary' })}</div>
    </main>`;
  },
  actions: {
    startDrill(game, el) {
      const id = el?.dataset?.arg;
      if (!drillUnlocked(game.state, id)) { game.drillsMessage = 'That drill is not ready yet.'; return; }
      game.setScene('combat', { enemyId: id, encounterId: null, returnScene: 'drills', drill: true });
    },
    closeDrills(game) { game.setScene('town'); },
  },
};

export function installDrills(game) {
  game.registerScene('drills', drillsScene);
}
