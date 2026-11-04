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
  getVisitedZones,
  installMap,
  interactWith,
  getAvailableActions,
  movePlayer,
  pickRandomEncounter,
  travelToZone,
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
  assert.deepEqual(ZONE_ORDER, ['greyhaven', 'ridge_road', 'observatory_ruins', 'beacon_tower']);
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
