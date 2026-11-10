import test from 'node:test';
import assert from 'node:assert/strict';
import { assertEggFree } from './helpers/eggGuard.mjs';
import { compassRouteLine } from '../src/ui/exploration.js';
import { createInitialState } from '../src/state.js';
import { installStory } from '../src/story/integration.js';
import {
  ZONE_CONDITIONS,
  ZONES,
  ZONE_ORDER,
  getZoneCondition,
  getZoneProgress,
  getZoneVantage,
  getZoneWeatherBriefing,
  getFieldConsumablePreview,
  getFieldCraftPreview,
  getFieldPackSummary,
  getFieldServicesSummary,
  getPartyFieldReadiness,
  getInteractableBriefing,
  getNpcBriefing,
  getFrontierAtlas,
  getExpeditionProgressSummary,
  getFastTravelBriefing,
  getRouteBriefing,
  formatExpeditionLog,
  getExpeditionLogSummary,
  getTileInspection,
  getZoneChecklist,
  getPatrolBriefing,
  getCompassBearing,
  getZoneCompassHint,
  getNearbyActionsSummary,
  getZoneExitsSummary,
  getZoneContactsSummary,
  getZoneStationsSummary,
  findSafePath,
  getSafePathPreview,
  stepAlongSafePath,
  getEncounterPreview,
  getZoneThreatIntel,
  ensureMapState,
  exploreScene,
  getClearedEncounters,
  getEffectiveRandomEncounterChance,
  getInnCost,
  getVisitedZones,
  installMap,
  interactWith,
  getAvailableActions,
  movePlayer,
  pickRandomEncounter,
  recordEncounterVictory,
  travelToZone,
  useFieldConsumable,
} from '../src/map/index.js';

function makeMockGame() {
  const handlers = {};
  const bus = {
    on(evt, fn) {
      (handlers[evt] ||= []).push(fn);
    },
    off(evt, fn) {
      handlers[evt] = (handlers[evt] || []).filter((h) => h !== fn);
    },
    emit(evt, payload) {
      (handlers[evt] || []).forEach((h) => h(payload));
    },
  };
  const scenes = {};
  const game = {
    state: createInitialState(),
    mapRng: () => 0.99,
    bus,
    scenes,
    renderCount: 0,
    registerScene(name, sc) {
      scenes[name] = sc;
    },
    setScene(name, data) {
      this.state.scene = name;
      scenes[name]?.onEnter?.(this, data);
      bus.emit('scene:enter', { name, data });
      this.render();
    },
    render() {
      this.renderCount += 1;
      const sc = scenes[this.state.scene];
      this.lastHtml = sc ? sc.render(this) : '';
      return this.lastHtml;
    },
  };
  game.registerScene('combat', {
    onEnter(g, data) {
      g.lastCombatData = data;
    },
    render() {
      return '<div>Combat</div>';
    },
  });
  game.registerScene('town', {
    onEnter() {},
    render() {
      return '<div>Town</div>';
    },
  });
  return game;
}

test('zones match required story location, NPC, interaction, and encounter IDs', () => {
  assert.deepEqual(ZONE_ORDER, ['greyhaven', 'ridge_road', 'observatory_ruins', 'beacon_tower', 'saltmere_coast', 'highwatch_pass', 'sunscar_relay', 'stormcrown_spire', 'storms_eye']);
  const npcIds = ZONES.greyhaven.npcs.map((n) => n.id);
  assert.deepEqual(npcIds, ['mara', 'iven', 'tamsin']);
  assert.equal(ZONES.ridge_road.encounters[0].encounterId, 'ridge_patrol');
  assert.equal(ZONES.observatory_ruins.encounters[0].encounterId, 'observatory_sentinel');
  assert.equal(ZONES.ridge_road.interactables[0].interactionId, 'dispatch_ridge');
  assert.equal(ZONES.observatory_ruins.interactables[0].interactionId, 'dispatch_observatory');
});

test('every zone grid matches declared width/height and every entity sits on a walkable tile', () => {
  for (const zone of Object.values(ZONES)) {
    assert.equal(zone.grid.length, zone.height, `${zone.id} grid height matches`);
    for (let y = 0; y < zone.height; y++) {
      assert.equal(zone.grid[y].length, zone.width, `${zone.id} row ${y} width matches`);
    }
    for (const [key, pos] of Object.entries(zone.spawns || {})) {
      const ch = zone.grid[pos.y]?.[pos.x];
      assert.ok(['.', ',', '+', '*'].includes(ch), `${zone.id} spawn ${key} at (${pos.x},${pos.y}) has tile '${ch}'`);
    }
    for (const ex of zone.exits || []) {
      const ch = zone.grid[ex.y]?.[ex.x];
      assert.ok(['.', ',', '+', '*'].includes(ch), `${zone.id} exit to ${ex.toZone} at (${ex.x},${ex.y}) has tile '${ch}'`);
    }
    for (const npc of zone.npcs || []) {
      const ch = zone.grid[npc.y]?.[npc.x];
      assert.ok(['.', ',', '+', '*'].includes(ch), `${zone.id} npc ${npc.id} at (${npc.x},${npc.y}) has tile '${ch}'`);
    }
    for (const inter of zone.interactables || []) {
      const ch = zone.grid[inter.y]?.[inter.x];
      assert.ok(['.', ',', '+', '*'].includes(ch), `${zone.id} interactable ${inter.id} at (${inter.x},${inter.y}) has tile '${ch}'`);
    }
    for (const enc of zone.encounters || []) {
      const ch = zone.grid[enc.y]?.[enc.x];
      assert.ok(['.', ',', '+', '*'].includes(ch), `${zone.id} encounter ${enc.id} at (${enc.x},${enc.y}) has tile '${ch}'`);
    }
  }
});

test('movePlayer respects walls, enforces proximity on interact/encounter, and supports Signal Lift', () => {
  const state = createInitialState();
  ensureMapState(state);
  const step1 = movePlayer(state, 0, -1, { disableRandomEncounters: true });
  assert.equal(step1.moved, true);
  assert.equal(state.map.x, 2);
  assert.equal(state.map.y, 2);

  // Step onto Mara (3, 2) -> emits talk event without moving onto NPC tile
  const stepMara = movePlayer(state, 1, 0, { disableRandomEncounters: true });
  assert.deepEqual(stepMara.events, [{ type: 'talk', npcId: 'mara' }]);
  assert.equal(state.map.x, 2);
  assert.equal(state.map.y, 2);

  // Travel to ridge_road via East Gate at (8, 3)
  state.map.x = 7;
  state.map.y = 3;
  const exitStep = movePlayer(state, 1, 0, { disableRandomEncounters: true });
  assert.equal(exitStep.transitioned, true);
  assert.equal(state.map.zoneId, 'ridge_road');
  assert.equal(state.location, 'ridge_road');

  // Out-of-range dispatch_ridge (5,5) from spawn (1,3) is rejected by proximity guard
  const farDispatch = interactWith(state, 'interact', 'dispatch_ridge');
  assert.deepEqual(farDispatch.events, []);
  const farEncounter = interactWith(state, 'encounter', 'ridge_patrol');
  assert.equal(farEncounter.triggerCombat, null);

  // Beacon Tower Signal Lift at (6, 3) is directly reachable from spawn (4, 4) without hitting (4, 5)
  state.map.zoneId = 'beacon_tower';
  state.map.x = 4;
  state.map.y = 4;
  movePlayer(state, 1, 0, { disableRandomEncounters: true }); // (5, 4)
  movePlayer(state, 0, -1, { disableRandomEncounters: true }); // (5, 3)
  const liftStep = movePlayer(state, 1, 0, { disableRandomEncounters: true }); // (6, 3) -> greyhaven
  assert.equal(liftStep.transitioned, true);
  assert.equal(state.map.zoneId, 'greyhaven');
});

test('full campaign progression through map and story integration + toTownScene sync', () => {
  const game = makeMockGame();
  installStory(game);
  installMap(game, { enableKeyboard: false });

  game.setScene('explore', { zoneId: 'greyhaven' });
  assert.ok(game.lastHtml.includes('Greyhaven'));

  // 1. Talk to Mara and Tamsin in Greyhaven
  exploreScene.actions.mapTalk(game, { dataset: { arg: 'mara' } });
  assert.equal(game.state.story.stage, 'road');
  exploreScene.actions.mapTalk(game, { dataset: { arg: 'tamsin' } });
  assert.equal(game.state.story.flags.met_tamsin, true);

  // 2. Travel to ridge_road, move adjacent to dispatch_ridge (5,5) and ridge_patrol (5,3)
  game.setScene('explore', { zoneId: 'ridge_road' });
  game.state.map.x = 5;
  game.state.map.y = 4;
  exploreScene.actions.mapInteract(game, { dataset: { arg: 'dispatch_ridge' } });
  assert.equal(game.state.story.flags.dispatch_ridge, true);

  exploreScene.actions.mapEncounter(game, { dataset: { arg: 'ridge_patrol' } });
  assert.equal(game.lastCombatData.encounterId, 'ridge_patrol');
  game.bus.emit('combat:victory', { enemyId: 'storm_rat', encounterId: 'ridge_patrol' });
  assert.ok(getClearedEncounters(game.state).includes('ridge_patrol'));
  assert.equal(game.state.story.stage, 'road_report');

  // Verify toTownScene from wilderness resets location and zoneId to greyhaven
  exploreScene.actions.toTownScene(game);
  assert.equal(game.state.scene, 'town');
  assert.equal(game.state.location, 'greyhaven');
  assert.equal(game.state.map.zoneId, 'greyhaven');

  // 3. Report to Mara, speak to Iven
  game.setScene('explore', { zoneId: 'greyhaven' });
  exploreScene.actions.mapTalk(game, { dataset: { arg: 'mara' } });
  assert.equal(game.state.story.stage, 'lens_briefing');
  exploreScene.actions.mapTalk(game, { dataset: { arg: 'iven' } });
  assert.equal(game.state.story.stage, 'lens');

  // 4. Travel to observatory_ruins, move adjacent to dispatch_observatory (1,3), defeat sentinel (4,2)
  game.setScene('explore', { zoneId: 'observatory_ruins' });
  game.state.map.x = 2;
  game.state.map.y = 3;
  exploreScene.actions.mapInteract(game, { dataset: { arg: 'dispatch_observatory' } });
  assert.equal(game.state.story.flags.dispatch_observatory, true);

  game.state.map.x = 4;
  game.state.map.y = 3;
  exploreScene.actions.mapEncounter(game, { dataset: { arg: 'observatory_sentinel' } });
  game.bus.emit('combat:victory', { enemyId: 'storm_rat', encounterId: 'observatory_sentinel' });
  assert.equal(game.state.story.stage, 'lens_report');

  // 5. Return to Greyhaven, turn in dispatches to Tamsin, report lens to Iven, hear council
  game.setScene('explore', { zoneId: 'greyhaven' });
  exploreScene.actions.mapTalk(game, { dataset: { arg: 'tamsin' } });
  assert.equal(game.state.story.flags.dispatch_reward, true);

  exploreScene.actions.mapTalk(game, { dataset: { arg: 'iven' } });
  assert.equal(game.state.story.stage, 'council');

  exploreScene.actions.mapTalk(game, { dataset: { arg: 'mara' } });
  exploreScene.actions.mapTalk(game, { dataset: { arg: 'tamsin' } });

  // 6. Visit beacon_tower and choose share_signal via guarded storyChoose action
  game.setScene('explore', { zoneId: 'beacon_tower' });
  assert.equal(game.state.story.stage, 'decision');
  exploreScene.actions.storyChoose(game, { dataset: { arg: 'share_signal' } });
  assert.equal(game.state.story.stage, 'complete');
  assert.equal(game.state.story.ending, 'share_signal');
  assert.deepEqual(getVisitedZones(game.state), [
    'greyhaven',
    'ridge_road',
    'observatory_ruins',
    'beacon_tower',
  ]);
});

test('zone hygiene: all zone names, descriptions, NPCs, interactables, and encounters are on-theme', () => {
  const banned = /\b(eggs?|nests?|nest(ed|ing)?|hatch(ed|ing|es|lings?)?|yolk|chickens?|roosters?|hen|easter|scrambl(e|ed|ing)|omelet(te)?s?|peep(s|ing)?|shells?|shell(ed|ing)?|albumen|oval|ovoid|quiche|meringue|custard|poach(ed|ing)?|frittata)\b/i;
  for (const [id, zone] of Object.entries(ZONES)) {
    assert.equal(id, zone.id);
    assert.ok(!banned.test(zone.name) && !banned.test(zone.subtitle) && !banned.test(zone.description), `${id} zone text on-theme`);
    for (const npc of zone.npcs || []) {
      assert.ok(!banned.test(npc.name) && !banned.test(npc.role) && !banned.test(npc.defaultLine), `npc ${npc.id} on-theme`);
    }
    for (const inter of zone.interactables || []) {
      assert.ok(!banned.test(inter.name) && !banned.test(inter.description), `interactable ${inter.id} on-theme`);
    }
    for (const enc of zone.encounters || []) {
      assert.ok(!banned.test(enc.name) && !banned.test(enc.description || ''), `encounter ${enc.id} on-theme`);
    }
  }
});

test('supply caches grant item rewards once and cannot be opened twice', () => {
  const state = createInitialState();
  travelToZone(state, 'ridge_road', 'from_greyhaven');
  state.map.x = 1;
  state.map.y = 4; // adjacent to ridge_supply_cache at (1, 5)
  const actions = getAvailableActions(state);
  assert.ok(actions.some((a) => a.kind === 'interact' && a.id === 'ridge_supply_cache' && a.label.includes('Open')));

  const openRes = interactWith(state, 'interact', 'ridge_supply_cache');
  assert.equal(openRes.events[0]?.interactionId, 'ridge_supply_cache');
  assert.equal(state.map.completedInteractions.ridge_supply_cache, true);
  assert.ok(state.inventory.some((s) => s.id === 'healing_herb' && s.qty === 1));
  assert.ok(state.inventory.some((s) => s.id === 'scrap_metal' && s.qty === 2));

  // Second attempt is blocked and does not duplicate items
  const repeatRes = interactWith(state, 'interact', 'ridge_supply_cache');
  assert.equal(repeatRes.events.length, 0);
  assert.equal(state.inventory.find((s) => s.id === 'scrap_metal').qty, 2);
});

test('pickRandomEncounter selects entries according to weights', () => {
  const table = [
    { encounterId: 'common', enemyId: 'storm_rat', weight: 3 },
    { encounterId: 'rare', enemyId: 'storm_rat', weight: 1 },
  ];
  assert.equal(pickRandomEncounter(table, () => 0.1).encounterId, 'common');
  assert.equal(pickRandomEncounter(table, () => 0.74).encounterId, 'common');
  assert.equal(pickRandomEncounter(table, () => 0.85).encounterId, 'rare');
  assert.equal(pickRandomEncounter([], () => 0.5), null);
});

test('useFieldConsumable heals party member in exploration and exploreScene renders Field Pack', () => {
  const game = makeMockGame();
  installStory(game);
  installMap(game, { enableKeyboard: false });
  game.state.party[0].hp = 10;
  game.state.inventory = [{ id: 'bandage', qty: 2 }];
  game.setScene('explore');

  let html = exploreScene.render(game);
  assert.ok(html.includes('Field Pack:'));
  assert.ok(html.includes('Linen Bandage ×2'));
  assert.ok(html.includes('data-action="useFieldItem"'));

  exploreScene.actions.useFieldItem(game, { dataset: { arg: 'bandage' } });
  assert.equal(game.state.party[0].hp, 25);
  assert.equal(game.state.inventory.find((s) => s.id === 'bandage').qty, 1);
});

test('failed cache grantRewards does not mark completedInteractions or emit interact event', () => {
  const state = createInitialState();
  travelToZone(state, 'ridge_road', 'from_greyhaven');
  state.map.x = 1;
  state.map.y = 4; // adjacent to ridge_supply_cache at (1, 5)

  const cache = ZONES.ridge_road.interactables.find((i) => i.id === 'ridge_supply_cache');
  const origRewards = cache.rewards;
  cache.rewards = [{ id: 'unknown_bad_item_id', qty: 1 }];
  try {
    const res = interactWith(state, 'interact', 'ridge_supply_cache');
    assert.equal(res.events.length, 0);
    assert.equal(state.map.completedInteractions.ridge_supply_cache, undefined);
    assert.deepEqual(state.inventory, []);
  } finally {
    cache.rewards = origRewards;
  }
});

test('greyhaven_shop stall opens shop scene with returnScene explore and field crafting works', () => {
  const game = makeMockGame();
  let enteredShopData = null;
  game.scenes.shop = { onEnter(_g, data) { enteredShopData = data; }, render() { return ""; } };
  installStory(game);
  installMap(game, { enableKeyboard: false });
  game.setScene('explore');

  // Move adjacent to greyhaven_shop at (4, 5)
  game.state.map.x = 4;
  game.state.map.y = 4;
  exploreScene.actions.mapInteract(game, { dataset: { arg: 'greyhaven_shop' } });
  assert.equal(game.state.scene, 'shop');
  assert.equal(enteredShopData?.returnScene, 'explore');

  // Test field crafting when materials are held
  game.setScene('explore');
  game.state.inventory = [
    { id: 'healing_herb', qty: 1 },
    { id: 'storm_glass', qty: 1 },
  ];
  const html = exploreScene.render(game);
  assert.ok(html.includes('data-action="craftFieldItem"'));
  exploreScene.actions.craftFieldItem(game, { dataset: { arg: 'distill_tonic' } });
  assert.ok(game.state.inventory.some((s) => s.id === 'storm_tonic' && s.qty === 1));
});

