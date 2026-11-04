import { test } from 'node:test';
import assert from 'node:assert/strict';

import { statDeltaSummary, createEquipment } from '../src/items/equipment.js';
import { shopScene } from '../src/scenes/shop.js';
import { bagScene } from '../src/scenes/bag.js';
import { createInitialState } from '../src/state.js';
import { grantRewards } from '../src/items/inventory.js';
import { ITEMS, canEquip } from '../src/items/items.js';

const EGG_RE = /\b(eggs?|nests?|nest(ed|ing)?|hatch(ed|ing|es|lings?)?|yolk|chickens?|roosters?|hen|easter|scrambl(e|ed|ing)|omelet(te)?s?|peep(s|ing)?|shells?|shell(ed|ing)?|albumen|ovoid|quiche|meringue|custard|poach(ed|ing)?|frittata|boil\w*|whisk\w*|cackl\w*|pearl|golden|basket|quail|goose|oval|sunny|fried|devil\w*|clutch|incubat\w*|humpty|benedict|faberg\w*|ovum|oeuf|huevo)\b/i;

function shopGame() {
  const game = {
    state: createInitialState(),
    shopMode: undefined,
    shopMessage: '',
    shopReturnScene: undefined,
    lastScene: null,
    registered: {},
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered[name] = scene; },
  };
  return game;
}

function bagGame() {
  const game = {
    state: createInitialState(),
    bagMemberIndex: undefined,
    bagMessage: '',
    bagReturnScene: undefined,
    lastScene: null,
    registered: {},
    setScene(name, data) { game.lastScene = { name, data }; },
    registerScene(name, scene) { game.registered[name] = scene; },
  };
  return game;
}

test('statDeltaSummary returns signed per-stat differences in fixed order', () => {
  assert.equal(statDeltaSummary({ name: 'Iron Sword', stats: { atk: 7 } }, { name: 'Tidebound Cutlass', stats: { atk: 11 } }), '+4 atk');
  assert.equal(
    statDeltaSummary({ stats: { def: 8, hp: 10 } }, { stats: { def: 6, hp: 5 } }),
    '-2 def · -5 hp'
  );
  assert.equal(
    statDeltaSummary({ stats: { atk: 1, mp: 5 } }, { stats: { mp: 8, atk: 1, spd: 2 } }),
    '+3 mp · +2 spd'
  );
});

test('statDeltaSummary handles empty slots, missing stats and exact ties', () => {
  assert.equal(statDeltaSummary(null, { stats: { atk: 3 } }), '');
  assert.equal(statDeltaSummary({ stats: { atk: 3 } }, null), '');
  assert.equal(statDeltaSummary({ stats: { atk: 3 } }, { name: 'Rations' }), '');
  assert.equal(statDeltaSummary({ stats: { atk: 3, def: 1 } }, { stats: { def: 1, atk: 3 } }), 'same stats');
  assert.equal(statDeltaSummary({ stats: {} }, { stats: { spd: 0 } }), 'same stats');
});

test('shop buy tab compares stocked gear against the equipped item in the same slot', () => {
  const game = shopGame();
  game.state.party[0].equipment = { weapon: 'iron_sword', armor: null, trinket: null };
  const html = shopScene.render(game);
  assert.match(html, /vs Iron Sword: -4 atk/); // rusted_pipe (atk+3) in stock
  assert.doesNotMatch(html, /vs Padded Vest/); // empty armor slot: no comparison
  assert.doesNotMatch(html, /vs Trail Rations/); // consumables are never compared
});

test('shop Wardrobe equip buttons show the delta versus what is worn', () => {
  const game = shopGame();
  game.state.party[0].equipment = { weapon: 'rusted_pipe', armor: null, trinket: null };
  game.state.inventory = grantRewards(game.state.inventory, [{ id: 'iron_sword', qty: 1 }]).inv;
  const html = shopScene.render(game);
  assert.match(html, /Equip Iron Sword<\/button> <small>vs Rusted Pipe: \+4 atk<\/small>/);
});

test('bag pack rows show a delta next to Equip for gear that is not worn', () => {
  const game = bagGame();
  game.state.party[0].equipment = createEquipment();
  game.state.party[0].equipment.weapon = 'rusted_pipe';
  game.state.inventory = grantRewards(game.state.inventory, [{ id: 'iron_sword', qty: 1 }]).inv;
  const html = bagScene.render(game);
  assert.match(html, /<button data-action="equip" data-arg="iron_sword">Equip<\/button> <small>\+4 atk<\/small>/);
});

test('bag rows for the currently equipped item carry no delta', () => {
  const game = bagGame();
  game.state.party[0].equipment = createEquipment();
  game.state.party[0].equipment.weapon = 'iron_sword';
  game.state.inventory = grantRewards(game.state.inventory, [{ id: 'iron_sword', qty: 1 }]).inv;
  const html = bagScene.render(game);
  assert.doesNotMatch(html, /data-arg="iron_sword">Equip<\/button> <small>/);
});

test('delta labels across all equipment pairs stay egg-free', () => {
  const gear = Object.values(ITEMS).filter((it) => it && it.slot && canEquip(it.id));
  assert.ok(gear.length >= 10, 'expected a decent gear catalog');
  for (const a of gear) {
    for (const b of gear) {
      const out = statDeltaSummary(a, b);
      assert.ok(!EGG_RE.test(out), `suspicious label: ${out}`);
    }
  }
});
