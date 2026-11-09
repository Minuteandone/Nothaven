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
