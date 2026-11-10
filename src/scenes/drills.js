// Sparring Drills: Warden Mara restages boss battles the party has already won.
// Drills grant half the foe's experience only — no gold, no spoils, no story or
// bestiary changes — and a lost drill costs nothing but pride.
import { escapeHTML, sceneHeader, uiButton } from '../ui/components.js';
import { ENEMIES } from '../data/enemies.js';
import { elementLabel, elementMatchups } from '../combat/elements.js';
import { DIFFICULTIES, getDifficulty, scaleEnemy } from '../combat/difficulty.js';

export const DRILL_FOES = Object.freeze(Object.keys(ENEMIES).filter((id) => ENEMIES[id]?.boss === true && ENEMIES[id]?.drill !== false));

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

// Yard Gauntlet: every unlocked drill back to back. HP and MP carry over
// between bouts; state.drillGauntlet = {runs, best} where best is the most
// foes beaten in a single run.
export const GAUNTLET_MIN = 3;

export function gauntletQueue(state) {
  return DRILL_FOES.filter((id) => drillUnlocked(state, id));
}

export function gauntletReady(state) {
  return gauntletQueue(state).length >= GAUNTLET_MIN;
}

export function gauntletRecord(state) {
  const raw = state?.drillGauntlet && typeof state.drillGauntlet === 'object' ? state.drillGauntlet : null;
  const runs = posInt(raw?.runs);
  return runs ? { runs, best: Number.isInteger(raw?.best) && raw.best > 0 ? raw.best : 0 } : { runs: 0, best: 0 };
}

export function recordGauntlet(state, beaten) {
  if (!state) return null;
  const prev = gauntletRecord(state);
  const n = Number.isInteger(beaten) && beaten > 0 ? beaten : 0;
  const next = { runs: prev.runs + 1, best: Math.max(prev.best, n) };
  state.drillGauntlet = next;
  return { ...next, newBest: n > prev.best };
}

// In-battle record line for drills: what the current bout is competing for.
// Gauntlet bouts report the run so far against the best run; single drills
// report the foe's drill record. Null outside drills or for malformed input.
export function drillCombatText(state, combat) {
  if (!combat || combat.drill !== true) return null;
  const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;
  const g = combat.gauntlet;
  if (g && Array.isArray(g.queue) && g.queue.length && Number.isInteger(g.index) && g.index >= 0 && g.index < g.queue.length) {
    const bout = g.index + 1;
    const best = gauntletRecord(state).best;
    const head = `Yard Gauntlet bout ${bout} of ${g.queue.length} · best run: ${plural(best, 'foe', 'foes')} beaten.`;
    if (bout > best) return `${head} Winning this bout sets a new best run.`;
    if (best >= g.queue.length) return `${head} Your best run already clears every bout.`;
    const need = best - bout + 2;
    return `${head} Win ${plural(need, 'more bout', 'more bouts')} to set a new best run.`;
  }
  const id = combat.enemy?.id;
  if (typeof id !== 'string' || !DRILL_FOES.includes(id)) return null;
  const rec = drillRecord(state, id);
  if (!rec.wins) return 'No drill win yet against this foe — winning sets your first record.';
  const wins = plural(rec.wins, 'win', 'wins');
  if (!rec.best) return `${wins}, no best time yet — winning records one.`;
  if (rec.best === 1) return `Best: 1 round over ${wins} — the fastest possible.`;
  return `Best: ${plural(rec.best, 'round', 'rounds')} over ${wins} — win in fewer than ${rec.best} rounds to set a new record.`;
}

export function validGauntlet(g, enemyId) {
  if (!g || !Array.isArray(g.queue) || !g.queue.length) return false;
  if (!g.queue.every((id) => DRILL_FOES.includes(id))) return false;
  return Number.isInteger(g.index) && g.index >= 0 && g.index < g.queue.length && g.queue[g.index] === enemyId;
}

export function drillEntries(state) {
  return DRILL_FOES.map((id) => ({ id, name: ENEMIES[id].name, xp: drillXp(id), unlocked: drillUnlocked(state, id), record: drillRecord(state, id) }));
}

// One-line roster tally: drills unlocked, distinct foes bested in drills,
// and total drill victories. Malformed records count as no wins.
export function drillsSummaryText(state) {
  const entries = drillEntries(state);
  const unlocked = entries.filter((r) => r.unlocked).length;
  const bested = entries.filter((r) => r.record.wins > 0).length;
  const wins = entries.reduce((sum, r) => sum + r.record.wins, 0);
  return `Drills unlocked: ${unlocked} of ${entries.length} · Foes bested in drills: ${bested} · Drill victories: ${wins}`;
}

