import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { recipesScene, recipeOutputLines } from '../src/scenes/recipes.js';
import { RECIPES } from '../src/items/crafting.js';
import { getItem, useEffectLine } from '../src/items/items.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function gameWith(inventory = []) {
  return {
    state: { ...createInitialState(), scene: 'recipes', inventory },
    recipesReturn: 'town',
    recipesFilter: 'all',
    recipesQuery: '',
  };
}

function rowFor(html, id) {
  return html.split('<li class="recipe-entry">').find((row) => row.includes(`data-recipe="${id}"`)) || '';
}

test('every current recipe output has an accurate catalog-derived effect line', () => {
  assert.equal(RECIPES.length, 26);
  for (const recipe of RECIPES) {
    const lines = recipeOutputLines(recipe);
    assert.equal(lines.length, recipe.outputs.length, recipe.id);
    for (let i = 0; i < recipe.outputs.length; i += 1) {
      const item = getItem(recipe.outputs[i].id);
      assert.ok(lines[i].startsWith(`${item.name} — `), recipe.id);
      if (item.use) assert.ok(lines[i].includes(useEffectLine(item)), recipe.id);
      if (item.stats) {
        for (const [key, label] of [['atk', 'ATK'], ['def', 'DEF'], ['hp', 'HP'], ['mp', 'MP'], ['spd', 'SPD']]) {
          if (item.stats[key]) assert.ok(lines[i].includes(`${label}+${item.stats[key]}`), `${recipe.id} ${label}`);
        }
      }
    }
  }
});

test('representative consumable and equipment effects use the established wording', () => {
  const byId = (id) => RECIPES.find((recipe) => recipe.id === id);
  assert.deepEqual(recipeOutputLines(byId('distill_tonic')), [
    'Storm Tonic — Use: restores 20 MP · cures Shocked',
  ]);
  assert.deepEqual(recipeOutputLines(byId('brew_chowder')), [
    'Hearty Chowder — Use: restores 45 HP',
  ]);
  assert.deepEqual(recipeOutputLines(byId('reforge_blade')), [
    'Salvaged Blade — Equip: ATK+9',
  ]);
  assert.deepEqual(recipeOutputLines(byId('hang_lantern')), [
    'Storm Lantern — Equip: HP+8 · SPD+1',
  ]);
});

test('malformed recipes and unknown or effect-less outputs fail closed without mutation', () => {
  for (const value of [null, undefined, '', 0, [], {}, { outputs: null }, { outputs: 'bad' }]) {
    assert.deepEqual(recipeOutputLines(value), []);
  }
  const recipe = Object.freeze({
    id: 'hostile',
    outputs: Object.freeze([
      Object.freeze({ id: '__proto__', qty: 1 }),
      Object.freeze({ id: 'scrap_metal', qty: 1 }),
      Object.freeze({ id: 'rations', qty: 1 }),
    ]),
  });
  assert.deepEqual(recipeOutputLines(recipe), ['Trail Rations — Use: restores 10 HP']);
  assert.equal(recipe.outputs.length, 3);
});

test('recipe book renders output effects once beside the unchanged ingredient summary', () => {
  const html = recipesScene.render(gameWith());
  assert.equal((html.match(/aria-label="Crafted item effects"/g) || []).length, RECIPES.length);
  const tonic = rowFor(html, 'distill_tonic');
  assert.ok(tonic.includes('1 Storm Tonic'));
  assert.ok(tonic.includes('Storm Tonic — Use: restores 20 MP · cures Shocked'));
  const blade = rowFor(html, 'reforge_blade');
  assert.ok(blade.includes('Salvaged Blade — Equip: ATK+9'));
  assertEggFree(html, 'recipe output effects');
});

test('cooked-meal readiness markup follows real ingredients without changing inventory', () => {
  const granted = grantRewards([], { rations: 3, healing_herb: 2, hearty_chowder: 1 });
  assert.ok(granted.ok);
  const before = structuredClone(granted.inv);
  const html = recipesScene.render(gameWith(granted.inv));
  const chowder = rowFor(html, 'brew_chowder');
  const spiced = rowFor(html, 'brew_spiced_broth');
  assert.ok(chowder.includes('class="recipe-heading is-ready" data-recipe="brew_chowder"'));
  assert.ok(chowder.includes('data-recipe="brew_chowder" data-ready="true"'));
  assert.ok(spiced.includes('class="recipe-heading is-ready" data-recipe="brew_spiced_broth"'));
  assert.ok(spiced.includes('data-recipe="brew_spiced_broth" data-ready="true"'));
  assert.deepEqual(granted.inv, before);
  assertEggFree(html, 'ready cooked-meal output markup');
});

test('not-ready cooked meals retain their effect text but are not marked ready', () => {
  const html = recipesScene.render(gameWith());
  for (const id of ['brew_chowder', 'brew_spiced_broth']) {
    const row = rowFor(html, id);
    assert.ok(row.includes(`class="recipe-heading" data-recipe="${id}"`));
    assert.ok(row.includes(`data-recipe="${id}" data-ready="false"`));
    assert.ok(row.includes('Use: restores'));
  }
});

test('both guides describe output-effect parity exactly once', () => {
  const phrase = 'actual Use or Equip effect, using the same item catalog as the Bag and Shop.';
  for (const path of ['docs/PLAYER_GUIDE.md', 'src/scenes/guide.js']) {
    const text = readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
    assert.equal(text.split(phrase).length - 1, 1, path);
  }
});
