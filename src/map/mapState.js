import { TILE_TYPES, ZONE_CONDITIONS, ZONES, ZONE_ORDER } from './zones.js';
import { grantRewards } from '../items/inventory.js';
import { useConsumable } from '../items/consumables.js';
import { craft, listRecipes, recipeInputsMet } from '../items/crafting.js';
import { effectiveStats } from '../items/equipment.js';
import { getItem, isKnownItem, TYPES } from '../items/items.js';
import { ENEMIES } from '../data/enemies.js';
import { getDifficulty, scaleEnemy } from '../combat/difficulty.js';
import { createStoryState, getDialogue } from '../story/index.js';

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
  const condition = getZoneCondition(gameState, resolvedZone);
  const progress = getZoneProgress(gameState, resolvedZone);
  const objSummary = progress.totalObjectives > 0
    ? `${progress.percent}% recon (${progress.encountersCleared}/${progress.encountersTotal} threats, ${progress.cachesOpened}/${progress.cachesTotal} caches)`
    : 'Safe haven';
  const summaryParts = [
    `${vantage.landmark} (${vantage.elevation}m)`,
    `${condition.name}: ${condition.summary}`,
    objSummary,
  ];
  if (vantage.surveyNote) summaryParts.push(vantage.surveyNote);
  return {
    landmark: vantage.landmark,
    elevation: vantage.elevation,
    surveyNote: vantage.surveyNote,
    fieldNote: vantage.fieldNote,
    condition,
    progress,
    summary: summaryParts.join(' · '),
  };
}

export function getZoneWeatherBriefing(gameState, zoneOrId = null) {
  const resolvedZone =
    typeof zoneOrId === 'string'
      ? getZone(zoneOrId)
      : zoneOrId && typeof zoneOrId === 'object'
        ? zoneOrId
        : getZone(gameState?.map?.zoneId || gameState?.location || 'greyhaven');
  const condition = getZoneCondition(gameState, resolvedZone);
  const story = gameState?.story;
  const flags = story?.flags || {};
  const beaconLit =
    resolvedZone?.id === 'beacon_tower' &&
    (story?.stage === 'complete' ||
      story?.ending === 'protect_town' ||
      story?.ending === 'share_signal' ||
      Boolean(story?.ending) ||
      Boolean(flags.beacon_lit));
  const stormCalmed = Boolean(
    flags.victory_storm_heart && STORM_CALMED_ZONES.includes(resolvedZone?.id)
  );
  const routeNetworkActive = flags.relay_choice === 'route_network';
  const shelterNetworkActive = flags.relay_choice === 'shelter_network';
  const hasRandomEncounters =
    Array.isArray(resolvedZone?.randomEncounters) && resolvedZone.randomEncounters.length > 0;
  const baseEncounterChance = hasRandomEncounters
    ? (typeof resolvedZone?.randomEncounterChance === 'number' ? resolvedZone.randomEncounterChance : 0)
    : 0;
  const baseEncounterPercent = Math.round(baseEncounterChance * 100);
  const effectiveEncounterChance = hasRandomEncounters
    ? getEffectiveRandomEncounterChance(gameState, resolvedZone)
    : 0;
  const effectiveEncounterPercent = Math.round(effectiveEncounterChance * 100);
  const modifiers = [];
  if (beaconLit) modifiers.push('Beacon lit (Lantern Shelter)');
  if (stormCalmed) modifiers.push('Storm calmed (-50% step ambush)');
  if (routeNetworkActive && baseEncounterChance > 0) {
    modifiers.push('Signal Relay route network (-50% step ambush)');
  }
  if (shelterNetworkActive) {
    modifiers.push('Shelter network (2g inn rest)');
  }
  const dangerLevel = resolvedZone?.dangerLevel ?? 0;
  const ambushSummary = baseEncounterChance > 0
    ? `Step ambush: ${effectiveEncounterPercent}%${effectiveEncounterPercent !== baseEncounterPercent ? ` (base ${baseEncounterPercent}%)` : ''}`
    : 'No roaming ambushes';
  const modifierSummary = modifiers.length > 0
    ? `Modifiers: ${modifiers.join(', ')}`
    : 'Modifiers: Standard frontier conditions';
  const summary = `${condition.name}: ${condition.summary} · Danger ${dangerLevel} · ${ambushSummary} · ${modifierSummary}`;
  return {
    zoneId: resolvedZone.id,
    zoneName: resolvedZone.name,
    dangerLevel,
    condition,
    baseConditionId: resolvedZone.condition || 'sheltered',
    beaconLit,
    stormCalmed,
    routeNetworkActive,
    shelterNetworkActive,
    baseEncounterChance,
    baseEncounterPercent,
    effectiveEncounterChance,
    effectiveEncounterPercent,
    modifiers,
    summary,
  };
}

/**
 * Pure read-only summary of repeatable field services (inn, shop, muster)
 * across charted zones, plus live inn rest cost and active network status.
 */
/**
 * Pure read-only preview of what using a field consumable on a specific party member
 * will immediately restore or cure, without mutating state.
 */
export function getFieldConsumablePreview(gameState, itemId, targetIndex = 0) {
  if (typeof itemId !== 'string' || !isKnownItem(itemId)) return null;
  const item = getItem(itemId);
  if (!item || item.type !== TYPES.CONSUMABLE) return null;

  const idx = Number.isInteger(targetIndex) ? targetIndex : 0;
  const target = idx >= 0 ? gameState?.party?.[idx] : null;
  if (!target || typeof target !== 'object') return null;

  const eff = effectiveStats(target);
  const maxHp = Math.max(0, Number(eff.maxHp ?? target.maxHp ?? target.hp) || 0);
  const hp = Math.max(0, Math.min(maxHp || Infinity, Number(target.hp) || 0));
  const maxMp = Math.max(0, Number(eff.maxMp ?? target.maxMp ?? target.mp) || 0);
  const mp = Math.max(0, Math.min(maxMp || Infinity, Number(target.mp) || 0));
  const statuses = Array.isArray(target.statuses)
    ? target.statuses.filter((s) => typeof s === 'string' && s.length > 0)
    : [];

  const use = item.use || {};
  const hpGain = use.hp ? Math.max(0, Math.min(maxHp, hp + use.hp) - hp) : 0;
  const mpGain = use.mp ? Math.max(0, Math.min(maxMp, mp + use.mp) - mp) : 0;
  const curedStatus = use.cure && statuses.includes(use.cure) ? use.cure : null;
  const wouldHaveEffect = hpGain > 0 || mpGain > 0 || Boolean(curedStatus);

  const effectParts = [];
  if (hpGain > 0) effectParts.push(`+${hpGain} HP (${hp}/${maxHp})`);
  if (mpGain > 0) effectParts.push(`+${mpGain} MP (${mp}/${maxMp})`);
  if (curedStatus) effectParts.push(`cures ${curedStatus}`);

  const effectSummary = effectParts.length > 0 ? effectParts.join(', ') : 'No immediate effect';
  const targetName = target.name || (idx === 0 ? 'Wren' : `Ally ${idx}`);
  const baseDescription = item.description || item.name;
  const summary = wouldHaveEffect
    ? `${baseDescription} — On ${targetName} now: ${effectSummary}`
    : baseDescription;

  return {
    itemId: item.id,
    itemName: item.name,
    description: baseDescription,
    targetIndex: idx,
    targetName,
    hp,
    maxHp,
    mp,
    maxMp,
    hpGain,
    mpGain,
    curedStatus,
    wouldHaveEffect,
    effectSummary,
    summary,
  };
}

