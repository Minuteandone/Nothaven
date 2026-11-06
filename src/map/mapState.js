import { TILE_TYPES, ZONE_CONDITIONS, ZONES, ZONE_ORDER } from './zones.js';
import { grantRewards } from '../items/inventory.js';
import { useConsumable } from '../items/consumables.js';
import { craft } from '../items/crafting.js';
import { effectiveStats } from '../items/equipment.js';
import { getItem, isKnownItem } from '../items/items.js';
import { ENEMIES } from '../data/enemies.js';
import { getDifficulty, scaleEnemy } from '../combat/difficulty.js';

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

export function getInnCost(gameState, inter) {
  if (gameState?.story?.flags?.relay_choice === 'shelter_network') return 2;
  return inter?.costGold ?? 5;
}

// Zones where defeating The Storm's Heart (flag victory_storm_heart) halves random encounters.
export const STORM_CALMED_ZONES = ['stormcrown_spire', 'storms_eye'];
export function getZoneCondition(gameState, zoneOrId = null) {
  const resolvedZone =
    typeof zoneOrId === 'string'
      ? getZone(zoneOrId)
      : zoneOrId && typeof zoneOrId === 'object'
        ? zoneOrId
        : getZone(gameState?.map?.zoneId || gameState?.location || 'greyhaven');
  const story = gameState?.story;
  const flags = story?.flags || {};
  if (flags.victory_storm_heart && STORM_CALMED_ZONES.includes(resolvedZone?.id)) {
    return ZONE_CONDITIONS.clear;
  }
  if (
    resolvedZone?.id === 'beacon_tower' &&
    (story?.stage === 'complete' ||
      story?.ending === 'protect_town' ||
      story?.ending === 'share_signal' ||
      Boolean(story?.ending) ||
      Boolean(flags.beacon_lit))
  ) {
    return ZONE_CONDITIONS.sheltered;
  }
  return ZONE_CONDITIONS[resolvedZone?.condition] || ZONE_CONDITIONS.sheltered;
}

export function getZoneProgress(gameState, zoneOrId = null) {
  const resolvedZone =
    typeof zoneOrId === 'string'
      ? getZone(zoneOrId)
      : zoneOrId && typeof zoneOrId === 'object'
        ? zoneOrId
        : getZone(gameState?.map?.zoneId || gameState?.location || 'greyhaven');
  const cleared = gameState?.map?.clearedEncounters || {};
  const completed = gameState?.map?.completedInteractions || {};
  const visited = Boolean(gameState?.map?.visitedZones?.[resolvedZone.id]);
  const encounters = Array.isArray(resolvedZone.encounters) ? resolvedZone.encounters : [];
  const caches = (Array.isArray(resolvedZone.interactables) ? resolvedZone.interactables : []).filter(
    (inter) => inter && (inter.kind === 'cache' || inter.type === 'cache')
  );
  const encountersTotal = encounters.length;
  const encountersCleared = encounters.filter((enc) => Boolean(cleared[enc.id])).length;
  const cachesTotal = caches.length;
  const cachesOpened = caches.filter((inter) => Boolean(completed[inter.id])).length;
  const totalObjectives = encountersTotal + cachesTotal;
  const completedObjectives = encountersCleared + cachesOpened;
  const percent =
    totalObjectives > 0
      ? Math.round((completedObjectives / totalObjectives) * 100)
      : visited
        ? 100
        : 0;
  return {
    zoneId: resolvedZone.id,
    visited,
    encountersCleared,
    encountersTotal,
    cachesOpened,
    cachesTotal,
    completedObjectives,
    totalObjectives,
    percent,
  };
}

export function getZoneVantage(gameState, zoneOrId = null) {
  const resolvedZone =
    typeof zoneOrId === 'string'
      ? getZone(zoneOrId)
      : zoneOrId && typeof zoneOrId === 'object'
        ? zoneOrId
        : getZone(gameState?.map?.zoneId || gameState?.location || 'greyhaven');
  const vantage = resolvedZone?.vantage || {
    landmark: resolvedZone?.name || 'Frontier Vantage',
    elevation: 0,
    surveyNote: '',
    fieldNote: '',
  };
  return {
    landmark: vantage.landmark,
    elevation: vantage.elevation,
    surveyNote: vantage.surveyNote,
    fieldNote: vantage.fieldNote,
    condition: getZoneCondition(gameState, resolvedZone),
    progress: getZoneProgress(gameState, resolvedZone),
  };
}

