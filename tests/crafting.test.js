// Tests for src/items/crafting.js — run with: npm test
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  RECIPES, getRecipe, listRecipes, recipeInputsMet, recipeSummary,
  craft, validateRecipes,
} from '../src/items/crafting.js';
import { createInventory, grantRewards, countItem } from '../src/items/inventory.js';
import { canEquip } from '../src/items/items.js';

const stock = () => grantRewards(createInventory(), [
  { id: 'iron_sword', qty: 1 }, { id: 'scrap_metal', qty: 5 },
  { id: 'healing_herb', qty: 2 }, { id: 'storm_glass', qty: 3 },
  { id: 'salvaged_wiring', qty: 4 },
]).inv;

test('recipe book validates: unique ids, known items, positive integer quantities', () => {
  assert.deepEqual(validateRecipes(), []);
});

test('reforge_blade consumes inputs and yields salvaged_blade atomically', () => {
  const inv = stock();
  const res = craft(inv, 'reforge_blade');
  assert.equal(res.ok, true);
  assert.equal(countItem(res.inv, 'salvaged_blade'), 1);
  assert.equal(countItem(res.inv, 'iron_sword'), 0);
  assert.equal(countItem(res.inv, 'scrap_metal'), 2);
  assert.equal(canEquip('salvaged_blade'), true);
});

test('craft is atomic when materials are missing', () => {
  const inv = stock();
  const bad = craft(inv, 'line_keeper_coat'); // no leather_armor held
  assert.equal(bad.ok, false);
  assert.deepEqual(bad.inv, inv);
  const res = recipeInputsMet(inv, getRecipe('line_keeper_coat'));
  assert.equal(res.ok, false);
  assert.ok(res.missing.some((m) => m.id === 'leather_armor'));
});

test('craft rejects unknown and inherited-key recipe ids', () => {
  const inv = stock();
  assert.equal(craft(inv, 'no_such_recipe').ok, false);
  assert.equal(craft(inv, 'constructor').ok, false);
  assert.equal(getRecipe('constructor'), undefined);
  assert.equal(getRecipe('toString'), undefined);
});

test('distill_tonic yields a usable consumable; hang_lantern yields a trinket', () => {
  const inv = stock();
  const tonic = craft(inv, 'distill_tonic');
  assert.equal(tonic.ok, true);
  assert.equal(countItem(tonic.inv, 'storm_tonic'), 1);
  const lantern = craft(tonic.inv, 'hang_lantern');
  assert.equal(lantern.ok, true);
  assert.equal(countItem(lantern.inv, 'storm_lantern'), 1);
});

test('listRecipes returns deep copies and summaries are readable', () => {
  const copies = listRecipes();
  copies[0].inputs[0].qty = 99;
  assert.equal(RECIPES[0].inputs[0].qty, 1);
  assert.match(recipeSummary(getRecipe('reforge_blade')), /1 Iron Sword \+ 3 Scrap Metal → 1 Salvaged Blade/);
});

// Same hygiene ban as tests/items.test.js — no egg words anywhere in the recipe book.
test('recipe names and descriptions contain no egg references', () => {
  const banned = /\b(eggs?|nests?|nest(ed|ing)?|hatch(ed|ing|es|lings?)?|yolk|chickens?|roosters?|hen|easter|scrambl(e|ed|ing)|omelet(te)?s?|peep(s|ing)?|shells?|shell(ed|ing)?)\b/i;
  for (const r of RECIPES) {
    assert.doesNotMatch(r.name || '', banned, `recipe name for ${r.id}`);
    assert.doesNotMatch(r.description || '', banned, `recipe description for ${r.id}`);
  }
});