test('Chapter 2 zones saltmere_coast and highwatch_pass have walkable exits, rescue encounters, and caches', () => {
  const game = makeMockGame();
  installStory(game);
  installMap(game, { enableKeyboard: false });
  game.setScene('explore');

  // Walk from greyhaven default (2,3) to South Pier exit at (6,6)
  game.state.map.x = 6;
  game.state.map.y = 5;
  exploreScene.actions.moveSouth(game);
  assert.equal(game.state.map.zoneId, 'saltmere_coast');
  assert.equal(game.state.location, 'saltmere_coast');

  // Walk from saltmere_coast spawn (4,1) south to saltmere_rescue at (4,3)
  exploreScene.actions.moveSouth(game);
  exploreScene.actions.moveSouth(game);
  assert.equal(game.state.scene, 'combat');
  assert.equal(game.lastCombatData.encounterId, 'saltmere_rescue');
  game.bus.emit('combat:victory', { encounterId: 'saltmere_rescue' });
  game.setScene('explore');
  assert.equal(game.state.map.clearedEncounters.saltmere_rescue, true);

  // Return to greyhaven via North Causeway at (4,0), then travel to ridge_road and East Spur (8,3) -> highwatch_pass
  travelToZone(game.state, 'ridge_road', 'from_greyhaven');
  game.state.map.x = 7;
  game.state.map.y = 3;
  exploreScene.actions.moveEast(game);
  assert.equal(game.state.map.zoneId, 'highwatch_pass');
  assert.equal(game.state.location, 'highwatch_pass');

  // Walk east in highwatch_pass from (1,3) to highwatch_rescue at (5,3)
  exploreScene.actions.moveEast(game);
  exploreScene.actions.moveEast(game);
  exploreScene.actions.moveEast(game);
  exploreScene.actions.moveEast(game);
  assert.equal(game.state.scene, 'combat');
  assert.equal(game.lastCombatData.encounterId, 'highwatch_rescue');
  game.bus.emit('combat:victory', { encounterId: 'highwatch_rescue' });
  game.setScene('explore');
  assert.equal(game.state.map.clearedEncounters.highwatch_rescue, true);
});

test('useFieldConsumable supports targeting companions by party index and greyhaven_inn heals effective maxHp', () => {
  const state = createInitialState();
  ensureMapState(state);
  state.party.push({
    id: 'tamsin',
    name: 'Tamsin',
    role: 'scout',
    companion: true,
    hp: 10,
    maxHp: 24,
    mp: 6,
    maxMp: 6,
    atk: 7,
    def: 2,
    spd: 7,
    level: 1,
    xp: 0,
    statuses: [{ id: 'bleeding', turns: 2 }],
    equipment: { weapon: null, armor: 'keeper_coat', trinket: null },
  });
  state.inventory = [{ id: 'rations', qty: 1 }];

  // Out-of-range target index fails cleanly without consuming the item
  const bad = useFieldConsumable(state, 'rations', 5);
  assert.equal(bad.ok, false);
  assert.equal(state.inventory.length, 1);

  // Target index 1 heals companion Tamsin
  const ok = useFieldConsumable(state, 'rations', 1);
  assert.equal(ok.ok, true);
  assert.equal(state.party[1].hp, 20);
  assert.equal(state.inventory.length, 0);

  // Rest at greyhaven_inn restores gear-boosted maxHp (24 + 8 = 32) and clears statuses
  state.gold = 10;
  state.map.x = 1;
  state.map.y = 2;
  interactWith(state, 'interact', 'greyhaven_inn');
  assert.equal(state.gold, 5);
  assert.equal(state.party[1].hp, 34);
  assert.deepEqual(state.party[1].statuses, []);
});

test('Chapter 3 sunscar_relay zone has walkable exits, relay_junction, relay_warden, relay_console, relay_outpost, and relay_supply_cache', () => {
  const game = makeMockGame();
  installMap(game, { enableKeyboard: false });

  // Travel from highwatch_pass East Gate (8, 3) to sunscar_relay
  travelToZone(game.state, 'highwatch_pass', 'default');
  game.state.map.x = 7;
  game.state.map.y = 3;
  const toRelay = movePlayer(game.state, 1, 0);
  assert.equal(toRelay.transitioned, true);
  assert.equal(game.state.map.zoneId, 'sunscar_relay');
  assert.deepEqual({ x: game.state.map.x, y: game.state.map.y }, { x: 1, y: 3 });

  // Inspect relay_junction at (3, 1)
  game.state.map.x = 3;
  game.state.map.y = 1;
  const juncRes = interactWith(game.state, 'interact', 'relay_junction');
  assert.deepEqual(juncRes.events, [{ type: 'interact', interactionId: 'relay_junction' }]);

  // relay_console at (7, 3) requires relay_warden cleared first
  game.state.map.x = 7;
  game.state.map.y = 3;
  const blockedConsole = interactWith(game.state, 'interact', 'relay_console');
  assert.deepEqual(blockedConsole.events, []);

  // Engage relay_warden at (5, 3)
  game.state.map.x = 4;
  game.state.map.y = 3;
  const wardenRes = interactWith(game.state, 'encounter', 'relay_warden');
  assert.equal(wardenRes.triggerCombat?.encounterId, 'relay_warden');
  assert.equal(wardenRes.triggerCombat?.enemyId, 'relay_warden');
  recordEncounterVictory(game.state, 'relay_warden', 'relay_warden');

  // Inspect relay_console at (7, 3)
  game.state.map.x = 7;
  game.state.map.y = 3;
  const consoleRes = interactWith(game.state, 'interact', 'relay_console');
  assert.deepEqual(consoleRes.events, [{ type: 'interact', interactionId: 'relay_console' }]);

  // Open relay_supply_cache at (2, 5)
  game.state.map.x = 2;
  game.state.map.y = 5;
  const cacheRes = interactWith(game.state, 'interact', 'relay_supply_cache');
  assert.deepEqual(cacheRes.events, [{ type: 'interact', interactionId: 'relay_supply_cache' }]);
  assert.equal(game.state.map.completedInteractions.relay_supply_cache, true);

  // Visit relay_outpost shop at (6, 4)
  game.state.map.x = 6;
  game.state.map.y = 4;
  const shopRes = interactWith(game.state, 'interact', 'relay_outpost');
  assert.equal(shopRes.triggerShop?.shopId, 'relay_outpost');

  // Signal Lift at (6, 5) returns to greyhaven
  const liftRes = movePlayer(game.state, 0, 1);
  assert.equal(liftRes.transitioned, true);
  assert.equal(game.state.map.zoneId, 'greyhaven');
});

test('relay_choice flags apply shelter_network (2g map inn cost) and route_network (halved random-encounter chance)', () => {
  const game = makeMockGame();
  installMap(game, { enableKeyboard: false });

  // Default inn cost is 5g
  installStory(game);
  game.state.map.x = 1;
  game.state.map.y = 2;
  assert.equal(getInnCost(game.state, { costGold: 5 }), 5);
  let actions = getAvailableActions(game.state);
  assert.ok(actions.some((a) => a.id === 'greyhaven_inn' && a.label.includes('(5g)')));

  // With shelter_network, inn cost is 2g
  game.state.story.flags.relay_choice = 'shelter_network';
  assert.equal(getInnCost(game.state, { costGold: 5 }), 2);
  actions = getAvailableActions(game.state);
  assert.ok(actions.some((a) => a.id === 'greyhaven_inn' && a.label.includes('(2g)')));
  game.state.gold = 10;
  game.state.party[0].hp = 5;
  interactWith(game.state, 'interact', 'greyhaven_inn');
  assert.equal(game.state.gold, 8);
  assert.equal(game.state.party[0].hp, 30);

  // With route_network, random encounter chance is halved while fixed encounters still trigger
  const sunscar = ZONES.sunscar_relay;
  assert.equal(getEffectiveRandomEncounterChance(game.state, sunscar), 0.14);
  game.state.story.flags.relay_choice = 'route_network';
  assert.equal(getEffectiveRandomEncounterChance(game.state, sunscar), 0.07);

  travelToZone(game.state, 'sunscar_relay', 'default');
  // Roll of 0.10 (> 0.07 halved threshold, < 0.14 base threshold) does not trigger random encounter under route_network
  const safeStep = movePlayer(game.state, 1, 0, { rng: () => 0.10 });
  assert.equal(safeStep.triggerCombat, null);
  // Fixed encounter at (5, 3) still triggers normally
  game.state.map.x = 4;
  game.state.map.y = 3;
  const fixedStep = movePlayer(game.state, 1, 0, { rng: () => 0.99 });
  assert.equal(fixedStep.triggerCombat?.encounterId, 'relay_warden');
});

test('Chapter 4 stormcrown_spire zone supports survey records, boss-gated spire_summit, cache, and stormcrown_post shop', () => {
  const game = makeMockGame();
  installMap(game, { enableKeyboard: false });

  // Travel to sunscar_relay and take Spire Switchback exit at (8, 1) -> stormcrown_spire
  travelToZone(game.state, 'sunscar_relay', 'default');
  game.state.map.x = 8;
  game.state.map.y = 2;
  const toSpire = movePlayer(game.state, 0, -1, { disableRandomEncounters: true });
  assert.equal(toSpire.transitioned, true);
  assert.equal(game.state.map.zoneId, 'stormcrown_spire');
  assert.deepEqual({ x: game.state.map.x, y: game.state.map.y }, { x: 1, y: 5 });

  // Inspect survey_records_a at (1, 1) and survey_records_b at (7, 3)
  game.state.map.x = 1;
  game.state.map.y = 1;
  assert.deepEqual(interactWith(game.state, 'interact', 'survey_records_a').events, [
    { type: 'interact', interactionId: 'survey_records_a' },
  ]);
  game.state.map.x = 7;
  game.state.map.y = 3;
  assert.deepEqual(interactWith(game.state, 'interact', 'survey_records_b').events, [
    { type: 'interact', interactionId: 'survey_records_b' },
  ]);

  // spire_summit at (4, 0) is gated behind stormcrown_tyrant
  game.state.map.x = 4;
  game.state.map.y = 0;
  const blockedSummit = interactWith(game.state, 'interact', 'spire_summit');
  assert.deepEqual(blockedSummit.events, []);
  assert.match(game.state.map.log.at(-1), /defeat the guardian before approaching the Stormcrown Summit Cradle/i);

  // Trigger and clear stormcrown_tyrant at (4, 1)
  const tyrantFight = interactWith(game.state, 'encounter', 'stormcrown_tyrant');
  assert.deepEqual(tyrantFight.triggerCombat, {
    encounterId: 'stormcrown_tyrant',
    enemyId: 'stormcrown_tyrant',
    name: 'Stormcrown Tyrant',
  });
  recordEncounterVictory(game.state, 'stormcrown_tyrant', 'stormcrown_tyrant');

  // Now spire_summit at (4, 0) unlocks
  const unlockedSummit = interactWith(game.state, 'interact', 'spire_summit');
  assert.deepEqual(unlockedSummit.events, [{ type: 'interact', interactionId: 'spire_summit' }]);

  // Open spire_supply_cache at (2, 5) and visit stormcrown_post shop at (4, 5)
  game.state.map.x = 2;
  game.state.map.y = 5;
  const cacheRes = interactWith(game.state, 'interact', 'spire_supply_cache');
  assert.deepEqual(cacheRes.events, [{ type: 'interact', interactionId: 'spire_supply_cache' }]);
  assert.equal(game.state.map.completedInteractions.spire_supply_cache, true);

  game.state.map.x = 4;
  game.state.map.y = 5;
  const shopRes = interactWith(game.state, 'interact', 'stormcrown_post');
  assert.equal(shopRes.triggerShop?.shopId, 'stormcrown_post');
});

test('exploreScene supports companion-targeted useFieldItem and openBag/openJournal navigation', () => {
  const game = makeMockGame();
  let lastSceneData = null;
  game.scenes.bag = { onEnter(g, d) { lastSceneData = { scene: 'bag', data: d }; }, render() { return ''; } };
  game.scenes.bestiary = { onEnter(g, d) { lastSceneData = { scene: 'bestiary', data: d }; }, render() { return ''; } };
  installMap(game, { enableKeyboard: false });

  game.state.party.push({
    id: 'tamsin',
    name: 'Tamsin',
    hp: 8,
    maxHp: 24,
    mp: 10,
    maxMp: 10,
    atk: 5,
    def: 3,
    spd: 5,
    statuses: [],
    equipment: { weapon: null, armor: null, trinket: null },
  });
  game.state.inventory = [{ id: 'rations', qty: 1 }];
  game.setScene('explore');

  const html = exploreScene.render(game);
  assert.match(html, /data-action="useFieldItem" data-arg="rations:1"/);
  assert.match(html, /Use Trail Rations → Tamsin/);

  exploreScene.actions.useFieldItem(game, { dataset: { arg: 'rations:1' } });
  assert.equal(game.state.party[1].hp, 18);
  assert.equal(game.state.inventory.length, 0);

  exploreScene.actions.openBag(game);
  assert.equal(game.state.scene, 'bag');
  assert.equal(lastSceneData?.data?.returnScene, 'explore');

  game.setScene('explore');
  exploreScene.actions.openJournal(game);
  assert.equal(game.state.scene, 'bestiary');
  assert.equal(lastSceneData?.data?.returnScene, 'explore');
});

test('normal movement in exploreScene respects route_network (.10 roll triggers at .14 base but not .07) and mapPatrol triggers repeatable fights', () => {
  const game = makeMockGame();
  installMap(game, { enableKeyboard: false });
  travelToZone(game.state, 'stormcrown_spire', 'default');

  // At base 0.14 chance in stormcrown_spire, a 0.10 roll triggers a random encounter on moveEast
  const rolls = [0.10, 0.9];
  game.mapRng = () => rolls.shift() ?? 0.9;
  exploreScene.actions.moveEast(game);
  assert.equal(game.state.scene, 'combat');
  assert.equal(game.lastCombatData?.enemyId, 'spire_sentry');

  // With route_network (halved to 0.07), the same 0.10 roll does NOT trigger a random encounter
  game.setScene('explore', { combatResult: 'fled' });
  game.state.story = { flags: { relay_choice: 'route_network' } };
  game.lastCombatData = null;
  const rollsRoute = [0.10, 0.9];
  game.mapRng = () => rollsRoute.shift() ?? 0.9;
  exploreScene.actions.moveWest(game);
  assert.equal(game.state.scene, 'explore');
  assert.equal(game.lastCombatData, null);

  // Explicit mapPatrol action renders in encounter-bearing zones and launches repeatable fights
  const html = exploreScene.render(game);
  assert.match(html, /data-action="mapPatrol"/);
  game.mapRng = () => 0.1;
  exploreScene.actions.mapPatrol(game);
  assert.equal(game.state.scene, 'combat');
  assert.equal(game.lastCombatData?.enemyId, 'ashen_raider');
  assert.equal(game.lastCombatData?.encounterId, null);
});

test("greyhaven_watch_house opens muster scene with returnScene explore when adjacent", () => {
  const game = makeMockGame();
  let enteredMusterData = null;
  game.scenes.muster = {
    onEnter(_g, d) {
      enteredMusterData = d;
    },
    render() {
      return "";
    },
  };
  game.setScene("explore", { zoneId: "greyhaven" });
  // At default spawn (2, 3), distance to (2, 1) is 2 -> blocked by proximity guard
  exploreScene.actions.mapInteract(game, { dataset: { arg: "greyhaven_watch_house" } });
  assert.equal(enteredMusterData, null);

  // Move north to (2, 2), adjacent to greyhaven_watch_house at (2, 1)
  exploreScene.actions.moveNorth(game);
  const actions = getAvailableActions(game.state);
  assert.ok(actions.some((a) => a.id === "greyhaven_watch_house" && a.label === "Visit Watch House Muster Board"));
  exploreScene.actions.mapInteract(game, { dataset: { arg: "greyhaven_watch_house" } });
  assert.equal(game.state.scene, "muster");
  assert.equal(enteredMusterData?.returnScene, "explore");
  assert.equal(enteredMusterData?.musterId, "greyhaven_watch_house");
});


