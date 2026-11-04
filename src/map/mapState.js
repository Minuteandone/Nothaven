import { TILE_TYPES, ZONES, ZONE_ORDER } from './zones.js';

export function createMapState(initialZone = 'greyhaven') {
  const zone = ZONES[initialZone] || ZONES.greyhaven;
  const spawn = zone.spawns?.default || { x: 2, y: 3 };
  return {
    zoneId: zone.id,
    x: spawn.x,
    y: spawn.y,
    visitedZones: { [zone.id]: true },
    clearedEncounters: {},
    completedInteractions: {},
    activeEncounterId: null,
    lastChoiceId: null,
    steps: 0,
    log: [`Entered ${zone.name}: ${zone.subtitle}.`],
  };
}

export function ensureMapState(gameState) {
  if (!gameState.map || typeof gameState.map !== 'object') {
    const startZone = ZONES[gameState.location] ? gameState.location : 'greyhaven';
    gameState.map = createMapState(startZone);
  }
  const m = gameState.map;
  if (!ZONES[m.zoneId]) m.zoneId = 'greyhaven';
  m.visitedZones ||= { [m.zoneId]: true };
  m.clearedEncounters ||= {};
  m.completedInteractions ||= {};
  m.log ||= [];
  return m;
}

export function getZone(zoneId) {
  return ZONES[zoneId] || ZONES.greyhaven;
}

export function getTileChar(zone, x, y) {
  if (y < 0 || y >= zone.height || x < 0 || x >= zone.width) return '#';
  const row = zone.grid[y] || '';
  return row[x] || '#';
}

export function getTileInfo(zone, x, y) {
  const ch = getTileChar(zone, x, y);
  return TILE_TYPES[ch] || TILE_TYPES['#'];
}

export function isWalkable(zone, mapState, x, y) {
  const tile = getTileInfo(zone, x, y);
  if (!tile.walkable) return false;
  return true;
}

export function isAdjacentOrOn(x1, y1, x2, y2) {
  return Math.abs(x1 - x2) + Math.abs(y1 - y2) <= 1;
}

export function getEntityAt(zone, mapState, x, y) {
  const npc = (zone.npcs || []).find((n) => n.x === x && n.y === y);
  if (npc) return { type: 'npc', entity: npc };

  const enc = (zone.encounters || []).find(
    (e) => e.x === x && e.y === y && !mapState?.clearedEncounters?.[e.encounterId || e.id]
  );
  if (enc) return { type: 'encounter', entity: enc };

  const inter = (zone.interactables || []).find((i) => {
    if (i.x !== x || i.y !== y) return false;
    if (i.once && mapState?.completedInteractions?.[i.interactionId || i.id]) return false;
    return true;
  });
  if (inter) return { type: 'interactable', entity: inter };

  const exit = (zone.exits || []).find((ex) => ex.x === x && ex.y === y);
  if (exit) return { type: 'exit', entity: exit };

  return null;
}

export function getAvailableActions(gameState) {
  const mapState = ensureMapState(gameState);
  const zone = getZone(mapState.zoneId);
  const actions = [];
  const { x, y } = mapState;

  const isNear = (tx, ty) => isAdjacentOrOn(x, y, tx, ty);

  for (const npc of zone.npcs || []) {
    if (isNear(npc.x, npc.y)) {
      actions.push({
        kind: 'talk',
        id: npc.id,
        label: `Talk to ${npc.name}`,
        entity: npc,
      });
    }
  }

  for (const enc of zone.encounters || []) {
    const encId = enc.encounterId || enc.id;
    if (!mapState.clearedEncounters[encId] && isNear(enc.x, enc.y)) {
      actions.push({
        kind: 'encounter',
        id: encId,
        enemyId: enc.enemyId,
        label: `Engage ${enc.name}`,
        entity: enc,
      });
    }
  }

  for (const inter of zone.interactables || []) {
    const intId = inter.interactionId || inter.id;
    if (inter.once && mapState.completedInteractions[intId]) continue;
    if (isNear(inter.x, inter.y)) {
      actions.push({
        kind: 'interact',
        id: intId,
        label:
          inter.kind === 'inn'
            ? `Rest at ${inter.name} (${inter.costGold || 5}g)`
            : `Inspect ${inter.name}`,
        entity: inter,
      });
    }
  }

  for (const ex of zone.exits || []) {
    if (isNear(ex.x, ex.y)) {
      actions.push({
        kind: 'exit',
        id: ex.toZone,
        toSpawn: ex.toSpawn,
        label: ex.label,
        entity: ex,
      });
    }
  }

  return actions;
}

function appendLog(mapState, line) {
  if (!line) return;
  mapState.log = [...(mapState.log || []).slice(-19), line];
}

