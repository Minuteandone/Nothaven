import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { migrateSave } from '../src/core/save.js';
import { effectiveStats, totalStats } from '../src/items/equipment.js';
import { countItem } from '../src/items/inventory.js';
import { ITEMS } from '../src/items/items.js';
import {
  FITTING_COSTS, MAX_FITTING, applyFitting, fittingBonus, fittingCheck, fittingLevel, nextFittingCost,
} from '../src/items/forge.js';
import { forgeScene } from '../src/scenes/forge.js';
import { townScene } from '../src/scenes/town.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function armed(gold = 1000) {
  const s = createInitialState();
  const hero = s.party[0];
  hero.equipment = { weapon: 'iron_sword', armor: 'leather_armor', trinket: null };
  s.gold = gold;
  s.inventory = [{ id: 'scrap_metal', qty: 10 }, { id: 'storm_glass', qty: 10 }, { id: 'relay_brass', qty: 10 }];
  return s;
}

test('fitting costs use real materials and climb in price', () => {
  for (const slot of ['weapon', 'armor']) {
    assert.equal(FITTING_COSTS[slot].length, MAX_FITTING);
    let last = 0;
    for (const cost of FITTING_COSTS[slot]) {
      assert.ok(cost.gold > last); last = cost.gold;
      for (const { id, qty } of cost.items) { assert.ok(ITEMS[id], id); assert.ok(qty > 0); }
    }
  }
});

test('weapon fittings add attack, spend gold and materials, and stop at +3', () => {
  const s = armed();
  const hero = s.party[0];
  const before = effectiveStats(hero).atk;
  for (let n = 1; n <= MAX_FITTING; n += 1) {
    const r = applyFitting(s, hero.id, 'weapon');
    assert.equal(r.ok, true, r.message);
    assert.equal(fittingLevel(hero, 'weapon'), n);
  }
  assert.equal(effectiveStats(hero).atk, before + 6);
  assert.equal(s.gold, 1000 - 30 - 70 - 140);
  assert.equal(countItem(s.inventory, 'scrap_metal'), 10 - 3);
  assert.equal(countItem(s.inventory, 'storm_glass'), 10 - 3);
  assert.equal(countItem(s.inventory, 'relay_brass'), 10 - 2);
  assert.equal(nextFittingCost(hero, 'weapon'), null);
  const extra = applyFitting(s, hero.id, 'weapon');
  assert.equal(extra.ok, false);
  assert.equal(s.gold, 760);
});

test('armour fittings add defence and max HP, and top up current HP', () => {
  const s = armed();
  const hero = s.party[0];
  const base = effectiveStats(hero);
  const hp = hero.hp;
  assert.equal(applyFitting(s, hero.id, 'armor').ok, true);
  const after = effectiveStats(hero);
  assert.equal(after.def, base.def + 1);
  assert.equal(after.maxHp, base.maxHp + 4);
  assert.equal(hero.hp, hp + 4);
});

test('fittings rest when the slot is empty and follow the wearer to new gear', () => {
  const s = armed();
  const hero = s.party[0];
  applyFitting(s, hero.id, 'weapon');
  assert.equal(fittingBonus(hero).atk, 2);
  hero.equipment.weapon = null;
  assert.equal(fittingBonus(hero).atk, 0);
  assert.equal(totalStats(hero).atk, 0);
  hero.equipment.weapon = 'warden_blade';
  assert.equal(totalStats(hero).atk, ITEMS.warden_blade.stats.atk + 2);
});

test('failed fittings change nothing and explain why', () => {
  const poor = armed(10);
  const hero = poor.party[0];
  const snapshot = JSON.stringify(poor);
  const r = applyFitting(poor, hero.id, 'weapon');
  assert.equal(r.ok, false);
  assert.match(r.message, /30 gold/);
  assert.equal(JSON.stringify(poor), snapshot);

  const bare = armed();
  bare.inventory = [];
  assert.match(fittingCheck(bare, hero.id, 'weapon').reason, /Scrap Metal/);
  bare.party[0].equipment.armor = null;
  assert.match(fittingCheck(bare, hero.id, 'armor').reason, /Equip armour first/);
  assert.equal(fittingCheck(bare, hero.id, 'trinket').ok, false);
  assert.equal(fittingCheck(bare, 'nobody', 'weapon').ok, false);
});

test('bad saved fitting values are clamped and fittings survive a save round-trip', () => {
  const hero = { equipment: { weapon: 'iron_sword', armor: null }, temper: { weapon: 99, armor: -2 } };
  assert.equal(fittingLevel(hero, 'weapon'), MAX_FITTING);
  assert.equal(fittingLevel(hero, 'armor'), 0);
  assert.equal(fittingLevel({ temper: { weapon: '2' } }, 'weapon'), 0);
  const s = armed();
  applyFitting(s, s.party[0].id, 'weapon');
  const loaded = migrateSave(JSON.parse(JSON.stringify(s)), createInitialState);
  assert.equal(fittingLevel(loaded.party[0], 'weapon'), 1);
});

test('the forge scene lists each member, fits through its action, and returns to town', () => {
  const s = armed();
  const game = { state: s, scenes: { forge: forgeScene, town: townScene }, setScene(name, data) { this.scene = name; this.scenes[name]?.onEnter?.(this, data); } };
  forgeScene.onEnter(game, { returnScene: 'town' });
  let html = forgeScene.render(game);
  assert.match(html, /<h1>Greyhaven Forge<\/h1>/);
  assert.match(html, /data-action="fit"[^>]*data-arg="hero:weapon"|data-arg="hero:weapon"[^>]*data-action="fit"/);
  assertEggFree(html, 'forge scene');
  forgeScene.actions.fit(game, { dataset: { arg: `${s.party[0].id}:weapon` } });
  assert.equal(fittingLevel(s.party[0], 'weapon'), 1);
  html = forgeScene.render(game);
  assert.match(html, /role="status"/);
  assert.match(html, /Weapon fitting \+1/);
  forgeScene.actions.closeForge(game);
  assert.equal(game.scene, 'town');
});
