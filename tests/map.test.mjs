import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { installStory } from '../src/story/integration.js';
import {
  ZONE_CONDITIONS,
  ZONES,
  ZONE_ORDER,
  getZoneCondition,
  getZoneProgress,
  getZoneVantage,
  getCompassBearing,
  getZoneCompassHint,
  findSafePath,
  stepAlongSafePath,
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
  assert.match(html, /class="zone-recon-summary"/);
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