export function travelToZone(gameState, toZoneId, spawnKey = 'default') {
  const mapState = ensureMapState(gameState);
  const targetZone = ZONES[toZoneId];
  if (!targetZone) {
    return { state: gameState, events: [], log: [`Unknown destination: ${toZoneId}`] };
  }
  const spawn = targetZone.spawns?.[spawnKey] || targetZone.spawns?.default || { x: 1, y: 1 };
  mapState.zoneId = targetZone.id;
  mapState.x = spawn.x;
  mapState.y = spawn.y;
  mapState.visitedZones[targetZone.id] = true;
  gameState.location = targetZone.id;

  const msg = `Traveled to ${targetZone.name} (${targetZone.subtitle}).`;
  appendLog(mapState, msg);
  const events = [{ type: 'visit', locationId: targetZone.id }];
  return { state: gameState, events, log: [msg], transitioned: true };
}

export function movePlayer(gameState, dx, dy, options = {}) {
  const mapState = ensureMapState(gameState);
  const zone = getZone(mapState.zoneId);
  const nx = mapState.x + dx;
  const ny = mapState.y + dy;

  if (!isWalkable(zone, mapState, nx, ny)) {
    const blockedTile = getTileInfo(zone, nx, ny);
    const msg = `Blocked by ${blockedTile.name}.`;
    appendLog(mapState, msg);
    return { state: gameState, moved: false, events: [], log: [msg], triggerCombat: null };
  }

  // If stepping directly onto an NPC, stay adjacent and talk to them
  const npc = (zone.npcs || []).find((n) => n.x === nx && n.y === ny);
  if (npc) {
    return interactWith(gameState, 'talk', npc.id);
  }

  mapState.x = nx;
  mapState.y = ny;
  mapState.steps = (mapState.steps || 0) + 1;
  const events = [];
  const logs = [];

  // Check if stepped onto an exit tile
  const exit = (zone.exits || []).find((ex) => ex.x === nx && ex.y === ny);
  if (exit) {
    const res = travelToZone(gameState, exit.toZone, exit.toSpawn);
    return {
      state: gameState,
      moved: true,
      transitioned: true,
      events: res.events,
      log: res.log,
      triggerCombat: null,
    };
  }

  // Check if stepped onto an uncleared fixed encounter
  const enc = (zone.encounters || []).find(
    (e) => e.x === nx && e.y === ny && !mapState.clearedEncounters[e.encounterId || e.id]
  );
  if (enc) {
    const encId = enc.encounterId || enc.id;
    mapState.activeEncounterId = encId;
    const msg = `${enc.name} blocks the path!`;
    appendLog(mapState, msg);
    return {
      state: gameState,
      moved: true,
      events,
      log: [msg],
      triggerCombat: { encounterId: encId, enemyId: enc.enemyId, name: enc.name },
    };
  }

  // Check if stepped onto an interactable
  const inter = (zone.interactables || []).find(
    (i) => i.x === nx && i.y === ny && !(i.once && mapState.completedInteractions[i.interactionId || i.id])
  );
  if (inter && inter.kind === 'dispatch') {
    return interactWith(gameState, 'interact', inter.interactionId || inter.id);
  }

  // Optional random encounter check in wild zones
  const rng = options.rng || Math.random;
  if (
    !options.disableRandomEncounters &&
    zone.randomEncounterChance > 0 &&
    Array.isArray(zone.randomEncounters) &&
    zone.randomEncounters.length > 0 &&
    rng() < zone.randomEncounterChance
  ) {
    const pick = zone.randomEncounters[0];
    mapState.activeEncounterId = pick.encounterId;
    const msg = `A roaming threat ambushes you along ${zone.name}!`;
    appendLog(mapState, msg);
    return {
      state: gameState,
      moved: true,
      events,
      log: [msg],
      triggerCombat: { encounterId: pick.encounterId, enemyId: pick.enemyId, name: 'Roaming Storm Beast' },
    };
  }

  return { state: gameState, moved: true, events, log: logs, triggerCombat: null };
}

/**
 * Perform a map interaction.
 * - `talk`: allowed anywhere within the NPC's zone (matches shared town-wide conversation buttons).
 * - `interact` and `encounter`: require tile proximity (Manhattan distance <= 1) unless `options.ignoreProximity` is true.
 * - `exit`: requires adjacency to the exit tile OR `targetId` being an already-visited zone (fast travel).
 */