test('map keyboard opt-out preserves arrows and buttons and respects editing and settings guards', () => {
  const game = makeMockGame();
  let enabled = false;
  let displayOpen = false;
  const document = {
    documentElement: { getAttribute: () => enabled ? 'on' : 'off' },
    querySelector: () => displayOpen ? {} : null,
  };
  const listeners = new Map();
  const window = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  const cleanup = installMap(game, { document, window });
  game.setScene('explore');
  const press = (code, overrides = {}) => {
    const event = { code, target: { tagName: 'DIV' }, preventDefault() { this.prevented = true; }, ...overrides };
    listeners.get('keydown')(event);
    return event;
  };
  const original = JSON.stringify(game.state);
  for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
    assert.equal(press(code).prevented, undefined);
    assert.equal(JSON.stringify(game.state), original);
  }
  assert.equal(press('', { key: 'd' }).prevented, undefined);
  assert.equal(press('ArrowRight').prevented, true);
  assert.equal(game.state.map.x, 3);
  exploreScene.actions.moveWest(game);
  assert.equal(game.state.map.x, 2, 'native movement action remains available');
  enabled = true;
  assert.equal(press('KeyD').prevented, true);
  assert.equal(game.state.map.x, 3);
  assert.equal(press('', { key: 'a' }).prevented, true);
  assert.equal(game.state.map.x, 2);
  for (const code of ['KeyD', 'ArrowRight']) {
    const before = JSON.stringify(game.state);
    for (const guard of ['repeat', 'defaultPrevented', 'altKey', 'ctrlKey', 'metaKey', 'shiftKey']) {
      assert.equal(press(code, { [guard]: true }).prevented, undefined, guard);
    }
    for (const target of [{ tagName: 'INPUT' }, { tagName: 'TEXTAREA' }, { tagName: 'SELECT' },
      { isContentEditable: true }, { closest: () => ({}) }]) {
      assert.equal(press(code, { target }).prevented, undefined);
    }
    displayOpen = true;
    assert.equal(press(code).prevented, undefined);
    displayOpen = false;
    assert.equal(JSON.stringify(game.state), before);
  }
  game.state.scene = 'town';
  assert.equal(press('ArrowRight').prevented, undefined);
  cleanup();
  assert.equal(listeners.size, 0);
});

test('every zone defines a valid baseline condition and getZoneCondition reacts to story flags without mutating state', () => {
  for (const zoneId of ZONE_ORDER) {
    const zone = ZONES[zoneId];
    assert.ok(zone.condition && ZONE_CONDITIONS[zone.condition], `${zoneId} has valid baseline condition`);
  }

  const game = makeMockGame();
  const snapshot = JSON.stringify(game.state);
  assert.equal(getZoneCondition(game.state, 'greyhaven').id, 'sheltered');
  assert.equal(getZoneCondition(game.state, 'ridge_road').id, 'squall');
  assert.equal(getZoneCondition(game.state, 'observatory_ruins').id, 'gale');
  assert.equal(getZoneCondition(game.state, 'beacon_tower').id, 'gale');
  assert.equal(getZoneCondition(game.state, 'saltmere_coast').id, 'squall');
  assert.equal(getZoneCondition(game.state, 'highwatch_pass').id, 'rime');
  assert.equal(getZoneCondition(game.state, 'sunscar_relay').id, 'rime');
  assert.equal(getZoneCondition(game.state, 'stormcrown_spire').id, 'tempest');
  assert.equal(getZoneCondition(game.state, 'storms_eye').id, 'maelstrom');
  assert.equal(JSON.stringify(game.state), snapshot, 'getZoneCondition must not mutate gameState');

  // Relighting the beacon via story completion/ending shifts beacon_tower to sheltered
  game.state.story = { version: 1, stage: 'complete', ending: 'protect_town', flags: {} };
  assert.equal(getZoneCondition(game.state, 'beacon_tower').id, 'sheltered');
  game.state.story = { version: 1, stage: 'complete', ending: 'share_signal', flags: {} };
  assert.equal(getZoneCondition(game.state, 'beacon_tower').id, 'sheltered');
  game.state.story = { version: 1, stage: 'briefing', ending: null, flags: { beacon_lit: true } };
  assert.equal(getZoneCondition(game.state, 'beacon_tower').id, 'sheltered');

  // Defeating the Storm Heart shifts stormcrown_spire and storms_eye to clear (Broken Skies)
  game.state.story.flags.victory_storm_heart = true;
  assert.equal(getZoneCondition(game.state, 'stormcrown_spire').id, 'clear');
  assert.equal(getZoneCondition(game.state, 'storms_eye').id, 'clear');
  assert.equal(getZoneCondition(game.state, 'highwatch_pass').id, 'rime');

  // waitTurn survey logs active zone condition name and summary
  travelToZone(game.state, 'highwatch_pass');
  game.setScene('explore', { zoneId: 'highwatch_pass' });
  exploreScene.actions.waitTurn(game);
  const lastLog = game.state.map.log.at(-1);
  assert.match(lastLog, /Rime Front: Freezing mountain downdrafts coat the pass and inland relay in rime\./);
});

