import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import { bus as sceneBus } from '../src/events.js';
import { saveGame, loadGame } from '../src/state.js';
import { combatScene } from '../src/scenes/combat.js';
import { installDrills, DRILL_FOES, gauntletQueue } from '../src/scenes/drills.js';
import { featStatus, FIELD_TRIALS } from '../src/scenes/feats.js';
import { effectiveStats } from '../src/items/equipment.js';
import { installBag } from '../src/scenes/bag.js';
import { getJournal } from '../src/story/index.js';
import { installBestiary } from '../src/scenes/bestiary.js';
import { getItem } from '../src/items/items.js';
import { installCompanions } from '../src/scenes/muster.js';
import { installShop } from '../src/scenes/shop.js';
import { countItem, grantRewards } from '../src/items/inventory.js';
import { townScene } from '../src/scenes/town.js';
import { endingScene, installEnding } from '../src/scenes/ending.js';
import { titleScene } from '../src/scenes/title.js';
import { installStory } from '../src/story/integration.js';
import { COMMISSIONS, commissionProgress } from '../src/story/commissions.js';
import { installProgression } from '../src/core/progression.js';
import { installMap, ZONES, isWalkable, getEffectiveRandomEncounterChance } from '../src/map/index.js';

// Only the DOM, storage, and randomness are replaced. Movement, combat, story,
// rewards, progression, scene transitions, and save/load use production code.
function harness(t) {
  const oldStorage = globalThis.localStorage;
  const storage = new Map();
  globalThis.localStorage = {
    getItem: key => storage.get(key) ?? null,
    setItem: (key, value) => storage.set(key, String(value)),
    removeItem: key => storage.delete(key),
  };
  t.after(() => { globalThis.localStorage = oldStorage; });
  t.mock.method(Math, 'random', () => 0.5);
  const game = new Game({ innerHTML: '', addEventListener() {} });
  const listeners = new Map();
  game.bus = {
    on(name, fn) { if (!listeners.has(name)) listeners.set(name, new Set()); listeners.get(name).add(fn); },
    off(name, fn) { listeners.get(name)?.delete(fn); },
    emit(name, payload) { for (const fn of listeners.get(name) || []) fn(payload); },
  };
  game.registerScene('combat', combatScene);
  game.registerScene('town', townScene);
  game.registerScene('title', titleScene);
  game.registerScene('ending', endingScene);
  t.after(installStory(game));
  t.after(installEnding(game));
  installProgression(game);
  installShop(game);
  installBag(game);
  installDrills(game);
  installCompanions(game);
  t.after(installBestiary(game));
  t.after(installMap(game, { enableKeyboard: false }));
  game.setScene('explore');
  return game;
}

function act(game, name, arg) {
  const action = game.scenes[game.state.scene].actions?.[name];
  assert.equal(typeof action, 'function', `${game.state.scene} supports ${name}`);
  action(game, { dataset: { arg } });
  game.render();
}

const directions = [[1, 0, 'moveEast'], [-1, 0, 'moveWest'], [0, 1, 'moveSouth'], [0, -1, 'moveNorth']];
function walkTo(game, tx, ty) {
  const map = game.state.map;
  const zone = ZONES[map.zoneId];
  const queue = [[map.x, map.y, []]];
  const seen = new Set([`${map.x},${map.y}`]);
  let path;
  while (queue.length) {
    const [x, y, steps] = queue.shift();
    if (x === tx && y === ty) { path = steps; break; }
    for (const [dx, dy, action] of directions) {
      const nx = x + dx, ny = y + dy, key = `${nx},${ny}`;
      if (seen.has(key) || !isWalkable(zone, map, nx, ny)) continue;
      // NPC tiles talk without moving; exits transition immediately. Neither
      // may be used as an intermediate tile in a walking route.
      if (zone.npcs?.some(n => n.x === nx && n.y === ny)) continue;
      if ((nx !== tx || ny !== ty) && zone.exits?.some(e => e.x === nx && e.y === ny)) continue;
      if ((nx !== tx || ny !== ty) && zone.encounters?.some(e => e.x === nx && e.y === ny && !map.clearedEncounters[e.encounterId])) continue;
      seen.add(key);
      queue.push([nx, ny, [...steps, action]]);
    }
  }
  assert.ok(path, `walkable route in ${zone.id} to ${tx},${ty}`);
  for (const action of path) {
    assert.equal(game.state.scene, 'explore', 'route must not conceal an unexpected battle');
    act(game, action);
  }
}

function walkExit(game, destination) {
  const exit = ZONES[game.state.map.zoneId].exits.find(e => e.toZone === destination);
  assert.ok(exit, `route to ${destination} exists`);
  walkTo(game, exit.x, exit.y);
  assert.equal(game.state.map.zoneId, destination);
  assert.equal(game.state.location, destination);
}

function winEncounter(game, id) {
  const encounter = ZONES[game.state.map.zoneId].encounters.find(e => e.encounterId === id);
  walkTo(game, encounter.x, encounter.y);
  assert.equal(game.state.scene, 'combat');
  assert.equal(game.state.combat.encounterId, id);
  const reward = game.state.combat.enemy.gold;
  const before = game.state.gold;
  const species = game.state.combat.enemy.id;
  const priorCount = game.state.bestiary?.[species] || 0;
  for (let turn = 0; !game.state.combat.over && turn < 100; turn++) act(game, 'attack');
  assert.equal(game.state.combat.over, 'victory', `win ${id} with legitimately earned stats and recruited allies`);
  assert.equal(game.state.gold, before + reward);
  assert.equal(game.state.bestiary[species], priorCount + 1, 'actual victory records the species exactly once');
  act(game, 'finish');
  assert.equal(game.state.scene, 'explore');
  assert.equal(game.state.combat, null);
  assert.equal(game.state.bestiary[species], priorCount + 1, 'finishing combat cannot count the same defeat twice');
  assert.equal(game.state.map.clearedEncounters[id], true);
  assert.equal(game.state.map.activeEncounterId, null);
  return reward;
}

function checkpoint(game, stage) {
  assert.equal(game.state.story.stage, stage);
  const before = structuredClone(game.state);
  saveGame(game.state);
  game.state = loadGame();
  assert.ok(game.state, 'saved campaign can be loaded');
  for (const key of ['story', 'map', 'party', 'gold', 'location', 'inventory', 'bestiary']) {
    assert.deepEqual(game.state[key], before[key], `${key} survives ${stage} reload`);
  }
  game.setScene(game.state.scene);
  assert.equal(game.state.story.stage, stage);
}

const rescueRoutes = {
  coast: { zone: 'saltmere_coast', encounter: 'saltmere_rescue', cache: 'saltmere_supply_cache' },
  heights: { zone: 'highwatch_pass', encounter: 'highwatch_rescue', cache: 'highwatch_supply_cache' },
};

function rescueJourney(game, first) {
  let combatGold = 0;
  for (const routeId of [first, first === 'coast' ? 'heights' : 'coast']) {
    const route = rescueRoutes[routeId];
    assert.equal(game.state.map.zoneId, 'greyhaven');
    act(game, 'mapTravel', route.zone);
    assert.equal(game.state.map.zoneId, 'greyhaven', 'new rescue routes require physical discovery');
    if (routeId === 'heights') walkExit(game, 'ridge_road');
    walkExit(game, route.zone);
    assert.equal(game.state.story.flags[`rescue_visit_${routeId}`], true);
    combatGold += winEncounter(game, route.encounter);
    assert.equal(game.state.story.flags[`rescue_victory_${routeId}`], true);
    const cache = ZONES[route.zone].interactables.find(i => i.id === route.cache);
    walkTo(game, cache.x, cache.y);
    act(game, 'mapInteract', route.cache);
    assert.equal(game.state.map.completedInteractions[route.cache], true, 'supply cache is physically reachable');
    const collected = structuredClone(game.state.inventory);
    act(game, 'mapInteract', route.cache);
    assert.deepEqual(game.state.inventory, collected, 'collected cache cannot duplicate supplies');
    checkpoint(game, game.state.story.stage);
    walkExit(game, routeId === 'coast' ? 'greyhaven' : 'ridge_road');
    if (routeId === 'heights') walkExit(game, 'greyhaven');
  }
  assert.equal(game.state.story.flags.rescue_first, first);
  assert.equal(game.state.story.flags.rescue_reward, undefined, 'clearing roads does not auto-pay');
  return combatGold;
}

function recruitAndRest(game) {
  act(game, 'toTownScene');
  act(game, 'muster');
  act(game, 'recruit', 'tamsin');
  act(game, 'recruit', 'iven');
  assert.deepEqual(game.state.party.map(m => m.id), ['hero', 'tamsin', 'iven']);
  act(game, 'leave');
  const before = game.state.gold;
  act(game, 'rest');
  assert.equal(game.state.gold, before - 5);
  act(game, 'explore');
}

function optionalBossJourney(game, first) {
  const originalEnding = game.state.story.ending;
  const originalStory = structuredClone(game.state.story);
  const routes = {
    coast: { zone: 'saltmere_coast', encounter: 'saltmere_tide_wraith', species: 'drowned_harbormaster' },
    heights: { zone: 'highwatch_pass', encounter: 'highwatch_warlord', species: 'pass_warlord' },
  };
  // Buy the coastal weapon at its actual map stall, using expedition earnings.
  walkExit(game, 'saltmere_coast');
  walkTo(game, 2, 3);
  act(game, 'mapInteract', 'saltmere_post');
  assert.equal(game.state.scene, 'shop');
  assert.equal(game.shopId, 'saltmere_post');
  assert.match(game.root.innerHTML, /Saltmere Trading Post/);
  const beforePurchase = game.state.gold;
  act(game, 'buy', 'tidebound_cutlass');
  assert.equal(game.state.gold, beforePurchase - getItem('tidebound_cutlass').price);
  act(game, 'equip', 'tidebound_cutlass');
  assert.equal(game.state.party[0].equipment.weapon, 'tidebound_cutlass');
  act(game, 'leave');
  assert.equal(game.state.scene, 'explore');
  assert.equal(game.state.map.zoneId, 'saltmere_coast');
  walkExit(game, 'greyhaven');
  for (const id of [first, first === 'coast' ? 'heights' : 'coast']) {
    const route = routes[id];
    act(game, 'toTownScene');
    const beforeRest = game.state.gold;
    act(game, 'rest');
    assert.equal(game.state.gold, beforeRest - 5);
    act(game, 'explore');
    if (id === 'heights') walkExit(game, 'ridge_road');
    walkExit(game, route.zone);
    assert.equal(game.state.bestiary?.[route.species], undefined);
    winEncounter(game, route.encounter);
    assert.equal(game.state.bestiary[route.species], 1);
    checkpoint(game, 'complete');
    walkExit(game, id === 'coast' ? 'greyhaven' : 'ridge_road');
    if (id === 'heights') walkExit(game, 'greyhaven');
  }
  assert.deepEqual(game.state.story, { ...originalStory, flags: { ...originalStory.flags, commission_bram_victory: true } }, 'optional bosses retain Bram’s early commission fact without altering or repaying the completed expedition');
  assert.equal(game.state.story.ending, originalEnding);
  act(game, 'toTownScene');
  act(game, 'bestiary');
  assert.match(game.root.innerHTML, /Drowned Harbormaster/);
  assert.match(game.root.innerHTML, /Highwatch Warlord/);
  assert.doesNotMatch(game.root.innerHTML, /Rockslide Golem/, 'unfought species remain undisclosed');
  checkpoint(game, 'complete');
  act(game, 'leave');
  assert.equal(game.state.scene, 'town');
}

function oldTuskLockedJourney(game) {
  assert.equal(game.state.story.flags.rescue_reward, undefined);
  walkExit(game, 'ridge_road');
  walkTo(game, 6, 3);
  const before = structuredClone(game.state);
  for (const [action, arg] of [['mapEncounter', 'ridge_old_tusk'], ['moveNorth']]) {
    act(game, action, arg);
    assert.match(game.state.map.log.at(-1), /report to Mara/);
    assert.deepEqual({ ...game.state, map: { ...game.state.map, log: before.map.log } }, before,
      'the unpaid rescue gate changes only its explanatory map log');
  }
  walkExit(game, 'greyhaven');
}

