// Loot tables for Beacon of Stormhaven.
// A loot table entry looks like: `{ id: 'iron_sword', chance: 0.25, minQty: 1, maxQty: 1 }`.
// Attach a `loot: [...]` array to any enemy definition in src/data/enemies.js and call
// rollLoot on it after combat:victory. `rng` is injected for testability.

/**
 * Roll a single loot table. Drops nothing when every roll fails.
 * @param {Array<{id: string, chance: number, minQty?: number, maxQty?: number}>} lootTable
 * @param {() => number} [rng=Math.random] returns [0,1)
 * @returns {Array<{id: string, qty: number}>} flat list of dropped stacks
 */
export function rollLoot(lootTable, rng = Math.random) {
  if (!Array.isArray(lootTable)) return [];
  const drops = [];
  for (const entry of lootTable) {
    if (!entry || typeof entry.id !== 'string') continue;
    const chance = typeof entry.chance === 'number' ? entry.chance : 1;
    if (rng() >= chance) continue;
    const minQty = entry.minQty ?? 1;
    const maxQty = entry.maxQty ?? minQty;
    const span = Math.max(0, maxQty - minQty);
    const qty = minQty + Math.floor(rng() * (span + 1));
    if (qty <= 0) continue;
    drops.push({ id: entry.id, qty });
  }
  return drops;
}

/**
 * Roll loot for several defeated enemies at once (merged, in order).
 * @param {Array<object>} enemies enemy definitions, each may have a `loot` table
 * @param {() => number} [rng=Math.random]
 * @returns {Array<{id: string, qty: number}>}
 */
export function rollLootForEnemies(enemies, rng = Math.random) {
  const merged = [];
  for (const enemy of enemies || []) {
    if (enemy?.loot) merged.push(...rollLoot(enemy.loot, rng));
  }
  return merged;
}
