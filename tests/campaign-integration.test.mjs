import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';
import { saveGame, loadGame } from '../src/state.js';
import { combatScene } from '../src/scenes/combat.js';
import { installBestiary } from '../src/scenes/bestiary.js';
import { getItem } from '../src/items/items.js';
import { installCompanions } from '../src/scenes/muster.js';
import { installShop } from '../src/scenes/shop.js';
import { countItem } from '../src/items/inventory.js';
import { townScene } from '../src/scenes/town.js';
import { endingScene, installEnding } from '../src/scenes/ending.js';
import { titleScene } from '../src/scenes/title.js';
import { installStory } from '../src/story/integration.js';
import { installProgression } from '../src/core/progression.js';
import { installMap, ZONES, isWalkable } from '../src/map/index.js';

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
  assert.deepEqual(game.state.story, originalStory, 'optional bosses do not alter or repay the completed expedition');
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

for (const ending of ['protect_town', 'share_signal']) {
  for (const early of [false, true]) {
    for (const first of ['coast', 'heights']) {
      test(`walkable campaign: ${ending}, ${early ? 'explore before briefing' : 'normal quest order'}, ${first} rescue first`, t => {
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
      });
    }
  }
}