function oldTuskJourney(game) {
  assert.equal(game.state.scene, 'town');
  const beforeRest = game.state.gold;
  act(game, 'rest');
  assert.equal(game.state.gold, beforeRest - 5);
  act(game, 'explore');
  walkExit(game, 'ridge_road');
  walkTo(game, 6, 3);
  assert.equal(game.state.story.flags.rescue_reward, true);
  assert.equal(game.state.bestiary?.old_tusk, undefined);
  assert.equal(featStatus(game.state).find(f => f.id === 'tusk').done, false);
  assert.equal(DRILL_FOES.includes('old_tusk'), false);
  const before = structuredClone(game.state);
  const protectedKeys = ['story', 'flags', 'drillRecords', 'drillGauntlet'];
  act(game, 'mapEncounter', 'ridge_old_tusk');
  assert.equal(game.state.scene, 'combat');
  assert.equal(game.state.combat.encounterId, 'ridge_old_tusk');
  assert.equal(game.state.combat.enemy.id, 'old_tusk');
  assert.equal(game.state.combat.enemy.boss, true);
  assert.equal(game.state.combat.enemy.maxHp, 130);
  assert.notEqual(game.state.combat.drill, true);
  for (let turn = 0; !game.state.combat.over && turn < 100; turn++) act(game, 'attack');
  assert.equal(game.state.combat.over, 'victory', 'earned Cutlass and recruited allies win the optional ridge trial');
  assert.equal(game.state.gold, before.gold + 55);
  game.state.party.forEach((m, i) => assert.equal(m.xp, before.party[i].xp + 85));
  const loot = [{ id: 'hearty_chowder', qty: 2 }, { id: 'field_dressing', qty: 2 }];
  assert.deepEqual(game.state.combat.rewards.items, loot);
  const expectedInventory = structuredClone(before.inventory);
  for (const drop of loot) {
    const stack = expectedInventory.find(item => item.id === drop.id);
    if (stack) stack.qty += drop.qty;
    else expectedInventory.push({ ...drop });
  }
  assert.deepEqual(game.state.inventory, expectedInventory);
  const expectedBook = { ...before.bestiary, old_tusk: 1 };
  assert.deepEqual(game.state.bestiary, expectedBook);
  for (const key of protectedKeys) assert.deepEqual(game.state[key], before[key], `${key} is untouched by Old Tusk`);
  assert.equal(featStatus(game.state).find(f => f.id === 'tusk').done, true);
  act(game, 'finish');
  assert.equal(game.state.scene, 'explore');
  assert.equal(game.state.combat, null);
  assert.equal(game.state.map.activeEncounterId, null);
  assert.deepEqual(game.state.map.clearedEncounters, { ...before.map.clearedEncounters, ridge_old_tusk: true });
  assert.deepEqual(game.state.map.completedInteractions, before.map.completedInteractions);
  assert.deepEqual(game.state.inventory, expectedInventory);
  assert.deepEqual(game.state.bestiary, expectedBook);
  assert.equal(game.state.gold, before.gold + 55);
  game.state.party.forEach((m, i) => assert.equal(m.xp, before.party[i].xp + 85));
  checkpoint(game, 'complete');
  const cleared = structuredClone(game.state);
  act(game, 'mapEncounter', 'ridge_old_tusk');
  assert.equal(game.state.scene, 'explore');
  assert.equal(game.state.combat, null);
  for (const key of [...protectedKeys, 'party', 'inventory', 'gold', 'bestiary']) {
    assert.deepEqual(game.state[key], cleared[key], `cleared Old Tusk cannot change ${key}`);
  }
  assert.equal(featStatus(game.state).find(f => f.id === 'tusk').done, true);
  walkExit(game, 'greyhaven');
  act(game, 'toTownScene');
}

function gloomfinLockedJourney(game) {
  assert.equal(game.state.story.flags.rescue_reward, undefined);
  walkExit(game, 'saltmere_coast');
  walkTo(game, 6, 1);
  const before = structuredClone(game.state);
  for (const [action, arg] of [['mapEncounter', 'saltmere_gloomfin'], ['moveEast']]) {
    act(game, action, arg);
    assert.match(game.state.map.log.at(-1), /report to Mara/);
    assert.deepEqual({ ...game.state, map: { ...game.state.map, log: before.map.log } }, before,
      'the unpaid rescue gate changes only its explanatory map log');
  }
  walkExit(game, 'greyhaven');
}

function gloomfinJourney(game) {
  assert.equal(game.state.scene, 'town');
  const beforeRest = game.state.gold;
  act(game, 'rest');
  assert.equal(game.state.gold, beforeRest - 5);
  act(game, 'explore');
  walkExit(game, 'saltmere_coast');
  walkTo(game, 6, 1);
  assert.equal(game.state.story.flags.rescue_reward, true);
  assert.equal(game.state.bestiary?.gloomfin, undefined);
  assert.equal(featStatus(game.state).find(f => f.id === 'gloomfin').done, false);
  assert.equal(DRILL_FOES.includes('gloomfin'), false);
  const before = structuredClone(game.state);
  const protectedKeys = ['story', 'flags', 'drillRecords', 'drillGauntlet'];
  act(game, 'mapEncounter', 'saltmere_gloomfin');
  assert.equal(game.state.scene, 'combat');
  assert.equal(game.state.combat.encounterId, 'saltmere_gloomfin');
  assert.equal(game.state.combat.enemy.id, 'gloomfin');
  assert.equal(game.state.combat.enemy.boss, true);
  assert.equal(game.state.combat.enemy.maxHp, 150);
  assert.notEqual(game.state.combat.drill, true);
  for (let turn = 0; !game.state.combat.over && turn < 100; turn++) act(game, 'attack');
  assert.equal(game.state.combat.over, 'victory', 'earned Cutlass and recruited allies win the optional coast trial');
  assert.equal(game.state.gold, before.gold + 60);
  game.state.party.forEach((m, i) => assert.equal(m.xp, before.party[i].xp + 95));
  const loot = [{ id: 'storm_glass', qty: 2 }, { id: 'storm_tonic', qty: 2 }];
  assert.deepEqual(game.state.combat.rewards.items, loot);
  const expectedInventory = structuredClone(before.inventory);
  for (const drop of loot) {
    const stack = expectedInventory.find(item => item.id === drop.id);
    if (stack) stack.qty += drop.qty;
    else expectedInventory.push({ ...drop });
  }
  assert.deepEqual(game.state.inventory, expectedInventory);
  const expectedBook = { ...before.bestiary, gloomfin: 1 };
  assert.deepEqual(game.state.bestiary, expectedBook);
  for (const key of protectedKeys) assert.deepEqual(game.state[key], before[key], `${key} is untouched by Gloomfin`);
  assert.equal(featStatus(game.state).find(f => f.id === 'gloomfin').done, true);
  act(game, 'finish');
  assert.equal(game.state.scene, 'explore');
  assert.equal(game.state.combat, null);
  assert.equal(game.state.map.activeEncounterId, null);
  assert.deepEqual(game.state.map.clearedEncounters, { ...before.map.clearedEncounters, saltmere_gloomfin: true });
  assert.deepEqual(game.state.map.completedInteractions, before.map.completedInteractions);
  assert.deepEqual(game.state.inventory, expectedInventory);
  assert.deepEqual(game.state.bestiary, expectedBook);
  assert.equal(game.state.gold, before.gold + 60);
  game.state.party.forEach((m, i) => assert.equal(m.xp, before.party[i].xp + 95));
  checkpoint(game, 'complete');
  const cleared = structuredClone(game.state);
  act(game, 'mapEncounter', 'saltmere_gloomfin');
  assert.equal(game.state.scene, 'explore');
  assert.equal(game.state.combat, null);
  for (const key of [...protectedKeys, 'party', 'inventory', 'gold', 'bestiary']) {
    assert.deepEqual(game.state[key], cleared[key], `cleared Gloomfin cannot change ${key}`);
  }
  assert.equal(featStatus(game.state).find(f => f.id === 'gloomfin').done, true);
  walkExit(game, 'greyhaven');
  act(game, 'toTownScene');
}

function frostmaneLockedJourney(game) {
  assert.equal(game.state.story.flags.rescue_reward, undefined);
  walkExit(game, 'ridge_road');
  walkExit(game, 'highwatch_pass');
  walkTo(game, 1, 4);
  const before = structuredClone(game.state);
  for (const [action, arg] of [['mapEncounter', 'highwatch_frostmane'], ['moveSouth']]) {
    act(game, action, arg);
    assert.match(game.state.map.log.at(-1), /report to Mara/);
    assert.deepEqual({ ...game.state, map: { ...game.state.map, log: before.map.log } }, before,
      'the unpaid rescue gate changes only its explanatory map log');
  }
  walkExit(game, 'ridge_road');
  walkExit(game, 'greyhaven');
}

function frostmaneJourney(game) {
  assert.equal(game.state.scene, 'town');
  const beforeRest = game.state.gold;
  act(game, 'rest');
  assert.equal(game.state.gold, beforeRest - 5);
  act(game, 'explore');
  walkExit(game, 'ridge_road');
  walkExit(game, 'highwatch_pass');
  walkTo(game, 1, 4);
  assert.equal(game.state.story.flags.rescue_reward, true);
  assert.equal(game.state.bestiary?.frostmane, undefined);
  assert.equal(featStatus(game.state).find(f => f.id === 'frostmane').done, false);
  assert.equal(DRILL_FOES.includes('frostmane'), false);
  const before = structuredClone(game.state);
  const protectedKeys = ['story', 'flags', 'drillRecords', 'drillGauntlet'];
  act(game, 'mapEncounter', 'highwatch_frostmane');
  assert.equal(game.state.scene, 'combat');
  assert.equal(game.state.combat.encounterId, 'highwatch_frostmane');
  assert.equal(game.state.combat.enemy.id, 'frostmane');
  assert.equal(game.state.combat.enemy.boss, true);
  assert.equal(game.state.combat.enemy.maxHp, 160);
  assert.notEqual(game.state.combat.drill, true);
  for (let turn = 0; !game.state.combat.over && turn < 100; turn++) act(game, 'attack');
  assert.equal(game.state.combat.over, 'victory', 'earned Cutlass and recruited allies win the optional Highwatch trial');
  assert.equal(game.state.gold, before.gold + 65);
  game.state.party.forEach((m, i) => assert.equal(m.xp, before.party[i].xp + 105));
  const loot = [{ id: 'highland_flask', qty: 2 }];
  assert.deepEqual(game.state.combat.rewards.items, loot);
  const expectedInventory = structuredClone(before.inventory);
  for (const drop of loot) {
    const stack = expectedInventory.find(item => item.id === drop.id);
    if (stack) stack.qty += drop.qty;
    else expectedInventory.push({ ...drop });
  }
  assert.deepEqual(game.state.inventory, expectedInventory);
  const expectedBook = { ...before.bestiary, frostmane: 1 };
  assert.deepEqual(game.state.bestiary, expectedBook);
  for (const key of protectedKeys) assert.deepEqual(game.state[key], before[key], `${key} is untouched by Frostmane`);
  assert.equal(featStatus(game.state).find(f => f.id === 'frostmane').done, true);
  act(game, 'finish');
  assert.equal(game.state.scene, 'explore');
  assert.equal(game.state.combat, null);
  assert.equal(game.state.map.activeEncounterId, null);
  assert.deepEqual(game.state.map.clearedEncounters, { ...before.map.clearedEncounters, highwatch_frostmane: true });
  assert.deepEqual(game.state.map.completedInteractions, before.map.completedInteractions);
  assert.deepEqual(game.state.inventory, expectedInventory);
  assert.deepEqual(game.state.bestiary, expectedBook);
  assert.equal(game.state.gold, before.gold + 65);
  game.state.party.forEach((m, i) => assert.equal(m.xp, before.party[i].xp + 105));
  checkpoint(game, 'complete');
  const cleared = structuredClone(game.state);
  act(game, 'mapEncounter', 'highwatch_frostmane');
  assert.equal(game.state.scene, 'explore');
  assert.equal(game.state.combat, null);
  for (const key of [...protectedKeys, 'party', 'inventory', 'gold', 'bestiary']) {
    assert.deepEqual(game.state[key], cleared[key], `cleared Frostmane cannot change ${key}`);
  }
  assert.equal(featStatus(game.state).find(f => f.id === 'frostmane').done, true);
  walkExit(game, 'ridge_road');
  walkExit(game, 'greyhaven');
  act(game, 'toTownScene');
}

function lenswardenLockedJourney(game) {
  assert.equal(game.state.story.flags.rescue_reward, undefined);
  walkExit(game, 'ridge_road');
  walkExit(game, 'observatory_ruins');
  walkTo(game, 6, 1);
  const before = structuredClone(game.state);
  for (const [action, arg] of [['mapEncounter', 'observatory_lenswarden'], ['moveEast']]) {
    act(game, action, arg);
    assert.match(game.state.map.log.at(-1), /report to Mara/);
    assert.deepEqual({ ...game.state, map: { ...game.state.map, log: before.map.log } }, before,
      'the unpaid rescue gate changes only its explanatory map log');
  }
  walkExit(game, 'ridge_road');
  walkExit(game, 'greyhaven');
}