export function interactWith(gameState, kind, targetId, options = {}) {
  const mapState = ensureMapState(gameState);
  const zone = getZone(mapState.zoneId);
  const events = [];
  const logs = [];
  const checkNear = (tx, ty) =>
    Boolean(options.ignoreProximity) || isAdjacentOrOn(mapState.x, mapState.y, tx, ty);

  if (kind === 'talk') {
    const npc = (zone.npcs || []).find((n) => n.id === targetId);
    if (!npc) return { state: gameState, events: [], log: ['No one by that name is in this area.'] };
    const line = `${npc.name} (${npc.role}): "${npc.defaultLine}"`;
    appendLog(mapState, line);
    logs.push(line);
    events.push({ type: 'talk', npcId: npc.id });
    return { state: gameState, events, log: logs, triggerCombat: null };
  }

  if (kind === 'encounter') {
    const enc = (zone.encounters || []).find((e) => (e.encounterId || e.id) === targetId);
    if (!enc) return { state: gameState, events: [], log: ['Encounter not found.'] };
    if (!checkNear(enc.x, enc.y)) {
      const msg = `Move closer to ${enc.name} before engaging.`;
      appendLog(mapState, msg);
      return { state: gameState, events: [], log: [msg], triggerCombat: null };
    }
    const encId = enc.encounterId || enc.id;
    if (mapState.clearedEncounters[encId]) {
      const msg = `${enc.name} has already been cleared.`;
      appendLog(mapState, msg);
      events.push({ type: 'victory', encounterId: encId, enemyId: enc.enemyId });
      return { state: gameState, events, log: [msg], triggerCombat: null };
    }
    mapState.activeEncounterId = encId;
    const msg = `Engaging ${enc.name}!`;
    appendLog(mapState, msg);
    return {
      state: gameState,
      events,
      log: [msg],
      triggerCombat: { encounterId: encId, enemyId: enc.enemyId, name: enc.name },
    };
  }

  if (kind === 'interact') {
    const inter = (zone.interactables || []).find((i) => (i.interactionId || i.id) === targetId);
    if (!inter) return { state: gameState, events: [], log: ['Nothing to inspect here.'] };
    if (!checkNear(inter.x, inter.y)) {
      const msg = `Move closer to ${inter.name} to inspect it.`;
      appendLog(mapState, msg);
      return { state: gameState, events: [], log: [msg], triggerCombat: null };
    }
    const intId = inter.interactionId || inter.id;

    if (
      inter.requiresEncounterCleared &&
      !mapState.clearedEncounters[inter.requiresEncounterCleared]
    ) {
      const msg = `You must defeat the guardian before approaching the ${inter.name}.`;
      appendLog(mapState, msg);
      return { state: gameState, events: [], log: [msg], triggerCombat: null };
    }

    if (inter.kind === 'inn') {
      const cost = inter.costGold ?? 5;
      if ((gameState.gold ?? 0) < cost) {
        const msg = `You need ${cost} gold to rest at ${inter.name}.`;
        appendLog(mapState, msg);
        return { state: gameState, events: [], log: [msg], triggerCombat: null };
      }
      gameState.gold -= cost;
      for (const member of gameState.party || []) {
        if (typeof member.maxHp === 'number') member.hp = member.maxHp;
        if (typeof member.maxMp === 'number') member.mp = member.maxMp;
      }
      const msg = `Rested at ${inter.name} (-${cost}g). Party HP and MP fully restored.`;
      appendLog(mapState, msg);
      return { state: gameState, events: [], log: [msg], triggerCombat: null };
    }

    if (inter.once) {
      mapState.completedInteractions[intId] = true;
    }
    const msg = `${inter.name}: ${inter.description}`;
    appendLog(mapState, msg);
    logs.push(msg);
    events.push({ type: 'interact', interactionId: intId });
    return { state: gameState, events, log: logs, triggerCombat: null };
  }

  if (kind === 'exit') {
    const ex = (zone.exits || []).find((e) => e.toZone === targetId);
    const canUseExit = ex && checkNear(ex.x, ex.y);
    const canFastTravel = Boolean(mapState.visitedZones?.[targetId]);
    if (!canUseExit && !canFastTravel) {
      const msg = 'You must reach the route gate before traveling to an undiscovered area.';
      appendLog(mapState, msg);
      return { state: gameState, events: [], log: [msg], triggerCombat: null };
    }
    return travelToZone(gameState, targetId, ex?.toSpawn || 'default');
  }

  return { state: gameState, events, log: logs, triggerCombat: null };
}

export function recordEncounterVictory(gameState, encounterId, enemyId = null) {
  const mapState = ensureMapState(gameState);
  const resolvedId = encounterId || mapState.activeEncounterId || enemyId;
  if (!resolvedId) return { state: gameState, events: [], log: [] };

  mapState.clearedEncounters[resolvedId] = true;
  mapState.activeEncounterId = null;
  const msg = `Cleared encounter: ${resolvedId}.`;
  appendLog(mapState, msg);
  const event = { type: 'victory', encounterId: resolvedId, enemyId };
  return { state: gameState, events: [event], log: [msg] };
}

export function getClearedEncounters(gameState) {
  const mapState = ensureMapState(gameState);
  return Object.keys(mapState.clearedEncounters).filter((k) => mapState.clearedEncounters[k]);
}

export function getVisitedZones(gameState) {
  const mapState = ensureMapState(gameState);
  return ZONE_ORDER.filter((z) => mapState.visitedZones?.[z]);
}
