// Field Recipe Book — a read-only reference of every recipe the camp knows.
// Crafting itself happens in the bag (craft-in-field) or at a trader's Craft
// tab; this page answers "what can I make, and what am I missing?" for the
// whole book at once. Data-driven over RECIPES, so new recipes appear here
// automatically.
import { listRecipes, recipeInputsMet, recipeSummary } from '../items/crafting.js';
import { getItem, isKnownItem, useEffectLine } from '../items/items.js';
import { countItem } from '../items/inventory.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const labelFor = (id) => (isKnownItem(id) ? getItem(id).name : id);

function equipmentEffectLine(item) {
  const stats = item?.stats;
  if (!stats || typeof stats !== 'object') return '';
  const parts = [];
  if (stats.atk) parts.push(`ATK+${stats.atk}`);
  if (stats.def) parts.push(`DEF+${stats.def}`);
  if (stats.hp) parts.push(`HP+${stats.hp}`);
  if (stats.mp) parts.push(`MP+${stats.mp}`);
  if (stats.spd) parts.push(`SPD+${stats.spd}`);
  return parts.length ? `Equip: ${parts.join(' · ')}` : '';
}

/**
 * Pure catalog-derived effect lines for a recipe's known outputs. Unknown or
 * effect-less outputs are omitted; recipeSummary still lists every output.
 * @param {object|null|undefined} recipe recipe-like object
 * @returns {string[]} fresh display strings, never mutating the recipe
 */
export function recipeOutputLines(recipe) {
  if (!recipe || typeof recipe !== 'object' || !Array.isArray(recipe.outputs)) return [];
  return recipe.outputs.flatMap((output) => {
    if (!output || !isKnownItem(output.id)) return [];
    const item = getItem(output.id);
    const effect = [useEffectLine(item), equipmentEffectLine(item)].filter(Boolean).join(' · ');
    return effect ? [`${item.name} — ${effect}`] : [];
  });
}

/** Pure helper: one entry per recipe, with have/need counts against `inv`. */
export function recipeBookEntries(inv) {
  const rows = Array.isArray(inv) ? inv : [];
  return listRecipes().map((recipe) => {
    const check = recipeInputsMet(rows, recipe);
    const inputs = (recipe.inputs || []).map((input) => ({
      id: input.id,
      label: labelFor(input.id),
      qty: input.qty,
      have: countItem(rows, input.id),
    }));
    return { recipe, ready: check.ok, missing: check.missing.length, inputs };
  });
}

const FILTERS = ['all', 'ready', 'missing'];
const queryText = (value) => typeof value === 'string' ? value.trim().slice(0, 120) : '';
const filterName = (value) => FILTERS.includes(value) ? value : 'all';
const canPlan = (game) => game.state?.scene === 'recipes' && !game.state.combat;

/** Pure planning view; preserve catalogue order and leave entries untouched. */
export function filterRecipeEntries(entries, filter = 'all', query = '') {
  const mode = filterName(filter);
  const term = queryText(query).toLowerCase();
  return entries.filter((entry) => {
    if (mode === 'ready' && !entry.ready) return false;
    if (mode === 'missing' && entry.ready) return false;
    const names = [entry.recipe.name,
      ...(entry.recipe.inputs || []).map((item) => labelFor(item.id)),
      ...(entry.recipe.outputs || []).map((item) => labelFor(item.id))];
    return !term || names.some((name) => String(name).toLowerCase().includes(term));
  });
}

function entryHtml({ recipe, ready, inputs }) {
  const checklist = inputs
    .map((input) => `<li class="${input.have >= input.qty ? 'have' : 'need'}">${esc(input.label)} ×${input.qty} <small>(have ${input.have})</small></li>`)
    .join('');
  const status = ready
    ? '<span class="recipe-status ready">Ready to craft</span>'
    : '<span class="recipe-status">Missing materials</span>';
  const outputs = recipeOutputLines(recipe);
  const outputList = outputs.length
    ? `<ul class="recipe-output-effects" aria-label="Crafted item effects">${outputs.map((line) => `<li class="recipe-output-effect" data-recipe="${esc(recipe.id)}" data-ready="${ready}">${esc(line)}</li>`).join('')}</ul>`
    : '';
  return `<li class="recipe-entry">
    <h3 class="recipe-heading${ready ? ' is-ready' : ''}" data-recipe="${esc(recipe.id)}">${esc(recipe.name)} ${status}</h3>
    <p><em>${esc(recipe.description || '')}</em></p>
    <p class="recipe-line">${esc(recipeSummary(recipe))}</p>
    ${outputList}
    <ul class="craft-checklist">${checklist}</ul>
  </li>`;
}

export const recipesScene = {
  onEnter(game, data = {}) {
    game.recipesReturn = data.returnScene || game.recipesReturn || 'town';
    game.recipesFilter = 'all';
    game.recipesQuery = '';
  },
  render(game) {
    const entries = recipeBookEntries(game.state?.inventory);
    const ready = entries.filter((e) => e.ready).length;
    const filter = filterName(game.recipesFilter);
    const query = queryText(game.recipesQuery);
    const visible = filterRecipeEntries(entries, filter, query);
    const filters = FILTERS.map((value) => `<button data-action="recipeFilter" data-arg="${value}" aria-pressed="${filter === value}">${{ all: 'All', ready: 'Ready', missing: 'Missing' }[value]}</button>`).join('');
    return `<div class="panel recipes-book" role="region" aria-label="Field Recipe Book"><h2>Field Recipe Book</h2>
      <p>Camp recipes, from the forge to the field kitchen. Ready with what you carry: <strong>${ready}/${entries.length}</strong>.</p>
      <p class="hint">Craft from your bag anywhere on the road, or at any trader's Craft tab.</p>
      <div class="recipe-tools">
        <div class="recipe-filters" role="group" aria-label="Recipe availability">${filters}</div>
        <label for="recipe-search">Search recipes</label>
        <p id="recipe-search-help" class="hint">Search recipe, ingredient, or output names, then choose Search.</p>
        <div class="recipe-search-row"><input type="search" id="recipe-search" maxlength="120" aria-describedby="recipe-search-help" value="${esc(query)}"><button data-action="searchRecipes">Search</button><button data-action="clearRecipeSearch"${query ? '' : ' disabled'}>Clear search</button></div>
      </div>
      <p role="status">Showing ${visible.length} of ${entries.length} recipes.</p>
      ${visible.length ? `<ul class="recipe-list">${visible.map(entryHtml).join('')}</ul>` : '<p>No recipes match these choices.</p>'}
      <div class="actions"><button data-action="leave">Back</button></div></div>`;
  },
  actions: {
    recipeFilter(game, el) {
      const value = el?.dataset?.arg;
      if (!canPlan(game) || !FILTERS.includes(value)) return;
      game.recipesFilter = value;
    },
    searchRecipes(game) {
      if (!canPlan(game)) return;
      const value = game.root?.querySelector?.('#recipe-search')?.value;
      if (typeof value !== 'string') return;
      game.recipesQuery = queryText(value);
    },
    clearRecipeSearch(game) {
      if (!canPlan(game)) return;
      game.recipesQuery = '';
    },
    leave(game) {
      // Going back to the bag, preserve the bag's own return scene (it resets
      // to 'town' when re-entered without data).
      if (game.recipesReturn === 'bag') game.setScene('bag', { returnScene: game.bagReturnScene });
      else game.setScene(game.recipesReturn || 'town');
    },
  },
};

export function installRecipeBook(game) {
  game.registerScene('recipes', recipesScene);
}