// Next-target hint: names the first unlocked drill not yet won, or once every
// unlocked drill is won, the one with the slowest best (most rounds).
// Records without a valid best time are skipped for that comparison.
// Returns null when no drill is unlocked.
export function drillsNextText(state) {
  const open = drillEntries(state).filter((r) => r.unlocked);
  if (!open.length) return null;
  const fresh = open.filter((r) => !r.record.wins);
  if (fresh.length) {
    const more = fresh.length - 1;
    return `Next drill to try: ${fresh[0].name}${more ? ` (and ${more} more not yet won)` : ''}.`;
  }
  const timed = open.filter((r) => r.record.best > 0);
  if (!timed.length) return 'Every unlocked drill won. Win any drill again to record a best time.';
  const slow = timed.reduce((a, r) => (r.record.best > a.record.best ? r : a), timed[0]);
  return `Every unlocked drill won. Slowest best: ${slow.name} in ${slow.record.best} ${slow.record.best === 1 ? 'round' : 'rounds'} — try to beat it.`;
}

// Journey Journal line: lifetime drill victories, distinct foes bested and the
// best Yard Gauntlet run. Null until a drill is won or a gauntlet attempted.
export function journalYardText(state) {
  const entries = drillEntries(state);
  const wins = entries.reduce((sum, r) => sum + r.record.wins, 0);
  const bested = entries.filter((r) => r.record.wins > 0).length;
  const grec = gauntletRecord(state);
  if (!wins && !grec.runs) return null;
  const parts = [];
  if (wins) parts.push(`${wins} drill ${wins === 1 ? 'victory' : 'victories'} over ${bested} ${bested === 1 ? 'foe' : 'foes'}`);
  if (grec.runs) parts.push(`Yard Gauntlet best: ${grec.best} ${grec.best === 1 ? 'foe' : 'foes'} beaten`);
  return `Training yard: ${parts.join(' · ')}.`;
}

// Yard Gauntlet target line toward the Unbroken Run feat. Null while the
// gauntlet is still locked (the progress note covers that case).
export function gauntletTargetText(state) {
  const unlocked = gauntletQueue(state).length;
  if (unlocked < GAUNTLET_MIN) return null;
  const total = DRILL_FOES.length;
  const grec = gauntletRecord(state);
  if (grec.best >= total) return `Unbroken Run earned: all ${total} yard bosses beaten in one run.`;
  if (unlocked < total) return `Unbroken Run needs all ${total} yard bosses in one run; ${unlocked} of ${total} are unlocked so far.`;
  if (!grec.runs) return `Unbroken Run target: beat all ${total} foes in one run.`;
  const more = total - grec.best;
  return `Unbroken Run target: beat all ${total} foes in one run (${more} more than your best).`;
}

export function gauntletRecordText(grec) {
  if (!grec || !grec.runs) return 'No gauntlet attempted yet.';
  return `Best run: ${grec.best} ${grec.best === 1 ? 'foe' : 'foes'} beaten · ${grec.runs} ${grec.runs === 1 ? 'attempt' : 'attempts'}`;
}

function recordText(rec) {
  if (!rec.wins) return 'No drills won yet.';
  return `Won ${rec.wins} ${rec.wins === 1 ? 'time' : 'times'} · best ${rec.best} ${rec.best === 1 ? 'round' : 'rounds'}`;
}

// One line per unlocked drill naming the foe's element and which skill
// elements hit it harder or are resisted, so the party can plan before a bout.
export function drillElementText(id) {
  const el = Object.prototype.hasOwnProperty.call(ENEMIES, id) ? ENEMIES[id]?.element : null;
  const label = elementLabel(el);
  if (!label) return 'No element: every skill hits it at normal strength.';
  const { strong, resist } = elementMatchups(el);
  if (!strong.length && !resist.length) return `Element: ${label}. Every skill hits it at normal strength.`;
  const parts = [];
  if (strong.length) parts.push(`${strong.map(elementLabel).join(' and ')} skills hit it harder`);
  if (resist.length) parts.push(`${resist.map(elementLabel).join(' and ')} skills are resisted`);
  return `Element: ${label}. ${parts.join('; ')}.`;
}

