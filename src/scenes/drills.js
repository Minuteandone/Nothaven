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

// Drill records live in state.drillRecords[id] = {wins, best}; best is the
// fewest rounds a drill was won in. Malformed values read as no record.
const posInt = (n) => (Number.isInteger(n) && n > 0 ? n : 0);

export function drillRecord(state, id) {
  const raw = state?.drillRecords && typeof state.drillRecords === 'object' ? state.drillRecords[id] : null;
  const wins = posInt(raw?.wins);
  const best = posInt(raw?.best);
  return wins ? { wins, best } : { wins: 0, best: 0 };
}

export function recordDrillWin(state, id, rounds) {
  if (!state || !DRILL_FOES.includes(id)) return null;
  if (!state.drillRecords || typeof state.drillRecords !== 'object' || Array.isArray(state.drillRecords)) state.drillRecords = {};
  const prev = drillRecord(state, id);
  const r = posInt(Math.floor(Number(rounds))) || 1;
  const next = { wins: prev.wins + 1, best: prev.best ? Math.min(prev.best, r) : r };
  state.drillRecords[id] = next;
  return { ...next, newBest: !prev.best || r < prev.best };
}

export function drillEntries(state) {
  return DRILL_FOES.map((id) => ({ id, name: ENEMIES[id].name, xp: drillXp(id), unlocked: drillUnlocked(state, id), record: drillRecord(state, id) }));
}

function recordText(rec) {
  if (!rec.wins) return 'No drills won yet.';
  return `Won ${rec.wins} ${rec.wins === 1 ? 'time' : 'times'} · best ${rec.best} ${rec.best === 1 ? 'round' : 'rounds'}`;
}

export const drillsScene = {
  onEnter(game, data = {}) {
    game.drillsMessage = typeof data.message === 'string' ? data.message : '';
  },
  render(game) {
    const rows = drillEntries(game.state).map((r) => `<li class="drill${r.unlocked ? '' : ' drill--locked'}">
        <div><h2>${escapeHTML(r.name)}</h2><p>${r.unlocked ? `+${r.xp} XP per drill` : 'Defeat this foe in the field first.'}</p>${r.unlocked ? `<p class="drill__record">${escapeHTML(recordText(r.record))}</p>` : ''}</div>
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