function lenswardenJourney(game) {
  assert.equal(game.state.scene, 'town');
  const beforeRest = game.state.gold;
  act(game, 'rest');
  assert.equal(game.state.gold, beforeRest - 5);
  act(game, 'explore');
  walkExit(game, 'ridge_road');
  walkExit(game, 'observatory_ruins');
  walkTo(game, 6, 1);
  assert.equal(game.state.story.flags.rescue_reward, true);
  assert.equal(game.state.bestiary?.lenswarden, undefined);
  assert.equal(featStatus(game.state).find(f => f.id === 'lenswarden').done, false);
  for (const id of ['old_tusk', 'gloomfin', 'frostmane']) assert.ok(game.state.bestiary[id] > 0, `${id} was earned earlier`);
  assert.equal(featStatus(game.state).find(f => f.id === 'trials').done, false);
  assert.equal(DRILL_FOES.includes('lenswarden'), false);
  const before = structuredClone(game.state);
  const protectedKeys = ['story', 'flags', 'drillRecords', 'drillGauntlet'];
  act(game, 'mapEncounter', 'observatory_lenswarden');
  assert.equal(game.state.scene, 'combat');
  assert.equal(game.state.combat.encounterId, 'observatory_lenswarden');
  assert.equal(game.state.combat.enemy.id, 'lenswarden');
  assert.equal(game.state.combat.enemy.boss, true);
  assert.equal(game.state.combat.enemy.maxHp, 170);
  assert.notEqual(game.state.combat.drill, true);
  for (let turn = 0; !game.state.combat.over && turn < 100; turn++) act(game, 'attack');
  assert.equal(game.state.combat.over, 'victory', 'earned Cutlass and recruited allies win the optional Observatory trial');
  assert.equal(game.state.gold, before.gold + 70);
  game.state.party.forEach((m, i) => assert.equal(m.xp, before.party[i].xp + 110));
  const loot = [{ id: 'storm_glass', qty: 2 }];
  assert.deepEqual(game.state.combat.rewards.items, loot);
  const expectedInventory = structuredClone(before.inventory);
  for (const drop of loot) {
    const stack = expectedInventory.find(item => item.id === drop.id);
    if (stack) stack.qty += drop.qty;
    else expectedInventory.push({ ...drop });
  }
  assert.deepEqual(game.state.inventory, expectedInventory);
  const expectedBook = { ...before.bestiary, lenswarden: 1 };
  assert.deepEqual(game.state.bestiary, expectedBook);
  for (const key of protectedKeys) assert.deepEqual(game.state[key], before[key], `${key} is untouched by Lenswarden`);
  assert.equal(featStatus(game.state).find(f => f.id === 'lenswarden').done, true);
  assert.equal(featStatus(game.state).find(f => f.id === 'trials').done, true);
  act(game, 'finish');
  assert.equal(game.state.scene, 'explore');
  assert.equal(game.state.combat, null);
  assert.equal(game.state.map.activeEncounterId, null);
  assert.deepEqual(game.state.map.clearedEncounters, { ...before.map.clearedEncounters, observatory_lenswarden: true });
  assert.deepEqual(game.state.map.completedInteractions, before.map.completedInteractions);
  assert.deepEqual(game.state.inventory, expectedInventory);
  assert.deepEqual(game.state.bestiary, expectedBook);
  assert.equal(game.state.gold, before.gold + 70);
  game.state.party.forEach((m, i) => assert.equal(m.xp, before.party[i].xp + 110));
  checkpoint(game, 'complete');
  const cleared = structuredClone(game.state);
  act(game, 'mapEncounter', 'observatory_lenswarden');
  assert.equal(game.state.scene, 'explore');
  assert.equal(game.state.combat, null);
  for (const key of [...protectedKeys, 'party', 'inventory', 'gold', 'bestiary']) {
    assert.deepEqual(game.state[key], cleared[key], `cleared Lenswarden cannot change ${key}`);
  }
  assert.equal(featStatus(game.state).find(f => f.id === 'lenswarden').done, true);
  assert.equal(featStatus(game.state).find(f => f.id === 'trials').done, true);
  walkExit(game, 'ridge_road');
  walkExit(game, 'greyhaven');
  act(game, 'toTownScene');
}

function relayJourney(game, choice, early) {
  const ending = game.state.story.ending;
  assert.equal(game.state.scene, 'town');
  if (!early) act(game, 'storyRelayAccept');
  const beforeRest = game.state.gold;
  act(game, 'rest'); assert.equal(game.state.gold, beforeRest - 5);
  act(game, 'explore');
  act(game, 'mapTravel', 'sunscar_relay');
  assert.equal(game.state.map.zoneId, 'greyhaven', 'relay requires physical discovery');
  const reachRelay = () => {
    walkExit(game, 'ridge_road'); walkExit(game, 'highwatch_pass'); walkExit(game, 'sunscar_relay');
  };
  reachRelay();
  assert.equal(game.state.story.flags.relay_visit, true);
  walkTo(game, 3, 1); act(game, 'mapInteract', 'relay_junction');
  assert.equal(game.state.story.flags.relay_junction, true);
  walkTo(game, 2, 5); act(game, 'mapInteract', 'relay_supply_cache');
  assert.equal(game.state.map.completedInteractions.relay_supply_cache, true);
  const cached = structuredClone(game.state.inventory);
  act(game, 'mapInteract', 'relay_supply_cache'); assert.deepEqual(game.state.inventory, cached);
  walkTo(game, 6, 4); act(game, 'mapInteract', 'relay_outpost');
  assert.equal(game.state.scene, 'shop'); assert.equal(game.shopId, 'relay_outpost');
  assert.match(game.root.innerHTML, /Relay Outpost Stores/);
  const beforePurchase = game.state.gold;
  act(game, 'buy', 'relay_glaive');
  assert.equal(game.state.gold, beforePurchase - getItem('relay_glaive').price);
  act(game, 'equip', 'relay_glaive');
  assert.equal(game.state.party[0].equipment.weapon, 'relay_glaive');
  act(game, 'leave'); assert.equal(game.state.map.zoneId, 'sunscar_relay');
  // Reaching the console by a side path cannot bypass its fixed-encounter lock.
  walkTo(game, 7, 3); act(game, 'mapInteract', 'relay_console');
  assert.equal(game.state.story.flags.relay_console, undefined);
  assert.doesNotMatch(game.root.innerHTML, /data-action="storyRelayChoose"/);
  winEncounter(game, 'relay_warden');
  assert.equal(game.state.story.flags.relay_victory, true);
  assert.equal(game.state.bestiary.relay_warden, 1);
  checkpoint(game, 'complete');
  walkTo(game, 7, 3); act(game, 'mapInteract', 'relay_console');
  assert.equal(game.state.story.flags.relay_console, true);
  if (early) {
    assert.equal(game.state.story.flags.relay_accepted, undefined);
    act(game, 'storyRelayChoose', choice);
    assert.equal(game.state.story.flags.relay_choice, undefined, 'early facts still need explicit commission');
    walkExit(game, 'greyhaven'); act(game, 'toTownScene');
    act(game, 'storyRelayAccept'); checkpoint(game, 'complete');
    act(game, 'explore'); reachRelay(); walkTo(game, 7, 3);
  }
  assert.match(game.root.innerHTML, /data-action="storyRelayChoose"/);
  walkTo(game, 6, 4); act(game, 'storyRelayChoose', choice);
  assert.equal(game.state.story.flags.relay_choice, undefined, 'walking away invalidates a stale console button');
  walkTo(game, 7, 3); checkpoint(game, 'complete');
  const beforeChoice = game.state.gold;
  act(game, 'storyRelayChoose', choice);
  assert.equal(game.state.gold, beforeChoice + 100);
  assert.equal(game.state.story.flags.relay_choice, choice);
  assert.equal(game.state.story.flags.relay_reward, true);
  assert.equal(game.state.story.ending, ending);
  assert.equal(game.state.scene, 'explore', 'relay choice never replays chapter-one ending');
  checkpoint(game, 'complete');
  act(game, 'storyRelayChoose', choice === 'shelter_network' ? 'route_network' : 'shelter_network');
  assert.equal(game.state.gold, beforeChoice + 100);
  assert.equal(game.state.story.flags.relay_choice, choice);
  assert.equal(getEffectiveRandomEncounterChance(game.state, ZONES.sunscar_relay), choice === 'route_network' ? 0.07 : 0.14);
  walkExit(game, 'greyhaven');
  const price = choice === 'shelter_network' ? 2 : 5;
  walkTo(game, 1, 2);
  assert.match(game.root.innerHTML, new RegExp(`Rest at[^<]+\\(${price}g\\)`));
  const beforeMapRest = game.state.gold;
  act(game, 'mapInteract', 'greyhaven_inn');
  assert.equal(game.state.gold, beforeMapRest - price);
  act(game, 'toTownScene');
  assert.match(game.root.innerHTML, new RegExp(`Rest at the inn · ${price} gold`));
  const beforeTownRest = game.state.gold;
  act(game, 'rest'); assert.equal(game.state.gold, beforeTownRest - price);
  checkpoint(game, 'complete');
  act(game, 'bestiary'); assert.match(game.root.innerHTML, /Relay Warden/);
  assert.equal(game.state.bestiary.relay_warden, 1);
}

function cinderclawLockedJourney(game) {
  assert.notEqual(game.state.story.flags.spire_reward, true);
  walkExit(game, 'sunscar_relay');
  walkTo(game, 3, 5);
  const before = structuredClone(game.state);
  const events = [];
  const capture = event => events.push(event);
  sceneBus.on('scene:enter', capture);
  game.bus.on('story:event', capture);
  let rolls = 0;
  game.mapRng = () => { rolls++; return 0.5; };
  try {
    for (const [action, arg] of [['mapEncounter', 'sunscar_cinderclaw'], ['moveEast']]) {
      act(game, action, arg);
      assert.deepEqual({ ...game.state, map: { ...game.state.map, log: before.map.log } }, before,
        'unpaid Spire gate changes only the explanatory map log');
    }
    assert.equal(rolls, 0);
    assert.deepEqual(events, []);
  } finally {
    delete game.mapRng;
    sceneBus.off('scene:enter', capture);
    game.bus.off('story:event', capture);
  }
  walkExit(game, 'stormcrown_spire');
}

function cinderclawJourney(game) {
  assert.equal(game.state.scene, 'explore');
  assert.equal(game.state.map.zoneId, 'greyhaven');
  assert.equal(game.state.story.flags.spire_reward, true);
  act(game, 'toTownScene');
  const restGold = game.state.gold;
  act(game, 'rest');
  assert.equal(game.state.gold, restGold - (game.state.story.flags.relay_choice === 'shelter_network' ? 2 : 5));
  act(game, 'explore');
  walkExit(game, 'ridge_road'); walkExit(game, 'highwatch_pass'); walkExit(game, 'sunscar_relay');
  walkTo(game, 3, 5);
  assert.equal(game.state.bestiary.cinderclaw, undefined);
  assert.equal(DRILL_FOES.includes('cinderclaw'), false);
  assert.equal(DRILL_FOES.length, 7);
  assert.deepEqual(FIELD_TRIALS, ['old_tusk', 'gloomfin', 'frostmane', 'lenswarden']);
  const before = structuredClone(game.state);
  const trialWarden = featStatus(before).find(f => f.id === 'trials').done;
  assert.equal(featStatus(before).find(f => f.id === 'cinderclaw').done, false);
  const protectedKeys = ['story', 'flags', 'drillRecords', 'drillGauntlet', 'reserve'];
  act(game, 'moveEast');
  assert.equal(game.state.scene, 'combat');
  const combat = game.state.combat;
  assert.equal(combat.encounterId, 'sunscar_cinderclaw');
  assert.equal(combat.enemy.id, 'cinderclaw');
  assert.equal(combat.enemy.maxHp, 440);
  assert.deepEqual([combat.enemy.atk, combat.enemy.def, combat.enemy.spd], [29, 10, 6]);
  assert.notEqual(combat.drill, true);
  for (let turn = 0; !game.state.combat.over && turn < 100; turn++) act(game, 'attack');
  assert.equal(game.state.combat.over, 'victory', 'earned post-Spire gear and recruited allies win Cinderclaw');
  assert.equal(game.state.gold, before.gold + 140);
  game.state.party.forEach((m, i) => assert.equal(m.xp, before.party[i].xp + 260));
  const loot = [{ id: 'spiced_broth', qty: 2 }];
  assert.deepEqual(game.state.combat.rewards.items, loot);
  const inventory = structuredClone(before.inventory);
  for (const drop of loot) {
    const stack = inventory.find(item => item.id === drop.id);
    if (stack) stack.qty += drop.qty;
    else inventory.push({ ...drop });
  }
  const book = { ...before.bestiary, cinderclaw: 1 };
  assert.deepEqual(game.state.inventory, inventory);
  assert.deepEqual(game.state.bestiary, book);
  for (const key of protectedKeys) assert.deepEqual(game.state[key], before[key]);
  assert.equal(featStatus(game.state).find(f => f.id === 'trials').done, trialWarden);
  assert.equal(featStatus(game.state).find(f => f.id === 'cinderclaw').done, true);
  act(game, 'finish');
  assert.equal(game.state.scene, 'explore');
  assert.equal(game.state.combat, null);
  assert.equal(game.state.map.activeEncounterId, null);
  assert.deepEqual(game.state.map.clearedEncounters, { ...before.map.clearedEncounters, sunscar_cinderclaw: true });
  assert.deepEqual(game.state.map.completedInteractions, before.map.completedInteractions);
  assert.deepEqual(game.state.inventory, inventory);
  assert.deepEqual(game.state.bestiary, book);
  assert.equal(game.state.gold, before.gold + 140);
  game.state.party.forEach((m, i) => assert.equal(m.xp, before.party[i].xp + 260));
  for (const key of protectedKeys) assert.deepEqual(game.state[key], before[key]);
  checkpoint(game, 'complete');
  assert.equal(featStatus(game.state).find(f => f.id === 'cinderclaw').done, true);
  const cleared = structuredClone(game.state);
  act(game, 'mapEncounter', 'sunscar_cinderclaw');
  assert.deepEqual({ ...game.state, map: { ...game.state.map, log: cleared.map.log } }, cleared,
    'a stale cleared-encounter action cannot repeat combat or rewards');
  walkExit(game, 'greyhaven');
}

