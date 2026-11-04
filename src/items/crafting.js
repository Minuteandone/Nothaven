// Crafting for Beacon of Stormhaven.
// Recipes turn material stockpiles (and old gear) into upgraded gear at
// Hesta's hearth in Greyhaven. All functions are pure: they never mutate the
// inventory they are given, and a failed craft leaves the inventory unchanged.

import { takeRewards, grantRewards } from './inventory.js';
import { getItem, isKnownItem, GOLD_ID } from './items.js';

/**
 * @typedef {Object} Recipe
 * @property {string} id stable snake_case id
 * @property {string} name display name
 * @property {string} description one-line flavour text (kept on-theme)
 * @property {Array<{id: string, qty: number}>} inputs
 * @property {Array<{id: string, qty: number}>} outputs
 */

/** The recipe book. Ids are stable — never rename a recipe id once shipped. */
export const RECIPES = Object.freeze([
  {
    id: 'reforge_blade',
    name: 'Reforge Guard Blade',
    description: 'Melt salvaged iron into a worn guard sword to give it a second edge.',
    inputs: [{ id: 'iron_sword', qty: 1 }, { id: 'scrap_metal', qty: 3 }],
    outputs: [{ id: 'salvaged_blade', qty: 1 }],
  },
  {
    id: 'distill_tonic',
    name: 'Distill Storm Tonic',
    description: 'Steep healing herbs in a shard of storm glass for a sparking draught.',
    inputs: [{ id: 'healing_herb', qty: 1 }, { id: 'storm_glass', qty: 1 }],
    outputs: [{ id: 'storm_tonic', qty: 1 }],
  },
  {
    id: 'hang_lantern',
    name: 'Hang a Storm Lantern',
    description: 'Frame storm glass with salvaged signal wiring; the flame holds against any gale.',
    inputs: [{ id: 'storm_glass', qty: 1 }, { id: 'salvaged_wiring', qty: 2 }],
    outputs: [{ id: 'storm_lantern', qty: 1 }],
  },
  {
    id: 'line_keeper_coat',
    name: 'Line a Keeper\'s Coat',
    description: 'Sew copper wiring through oiled hide for the weathercoat of a beacon keeper.',
    inputs: [{ id: 'leather_armor', qty: 1 }, { id: 'salvaged_wiring', qty: 2 }],
    outputs: [{ id: 'keeper_coat', qty: 1 }],
  },
  {
    id: 'forge_cutlass',
    name: 'Forge a Tidebound Cutlass',
    description: 'Hone a salvaged blade against reef chitin edges and set a shard of storm glass in the grip.',
    inputs: [{ id: 'salvaged_blade', qty: 1 }, { id: 'scrap_metal', qty: 2 }, { id: 'storm_glass', qty: 1 }],
    outputs: [{ id: 'tidebound_cutlass', qty: 1 }],
  },
  {
    id: 'weave_jerkin',
    name: 'Weave a Saltweather Jerkin',
    description: 'Overlay oiled hide with tarred canvas scraped from the harbor wrecks.',
    inputs: [{ id: 'leather_armor', qty: 1 }, { id: 'scrap_metal', qty: 2 }],
    outputs: [{ id: 'saltweather_jerkin', qty: 1 }],
  },
  {
    id: 'line_frostward_cloak',
    name: 'Line a Frostward Cloak',
    description: 'Sew panels of storm glass into highland wool; the panels drink the cold before you feel it.',
    inputs: [{ id: 'saltweather_jerkin', qty: 1 }, { id: 'storm_glass', qty: 2 }],
    outputs: [{ id: 'frostward_cloak', qty: 1 }],
  },
  {
    id: 'string_gale_charm',
    name: 'String a Gale Charm',
    description: 'Wind fine signal wire around a lens shard until it hums against the wind.',
    inputs: [{ id: 'lens_shard', qty: 1 }, { id: 'salvaged_wiring', qty: 2 }],
    outputs: [{ id: 'gale_charm', qty: 1 }],
  },
  {
    id: 'brew_chowder',
    name: 'Brew Hearty Chowder',
    description: 'Smoke the day\'s catch over the hearth and simmer it slow with trail rations.',
    inputs: [{ id: 'rations', qty: 2 }, { id: 'healing_herb', qty: 1 }],
    outputs: [{ id: 'hearty_chowder', qty: 1 }],
  },
  {
    id: 'pack_field_dressing',
    name: 'Pack a Field Dressing',
    description: 'Wash in brine and double-fold two linen bandages into one field-ready roll.',
    inputs: [{ id: 'bandage', qty: 2 }],
    outputs: [{ id: 'field_dressing', qty: 1 }],
  },
  {
    id: 'mull_highland_flask',
    name: 'Mull a Highland Flask',
    description: 'Warm a storm tonic over the hearth with juniper snowmelt until it steadies instead of sparks.',
    inputs: [{ id: 'storm_tonic', qty: 1 }, { id: 'storm_glass', qty: 1 }],
    outputs: [{ id: 'highland_flask', qty: 1 }],
  },
  {
    id: 'forge_relay_glaive',
    name: 'Forge a Relay Glaive',
    description: 'Fit salvaged brass fittings along a salvaged blade and mount the haft on an old signal pole.',
    inputs: [{ id: 'salvaged_blade', qty: 1 }, { id: 'relay_brass', qty: 2 }, { id: 'storm_glass', qty: 1 }],
    outputs: [{ id: 'relay_glaive', qty: 1 }],
  },
  {
    id: 'weave_sunscar_mantle',
    name: 'Weave a Sunscar Mantle',
    description: 'Overstitch a frostward cloak with sun-baked amber glass so it turns both frost and glare.',
    inputs: [{ id: 'frostward_cloak', qty: 1 }, { id: 'sunscar_glass', qty: 2 }],
    outputs: [{ id: 'sunscar_mantle', qty: 1 }],
  },
  {
    id: 'cut_signal_prism',
    name: 'Cut a Signal Prism',
    description: 'Grind a lens shard square and seat it in brass fittings from the relay line.',
    inputs: [{ id: 'lens_shard', qty: 1 }, { id: 'relay_brass', qty: 2 }],
    outputs: [{ id: 'signal_prism', qty: 1 }],
  },
  {
    id: 'brew_spiced_broth',
    name: 'Brew Spiced Broth',
    description: 'Thin a hearty chowder with snowmelt and inland spice until it steams clean through.',
    inputs: [{ id: 'hearty_chowder', qty: 1 }, { id: 'rations', qty: 1 }],
    outputs: [{ id: 'spiced_broth', qty: 1 }],
  },
]);