// One line per unlocked drill with the foe's stats at the current difficulty,
// matching what the restaged bout will actually field.
export function drillStatsText(state, id) {
  if (!Object.prototype.hasOwnProperty.call(ENEMIES, id) || !ENEMIES[id]) return '';
  const diff = getDifficulty(state);
  const e = scaleEnemy({ ...ENEMIES[id] }, diff);
  const n = (v) => (Number.isFinite(Number(v)) ? Math.round(Number(v)) : 0);
  return `Foe at ${DIFFICULTIES[diff].label}: ${n(e.hp)} HP · ${n(e.atk)} attack · ${n(e.def)} defense · ${n(e.spd)} speed.`;
}

export const drillsScene = {
  onEnter(game, data = {}) {
    game.drillsMessage = typeof data.message === 'string' ? data.message : '';
  },
  render(game) {
    const rows = drillEntries(game.state).map((r) => `<li class="drill${r.unlocked ? '' : ' drill--locked'}">
        <div><h2>${escapeHTML(r.name)}</h2><p>${escapeHTML(r.unlocked ? `+${r.xp} XP per drill` : 'Defeat this foe in the field first.')}</p>${r.unlocked ? `<p class="drill__record">${escapeHTML(recordText(r.record))}</p><p class="drill__element">${escapeHTML(drillElementText(r.id))}</p><p class="drill__stats">${escapeHTML(drillStatsText(game.state, r.id))}</p>` : ''}</div>
        ${r.unlocked ? uiButton({ action: 'startDrill', arg: r.id, label: 'Begin drill', iconName: 'sword', variant: 'ghost' }) : ''}
      </li>`).join('');
    const queue = gauntletQueue(game.state), grec = gauntletRecord(game.state);
    const target = gauntletTargetText(game.state);
    const gauntlet = `<section class="panel drills__gauntlet" aria-label="Yard Gauntlet">
        <h2>Yard Gauntlet</h2>
        <p>Face every drill you have unlocked, one after another. Wounds and spent MP carry over between bouts, and each win still grants its drill experience.</p>
        <p class="drill__record">${escapeHTML(gauntletRecordText(grec))}</p>
        ${target ? `<p class="drills__gauntlet-target">${escapeHTML(target)}</p>` : ''}
        ${queue.length >= GAUNTLET_MIN ? uiButton({ action: 'startGauntlet', label: `Begin gauntlet (${queue.length} foes)`, iconName: 'sword', variant: 'ghost' }) : `<p class="drills__gauntlet-progress">${escapeHTML(`Unlock ${GAUNTLET_MIN} drills to open the gauntlet (${queue.length} of ${GAUNTLET_MIN} unlocked so far).`)}</p>`}
      </section>`;
    const nextHint = drillsNextText(game.state);
    const msg = game.drillsMessage ? `<p class="drills__message" role="status">${escapeHTML(game.drillsMessage)}</p>` : '';
    return `<main class="game-shell drills">
      ${sceneHeader({ eyebrow: 'Watch House yard', title: 'Sparring Drills', subtitle: 'Practice against foes you have already beaten.', iconName: 'beacon' })}
      <section class="panel" aria-label="Drill roster">
        ${msg}
        <p class="drills__intro">Warden Mara restages battles you have already won, with straw targets and signal flags standing in for the real foe. Drills grant half the usual experience and nothing else — no gold, no spoils — and a lost drill costs nothing but pride.</p>
        <p class="drills__summary">${escapeHTML(drillsSummaryText(game.state))}</p>
        ${nextHint ? `<p class="drills__next">${escapeHTML(nextHint)}</p>` : ''}
        <ul class="drills__list">${rows}</ul>
      </section>
      ${gauntlet}
      <div class="title-actions">${uiButton({ action: 'closeDrills', label: 'Back to Greyhaven', iconName: 'compass', variant: 'primary' })}</div>
    </main>`;
  },
  actions: {
    startDrill(game, el) {
      const id = el?.dataset?.arg;
      if (!drillUnlocked(game.state, id)) { game.drillsMessage = 'That drill is not ready yet.'; return; }
      game.setScene('combat', { enemyId: id, encounterId: null, returnScene: 'drills', drill: true });
    },
    startGauntlet(game) {
      const queue = gauntletQueue(game.state);
      if (queue.length < GAUNTLET_MIN) { game.drillsMessage = 'The gauntlet is not ready yet.'; return; }
      game.setScene('combat', { enemyId: queue[0], encounterId: null, returnScene: 'drills', drill: true, gauntlet: { queue, index: 0 } });
    },
    closeDrills(game) { game.setScene('town'); },
  },
};

export function installDrills(game) {
  game.registerScene('drills', drillsScene);
}