function spireJourney(game, choice, early) {
  const ending = game.state.story.ending;
  act(game, 'leave'); // field journal → town
  if (!early) act(game, 'storySpire', 'accept');
  act(game, 'explore');
  act(game, 'mapTravel', 'stormcrown_spire');
  assert.equal(game.state.map.zoneId, 'greyhaven', 'summit requires discovery');
  const reachSpire = () => {
    walkExit(game, 'ridge_road'); walkExit(game, 'highwatch_pass');
    walkExit(game, 'sunscar_relay'); walkExit(game, 'stormcrown_spire');
  };
  reachSpire();
  assert.equal(game.state.story.flags.spire_visit, true);
  for (const id of ['survey_records_a', 'survey_records_b', 'spire_supply_cache']) {
    const target = ZONES.stormcrown_spire.interactables.find(i => i.id === id);
    walkTo(game, target.x, target.y); act(game, 'mapInteract', id);
  }
  assert.equal(game.state.story.flags.survey_records_a, true);
  assert.equal(game.state.story.flags.survey_records_b, true);
  const inventory = structuredClone(game.state.inventory);
  act(game, 'mapInteract', 'spire_supply_cache');
  assert.deepEqual(game.state.inventory, inventory, 'summit cache cannot duplicate');
  // Approach the summit from the western side without stepping on its boss.
  walkTo(game, 3, 0); act(game, 'mapInteract', 'spire_summit');
  assert.equal(game.state.story.flags.spire_summit, undefined, 'summit remains boss-gated');
  winEncounter(game, 'spire_sentry_post');
  winEncounter(game, 'spire_raider_camp');
  assert.equal(game.state.story.flags.spire_victory, undefined, 'other spire species cannot clear Tyrant');
  walkTo(game, 4, 5); act(game, 'mapInteract', 'stormcrown_post');
  assert.equal(game.shopId, 'stormcrown_post');
  assert.match(game.root.innerHTML, /Stormcrown Trading Post/);
  const beforeSale = game.state.gold;
  act(game, 'sell', 'tidebound_cutlass');
  assert.equal(game.state.gold, beforeSale + getItem('tidebound_cutlass').sellPrice);
  const beforePurchase = game.state.gold;
  act(game, 'buy', 'stormforged_blade');
  assert.equal(game.state.gold, beforePurchase - 235, 'summit weapon bought with earned gold');
  act(game, 'equip', 'stormforged_blade');
  assert.equal(game.state.party[0].equipment.weapon, 'stormforged_blade');
  act(game, 'leave');
  // Take the lift home for a real paid rest before the major fight.
  walkExit(game, 'greyhaven'); act(game, 'toTownScene');
  const beforeRest = game.state.gold;
  act(game, 'rest');
  assert.equal(game.state.gold, beforeRest - (choice === 'shelter_network' ? 2 : 5));
  act(game, 'explore'); reachSpire();
  winEncounter(game, 'stormcrown_tyrant');
  assert.equal(game.state.story.flags.spire_victory, true);
  assert.equal(game.state.bestiary.stormcrown_tyrant, 1);
  checkpoint(game, 'complete');
  walkTo(game, 4, 0); act(game, 'mapInteract', 'spire_summit');
  assert.equal(game.state.story.flags.spire_summit, true);
  // The summit passage stays shut until the survey is actually reported.
  walkTo(game, 5, 1);
  const passagePosition = { x: game.state.map.x, y: game.state.map.y, steps: game.state.map.steps };
  act(game, 'moveNorth');
  assert.deepEqual({ x: game.state.map.x, y: game.state.map.y, steps: game.state.map.steps }, passagePosition);
  act(game, 'mapTravel', 'storms_eye');
  assert.equal(game.state.map.zoneId, 'stormcrown_spire');
  assert.equal(game.state.story.flags.heart_visit, undefined);
  cinderclawLockedJourney(game);
  const beforeReport = game.state.gold;
  act(game, 'storySpire', 'report');
  assert.equal(game.state.gold, beforeReport, 'stale report outside town cannot pay');
  walkExit(game, 'greyhaven');
  if (early) {
    assert.equal(game.state.story.flags.spire_accepted, undefined);
    act(game, 'storySpire', 'accept');
    checkpoint(game, 'complete');
  }
  act(game, 'storyTalk', 'mara');
  assert.equal(game.state.gold, beforeReport, 'ordinary conversation does not report');
  act(game, 'storySpire', 'report');
  assert.equal(game.state.gold, beforeReport + 150);
  assert.equal(game.state.story.flags.spire_reward, true);
  assert.equal(game.state.scene, 'ending', 'explicit summit report opens the finale');
  assert.match(game.root.innerHTML, /Stormhaven Endures/);
  assert.equal(game.state.flags.finaleShown, true);
  checkpoint(game, 'complete');
  act(game, 'keepExploring');
  assert.equal(game.state.scene, 'explore');
  checkpoint(game, 'complete');
  act(game, 'storySpire', 'report');
  assert.equal(game.state.gold, beforeReport + 150, 'summit report pays once after reload');
  assert.equal(game.state.story.ending, ending);
  assert.equal(game.state.story.flags.relay_choice, choice);
  assert.equal(game.state.story.flags.relief_reward, true);
  assert.equal(game.state.story.flags.rescue_reward, true);

  const patrolFight = (species, roll) => {
    // Only the encounter-selection RNG is controlled, never the resulting state.
    game.mapRng = () => roll;
    act(game, 'mapPatrol');
    delete game.mapRng;
    assert.equal(game.state.scene, 'combat');
    assert.equal(game.state.combat.encounterId, null, 'patrol is not a fixed encounter');
    assert.equal(game.state.combat.enemy.id, species);
    const before = game.state.gold;
    const reward = game.state.combat.enemy.gold;
    const priorCount = game.state.bestiary?.[species] || 0;
    for (let turn = 0; !game.state.combat.over && turn < 100; turn++) act(game, 'attack');
    assert.equal(game.state.combat.over, 'victory');
    assert.equal(game.state.gold, before + reward, 'quota never auto-pays');
    assert.equal(game.state.bestiary[species], priorCount + 1);
    act(game, 'finish');
    assert.equal(game.state.bestiary[species], priorCount + 1, 'finish does not double-count');
  };
  for (const contract of [
    { id: 'sunscar_patrol', zone: 'sunscar_relay', species: 'dust_marauder', roll: 0.25, wrong: 'relay_drone', wrongRoll: 0.75, gold: 35 },
    { id: 'spire_patrol', zone: 'stormcrown_spire', species: 'spire_sentry', roll: 0.75, wrong: 'ashen_raider', wrongRoll: 0.25, gold: 60 },
  ]) {
    act(game, 'storyExpedition', contract.id);
    assert.deepEqual(game.state.story.expedition.active, { id: contract.id, progress: 0 }, 'historical victories do not count');
    act(game, 'toTownScene'); act(game, 'rest'); act(game, 'explore');
    walkExit(game, 'ridge_road'); walkExit(game, 'highwatch_pass'); walkExit(game, 'sunscar_relay');
    if (contract.zone === 'stormcrown_spire') walkExit(game, contract.zone);
    patrolFight(contract.wrong, contract.wrongRoll);
    assert.equal(game.state.story.expedition.active.progress, 0, 'wrong species never counts');
    for (let n = 1; n <= 2; n++) {
      patrolFight(contract.species, contract.roll);
      assert.equal(game.state.story.expedition.active.progress, n);
      checkpoint(game, 'complete');
    }
    const beforeClaim = game.state.gold;
    act(game, 'storyExpedition', 'claim');
    assert.equal(game.state.gold, beforeClaim, 'patrol payment requires town');
    walkExit(game, 'greyhaven'); act(game, 'storyExpedition', 'claim');
    assert.equal(game.state.gold, beforeClaim + contract.gold);
    assert.equal(game.state.story.expedition.active, null);
    checkpoint(game, 'complete');
    act(game, 'storyExpedition', 'claim');
    assert.equal(game.state.gold, beforeClaim + contract.gold, 'duplicate patrol claim cannot pay');
    assert.equal(game.state.scene, 'explore', 'later rewards do not replay the finale');
  }
  assert.equal(game.state.story.expedition.completed, 2);
  act(game, 'storyExpedition', 'spire_patrol');
  assert.equal(game.state.story.expedition.active.progress, 0, 'repeat starts from zero');
  reachSpire(); patrolFight('spire_sentry', 0.75);
  assert.equal(game.state.story.expedition.active.progress, 1);
  checkpoint(game, 'complete'); walkExit(game, 'greyhaven');
  const beforeCancel = game.state.gold;
  act(game, 'storyExpedition', 'cancel');
  assert.equal(game.state.story.expedition.active, null);
  assert.equal(game.state.gold, beforeCancel, 'cancellation never pays');
  act(game, 'storyExpedition', 'spire_patrol');
  assert.equal(game.state.story.expedition.active.progress, 0, 'cancelled partial progress is discarded');
  act(game, 'storyExpedition', 'cancel');
  assert.equal(game.state.story.expedition.completed, 2);
  assert.equal(game.state.story.ending, ending);
  assert.equal(game.state.story.flags.relay_choice, choice);
  checkpoint(game, 'complete');
  cinderclawJourney(game);
}

function companionJourney(game, early, first) {
  const originalEnding = game.state.story.ending;
  const relay = game.state.story.flags.relay_choice;
  const expedition = structuredClone(game.state.story.expedition);
  const partyIds = game.state.party.map(m => m.id);
  assert.deepEqual(partyIds, ['hero', 'bram', 'sela'], 'requests do not require Tamsin or Iven in the active party');
  assert.equal(game.state.map.zoneId, 'greyhaven');
  for (const c of COMMISSIONS) {
    assert.equal(commissionProgress(game.state.story, c.id).available, true);
    assert.equal(commissionProgress(game.state.story, c.id).accepted, false);
    if (!early) act(game, 'storyCommissionAccept', c.id);
  }
  assert.equal(game.state.story.flags.commission_tamsin_inspected, true, 'original dispatch already counts');
  assert.equal(game.state.story.flags.commission_bram_victory, true, 'earlier Harbormaster victory already counts');
  act(game, 'toTownScene'); act(game, 'rest'); act(game, 'explore');
  const beforeTasks = game.state.gold;
  let combatGold = 0;
  walkExit(game, 'ridge_road');
  combatGold += winEncounter(game, 'ridge_hound_den'); checkpoint(game, 'complete');
  walkExit(game, 'observatory_ruins');
  combatGold += winEncounter(game, 'observatory_construct'); checkpoint(game, 'complete');
  walkTo(game, 4, 1); act(game, 'mapInteract', 'observatory_lens_pedestal');
  assert.equal(game.state.map.completedInteractions.observatory_lens_pedestal, true);
  checkpoint(game, 'complete');
  walkExit(game, 'beacon_tower'); walkExit(game, 'greyhaven');
  for (const id of [first, first === 'coast' ? 'heights' : 'coast']) {
    if (id === 'coast') {
      walkExit(game, 'saltmere_coast');
      walkTo(game, 4, 5); act(game, 'mapInteract', 'saltmere_harbor_lamp');
      assert.equal(game.state.story.flags.commission_bram_inspected, true);
    } else {
      walkExit(game, 'ridge_road'); walkExit(game, 'highwatch_pass');
      walkTo(game, 4, 1); act(game, 'mapInteract', 'highwatch_cairn');
      assert.equal(game.state.story.flags.commission_sela_inspected, true);
      combatGold += winEncounter(game, 'highwatch_construct');
    }
    checkpoint(game, 'complete');
    const beforeStale = game.state.gold;
    for (const c of COMMISSIONS) act(game, 'storyCommissionReport', c.id);
    assert.equal(game.state.gold, beforeStale, 'stale reports outside Greyhaven cannot pay');
    if (id === 'heights') walkExit(game, 'ridge_road');
    walkExit(game, 'greyhaven');
  }
  assert.equal(game.state.gold, beforeTasks + combatGold, 'tasks themselves pay enemy loot only');
  for (const c of COMMISSIONS) {
    if (early) {
      assert.equal(commissionProgress(game.state.story, c.id).accepted, false);
      act(game, 'storyCommissionReport', c.id);
      assert.equal(game.state.story.flags[`commission_${c.id}_reward`], undefined, 'facts alone cannot claim an unaccepted request');
      act(game, 'storyCommissionAccept', c.id);
    }
    assert.equal(commissionProgress(game.state.story, c.id).ready, true);
    checkpoint(game, 'complete');
    const beforeReport = game.state.gold;
    act(game, 'storyCommissionReport', c.id);
    assert.equal(game.state.gold, beforeReport + c.gold);
    assert.equal(commissionProgress(game.state.story, c.id).complete, true);
    assert.equal(game.state.scene, 'explore', 'personal reports do not replay either ending');
    checkpoint(game, 'complete');
    act(game, 'storyCommissionReport', c.id); act(game, 'storyCommissionAccept', c.id);
    assert.equal(game.state.gold, beforeReport + c.gold, 'reloaded report and acceptance cannot repay');
  }
  assert.equal(game.state.gold, beforeTasks + combatGold + 150);
  assert.equal(game.state.story.ending, originalEnding);
  assert.equal(game.state.story.flags.relay_choice, relay);
  assert.equal(game.state.story.flags.rescue_reward, true);
  assert.equal(game.state.story.flags.spire_reward, true);
  assert.equal(game.state.flags.finaleShown, true);
  assert.deepEqual(game.state.story.expedition, expedition);
  assert.deepEqual(game.state.party.map(m => m.id), partyIds);
  checkpoint(game, 'complete');
}