export function getFrontierAtlas(gameState = null) {
  const rawZoneId = gameState?.map?.zoneId || gameState?.location || 'greyhaven';
  const currentZoneId = Object.prototype.hasOwnProperty.call(ZONES, rawZoneId) ? rawZoneId : 'greyhaven';
  let zonesVisited = 0;
  let totalEncountersCleared = 0;
  let totalEncounters = 0;
  let totalCachesOpened = 0;
  let totalCaches = 0;
  let completedObjectives = 0;
  let totalObjectives = 0;

  const zones = ZONE_ORDER.map((zoneId) => {
    const zone = ZONES[zoneId];
    const progress = getZoneProgress(gameState, zone);
    const condition = getZoneCondition(gameState, zone);
    const isCurrent = zoneId === currentZoneId;
    const visited = Boolean(progress.visited || isCurrent);
    const unlocked = !zoneLockReason(gameState || {}, zone);
    const connections = Array.from(
      new Set(
        (zone.exits || [])
          .map((ex) => ex.toZone)
          .filter((id) => typeof id === 'string' && Object.prototype.hasOwnProperty.call(ZONES, id))
      )
    );
    const connectedNames = connections.map((id) => ZONES[id].name);

    if (visited) zonesVisited += 1;
    totalEncountersCleared += progress.encountersCleared;
    totalEncounters += progress.encountersTotal;
    totalCachesOpened += progress.cachesOpened;
    totalCaches += progress.cachesTotal;
    completedObjectives += progress.completedObjectives;
    totalObjectives += progress.totalObjectives;

    return {
      zoneId,
      name: zone.name,
      subtitle: zone.subtitle,
      dangerLevel: zone.dangerLevel ?? 0,
      visited,
      isCurrent,
      unlocked,
      conditionId: condition.id,
      conditionName: condition.name,
      encountersCleared: progress.encountersCleared,
      encountersTotal: progress.encountersTotal,
      cachesOpened: progress.cachesOpened,
      cachesTotal: progress.cachesTotal,
      completedObjectives: progress.completedObjectives,
      totalObjectives: progress.totalObjectives,
      percent: progress.percent,
      connections,
      connectedNames,
    };
  });

  const overallPercent = totalObjectives > 0
    ? Math.round((completedObjectives / totalObjectives) * 100)
    : 100;

  return {
    currentZoneId,
    zonesVisited,
    zonesTotal: zones.length,
    totalEncountersCleared,
    totalEncounters,
    totalCachesOpened,
    totalCaches,
    completedObjectives,
    totalObjectives,
    overallPercent,
    zones,
  };
}

/**
 * Pure read-only route briefing for a destination zone.
 * Masks weather and objective counts on locked or unvisited regions.
 */
export function getRouteBriefing(gameState, toZoneId) {
  if (typeof toZoneId !== 'string' || !Object.prototype.hasOwnProperty.call(ZONES, toZoneId)) {
    return null;
  }
  const zone = ZONES[toZoneId];
  const rawCurrentId = gameState?.map?.zoneId || gameState?.location || 'greyhaven';
  const currentZoneId = Object.prototype.hasOwnProperty.call(ZONES, rawCurrentId) ? rawCurrentId : 'greyhaven';
  const progress = getZoneProgress(gameState, zone);
  const visited = Boolean(progress.visited || zone.id === currentZoneId);
  const lockReason = zoneLockReason(gameState || {}, zone);
  const unlocked = !lockReason;
  const condition = getZoneCondition(gameState, zone);

  let summary;
  if (!unlocked) {
    summary = `${zone.name} · Locked — ${lockReason}`;
  } else if (!visited) {
    summary = `${zone.name} · Uncharted region (Danger ${zone.dangerLevel ?? 0})`;
  } else {
    const reconText = progress.totalObjectives > 0
      ? `${progress.percent}% recon (${progress.encountersCleared}/${progress.encountersTotal} threats, ${progress.cachesOpened}/${progress.cachesTotal} caches)`
      : 'Safe haven';
    summary = `${zone.name} · ${condition.name} · ${reconText}`;
  }

  return {
    zoneId: zone.id,
    name: zone.name,
    subtitle: zone.subtitle || '',
    dangerLevel: zone.dangerLevel ?? 0,
    visited,
    unlocked,
    lockReason: lockReason || null,
    conditionName: condition.name,
    percent: progress.percent,
    encountersCleared: progress.encountersCleared,
    encountersTotal: progress.encountersTotal,
    cachesOpened: progress.cachesOpened,
    cachesTotal: progress.cachesTotal,
    summary,
  };
}

/**
 * Pure read-only formatter that collapses consecutive identical expedition log
 * entries into `<line> (×N)` ordered newest-first up to `limit` entries.
 */
