import { test } from 'node:test';
import assert from 'node:assert/strict';

import { shopScene } from '../src/scenes/shop.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';
import { listRecipes } from '../src/items/crafting.js';
import { getItem } from '../src/items/items.js';

const EGG_RE = /\b(eggs?|nests?|nest(ed|ing)?|hatch(ed|ing|es|lings?)?|yolk|chickens?|roosters?|hen|easter|scrambl(e|ed|ing)|omelet(te)?s?|peep(s|ing)?|shells?|shell(ed|ing)?|albumen|ovoid|quiche|meringue|custard|poach(ed|ing)?|frittata)\b/i;

function fakeGame() {
  const game = {
    state: createInitialState(),
    shopMode: undefined,
    shopMessage: '',
    shopReturnScene: undefined,
    lastScene: null,
    setScene(name, data) { game.lastScene = { name, data }; },
  };
  return game;
}

test('onEnter accepts craft mode and setMode toggles the craft tab', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { mode: 'craft' });
  assert.equal(game.shopMode, 'craft');
  shopScene.actions.setMode(game, { dataset: { arg: 'craft' } });
  assert.equal(game.shopMode, 'craft');
  shopScene.actions.setMode(game, { dataset: { arg: 'nonsense' } });
  assert.equal(game.shopMode, 'buy');
});

test('craft tab renders every recipe with checklist and disables missing inputs', () => {
  const game = fakeGame();
  shopScene.onEnter(game, { mode: 'craft' });
  game.state.inventory = grantRewards(game.state.inventory, { iron_sword: 1, scrap_metal: 3 }).inv;
  const html = shopScene.render(game);
  for (const recipe of listRecipes()) {
    assert.ok(html.includes(`data-action="craft" data-arg="${recipe.id}"`), `recipe ${recipe.id} has a craft button`);
    const escapedName = recipe.name.replace(/'/g, '&#39;');
    assert.ok(html.includes(escapedName), `recipe ${recipe.name} is listed`);
  }
  assert.ok(!html.includes('data-action="craft" data-arg="reforge_blade" disabled'), 'affordable recipe is enabled');
  assert.ok(html.includes('data-action="craft" data-arg="hang_lantern" disabled'), 'recipe without materials is disabled');
  assert.match(html, /Scrap Metal ×3 <small>\(have 3\)/);
});

test('craft action consumes inputs and grants the output', () => {
  const game = fakeGame();
  game.state.inventory = grantRewards(game.state.inventory, { iron_sword: 1, scrap_metal: 3 }).inv;
  shopScene.actions.craft(game, { dataset: { arg: 'reforge_blade' } });
  assert.deepEqual(game.state.inventory, [{ id: 'salvaged_blade', qty: 1 }]);
  assert.match(game.shopMessage, /crafted 1 Salvaged Blade/);
});

test('failed craft leaves inventory unchanged and reports missing materials', () => {
  const game = fakeGame();
  game.state.inventory = grantRewards(game.state.inventory, { storm_glass: 1 }).inv; // wiring missing
  shopScene.actions.craft(game, { dataset: { arg: 'hang_lantern' } });
  assert.deepEqual(game.state.inventory, [{ id: 'storm_glass', qty: 1 }]);
  assert.match(game.shopMessage, /Missing materials/);
});

test('crafted gear is immediately equippable through the wardrobe', () => {
  const game = fakeGame();
  game.state.inventory = grantRewards(game.state.inventory, { iron_sword: 1, scrap_metal: 3 }).inv;
  shopScene.actions.craft(game, { dataset: { arg: 'reforge_blade' } });
  shopScene.actions.equip(game, { dataset: { arg: 'salvaged_blade' } });
  assert.equal(game.state.party[0].equipment.weapon, 'salvaged_blade');
  assert.equal(getItem('salvaged_blade').stats.atk, 9);
  assert.deepEqual(game.state.inventory.filter((s) => s.id === 'iron_sword'), []);
});

test('craft action with unknown or missing recipe id is safe', () => {
  const game = fakeGame();
  shopScene.actions.craft(game, { dataset: { arg: 'not_a_recipe' } });
  shopScene.actions.craft(game, { dataset: {} });
  assert.deepEqual(game.state.inventory, []);
});

test('craft tab HTML passes the egg-word hygiene scan and escapes hostile names', () => {
  const game = fakeGame();
  game.state.party[0].name = 'Wren <img src=x onerror=alert(1)>';
  game.state.inventory = grantRewards(game.state.inventory, { iron_sword: 1, scrap_metal: 2 }).inv;
  shopScene.onEnter(game, { mode: 'craft' });
  const html = shopScene.render(game);
  assert.ok(!EGG_RE.test(html), 'no egg vocabulary in craft tab');
  assert.ok(!html.includes('<img src=x'), 'hostile hero name is escaped');
});