/** Look up a recipe by id (own-property safe). @returns {Recipe|undefined} */
export function getRecipe(id) {
  return RECIPES.find((r) => r.id === id);
}

/** @returns {Array<Recipe>} fresh copies safe to expose to a UI */
export function listRecipes() {
  return RECIPES.map((r) => ({
    ...r,
    inputs: r.inputs.map((s) => ({ ...s })),
    outputs: r.outputs.map((s) => ({ ...s })),
  }));
}

/**
 * Check whether the inventory holds every input of a recipe.
 * @param {Array<{id:string,qty:number}>} inv
 * @param {Recipe} recipe
 * @returns {{ok: boolean, missing: Array<{id:string, qty:number, have:number}>}}
 */
export function recipeInputsMet(inv, recipe) {
  const missing = [];
  for (const { id, qty } of recipe?.inputs || []) {
    const have = inv
      .filter((s) => s.id === id)
      .reduce((n, s) => n + s.qty, 0);
    if (have < qty) missing.push({ id, qty, have });
  }
  return { ok: missing.length === 0, missing };
}

/** Human-readable summary of a recipe, e.g. "1 Iron Sword + 3 Scrap Metal → 1 Salvaged Blade". */
export function recipeSummary(recipe) {
  const names = (list) =>
    list.map((s) => {
      try { return `${s.qty} ${getItem(s.id).name}`; } catch { return `${s.qty} ${s.id}`; }
    });
  return `${names(recipe.inputs).join(' + ')} → ${names(recipe.outputs).join(', ')}`;
}

/**
 * Craft a recipe atomically: consume all inputs, then grant all outputs.
 * If anything is invalid, the inventory is returned unchanged.
 * @param {Array<{id:string,qty:number}>} inv
 * @param {string} recipeId
 * @returns {{ok: boolean, inv: Array<{id:string,qty:number}>, messages: string[]}}
 */
export function craft(inv, recipeId) {
  const recipe = getRecipe(recipeId);
  if (!recipe) {
    return { ok: false, inv, messages: [`Unknown recipe: ${recipeId}.`] };
  }
  const { ok: met, missing } = recipeInputsMet(inv, recipe);
  if (!met) {
    const detail = missing.map((m) => `${m.id} (have ${m.have}, need ${m.qty})`).join(', ');
    return { ok: false, inv, messages: [`Missing materials: ${detail}.`] };
  }
  const inputs = Object.fromEntries(recipe.inputs.map((s) => [s.id, s.qty]));
  const take = takeRewards(inv, inputs);
  if (!take.ok) {
    return { ok: false, inv, messages: [take.message] };
  }
  const give = grantRewards(take.inv, recipe.outputs);
  if (!give.ok) {
    return { ok: false, inv, messages: give.messages };
  }
  return { ok: true, inv: give.inv, messages: give.messages };
}

/** Validate recipe shape/ids at boot or in tests; returns a list of problems. */
export function validateRecipes(recipes = RECIPES) {
  const problems = [];
  const seen = new Set();
  for (const r of recipes) {
    if (!r.id || typeof r.id !== 'string') problems.push(`recipe ${JSON.stringify(r?.name)} has no id`);
    else if (seen.has(r.id)) problems.push(`duplicate recipe id: ${r.id}`);
    else seen.add(r.id);
    for (const side of ['inputs', 'outputs']) {
      for (const { id, qty } of r[side] || []) {
        if (!Number.isInteger(qty) || qty <= 0) problems.push(`${r.id}: bad qty for ${id} in ${side}`);
        if (id === GOLD_ID) problems.push(`${r.id}: gold is not an inventory item (${side})`);
        else if (!isKnownItem(id)) problems.push(`${r.id}: unknown item ${id} in ${side}`);
      }
    }
  }
  return problems;
}