export function formatExpeditionLog(lines, limit = 6) {
  if (!Array.isArray(lines)) return [];
  const maxEntries = Number.isInteger(limit) && limit > 0 ? limit : 6;
  const valid = lines.filter((line) => typeof line === 'string' && line.length > 0);
  const entries = [];
  for (let i = valid.length - 1; i >= 0; i -= 1) {
    const text = valid[i];
    const last = entries[entries.length - 1];
    if (last && last.text === text) {
      last.count += 1;
    } else {
      if (entries.length >= maxEntries) break;
      entries.push({ text, count: 1 });
    }
  }
  return entries.map((entry) => (entry.count > 1 ? `${entry.text} (×${entry.count})` : entry.text));
}

/**
 * Pure read-only point-of-interest checklist for a zone (NPCs, fixed encounters,
 * interactables/caches, and outbound exits with coordinates and live status).
 */
export function getZoneChecklist(gameState, zoneOrId = null) {
  const resolvedZone =
    typeof zoneOrId === 'string'
      ? getZone(zoneOrId)
      : zoneOrId && typeof zoneOrId === 'object'
        ? zoneOrId
        : getZone(gameState?.map?.zoneId || gameState?.location || 'greyhaven');
  const clearedEncounters = gameState?.map?.clearedEncounters || {};
  const completedInteractions = gameState?.map?.completedInteractions || {};
  const mapLike = { clearedEncounters, completedInteractions };

  const npcs = (Array.isArray(resolvedZone.npcs) ? resolvedZone.npcs : []).map((n) => ({
    id: n.id,
    name: n.name,
    role: n.role || '',
    x: n.x,
    y: n.y,
  }));

  const encounters = (Array.isArray(resolvedZone.encounters) ? resolvedZone.encounters : []).map((e) => {
    const id = e.encounterId || e.id;
    const cleared = Boolean(clearedEncounters[id]);
    const lockReason = cleared ? null : encounterLockReason(mapLike, e, gameState);
    const unlocked = !lockReason;
    const status = cleared ? 'Cleared' : unlocked ? 'Active' : 'Locked';
    return {
      id,
      name: e.name,
      x: e.x,
      y: e.y,
      cleared,
      unlocked,
      lockReason: lockReason || null,
      status,
    };
  });

  const interactables = (Array.isArray(resolvedZone.interactables) ? resolvedZone.interactables : []).map((inter) => {
    const id = inter.interactionId || inter.id;
    const completed = Boolean(completedInteractions[id]);
    const once = Boolean(inter.once);
    const status = once ? (completed ? 'Completed' : 'Available') : 'Service';
    return {
      id,
      name: inter.name,
      kind: inter.kind || 'object',
      once,
      x: inter.x,
      y: inter.y,
      completed,
      status,
    };
  });

  const exits = (Array.isArray(resolvedZone.exits) ? resolvedZone.exits : []).map((ex) => {
    const briefing = getRouteBriefing(gameState, ex.toZone);
    return {
      toZone: ex.toZone,
      label: ex.label,
      x: ex.x,
      y: ex.y,
      visited: Boolean(briefing?.visited),
      unlocked: Boolean(briefing?.unlocked),
      summary: briefing?.summary || ex.label,
    };
  });

  return {
    zoneId: resolvedZone.id,
    name: resolvedZone.name,
    npcs,
    encounters,
    interactables,
    exits,
  };
}


export function getEffectiveRandomEncounterChance(gameState, zone) {
  const base = typeof zone?.randomEncounterChance === 'number' ? zone.randomEncounterChance : 0;
  if (base <= 0) return 0;
  let chance = base;
  const flags = gameState?.story?.flags || {};
  if (flags.relay_choice === 'route_network') chance *= 0.5;
  if (flags.victory_storm_heart && STORM_CALMED_ZONES.includes(zone?.id)) chance *= 0.5;
  return chance;
}

export function pickRandomEncounter(encounters, rng = Math.random) {
  if (!Array.isArray(encounters) || encounters.length === 0) return null;
  const weights = encounters.map((e) => (typeof e.weight === 'number' && e.weight > 0 ? e.weight : 1));
  const total = weights.reduce((acc, w) => acc + w, 0);
  let roll = Math.max(0, Math.min(0.999999, Number(rng()) || 0)) * total;
  for (let i = 0; i < encounters.length; i++) {
    roll -= weights[i];
    if (roll < 0) return encounters[i];
  }
  return encounters[encounters.length - 1];
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
        preview: getEncounterPreview(enc.enemyId, gameState),
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
            ? `Rest at ${inter.name} (${getInnCost(gameState, inter)}g)`
            : inter.kind === 'shop' || inter.kind === 'muster'
            ? `Visit ${inter.name}`
            : inter.kind === 'cache'
            ? `Open ${inter.name}`
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
        briefing: getRouteBriefing(gameState, ex.toZone),
      });
    }
  }

  if (Array.isArray(zone.randomEncounters) && zone.randomEncounters.length > 0) {
    actions.push({
      kind: 'patrol',
      id: zone.id,
      label: `Patrol ${zone.name} for Hostiles`,
      entity: null,
    });
  }

  return actions;
}

