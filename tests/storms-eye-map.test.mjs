import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveGame, loadGame } from '../src/state.js';
import { ZONES, ZONE_ORDER, travelToZone, movePlayer, interactWith, isWalkable,
  recordEncounterVictory, patrolZone, getEffectiveRandomEncounterChance } from '../src/map/index.js';
import { getItem } from '../src/items/items.js';
import { ENEMIES } from '../src/data/enemies.js';

const zone = ZONES.storms_eye;
function stateIn(id = 'storms_eye') {
  const state = createInitialState(); state.story.flags.spire_reward = true;
  travelToZone(state, id); return state;
}
const position = state => [state.map.zoneId, state.map.x, state.map.y, state.map.steps];
function reachable(state, target) {
  const queue = [[state.map.x, state.map.y]], seen = new Set();
  while (queue.length) {
    const [x, y] = queue.shift(), key = `${x},${y}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (x === target.x && y === target.y) return true;
    for (const [dx, dy] of [[1,0],[-1,0],[0,1],[0,-1]]) {
      const nx = x + dx, ny = y + dy;
      if (!isWalkable(zone, state.map, nx, ny)) continue;
      if (zone.exits.some(e => e.x === nx && e.y === ny) && (nx !== target.x || ny !== target.y)) continue;
      if (zone.encounters.some(e => e.x === nx && e.y === ny && !state.map.clearedEncounters[e.encounterId])) continue;
      queue.push([nx, ny]);
    }
  }
  return false;
}

test('eye map pins are exact, linked to the summit, and reference real enemies and supplies', () => {
  assert.ok(ZONE_ORDER.includes('storms_eye')); assert.equal(zone.requiresStoryFlag, 'spire_reward');
  const passage = ZONES.stormcrown_spire.exits.find(e => e.toZone === zone.id);
  assert.deepEqual([passage.x, passage.y], [5, 0]);
  assert.ok(zone.spawns[passage.toSpawn]);
  const returnExit = zone.exits.find(e => e.toZone === 'stormcrown_spire');
  assert.deepEqual(ZONES.stormcrown_spire.spawns[returnExit.toSpawn], { x: 5, y: 1 });
  assert.ok(zone.exits.some(e => e.toZone === 'greyhaven'));
  assert.deepEqual(zone.encounters.map(e => [e.encounterId, e.enemyId]), [
    ['eye_west_shade', 'tempest_shade'], ['eye_east_colossus', 'thunderhead_colossus'], ['storm_heart_core', 'storm_heart'],
    ['eye_last_squall', 'last_squall'],
  ]);
  for (const enemy of [...zone.encounters, ...zone.randomEncounters]) assert.ok(ENEMIES[enemy.enemyId]);
  for (const inter of zone.interactables) for (const reward of inter.rewards || []) assert.ok(getItem(reward.id));
  assert.ok(!zone.randomEncounters.some(e => e.enemyId === 'storm_heart' || e.encounterId === 'storm_heart_core'));
  assert.deepEqual(zone.encounters[2].requiresInteractions, ['eye_anchor_west', 'eye_anchor_east']);
});

test('destination lock rejects direct travel without a strict paid-survey flag and emits no visit', () => {
  for (const value of [undefined, false, 'true', 1]) {
    const state = createInitialState();
    state.story.flags.spire_reward = value;
    travelToZone(state, 'stormcrown_spire');
    const before = position(state), result = travelToZone(state, 'storms_eye');
    assert.deepEqual(position(state), before); assert.equal(result.transitioned, false);
    assert.deepEqual(result.events, []); assert.equal(state.map.visitedZones.storms_eye, undefined);
    assert.match(result.log.join(' '), /Report the summit survey/);
  }
  const state = createInitialState(); state.story.flags.spire_reward = true;
  const result = travelToZone(state, 'storms_eye');
  assert.equal(result.transitioned, true); assert.equal(state.location, 'storms_eye');
  assert.deepEqual(result.events, [{ type: 'visit', locationId: 'storms_eye' }]);
});

test('walking, nearby travel buttons and even already-visited fast travel cannot bypass summit lock', () => {
  const state = stateIn('stormcrown_spire'); delete state.story.flags.spire_reward;
  state.map.x = 5; state.map.y = 1;
  const before = position(state);
  assert.equal(movePlayer(state, 0, -1, { rng: () => 0 }).moved, false);
  assert.deepEqual(position(state), before); assert.equal(state.map.activeEncounterId, null);
  assert.equal(interactWith(state, 'exit', 'storms_eye').transitioned, false);
  state.map.visitedZones.storms_eye = true;
  assert.equal(interactWith(state, 'exit', 'storms_eye').transitioned, false);
  assert.deepEqual(position(state), before);
  state.story.flags.spire_reward = true;
  assert.equal(movePlayer(state, 0, -1).transitioned, true);
  assert.equal(state.map.zoneId, 'storms_eye');
  // Return does not land on another exit or the summit boss.
  assert.equal(movePlayer(state, -1, 0).transitioned, true);
  assert.deepEqual([state.map.zoneId, state.map.x, state.map.y], ['stormcrown_spire', 5, 1]);
});

test('each grounded anchor is mandatory for core engagement by button or movement', () => {
  for (const records of [{}, { eye_anchor_west: true }, { eye_anchor_east: true }, { eye_anchor_west: 'true', eye_anchor_east: true }]) {
    const state = stateIn(); state.map.completedInteractions = records;
    state.map.x = 4; state.map.y = 4;
    const before = position(state);
    const button = interactWith(state, 'encounter', 'storm_heart_core');
    assert.equal(button.triggerCombat, null); assert.deepEqual(button.events, []);
    assert.match(button.log.join(' '), /Ground both/);
    const movement = movePlayer(state, 0, -1, { rng: () => 0 });
    assert.equal(movement.triggerCombat, null); assert.equal(movement.moved, false);
    assert.deepEqual(position(state), before); assert.equal(state.map.activeEncounterId, null);
  }
  for (const mode of ['button', 'movement']) {
    const state = stateIn(); state.map.x = 4; state.map.y = 4;
    state.map.completedInteractions = { eye_anchor_west: true, eye_anchor_east: true };
    const result = mode === 'button' ? interactWith(state, 'encounter', 'storm_heart_core') : movePlayer(state, 0, -1);
    assert.equal(result.triggerCombat.encounterId, 'storm_heart_core');
    assert.equal(result.triggerCombat.enemyId, 'storm_heart');
    assert.equal(state.map.activeEncounterId, 'storm_heart_core');
  }
});

test('anchors enforce proximity and their own guardian before recording one-time inspections', () => {
  for (const id of ['eye_anchor_west', 'eye_anchor_east']) {
    const state = stateIn(), anchor = zone.interactables.find(i => i.id === id);
    assert.deepEqual(interactWith(state, 'interact', id).events, []);
    state.map.x = anchor.x; state.map.y = anchor.y;
    assert.deepEqual(interactWith(state, 'interact', id).events, []);
    assert.equal(state.map.completedInteractions[id], undefined);
    recordEncounterVictory(state, anchor.requiresEncounterCleared);
    const result = interactWith(state, 'interact', id);
    assert.deepEqual(result.events, [{ type: 'interact', interactionId: id }]);
    assert.equal(state.map.completedInteractions[id], true);
    assert.deepEqual(interactWith(state, 'interact', id).events, []);
    assert.equal(state.map.clearedEncounters.storm_heart_core, undefined);
  }
});

test('pre-core shop, cache and retreat exits are reachable without a battle; anchors remain reachable after guards', () => {
  const state = stateIn();
  for (const target of [...zone.exits, ...zone.interactables.filter(i => ['shop', 'cache'].includes(i.kind))]) {
    assert.equal(reachable(state, target), true, target.id || target.toZone);
  }
  for (const anchor of zone.interactables.filter(i => i.kind === 'quest')) {
    recordEncounterVictory(state, anchor.requiresEncounterCleared);
    assert.equal(reachable(state, anchor), true, anchor.id);
  }
  const shop = zone.interactables.find(i => i.id === 'storms_eye_post');
  state.map.x = shop.x; state.map.y = shop.y;
  assert.deepEqual(interactWith(state, 'interact', shop.id).triggerShop, { shopId: 'storms_eye_post' });
  const cache = zone.interactables.find(i => i.kind === 'cache');
  state.map.x = cache.x; state.map.y = cache.y;
  const result = interactWith(state, 'interact', cache.id);
  assert.equal(result.events.length, 1); assert.equal(state.map.completedInteractions[cache.id], true);
  const inventory = structuredClone(state.inventory);
  assert.deepEqual(interactWith(state, 'interact', cache.id).events, []);
  assert.deepEqual(state.inventory, inventory);
});

test('eye patrols use both regular foes, never core identity, and regional calming affects only random chances', () => {
  const state = stateIn();
  for (const [roll, enemy] of [[0.25, 'tempest_shade'], [0.75, 'thunderhead_colossus']]) {
    const result = patrolZone(state, { rng: () => roll });
    assert.equal(result.triggerCombat.enemyId, enemy); assert.equal(result.triggerCombat.encounterId, null);
  }
  assert.equal(getEffectiveRandomEncounterChance(state, zone), 0.14);
  state.story.flags.victory_storm_heart = true;
  assert.equal(getEffectiveRandomEncounterChance(state, zone), 0.07);
  state.story.flags.relay_choice = 'route_network';
  assert.equal(getEffectiveRandomEncounterChance(state, zone), 0.035);
});

test('anchor records and the destination unlock survive real save replacement', () => {
  const oldStorage = globalThis.localStorage; let saved;
  globalThis.localStorage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  try {
    let state = stateIn();
    const anchors = ['eye_anchor_west', 'eye_anchor_east'].map(id => zone.interactables.find(i => i.id === id));
    assert.ok(anchors.every(Boolean));
    for (const anchor of anchors) {
      recordEncounterVictory(state, anchor.requiresEncounterCleared);
      state.map.x = anchor.x; state.map.y = anchor.y;
      interactWith(state, 'interact', anchor.id);
      saveGame(state); state = loadGame();
      assert.equal(state.map.completedInteractions[anchor.id], true);
    }
    travelToZone(state, 'greyhaven');
    const result = interactWith(state, 'exit', 'storms_eye');
    assert.equal(result.transitioned, true);
    state.map.x = 4; state.map.y = 4;
    assert.equal(interactWith(state, 'encounter', 'storm_heart_core').triggerCombat.enemyId, 'storm_heart');
  } finally { if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; }
});
