// Optional difficulty presets. Standard leaves every enemy exactly as defined.
export const DIFFICULTIES = Object.freeze({
  story: Object.freeze({ id: 'story', label: 'Story', hp: 0.75, atk: 0.8, gold: 1, blurb: 'Gentler foes for players here for the tale.' }),
  standard: Object.freeze({ id: 'standard', label: 'Standard', hp: 1, atk: 1, gold: 1, blurb: 'The frontier as the wardens know it.' }),
  veteran: Object.freeze({ id: 'veteran', label: 'Veteran', hp: 1.3, atk: 1.2, gold: 1.25, blurb: 'Tougher foes and richer bounties.' }),
  stormborn: Object.freeze({ id: 'stormborn', label: 'Stormborn', hp: 1.6, atk: 1.4, gold: 1.5, blurb: 'A punishing frontier for wardens who know every trick.' }),
});
export const DIFFICULTY_ORDER = Object.freeze(['story', 'standard', 'veteran', 'stormborn']);

/** Resolve a state's difficulty id, falling back to standard. */
export function getDifficulty(state) {
  const id = state?.settings?.difficulty;
  return (typeof id === 'string' && Object.prototype.hasOwnProperty.call(DIFFICULTIES, id)) ? id : 'standard';
}

/** Move to the next preset in DIFFICULTY_ORDER. Returns the new id. */
export function cycleDifficulty(state) {
  const next = DIFFICULTY_ORDER[(DIFFICULTY_ORDER.indexOf(getDifficulty(state)) + 1) % DIFFICULTY_ORDER.length];
  if (!state.settings || typeof state.settings !== 'object') state.settings = {};
  state.settings.difficulty = next;
  return next;
}

/** Return a scaled copy of an enemy for the given difficulty id. */
export function scaleEnemy(enemy, difficultyId = 'standard') {
  const d = Object.prototype.hasOwnProperty.call(DIFFICULTIES, difficultyId) ? DIFFICULTIES[difficultyId] : DIFFICULTIES.standard;
  if (d.id === 'standard') return enemy;
  const hp = Math.max(1, Math.round(enemy.hp * d.hp));
  return {
    ...enemy,
    hp, maxHp: hp,
    atk: Math.max(1, Math.round((enemy.atk || 0) * d.atk)),
    gold: Math.round((enemy.gold || 0) * d.gold),
  };
}