/**
 * Pure read-only summary of party HP, MP, and active status conditions in the field,
 * respecting equipment bonuses via effectiveStats.
 */
export function getPartyFieldReadiness(gameState = null) {
  const rawParty = Array.isArray(gameState?.party) ? gameState.party.filter(Boolean) : [];
  let totalHp = 0;
  let totalMaxHp = 0;
  let totalMp = 0;
  let totalMaxMp = 0;
  let woundedCount = 0;
  let lowMpCount = 0;
  const statusSet = new Set();

  const members = rawParty.map((member, idx) => {
    const eff = effectiveStats(member);
    const maxHp = Math.max(0, Number(eff.maxHp ?? member.maxHp ?? member.hp) || 0);
    const hp = Math.max(0, Math.min(maxHp || Infinity, Number(member.hp) || 0));
    const maxMp = Math.max(0, Number(eff.maxMp ?? member.maxMp ?? member.mp) || 0);
    const mp = Math.max(0, Math.min(maxMp || Infinity, Number(member.mp) || 0));
    const statuses = Array.isArray(member.statuses)
      ? member.statuses.filter((s) => typeof s === 'string' && s.length > 0)
      : [];
    for (const s of statuses) statusSet.add(s);

    const wounded = maxHp > 0 && hp < maxHp;
    const lowMp = maxMp > 0 && mp < maxMp;
    if (wounded) woundedCount += 1;
    if (lowMp) lowMpCount += 1;
    totalHp += hp;
    totalMaxHp += maxHp;
    totalMp += mp;
    totalMaxMp += maxMp;

    return {
      id: member.id || `member_${idx}`,
      name: member.name || (idx === 0 ? 'Wren' : `Ally ${idx}`),
      hp,
      maxHp,
      mp,
      maxMp,
      statuses,
      wounded,
      lowMp,
    };
  });

  const hpPercent = totalMaxHp > 0 ? Math.round((totalHp / totalMaxHp) * 100) : 100;
  const mpPercent = totalMaxMp > 0 ? Math.round((totalMp / totalMaxMp) * 100) : 100;
  const activeStatuses = Array.from(statusSet);
  const needsAttention = woundedCount > 0 || lowMpCount > 0 || activeStatuses.length > 0;
  const parts = [
    `Party readiness: ${hpPercent}% HP (${totalHp}/${totalMaxHp})`,
    `${mpPercent}% MP (${totalMp}/${totalMaxMp})`,
  ];
  if (activeStatuses.length > 0) {
    parts.push(`Statuses: ${activeStatuses.join(', ')}`);
  }
  parts.push(needsAttention ? 'Rest or supplies advised' : 'Ready');

  return {
    memberCount: members.length,
    totalHp,
    totalMaxHp,
    hpPercent,
    totalMp,
    totalMaxMp,
    mpPercent,
    woundedCount,
    lowMpCount,
    activeStatuses,
    needsAttention,
    members,
    summary: parts.join(' · '),
  };
}

export function getFieldServicesSummary(gameState = null) {
  const rawZoneId = gameState?.map?.zoneId || gameState?.location || 'greyhaven';
  const currentZoneId = Object.prototype.hasOwnProperty.call(ZONES, rawZoneId) ? rawZoneId : 'greyhaven';
  const visitedMap = gameState?.map?.visitedZones || {};
  const flags = gameState?.story?.flags || {};
  const shelterNetworkActive = flags.relay_choice === 'shelter_network';
  const routeNetworkActive = flags.relay_choice === 'route_network';
  const stormCalmed = Boolean(flags.victory_storm_heart);
  const innCost = getInnCost(gameState, { costGold: 5 });

  const services = [];
  for (const zoneId of ZONE_ORDER) {
    const zone = ZONES[zoneId];
    if (!zone) continue;
    const visited = Boolean(visitedMap[zoneId] || zoneId === currentZoneId);
    if (!visited) continue;
    for (const inter of zone.interactables || []) {
      if (!inter || inter.once) continue;
      if (inter.kind !== 'inn' && inter.kind !== 'shop' && inter.kind !== 'muster') continue;
      services.push({
        id: inter.interactionId || inter.id,
        name: inter.name,
        kind: inter.kind,
        zoneId: zone.id,
        zoneName: zone.name,
        x: inter.x,
        y: inter.y,
        costGold: inter.kind === 'inn' ? getInnCost(gameState, inter) : null,
      });
    }
  }

  const inns = services.filter((s) => s.kind === 'inn');
  const shops = services.filter((s) => s.kind === 'shop');
  const musters = services.filter((s) => s.kind === 'muster');
  const shopZones = Array.from(new Set(shops.map((s) => s.zoneName)));

  const parts = [
    `Inn rest: ${innCost}g${shelterNetworkActive ? ' (Shelter Network)' : ''}`,
    `Charted posts: ${shops.length} ${shops.length === 1 ? 'shop' : 'shops'}${shopZones.length > 0 ? ` (${shopZones.join(', ')})` : ''}`,
  ];
  if (routeNetworkActive) parts.push('Route Network (-50% ambushes)');
  if (stormCalmed) parts.push('Storm Heart calmed');

  const stacks = Array.isArray(gameState?.inventory)
    ? gameState.inventory.filter((stack) => stack && Number(stack.qty) > 0)
    : [];
  let consumableStacks = 0;
  let consumableUnits = 0;
  for (const stack of stacks) {
    if (!isKnownItem(stack.id)) continue;
    const item = getItem(stack.id);
    if (item.type === TYPES.CONSUMABLE) {
      consumableStacks += 1;
      consumableUnits += Math.max(0, Math.floor(Number(stack.qty) || 0));
    }
  }
  const craftableNames = listRecipes()
    .filter((recipe) => recipeInputsMet(stacks, recipe).ok)
    .map((recipe) => recipe.name);
  const craftableCount = craftableNames.length;
  const packParts = [
    `Field pack: ${consumableUnits} ${consumableUnits === 1 ? 'consumable' : 'consumables'}${consumableStacks > 0 ? ` (${consumableStacks} ${consumableStacks === 1 ? 'stack' : 'stacks'})` : ''}`,
    `Craft ready: ${craftableCount}${craftableNames.length > 0 ? ` (${craftableNames.join(', ')})` : ''}`,
  ];

  return {
    currentZoneId,
    innCost,
    shelterNetworkActive,
    routeNetworkActive,
    stormCalmed,
    inns,
    shops,
    musters,
    services,
    consumableStacks,
    consumableUnits,
    craftableCount,
    craftableNames,
    packSummary: packParts.join(' · '),
    summary: parts.join(' · '),
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
    const lockReason = zoneLockReason(gameState || {}, zone);
    const unlocked = !lockReason;
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

    const reconText = progress.totalObjectives > 0
      ? `${progress.percent}% recon (${progress.encountersCleared}/${progress.encountersTotal} threats, ${progress.cachesOpened}/${progress.cachesTotal} caches)`
      : 'Safe haven';
    const routesText = connectedNames.length > 0
      ? `Routes: ${connectedNames.join(', ')}`
      : 'No outbound routes';
    const entrySummary = visited
      ? `${zone.name}${isCurrent ? ' (Current)' : ''} · ${condition.name} · ${reconText} · ${routesText}`
      : lockReason
        ? `Locked — ${lockReason}`
        : `Uncharted region (Danger ${zone.dangerLevel ?? 0})`;

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
      summary: entrySummary,
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
    summary: `${zonesVisited}/${zones.length} regions charted · ${overallPercent}% recon (${totalEncountersCleared}/${totalEncounters} threats, ${totalCachesOpened}/${totalCaches} caches)`,
    zones,
  };
}

