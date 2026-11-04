import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { installStory } from '../src/story/integration.js';
import {
  ZONES,
  ZONE_ORDER,
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
  assert.deepEqual(ZONE_ORDER, ['greyhaven', 'ridge_road', 'observatory_ruins', 'beacon_tower', 'saltmere_coast', 'highwatch_pass', 'sunscar_relay']);
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