function appendLog(mapState, line) {
  if (!line) return;
  mapState.log = [...(mapState.log || []).slice(-19), line];
}

// Shared locks cover direct helpers, action buttons, and walking onto tiles.
function zoneLockReason(gameState, zone) {
  return zone?.requiresStoryFlag && gameState.story?.flags?.[zone.requiresStoryFlag] !== true
    ? zone.travelRequirementMessage || 'Complete the required expedition before entering this area.' : null;
}
function encounterLockReason(mapState, encounter, gameState) {
  if (encounter?.requiresStoryFlag && gameState?.story?.flags?.[encounter.requiresStoryFlag] !== true) {
    return encounter.requirementMessage || 'Complete the required expedition before engaging.';
  }
  return encounter?.requiresInteractions?.some(id => mapState.completedInteractions[id] !== true)
    ? encounter.requirementMessage || 'Complete the required inspections before engaging.' : null;
}
function lockedResult(gameState, message) {
  appendLog(gameState.map, message);
  return { state: gameState, moved: false, transitioned: false, events: [], log: [message], triggerCombat: null };
}

export function travelToZone(gameState, toZoneId, spawnKey = 'default') {
  const mapState = ensureMapState(gameState);
  const targetZone = ZONES[toZoneId];
  if (!targetZone) {
    return { state: gameState, events: [], log: [`Unknown destination: ${toZoneId}`] };
  }
  const lock = zoneLockReason(gameState, targetZone);
  if (lock) return lockedResult(gameState, lock);
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

  const nextExit = (zone.exits || []).find(ex => ex.x === nx && ex.y === ny);
  const nextEncounter = (zone.encounters || []).find(e => e.x === nx && e.y === ny && !mapState.clearedEncounters[e.encounterId || e.id]);
  const lock = zoneLockReason(gameState, ZONES[nextExit?.toZone]) || encounterLockReason(mapState, nextEncounter, gameState);
  if (lock) return lockedResult(gameState, lock);

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
      transitioned: Boolean(res.transitioned),
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

  // Check if stepped onto a story dispatch interactable
  const inter = (zone.interactables || []).find(
    (i) => i.x === nx && i.y === ny && !(i.once && mapState.completedInteractions[i.interactionId || i.id])
  );
  if (inter && inter.kind === 'dispatch') {
    return interactWith(gameState, 'interact', inter.interactionId || inter.id);
  }

  // Optional random encounter check in wild zones
  const rng = options.rng || Math.random;
  const effectiveChance = getEffectiveRandomEncounterChance(gameState, zone);
  if (
    !options.disableRandomEncounters &&
    effectiveChance > 0 &&
    Array.isArray(zone.randomEncounters) &&
    zone.randomEncounters.length > 0 &&
    rng() < effectiveChance
  ) {
    const pick = pickRandomEncounter(zone.randomEncounters, rng);
    if (pick) {
      mapState.activeEncounterId = pick.encounterId;
      const enemyName = pick.name || 'Roaming Storm Beast';
      const msg = `${enemyName} ambushes you along ${zone.name}!`;
      appendLog(mapState, msg);
      return {
        state: gameState,
        moved: true,
        events,
        log: [msg],
        triggerCombat: { encounterId: pick.encounterId, enemyId: pick.enemyId, name: enemyName },
      };
    }
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
    const lock = encounterLockReason(mapState, enc, gameState);
    if (lock) return lockedResult(gameState, lock);
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

    if (inter.once && mapState.completedInteractions[intId]) {
      const msg = `${inter.name} has already been searched.`;
      appendLog(mapState, msg);
      return { state: gameState, events: [], log: [msg], triggerCombat: null };
    }

    if (
      inter.requiresEncounterCleared &&
      !mapState.clearedEncounters[inter.requiresEncounterCleared]
    ) {
      const msg = `You must defeat the guardian before approaching the ${inter.name}.`;
      appendLog(mapState, msg);
      return { state: gameState, events: [], log: [msg], triggerCombat: null };
    }

    if (inter.kind === 'inn') {
      const cost = getInnCost(gameState, inter);
      if ((gameState.gold ?? 0) < cost) {
        const msg = `You need ${cost} gold to rest at ${inter.name}.`;
        appendLog(mapState, msg);
        return { state: gameState, events: [], log: [msg], triggerCombat: null };
      }
      gameState.gold -= cost;
      for (const member of gameState.party || []) {
        const eff = effectiveStats(member);
        if (typeof eff.maxHp === 'number') member.hp = eff.maxHp;
        else if (typeof member.maxHp === 'number') member.hp = member.maxHp;
        if (typeof eff.maxMp === 'number') member.mp = eff.maxMp;
        else if (typeof member.maxMp === 'number') member.mp = member.maxMp;
        if (Array.isArray(member.statuses)) member.statuses = [];
      }
      const msg = `Rested at ${inter.name} (-${cost}g). Party HP and MP fully restored.`;
      appendLog(mapState, msg);
      return { state: gameState, events: [], log: [msg], triggerCombat: null };
    }

    if (inter.kind === 'shop') {
      const msg = `Visiting ${inter.name}.`;
      appendLog(mapState, msg);
      return {
        state: gameState,
        events: [{ type: 'interact', interactionId: intId }],
        log: [msg],
        triggerCombat: null,
        triggerShop: { shopId: intId },
      };
    }

    if (inter.kind === 'muster') {
      const msg = `Visiting ${inter.name}.`;
      appendLog(mapState, msg);
      return {
        state: gameState,
        events: [{ type: 'interact', interactionId: intId }],
        log: [msg],
        triggerCombat: null,
        triggerMuster: { musterId: intId },
      };
    }

    let rewardText = '';
    if (Array.isArray(inter.rewards) && inter.rewards.length > 0) {
      const currentInv = Array.isArray(gameState.inventory) ? gameState.inventory : [];
      const grant = grantRewards(currentInv, inter.rewards);
      if (!grant.ok) {
        const errMsg = `Could not collect ${inter.name}: ${grant.messages.join(' ')}`;
        appendLog(mapState, errMsg);
        return { state: gameState, events: [], log: [errMsg], triggerCombat: null };
      }
      gameState.inventory = grant.inv;
      rewardText = ` (${grant.messages.join(' ')})`;
    }

    if (inter.once) {
      mapState.completedInteractions[intId] = true;
    }
    const msg = `${inter.name}: ${inter.description}${rewardText}`;
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

export function useFieldConsumable(gameState, itemId, targetIndex = 0) {
  const mapState = ensureMapState(gameState);
  const idx = Number.isInteger(targetIndex) ? targetIndex : 0;
  const target = idx >= 0 ? gameState.party?.[idx] : null;
  if (!target) {
    return { ok: false, state: gameState, log: ['No party member available.'] };
  }
  const inv = Array.isArray(gameState.inventory) ? gameState.inventory : [];
  const res = useConsumable(target, inv, itemId);
  if (!res.ok) {
    appendLog(mapState, res.message);
    return { ok: false, state: gameState, log: [res.message] };
  }
  gameState.party[idx] = res.actor;
  gameState.inventory = res.inv;
  appendLog(mapState, res.message);
  return { ok: true, state: gameState, effects: res.effects, log: [res.message] };
}

export function craftInField(gameState, recipeId) {
  const mapState = ensureMapState(gameState);
  const inv = Array.isArray(gameState.inventory) ? gameState.inventory : [];
  const res = craft(inv, recipeId);
  const msg = (res.messages || []).join(' ');
  if (!res.ok) {
    appendLog(mapState, msg);
    return { ok: false, state: gameState, log: [msg] };
  }
  gameState.inventory = res.inv;
  appendLog(mapState, `Crafted: ${msg}`);
  return { ok: true, state: gameState, log: [`Crafted: ${msg}`] };
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

export function patrolZone(gameState, options = {}) {
  const mapState = ensureMapState(gameState);
  const zone = getZone(mapState.zoneId);
  if (!Array.isArray(zone.randomEncounters) || zone.randomEncounters.length === 0) {
    const msg = `No roaming hostiles reported in ${zone.name}.`;
    appendLog(mapState, msg);
    return { state: gameState, events: [], log: [msg], triggerCombat: null };
  }
  const rng = options.rng || Math.random;
  const pick = pickRandomEncounter(zone.randomEncounters, rng);
  if (!pick) {
    return { state: gameState, events: [], log: [], triggerCombat: null };
  }
  mapState.activeEncounterId = null;
  const enemyName = pick.name || 'Roaming Storm Beast';
  const msg = `Patrol engaged ${enemyName} in ${zone.name}!`;
  appendLog(mapState, msg);
  return {
    state: gameState,
    events: [],
    log: [msg],
    triggerCombat: { encounterId: null, enemyId: pick.enemyId, name: enemyName },
  };
}

const COMPASS_LABELS = Object.freeze({
  N: 'North',
  NE: 'Northeast',
  E: 'East',
  SE: 'Southeast',
  S: 'South',
  SW: 'Southwest',
  W: 'West',
  NW: 'Northwest',
  HERE: 'Here',
});

export function getEncounterPreview(enemyId, gameState = null) {
  if (typeof enemyId !== 'string' || !Object.prototype.hasOwnProperty.call(ENEMIES, enemyId)) {
    return null;
  }
  const baseEnemy = ENEMIES[enemyId];
  if (!baseEnemy) return null;
  const difficulty = getDifficulty(gameState);
  const enemy = scaleEnemy(baseEnemy, difficulty);
  const book = gameState?.bestiary && typeof gameState.bestiary === 'object' && !Array.isArray(gameState.bestiary)
    ? gameState.bestiary
    : {};
  const rawCount = Object.prototype.hasOwnProperty.call(book, baseEnemy.id) ? book[baseEnemy.id] : 0;
  const defeatedCount = Number.isInteger(rawCount) && rawCount > 0 ? rawCount : 0;
  const known = defeatedCount > 0;
  const tier = baseEnemy.boss ? 'Boss' : baseEnemy.hp >= 60 ? 'Elite' : baseEnemy.hp >= 30 ? 'Veteran' : 'Standard';
  const drops = Array.isArray(baseEnemy.loot)
    ? baseEnemy.loot.map((entry) => {
        const item = isKnownItem(entry.id) ? getItem(entry.id) : { id: entry.id, name: entry.id };
        const chance = Number(entry.chance) || 0;
        const percent = Math.round(chance * 100);
        return {
          id: entry.id,
          name: item.name,
          chance,
          percent,
          minQty: Number.isInteger(entry.minQty) ? entry.minQty : 1,
          maxQty: Number.isInteger(entry.maxQty) ? entry.maxQty : 1,
          guaranteed: chance >= 1,
        };
      })
    : [];
  const dropSummary = drops.length > 0
    ? (known
        ? drops.map((d) => `${d.name} (${d.percent}%)`).join(', ')
        : `Unscouted (${drops.map((d) => `${d.percent}%`).join(', ')})`)
    : '';
  const summary = `${enemy.name} (${tier}, ${enemy.hp} HP)${dropSummary ? ` · Drops: ${dropSummary}` : ''}`;
  return {
    enemyId: baseEnemy.id,
    name: enemy.name,
    hp: enemy.hp,
    baseHp: baseEnemy.hp,
    atk: enemy.atk,
    def: enemy.def,
    spd: enemy.spd,
    gold: enemy.gold,
    difficulty,
    boss: Boolean(baseEnemy.boss),
    tier,
    known,
    defeatedCount,
    drops,
    summary,
  };
}

export function getZoneThreatIntel(gameState, zoneOrId = null) {
  const resolvedZone = typeof zoneOrId === 'object' && zoneOrId !== null
    ? zoneOrId
    : getZone(zoneOrId || gameState?.map?.zoneId || gameState?.location || 'greyhaven');
  const mapState = gameState?.map || {};
  const clearedMap = mapState?.clearedEncounters || {};
  const fixedEncounters = (resolvedZone.encounters || []).map((enc) => {
    const encId = enc.encounterId || enc.id;
    return {
      id: encId,
      name: enc.name,
      enemyId: enc.enemyId,
      x: enc.x,
      y: enc.y,
      cleared: Boolean(clearedMap[encId]),
      locked: Boolean(encounterLockReason(mapState, enc, gameState)),
      preview: getEncounterPreview(enc.enemyId, gameState),
    };
  });
  const roamingEncounters = (resolvedZone.randomEncounters || []).map((entry) => ({
    enemyId: entry.enemyId,
    weight: typeof entry.weight === 'number' && entry.weight > 0 ? entry.weight : 1,
    preview: getEncounterPreview(entry.enemyId, gameState),
  }));
  return {
    zoneId: resolvedZone.id,
    fixedEncounters,
    roamingEncounters,
  };
}

export function getCompassBearing(fromX, fromY, toX, toY) {
  const fx = Number(fromX) || 0;
  const fy = Number(fromY) || 0;
  const tx = Number(toX) || 0;
  const ty = Number(toY) || 0;
  const dx = tx - fx;
  const dy = ty - fy;
  const distance = Math.abs(dx) + Math.abs(dy);
  const ns = dy < 0 ? 'N' : dy > 0 ? 'S' : '';
  const ew = dx < 0 ? 'W' : dx > 0 ? 'E' : '';
  const bearing = (ns + ew) || 'HERE';
  return {
    bearing,
    directionLabel: COMPASS_LABELS[bearing] || 'Here',
    distance,
    dx,
    dy,
  };
}

export function getZoneCompassHint(gameState, zoneOrId = null) {
  const mapState = gameState?.map || {};
  const resolvedZone =
    typeof zoneOrId === 'string'
      ? getZone(zoneOrId)
      : zoneOrId && typeof zoneOrId === 'object'
        ? zoneOrId
        : getZone(mapState.zoneId || gameState?.location || 'greyhaven');
  const px = Number.isInteger(mapState.x) ? mapState.x : (resolvedZone.spawns?.default?.x ?? 0);
  const py = Number.isInteger(mapState.y) ? mapState.y : (resolvedZone.spawns?.default?.y ?? 0);
  const cleared = mapState.clearedEncounters || {};
  const completed = mapState.completedInteractions || {};
  const visited = mapState.visitedZones || {};

  const byDistance = (a, b) =>
    (Math.abs(a.x - px) + Math.abs(a.y - py)) - (Math.abs(b.x - px) + Math.abs(b.y - py));

  const encounters = (resolvedZone.encounters || [])
    .filter((enc) => !cleared[enc.encounterId || enc.id] && !encounterLockReason(mapState, enc, gameState))
    .map((enc) => ({ kind: 'encounter', id: enc.encounterId || enc.id, label: enc.name, x: enc.x, y: enc.y }))
    .sort(byDistance);

  const interactables = (resolvedZone.interactables || [])
    .filter((inter) => inter.once && !completed[inter.interactionId || inter.id])
    .map((inter) => ({ kind: 'interactable', id: inter.interactionId || inter.id, label: inter.name, x: inter.x, y: inter.y }))
    .sort(byDistance);

  const unlockedExits = (resolvedZone.exits || [])
    .filter((ex) => !zoneLockReason(gameState || {}, ZONES[ex.toZone]))
    .map((ex) => ({
      kind: 'exit',
      id: ex.toZone,
      label: ex.label,
      x: ex.x,
      y: ex.y,
      unvisited: !visited[ex.toZone],
    }));
  const unvisitedExits = unlockedExits.filter((ex) => ex.unvisited).sort(byDistance);
  const fallbackExits = unlockedExits.sort(byDistance);

  const target = encounters[0] || interactables[0] || unvisitedExits[0] || fallbackExits[0] || null;
  if (!target) return null;

  const nav = getCompassBearing(px, py, target.x, target.y);
  const summary = nav.distance === 0
    ? `${target.label} (here)`
    : `${target.label} (${nav.bearing}, ${nav.distance} ${nav.distance === 1 ? 'tile' : 'tiles'})`;

  return {
    kind: target.kind,
    id: target.id,
    label: target.label,
    x: target.x,
    y: target.y,
    bearing: nav.bearing,
    directionLabel: nav.directionLabel,
    distance: nav.distance,
    summary,
  };
}

function isIntermediateStepSafe(zone, mapState, x, y) {
  if (!isWalkable(zone, mapState, x, y)) return false;
  if ((zone.npcs || []).some((n) => n.x === x && n.y === y)) return false;
  if ((zone.exits || []).some((ex) => ex.x === x && ex.y === y)) return false;
  if ((zone.encounters || []).some((e) => e.x === x && e.y === y && !mapState?.clearedEncounters?.[e.encounterId || e.id])) {
    return false;
  }
  if ((zone.interactables || []).some((i) => i.x === x && i.y === y && i.kind === 'dispatch' && !(i.once && mapState?.completedInteractions?.[i.interactionId || i.id]))) {
    return false;
  }
  return true;
}

export function findSafePath(zone, mapState, targetX, targetY, gameState = null) {
  if (!zone || !mapState) return null;
  const startX = Number(mapState.x);
  const startY = Number(mapState.y);
  const tx = Number(targetX);
  const ty = Number(targetY);
  if (!Number.isInteger(startX) || !Number.isInteger(startY) || !Number.isInteger(tx) || !Number.isInteger(ty)) {
    return null;
  }
  if (tx < 0 || tx >= zone.width || ty < 0 || ty >= zone.height) return null;
  if (startX === tx && startY === ty) return [];
  if (!isWalkable(zone, mapState, tx, ty)) return null;

  if (gameState) {
    const destExit = (zone.exits || []).find((ex) => ex.x === tx && ex.y === ty);
    const destEnc = (zone.encounters || []).find((e) => e.x === tx && e.y === ty && !mapState?.clearedEncounters?.[e.encounterId || e.id]);
    if (zoneLockReason(gameState, ZONES[destExit?.toZone]) || encounterLockReason(mapState, destEnc, gameState)) {
      return null;
    }
  }

  const dirs = [
    { dx: 0, dy: -1 },
    { dx: 0, dy: 1 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 0 },
  ];
  const visited = new Set([`${startX},${startY}`]);
  const queue = [{ x: startX, y: startY, path: [] }];

  while (queue.length > 0) {
    const current = queue.shift();
    for (const { dx, dy } of dirs) {
      const nx = current.x + dx;
      const ny = current.y + dy;
      const key = `${nx},${ny}`;
      if (visited.has(key)) continue;
      if (nx < 0 || nx >= zone.width || ny < 0 || ny >= zone.height) continue;

      const isDest = nx === tx && ny === ty;
      if (!isDest && !isIntermediateStepSafe(zone, mapState, nx, ny)) continue;
      if (isDest && !isWalkable(zone, mapState, nx, ny)) continue;

      const nextPath = [...current.path, { x: nx, y: ny, dx, dy }];
      if (isDest) return nextPath;

      visited.add(key);
      queue.push({ x: nx, y: ny, path: nextPath });
    }
  }

  return null;
}

export function stepAlongSafePath(gameState, targetX, targetY, options = {}) {
  const mapState = ensureMapState(gameState);
  const zone = getZone(mapState.zoneId);
  const tx = Number(targetX);
  const ty = Number(targetY);

  if (!Number.isInteger(tx) || !Number.isInteger(ty)) {
    return { state: gameState, moved: false, stepsTaken: 0, events: [], log: [], triggerCombat: null };
  }
  if (tx === mapState.x && ty === mapState.y) {
    return { state: gameState, moved: false, stepsTaken: 0, events: [], log: [], triggerCombat: null };
  }

  if (Math.abs(tx - mapState.x) + Math.abs(ty - mapState.y) === 1) {
    const single = movePlayer(gameState, tx - mapState.x, ty - mapState.y, options);
    return { ...single, stepsTaken: single.moved ? 1 : 0 };
  }

  const path = findSafePath(zone, mapState, tx, ty, gameState);
  if (!path || path.length === 0) {
    const msg = `No clear route to (${tx}, ${ty}).`;
    appendLog(mapState, msg);
    return { state: gameState, moved: false, stepsTaken: 0, events: [], log: [msg], triggerCombat: null };
  }

  const maxSteps = Number.isInteger(options.maxSteps) && options.maxSteps > 0 ? options.maxSteps : 16;
  const events = [];
  const logs = [];
  let stepsTaken = 0;

  for (let i = 0; i < Math.min(path.length, maxSteps); i += 1) {
    const step = path[i];
    const res = movePlayer(gameState, step.dx, step.dy, options);
    if (Array.isArray(res.events) && res.events.length > 0) events.push(...res.events);
    if (Array.isArray(res.log) && res.log.length > 0) logs.push(...res.log);
    if (res.moved) stepsTaken += 1;

    if (!res.moved || res.transitioned || res.triggerCombat || res.triggerShop || res.triggerMuster || (res.events && res.events.length > 0)) {
      return {
        state: gameState,
        moved: stepsTaken > 0,
        stepsTaken,
        transitioned: Boolean(res.transitioned),
        events,
        log: logs,
        triggerCombat: res.triggerCombat || null,
        triggerShop: res.triggerShop,
        triggerMuster: res.triggerMuster,
      };
    }

    const isLastStep = i === path.length - 1;
    if (!isLastStep) {
      const adjacentThreat = (zone.encounters || []).find(
        (e) =>
          !mapState.clearedEncounters[e.encounterId || e.id] &&
          !(e.x === tx && e.y === ty) &&
          isAdjacentOrOn(mapState.x, mapState.y, e.x, e.y)
      );
      if (adjacentThreat) {
        const cautionMsg = `Paused near ${adjacentThreat.name} (${mapState.x}, ${mapState.y}).`;
        appendLog(mapState, cautionMsg);
        logs.push(cautionMsg);
        break;
      }
    }
  }

  return {
    state: gameState,
    moved: stepsTaken > 0,
    stepsTaken,
    transitioned: false,
    events,
    log: logs,
    triggerCombat: null,
  };
}
