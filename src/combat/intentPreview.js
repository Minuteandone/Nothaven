// Enemy intent preview — shows a strategic hint about the enemy's fighting style.
// Intents are defined directly on enemy data as an optional `intent` field.

/**
 * Returns the enemy's intent string, or null if none is defined.
 * Combines the enemy's element, boss status, and defined intent into a concise preview.
 */
export function enemyIntentPreview(combat) {
  const e = combat?.enemy;
  if (!e || e.hp <= 0 || combat.over) return null;
  return e.intent || null;
}

/**
 * Returns a richer intent preview that also notes enrage and windup state.
 */
export function richIntentPreview(combat) {
  const e = combat?.enemy;
  if (!e || e.hp <= 0 || combat.over) return null;

  const parts = [];
  if (e.intent) parts.push(e.intent);

  // If enraged, note the heightened threat
  if (combat.enraged) {
    parts.push('Now enraged — hitting harder and using abilities more often.');
  }

  // If gathering a windup, warn the player
  if (combat.windup) {
    const name = combat.windup?.name || e.windup?.name || 'a heavy blow';
    parts.push(`Gathering ${name} — strikes next turn unless stunned.`);
  }

  return parts.length ? parts.join(' ') : null;
}
