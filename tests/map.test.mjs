import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { installStory } from '../src/story/integration.js';
import {
  ZONES,
  ZONE_ORDER,
  createMapState,
  ensureMapState,
  exploreScene,
  getAvailableActions,
  getClearedEncounters,
  getVisitedZones,
  installMap,
  interactWith,
  movePlayer,
  recordEncounterVictory,
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

test('movePlayer respects walls and triggers talk/exit/encounter', () => {
  const state = createInitialState();
  ensureMapState(state);
  // Start at greyhaven default (2, 3). Move North to (2, 2), then East onto Mara at (3, 2)
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
  assert.deepEqual(exitStep.events, [{ type: 'visit', locationId: 'ridge_road' }]);
});

test('full campaign progression through map and story integration', () => {
  const game = makeMockGame();
  installStory(game);
  installMap(game, { enableKeyboard: false });

  game.setScene('explore', { zoneId: 'greyhaven' });
  assert.ok(game.lastHtml.includes('Greyhaven'));

  // 1. Talk to Mara in Greyhaven -> stage becomes road
  const talkMara = interactWith(game.state, 'talk', 'mara');
  for (const e of talkMara.events) game.bus.emit('story:event', e);
  assert.equal(game.state.story.stage, 'road');

  // Talk to Tamsin as well
  const talkTamsin = interactWith(game.state, 'talk', 'tamsin');
  for (const e of talkTamsin.events) game.bus.emit('story:event', e);
  assert.equal(game.state.story.flags.met_tamsin, true);

  // 2. Travel to ridge_road, collect dispatch_ridge, defeat ridge_patrol
  game.setScene('explore', { zoneId: 'ridge_road' });
  assert.equal(game.state.story.flags.visit_ridge_road, true);

  const dispRidge = interactWith(game.state, 'interact', 'dispatch_ridge');
  for (const e of dispRidge.events) game.bus.emit('story:event', e);
  assert.equal(game.state.story.flags.dispatch_ridge, true);

  const encRidge = interactWith(game.state, 'encounter', 'ridge_patrol');
  assert.equal(encRidge.triggerCombat.encounterId, 'ridge_patrol');
  game.bus.emit('combat:victory', { enemyId: 'storm_rat', encounterId: 'ridge_patrol' });
  assert.ok(getClearedEncounters(game.state).includes('ridge_patrol'));
  assert.equal(game.state.story.stage, 'road_report');

  // 3. Return to Greyhaven, report to Mara, speak to Iven
  game.setScene('explore', { zoneId: 'greyhaven' });
  for (const e of interactWith(game.state, 'talk', 'mara').events) game.bus.emit('story:event', e);
  assert.equal(game.state.story.stage, 'lens_briefing');
  for (const e of interactWith(game.state, 'talk', 'iven').events) game.bus.emit('story:event', e);
  assert.equal(game.state.story.stage, 'lens');

  // 4. Travel to observatory_ruins, collect dispatch_observatory, defeat observatory_sentinel
  game.setScene('explore', { zoneId: 'observatory_ruins' });
  for (const e of interactWith(game.state, 'interact', 'dispatch_observatory').events) {
    game.bus.emit('story:event', e);
  }
  assert.equal(game.state.story.flags.dispatch_observatory, true);

  game.bus.emit('combat:victory', { enemyId: 'storm_rat', encounterId: 'observatory_sentinel' });
  assert.equal(game.state.story.stage, 'lens_report');

  // 5. Return to Greyhaven, turn in dispatches to Tamsin, report lens to Iven, hear council
  game.setScene('explore', { zoneId: 'greyhaven' });
  for (const e of interactWith(game.state, 'talk', 'tamsin').events) game.bus.emit('story:event', e);
  assert.equal(game.state.story.flags.dispatch_reward, true);

  for (const e of interactWith(game.state, 'talk', 'iven').events) game.bus.emit('story:event', e);
  assert.equal(game.state.story.stage, 'council');

  for (const e of interactWith(game.state, 'talk', 'mara').events) game.bus.emit('story:event', e);
  for (const e of interactWith(game.state, 'talk', 'tamsin').events) game.bus.emit('story:event', e);

  // 6. Visit beacon_tower and choose share_signal
  game.setScene('explore', { zoneId: 'beacon_tower' });
  assert.equal(game.state.story.stage, 'decision');
  for (const e of interactWith(game.state, 'choose', 'share_signal').events) {
    game.bus.emit('story:event', e);
  }
  assert.equal(game.state.story.stage, 'complete');
  assert.equal(game.state.story.ending, 'share_signal');
  assert.deepEqual(getVisitedZones(game.state), [
    'greyhaven',
    'ridge_road',
    'observatory_ruins',
    'beacon_tower',
  ]);
});

test('every zone spawn, exit, NPC, interactable, and encounter sits on a walkable tile', () => {
  for (const zone of Object.values(ZONES)) {
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
