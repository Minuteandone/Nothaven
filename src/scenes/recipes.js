// Field Recipe Book — a read-only reference of every recipe the camp knows.
// Crafting itself happens in the bag (craft-in-field) or at a trader's Craft
// tab; this page answers "what can I make, and what am I missing?" for the
// whole book at once. Data-driven over RECIPES, so new recipes appear here
// automatically.
import { listRecipes, recipeInputsMet, recipeSummary } from '../items/crafting.js';
import { getItem, isKnownItem } from '../items/items.js';
import { countItem } from '../items/inventory.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const labelFor = (id) => (isKnownItem(id) ? getItem(id).name : id);

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

function entryHtml({ recipe, ready, inputs }) {
  const checklist = inputs
    .map((input) => `<li class="${input.have >= input.qty ? 'have' : 'need'}">${esc(input.label)} ×${input.qty} <small>(have ${input.have})</small></li>`)
    .join('');
  const status = ready
    ? '<span class="recipe-status ready">Ready to craft</span>'
    : '<span class="recipe-status">Missing materials</span>';
  return `<li class="recipe-entry">
    <h3>${esc(recipe.name)} ${status}</h3>
    <p><em>${esc(recipe.description || '')}</em></p>
    <p class="recipe-line">${esc(recipeSummary(recipe))}</p>
    <ul class="craft-checklist">${checklist}</ul>
  </li>`;
}

export const recipesScene = {
  onEnter(game, data = {}) {
    game.recipesReturn = data.returnScene || game.recipesReturn || 'town';
  },
  render(game) {
    const entries = recipeBookEntries(game.state?.inventory);
    const ready = entries.filter((e) => e.ready).length;
    return `<div class="panel recipes-book" role="region" aria-label="Field Recipe Book"><h2>Field Recipe Book</h2>
      <p>Camp recipes, from the forge to the field kitchen. Ready with what you carry: <strong>${ready}/${entries.length}</strong>.</p>
      <p class="hint">Craft from your bag anywhere on the road, or at any trader's Craft tab.</p>
      <ul class="recipe-list">${entries.map(entryHtml).join('')}</ul>
      <div class="actions"><button data-action="leave">Back</button></div></div>`;
  },
  actions: {
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