test('getZoneProgress and getZoneVantage track encounters and caches without mutating state and render in exploration UI', () => {
  for (const zoneId of ZONE_ORDER) {
    const zone = ZONES[zoneId];
    assert.ok(zone.vantage && typeof zone.vantage.landmark === 'string', `${zoneId} has vantage landmark`);
    assert.ok(Number.isInteger(zone.vantage.elevation) && zone.vantage.elevation > 0, `${zoneId} has elevation`);
    assert.ok(typeof zone.vantage.surveyNote === 'string' && zone.vantage.surveyNote.length > 10, `${zoneId} has surveyNote`);
    assert.ok(typeof zone.vantage.fieldNote === 'string' && zone.vantage.fieldNote.length > 10, `${zoneId} has fieldNote`);
  }

  const game = makeMockGame();
  const snapshot = JSON.stringify(game.state);
  const ridgeProg0 = getZoneProgress(game.state, 'ridge_road');
  assert.equal(ridgeProg0.encountersCleared, 0);
  assert.equal(ridgeProg0.encountersTotal, 4);
  assert.equal(ridgeProg0.cachesOpened, 0);
  assert.equal(ridgeProg0.cachesTotal, 1);
  assert.equal(ridgeProg0.percent, 0);
  assert.equal(JSON.stringify(game.state), snapshot, 'getZoneProgress must not mutate gameState');

  const vantage0 = getZoneVantage(game.state, 'beacon_tower');
  assert.equal(vantage0.landmark, 'Belfry Parapet');
  assert.equal(vantage0.elevation, 366);
  assert.equal(vantage0.condition.id, 'gale');
  assert.match(vantage0.summary, /Belfry Parapet \(366m\) · Headland Gale:/);
  assert.match(vantage0.summary, /0% recon \(0\/1 threats, 0\/1 caches\)/);
  assert.equal(JSON.stringify(game.state), snapshot, 'getZoneVantage must not mutate gameState');

  // Clearing an encounter and opening a cache updates getZoneProgress
  recordEncounterVictory(game.state, 'ridge_patrol');
  game.state.map.completedInteractions.ridge_supply_cache = true;
  const ridgeProg1 = getZoneProgress(game.state, 'ridge_road');
  assert.equal(ridgeProg1.encountersCleared, 1);
  assert.equal(ridgeProg1.cachesOpened, 1);
  assert.equal(ridgeProg1.completedObjectives, 2);
  assert.equal(ridgeProg1.totalObjectives, 5);
  assert.equal(ridgeProg1.percent, 40);

  // Render exploration includes .zone-recon-summary with active weather, landmark, and progress
  travelToZone(game.state, 'ridge_road');
  game.setScene('explore', { zoneId: 'ridge_road' });
  const html = exploreScene.render(game);
  assert.match(html, /class="zone-recon-summary" title="Ridge Switchback Milestone \(144m\) · Coastal Squall:/);
  assert.match(html, /Coastal Squall/);
  assert.match(html, /Ridge Switchback Milestone \(144m\)/);
  assert.match(html, /Threats cleared 1\/4 · Caches 1\/1/);
});

test('getCompassBearing and getZoneCompassHint compute cardinal/intercardinal directions and prioritize zone objectives', () => {
  assert.deepEqual(getCompassBearing(4, 3, 4, 1), {
    bearing: 'N',
    directionLabel: 'North',
    distance: 2,
    dx: 0,
    dy: -2,
  });
  assert.deepEqual(getCompassBearing(2, 3, 8, 3), {
    bearing: 'E',
    directionLabel: 'East',
    distance: 6,
    dx: 6,
    dy: 0,
  });
  assert.deepEqual(getCompassBearing(2, 3, 5, 1), {
    bearing: 'NE',
    directionLabel: 'Northeast',
    distance: 5,
    dx: 3,
    dy: -2,
  });
  assert.equal(getCompassBearing(3, 3, 3, 3).bearing, 'HERE');

  const state = createInitialState();
  ensureMapState(state);
  // In Greyhaven (no fixed encounters or one-time caches), hint points to the East Gate → Ridge Road
  const greyhavenHint = getZoneCompassHint(state);
  assert.ok(greyhavenHint);
  assert.equal(greyhavenHint.kind, 'exit');
  assert.equal(greyhavenHint.id, 'ridge_road');
  assert.equal(greyhavenHint.bearing, 'E');
  assert.equal(greyhavenHint.distance, 6);
  assert.match(greyhavenHint.summary, /East Gate → Ridge Road \(E, 6 tiles\)/);

  // In Ridge Road, hint prioritizes the nearest uncleared encounter first, then caches, then exits
  travelToZone(state, 'ridge_road');
  const ridgeHint = getZoneCompassHint(state);
  assert.equal(ridgeHint.kind, 'encounter');
  assert.equal(ridgeHint.id, 'ridge_hound_den');

  state.map.clearedEncounters.ridge_hound_den = true;
  const secondEncHint = getZoneCompassHint(state);
  assert.equal(secondEncHint.kind, 'encounter');
  assert.equal(secondEncHint.id, 'ridge_patrol');
  assert.equal(secondEncHint.bearing, 'E');

  for (const enc of ZONES.ridge_road.encounters) {
    state.map.clearedEncounters[enc.encounterId || enc.id] = true;
  }
  const cacheHint = getZoneCompassHint(state);
  assert.equal(cacheHint.kind, 'interactable');
  assert.equal(cacheHint.id, 'ridge_supply_cache');

  for (const inter of ZONES.ridge_road.interactables) {
    state.map.completedInteractions[inter.interactionId || inter.id] = true;
  }
  const exitHint = getZoneCompassHint(state);
  assert.equal(exitHint.kind, 'exit');
  assert.equal(exitHint.id, 'highwatch_pass');
});

test('findSafePath and stepAlongSafePath navigate walkable routes, pause adjacent to threats, and wire into exploreScene', () => {
  const state = createInitialState();
  const mapState = ensureMapState(state);
  const greyhaven = ZONES.greyhaven;

  // From (2, 3) to (6, 3) in Greyhaven is 4 steps East along the clear road
  const clearPath = findSafePath(greyhaven, mapState, 6, 3, state);
  assert.equal(clearPath.length, 4);
  assert.deepEqual(clearPath[0], { x: 3, y: 3, dx: 1, dy: 0 });
  assert.deepEqual(clearPath[3], { x: 6, y: 3, dx: 1, dy: 0 });

  // Wall tile returns null
  assert.equal(findSafePath(greyhaven, mapState, 0, 0, state), null);

  // stepAlongSafePath moves Wren to (6, 3) in one call
  const stepRes = stepAlongSafePath(state, 6, 3, { disableRandomEncounters: true });
  assert.equal(stepRes.moved, true);
  assert.equal(stepRes.stepsTaken, 4);
  assert.equal(state.map.x, 6);
  assert.equal(state.map.y, 3);

  // In Ridge Road, with side encounters cleared except ridge_patrol at (4, 3), stepping toward (7, 3) pauses cautiously at (3, 3)
  travelToZone(state, 'ridge_road');
  assert.equal(state.map.x, 1);
  assert.equal(state.map.y, 3);
  state.map.completedInteractions.dispatch_ridge = true;
  for (const enc of ZONES.ridge_road.encounters) {
    const id = enc.encounterId || enc.id;
    if (id !== 'ridge_patrol') state.map.clearedEncounters[id] = true;
  }
  const ridgeRes = stepAlongSafePath(state, 4, 1, { disableRandomEncounters: true });
  assert.equal(ridgeRes.moved, true);
  assert.equal(state.map.x, 4);
  assert.equal(state.map.y, 1);
  // Stepping toward (7, 3) when ridge_patrol is at (5, 3) routes around the chasm and pauses at (6, 3) adjacent to Ridge Patrol Pack
  state.map.x = 2;
  state.map.y = 3;
  const cautionRes = stepAlongSafePath(state, 7, 3, { disableRandomEncounters: true });
  assert.equal(cautionRes.moved, true);
  assert.equal(state.map.x, 6);
  assert.equal(state.map.y, 3);
  assert.ok(cautionRes.log.some((l) => l.includes('Paused near Ridge Patrol Pack')));

  // exploreScene.actions.mapStepTo supports both data-x/data-y and data-arg="x,y" and renders the compass bearing
  const game = makeMockGame();
  const rendered = exploreScene.render(game);
  assert.match(rendered, /Compass bearing: <strong>East Gate → Ridge Road<\/strong> \(E, 6 tiles\)/);
  exploreScene.actions.mapStepTo(game, { dataset: { x: '5', y: '3' } });
  assert.equal(game.state.map.x, 5);
  assert.equal(game.state.map.y, 3);

  // Verify installMap detaches the root click listener on cleanup and attaches cleanly on reinstall
  const clickListeners = [];
  const rootGame = makeMockGame();
  rootGame.state.scene = 'explore';
  let renderCount = 0;
  rootGame.render = () => { renderCount += 1; };
  rootGame.root = {
    addEventListener(type, fn) {
      if (type === 'click') clickListeners.push(fn);
    },
    removeEventListener(type, fn) {
      if (type === 'click') {
        const idx = clickListeners.indexOf(fn);
        if (idx !== -1) clickListeners.splice(idx, 1);
      }
    },
  };
  const cleanup1 = installMap(rootGame, { enableKeyboard: false });
  assert.equal(clickListeners.length, 1);
  cleanup1();
  assert.equal(clickListeners.length, 0);
  // Clicking after cleanup leaves Wren at (2, 3)
  for (const fn of [...clickListeners]) {
    fn({ target: { closest: (sel) => (sel === '.map-cell[data-x][data-y]' ? { dataset: { x: '6', y: '3' } } : null) } });
  }
  assert.equal(rootGame.state.map.x, 2);
  assert.equal(rootGame.state.map.y, 3);
  assert.equal(renderCount, 0);

  // Reinstall attaches exactly one handler and moves Wren once
  const cleanup2 = installMap(rootGame, { enableKeyboard: false });
  assert.equal(clickListeners.length, 1);
  for (const fn of [...clickListeners]) {
    fn({ target: { closest: (sel) => (sel === '.map-cell[data-x][data-y]' ? { dataset: { x: '6', y: '3' } } : null) } });
  }
  assert.equal(rootGame.state.map.x, 6);
  assert.equal(rootGame.state.map.y, 3);
  assert.equal(renderCount, 1);
  cleanup2();
  assert.equal(clickListeners.length, 0);
});


test('getEncounterPreview and getZoneThreatIntel resolve difficulty-scaled threat tiers, drop percentages, unscouted gating, and visible exploration previews without mutating state', () => {
  const state = createInitialState();
  state.bestiary = { ridge_bandit: 2 };
  const snapshot = JSON.stringify(state);

  const banditPreview = getEncounterPreview('ridge_bandit', state);
  assert.equal(banditPreview.enemyId, 'ridge_bandit');
  assert.equal(banditPreview.name, 'Ridge Bandit');
  assert.equal(banditPreview.tier, 'Standard');
  assert.equal(banditPreview.hp, 20);
  assert.equal(banditPreview.known, true);
  assert.equal(banditPreview.defeatedCount, 2);
  assert.ok(banditPreview.drops.some((d) => d.id === 'scrap_metal' && d.name === 'Scrap Metal' && d.percent === 50));
  assert.match(banditPreview.summary, /Ridge Bandit \(Standard, 20 HP\) · Drops: Linen Bandage \(50%\), Scrap Metal \(50%\), Waterlogged Dispatch \(10%\)/);

  // Difficulty scaling matches actual combat scaling (15 / 20 / 26 / 32 HP for Ridge Bandit)
  assert.equal(getEncounterPreview('ridge_bandit', { settings: { difficulty: 'story' } }).hp, 15);
  assert.equal(getEncounterPreview('ridge_bandit', { settings: { difficulty: 'standard' } }).hp, 20);
  assert.equal(getEncounterPreview('ridge_bandit', { settings: { difficulty: 'veteran' } }).hp, 26);
  assert.equal(getEncounterPreview('ridge_bandit', { settings: { difficulty: 'stormborn' } }).hp, 32);

  // Unscouted foes hide drop item names behind Unscouted (percent%) to avoid boss-loot spoilers
  const wraithPreview = getEncounterPreview('tide_wraith', state);
  assert.equal(wraithPreview.boss, true);
  assert.equal(wraithPreview.tier, 'Boss');
  assert.equal(wraithPreview.known, false);
  assert.ok(wraithPreview.drops.every((d) => d.guaranteed === true && d.percent === 100));
  assert.match(wraithPreview.summary, /Tide Wraith \(Boss, 50 HP\) · Drops: Unscouted \(100%, 100%\)/);

  // Once recorded in bestiary, boss drop names are revealed
  const scoutedWraith = getEncounterPreview('tide_wraith', { bestiary: { tide_wraith: 1 } });
  assert.equal(scoutedWraith.known, true);
  assert.match(scoutedWraith.summary, /Tide Wraith \(Boss, 50 HP\) · Drops: Storm Tonic \(100%\), Storm Glass \(100%\)/);

  // Malformed bestiary counts and inherited enemy IDs are rejected safely
  assert.equal(getEncounterPreview('ridge_bandit', { bestiary: { ridge_bandit: -3 } }).known, false);
  assert.equal(getEncounterPreview('ridge_bandit', { bestiary: { ridge_bandit: 1.5 } }).known, false);
  assert.equal(getEncounterPreview('ridge_bandit', { bestiary: { ridge_bandit: '2' } }).known, false);
  assert.equal(getEncounterPreview('constructor', state), null);
  assert.equal(getEncounterPreview('toString', state), null);
  assert.equal(getEncounterPreview('unknown_foe', state), null);

  const havenIntel = getZoneThreatIntel(state, 'greyhaven');
  assert.equal(havenIntel.zoneId, 'greyhaven');
  assert.equal(havenIntel.zoneName, 'Greyhaven');
  assert.equal(havenIntel.dangerLevel, 0);
  assert.equal(havenIntel.fixedTotalCount, 0);
  assert.equal(havenIntel.roamingCount, 0);
  assert.equal(havenIntel.encounterPercent, 0);
  assert.equal(havenIntel.summary, 'Safe haven · No fixed threats or roaming hostiles');

  const ridgeIntel = getZoneThreatIntel(state, 'ridge_road');
  assert.equal(ridgeIntel.zoneId, 'ridge_road');
  assert.equal(ridgeIntel.zoneName, 'Ridge Road');
  assert.equal(ridgeIntel.dangerLevel, 1);
  assert.equal(ridgeIntel.fixedActiveCount, 2);
  assert.equal(ridgeIntel.fixedClearedCount, 0);
  assert.equal(ridgeIntel.fixedLockedCount, 2);
  assert.equal(ridgeIntel.fixedTotalCount, 4);
  assert.equal(ridgeIntel.roamingCount, 4);
  assert.equal(ridgeIntel.roamingScoutedCount, 1);
  assert.equal(ridgeIntel.encounterPercent, 12);
  assert.equal(
    ridgeIntel.summary,
    'Danger 1 · Fixed threats: 2 active, 0 cleared, 2 locked · Roaming: 1/4 scouted (12% ambush)',
  );
  assert.ok(ridgeIntel.fixedEncounters.some((e) => e.id === 'ridge_patrol' && e.preview.name === 'Ridge Bandit' && !e.cleared && !e.locked));
  const lockedRidgeEncounters = ridgeIntel.fixedEncounters.filter((e) => e.locked);
  assert.equal(lockedRidgeEncounters.length, 2);
  assert.ok(lockedRidgeEncounters.every((e) => e.id === 'sealed_challenge' && e.name === 'Sealed challenge' && e.enemyId === 'sealed_challenge' && e.preview === null && e.summary === 'Sealed challenge · Locked'));
  assert.doesNotMatch(JSON.stringify(ridgeIntel.fixedEncounters), /Old Tusk|old_tusk|Thunderhoof|thunderhoof/);
  assert.ok(ridgeIntel.roamingEncounters.some((r) => r.enemyId === 'storm_rat' && r.preview.name === 'Storm Rat'));
  assert.equal(JSON.stringify(state), snapshot);

  const unlockedIntel = getZoneThreatIntel({ ...state, story: { flags: { rescue_reward: true } } }, 'ridge_road');
  assert.ok(unlockedIntel.fixedEncounters.some((e) => e.id === 'ridge_old_tusk' && e.enemyId === 'old_tusk' && !e.locked && e.preview?.name === 'Old Tusk'));
  assert.ok(unlockedIntel.fixedEncounters.some((e) => e.locked && e.id === 'sealed_challenge' && e.x === 6 && e.y === 4));

  // Verify exploration UI renders threat preview in encounter cell, Engage button tooltip, and visible .nearby-threat-preview
  const game = makeMockGame();
  travelToZone(game.state, 'ridge_road');
  game.state.bestiary = { ridge_bandit: 1 };
  game.state.map.x = 4;
  game.state.map.y = 3;
  const html = exploreScene.render(game);
  assert.match(html, /aria-label="Threat: Ridge Patrol Pack"[^>]*title="Threat: Ridge Patrol Pack — Ridge Bandit \(Standard, 20 HP\) · Drops: Linen Bandage \(50%\), Scrap Metal \(50%\), Waterlogged Dispatch \(10%\)"/);
  assert.match(html, /data-action="mapEncounter" data-arg="ridge_patrol" title="Ridge Bandit \(Standard, 20 HP\) · Drops: Linen Bandage \(50%\), Scrap Metal \(50%\), Waterlogged Dispatch \(10%\)"/);
  assert.match(html, /<p class="nearby-threat-preview">Ridge Bandit \(Standard, 20 HP\) · Drops: Linen Bandage \(50%\), Scrap Metal \(50%\), Waterlogged Dispatch \(10%\)<\/p>/);
  assert.match(html, /<p class="zone-checklist__threats">Danger 1 · Fixed threats: 2 active, 0 cleared, 2 locked · Roaming: 1\/4 scouted \(12% ambush\)<\/p>/);
});

test('getFrontierAtlas computes read-only Frontier Atlas overview across all 9 zones and renders .frontier-atlas in exploration UI without spoiling uncharted regions', () => {
  const game = makeMockGame();
  const state = game.state;
    const initialAtlas = getFrontierAtlas(state);
    assert.equal(initialAtlas.currentZoneId, 'greyhaven');
    assert.equal(initialAtlas.zonesTotal, 9);
    assert.equal(initialAtlas.zonesVisited, 1);
    assert.equal(initialAtlas.totalEncountersCleared, 0);
    assert.equal(initialAtlas.totalCachesOpened, 0);
    assert.equal(initialAtlas.overallPercent, 0);
    assert.equal(initialAtlas.zones.length, 9);

    assert.equal(initialAtlas.summary, '1/9 regions charted · 0% recon (0/27 threats, 0/8 caches)');
    const greyhavenEntry = initialAtlas.zones.find((z) => z.zoneId === 'greyhaven');
    assert.ok(greyhavenEntry);
    assert.equal(greyhavenEntry.visited, true);
    assert.equal(greyhavenEntry.isCurrent, true);
    assert.equal(greyhavenEntry.conditionName, 'Lantern Shelter');
    assert.deepEqual(greyhavenEntry.connections, ['ridge_road', 'saltmere_coast']);
    assert.deepEqual(greyhavenEntry.connectedNames, ['Ridge Road', 'Saltmere Coast']);
    assert.equal(greyhavenEntry.summary, 'Greyhaven (Current) · Lantern Shelter · Safe haven · Routes: Ridge Road, Saltmere Coast');

    const unvisitedRidge = initialAtlas.zones.find((z) => z.zoneId === 'ridge_road');
    assert.equal(unvisitedRidge.visited, false);
    assert.equal(unvisitedRidge.summary, 'Uncharted region (Danger 1)');
    const lockedEye = initialAtlas.zones.find((z) => z.zoneId === 'storms_eye');
    assert.equal(lockedEye.visited, false);
    assert.match(lockedEye.summary, /^Locked — /);

    const eyeEntry = initialAtlas.zones.find((z) => z.zoneId === 'storms_eye');
    assert.ok(eyeEntry);
    assert.equal(eyeEntry.visited, false);
    assert.equal(eyeEntry.unlocked, false);

    // Travel to Ridge Road, clear an encounter and open a cache
    travelToZone(state, 'ridge_road', 'from_greyhaven');
    recordEncounterVictory(state, 'ridge_patrol', 'ridge_bandit');
    state.map.completedInteractions.ridge_supply_cache = true;
    const beforeSnapshot = JSON.stringify(state);

    const updatedAtlas = getFrontierAtlas(state);
    assert.equal(JSON.stringify(state), beforeSnapshot, 'getFrontierAtlas must not mutate gameState');
    assert.equal(updatedAtlas.currentZoneId, 'ridge_road');
    assert.equal(updatedAtlas.zonesVisited, 2);
    assert.equal(updatedAtlas.totalEncountersCleared, 1);
    assert.equal(updatedAtlas.totalCachesOpened, 1);
    assert.ok(updatedAtlas.overallPercent > 0);

    const ridgeEntry = updatedAtlas.zones.find((z) => z.zoneId === 'ridge_road');
    assert.equal(ridgeEntry.visited, true);
    assert.equal(ridgeEntry.isCurrent, true);
    assert.equal(ridgeEntry.encountersCleared, 1);
    assert.equal(ridgeEntry.cachesOpened, 1);

    // Render exploration UI and verify .frontier-atlas shows visited regions and masks uncharted ones
  const html = exploreScene.render(game);
  assert.match(html, /class="shortcut-guide frontier-atlas"/);
  assert.match(html, /Frontier atlas \(2\/9 regions · \d+% recon\)/);
  assert.match(html, /data-zone-id="greyhaven" data-current="false"/);
  assert.match(html, /data-zone-id="ridge_road" data-current="true"/);
  assert.match(html, /Routes: Greyhaven, Observatory Ruins, Highwatch Pass/);
  assert.match(html, /7 frontier regions remain uncharted\./);
  assert.doesNotMatch(html, /data-zone-id="storms_eye"/);
  assert.match(html, /data-zone-id="greyhaven" data-current="false" title="Greyhaven · Lantern Shelter · Safe haven · Routes: Ridge Road, Saltmere Coast"/);
  state.inventory = [{ id: 'healing_herb', qty: 2 }];
  const htmlWithPack = exploreScene.render(game);
  assert.match(htmlWithPack, /<ul class="field-pack__items"><li title="[^"]+"><span>/);
});


test('getRouteBriefing and formatExpeditionLog provide spoiler-safe route briefings and collapse consecutive duplicate log entries without mutating state', () => {
  const game = makeMockGame();
  const state = game.state;

  // Unknown and inherited keys return null
  assert.equal(getRouteBriefing(state, 'unknown_zone'), null);
  assert.equal(getRouteBriefing(state, 'toString'), null);
  assert.equal(getRouteBriefing(state, '__proto__'), null);

  // Unvisited unlocked route masks weather and objective counts
  const unvisitedRidge = getRouteBriefing(state, 'ridge_road');
  assert.ok(unvisitedRidge);
  assert.equal(unvisitedRidge.visited, false);
  assert.equal(unvisitedRidge.unlocked, true);
  assert.equal(unvisitedRidge.summary, 'Ridge Road · Uncharted region (Danger 1)');

  // Locked route shows lock reason without spoiling weather or objective counts
  const lockedEye = getRouteBriefing(state, 'storms_eye');
  assert.ok(lockedEye);
  assert.equal(lockedEye.visited, false);
  assert.equal(lockedEye.unlocked, false);
  assert.match(lockedEye.summary, /^The Storm’s Eye · Locked — /);

  // Visited safe haven route
  const greyhavenBrief = getRouteBriefing(state, 'greyhaven');
  assert.equal(greyhavenBrief.visited, true);
  assert.equal(greyhavenBrief.summary, 'Greyhaven · Lantern Shelter · Safe haven');

  // Visit Ridge Road and clear one objective, then return near East Gate in Greyhaven
  travelToZone(state, 'ridge_road', 'from_greyhaven');
  recordEncounterVictory(state, 'ridge_patrol', 'ridge_bandit');
  travelToZone(state, 'greyhaven', 'from_ridge_road');
  state.map.x = 7;
  state.map.y = 3;

  const beforeSnapshot = JSON.stringify(state);
  const visitedRidge = getRouteBriefing(state, 'ridge_road');
  assert.equal(JSON.stringify(state), beforeSnapshot, 'getRouteBriefing must not mutate gameState');
  assert.equal(visitedRidge.visited, true);
  assert.equal(visitedRidge.conditionName, 'Coastal Squall');
  assert.equal(visitedRidge.encountersCleared, 1);
  assert.match(visitedRidge.summary, /^Ridge Road · Coastal Squall · \d+% recon \(1\/\d+ threats, 0\/1 caches\)$/);

  // formatExpeditionLog collapses consecutive identical lines newest-first without mutating array
  const rawLogs = [
    'Entered Greyhaven: Storm-Battered Frontier Town.',
    'Path blocked by Stone Wall.',
    'Path blocked by Stone Wall.',
    'Path blocked by Stone Wall.',
    'Surveyed Cobblestone Road.',
    'Surveyed Cobblestone Road.',
  ];
  const rawCopy = [...rawLogs];
  const formatted = formatExpeditionLog(rawLogs, 6);
  assert.deepEqual(rawLogs, rawCopy, 'formatExpeditionLog must not mutate input array');
  assert.deepEqual(formatted, [
    'Surveyed Cobblestone Road. (×2)',
    'Path blocked by Stone Wall. (×3)',
    'Entered Greyhaven: Storm-Battered Frontier Town.',
  ]);
  assert.deepEqual(formatExpeditionLog(null), []);

  // Verify exploration UI renders route briefing on exit cell, exit button, visible .nearby-route-preview, and deduplicated log
  state.map.log = [...rawLogs];
  const html = exploreScene.render(game);
  assert.match(html, /class="nearby-threat-preview nearby-route-preview">Ridge Road · Coastal Squall · \d+% recon/);
  assert.match(html, /data-action="mapTravel" data-arg="ridge_road" title="Ridge Road · Coastal Squall · \d+% recon/);
  assert.match(html, /East Gate → Ridge Road — Ridge Road · Coastal Squall · \d+% recon/);
  assert.match(html, /<p>Surveyed Cobblestone Road\. \(×2\)<\/p>/);
  assert.match(html, /<p>Path blocked by Stone Wall\. \(×3\)<\/p>/);
  assert.deepEqual(state.map.log, rawCopy, 'exploreScene.render must not mutate state.map.log');
});


test('getZoneChecklist and fast-travel tooltips report live zone landmarks, statuses, and visited route briefings without mutating state', () => {
  const game = makeMockGame();
  const state = game.state;

  // Visit Ridge Road, clear ridge_patrol, open ridge_supply_cache
  travelToZone(state, 'ridge_road', 'from_greyhaven');
  const beforeSnapshot = JSON.stringify(state);
  const initialChecklist = getZoneChecklist(state, 'ridge_road');
  assert.equal(JSON.stringify(state), beforeSnapshot, 'getZoneChecklist must not mutate gameState');
  assert.equal(initialChecklist.zoneId, 'ridge_road');

  const patrolBefore = initialChecklist.encounters.find((e) => e.id === 'ridge_patrol');
  assert.ok(patrolBefore);
  assert.equal(patrolBefore.status, 'Active');
  assert.equal(patrolBefore.cleared, false);
  assert.equal(patrolBefore.unlocked, true);

  const lockedEncs = initialChecklist.encounters.filter((e) => e.status === 'Locked');
  assert.ok(lockedEncs.length >= 2);
  for (const locked of lockedEncs) {
    assert.equal(locked.id, 'sealed_challenge');
    assert.equal(locked.name, 'Sealed challenge');
    assert.equal(locked.unlocked, false);
  }
  assert.equal(initialChecklist.encounters.some((e) => /Thunderhoof|Old Tusk/i.test(e.name)), false);

  const cacheBefore = initialChecklist.interactables.find((i) => i.id === 'ridge_supply_cache');
  assert.ok(cacheBefore);
  assert.equal(cacheBefore.status, 'Available');

  recordEncounterVictory(state, 'ridge_patrol', 'ridge_bandit');
  state.map.completedInteractions.ridge_supply_cache = true;

  const afterChecklist = getZoneChecklist(state, 'ridge_road');
  assert.equal(afterChecklist.encounters.find((e) => e.id === 'ridge_patrol').status, 'Cleared');
  assert.equal(afterChecklist.interactables.find((i) => i.id === 'ridge_supply_cache').status, 'Completed');

  const html = exploreScene.render(game);
  assert.match(html, /class="shortcut-guide zone-checklist"/);
  assert.match(html, /Zone field checklist \(\d+ landmarks\)/);
  const checklistHtml = html.match(/<details class="shortcut-guide zone-checklist">[\s\S]*?<\/details>/)?.[0] || '';
  assert.ok(checklistHtml.length > 0);
  assert.doesNotMatch(checklistHtml, /Thunderhoof|Old Tusk/i);
  assert.match(html, /data-poi-kind="encounter" data-poi-id="sealed_challenge" data-poi-status="Locked"><strong>Sealed challenge<\/strong>/);
  assert.match(html, /data-poi-kind="encounter" data-poi-id="ridge_patrol" data-poi-status="Cleared"/);
  assert.match(html, /data-poi-kind="interactable" data-poi-id="ridge_supply_cache" data-poi-status="Completed"/);
  assert.match(html, /data-action="mapTravel" data-arg="greyhaven" title="Greyhaven · Lantern Shelter · Safe haven"/);
});


test('getTileInspection and terrain compass report spoiler-safe current tile and adjacent landmarks without mutating state', () => {
  const game = makeMockGame();
  const state = game.state;
  ensureMapState(state);

  // In Greyhaven, Warden Mara is at (3, 2); standing at (3, 3) puts Mara to the North
  state.map.x = 3;
  state.map.y = 3;
  const beforeSnapshot = JSON.stringify(state);
  const info = getTileInspection(state);
  assert.equal(JSON.stringify(state), beforeSnapshot, 'getTileInspection must not mutate gameState');
  assert.equal(info.zoneId, 'greyhaven');
  assert.equal(info.x, 3);
  assert.equal(info.y, 3);
  assert.equal(info.passable, true);
  assert.ok(info.adjacentLandmarks.some((a) => a.dir === 'North' && a.kind === 'npc' && /Warden Mara/i.test(a.label)));

  const html = exploreScene.render(game);
  assert.match(html, /class="terrain-compass__adjacent">Adjacent landmarks: <strong>North:<\/strong> Warden Mara \(Town Warden\)/);

  // In Ridge Road on a fresh save, inspecting adjacent to locked Old Tusk (6, 2) from (6, 3) masks it as Sealed challenge
  travelToZone(state, 'ridge_road', 'from_greyhaven');
  state.map.x = 6;
  state.map.y = 3;
  const ridgeInfo = getTileInspection(state);
  const northLandmark = ridgeInfo.adjacentLandmarks.find((a) => a.dir === 'North');
  const southLandmark = ridgeInfo.adjacentLandmarks.find((a) => a.dir === 'South');
  assert.equal(northLandmark?.id, 'sealed_challenge');
  assert.equal(northLandmark?.label, 'Sealed challenge');
  assert.equal(southLandmark?.id, 'sealed_challenge');
  assert.equal(southLandmark?.label, 'Sealed challenge');
  assert.doesNotMatch(ridgeInfo.summary, /Old Tusk|Thunderhoof/i);

  const ridgeHtml = exploreScene.render(game);
  const compassSection = ridgeHtml.match(/<section class="terrain-compass"[\s\S]*?<\/section>/)?.[0] || '';
  assert.match(compassSection, /class="terrain-compass__adjacent">Adjacent landmarks:[\s\S]*?Sealed challenge/);
  assert.doesNotMatch(compassSection, /Old Tusk|Thunderhoof/i);
});

test('getPatrolBriefing masks unscouted roaming hostiles, reflects story encounter chance reductions, and renders patrol tooltip + frontier atlas totals', () => {
  const state = createInitialState();
  ensureMapState(state);

  // Safe haven (Greyhaven) has no roaming hostiles
  const havenBriefing = getPatrolBriefing(state, 'greyhaven');
  assert.equal(havenBriefing.zoneId, 'greyhaven');
  assert.equal(havenBriefing.hasHostiles, false);
  assert.equal(havenBriefing.totalCount, 0);
  assert.equal(havenBriefing.summary, 'No roaming hostiles in Greyhaven.');

  // Travel to Ridge Road on a fresh save (0 bestiary entries)
  travelToZone(state, 'ridge_road');
  const beforeSnap = JSON.stringify(state);
  const unscouted = getPatrolBriefing(state);
  assert.equal(JSON.stringify(state), beforeSnap, 'getPatrolBriefing must not mutate gameState');
  assert.equal(unscouted.zoneId, 'ridge_road');
  assert.equal(unscouted.hasHostiles, true);
  assert.equal(unscouted.encounterPercent, 12);
  assert.equal(unscouted.scoutedCount, 0);
  assert.equal(unscouted.totalCount, 4);
  assert.ok(unscouted.hostiles.every((h) => h.enemyId === 'unscouted_hostile' && h.name === 'Unscouted hostile' && h.hp === null));
  assert.doesNotMatch(unscouted.summary, /Storm Rat|Ridge Bandit|Gale Hound|Briar Boar/);
  assert.match(unscouted.summary, /Step ambush: 12% · Roaming \(0\/4 scouted\): Unscouted hostile \(33%\), Unscouted hostile \(17%\), Unscouted hostile \(33%\), Unscouted hostile \(17%\)/);

  // Scout Storm Rat in bestiary and verify only Storm Rat is revealed while others stay masked
  state.bestiary = { storm_rat: 1 };
  const partial = getPatrolBriefing(state, 'ridge_road');
  assert.equal(partial.scoutedCount, 1);
  assert.equal(partial.hostiles[0].enemyId, 'unscouted_hostile');
  assert.equal(partial.hostiles[2].enemyId, 'storm_rat');
  assert.equal(partial.hostiles[2].name, 'Storm Rat');
  assert.equal(partial.hostiles[2].hp, 12);
  assert.match(partial.summary, /Roaming \(1\/4 scouted\): Unscouted hostile \(33%\), Unscouted hostile \(17%\), Storm Rat \(33%, 12 HP\), Unscouted hostile \(17%\)/);

  // Route network relay choice halves random encounter chance (12% -> 6%)
  state.story.flags.relay_choice = 'route_network';
  const calmed = getPatrolBriefing(state, 'ridge_road');
  assert.equal(calmed.encounterPercent, 6);
  assert.match(calmed.summary, /Step ambush: 6%/);

  // Verify getAvailableActions attaches patrol briefing and renderExploration renders patrol tooltip + frontier-atlas__totals
  const actions = getAvailableActions(state);
  const patrolAction = actions.find((a) => a.kind === 'patrol');
  assert.ok(patrolAction?.patrol);
  assert.equal(patrolAction.patrol.summary, calmed.summary);

  const html = exploreScene.render({ state });
  assert.match(html, /data-action="mapPatrol" data-arg="ridge_road" title="Step ambush: 6% · Roaming \(1\/4 scouted\): Unscouted hostile \(33%\), Unscouted hostile \(17%\), Storm Rat \(33%, 12 HP\), Unscouted hostile \(17%\)"/);
  assert.match(html, /<p class="frontier-atlas__totals">Total threats cleared: 0\/\d+ · Caches opened: 0\/\d+<\/p>/);
});

test('getFieldServicesSummary reports charted repeatable services, inn discount, and renders .frontier-atlas__services and .nearby-patrol-preview', () => {
  const state = createInitialState();
  ensureMapState(state);

  const beforeSnap = JSON.stringify(state);
  const initialServices = getFieldServicesSummary(state);
  assert.equal(JSON.stringify(state), beforeSnap, 'getFieldServicesSummary must not mutate gameState');
  assert.equal(initialServices.currentZoneId, 'greyhaven');
  assert.equal(initialServices.innCost, 5);
  assert.equal(initialServices.shelterNetworkActive, false);
  assert.equal(initialServices.routeNetworkActive, false);
  assert.equal(initialServices.stormCalmed, false);
  assert.equal(initialServices.inns.length, 1);
  assert.equal(initialServices.shops.length, 1);
  assert.equal(initialServices.musters.length, 1);
  assert.equal(initialServices.summary, 'Inn rest: 5g · Charted posts: 1 shop (Greyhaven)');

  // In Greyhaven (no roaming hostiles), no .nearby-patrol-preview is rendered, while .frontier-atlas__services is present
  const townHtml = exploreScene.render({ state });
  assert.match(townHtml, /<p class="frontier-atlas__services">Inn rest: 5g · Charted posts: 1 shop \(Greyhaven\)<\/p>/);
  assert.doesNotMatch(townHtml, /nearby-patrol-preview/);

  // Unlock and travel to Saltmere Coast and Sunscar Relay with shelter_network active
  state.story.flags.beacon_lit = true;
  state.story.flags.relay_choice = 'shelter_network';
  travelToZone(state, 'saltmere_coast');
  travelToZone(state, 'sunscar_relay');

  const midServices = getFieldServicesSummary(state);
  assert.equal(midServices.innCost, 2);
  assert.equal(midServices.shelterNetworkActive, true);
  assert.equal(midServices.shops.length, 3);
  assert.equal(
    midServices.summary,
    'Inn rest: 2g (Shelter Network) · Charted posts: 3 shops (Greyhaven, Saltmere Coast, Sunscar Relay)',
  );

  // Switch to route_network and victory_storm_heart, and verify visible .nearby-patrol-preview in wild zone
  state.story.flags.relay_choice = 'route_network';
  state.story.flags.victory_storm_heart = true;
  const routeServices = getFieldServicesSummary(state);
  assert.equal(
    routeServices.summary,
    'Inn rest: 5g · Charted posts: 3 shops (Greyhaven, Saltmere Coast, Sunscar Relay) · Route Network (-50% ambushes) · Storm Heart calmed',
  );

  const wildHtml = exploreScene.render({ state });
  assert.match(
    wildHtml,
    /<p class="frontier-atlas__services">Inn rest: 5g · Charted posts: 3 shops \(Greyhaven, Saltmere Coast, Sunscar Relay\) · Route Network \(-50% ambushes\) · Storm Heart calmed<\/p>/,
  );
  assert.match(
    wildHtml,
    /<p class="nearby-threat-preview nearby-patrol-preview">Step ambush: \d+% · Roaming \(0\/\d+ scouted\):/,
  );
});


test('getInteractableBriefing reports spoiler-safe station/cache status, guardian locks, inn affordability, and renders .nearby-interact-preview', () => {
  const state = createInitialState();
  ensureMapState(state);

  // Unknown interactable returns null without mutating state
  const beforeSnap = JSON.stringify(state);
  assert.equal(getInteractableBriefing(state, 'nonexistent_station'), null);
  assert.equal(getInteractableBriefing(state, '__proto__'), null);

  // Inn briefing in Greyhaven reflects cost and affordability
  const innBriefing = getInteractableBriefing(state, 'greyhaven_inn');
  assert.equal(JSON.stringify(state), beforeSnap, 'getInteractableBriefing must not mutate gameState');
  assert.equal(innBriefing.id, 'greyhaven_inn');
  assert.equal(innBriefing.kind, 'inn');
  assert.equal(innBriefing.status, 'Service');
  assert.equal(innBriefing.costGold, 5);
  assert.equal(innBriefing.canAfford, true);
  assert.equal(innBriefing.summary, 'Hearthstone Inn · Rest for 5g (full HP & MP)');

  // Insufficient gold for inn rest
  state.gold = 1;
  const brokeInn = getInteractableBriefing(state, 'greyhaven_inn');
  assert.equal(brokeInn.canAfford, false);
  assert.equal(brokeInn.summary, 'Hearthstone Inn · Rest for 5g (full HP & MP, insufficient gold)');
  state.gold = 25;

  // Guarded relic in Observatory Ruins before and after clearing observatory_sentinel
  const guardedRelic = getInteractableBriefing(state, 'observatory_lens_pedestal', 'observatory_ruins');
  assert.equal(guardedRelic.status, 'Guarded');
  assert.equal(guardedRelic.guardianCleared, false);
  assert.equal(guardedRelic.guardianName, 'Observatory Sentinel');
  assert.equal(guardedRelic.summary, 'Refractory Lens Pedestal · Guarded by Observatory Sentinel');

  state.map.clearedEncounters.observatory_sentinel = true;
  const unguardedRelic = getInteractableBriefing(state, 'observatory_lens_pedestal', 'observatory_ruins');
  assert.equal(unguardedRelic.status, 'Available');
  assert.equal(unguardedRelic.guardianCleared, true);
  assert.equal(unguardedRelic.summary, 'Refractory Lens Pedestal · Expedition relic (ready to recover)');

  // Unopened cache counts total supply items without spoiling item names
  const cacheBriefing = getInteractableBriefing(state, 'ridge_supply_cache', 'ridge_road');
  assert.equal(cacheBriefing.status, 'Available');
  assert.equal(cacheBriefing.rewardCount, 3);
  assert.equal(cacheBriefing.summary, 'Wayfarer Supply Crate · Unopened cache (3 supply items)');

  state.map.completedInteractions.ridge_supply_cache = true;
  const openedCache = getInteractableBriefing(state, 'ridge_supply_cache', 'ridge_road');
  assert.equal(openedCache.status, 'Completed');
  assert.equal(openedCache.completed, true);
  assert.equal(openedCache.summary, 'Wayfarer Supply Crate · Completed');

  // Stand adjacent to Hearthstone Inn (1, 1) at (1, 2) in Greyhaven and verify getAvailableActions + UI rendering
  state.map.zoneId = 'greyhaven';
  state.map.x = 1;
  state.map.y = 2;
  const actions = getAvailableActions(state);
  const innAction = actions.find((a) => a.kind === 'interact' && a.id === 'greyhaven_inn');
  assert.ok(innAction?.briefing);
  assert.equal(innAction.briefing.summary, 'Hearthstone Inn · Rest for 5g (full HP & MP)');

  const html = exploreScene.render({ state });
  assert.match(
    html,
    /data-action="mapInteract" data-arg="greyhaven_inn" title="Hearthstone Inn · Rest for 5g \(full HP &amp; MP\)"/,
  );
  assert.match(
    html,
    /<p class="nearby-threat-preview nearby-interact-preview">Hearthstone Inn · Rest for 5g \(full HP &amp; MP\)<\/p>/,
  );
});

test('getNpcBriefing reports field contact role, proximity, defaultLine, and renders .nearby-talk-preview + deduplicated station cell titles', () => {
  const state = createInitialState();
  ensureMapState(state);

  const beforeSnap = JSON.stringify(state);
  assert.equal(getNpcBriefing(state, 'nonexistent_npc'), null);
  assert.equal(getNpcBriefing(state, '__proto__'), null);

  // Spawn in Greyhaven (2, 3) is distance 2 from Warden Mara at (3, 2)
  const maraFar = getNpcBriefing(state, 'mara');
  assert.equal(JSON.stringify(state), beforeSnap, 'getNpcBriefing must not mutate gameState');
  assert.equal(maraFar.id, 'mara');
  assert.equal(maraFar.name, 'Warden Mara');
  assert.equal(maraFar.role, 'Town Warden');
  assert.equal(maraFar.zoneId, 'greyhaven');
  assert.equal(maraFar.distance, 2);
  assert.equal(maraFar.adjacent, false);
  assert.match(maraFar.summary, /^Warden Mara \(Town Warden\) · "The beacon kept these streets safe for thirty years\./);

  // Move to (3, 3), adjacent to Warden Mara (3, 2)
  state.map.x = 3;
  state.map.y = 3;
  const maraAdj = getNpcBriefing(state, 'mara');
  assert.equal(maraAdj.distance, 1);
  assert.equal(maraAdj.adjacent, true);

  // Advancing story stage updates getNpcBriefing live dialogue line to match getDialogue
  const completedState = {
    ...state,
    story: { ...state.story, stage: 'complete', ending: 'protect_town' },
  };
  const maraCompleted = getNpcBriefing(completedState, 'mara');
  assert.match(maraCompleted.summary, /The walls are holding\. Now we owe our neighbors a rescue plan\./);

  // Muster station summary uses "Party roster & equipment"
  const musterBriefing = getInteractableBriefing(state, 'greyhaven_watch_house', 'greyhaven');
  assert.equal(musterBriefing.summary, 'Watch House Muster Board · Party roster & equipment');

  const actions = getAvailableActions(state);
  const talkAction = actions.find((a) => a.kind === 'talk' && a.id === 'mara');
  assert.ok(talkAction?.briefing);
  assert.equal(talkAction.briefing.summary, maraAdj.summary);

  const html = exploreScene.render({ state });
  assert.match(
    html,
    /data-action="mapTalk" data-arg="mara" title="Warden Mara \(Town Warden\) · &quot;The beacon kept these streets safe for thirty years\./,
  );
  assert.match(
    html,
    /<p class="nearby-threat-preview nearby-talk-preview">Warden Mara \(Town Warden\) · &quot;The beacon kept these streets safe for thirty years\./,
  );
  // Verify interactable cell title uses briefing.summary directly without duplicating station name
  assert.match(
    html,
    /title="Watch House Muster Board · Party roster &amp; equipment" data-x="2" data-y="1"/,
  );
});

test('getZoneChecklist computes relative tile distances, compass bearings, spoiler-safe encounter tooltips, and checklist summary line', () => {
  const game = makeMockGame();
  const state = game.state;
  ensureMapState(state);

  // 1. Greyhaven: contacts, services, and outbound routes
  const greyhavenChecklist = getZoneChecklist(state, 'greyhaven');
  assert.equal(greyhavenChecklist.counts.npcs, 3);
  assert.match(greyhavenChecklist.summary, /3 contacts · Stations: 4 services · Routes:/);
  const mara = greyhavenChecklist.npcs.find((n) => n.id === 'mara');
  assert.ok(mara);
  assert.equal(mara.distance, Math.abs(mara.x - greyhavenChecklist.originX) + Math.abs(mara.y - greyhavenChecklist.originY));
  assert.ok(mara.bearing.length > 0);

  // 2. Ridge Road: active and locked threats, cache, and routes
  travelToZone(state, 'ridge_road', 'from_greyhaven');
  assert.equal(state.map.x, 1);
  assert.equal(state.map.y, 3);

  const checklist = getZoneChecklist(state, 'ridge_road');
  assert.equal(checklist.originX, 1);
  assert.equal(checklist.originY, 3);
  assert.equal(checklist.counts.npcs, 0);
  assert.equal(checklist.counts.encountersActive, 2);
  assert.equal(checklist.counts.encountersCleared, 0);
  assert.equal(checklist.counts.encountersLocked, 2);
  assert.match(checklist.summary, /Threats: 2 active, 0 cleared, 2 locked · Stations: 2 available · Routes: 1 charted, 2 uncharted/);

  // ridge_patrol at (5, 3) -> distance 4, bearing E, spoiler-safe unscouted drop in summary
  const patrol = checklist.encounters.find((e) => e.id === 'ridge_patrol');
  assert.ok(patrol);
  assert.equal(patrol.distance, 4);
  assert.equal(patrol.bearing, 'E');
  assert.match(patrol.summary, /Ridge Patrol Pack · Active — Ridge Bandit \(Standard, 20 HP\) · Drops: Unscouted/);

  // Locked encounters must never leak enemy names or stats in summary
  const locked = checklist.encounters.filter((e) => e.status === 'Locked');
  assert.equal(locked.length, 2);
  for (const item of locked) {
    assert.equal(item.summary, 'Sealed challenge · Locked');
    assert.doesNotMatch(item.summary, /Old Tusk|Thunderhoof/i);
  }

  // Exit back to Greyhaven is at (0, 3) -> distance 1, bearing W
  const greyhavenExit = checklist.exits.find((x) => x.toZone === 'greyhaven');
  assert.ok(greyhavenExit);
  assert.equal(greyhavenExit.distance, 1);
  assert.equal(greyhavenExit.bearing, 'W');

  const html = exploreScene.render(game);
  const checklistHtml = html.match(/<details class="shortcut-guide zone-checklist">[\s\S]*?<\/details>/)?.[0] || '';
  assert.match(checklistHtml, /class="zone-checklist__summary">Threats: 2 active, 0 cleared, 2 locked · Stations: 2 available · Routes: 1 charted, 2 uncharted/);
  assert.match(checklistHtml, /title="Sealed challenge · Locked" data-poi-kind="encounter" data-poi-id="sealed_challenge" data-poi-status="Locked"><strong>Sealed challenge<\/strong> · Locked · \(6, 2\) · 6 tiles NE/);
  assert.match(checklistHtml, /data-poi-kind="exit" data-poi-id="greyhaven" data-poi-status="Charted"><strong>West Trail → Greyhaven<\/strong> · Charted · \(0, 3\) · 1 tile W/);
  assert.doesNotMatch(checklistHtml, /Old Tusk|Thunderhoof/i);
});

test('getFieldServicesSummary reports field pack consumable/craft readiness, renders .frontier-atlas__pack, and attaches useFieldItem button tooltips', () => {
  const state = createInitialState();
  ensureMapState(state);

  const emptyServices = getFieldServicesSummary(state);
  assert.equal(emptyServices.consumableStacks, 0);
  assert.equal(emptyServices.consumableUnits, 0);
  assert.equal(emptyServices.craftableCount, 0);
  assert.deepEqual(emptyServices.craftableNames, []);
  assert.equal(emptyServices.packSummary, 'Field pack: 0 consumables · Craft ready: 0');

  const emptyHtml = exploreScene.render({ state });
  assert.match(emptyHtml, /<p class="frontier-atlas__pack">Field pack: 0 consumables · Craft ready: 0<\/p>/);

  // Add consumables and crafting materials, plus a companion to verify ally useFieldItem tooltips
  state.inventory = [
    { id: 'bandage', qty: 2 },
    { id: 'storm_tonic', qty: 1 },
    { id: 'healing_herb', qty: 1 },
    { id: 'storm_glass', qty: 1 },
  ];
  state.party.push({
    id: 'bram',
    name: 'Bram',
    hp: 35,
    maxHp: 35,
    mp: 8,
    maxMp: 8,
    atk: 8,
    def: 5,
    spd: 4,
    level: 1,
    xp: 0,
  });

  const beforeSnap = JSON.stringify(state);
  const stockedServices = getFieldServicesSummary(state);
  assert.equal(JSON.stringify(state), beforeSnap, 'getFieldServicesSummary must not mutate stocked state');
  assert.equal(stockedServices.consumableStacks, 3);
  assert.equal(stockedServices.consumableUnits, 4);
  assert.equal(stockedServices.craftableCount, 3);
  assert.deepEqual(stockedServices.craftableNames, [
    'Distill Storm Tonic',
    'Pack a Field Dressing',
    'Mull a Highland Flask',
  ]);
  assert.equal(
    stockedServices.packSummary,
    'Field pack: 4 consumables (3 stacks) · Craft ready: 3 (Distill Storm Tonic, Pack a Field Dressing, Mull a Highland Flask)',
  );

  const stockedHtml = exploreScene.render({ state });
  assert.match(
    stockedHtml,
    /<p class="frontier-atlas__pack">Field pack: 4 consumables \(3 stacks\) · Craft ready: 3 \(Distill Storm Tonic, Pack a Field Dressing, Mull a Highland Flask\)<\/p>/,
  );
  assert.match(
    stockedHtml,
    /data-action="useFieldItem" data-arg="bandage" title="Brine-washed linen strips\. Stops bleeding and covers the ugliest wounds\."/,
  );
  assert.match(
    stockedHtml,
    /data-action="useFieldItem" data-arg="bandage:1" title="Brine-washed linen strips\. Stops bleeding and covers the ugliest wounds\."/,
  );
});

test('getTileInspection attaches spoiler-safe cell and entity summaries and renders terrain compass and movement button tooltips', () => {
  const game = makeMockGame();
  const state = game.state;
  ensureMapState(state);

  // Stand at (3, 3) in Greyhaven: Warden Mara is North at (3, 2)
  state.map.x = 3;
  state.map.y = 3;
  const beforeSnap = JSON.stringify(state);
  const info = getTileInspection(state);
  assert.equal(JSON.stringify(state), beforeSnap, 'getTileInspection must not mutate gameState');
  assert.match(info.neighbors.north.summary, /Windswept Scrub \(3, 2\) · Passable · Warden Mara \(Town Warden\)/);
  assert.ok(info.neighbors.north.entity?.summary?.includes('Warden Mara'));
  const northLandmark = info.adjacentLandmarks.find((a) => a.dir === 'North');
  assert.ok(northLandmark?.summary?.includes('Warden Mara'));

  const html = exploreScene.render(game);
  assert.match(html, /data-direction="north" data-passable="true" title="Windswept Scrub \(3, 2\) · Passable · Warden Mara \(Town Warden\)"/);
  assert.match(html, /data-action="moveNorth"[^>]*title="Windswept Scrub \(3, 2\) · Passable · Warden Mara \(Town Warden\)"/);
  assert.match(html, /data-action="waitTurn"[^>]*title="Cobble \/ Trail \(3, 3\) · Passable · Adjacent: North Warden Mara \(Town Warden\)"/);

  // In Ridge Road at (6, 3), locked Old Tusk at (6, 2) stays masked in neighbor and movement button tooltips
  travelToZone(state, 'ridge_road', 'from_greyhaven');
  state.map.x = 6;
  state.map.y = 3;
  const ridgeInfo = getTileInspection(state);
  assert.equal(ridgeInfo.neighbors.north.entity?.summary, 'Sealed challenge · Locked');
  assert.doesNotMatch(ridgeInfo.neighbors.north.summary, /Old Tusk|Thunderhoof/i);
  const ridgeHtml = exploreScene.render(game);
  assert.match(ridgeHtml, /data-action="moveNorth"[^>]*title="[^"]*Sealed challenge"/);
  assert.match(ridgeHtml, /aria-label="Sealed challenge"[^>]*title="Sealed challenge · Locked"[^>]*data-x="6" data-y="2"/);
  assert.match(ridgeHtml, /data-action="mapEncounter" data-arg="ridge_old_tusk" title="Sealed challenge · Locked"[^>]*>[\s\S]*?<span>Engage Sealed challenge<\/span>/);
  assert.doesNotMatch(ridgeHtml, /Old Tusk|Thunderhoof Stag|Threat: Thunderhoof|Engage Thunderhoof/i);
});

test('locked encounters mask names and previews in getAvailableActions and mapGrid until unlocked', () => {
  const state = createInitialState();
  state.map = { zoneId: 'ridge_road', x: 6, y: 3 };
  ensureMapState(state);

  const actions = getAvailableActions(state);
  const tuskAction = actions.find((a) => a.kind === 'encounter' && a.id === 'ridge_old_tusk');
  assert.ok(tuskAction, 'expected nearby action for ridge_old_tusk');
  assert.equal(tuskAction.locked, true);
  assert.equal(tuskAction.enemyId, 'sealed_challenge');
  assert.equal(tuskAction.label, 'Engage Sealed challenge');
  assert.equal(tuskAction.preview, null);

  state.story = { ...state.story, flags: { ...(state.story?.flags || {}), rescue_reward: true } };
  const unlockedActions = getAvailableActions(state);
  const unlockedTusk = unlockedActions.find((a) => a.kind === 'encounter' && a.id === 'ridge_old_tusk');
  assert.ok(unlockedTusk);
  assert.equal(unlockedTusk.locked, false);
  assert.equal(unlockedTusk.enemyId, 'old_tusk');
  assert.match(unlockedTusk.label, /Engage Old Tusk/);
  assert.ok(unlockedTusk.preview?.summary);
});


test('getZoneWeatherBriefing reports active weather, encounter rates, and field modifiers without mutating gameState', () => {
  const state = createInitialState();
  ensureMapState(state);
  const snap = JSON.stringify(state);

  const greyhavenWeather = getZoneWeatherBriefing(state, 'greyhaven');
  assert.equal(greyhavenWeather.zoneId, 'greyhaven');
  assert.equal(greyhavenWeather.condition.id, 'sheltered');
  assert.equal(greyhavenWeather.baseEncounterPercent, 0);
  assert.equal(greyhavenWeather.effectiveEncounterPercent, 0);
  assert.deepEqual(greyhavenWeather.modifiers, []);
  assert.match(greyhavenWeather.summary, /Lantern Shelter: .* · Danger 0 · No roaming ambushes · Modifiers: Standard frontier conditions/);
  assert.equal(JSON.stringify(state), snap, 'getZoneWeatherBriefing must not mutate gameState');

  const spireBefore = getZoneWeatherBriefing(state, 'stormcrown_spire');
  assert.equal(spireBefore.condition.id, 'tempest');
  assert.equal(spireBefore.baseEncounterPercent, 14);
  assert.equal(spireBefore.effectiveEncounterPercent, 14);

  state.story = {
    ...state.story,
    stage: 'complete',
    ending: 'share_signal',
    flags: {
      ...(state.story?.flags || {}),
      beacon_lit: true,
      relay_choice: 'route_network',
      victory_storm_heart: true,
    },
  };

  const spireAfter = getZoneWeatherBriefing(state, 'stormcrown_spire');
  assert.equal(spireAfter.condition.id, 'clear');
  assert.equal(spireAfter.stormCalmed, true);
  assert.equal(spireAfter.routeNetworkActive, true);
  assert.equal(spireAfter.baseEncounterPercent, 14);
  assert.equal(spireAfter.effectiveEncounterPercent, 4);
  assert.deepEqual(spireAfter.modifiers, [
    'Storm calmed (-50% step ambush)',
    'Signal Relay route network (-50% step ambush)',
  ]);
  assert.match(spireAfter.summary, /Broken Skies: .* · Danger 4 · Step ambush: 4% \(base 14%\) · Modifiers: Storm calmed \(-50% step ambush\), Signal Relay route network \(-50% step ambush\)/);

  const beaconAfter = getZoneWeatherBriefing(state, 'beacon_tower');
  assert.equal(beaconAfter.condition.id, 'sheltered');
  assert.equal(beaconAfter.beaconLit, true);
  assert.ok(beaconAfter.modifiers.includes('Beacon lit (Lantern Shelter)'));
});

test('getSafePathPreview computes step counts, caution pauses, spoiler-safe locked encounter masking, and mapGrid terrain tooltips', () => {
  const game = makeMockGame();
  const state = game.state;
  ensureMapState(state);
  state.map.zoneId = 'greyhaven';
  state.map.x = 2;
  state.map.y = 3;
  const snap = JSON.stringify(state);

  assert.equal(getSafePathPreview(state, -1, 0), null);
  assert.equal(getSafePathPreview(state, 99, 0), null);

  const herePreview = getSafePathPreview(state, 2, 3);
  assert.equal(herePreview.status, 'Current position');
  assert.equal(herePreview.steps, 0);
  assert.equal(herePreview.reachable, true);
  assert.equal(herePreview.summary, 'Cobble / Trail (2, 3) · Current position');

  const wallPreview = getSafePathPreview(state, 0, 0);
  assert.equal(wallPreview.status, 'Blocked terrain');
  assert.equal(wallPreview.walkable, false);
  assert.equal(wallPreview.reachable, false);
  assert.equal(wallPreview.summary, 'Stone Wall / Cliff (0, 0) · Blocked terrain');

  const stepPreview = getSafePathPreview(state, 4, 3);
  assert.equal(stepPreview.status, 'Safe route');
  assert.equal(stepPreview.reachable, true);
  assert.equal(stepPreview.steps, 2);
  assert.equal(stepPreview.effectiveSteps, 2);
  assert.equal(stepPreview.pausesNearThreat, false);
  assert.equal(stepPreview.summary, 'Cobble / Trail (4, 3) · Safe route: 2 steps');
  assert.equal(JSON.stringify(state), snap, 'getSafePathPreview must not mutate gameState');

  // In Ridge Road at (1, 3), path to (3, 1) pauses at step 2 ((2, 2)) adjacent to Cliffside Gale Hound at (2, 1)
  travelToZone(state, 'ridge_road', 'from_greyhaven');
  state.map.x = 1;
  state.map.y = 3;
  const ridgePausePreview = getSafePathPreview(state, 3, 1);
  assert.equal(ridgePausePreview.reachable, true);
  assert.equal(ridgePausePreview.steps, 4);
  assert.equal(ridgePausePreview.effectiveSteps, 2);
  assert.equal(ridgePausePreview.pausesNearThreat, true);
  assert.equal(ridgePausePreview.cautionThreatName, 'Cliffside Gale Hound');
  assert.equal(
    ridgePausePreview.summary,
    'Cobble / Trail (3, 1) · Safe route: 4 steps (pauses at step 2 near Cliffside Gale Hound) · Step ambush: 12%'
  );

  // Locked encounter Old Tusk at (6, 2) is masked as 'Sealed challenge' if a path pauses near it, and locked as destination
  state.map.clearedEncounters.ridge_patrol = true;
  state.map.x = 5;
  state.map.y = 3;
  const lockedDestPreview = getSafePathPreview(state, 6, 2);
  assert.equal(lockedDestPreview.reachable, false);
  assert.equal(lockedDestPreview.status, 'Locked destination');
  assert.doesNotMatch(lockedDestPreview.summary, /Old Tusk|Thunderhoof/i);

  const pauseNearLocked = getSafePathPreview(state, 7, 3);
  assert.equal(pauseNearLocked.reachable, true);
  assert.equal(pauseNearLocked.pausesNearThreat, true);
  assert.equal(pauseNearLocked.cautionThreatName, 'Sealed challenge');
  assert.doesNotMatch(pauseNearLocked.summary, /Old Tusk|Thunderhoof/i);

  // Verify mapGrid attaches getSafePathPreview summary to empty terrain cells
  const html = exploreScene.render(game);
  assert.match(html, /title="Windswept Scrub \(4, 3\) · Safe route: 1 step · Step ambush: 12%" data-x="4" data-y="3"/);
});

test('getFieldConsumablePreview and getPartyFieldReadiness compute non-mutating field restoration previews and party readiness', () => {
  const state = createInitialState();
  ensureMapState(state);
  state.inventory = [
    { id: 'bandage', qty: 2 },
    { id: 'storm_tonic', qty: 1 },
    { id: 'storm_glass', qty: 1 },
  ];
  state.party.push({
    id: 'bram',
    name: 'Bram',
    hp: 35,
    maxHp: 35,
    mp: 8,
    maxMp: 8,
    atk: 8,
    def: 5,
    spd: 4,
    level: 1,
    xp: 0,
    statuses: [],
  });

  // Full HP/MP party: readiness is 100% Ready and consumable preview has wouldHaveEffect=false
  const fullSnap = JSON.stringify(state);
  const fullReadiness = getPartyFieldReadiness(state);
  assert.equal(JSON.stringify(state), fullSnap, 'getPartyFieldReadiness must not mutate state');
  assert.equal(fullReadiness.memberCount, 2);
  assert.equal(fullReadiness.hpPercent, 100);
  assert.equal(fullReadiness.mpPercent, 100);
  assert.equal(fullReadiness.woundedCount, 0);
  assert.equal(fullReadiness.lowMpCount, 0);
  assert.deepEqual(fullReadiness.activeStatuses, []);
  assert.equal(fullReadiness.needsAttention, false);
  assert.equal(fullReadiness.summary, 'Party readiness: 100% HP (65/65) · 100% MP (18/18) · Ready');

  const fullBandagePreview = getFieldConsumablePreview(state, 'bandage', 0);
  assert.equal(fullBandagePreview.wouldHaveEffect, false);
  assert.equal(fullBandagePreview.hpGain, 0);
  assert.equal(fullBandagePreview.curedStatus, null);
  assert.equal(
    fullBandagePreview.summary,
    'Brine-washed linen strips. Stops bleeding and covers the ugliest wounds.',
  );

  // Unknown or non-consumable items or out-of-range targets return null
  assert.equal(getFieldConsumablePreview(state, 'unknown_item', 0), null);
  assert.equal(getFieldConsumablePreview(state, 'storm_glass', 0), null);
  assert.equal(getFieldConsumablePreview(state, 'bandage', 9), null);
  assert.equal(getFieldConsumablePreview(state, 'bandage', -1), null);

  // Wound Wren + apply bleeding, and lower Bram MP + apply shocked
  state.party[0].hp = 18;
  state.party[0].statuses = ['bleeding'];
  state.party[1].mp = 2;
  state.party[1].statuses = ['shocked'];

  const woundedSnap = JSON.stringify(state);
  const woundedReadiness = getPartyFieldReadiness(state);
  assert.equal(JSON.stringify(state), woundedSnap);
  assert.equal(woundedReadiness.woundedCount, 1);
  assert.equal(woundedReadiness.lowMpCount, 1);
  assert.deepEqual(woundedReadiness.activeStatuses, ['bleeding', 'shocked']);
  assert.equal(woundedReadiness.needsAttention, true);
  assert.equal(
    woundedReadiness.summary,
    'Party readiness: 82% HP (53/65) · 67% MP (12/18) · Statuses: bleeding, shocked · Rest or supplies advised',
  );

  const wrenBandage = getFieldConsumablePreview(state, 'bandage', 0);
  assert.equal(JSON.stringify(state), woundedSnap, 'getFieldConsumablePreview must not mutate state');
  assert.equal(wrenBandage.wouldHaveEffect, true);
  assert.equal(wrenBandage.hpGain, 12);
  assert.equal(wrenBandage.curedStatus, 'bleeding');
  assert.equal(
    wrenBandage.summary,
    'Brine-washed linen strips. Stops bleeding and covers the ugliest wounds. — On Wren now: +12 HP (18/30), cures bleeding',
  );

  const bramTonic = getFieldConsumablePreview(state, 'storm_tonic', 1);
  assert.equal(bramTonic.wouldHaveEffect, true);
  assert.equal(bramTonic.mpGain, 6);
  assert.equal(bramTonic.curedStatus, 'shocked');
  assert.equal(
    bramTonic.summary,
    'A sparking draught distilled from storm-charged salts. Restores focus. — On Bram now: +6 MP (2/8), cures shocked',
  );

  // Verify exploration UI attaches the live restoration preview to useFieldItem buttons
  const html = exploreScene.render({ state });
  assert.ok(html.includes('field-pack__readiness'));
  assert.ok(html.includes('Party readiness: 82% HP (53/65) · 67% MP (12/18) · Statuses: bleeding, shocked · Rest or supplies advised'));
  assert.match(
    html,
    /data-action="useFieldItem" data-arg="bandage" title="Brine-washed linen strips\. Stops bleeding and covers the ugliest wounds\. — On Wren now: \+12 HP \(18\/30\), cures bleeding"/,
  );
  assert.match(
    html,
    /data-action="useFieldItem" data-arg="storm_tonic:1" title="A sparking draught distilled from storm-charged salts\. Restores focus\. — On Bram now: \+6 MP \(2\/8\), cures shocked"/,
  );
  assertEggFree(woundedReadiness.summary);
  assertEggFree(wrenBandage.summary);
  assertEggFree(bramTonic.summary);
});

test('getExpeditionProgressSummary computes spoiler-safe regional Act I-III completion and renders .frontier-atlas__acts without mutating state', () => {
  const game = makeMockGame();
  const state = game.state;
  const initialSnap = JSON.stringify(state);

  const initialSummary = getExpeditionProgressSummary(state);
  assert.equal(JSON.stringify(state), initialSnap, 'getExpeditionProgressSummary must not mutate state');
  assert.equal(initialSummary.currentZoneId, 'greyhaven');
  assert.equal(initialSummary.currentActId, 'act_1');
  assert.equal(initialSummary.actsCompleted, 0);
  assert.equal(initialSummary.actsTotal, 3);
  assert.equal(initialSummary.zonesSecured, 1);
  assert.equal(initialSummary.zonesTotal, 9);
  assert.equal(
    initialSummary.summary,
    'Acts: Act I 0% (1/4) · Act II 0% (0/3) · Act III 0% (0/2) · 1/9 regions secured',
  );

  const [act1, act2, act3] = initialSummary.acts;
  assert.equal(act1.id, 'act_1');
  assert.equal(act1.isCurrentAct, true);
  assert.equal(act1.zonesVisited, 1);
  assert.equal(act1.zonesSecured, 1);
  assert.equal(act1.zonesTotal, 4);
  assert.deepEqual(act1.chartedNames, ['Greyhaven']);
  assert.equal(
    act1.summary,
    'Act I (Highland Signal Line): 1/4 regions · 0% recon (0/8 threats, 0/3 caches)',
  );
  assert.equal(act2.zonesVisited, 0);
  assert.deepEqual(act2.chartedNames, []);
  assert.equal(act2.summary, 'Act II (Frontier Outposts): Uncharted (3 regions)');
  assert.equal(act3.zonesVisited, 0);
  assert.deepEqual(act3.chartedNames, []);
  assert.equal(act3.summary, 'Act III (Upper Tempest): Uncharted (2 regions)');

  // Complete all of Act I and enter Act II (Saltmere Coast)
  ensureMapState(state);
  for (const zid of ['ridge_road', 'observatory_ruins', 'beacon_tower']) {
    state.map.visitedZones[zid] = true;
    for (const enc of ZONES[zid].encounters || []) {
      state.map.clearedEncounters[enc.id] = true;
    }
    for (const inter of ZONES[zid].interactables || []) {
      if (inter.kind === 'cache') state.map.completedInteractions[inter.id] = true;
    }
  }
  travelToZone(state, 'saltmere_coast', 'from_greyhaven');
  recordEncounterVictory(state, 'saltmere_rescue', 'tide_raider');
  const midSnap = JSON.stringify(state);

  const midSummary = getExpeditionProgressSummary(state);
  assert.equal(JSON.stringify(state), midSnap, 'getExpeditionProgressSummary must not mutate state');
  assert.equal(midSummary.currentZoneId, 'saltmere_coast');
  assert.equal(midSummary.currentActId, 'act_2');
  assert.equal(midSummary.actsCompleted, 1);
  assert.equal(midSummary.zonesSecured, 4);
  assert.equal(midSummary.acts[0].complete, true);
  assert.equal(midSummary.acts[0].percent, 100);
  assert.equal(midSummary.acts[0].zonesSecured, 4);
  assert.equal(
    midSummary.acts[0].summary,
    'Act I (Highland Signal Line): 4/4 regions · 100% recon (8/8 threats, 3/3 caches)',
  );
  assert.equal(midSummary.acts[1].isCurrentAct, true);
  assert.equal(midSummary.acts[1].zonesVisited, 1);
  assert.equal(midSummary.acts[1].encountersCleared, 1);
  assert.deepEqual(midSummary.acts[1].chartedNames, ['Saltmere Coast']);
  assert.equal(
    midSummary.summary,
    'Acts: Act I 100% (4/4) · Act II 7% (1/3) · Act III 0% (0/2) · 4/9 regions secured',
  );

  // Verify exploration UI renders .frontier-atlas__acts with act breakdown tooltip and masks uncharted Act III names
  const html = exploreScene.render(game);
  assert.match(
    html,
    /<p class="frontier-atlas__acts" title="Act I \(Highland Signal Line\): 4\/4 regions · 100% recon \(8\/8 threats, 3\/3 caches\) \| Act II \(Frontier Outposts\): 1\/3 regions · 7% recon \(1\/12 threats, 0\/3 caches\) \| Act III \(Upper Tempest\): Uncharted \(2 regions\)">Acts: Act I 100% \(4\/4\) · Act II 7% \(1\/3\) · Act III 0% \(0\/2\) · 4\/9 regions secured<\/p>/,
  );
  assertEggFree(initialSummary.summary);
  assertEggFree(midSummary.summary);
  for (const act of midSummary.acts) {
    assertEggFree(act.summary);
  }
});

test("getFastTravelBriefing summarizes charted fast-travel routes, unfinished objectives, and .visited-routes__summary without mutating state", () => {
  const game = makeMockGame();
  const state = game.state;
  exploreScene.onEnter(game, { zoneId: "greyhaven" });

  // 1. At start in Greyhaven: 0 destinations outside current zone
  const startSnap = JSON.stringify(state);
  const initialBriefing = getFastTravelBriefing(state);
  assert.equal(JSON.stringify(state), startSnap, "getFastTravelBriefing must not mutate state");
  assert.equal(initialBriefing.currentZoneId, "greyhaven");
  assert.equal(initialBriefing.destinationCount, 0);
  assert.equal(initialBriefing.securedCount, 0);
  assert.equal(initialBriefing.activeZoneCount, 0);
  assert.equal(initialBriefing.remainingEncounters, 0);
  assert.equal(initialBriefing.remainingCaches, 0);
  assert.equal(initialBriefing.safeHavenAvailable, false);
  assert.deepEqual(initialBriefing.destinations, []);
  assert.equal(initialBriefing.summary, "No charted fast-travel routes available yet");

  // 2. Travel to Ridge Road: Greyhaven is now a charted fast-travel destination (secured safe haven)
  travelToZone(state, "ridge_road", "from_greyhaven");
  const ridgeBriefing = getFastTravelBriefing(state);
  assert.equal(ridgeBriefing.currentZoneId, "ridge_road");
  assert.equal(ridgeBriefing.destinationCount, 1);
  assert.equal(ridgeBriefing.securedCount, 1);
  assert.equal(ridgeBriefing.activeZoneCount, 0);
  assert.equal(ridgeBriefing.remainingEncounters, 0);
  assert.equal(ridgeBriefing.remainingCaches, 0);
  assert.equal(ridgeBriefing.safeHavenAvailable, true);
  assert.equal(ridgeBriefing.destinations[0].zoneId, "greyhaven");
  assert.equal(ridgeBriefing.destinations[0].secured, true);
  assert.equal(ridgeBriefing.destinations[0].safeHaven, true);
  assert.equal(
    ridgeBriefing.summary,
    "1 charted route (1/1 secured) · All charted routes fully secured · Safe haven reachable"
  );

  // 3. Travel to Observatory Ruins with 1 encounter cleared on Ridge Road
  recordEncounterVictory(state, "ridge_patrol", "ridge_bandit");
  travelToZone(state, "observatory_ruins", "from_ridge");
  const obsSnap = JSON.stringify(state);
  const obsBriefing = getFastTravelBriefing(state);
  assert.equal(JSON.stringify(state), obsSnap, "getFastTravelBriefing must not mutate state");
  assert.equal(obsBriefing.currentZoneId, "observatory_ruins");
  assert.equal(obsBriefing.destinationCount, 2);
  assert.equal(obsBriefing.securedCount, 1);
  assert.equal(obsBriefing.activeZoneCount, 1);
  assert.equal(obsBriefing.remainingEncounters, 3);
  assert.equal(obsBriefing.remainingCaches, 1);
  assert.equal(obsBriefing.safeHavenAvailable, true);
  assert.equal(
    obsBriefing.summary,
    "2 charted routes (1/2 secured) · 3 threats, 1 cache remaining · Safe haven reachable"
  );

  // 4. Verify .visited-routes__summary renders in exploreScene.render
  const html = exploreScene.render(game);
  assert.match(
    html,
    /<p class="quiet-note visited-routes__summary">2 charted routes \(1\/2 secured\) · 3 threats, 1 cache remaining · Safe haven reachable<\/p>/
  );
  assertEggFree(initialBriefing.summary);
  assertEggFree(ridgeBriefing.summary);
  assertEggFree(obsBriefing.summary);
});

test('getFieldCraftPreview summarizes recipe batch capacity and recordEncounterVictory avoids duplicate log entries', () => {
  assert.equal(getFieldCraftPreview(null, 'unknown_recipe'), null);
  assert.equal(getFieldCraftPreview({}, 42), null);

  const state = {
    map: { zoneId: 'ridge_road', x: 4, y: 1, visitedZones: { greyhaven: true, ridge_road: true }, clearedEncounters: {}, completedInteractions: {}, log: [] },
    party: [{ id: 'wren', name: 'Wren', hp: 40, maxHp: 40, mp: 15, maxMp: 15, statuses: [] }],
    inventory: [
      { id: 'healing_herb', qty: 3 },
      { id: 'storm_glass', qty: 2 },
      { id: 'storm_tonic', qty: 1 },
    ],
  };

  const frozenInv = Object.freeze(state.inventory.map((s) => Object.freeze({ ...s })));
  const preview = getFieldCraftPreview({ ...state, inventory: frozenInv }, 'distill_tonic');
  assert.ok(preview);
  assert.equal(preview.recipeId, 'distill_tonic');
  assert.equal(preview.craftable, true);
  assert.equal(preview.maxBatches, 2);
  assert.equal(preview.outputId, 'storm_tonic');
  assert.equal(preview.outputOwned, 1);
  assert.equal(preview.missing.length, 0);
  assert.match(preview.summary, /1 Healing Herb \+ 1 Storm Glass → 1 Storm Tonic · Craftable ×2 · In pack: 1/);

  const missingPreview = getFieldCraftPreview({ ...state, inventory: [{ id: 'bandage', qty: 1 }] }, 'pack_field_dressing');
  assert.ok(missingPreview);
  assert.equal(missingPreview.craftable, false);
  assert.equal(missingPreview.maxBatches, 0);
  assert.equal(missingPreview.missing.length, 1);
  assert.equal(missingPreview.missing[0].missing, 1);
  assert.match(missingPreview.summary, /Missing: 1 Linen Bandage · In pack: 0/);

  // Verify craftFieldItem tooltip and recordEncounterVictory log deduplication
  const game = makeMockGame();
  installMap(game, { enableKeyboard: false });
  game.setScene('explore', { zoneId: 'ridge_road' });
  game.state.inventory = state.inventory;
  const html = exploreScene.render(game);
  assert.match(html, /data-action="craftFieldItem" data-arg="distill_tonic" title="1 Healing Herb \+ 1 Storm Glass → 1 Storm Tonic · Craftable ×2 · In pack: 1"/);
  game.setScene('explore', { zoneId: 'ridge_road' });
  game.state.map.activeEncounterId = 'ridge_patrol';
  game.bus.emit('combat:victory', { encounterId: 'ridge_patrol', enemyId: 'ridge_bandit' });
  exploreScene.onEnter(game, { combatResult: 'victory', encounterId: 'ridge_patrol', message: 'You return victorious.' });

  const clearedLines = game.state.map.log.filter((line) => line === 'Cleared encounter: ridge_patrol.');
  assert.equal(clearedLines.length, 1);
});

test('getZoneCompassHint route/briefing tooltip and getNearbyActionsSummary summarize nearby field actions without mutating state', () => {
  const emptyFrozen = Object.freeze({});
  const defaultNearby = getNearbyActionsSummary(emptyFrozen);
  assert.equal(defaultNearby.zoneId, 'greyhaven');
  assert.equal(defaultNearby.x, 2);
  assert.equal(defaultNearby.y, 3);
  assert.equal(defaultNearby.totalCount, 0);
  assert.equal(
    defaultNearby.summary,
    'Within reach: No immediate actions — move beside a person, cache, route, or threat.',
  );
  assertEggFree(defaultNearby.summary);

  const maraNearbyState = Object.freeze({
    map: Object.freeze({
      zoneId: 'greyhaven',
      x: 3,
      y: 2,
      visitedZones: Object.freeze({ greyhaven: true }),
      clearedEncounters: Object.freeze({}),
      completedInteractions: Object.freeze({}),
      log: Object.freeze([]),
    }),
  });
  const maraNearby = getNearbyActionsSummary(maraNearbyState);
  assert.equal(maraNearby.talkCount, 1);
  assert.equal(maraNearby.interactCount, 0);
  assert.equal(maraNearby.totalCount, 1);
  assert.equal(maraNearby.summary, 'Within reach (1): 1 contact');
  assertEggFree(maraNearby.summary);

  const ridgeState = Object.freeze({
    map: Object.freeze({
      zoneId: 'ridge_road',
      x: 6,
      y: 3,
      visitedZones: Object.freeze({ greyhaven: true, ridge_road: true }),
      clearedEncounters: Object.freeze({}),
      completedInteractions: Object.freeze({}),
      log: Object.freeze([]),
    }),
  });
  const ridgeNearby = getNearbyActionsSummary(ridgeState);
  assert.equal(ridgeNearby.encounterCount, 1);
  assert.equal(ridgeNearby.lockedEncounterCount, 2);
  assert.equal(ridgeNearby.patrolAvailable, true);
  assert.equal(ridgeNearby.summary, 'Within reach (4): 1 threat, 2 sealed challenges, 1 patrol');
  assertEggFree(ridgeNearby.summary);

  const compassHint = getZoneCompassHint(ridgeState);
  assert.ok(compassHint);
  assert.equal(compassHint.kind, 'encounter');
  assert.equal(compassHint.id, 'ridge_patrol');
  assert.equal(compassHint.routeSteps, 1);
  assert.equal(compassHint.routeReachable, true);
  assert.match(compassHint.targetSummary, /Ridge Bandit/);
  assert.match(compassHint.tooltip, /Safe route: 1 step/);
  assertEggFree(compassHint.tooltip);

  const game = makeMockGame();
  installMap(game, { enableKeyboard: false });
  game.setScene('explore', { zoneId: 'greyhaven' });
  const html = exploreScene.render(game);
  assert.match(
    html,
    /class="quiet-note nearby-panel__summary">Within reach: No immediate actions — move beside a person, cache, route, or threat\.<\/p>/,
  );
  assert.match(
    html,
    /class="terrain-compass__bearing" title="East Gate → Ridge Road \(E, 6 tiles\) — Ridge Road · Uncharted region \(Danger 1\)"/,
  );
  assert.match(html, /<p class="quiet-note terrain-compass__route">Safe route: 6 steps<\/p>/);
  assert.match(
    html,
    /aria-label="Wren, your position, column 3, row 4" aria-current="location" title="Wren, your position, column 3, row 4 — Cobble \/ Trail \(2, 3\) · Passable/,
  );
});


test('compassRouteLine makes route caveats visible, escaped text and omits empty details', () => {
  assert.equal(compassRouteLine(null), '');
  assert.equal(compassRouteLine(''), '');
  assert.equal(compassRouteLine(42), '');
  assert.equal(
    compassRouteLine('Safe route <img src=x> & "pause"'),
    '<p class="quiet-note terrain-compass__route">Safe route &lt;img src=x&gt; &amp; &quot;pause&quot;</p>',
  );
  assertEggFree(compassRouteLine('Safe route: 3 steps'));
});

test('getZoneCompassHint route caveats and getZoneExitsSummary report safe-route pause/ambush caveats and outbound route summaries without mutating state', () => {
  const ridgeState = Object.freeze({
    map: Object.freeze({
      zoneId: 'ridge_road',
      x: 1,
      y: 3,
      visitedZones: Object.freeze({ greyhaven: true, ridge_road: true }),
      clearedEncounters: Object.freeze({}),
      completedInteractions: Object.freeze({}),
      log: Object.freeze([]),
    }),
  });
  const hint = getZoneCompassHint(ridgeState);
  assert.ok(hint);
  assert.equal(hint.kind, 'encounter');
  assert.equal(hint.id, 'ridge_hound_den');
  assert.equal(hint.routeSteps, 3);
  assert.equal(hint.routeEffectiveSteps, 3);
  assert.equal(hint.routePausesNearThreat, false);
  assert.equal(hint.routeEncounterPercent, 12);
  assert.equal(hint.routeReachable, true);
  assert.equal(hint.routeSummary, 'Safe route: 3 steps · Step ambush: 12%');
  assert.match(hint.tooltip, /Safe route: 3 steps · Step ambush: 12%/);
  assertEggFree(hint.tooltip);

  // When a locked fixed threat sits along the safe path to a cache/exit, routePausesNearThreat is reported
  const pauseState = Object.freeze({
    map: Object.freeze({
      zoneId: 'ridge_road',
      x: 3,
      y: 0,
      visitedZones: Object.freeze({ greyhaven: true, ridge_road: true }),
      clearedEncounters: Object.freeze({ ridge_patrol: true, ridge_hound_den: true }),
      completedInteractions: Object.freeze({}),
      log: Object.freeze([]),
    }),
  });
  const pauseHint = getZoneCompassHint(pauseState);
  assert.ok(pauseHint);
  assert.equal(pauseHint.routePausesNearThreat, true);
  assert.match(pauseHint.routeSummary, /pauses at step \d+ near Sealed challenge/);
  assertEggFree(pauseHint.tooltip);

  const exitsSummary = getZoneExitsSummary(ridgeState);
  assert.equal(exitsSummary.zoneId, 'ridge_road');
  assert.equal(exitsSummary.zoneName, 'Ridge Road');
  assert.equal(exitsSummary.totalExits, 3);
  assert.equal(exitsSummary.unlockedCount, 3);
  assert.equal(exitsSummary.chartedCount, 1);
  assert.equal(exitsSummary.unchartedCount, 2);
  assert.equal(exitsSummary.lockedCount, 0);
  assert.ok(exitsSummary.nearestExit);
  assert.equal(exitsSummary.nearestExit.toZone, 'greyhaven');
  assert.equal(exitsSummary.nearestExit.distance, 1);
  assert.equal(exitsSummary.nearestExit.bearing, 'W');
  assert.equal(
    exitsSummary.summary,
    'Outbound routes (3): 1 charted, 2 uncharted · Nearest: West Trail → Greyhaven (W, 1 tile)',
  );
  assertEggFree(exitsSummary.summary);

  const game = makeMockGame();
  installMap(game, { enableKeyboard: false });
  game.setScene('explore', { zoneId: 'ridge_road' });
  const html = exploreScene.render(game);
  assert.match(
    html,
    /class="zone-checklist__routes">Outbound routes \(3\): 1 charted, 2 uncharted · Nearest: West Trail → Greyhaven \(W, 1 tile\)<\/p>/,
  );
  assert.match(
    html,
    /class="terrain-compass__bearing" title="[^"]*Cliffside Gale Hound[^"]*"/,
  );
  assert.match(html, /<p class="quiet-note terrain-compass__route">Safe route: 3 steps · Step ambush: 12%<\/p>/);
  assert.doesNotMatch(html, /class="terrain-compass__bearing" title="[^"]*Safe route:/);

  game.state.map = { ...pauseState.map };
  const pauseBefore = JSON.stringify(game.state);
  const pauseHtml = exploreScene.render(game);
  assert.equal(JSON.stringify(game.state), pauseBefore, 'route rendering must not mutate game state');
  assert.ok(pauseHtml.includes(`<p class="quiet-note terrain-compass__route">${pauseHint.routeSummary}</p>`));
  assert.doesNotMatch(pauseHtml, /class="terrain-compass__bearing" title="[^"]*Safe route:/);
});


test("getZoneStationsSummary and visible .terrain-compass__route summarize stations, caches, contacts, and safe-route caveats", () => {
  const greyState = Object.freeze({
    map: Object.freeze({
      zoneId: "greyhaven",
      x: 2,
      y: 3,
      visitedZones: Object.freeze({ greyhaven: true }),
      clearedEncounters: Object.freeze({}),
      completedInteractions: Object.freeze({}),
      log: Object.freeze([]),
    }),
  });
  const greyStations = getZoneStationsSummary(greyState);
  assert.equal(greyStations.zoneId, "greyhaven");
  assert.equal(greyStations.zoneName, "Greyhaven");
  assert.equal(greyStations.totalStations, 4);
  assert.equal(greyStations.serviceCount, 4);
  assert.equal(greyStations.availableCount, 0);
  assert.equal(greyStations.guardedCount, 0);
  assert.equal(greyStations.completedCount, 0);
  assert.equal(greyStations.contactCount, 3);
  assert.ok(greyStations.nearestStation);
  assert.match(greyStations.summary, /^Field stations \(4\): 4 services · Contacts: 3 · Nearest: /);
  assertEggFree(greyStations.summary);

  const ridgeState = Object.freeze({
    map: Object.freeze({
      zoneId: "ridge_road",
      x: 1,
      y: 3,
      visitedZones: Object.freeze({ greyhaven: true, ridge_road: true }),
      clearedEncounters: Object.freeze({}),
      completedInteractions: Object.freeze({ dispatch_ridge: true }),
      log: Object.freeze([]),
    }),
  });
  const ridgeStations = getZoneStationsSummary(ridgeState);
  assert.equal(ridgeStations.zoneId, "ridge_road");
  assert.equal(ridgeStations.totalStations, 2);
  assert.equal(ridgeStations.availableCount, 1);
  assert.equal(ridgeStations.completedCount, 1);
  assert.equal(ridgeStations.contactCount, 0);
  assert.equal(ridgeStations.nearestStation.id, "ridge_supply_cache");
  assert.match(ridgeStations.summary, /^Field stations \(2\): 1 available, 1 completed · Nearest: Wayfarer Supply Crate/);
  assertEggFree(ridgeStations.summary);

  const game = makeMockGame();
  installMap(game, { enableKeyboard: false });
  game.setScene("explore", { zoneId: "ridge_road" });
  const html = exploreScene.render(game);
  assert.match(html, /class="quiet-note terrain-compass__route">Safe route: 3 steps · Step ambush: 12%<\/p>/);
  assert.match(html, /class="zone-checklist__stations">Field stations \(2\): 2 available · Nearest: /);
});

test('getZoneContactsSummary reports zone NPC contacts, in-range count, and nearest contact without mutating state', () => {
  const greyhavenState = Object.freeze({
    map: Object.freeze({
      zoneId: 'greyhaven',
      x: 2,
      y: 2,
    }),
  });
  const ghContacts = getZoneContactsSummary(greyhavenState, 'greyhaven');
  assert.equal(ghContacts.zoneId, 'greyhaven');
  assert.equal(ghContacts.contactCount, 3);
  assert.equal(ghContacts.adjacentCount, 1);
  assert.equal(ghContacts.nearestContact?.id, 'mara');
  assert.equal(ghContacts.nearestContact?.distance, 1);
  assert.equal(ghContacts.nearestContact?.bearing, 'E');
  assert.equal(
    ghContacts.summary,
    "Field contacts (3): Warden Mara (Town Warden), Iven (Apprentice Keeper), Tamsin (Route Scout) · 1 in range · Nearest: Warden Mara (E, 1 tile)"
  );
  assertEggFree(ghContacts.summary);

  const beaconContacts = getZoneContactsSummary(greyhavenState, 'beacon_tower');
  assert.equal(beaconContacts.zoneId, 'beacon_tower');
  assert.equal(beaconContacts.contactCount, 0);
  assert.equal(beaconContacts.adjacentCount, 0);
  assert.equal(beaconContacts.nearestContact, null);
  assert.equal(beaconContacts.summary, 'Field contacts: None');
  assertEggFree(beaconContacts.summary);

  const game = makeMockGame();
  installMap(game, { enableKeyboard: false });
  game.setScene('explore', { zoneId: 'greyhaven' });
  const before = JSON.stringify(game.state);
  const html = exploreScene.render(game);
  assert.equal(JSON.stringify(game.state), before, 'exploreScene.render must not mutate state');
  assert.ok(
    html.includes(`<p class="zone-checklist__contacts">${"Field contacts (3): Warden Mara (Town Warden), Iven (Apprentice Keeper), Tamsin (Route Scout) · Nearest: Warden Mara (NE, 2 tiles)"}</p>`),
    'expected .zone-checklist__contacts line in exploreScene.render output'
  );
  assertEggFree(html);
});

test("getExpeditionLogSummary reports steps taken, visited regions, visible entries, and collapsed repeats without mutating state", () => {
  const emptySummary = getExpeditionLogSummary({
    map: {
      zoneId: "greyhaven",
      steps: 0,
      visitedZones: { greyhaven: true },
      log: [],
    },
  });
  assert.equal(emptySummary.steps, 0);
  assert.equal(emptySummary.zonesVisited, 1);
  assert.equal(emptySummary.zonesTotal, 9);
  assert.equal(emptySummary.visibleCount, 0);
  assert.equal(emptySummary.collapsedRepeats, 0);
  assert.equal(emptySummary.summary, "Steps taken: 0 · Regions visited: 1/9 · Log: No entries recorded yet");
  assertEggFree(emptySummary.summary, "empty expedition log summary");

  const state = createInitialState();
  ensureMapState(state);
  state.map.steps = 14;
  state.map.visitedZones = { greyhaven: true, ridge_road: true, saltmere_coast: true };
  state.map.log = [
    "Entered Greyhaven: Watch Harbour.",
    "Moved to Cobblestone Road (3, 2).",
    "Moved to Cobblestone Road (3, 2).",
    "Moved to Cobblestone Road (3, 2).",
    "Game saved.",
  ];
  const snapshot = JSON.stringify(state);
  const logSummary = getExpeditionLogSummary(state, 6);
  assert.equal(logSummary.steps, 14);
  assert.equal(logSummary.zonesVisited, 3);
  assert.equal(logSummary.zonesTotal, 9);
  assert.equal(logSummary.rawCount, 5);
  assert.equal(logSummary.visibleCount, 3);
  assert.equal(logSummary.collapsedRepeats, 2);
  assert.deepEqual(logSummary.entries, [
    "Game saved.",
    "Moved to Cobblestone Road (3, 2). (×3)",
    "Entered Greyhaven: Watch Harbour.",
  ]);
  assert.equal(
    logSummary.summary,
    "Steps taken: 14 · Regions visited: 3/9 · Showing 3 recent entries (2 repeats collapsed)",
  );
  assertEggFree(logSummary.summary, "populated expedition log summary");

  const html = exploreScene.render({ state, scenes: {} });
  assert.match(
    html,
    /<p class="quiet-note expedition-log__summary">Steps taken: 14 · Regions visited: 3\/9 · Showing 3 recent entries \(2 repeats collapsed\)<\/p>/,
  );
  assert.equal(JSON.stringify(state), snapshot);
});


test("getTileInspection reports passable and blocked cardinal directions and renders .terrain-compass__ways without mutating state", () => {
  const game = makeMockGame();
  const state = game.state;
  ensureMapState(state);
  state.map.x = 3;
  state.map.y = 3;
  const snap0 = JSON.stringify(state);

  // Greyhaven center tile (3, 3): surrounded by walkable tiles on all 4 cardinal sides
  const openInfo = getTileInspection(state);
  assert.equal(JSON.stringify(state), snap0);
  assert.equal(openInfo.passableCount, 4);
  assert.equal(openInfo.blockedCount, 0);
  assert.deepEqual(openInfo.passableDirections, ["North", "West", "East", "South"]);
  assert.deepEqual(openInfo.blockedDirections, []);
  assert.equal(openInfo.waysSummary, "Open ways (4/4): North, West, East, South · No blocked directions");
  assertEggFree(openInfo.waysSummary, "open waysSummary");

  const htmlOpen = exploreScene.render(game);
  assert.match(
    htmlOpen,
    /<p class="quiet-note terrain-compass__ways">Open ways \(4\/4\): North, West, East, South · No blocked directions<\/p>/,
  );

  // Tile (1, 1) in Greyhaven: North (1, 0) and West (0, 1) are Sea Cliff walls, East (2, 1) and South (1, 2) are passable
  const cornerInfo = getTileInspection(state, 1, 1, "greyhaven");
  assert.equal(cornerInfo.passableCount, 2);
  assert.equal(cornerInfo.blockedCount, 2);
  assert.deepEqual(cornerInfo.passableDirections, ["East", "South"]);
  assert.deepEqual(cornerInfo.blockedDirections, ["North", "West"]);
  assert.equal(cornerInfo.waysSummary, "Open ways (2/4): East, South · Blocked: North, West");
  assertEggFree(cornerInfo.waysSummary, "corner waysSummary");

  // Out-of-bounds tile (-10, -10): all 4 neighbors are out-of-bounds / blocked
  const isolatedInfo = getTileInspection(state, -10, -10, "greyhaven");
  assert.equal(isolatedInfo.passableCount, 0);
  assert.equal(isolatedInfo.blockedCount, 4);
  assert.deepEqual(isolatedInfo.passableDirections, []);
  assert.deepEqual(isolatedInfo.blockedDirections, ["North", "West", "East", "South"]);
  assert.equal(isolatedInfo.waysSummary, "Open ways (0/4): None · Blocked: North, West, East, South");
  assertEggFree(isolatedInfo.waysSummary, "isolated waysSummary");
  assert.equal(JSON.stringify(state), snap0);
});


test("getFieldPackSummary summarizes empty and populated field packs by category and renders .field-pack__summary without mutating state", () => {
  const emptyState = { inventory: [] };
  const emptySnap = JSON.stringify(emptyState);
  const emptyPack = getFieldPackSummary(emptyState);
  assert.equal(JSON.stringify(emptyState), emptySnap);
  assert.equal(emptyPack.totalStacks, 0);
  assert.equal(emptyPack.totalUnits, 0);
  assert.equal(emptyPack.craftableCount, 0);
  assert.equal(emptyPack.summary, "Pack manifest: Empty · Craft ready: 0");
  assertEggFree(emptyPack.summary, "empty field pack summary");

  const game = makeMockGame();
  const state = game.state;
  ensureMapState(state);
  state.inventory = [
    { id: "healing_herb", qty: 1 },
    { id: "bandage", qty: 2 },
    { id: "scrap_metal", qty: 2 },
    { id: "iron_sword", qty: 1 },
    { id: "observatory_lens", qty: 1 },
  ];
  const populatedSnap = JSON.stringify(state);
  const pack = getFieldPackSummary(state);
  assert.equal(JSON.stringify(state), populatedSnap);
  assert.equal(pack.totalStacks, 5);
  assert.equal(pack.totalUnits, 7);
  assert.equal(pack.consumableStacks, 2);
  assert.equal(pack.consumableUnits, 3);
  assert.equal(pack.materialStacks, 1);
  assert.equal(pack.materialUnits, 2);
  assert.equal(pack.equipmentStacks, 1);
  assert.equal(pack.equipmentUnits, 1);
  assert.equal(pack.keyStacks, 1);
  assert.equal(pack.keyUnits, 1);
  assert.equal(pack.craftableCount, 1);
  assert.deepEqual(pack.craftableNames, ["Pack a Field Dressing"]);
  assert.equal(
    pack.summary,
    "Pack manifest: 5 stacks (7 items) · 3 consumables · 2 materials · 1 equipment · 1 key item · Craft ready: 1 (Pack a Field Dressing)",
  );
  assertEggFree(pack.summary, "populated field pack summary");

  const html = exploreScene.render(game);
  assert.match(
    html,
    /<p class="quiet-note field-pack__summary">Pack manifest: 5 stacks \(7 items\) · 3 consumables · 2 materials · 1 equipment · 1 key item · Craft ready: 1 \(Pack a Field Dressing\)<\/p>/,
  );
  assert.equal(JSON.stringify(state), populatedSnap);
});