const EXPEDITION_ACT_DEFS = Object.freeze([
  Object.freeze({
    id: 'act_1',
    label: 'Act I',
    title: 'Highland Signal Line',
    zoneIds: Object.freeze(['greyhaven', 'ridge_road', 'observatory_ruins', 'beacon_tower']),
  }),
  Object.freeze({
    id: 'act_2',
    label: 'Act II',
    title: 'Frontier Outposts',
    zoneIds: Object.freeze(['saltmere_coast', 'highwatch_pass', 'sunscar_relay']),
  }),
  Object.freeze({
    id: 'act_3',
    label: 'Act III',
    title: 'Upper Tempest',
    zoneIds: Object.freeze(['stormcrown_spire', 'storms_eye']),
  }),
]);

/**
 * Pure read-only regional theater (Act I–III) completion and recon summary.
 * Never leaks unvisited region names while reporting charted & secured counts per act.
 */
export function getExpeditionProgressSummary(gameState = null) {
  const rawZoneId = gameState?.map?.zoneId || gameState?.location || 'greyhaven';
  const currentZoneId = Object.prototype.hasOwnProperty.call(ZONES, rawZoneId) ? rawZoneId : 'greyhaven';
  let currentActId = 'act_1';
  let actsCompleted = 0;
  let zonesSecured = 0;
  let zonesTotal = 0;

  const acts = EXPEDITION_ACT_DEFS.map((def) => {
    let actVisited = 0;
    let actSecured = 0;
    let encountersCleared = 0;
    let encountersTotal = 0;
    let cachesOpened = 0;
    let cachesTotal = 0;
    let completedObjectives = 0;
    let totalObjectives = 0;
    let unlocked = false;
    const chartedNames = [];

    for (const zoneId of def.zoneIds) {
      const zone = ZONES[zoneId];
      if (!zone) continue;
      const progress = getZoneProgress(gameState, zone);
      const isCurrent = zoneId === currentZoneId;
      const visited = Boolean(progress.visited || isCurrent);
      const zoneUnlocked = !zoneLockReason(gameState || {}, zone);
      if (zoneUnlocked) unlocked = true;
      if (visited) {
        actVisited += 1;
        chartedNames.push(zone.name);
      }
      if (visited && progress.completedObjectives === progress.totalObjectives) {
        actSecured += 1;
      }
      encountersCleared += progress.encountersCleared;
      encountersTotal += progress.encountersTotal;
      cachesOpened += progress.cachesOpened;
      cachesTotal += progress.cachesTotal;
      completedObjectives += progress.completedObjectives;
      totalObjectives += progress.totalObjectives;
    }

    const actTotalZones = def.zoneIds.length;
    const unchartedCount = Math.max(0, actTotalZones - actVisited);
    const percent = totalObjectives > 0
      ? Math.round((completedObjectives / totalObjectives) * 100)
      : actVisited > 0
        ? 100
        : 0;
    const complete = actVisited === actTotalZones && completedObjectives === totalObjectives;
    const isCurrentAct = def.zoneIds.includes(currentZoneId);
    if (isCurrentAct) currentActId = def.id;
    if (complete) actsCompleted += 1;
    zonesSecured += actSecured;
    zonesTotal += actTotalZones;

    const summary = actVisited === 0
      ? `${def.label} (${def.title}): Uncharted (${actTotalZones} regions)`
      : `${def.label} (${def.title}): ${actVisited}/${actTotalZones} regions · ${percent}% recon (${encountersCleared}/${encountersTotal} threats, ${cachesOpened}/${cachesTotal} caches)`;

    return {
      id: def.id,
      label: def.label,
      title: def.title,
      zoneIds: [...def.zoneIds],
      isCurrentAct,
      unlocked,
      complete,
      zonesVisited: actVisited,
      zonesSecured: actSecured,
      zonesTotal: actTotalZones,
      unchartedCount,
      chartedNames,
      encountersCleared,
      encountersTotal,
      cachesOpened,
      cachesTotal,
      completedObjectives,
      totalObjectives,
      percent,
      summary,
    };
  });

  const actSegments = acts.map((a) => `${a.label} ${a.percent}% (${a.zonesVisited}/${a.zonesTotal})`);
  const summary = `Acts: ${actSegments.join(' · ')} · ${zonesSecured}/${zonesTotal} regions secured`;

  return {
    currentZoneId,
    currentActId,
    actsCompleted,
    actsTotal: acts.length,
    zonesSecured,
    zonesTotal,
    acts,
    summary,
  };
}

/**
 * Pure read-only summary of all charted fast-travel destinations available from
 * the active zone, including secured counts, remaining threats/caches across
 * charted routes, and whether a safe haven is reachable.
 */
