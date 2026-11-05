// Service Record: a small tally of real (non-drill) battles kept on the save.
// Listens to combat:victory, combat:defeat and combat:escape on the game bus.
// Sparring drills never emit these events, so practice bouts are not counted.
import { ENEMIES } from '../data/enemies.js';
import { getDifficulty } from '../combat/difficulty.js';

const COUNTERS = ['victories', 'bossVictories', 'defeats', 'escapes', 'comebacks', 'streak', 'bestStreak', 'stormbornBossVictories'];

const count = v => (Number.isSafeInteger(v) && v > 0 ? v : 0);

// Read-only normalised view; never mutates the save.
export function ledgerOf(state) {
  const raw = state && typeof state.ledger === 'object' && state.ledger !== null ? state.ledger : {};
  const out = {};
  for (const key of COUNTERS) out[key] = count(raw[key]);
  out.bestStreak = Math.max(out.bestStreak, out.streak);
  out.pendingComeback = raw.pendingComeback === true;
  return out;
}

function writable(state) {
  const next = ledgerOf(state);
  state.ledger = next;
  return next;
}

export function recordVictory(state, enemyId) {
  if (!state) return null;
  const l = writable(state);
  l.victories += 1;
  if (Object.prototype.hasOwnProperty.call(ENEMIES, enemyId) && ENEMIES[enemyId]?.boss === true) {
    l.bossVictories += 1;
    if (getDifficulty(state) === 'stormborn') l.stormbornBossVictories += 1;
  }
  l.streak += 1;
  l.bestStreak = Math.max(l.bestStreak, l.streak);
  if (l.pendingComeback) { l.comebacks += 1; l.pendingComeback = false; }
  return l;
}

export function recordDefeat(state) {
  if (!state) return null;
  const l = writable(state);
  l.defeats += 1;
  l.streak = 0;
  l.pendingComeback = true;
  return l;
}

// Withdrawing is not a loss: the streak and any pending comeback are kept.
export function recordEscape(state) {
  if (!state) return null;
  const l = writable(state);
  l.escapes += 1;
  return l;
}

export const SERVICE_ROWS = Object.freeze([
  Object.freeze({ key: 'victories', label: 'Battles won' }),
  Object.freeze({ key: 'bossVictories', label: 'Bosses overcome' }),
  Object.freeze({ key: 'defeats', label: 'Times carried home' }),
  Object.freeze({ key: 'escapes', label: 'Safe withdrawals' }),
  Object.freeze({ key: 'comebacks', label: 'Wins after a defeat' }),
  Object.freeze({ key: 'streak', label: 'Current winning run' }),
  Object.freeze({ key: 'bestStreak', label: 'Longest winning run' }),
  Object.freeze({ key: 'stormbornBossVictories', label: 'Bosses overcome on Stormborn' }),
]);

export function installLedger(game) {
  if (!game?.bus) return;
  game.bus.on('combat:victory', p => recordVictory(game.state, p?.enemyId));
  game.bus.on('combat:defeat', () => recordDefeat(game.state));
  game.bus.on('combat:escape', () => recordEscape(game.state));
}