function heartJourney(game, early, first) {
  const prior = structuredClone(game.state.story);
  const endingFlags = structuredClone(game.state.flags);
  const choice = prior.flags.relay_choice;
  const restPrice = choice === 'shelter_network' ? 2 : 5;
  assert.equal(game.state.map.zoneId, 'greyhaven');
  if (!early) act(game, 'storyHeart', 'accept');
  const rest = () => {
    act(game, 'toTownScene');
    const before = game.state.gold;
    act(game, 'rest');
    assert.equal(game.state.gold, before - restPrice);
    act(game, 'explore');
  };
  const reachEye = () => {
    walkExit(game, 'ridge_road'); walkExit(game, 'highwatch_pass');
    walkExit(game, 'sunscar_relay'); walkExit(game, 'stormcrown_spire');
    walkExit(game, 'storms_eye');
  };
  rest();
  act(game, 'mapTravel', 'storms_eye');
  assert.equal(game.state.map.zoneId, 'greyhaven', 'unvisited eye still requires physical discovery');
  reachEye();
  assert.equal(game.state.story.flags.heart_visit, true);
  assert.equal(game.state.map.x, 1); assert.equal(game.state.map.y, 5);
  // Buy both upgrades from the actual mapped shop, financed before core loot.
  walkTo(game, 4, 5); act(game, 'mapInteract', 'storms_eye_post');
  assert.equal(game.state.scene, 'shop');
  assert.equal(game.shopId, 'storms_eye_post');
  assert.match(game.root.innerHTML, /Storm&#39;s Eye Post/);
  const beforeShop = game.state.gold;
  act(game, 'buy', 'tempest_edge'); act(game, 'equip', 'tempest_edge');
  assert.equal(game.state.party[0].equipment.weapon, 'tempest_edge');
  act(game, 'sell', 'stormforged_blade');
  act(game, 'buy', 'maelstrom_plate'); act(game, 'equip', 'maelstrom_plate');
  assert.equal(game.state.party[0].equipment.armor, 'maelstrom_plate');
  assert.equal(game.state.gold, beforeShop - getItem('tempest_edge').price
    + getItem('stormforged_blade').sellPrice - getItem('maelstrom_plate').price);
  act(game, 'leave');
  walkTo(game, 2, 5);
  const beforeCache = structuredClone(game.state.inventory);
  act(game, 'mapInteract', 'eye_supply_cache');
  for (const id of ['storm_tonic', 'ember_broth', 'thunder_iron']) {
    assert.equal(countItem(game.state.inventory, id), countItem(beforeCache, id) + 1);
  }
  const collected = structuredClone(game.state.inventory);
  act(game, 'mapInteract', 'eye_supply_cache');
  assert.deepEqual(game.state.inventory, collected);
  checkpoint(game, 'complete');
  const blockedCore = () => {
    walkTo(game, 4, 4);
    const before = { x: game.state.map.x, y: game.state.map.y, steps: game.state.map.steps };
    act(game, 'mapEncounter', 'storm_heart_core');
    act(game, 'moveNorth');
    assert.equal(game.state.scene, 'explore');
    assert.deepEqual({ x: game.state.map.x, y: game.state.map.y, steps: game.state.map.steps }, before);
    assert.equal(game.state.map.activeEncounterId, null);
    assert.equal(game.state.story.flags.victory_storm_heart, undefined);
  };
  blockedCore();
  const order = first === 'coast' ? ['west', 'east'] : ['east', 'west'];
  for (const [index, side] of order.entries()) {
    const id = `eye_anchor_${side}`;
    const guardian = side === 'west' ? 'eye_west_shade' : 'eye_east_colossus';
    winEncounter(game, guardian);
    assert.equal(game.state.story.flags.victory_storm_heart, undefined, 'guardian is not the exact core');
    const anchor = ZONES.storms_eye.interactables.find(i => i.id === id);
    walkTo(game, anchor.x, anchor.y); act(game, 'mapInteract', id);
    assert.equal(game.state.map.completedInteractions[id], true);
    assert.equal(game.state.story.flags[id], true);
    checkpoint(game, 'complete');
    if (index === 0) blockedCore();
  }
  // The lift remains usable; pay for recovery rather than injecting health.
  walkExit(game, 'greyhaven'); rest(); reachEye();
  const chance = choice === 'route_network' ? 0.07 : 0.14;
  assert.equal(getEffectiveRandomEncounterChance(game.state, ZONES.storms_eye), chance);
  winEncounter(game, 'storm_heart_core');
  assert.equal(game.state.story.flags.victory_storm_heart, true);
  assert.equal(game.state.bestiary.storm_heart, 1);
  assert.equal(game.state.story.flags.heart_reward, undefined);
  for (const zone of ['storms_eye', 'stormcrown_spire']) {
    assert.equal(getEffectiveRandomEncounterChance(game.state, ZONES[zone]), chance / 2);
  }
  assert.equal(getEffectiveRandomEncounterChance(game.state, ZONES.sunscar_relay), chance);
  checkpoint(game, 'complete');
  const beforeReport = game.state.gold;
  act(game, 'storyHeart', 'report');
  assert.equal(game.state.gold, beforeReport, 'stale out-of-town report cannot pay');
  walkExit(game, 'greyhaven');
  if (early) {
    assert.equal(game.state.story.flags.heart_accepted, undefined);
    act(game, 'storyHeart', 'report');
    assert.equal(game.state.gold, beforeReport, 'early discoveries alone do not accept or pay');
    act(game, 'storyHeart', 'accept');
    checkpoint(game, 'complete');
  }
  act(game, 'storyTalk', 'mara');
  assert.equal(game.state.gold, beforeReport, 'conversation cannot submit the report');
  act(game, 'storyExpedition', 'eye_sweep');
  assert.deepEqual(game.state.story.expedition, prior.expedition, 'even defeating the core does not unlock Sweep before reporting');
  act(game, 'storyHeart', 'report');
  assert.equal(game.state.gold, beforeReport + 200);
  assert.equal(game.state.story.flags.heart_reward, true);
  assert.equal(game.state.scene, 'explore', 'heart report does not replay either ending');
  checkpoint(game, 'complete');
  act(game, 'storyHeart', 'report'); act(game, 'storyHeart', 'accept');
  assert.equal(game.state.gold, beforeReport + 200, 'reloaded report cannot duplicate payment');
  for (const [key, value] of Object.entries(prior.flags)) {
    assert.deepEqual(game.state.story.flags[key], value, `heart preserves prior flag ${key}`);
  }
  assert.equal(game.state.story.ending, prior.ending);
  assert.deepEqual(game.state.story.expedition, prior.expedition);
  assert.deepEqual(game.state.flags, endingFlags);
  assert.deepEqual(game.state.party.map(m => m.id), ['hero', 'bram', 'sela']);

  act(game, 'storyExpedition', 'eye_sweep');
  assert.deepEqual(game.state.story.expedition.active, { id: 'eye_sweep', progress: 0 });
  act(game, 'toTownScene'); act(game, 'rest'); act(game, 'explore');
  walkExit(game, 'ridge_road'); walkExit(game, 'highwatch_pass'); walkExit(game, 'sunscar_relay');
  walkExit(game, 'stormcrown_spire'); walkExit(game, 'storms_eye');
  for (let n = 1; n <= 2; n++) {
    game.mapRng = () => 0.25; act(game, 'mapPatrol'); delete game.mapRng;
    assert.equal(game.state.combat.encounterId, null);
    assert.equal(game.state.combat.enemy.id, 'tempest_shade');
    const before = game.state.gold, loot = game.state.combat.enemy.gold;
    const defeated = game.state.bestiary.tempest_shade;
    for (let turn = 0; !game.state.combat.over && turn < 100; turn++) act(game, 'attack');
    assert.equal(game.state.combat.over, 'victory');
    assert.equal(game.state.gold, before + loot, 'Sweep never pays automatically');
    assert.equal(game.state.story.expedition.active.progress, n);
    act(game, 'finish');
    assert.equal(game.state.bestiary.tempest_shade, defeated + 1);
    checkpoint(game, 'complete');
  }
  const beforeSweep = game.state.gold;
  act(game, 'storyExpedition', 'claim'); assert.equal(game.state.gold, beforeSweep);
  walkExit(game, 'greyhaven'); act(game, 'storyExpedition', 'claim');
  assert.equal(game.state.gold, beforeSweep + 90);
  assert.equal(game.state.story.expedition.completed, prior.expedition.completed + 1);
  checkpoint(game, 'complete'); act(game, 'storyExpedition', 'claim');
  assert.equal(game.state.gold, beforeSweep + 90);
  act(game, 'storyExpedition', 'eye_sweep');
  assert.equal(game.state.story.expedition.active.progress, 0);
  act(game, 'storyExpedition', 'cancel');
  assert.equal(game.state.story.expedition.active, null);
  assert.deepEqual(game.state.flags, endingFlags);
}

function watchJourney(game, early, first) {
  assert.equal(game.state.map.zoneId, 'greyhaven');
  assert.equal(game.state.story.flags.heart_reward, true);
  assert.equal(game.state.story.flags.victory_last_squall, undefined, 'survey is independent of the optional superboss');
  const prior = structuredClone(game.state.story), endingFlags = structuredClone(game.state.flags);
  const gold = game.state.gold, party = structuredClone(game.state.party), inventory = structuredClone(game.state.inventory);
  const bestiary = structuredClone(game.state.bestiary);
  assert.equal(game.state.map.completedInteractions.observatory_lens_pedestal, true, 'old lens was already collected');
  const routes = {
    coast: { zones: ['saltmere_coast'], x: 4, y: 5, id: 'saltmere_harbor_lamp', flag: 'watch_coast', home: ['greyhaven'] },
    heights: { zones: ['ridge_road', 'highwatch_pass'], x: 4, y: 1, id: 'highwatch_cairn', flag: 'watch_heights', home: ['ridge_road', 'greyhaven'] },
    observatory: { zones: ['ridge_road', 'observatory_ruins'], x: 3, y: 1, id: 'observatory_forecast_stand', flag: 'watch_observatory', home: ['beacon_tower', 'greyhaven'] },
  };
  const order = early ? ['observatory', first, first === 'coast' ? 'heights' : 'coast']
    : [first, first === 'coast' ? 'heights' : 'coast', 'observatory'];
  const inspect = (route, accepted) => {
    for (const zone of route.zones) walkExit(game, zone);
    walkTo(game, route.x, route.y); act(game, 'mapInteract', route.id);
    assert.equal(game.state.story.flags[route.flag], accepted ? true : undefined);
    checkpoint(game, 'complete');
    const story = structuredClone(game.state.story);
    act(game, 'mapInteract', route.id);
    assert.deepEqual(game.state.story, story, 'repeat reading cannot add progress or rewards');
    act(game, 'storyWatch', 'report'); act(game, 'storyWatch', 'accept');
    assert.deepEqual(game.state.story, story, 'stale out-of-town controls do nothing');
    assert.equal(game.state.gold, gold);
    for (const zone of route.home) walkExit(game, zone);
  };
  if (early) {
    for (const id of order) inspect(routes[id], false);
    assert.equal(game.state.story.flags.watch_accepted, undefined);
  }
  act(game, 'storyTalk', 'mara');
  assert.equal(game.state.story.flags.watch_accepted, undefined, 'conversation never accepts');
  act(game, 'storyWatch', 'accept'); checkpoint(game, 'complete');
  for (const route of Object.values(routes)) assert.equal(game.state.story.flags[route.flag], undefined, 'old inspections receive no credit');
  for (const [index, id] of order.entries()) {
    act(game, 'storyWatch', 'report'); assert.equal(game.state.gold, gold, 'partial report cannot pay');
    inspect(routes[id], true);
    assert.equal(Object.values(routes).filter(route => game.state.story.flags[route.flag] === true).length, index + 1);
    act(game, 'storyWatch', 'accept');
    assert.equal(game.state.story.flags[routes[id].flag], true, 'repeat acceptance never resets progress');
  }
  assert.match(getJournal(game.state.story).find(q => q.id === 'long_watch').objective, /explicitly report/);
  act(game, 'storyTalk', 'mara'); assert.equal(game.state.gold, gold, 'conversation never pays');
  const beforeWatchPay = structuredClone(game.state);
  act(game, 'storyCalibration', 'accept');
  assert.deepEqual(game.state, beforeWatchPay, 'unpaid Watch cannot unlock calibration');
  act(game, 'storyWatch', 'report');
  assert.equal(game.state.gold, gold + 180);
  assert.equal(game.state.story.flags.watch_reward, true);
  assert.equal(game.state.scene, 'explore', 'survey opens no new ending');
  checkpoint(game, 'complete');
  act(game, 'storyWatch', 'report'); act(game, 'storyWatch', 'accept');
  assert.equal(game.state.gold, gold + 180, 'saved report pays exactly once');
  assert.equal(getJournal(game.state.story).find(q => q.id === 'long_watch').status, 'complete');
  assert.equal(game.state.story.flags.victory_last_squall, undefined);
  assert.equal(game.state.map.completedInteractions.observatory_lens_pedestal, true);
  assert.equal(game.state.map.completedInteractions.observatory_forecast_stand, undefined, 'stand remains repeatable');
  for (const [key, value] of Object.entries(prior.flags)) assert.deepEqual(game.state.story.flags[key], value, `survey preserves ${key}`);
  assert.equal(game.state.story.ending, prior.ending); assert.deepEqual(game.state.story.expedition, prior.expedition);
  assert.deepEqual(game.state.flags, endingFlags); assert.deepEqual(game.state.party, party);
  assert.deepEqual(game.state.inventory, inventory); assert.deepEqual(game.state.bestiary, bestiary);
}

function calibrationJourney(game) {
  assert.equal(game.state.map.zoneId, 'greyhaven');
  assert.equal(game.state.story.flags.watch_reward, true);
  assert.equal(game.state.story.flags.victory_last_squall, undefined);
  const prior = structuredClone(game.state.story), gold = game.state.gold;
  const protectedState = () => structuredClone(Object.fromEntries(Object.entries(game.state)
    .filter(([key]) => !['story', 'gold', 'map', 'location', 'scene', 'log'].includes(key))));
  const protectedBefore = protectedState();
  const fields = ['calibration_reference', 'calibration_spire', 'calibration_relay'];
  act(game, 'storyTalk', 'mara');
  assert.equal(game.state.story.flags.calibration_accepted, undefined, 'talk never accepts');
  act(game, 'storyCalibration', 'accept'); checkpoint(game, 'complete');
  for (const flag of fields) assert.equal(game.state.story.flags[flag], undefined, 'no historical reading credit');
  act(game, 'storyCalibration', 'report'); assert.equal(game.state.gold, gold);
  for (const zone of ['ridge_road', 'highwatch_pass', 'sunscar_relay']) walkExit(game, zone);
  walkTo(game, 3, 1); act(game, 'mapInteract', 'relay_junction');
  assert.equal(game.state.story.flags.calibration_relay, undefined, 'junction read on ascent is premature');
  walkExit(game, 'stormcrown_spire');
  walkTo(game, 7, 3); act(game, 'mapInteract', 'survey_records_b');
  assert.equal(game.state.story.flags.calibration_spire, undefined, 'barometer read on ascent is premature');
  walkExit(game, 'storms_eye');
  const inspect = (id, x, y, index) => {
    walkTo(game, x, y); act(game, 'mapInteract', id);
    assert.equal(game.state.story.flags[fields[index]], true);
    assert.equal(fields.filter(flag => game.state.story.flags[flag] === true).length, index + 1);
    assert.equal(game.state.gold, gold);
    checkpoint(game, 'complete');
    const story = structuredClone(game.state.story);
    act(game, 'mapInteract', id);
    act(game, 'storyCalibration', 'report'); act(game, 'storyCalibration', 'accept');
    assert.deepEqual(game.state.story, story, 'repeat inspection and stale outside controls do nothing');
    assert.equal(game.state.gold, gold);
  };
  inspect('eye_reference_gauge', 3, 5, 0);
  assert.equal(game.state.map.completedInteractions.eye_reference_gauge, undefined, 'gauge remains repeatable');
  walkExit(game, 'stormcrown_spire');
  inspect('survey_records_b', 7, 3, 1);
  walkExit(game, 'sunscar_relay');
  inspect('relay_junction', 3, 1, 2);
  walkExit(game, 'greyhaven');
  assert.match(getJournal(game.state.story).find(q => q.id === 'signal_calibration').objective, /explicitly report.*220 gold/);
  act(game, 'storyTalk', 'mara'); assert.equal(game.state.gold, gold, 'talk never pays');
  const beforeCalibrationPay = structuredClone(game.state);
  act(game, 'storyExpedition', 'signal_line_patrol');
  assert.deepEqual(game.state, beforeCalibrationPay, 'unpaid Calibration cannot unlock Signal Line Patrol');
  act(game, 'storyCalibration', 'report');
  assert.equal(game.state.gold, gold + 220); assert.equal(game.state.story.flags.calibration_reward, true);
  assert.equal(game.state.scene, 'explore', 'no ending is replayed');
  checkpoint(game, 'complete');
  const paid = structuredClone(game.state);
  act(game, 'storyCalibration', 'report'); act(game, 'storyCalibration', 'accept');
  assert.deepEqual(game.state, paid, 'saved reward and stale acceptance are whole-state no-ops');
  assert.equal(getJournal(game.state.story).find(q => q.id === 'signal_calibration').status, 'complete');
  assert.deepEqual(protectedState(), protectedBefore);
  const oldStory = structuredClone(game.state.story);
  for (const key of ['calibration_accepted', ...fields, 'calibration_reward']) delete oldStory.flags[key];
  assert.deepEqual(oldStory, prior, 'old ending, relay purpose, quests and expedition stay unchanged');
}


function signalLineJourney(game, reverse) {
  assert.equal(game.state.map.zoneId, 'greyhaven');
  assert.equal(game.state.story.flags.calibration_reward, true);
  const prior = structuredClone(game.state.story), flags = structuredClone(game.state.flags);
  const id = 'signal_line_patrol';
  const targets = { dust_marauder: 0, spire_sentry: 0, tempest_shade: 0 };
  act(game, 'storyExpedition', id);
  assert.deepEqual(game.state.story.expedition.active, { id, progress: 0, targets });
  checkpoint(game, 'complete');
  act(game, 'toTownScene'); act(game, 'rest'); act(game, 'explore');
  for (const zone of ['ridge_road', 'highwatch_pass', 'sunscar_relay']) walkExit(game, zone);
  const routes = reverse ? [
    { zones: ['stormcrown_spire', 'storms_eye'], enemy: 'tempest_shade', rng: .25 },
    { zones: ['stormcrown_spire'], enemy: 'spire_sentry', rng: .75 },
    { zones: ['sunscar_relay'], enemy: 'dust_marauder', rng: .25 },
  ] : [
    { zones: [], enemy: 'dust_marauder', rng: .25 },
    { zones: ['stormcrown_spire'], enemy: 'spire_sentry', rng: .75 },
    { zones: ['storms_eye'], enemy: 'tempest_shade', rng: .25 },
  ];
  for (const [index, route] of routes.entries()) {
    for (const zone of route.zones) walkExit(game, zone);
    // A second genuine victory against the first target cannot substitute for another region.
    for (let repeat = 0; repeat < (index === 0 ? 2 : 1); repeat++) {
      game.mapRng = () => route.rng; act(game, 'mapPatrol'); delete game.mapRng;
      const c = game.state.combat;
      assert.equal(c.enemy.id, route.enemy); assert.equal(c.encounterId, null); assert.notEqual(c.drill, true);
      const gold = game.state.gold, xp = game.state.party.map(m => m.xp), book = game.state.bestiary[route.enemy] || 0;
      const inv = structuredClone(game.state.inventory);
      for (let turn = 0; !c.over && turn < 100; turn++) act(game, 'attack');
      assert.equal(c.over, 'victory');
      assert.equal(game.state.gold, gold + c.rewards.gold, 'only normal battle gold, never board payment');
      game.state.party.forEach((m, i) => assert.equal(m.xp, xp[i] + c.rewards.xp));
      const expected = grantRewards(inv, c.rewards.items); assert.equal(expected.ok, true);
      assert.deepEqual(game.state.inventory, expected.inv);
      assert.equal(game.state.bestiary[route.enemy], book + 1);
      targets[route.enemy] = 1;
      const active = { id, progress: index + 1, targets: { ...targets } };
      assert.deepEqual(game.state.story.expedition.active, active);
      act(game, 'finish'); assert.equal(game.state.combat, null);
      assert.deepEqual(game.state.story.expedition.active, active);
      checkpoint(game, 'complete');
      const before = structuredClone(game.state); act(game, 'storyExpedition', 'claim');
      assert.deepEqual(game.state, before, 'out-of-town claim is a whole-state no-op');
    }
  }
  walkExit(game, 'greyhaven');
  const gold = game.state.gold;
  act(game, 'storyTalk', 'mara'); assert.equal(game.state.gold, gold, 'talk never pays');
  const beforeClaim = structuredClone(game.state);
  act(game, 'storyExpedition', 'claim');
  const expected = structuredClone(beforeClaim); expected.gold += 120;
  expected.story.expedition = { active: null, completed: prior.expedition.completed + 1 };
  assert.deepEqual(game.state, expected, 'claim changes only gold and shared expedition completion');
  checkpoint(game, 'complete');
  const paid = structuredClone(game.state); act(game, 'storyExpedition', 'claim'); assert.deepEqual(game.state, paid);
  act(game, 'storyExpedition', id);
  assert.deepEqual(game.state.story.expedition.active, { id, progress: 0, targets: { dust_marauder: 0, spire_sentry: 0, tempest_shade: 0 } });
  act(game, 'storyExpedition', 'cancel');
  assert.deepEqual(game.state, paid, 'repeat and cancellation reset counts without changing payment or saved journey');
  assert.deepEqual({ ...game.state.story, expedition: prior.expedition }, prior, 'all older story flags, ending and relay choice survive');
  assert.deepEqual(game.state.flags, flags);
}

// These are real refights of bosses defeated earlier in this same campaign.
// No stats, victories, unlocks or inventories are injected for the drills.
function drillJourney(game) {
  act(game, 'toTownScene');
  assert.ok(game.state.bestiary.drowned_harbormaster > 0);
  assert.ok(game.state.bestiary.last_squall > 0);
  const protectedState = () => structuredClone(Object.fromEntries(
    ['gold', 'inventory', 'bestiary', 'story', 'flags', 'map', 'location'].map(key => [key, game.state[key]])
  ));
  let fieldVictories = 0;
  const countVictory = () => { fieldVictories++; };
  game.bus.on('combat:victory', countVictory);
  act(game, 'drills');
  for (let repeat = 0; repeat < 2; repeat++) {
    const before = protectedState();
    const beforeXp = game.state.party.map(member => member.xp);
    act(game, 'startDrill', 'drowned_harbormaster');
    const combat = game.state.combat;
    assert.equal(combat.drill, true);
    assert.equal(combat.encounterId, null);
    const xp = Math.floor(combat.enemy.xp / 2);
    for (let turn = 0; !combat.over && turn < 100; turn++) act(game, 'attack');
    assert.equal(combat.over, 'victory');
    assert.deepEqual(combat.rewards, { xp, gold: 0, items: [] });
    assert.deepEqual(protectedState(), before, 'a drill win cannot change campaign progress or give spoils');
    game.state.party.forEach((member, index) => assert.equal(member.xp, beforeXp[index] + xp));
    const rewardedXp = game.state.party.map(member => member.xp);
    act(game, 'finish');
    assert.equal(game.state.scene, 'drills');
    assert.equal(game.state.combat, null);
    assert.deepEqual(protectedState(), before);
    assert.deepEqual(game.state.party.map(member => member.xp), rewardedXp, 'Finish cannot duplicate XP');
    checkpoint(game, 'complete');
    assert.deepEqual(protectedState(), before);
  }
  // Deliberately remove the allies and gear through the same controls a player
  // uses; defending alone against the Last Squall then causes a genuine loss.
  act(game, 'closeDrills'); act(game, 'muster');
  act(game, 'dismiss', 'bram'); act(game, 'dismiss', 'sela'); act(game, 'leave');
  act(game, 'bag');
  for (const slot of ['weapon', 'armor', 'trinket']) act(game, 'unequip', slot);
  act(game, 'leave');
  assert.equal(game.state.party.length, 1);
  const beforeLoss = protectedState();
  const beforeXp = game.state.party[0].xp;
  act(game, 'drills'); act(game, 'startDrill', 'last_squall');
  for (let turn = 0; !game.state.combat.over && turn < 100; turn++) act(game, 'defend');
  assert.equal(game.state.combat.over, 'defeat');
  assert.equal(game.state.party[0].hp, 0);
  assert.equal(game.state.party[0].xp, beforeXp);
  assert.deepEqual(protectedState(), beforeLoss);
  act(game, 'finish');
  assert.equal(game.state.scene, 'drills');
  assert.equal(game.state.combat, null);
  assert.deepEqual(protectedState(), beforeLoss, 'lost drill costs no gold and does not relocate the map');
  const hero = game.state.party[0], stats = effectiveStats(hero);
  assert.equal(hero.hp, Math.ceil(stats.maxHp / 2));
  assert.equal(hero.mp, stats.maxMp);
  assert.deepEqual(hero.statuses, []);
  assert.equal(hero.xp, beforeXp);
  assert.match(game.drillsMessage, /nothing is lost but pride/);
  checkpoint(game, 'complete');
  assert.deepEqual(protectedState(), beforeLoss);
  assert.equal(fieldVictories, 0, 'drills must not emit real field-victory events');
  game.bus.off('combat:victory', countVictory);
}

// Restore the earned party through player controls, unlock the remaining field
// boss on foot, then win and lose real gauntlets without injected progression.
function gauntletJourney(game) {
  act(game, 'closeDrills'); act(game, 'muster');
  for (const id of ['bram', 'sela']) act(game, 'recruit', id);
  act(game, 'leave'); act(game, 'bag');
  for (const [slot, id] of [['weapon', 'tempest_edge'], ['armor', 'maelstrom_plate'], ['trinket', 'heartward_charm']]) {
    act(game, 'equip', id);
    assert.equal(game.state.party[0].equipment[slot], id, 'earned gear was actually equipped');
  }
  act(game, 'leave'); act(game, 'rest'); act(game, 'explore');
  for (const zone of ['ridge_road', 'observatory_ruins', 'beacon_tower']) walkExit(game, zone);
  winEncounter(game, 'beacon_tide_wraith');
  walkExit(game, 'greyhaven'); act(game, 'toTownScene'); act(game, 'rest');
  checkpoint(game, 'complete');
  const queue = gauntletQueue(game.state);
  assert.deepEqual(queue, DRILL_FOES, 'all boss unlocks came from actual field victories');
  assert.equal(queue.length, 7);
  const champion = () => featStatus(game.state).find(feat => feat.id === 'yard').done;
  const unbroken = () => featStatus(game.state).find(feat => feat.id === 'gauntlet').done;
  assert.equal(champion(), false); assert.equal(unbroken(), false);
  const protectedState = () => structuredClone(Object.fromEntries(
    ['gold', 'bestiary', 'story', 'flags', 'map', 'location'].map(key => [key, game.state[key]])
  ));
  const before = protectedState(), inventory = structuredClone(game.state.inventory);
  const expectedRecords = structuredClone(game.state.drillRecords || {});
  let tonicsUsed = 0, fieldVictories = 0;
  const countVictory = () => { fieldVictories++; };
  game.bus.on('combat:victory', countVictory);
  act(game, 'drills'); act(game, 'startGauntlet');
  for (const [index, id] of queue.entries()) {
    const combat = game.state.combat, beforeXp = game.state.party.map(member => member.xp);
    assert.equal(combat.enemy.id, id); assert.equal(combat.drill, true); assert.equal(combat.encounterId, null);
    assert.deepEqual(combat.gauntlet, { queue, index });
    const xp = Math.floor(combat.enemy.xp / 2);
    if (id === 'last_squall') game.combatRng = () => 0.4;
    for (let turn = 0; !combat.over && turn < 100; turn++) {
      if (id !== 'last_squall') act(game, 'attack');
      else if (game.state.party[0].mp < 8) {
        assert.ok(countItem(game.state.inventory, 'storm_tonic') > 0);
        act(game, 'item', 'storm_tonic'); tonicsUsed++;
      } else if (game.state.party.some(member => member.hp > 0 && member.hp < member.maxHp * 0.55)) {
        act(game, 'skill', 'rallying_light');
      } else if (!(combat.aegisTurns > 0)) act(game, 'skill', 'beacon_aegis');
      else act(game, 'attack');
    }
    delete game.combatRng;
    assert.equal(combat.over, 'victory', `earned gauntlet victory against ${id}`);
    assert.deepEqual(combat.rewards, { xp, gold: 0, items: [] });
    game.state.party.forEach((member, i) => assert.equal(member.xp, beforeXp[i] + xp));
    const previous = expectedRecords[id];
    expectedRecords[id] = { wins: (previous?.wins || 0) + 1, best: previous ? Math.min(previous.best, combat.stats.rounds) : combat.stats.rounds };
    assert.deepEqual(game.state.drillRecords, expectedRecords);
    assert.deepEqual(protectedState(), before);
    const partyAfterCleanup = structuredClone(game.state.party);
    for (const [i, member] of partyAfterCleanup.entries()) {
      member.statuses = []; if (i > 0 && member.hp <= 0) member.hp = 1;
    }
    act(game, 'finish');
    assert.deepEqual(game.state.party, partyAfterCleanup, 'HP/MP/XP carry over; only ordinary status cleanup and fallen-ally revival apply');
    assert.deepEqual(game.state.drillRecords, expectedRecords, 'Finish cannot duplicate the drill record');
    if (index < queue.length - 1) {
      assert.equal(game.state.scene, 'combat'); assert.equal(game.state.combat.gauntlet.index, index + 1);
      assert.equal(game.state.drillGauntlet, undefined, 'an unfinished run is not recorded');
    } else assert.equal(game.state.scene, 'drills');
  }
  assert.equal(game.state.combat, null);
  assert.deepEqual(game.state.drillGauntlet, { runs: 1, best: queue.length });
  assert.equal(champion(), true); assert.equal(unbroken(), true);
  assert.deepEqual(protectedState(), before);
  const expectedInventory = inventory.map(stack => stack.id === 'storm_tonic' ? { ...stack, qty: stack.qty - tonicsUsed } : stack).filter(stack => stack.qty > 0);
  assert.deepEqual(game.state.inventory, expectedInventory, 'only explicitly used tonics leave inventory; no drill spoils');
  assert.match(game.drillsMessage, /Gauntlet complete! You beat all 7 foes/);
  checkpoint(game, 'complete');
  assert.deepEqual(game.state.drillRecords, expectedRecords);
  assert.deepEqual(game.state.drillGauntlet, { runs: 1, best: queue.length });
  assert.equal(champion(), true); assert.equal(unbroken(), true);

  // A weaker second attempt wins the first bout, then actually loses the next.
  act(game, 'closeDrills'); act(game, 'muster');
  for (const id of ['bram', 'sela']) act(game, 'dismiss', id);
  act(game, 'leave'); act(game, 'bag');
  for (const slot of ['weapon', 'armor', 'trinket']) act(game, 'unequip', slot);
  act(game, 'leave'); act(game, 'rest');
  assert.equal(game.state.party.length, 1);
  const beforeLoss = protectedState(), beforeLossInventory = structuredClone(game.state.inventory);
  const beforeFirstXp = game.state.party[0].xp;
  act(game, 'drills'); act(game, 'startGauntlet');
  for (let turn = 0; !game.state.combat.over && turn < 100; turn++) act(game, 'attack');
  assert.equal(game.state.combat.over, 'victory');
  const first = game.state.combat, prior = expectedRecords[queue[0]];
  const firstXp = Math.floor(first.enemy.xp / 2);
  assert.deepEqual(first.rewards, { xp: firstXp, gold: 0, items: [] });
  assert.equal(game.state.party[0].xp, beforeFirstXp + firstXp);
  expectedRecords[queue[0]] = { wins: prior.wins + 1, best: Math.min(prior.best, first.stats.rounds) };
  assert.deepEqual(game.state.drillRecords, expectedRecords);
  const rewardedXp = game.state.party[0].xp;
  act(game, 'finish'); assert.equal(game.state.combat.gauntlet.index, 1);
  for (let turn = 0; !game.state.combat.over && turn < 250; turn++) act(game, 'defend');
  assert.equal(game.state.combat.over, 'defeat'); assert.equal(game.state.party[0].hp, 0);
  assert.deepEqual(protectedState(), beforeLoss);
  assert.deepEqual(game.state.drillRecords, expectedRecords, 'a loss cannot create a win record');
  act(game, 'finish');
  assert.equal(game.state.scene, 'drills'); assert.equal(game.state.combat, null);
  assert.deepEqual(game.state.drillGauntlet, { runs: 2, best: queue.length }, 'a shorter run cannot replace the best');
  const hero = game.state.party[0], stats = effectiveStats(hero);
  assert.equal(hero.hp, Math.ceil(stats.maxHp / 2)); assert.equal(hero.mp, stats.maxMp);
  assert.deepEqual(hero.statuses, []); assert.equal(hero.xp, rewardedXp);
  assert.deepEqual(protectedState(), beforeLoss); assert.deepEqual(game.state.inventory, beforeLossInventory);
  assert.match(game.drillsMessage, /ends after 1 of 7 foes/);
  checkpoint(game, 'complete');
  assert.deepEqual(game.state.drillRecords, expectedRecords);
  assert.deepEqual(game.state.drillGauntlet, { runs: 2, best: queue.length });
  assert.deepEqual(protectedState(), beforeLoss);
  assert.equal(champion(), true); assert.equal(unbroken(), true); assert.equal(fieldVictories, 0);
  game.bus.off('combat:victory', countVictory);
}

// Patrol selection is deterministic; movement, combat, rewards and records are real.
function wandererJourney(game) {
  act(game, 'closeDrills'); act(game, 'muster');
  for (const id of ['bram', 'sela']) act(game, 'recruit', id);
  assert.deepEqual(game.state.party.map(member => member.id), ['hero', 'bram', 'sela']);
  act(game, 'leave'); act(game, 'bag');
  for (const [slot, id] of [['weapon', 'tempest_edge'], ['armor', 'maelstrom_plate'], ['trinket', 'heartward_charm']]) {
    act(game, 'equip', id); assert.equal(game.state.party[0].equipment[slot], id);
  }
  act(game, 'leave'); act(game, 'rest'); act(game, 'explore');
  const roadwise = () => featStatus(game.state).find(feat => feat.id === 'wanderers').done;
  const protectedState = () => structuredClone(Object.fromEntries(
    ['story', 'flags', 'drillRecords', 'drillGauntlet'].map(key => [key, game.state[key]])
  ));
  const protectedBefore = protectedState(), expectedBook = structuredClone(game.state.bestiary);
  const routes = [
    { zones: ['ridge_road'], id: 'briar_boar' },
    { zones: ['observatory_ruins'], id: 'lens_wisp' },
    { zones: ['ridge_road', 'greyhaven', 'saltmere_coast'], id: 'wrack_eel' },
    { zones: ['greyhaven', 'ridge_road', 'highwatch_pass'], id: 'rime_wight' },
  ];
  for (const { id } of routes) assert.equal(expectedBook[id], undefined);
  assert.equal(roadwise(), false);
  for (const [index, { zones, id }] of routes.entries()) {
    for (const zone of zones) walkExit(game, zone);
    const beforeGold = game.state.gold, beforeXp = game.state.party.map(member => member.xp);
    const cleared = structuredClone(game.state.map.clearedEncounters);
    const inspected = structuredClone(game.state.map.completedInteractions);
    game.mapRng = () => 0.99;
    act(game, 'mapPatrol'); delete game.mapRng;
    const combat = game.state.combat;
    assert.equal(combat.enemy.id, id); assert.equal(combat.encounterId, null); assert.notEqual(combat.drill, true);
    const xp = combat.enemy.xp;
    for (let turn = 0; !combat.over && turn < 100; turn++) act(game, 'attack');
    assert.equal(combat.over, 'victory'); assert.equal(combat.rewards.xp, xp);
    assert.equal(combat.rewards.gold, combat.enemy.gold);
    assert.equal(game.state.gold, beforeGold + combat.rewards.gold);
    game.state.party.forEach((member, i) => assert.equal(member.xp, beforeXp[i] + xp));
    expectedBook[id] = 1; assert.deepEqual(game.state.bestiary, expectedBook);
    assert.deepEqual(protectedState(), protectedBefore);
    assert.deepEqual(game.state.map.clearedEncounters, cleared);
    assert.deepEqual(game.state.map.completedInteractions, inspected);
    assert.equal(roadwise(), index === routes.length - 1);
    const rewardedGold = game.state.gold, rewardedXp = game.state.party.map(member => member.xp);
    act(game, 'finish');
    assert.equal(game.state.scene, 'explore'); assert.equal(game.state.combat, null);
    assert.equal(game.state.map.activeEncounterId, null);
    assert.deepEqual(game.state.map.clearedEncounters, cleared);
    assert.deepEqual(game.state.map.completedInteractions, inspected);
    assert.equal(game.state.gold, rewardedGold); assert.deepEqual(game.state.party.map(member => member.xp), rewardedXp);
    assert.deepEqual(game.state.bestiary, expectedBook);
    checkpoint(game, 'complete');
    assert.deepEqual(game.state.bestiary, expectedBook); assert.deepEqual(protectedState(), protectedBefore);
    assert.equal(roadwise(), index === routes.length - 1);
  }
}

function squallJourney(game) {
  const prior = structuredClone(game.state.story);
  const endingFlags = structuredClone(game.state.flags);
  const restPrice = prior.flags.relay_choice === 'shelter_network' ? 2 : 5;
  const rest = () => {
    act(game, 'toTownScene');
    const gold = game.state.gold;
    act(game, 'rest');
    assert.equal(game.state.gold, gold - restPrice);
    act(game, 'explore');
  };
  const reachEye = () => {
    for (const zone of ['ridge_road', 'highwatch_pass', 'sunscar_relay', 'stormcrown_spire', 'storms_eye']) walkExit(game, zone);
  };
  assert.equal(game.state.map.zoneId, 'greyhaven');
  act(game, 'openBag');
  const materials = structuredClone(game.state.inventory);
  act(game, 'craft', 'string_heartward_charm');
  for (const [id, qty] of [['stormcrown_shard', 1], ['salvaged_wiring', 2], ['storm_glass', 1]]) {
    assert.equal(countItem(game.state.inventory, id), countItem(materials, id) - qty);
  }
  act(game, 'equip', 'heartward_charm');
  assert.equal(game.state.party[0].equipment.trinket, 'heartward_charm');
  act(game, 'selectMember', '1'); act(game, 'equip', 'relay_glaive');
  assert.equal(game.state.party[1].equipment.weapon, 'relay_glaive');
  act(game, 'leave'); rest(); reachEye();
  walkTo(game, 4, 5); act(game, 'mapInteract', 'storms_eye_post');
  const shoppingGold = game.state.gold;
  act(game, 'buy', 'maelstrom_plate');
  assert.equal(game.state.gold, shoppingGold - getItem('maelstrom_plate').price);
  act(game, 'leave'); act(game, 'openBag');
  act(game, 'selectMember', '1'); act(game, 'equip', 'maelstrom_plate');
  assert.equal(game.state.party[1].equipment.armor, 'maelstrom_plate');
  act(game, 'leave'); walkExit(game, 'greyhaven'); rest();
  // Six ordinary earned patrol wins, with explicit contracts and paid recovery.
  for (let contract = 0; contract < 3; contract++) {
    act(game, 'storyExpedition', 'eye_sweep'); reachEye();
    for (let kill = 1; kill <= 2; kill++) {
      game.mapRng = () => 0.25; act(game, 'mapPatrol'); delete game.mapRng;
      assert.equal(game.state.combat.enemy.id, 'tempest_shade');
      assert.equal(game.state.combat.encounterId, null);
      for (let turn = 0; !game.state.combat.over && turn < 100; turn++) act(game, 'attack');
      assert.equal(game.state.combat.over, 'victory');
      assert.equal(game.state.story.expedition.active.progress, kill);
      act(game, 'finish');
    }
    walkExit(game, 'greyhaven');
    const gold = game.state.gold;
    act(game, 'storyExpedition', 'claim');
    assert.equal(game.state.gold, gold + 90);
    rest(); checkpoint(game, 'complete');
  }
  assert.ok(game.state.party.every(member => member.level >= 15), 'levels earned through actual encounters');
  assert.equal(game.state.story.flags.victory_last_squall, undefined);
  assert.equal(getJournal(game.state.story).find(entry => entry.id === 'last_squall').status, 'active');
  reachEye(); walkTo(game, 4, 2);
  game.combatRng = () => 0.4;
  act(game, 'mapEncounter', 'eye_last_squall');
  assert.equal(game.state.combat.enemy.id, 'last_squall');
  assert.equal(game.state.combat.enemy.maxHp, 1500);
  const beforeFight = game.state.gold;
  const beforeLoot = structuredClone(game.state.inventory);
  const beforeXp = game.state.party.map(member => member.xp);
  for (let turn = 0; !game.state.combat.over && turn < 100; turn++) {
    const combat = game.state.combat, hero = game.state.party[0];
    if (hero.mp < 8) {
      assert.ok(countItem(game.state.inventory, 'storm_tonic') > 0);
      act(game, 'item', 'storm_tonic');
    } else if (game.state.party.some(member => member.hp > 0 && member.hp < member.maxHp * 0.55)) {
      act(game, 'skill', 'rallying_light');
    } else if (!(combat.aegisTurns > 0)) {
      act(game, 'skill', 'beacon_aegis');
    } else act(game, 'attack');
  }
  delete game.combatRng;
  assert.equal(game.state.combat.over, 'victory');
  assert.equal(game.state.combat.enraged, true);
  assert.match(game.state.combat.log.join(' '), /Rolling Thunder/);
  assert.equal(game.state.gold, beforeFight + 320, 'only combat spoils, no extra quest payment');
  for (const [id, qty] of [['thunder_iron', 4], ['stormcrown_shard', 2], ['ember_broth', 2]]) {
    assert.equal(countItem(game.state.inventory, id), countItem(beforeLoot, id) + qty);
  }
  game.state.party.forEach((member, index) => assert.equal(member.xp, beforeXp[index] + 420));
  const rewardedInventory = structuredClone(game.state.inventory);
  act(game, 'finish');
  assert.deepEqual(game.state.inventory, rewardedInventory, 'Finish does not duplicate loot');
  assert.equal(game.state.gold, beforeFight + 320, 'Finish does not duplicate gold');
  assert.equal(game.state.map.clearedEncounters.eye_last_squall, true);
  assert.equal(game.state.story.flags.victory_last_squall, true);
  assert.equal(game.state.bestiary.last_squall, 1);
  checkpoint(game, 'complete');
  assert.doesNotMatch(game.root.innerHTML, /data-action="mapEncounter" data-arg="eye_last_squall"/);
  act(game, 'mapEncounter', 'eye_last_squall');
  assert.equal(game.state.scene, 'explore', 'cleared superboss cannot restart');
  assert.equal(game.state.bestiary.last_squall, 1);
  assert.equal(getJournal(game.state.story).find(entry => entry.id === 'last_squall').status, 'complete');
  walkExit(game, 'greyhaven');
  const finalGold = game.state.gold;
  act(game, 'storyHeart', 'report');
  assert.equal(game.state.gold, finalGold, 'no second Heart payment after superboss');
  assert.doesNotMatch(game.root.innerHTML, /data-action="storyHeart" data-arg="report"/);
  for (const [key, value] of Object.entries(prior.flags)) assert.deepEqual(game.state.story.flags[key], value, `Squall preserves ${key}`);
  assert.equal(game.state.story.ending, prior.ending);
  assert.deepEqual(game.state.flags, endingFlags);
  checkpoint(game, 'complete');
}

for (const ending of ['protect_town', 'share_signal']) {
  for (const early of [false, true]) {
    for (const first of ['coast', 'heights']) for (const relayChoice of ['shelter_network', 'route_network']) {
      test(`walkable campaign: ${ending}, ${early ? 'explore before briefing' : 'normal quest order'}, ${first} rescue first, ${relayChoice}`, t => {
        const game = harness(t);
        let combatGold = 0;
        checkpoint(game, 'briefing');
        if (!early) { act(game, 'storyTalk', 'mara'); checkpoint(game, 'road'); }
        // Undiscovered fast travel cannot skip the physical route.
        act(game, 'mapTravel', 'beacon_tower');
        assert.equal(game.state.map.zoneId, 'greyhaven');
        walkExit(game, 'ridge_road');
        combatGold += winEncounter(game, 'ridge_patrol');
        walkTo(game, 5, 5);
        assert.equal(game.state.story.flags.dispatch_ridge, true);
        if (!early) {
          checkpoint(game, 'road_report');
          act(game, 'mapTravel', 'greyhaven');
          act(game, 'storyTalk', 'mara'); checkpoint(game, 'lens_briefing');
          act(game, 'storyTalk', 'iven'); checkpoint(game, 'lens');
          act(game, 'mapTravel', 'ridge_road');
        }
        walkExit(game, 'observatory_ruins');
        combatGold += winEncounter(game, 'observatory_sentinel');
        walkTo(game, 1, 3);
        assert.equal(game.state.story.flags.dispatch_observatory, true);
        if (!early) checkpoint(game, 'lens_report');
        // A premature tower visit must not unlock an ending or skip the council.
        walkExit(game, 'beacon_tower');
        act(game, 'storyChoose', ending);
        assert.equal(game.state.story.ending, null);
        walkExit(game, 'greyhaven'); // physically reachable signal lift
        recruitAndRest(game);
        if (early) combatGold += rescueJourney(game, first);
        if (early) {
          act(game, 'storyTalk', 'mara'); checkpoint(game, 'road_report');
          act(game, 'storyTalk', 'mara'); checkpoint(game, 'lens_briefing');
          act(game, 'storyTalk', 'iven'); checkpoint(game, 'lens_report');
        }
        act(game, 'storyTalk', 'iven'); checkpoint(game, 'council');
        act(game, 'storyTalk', 'mara');
        act(game, 'storyTalk', 'tamsin');
        assert.equal(game.state.story.flags.dispatch_reward, true);
        assert.equal(game.state.story.stage, 'council');
        act(game, 'mapTravel', 'beacon_tower'); checkpoint(game, 'decision');
        act(game, 'storyChoose', ending);
        assert.equal(game.state.scene, 'ending', 'final choice opens the ending scene');
        checkpoint(game, 'complete');
        act(game, 'keepExploring');
        assert.equal(game.state.scene, 'explore');
        assert.equal(game.state.story.ending, ending);
        assert.equal(game.state.gold, 20 + combatGold + 120 - 5, 'all four story rewards paid once');
        const finalGold = game.state.gold;
        act(game, 'storyChoose', ending === 'protect_town' ? 'share_signal' : 'protect_town');
        act(game, 'mapTravel', 'greyhaven');
        for (const npc of ['mara', 'iven', 'tamsin']) act(game, 'storyTalk', npc);
        assert.equal(game.state.gold, finalGold, 'repeated turn-ins and choices cannot duplicate rewards');
        assert.equal(game.state.story.ending, ending, 'ending remains exclusive after reload');
        assert.ok(game.state.party[0].hp > 0);
        // The optional aftermath uses actual shop and scene actions, not granted items.
        act(game, 'toTownScene');
        act(game, 'shop');
        assert.equal(game.state.scene, 'shop');
        const originalInventory = structuredClone(game.state.inventory);
        act(game, 'buy', 'rations'); act(game, 'buy', 'rations'); act(game, 'buy', 'bandage');
        assert.equal(game.state.gold, finalGold - 22, 'relief supplies cost 22 gold');
        assert.equal(countItem(game.state.inventory, 'rations'), countItem(originalInventory, 'rations') + 2);
        assert.equal(countItem(game.state.inventory, 'bandage'), countItem(originalInventory, 'bandage') + 1);
        act(game, 'leave'); act(game, 'explore');
        act(game, 'storyTalk', 'tamsin');
        assert.equal(game.state.gold, finalGold - 22, 'ordinary conversation does not exchange supplies');
        act(game, 'storyRelief');
        assert.equal(game.state.gold, finalGold + 8, 'optional relief pays exactly 30 gold');
        assert.equal(game.state.story.flags.relief_reward, true);
        assert.deepEqual(game.state.inventory, originalInventory, 'only the purchased relief supplies were consumed');
        checkpoint(game, 'complete');
        act(game, 'storyRelief');
        assert.equal(game.state.gold, finalGold + 8, 'reload and stale hand-in do not pay again');
        assert.equal(game.state.story.ending, ending);
        assert.equal(game.state.scene, 'explore', 'relief does not replay the ending scene');
        act(game, 'storyRescue', 'accept');
        assert.equal(game.state.story.flags.rescue_accepted, true);
        checkpoint(game, 'complete');
        if (!early) combatGold += rescueJourney(game, first);
        oldTuskLockedJourney(game);
        gloomfinLockedJourney(game);
        frostmaneLockedJourney(game);
        lenswardenLockedJourney(game);
        const beforeReport = game.state.gold;
        act(game, 'storyTalk', 'mara');
        assert.equal(game.state.gold, beforeReport, 'ordinary talk does not claim the expedition reward');
        act(game, 'storyRescue', 'report');
        assert.equal(game.state.gold, beforeReport + 80);
        assert.equal(game.state.gold, 20 + combatGold + 120 - 5 + 8 + 80, 'exact combined campaign economy');
        assert.equal(game.state.story.flags.rescue_reward, true);
        assert.equal(game.state.story.flags.relief_reward, true);
        assert.equal(game.state.story.ending, ending);
        checkpoint(game, 'complete');
        act(game, 'storyRescue', 'report');
        assert.equal(game.state.gold, beforeReport + 80, 'reloaded expedition cannot pay again');
        assert.equal(game.state.scene, 'explore', 'rescue does not replay the ending');
        // Rescuing both settlements unlocks their allies through actual story facts.
        act(game, 'toTownScene'); act(game, 'muster');
        act(game, 'dismiss', 'tamsin'); act(game, 'dismiss', 'iven');
        act(game, 'recruit', 'bram'); act(game, 'recruit', 'sela');
        assert.deepEqual(game.state.party.map(m => m.id), ['hero', 'bram', 'sela']);
        assert.ok(game.state.reserve.tamsin && game.state.reserve.iven);
        checkpoint(game, 'complete');
        act(game, 'leave'); act(game, 'explore');
        optionalBossJourney(game, first);
        oldTuskJourney(game);
        gloomfinJourney(game);
        frostmaneJourney(game);
        lenswardenJourney(game);
        relayJourney(game, relayChoice, early);
        spireJourney(game, relayChoice, early);
        companionJourney(game, early, first);
        heartJourney(game, early, first);
        watchJourney(game, early, first);
        calibrationJourney(game);
        signalLineJourney(game, early);
        squallJourney(game);
        drillJourney(game);
        gauntletJourney(game);
        wandererJourney(game);
      });
    }
  }
}