export function getFastTravelBriefing(gameState = null, currentZoneOrId = null) {
  const explicitId = typeof currentZoneOrId === 'string'
    ? currentZoneOrId
    : (currentZoneOrId && typeof currentZoneOrId === 'object' ? currentZoneOrId.id : null);
  const rawZoneId = explicitId || gameState?.map?.zoneId || gameState?.location || 'greyhaven';
  const currentZoneId = Object.prototype.hasOwnProperty.call(ZONES, rawZoneId) ? rawZoneId : 'greyhaven';

  const visitedMap = {};
  const rawVisited = gameState?.map?.visitedZones;
  if (Array.isArray(rawVisited)) {
    for (const id of rawVisited) {
      if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(ZONES, id)) {
        visitedMap[id] = true;
      }
    }
  } else if (rawVisited && typeof rawVisited === 'object') {
    for (const [id, flag] of Object.entries(rawVisited)) {
      if (flag && Object.prototype.hasOwnProperty.call(ZONES, id)) {
        visitedMap[id] = true;
      }
    }
  }
  if (Array.isArray(gameState?.visitedZones)) {
    for (const id of gameState.visitedZones) {
      if (typeof id === 'string' && Object.prototype.hasOwnProperty.call(ZONES, id)) {
        visitedMap[id] = true;
      }
    }
  }
  visitedMap[currentZoneId] = true;

  const normalizedState = {
    ...(gameState && typeof gameState === 'object' ? gameState : {}),
    map: {
      ...(gameState?.map && typeof gameState.map === 'object' ? gameState.map : {}),
      zoneId: currentZoneId,
      visitedZones: visitedMap,
    },
  };

  let securedCount = 0;
  let activeZoneCount = 0;
  let remainingEncounters = 0;
  let remainingCaches = 0;
  let safeHavenAvailable = false;

  const destinations = ZONE_ORDER
    .filter((zoneId) => zoneId !== currentZoneId && visitedMap[zoneId] === true)
    .map((zoneId) => {
      const briefing = getRouteBriefing(normalizedState, zoneId);
      const zone = ZONES[zoneId];
      const remEncounters = Math.max(0, briefing.encountersTotal - briefing.encountersCleared);
      const remCaches = Math.max(0, briefing.cachesTotal - briefing.cachesOpened);
      const remObjectives = remEncounters + remCaches;
      const secured = briefing.percent === 100 && remObjectives === 0;
      const safeHaven = (zone?.dangerLevel ?? 0) === 0 && briefing.encountersTotal === 0 && briefing.cachesTotal === 0;
      if (secured) securedCount += 1;
      if (remObjectives > 0) activeZoneCount += 1;
      remainingEncounters += remEncounters;
      remainingCaches += remCaches;
      if (safeHaven && briefing.unlocked) safeHavenAvailable = true;
      return {
        ...briefing,
        remainingEncounters: remEncounters,
        remainingCaches: remCaches,
        remainingObjectives: remObjectives,
        secured,
        safeHaven,
      };
    });

  const destinationCount = destinations.length;
  let summary;
  if (destinationCount === 0) {
    summary = 'No charted fast-travel routes available yet';
  } else {
    const parts = [
      `${destinationCount} charted ${destinationCount === 1 ? 'route' : 'routes'} (${securedCount}/${destinationCount} secured)`,
    ];
    if (remainingEncounters > 0 || remainingCaches > 0) {
      parts.push(
        `${remainingEncounters} ${remainingEncounters === 1 ? 'threat' : 'threats'}, ${remainingCaches} ${remainingCaches === 1 ? 'cache' : 'caches'} remaining`
      );
    } else {
      parts.push('All charted routes fully secured');
    }
    if (safeHavenAvailable) {
      parts.push('Safe haven reachable');
    }
    summary = parts.join(' · ');
  }

  return {
    currentZoneId,
    destinationCount,
    securedCount,
    activeZoneCount,
    remainingEncounters,
    remainingCaches,
    safeHavenAvailable,
    destinations,
    summary,
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
export function getTileInspection(gameState, x = null, y = null, zoneOrId = null) {
  const mapLike = gameState?.map || gameState || {};
  const resolvedZone = typeof zoneOrId === 'string'
    ? getZone(zoneOrId)
    : (zoneOrId && typeof zoneOrId === 'object' ? zoneOrId : getZone(mapLike.zoneId || mapLike.currentZoneId || 'greyhaven'));
  if (!resolvedZone) return null;

  const tx = Number.isInteger(x) ? x : (Number.isInteger(Number(mapLike.x)) ? Number(mapLike.x) : 0);
  const ty = Number.isInteger(y) ? y : (Number.isInteger(Number(mapLike.y)) ? Number(mapLike.y) : 0);

  const inspectCell = (cx, cy) => {
    const inBounds = Number.isInteger(cx) && Number.isInteger(cy)
      && cx >= 0 && cx < resolvedZone.width && cy >= 0 && cy < resolvedZone.height;
    const tile = inBounds
      ? getTileInfo(resolvedZone, cx, cy)
      : { id: 'edge', name: 'Map edge', walkable: false, glyph: ' ' };
    const passable = Boolean(inBounds && tile.walkable === true);
    let entity = null;
    if (inBounds) {
      const raw = getEntityAt(resolvedZone, mapLike, cx, cy);
      if (raw?.type === 'npc') {
        const label = raw.entity.role ? `${raw.entity.name} (${raw.entity.role})` : raw.entity.name;
        const briefing = getNpcBriefing(gameState, raw.entity, resolvedZone);
        entity = {
          kind: 'npc',
          id: raw.entity.id,
          name: raw.entity.name,
          role: raw.entity.role || '',
          status: 'Present',
          label,
          summary: briefing?.summary || label,
        };
      } else if (raw?.type === 'encounter') {
        const id = raw.entity.encounterId || raw.entity.id;
        const lockReason = encounterLockReason(mapLike, raw.entity, gameState);
        const locked = Boolean(lockReason);
        const label = locked ? 'Sealed challenge' : `Threat: ${raw.entity.name}`;
        const preview = locked ? null : getEncounterPreview(raw.entity.enemyId, gameState);
        entity = {
          kind: 'encounter',
          id: locked ? 'sealed_challenge' : id,
          name: locked ? 'Sealed challenge' : raw.entity.name,
          status: locked ? 'Locked' : 'Active',
          locked,
          label,
          summary: locked ? 'Sealed challenge · Locked' : (preview?.summary || label),
        };
      } else if (raw?.type === 'interactable') {
        const id = raw.entity.interactionId || raw.entity.id;
        const briefing = getInteractableBriefing(gameState, raw.entity, resolvedZone);
        entity = {
          kind: 'interactable',
          id,
          name: raw.entity.name,
          status: raw.entity.once ? 'Available' : 'Service',
          label: raw.entity.name,
          summary: briefing?.summary || raw.entity.name,
        };
      } else if (raw?.type === 'exit') {
        const briefing = getRouteBriefing(gameState, raw.entity.toZone);
        const status = !briefing?.unlocked ? 'Locked' : briefing?.visited ? 'Charted' : 'Uncharted';
        entity = {
          kind: 'exit',
          id: raw.entity.toZone,
          name: raw.entity.label,
          status,
          label: raw.entity.label,
          summary: briefing?.summary || raw.entity.label,
        };
      }
    }
    const cellSummary = `${tile.name} (${cx}, ${cy}) · ${passable ? 'Passable' : 'Blocked'}${entity ? ` · ${entity.label}` : ''}`;
    return {
      x: cx,
      y: cy,
      inBounds,
      tileName: tile.name,
      passable,
      entity,
      summary: cellSummary,
    };
  };

  const current = inspectCell(tx, ty);
  const neighbors = {
    north: inspectCell(tx, ty - 1),
    west: inspectCell(tx - 1, ty),
    east: inspectCell(tx + 1, ty),
    south: inspectCell(tx, ty + 1),
  };

  const dirOrder = [
    { key: 'north', dir: 'North' },
    { key: 'west', dir: 'West' },
    { key: 'east', dir: 'East' },
    { key: 'south', dir: 'South' },
  ];
  const adjacentLandmarks = [];
  for (const { key, dir } of dirOrder) {
    const cell = neighbors[key];
    if (cell?.entity) {
      adjacentLandmarks.push({
        dir,
        key,
        x: cell.x,
        y: cell.y,
        kind: cell.entity.kind,
        id: cell.entity.id,
        label: cell.entity.label,
        status: cell.entity.status,
        summary: cell.entity.summary || cell.entity.label,
      });
    }
  }

  const currentDesc = `${current.tileName} (${tx}, ${ty}) · ${current.passable ? 'Passable' : 'Blocked'}${current.entity ? ` · ${current.entity.label}` : ''}`;
  const adjDesc = adjacentLandmarks.length > 0
    ? `Adjacent: ${adjacentLandmarks.map((a) => `${a.dir} ${a.label}`).join(', ')}`
    : 'Adjacent: Clear';

  return {
    zoneId: resolvedZone.id,
    zoneName: resolvedZone.name,
    x: tx,
    y: ty,
    inBounds: current.inBounds,
    tileName: current.tileName,
    passable: current.passable,
    entity: current.entity,
    neighbors,
    adjacentLandmarks,
    summary: `${currentDesc} · ${adjDesc}`,
  };
}

/**
 * Pure read-only patrol briefing for a zone's roaming encounters.
 * Masks unscouted enemy identities and stats until defeated at least once in Bestiary.
 */
export function getPatrolBriefing(gameState, zoneOrId = null) {
  const mapLike = gameState?.map || gameState || {};
  const resolvedZone = typeof zoneOrId === 'string'
    ? getZone(zoneOrId)
    : (zoneOrId && typeof zoneOrId === 'object' ? zoneOrId : getZone(mapLike.zoneId || mapLike.currentZoneId || 'greyhaven'));
  if (!resolvedZone) return null;

  const rawEntries = Array.isArray(resolvedZone.randomEncounters) ? resolvedZone.randomEncounters : [];
  const encounterChance = getEffectiveRandomEncounterChance(gameState, resolvedZone);
  const encounterPercent = Math.round(encounterChance * 100);
  const totalWeight = rawEntries.reduce(
    (sum, entry) => sum + (typeof entry?.weight === 'number' && entry.weight > 0 ? entry.weight : 1),
    0,
  );

  const hostiles = rawEntries.map((entry) => {
    const weight = typeof entry?.weight === 'number' && entry.weight > 0 ? entry.weight : 1;
    const chance = totalWeight > 0 ? weight / totalWeight : 0;
    const percent = Math.round(chance * 100);
    const preview = getEncounterPreview(entry?.enemyId, gameState);
    const known = Boolean(preview?.known);
    return {
      enemyId: known ? (preview?.enemyId || entry.enemyId) : 'unscouted_hostile',
      name: known ? (preview?.name || entry.name || 'Hostile') : 'Unscouted hostile',
      known,
      weight,
      chance,
      percent,
      hp: known ? (preview?.hp ?? null) : null,
      tier: known ? (preview?.tier ?? null) : null,
    };
  });

  const scoutedCount = hostiles.filter((h) => h.known).length;
  const totalCount = hostiles.length;
  const summary = totalCount === 0
    ? `No roaming hostiles in ${resolvedZone.name}.`
    : `Step ambush: ${encounterPercent}% · Roaming (${scoutedCount}/${totalCount} scouted): ${hostiles
        .map((h) => (h.known ? `${h.name} (${h.percent}%, ${h.hp} HP)` : `Unscouted hostile (${h.percent}%)`))
        .join(', ')}`;

  return {
    zoneId: resolvedZone.id,
    zoneName: resolvedZone.name,
    hasHostiles: totalCount > 0,
    encounterChance,
    encounterPercent,
    scoutedCount,
    totalCount,
    hostiles,
    summary,
  };
}

export function getInteractableBriefing(gameState, interactableOrId, zoneOrId = null) {
  const mapLike = gameState && typeof gameState === 'object'
    ? (gameState.map && typeof gameState.map === 'object' ? gameState.map : gameState)
    : {};
  const resolvedZone = typeof zoneOrId === 'string'
    ? getZone(zoneOrId)
    : (zoneOrId && typeof zoneOrId === 'object'
      ? zoneOrId
      : getZone(mapLike.zoneId || mapLike.currentZoneId || gameState?.location || 'greyhaven'));
  if (!resolvedZone) return null;

  const inter = interactableOrId && typeof interactableOrId === 'object' && typeof interactableOrId.name === 'string'
    ? interactableOrId
    : (typeof interactableOrId === 'string' && interactableOrId
      ? (Array.isArray(resolvedZone.interactables) ? resolvedZone.interactables : []).find(
          (i) => (i.interactionId || i.id) === interactableOrId,
        )
      : null);
  if (!inter) return null;

  const completedInteractions = mapLike.completedInteractions && typeof mapLike.completedInteractions === 'object'
    ? mapLike.completedInteractions
    : {};
  const clearedEncounters = mapLike.clearedEncounters && typeof mapLike.clearedEncounters === 'object'
    ? mapLike.clearedEncounters
    : {};

  const id = inter.interactionId || inter.id;
  const name = inter.name;
  const kind = inter.kind || 'object';
  const once = Boolean(inter.once);
  const completed = Boolean(Object.prototype.hasOwnProperty.call(completedInteractions, id) && completedInteractions[id]);
  const requiresEncounterCleared = typeof inter.requiresEncounterCleared === 'string' && inter.requiresEncounterCleared
    ? inter.requiresEncounterCleared
    : null;
  const guardianCleared = !requiresEncounterCleared
    || Boolean(Object.prototype.hasOwnProperty.call(clearedEncounters, requiresEncounterCleared) && clearedEncounters[requiresEncounterCleared]);
  const guardianEnc = requiresEncounterCleared
    ? (Array.isArray(resolvedZone.encounters) ? resolvedZone.encounters : []).find(
        (e) => (e.encounterId || e.id) === requiresEncounterCleared,
      )
    : null;
  const guardianName = requiresEncounterCleared ? (guardianEnc?.name || 'guardian') : null;
  const status = once && completed
    ? 'Completed'
    : !guardianCleared
      ? 'Guarded'
      : once
        ? 'Available'
        : 'Service';
  const costGold = kind === 'inn' ? getInnCost(gameState, inter) : null;
  const canAfford = kind === 'inn' ? (Number(gameState?.gold) || 0) >= costGold : true;
  const rewardCount = kind === 'cache' && Array.isArray(inter.rewards)
    ? inter.rewards.reduce(
        (sum, r) => sum + (Number.isFinite(Number(r?.qty)) && Number(r.qty) > 0 ? Math.floor(Number(r.qty)) : 1),
        0,
      )
    : 0;

  let summary;
  if (once && completed) {
    summary = `${name} · Completed`;
  } else if (!guardianCleared) {
    summary = `${name} · Guarded by ${guardianName}`;
  } else if (kind === 'inn') {
    summary = `${name} · Rest for ${costGold}g (full HP & MP${canAfford ? '' : ', insufficient gold'})`;
  } else if (kind === 'shop') {
    summary = `${name} · Quartermaster & provisions`;
  } else if (kind === 'muster') {
    summary = `${name} · Party roster & equipment`;
  } else if (kind === 'cache') {
    summary = `${name} · Unopened cache (${rewardCount} ${rewardCount === 1 ? 'supply item' : 'supply items'})`;
  } else if (kind === 'dispatch') {
    summary = `${name} · Courier dispatch (unclaimed)`;
  } else if (kind === 'relic') {
    summary = `${name} · Expedition relic (ready to recover)`;
  } else if (kind === 'beacon' || kind === 'quest') {
    summary = `${name} · Expedition station`;
  } else {
    summary = `${name} · Field landmark`;
  }

  return {
    id,
    name,
    kind,
    x: inter.x,
    y: inter.y,
    once,
    completed,
    requiresEncounterCleared,
    guardianCleared,
    guardianName,
    status,
    costGold,
    canAfford,
    rewardCount,
    summary,
  };
}

/**
 * Pure, read-only helper returning a field contact briefing for a zone NPC.
 */
export function getNpcBriefing(gameState, npcOrId, zoneOrId = null) {
  const mapLike = gameState && typeof gameState === "object"
    ? (gameState.map && typeof gameState.map === "object" ? gameState.map : gameState)
    : {};
  const resolvedZone = typeof zoneOrId === "string"
    ? getZone(zoneOrId)
    : (zoneOrId && typeof zoneOrId === "object"
      ? zoneOrId
      : getZone(mapLike.zoneId || mapLike.currentZoneId || gameState?.location || "greyhaven"));
  if (!resolvedZone) return null;

  const npc = npcOrId && typeof npcOrId === "object" && typeof npcOrId.name === "string"
    ? npcOrId
    : (typeof npcOrId === "string" && npcOrId
      ? (Array.isArray(resolvedZone.npcs) ? resolvedZone.npcs : []).find((n) => n.id === npcOrId)
      : null);
  if (!npc) return null;

  const name = npc.name;
  const role = npc.role || "Field Contact";
  const defaultLine = typeof npc.defaultLine === "string" ? npc.defaultLine : "";
  const baseStory = createStoryState();
  const rawStory = gameState && typeof gameState === "object" && gameState.story && typeof gameState.story === "object"
    ? gameState.story
    : null;
  const storyState = rawStory
    ? {
        ...baseStory,
        ...rawStory,
        flags: { ...baseStory.flags, ...(rawStory.flags && typeof rawStory.flags === "object" ? rawStory.flags : {}) },
      }
    : baseStory;
  const liveDialogue = typeof npc.id === "string" && npc.id ? getDialogue(storyState, npc.id) : null;
  const line = typeof liveDialogue?.text === "string" && liveDialogue.text ? liveDialogue.text : defaultLine;
  const sameZone = (mapLike.zoneId || mapLike.currentZoneId || gameState?.location || "greyhaven") === resolvedZone.id;
  const px = Number(mapLike.x);
  const py = Number(mapLike.y);
  const distance = sameZone && Number.isFinite(px) && Number.isFinite(py)
    ? Math.abs(px - npc.x) + Math.abs(py - npc.y)
    : null;
  const adjacent = distance !== null && distance <= 1;
  const summary = line
    ? `${name} (${role}) · "${line}"`
    : `${name} (${role})`;

  return {
    id: npc.id,
    name,
    role,
    x: npc.x,
    y: npc.y,
    zoneId: resolvedZone.id,
    zoneName: resolvedZone.name,
    distance,
    adjacent,
    line,
    defaultLine,
    summary,
  };
}

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
  const isCurrentZone = (gameState?.map?.zoneId || gameState?.location || 'greyhaven') === resolvedZone.id;
  const originX = isCurrentZone && Number.isInteger(gameState?.map?.x)
    ? gameState.map.x
    : (resolvedZone.spawns?.default?.x ?? 0);
  const originY = isCurrentZone && Number.isInteger(gameState?.map?.y)
    ? gameState.map.y
    : (resolvedZone.spawns?.default?.y ?? 0);

  const npcs = (Array.isArray(resolvedZone.npcs) ? resolvedZone.npcs : []).map((n) => ({
    id: n.id,
    name: n.name,
    role: n.role || '',
    x: n.x,
    y: n.y,
    distance: Math.abs(n.x - originX) + Math.abs(n.y - originY),
    bearing: getCompassBearing(originX, originY, n.x, n.y).bearing,
    summary: getNpcBriefing(gameState, n, resolvedZone)?.summary || n.name,
  }));

  const encounters = (Array.isArray(resolvedZone.encounters) ? resolvedZone.encounters : []).map((e) => {
    const id = e.encounterId || e.id;
    const cleared = Boolean(clearedEncounters[id]);
    const lockReason = cleared ? null : encounterLockReason(mapLike, e, gameState);
    const unlocked = !lockReason;
    const status = cleared ? 'Cleared' : unlocked ? 'Active' : 'Locked';
    const isLocked = status === 'Locked';
    const preview = isLocked ? null : getEncounterPreview(e.enemyId, gameState);
    const summary = isLocked
      ? 'Sealed challenge · Locked'
      : preview?.summary
        ? `${e.name} · ${status} — ${preview.summary}`
        : `${e.name} · ${status}`;
    return {
      id: isLocked ? 'sealed_challenge' : id,
      name: isLocked ? 'Sealed challenge' : e.name,
      x: e.x,
      y: e.y,
      distance: Math.abs(e.x - originX) + Math.abs(e.y - originY),
      bearing: getCompassBearing(originX, originY, e.x, e.y).bearing,
      cleared,
      unlocked,
      lockReason: lockReason || null,
      status,
      summary,
    };
  });

  const interactables = (Array.isArray(resolvedZone.interactables) ? resolvedZone.interactables : []).map((inter) => {
    const id = inter.interactionId || inter.id;
    const completed = Boolean(Object.prototype.hasOwnProperty.call(completedInteractions, id) && completedInteractions[id]);
    const once = Boolean(inter.once);
    const status = once ? (completed ? 'Completed' : 'Available') : 'Service';
    const briefing = getInteractableBriefing(gameState, inter, resolvedZone);
    return {
      id,
      name: inter.name,
      kind: inter.kind || 'object',
      once,
      x: inter.x,
      y: inter.y,
      distance: Math.abs(inter.x - originX) + Math.abs(inter.y - originY),
      bearing: getCompassBearing(originX, originY, inter.x, inter.y).bearing,
      completed,
      guardianCleared: briefing ? briefing.guardianCleared : true,
      guardianName: briefing ? briefing.guardianName : null,
      status,
      summary: briefing?.summary || inter.name,
    };
  });

  const exits = (Array.isArray(resolvedZone.exits) ? resolvedZone.exits : []).map((ex) => {
    const briefing = getRouteBriefing(gameState, ex.toZone);
    return {
      toZone: ex.toZone,
      label: ex.label,
      x: ex.x,
      y: ex.y,
      distance: Math.abs(ex.x - originX) + Math.abs(ex.y - originY),
      bearing: getCompassBearing(originX, originY, ex.x, ex.y).bearing,
      visited: Boolean(briefing?.visited),
      unlocked: Boolean(briefing?.unlocked),
      summary: briefing?.summary || ex.label,
    };
  });

  const counts = {
    total: npcs.length + encounters.length + interactables.length + exits.length,
    npcs: npcs.length,
    encountersActive: encounters.filter((e) => e.status === 'Active').length,
    encountersCleared: encounters.filter((e) => e.status === 'Cleared').length,
    encountersLocked: encounters.filter((e) => e.status === 'Locked').length,
    interactablesAvailable: interactables.filter((i) => i.status === 'Available').length,
    interactablesCompleted: interactables.filter((i) => i.status === 'Completed').length,
    interactablesService: interactables.filter((i) => i.status === 'Service').length,
    exitsCharted: exits.filter((x) => x.unlocked && x.visited).length,
    exitsUncharted: exits.filter((x) => x.unlocked && !x.visited).length,
    exitsLocked: exits.filter((x) => !x.unlocked).length,
  };
  const summaryParts = [];
  if (counts.npcs > 0) summaryParts.push(`${counts.npcs} ${counts.npcs === 1 ? 'contact' : 'contacts'}`);
  if (encounters.length > 0) {
    summaryParts.push(`Threats: ${counts.encountersActive} active, ${counts.encountersCleared} cleared${counts.encountersLocked > 0 ? `, ${counts.encountersLocked} locked` : ''}`);
  }
  if (interactables.length > 0) {
    const interParts = [];
    if (counts.interactablesAvailable > 0) interParts.push(`${counts.interactablesAvailable} available`);
    if (counts.interactablesCompleted > 0) interParts.push(`${counts.interactablesCompleted} completed`);
    if (counts.interactablesService > 0) interParts.push(`${counts.interactablesService} ${counts.interactablesService === 1 ? 'service' : 'services'}`);
    summaryParts.push(`Stations: ${interParts.join(', ')}`);
  }
  if (exits.length > 0) {
    summaryParts.push(`Routes: ${counts.exitsCharted} charted, ${counts.exitsUncharted} uncharted${counts.exitsLocked > 0 ? `, ${counts.exitsLocked} locked` : ''}`);
  }
  const summary = summaryParts.join(' · ');

  return {
    zoneId: resolvedZone.id,
    name: resolvedZone.name,
    originX,
    originY,
    npcs,
    encounters,
    interactables,
    exits,
    counts,
    summary,
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
        briefing: getNpcBriefing(gameState, npc, zone),
      });
    }
  }

  for (const enc of zone.encounters || []) {
    const encId = enc.encounterId || enc.id;
    if (!mapState.clearedEncounters[encId] && isNear(enc.x, enc.y)) {
      const locked = Boolean(encounterLockReason(mapState, enc, gameState));
      actions.push({
        kind: 'encounter',
        id: encId,
        enemyId: locked ? 'sealed_challenge' : enc.enemyId,
        label: locked ? 'Engage Sealed challenge' : `Engage ${enc.name}`,
        locked,
        entity: enc,
        preview: locked ? null : getEncounterPreview(enc.enemyId, gameState),
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
        briefing: getInteractableBriefing(gameState, inter, zone),
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
      patrol: getPatrolBriefing(gameState, zone),
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
    const cleared = Boolean(clearedMap[encId]);
    const locked = !cleared && Boolean(encounterLockReason(mapState, enc, gameState));
    const preview = locked ? null : getEncounterPreview(enc.enemyId, gameState);
    return {
      id: locked ? 'sealed_challenge' : encId,
      name: locked ? 'Sealed challenge' : enc.name,
      enemyId: locked ? 'sealed_challenge' : enc.enemyId,
      x: enc.x,
      y: enc.y,
      cleared,
      locked,
      preview,
      summary: locked ? 'Sealed challenge · Locked' : (preview?.summary || enc.name),
    };
  });
  const roamingEncounters = (resolvedZone.randomEncounters || []).map((entry) => ({
    enemyId: entry.enemyId,
    weight: typeof entry.weight === 'number' && entry.weight > 0 ? entry.weight : 1,
    preview: getEncounterPreview(entry.enemyId, gameState),
  }));
  const dangerLevel = resolvedZone.dangerLevel ?? 0;
  const fixedActiveCount = fixedEncounters.filter((e) => !e.cleared && !e.locked).length;
  const fixedClearedCount = fixedEncounters.filter((e) => e.cleared).length;
  const fixedLockedCount = fixedEncounters.filter((e) => e.locked).length;
  const fixedTotalCount = fixedEncounters.length;
  const roamingCount = roamingEncounters.length;
  const roamingScoutedCount = roamingEncounters.filter((r) => Boolean(r.preview?.known)).length;
  const encounterChance = getEffectiveRandomEncounterChance(gameState, resolvedZone);
  const encounterPercent = Math.round(encounterChance * 100);

  let summary;
  if (fixedTotalCount === 0 && roamingCount === 0) {
    summary = 'Safe haven · No fixed threats or roaming hostiles';
  } else {
    const parts = [`Danger ${dangerLevel}`];
    if (fixedTotalCount > 0) {
      parts.push(
        `Fixed threats: ${fixedActiveCount} active, ${fixedClearedCount} cleared${fixedLockedCount > 0 ? `, ${fixedLockedCount} locked` : ''}`,
      );
    }
    if (roamingCount > 0) {
      parts.push(`Roaming: ${roamingScoutedCount}/${roamingCount} scouted (${encounterPercent}% ambush)`);
    }
    summary = parts.join(' · ');
  }

  return {
    zoneId: resolvedZone.id,
    zoneName: resolvedZone.name,
    dangerLevel,
    fixedActiveCount,
    fixedClearedCount,
    fixedLockedCount,
    fixedTotalCount,
    roamingCount,
    roamingScoutedCount,
    encounterChance,
    encounterPercent,
    fixedEncounters,
    roamingEncounters,
    summary,
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

export function getSafePathPreview(gameState, targetX, targetY, zoneOrId = null) {
  const resolvedZone =
    typeof zoneOrId === 'string'
      ? getZone(zoneOrId)
      : zoneOrId && typeof zoneOrId === 'object'
        ? zoneOrId
        : getZone(gameState?.map?.zoneId || gameState?.location || 'greyhaven');
  if (!resolvedZone) return null;
  const tx = Number(targetX);
  const ty = Number(targetY);
  if (
    !Number.isInteger(tx) ||
    !Number.isInteger(ty) ||
    tx < 0 ||
    tx >= resolvedZone.width ||
    ty < 0 ||
    ty >= resolvedZone.height
  ) {
    return null;
  }

  const spawn = resolvedZone.spawns?.default || { x: 0, y: 0 };
  const rawMap = gameState?.map && typeof gameState.map === 'object' ? gameState.map : null;
  const mapState = rawMap
    ? {
        ...rawMap,
        zoneId: rawMap.zoneId || resolvedZone.id,
        x: Number.isInteger(Number(rawMap.x)) ? Number(rawMap.x) : spawn.x,
        y: Number.isInteger(Number(rawMap.y)) ? Number(rawMap.y) : spawn.y,
        visitedZones: rawMap.visitedZones || { [resolvedZone.id]: true },
        clearedEncounters: rawMap.clearedEncounters || {},
        completedInteractions: rawMap.completedInteractions || {},
      }
    : {
        zoneId: resolvedZone.id,
        x: spawn.x,
        y: spawn.y,
        visitedZones: { [resolvedZone.id]: true },
        clearedEncounters: {},
        completedInteractions: {},
      };

  const startX = Number(mapState.x);
  const startY = Number(mapState.y);
  const tile = getTileInfo(resolvedZone, tx, ty);
  const hasRandomEncounters =
    Array.isArray(resolvedZone.randomEncounters) && resolvedZone.randomEncounters.length > 0;
  const encounterChance = hasRandomEncounters
    ? getEffectiveRandomEncounterChance(gameState, resolvedZone)
    : 0;
  const encounterPercent = Math.round(encounterChance * 100);

  if (tx === startX && ty === startY) {
    return {
      zoneId: resolvedZone.id,
      x: tx,
      y: ty,
      tileId: tile.id,
      tileName: tile.name,
      walkable: Boolean(tile.walkable),
      reachable: true,
      steps: 0,
      effectiveSteps: 0,
      pausesNearThreat: false,
      cautionThreatName: null,
      encounterChance,
      encounterPercent,
      status: 'Current position',
      summary: `${tile.name} (${tx}, ${ty}) · Current position`,
    };
  }

  if (!tile.walkable) {
    return {
      zoneId: resolvedZone.id,
      x: tx,
      y: ty,
      tileId: tile.id,
      tileName: tile.name,
      walkable: false,
      reachable: false,
      steps: null,
      effectiveSteps: null,
      pausesNearThreat: false,
      cautionThreatName: null,
      encounterChance: 0,
      encounterPercent: 0,
      status: 'Blocked terrain',
      summary: `${tile.name} (${tx}, ${ty}) · Blocked terrain`,
    };
  }

  const effectiveState = gameState ? { ...gameState, map: mapState } : { map: mapState };
  const path = findSafePath(resolvedZone, mapState, tx, ty, effectiveState);
  if (!path || path.length === 0) {
    const destExit = (resolvedZone.exits || []).find((ex) => ex.x === tx && ex.y === ty);
    const destEnc = (resolvedZone.encounters || []).find(
      (e) => e.x === tx && e.y === ty && !mapState.clearedEncounters?.[e.encounterId || e.id]
    );
    const isLocked = Boolean(
      zoneLockReason(effectiveState, ZONES[destExit?.toZone]) ||
        encounterLockReason(mapState, destEnc, effectiveState)
    );
    const status = isLocked ? 'Locked destination' : 'No clear safe route';
    return {
      zoneId: resolvedZone.id,
      x: tx,
      y: ty,
      tileId: tile.id,
      tileName: tile.name,
      walkable: true,
      reachable: false,
      steps: null,
      effectiveSteps: null,
      pausesNearThreat: false,
      cautionThreatName: null,
      encounterChance,
      encounterPercent,
      status,
      summary: `${tile.name} (${tx}, ${ty}) · ${status}`,
    };
  }

  const steps = path.length;
  const maxSteps = 16;
  let effectiveSteps = Math.min(steps, maxSteps);
  let pausesNearThreat = false;
  let cautionThreatName = null;

  if (steps > 1) {
    for (let i = 0; i < Math.min(steps, maxSteps); i += 1) {
      const isLastStep = i === steps - 1;
      if (!isLastStep) {
        const step = path[i];
        const adjacentThreat = (resolvedZone.encounters || []).find(
          (e) =>
            !mapState.clearedEncounters?.[e.encounterId || e.id] &&
            !(e.x === tx && e.y === ty) &&
            isAdjacentOrOn(step.x, step.y, e.x, e.y)
        );
        if (adjacentThreat) {
          effectiveSteps = i + 1;
          pausesNearThreat = true;
          cautionThreatName = encounterLockReason(mapState, adjacentThreat, effectiveState)
            ? 'Sealed challenge'
            : adjacentThreat.name;
          break;
        }
      }
    }
  }

  const stepPart = `Safe route: ${steps} ${steps === 1 ? 'step' : 'steps'}${
    pausesNearThreat ? ` (pauses at step ${effectiveSteps} near ${cautionThreatName})` : ''
  }`;
  const ambushPart = encounterPercent > 0 ? ` · Step ambush: ${encounterPercent}%` : '';
  const summary = `${tile.name} (${tx}, ${ty}) · ${stepPart}${ambushPart}`;

  return {
    zoneId: resolvedZone.id,
    x: tx,
    y: ty,
    tileId: tile.id,
    tileName: tile.name,
    walkable: true,
    reachable: true,
    steps,
    effectiveSteps,
    pausesNearThreat,
    cautionThreatName,
    encounterChance,
    encounterPercent,
    status: 'Safe route',
    summary,
  };
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
