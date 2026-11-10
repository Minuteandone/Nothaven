import { renderPinnedQuest } from './pinnedQuest.js';
import { getItem, isKnownItem, TYPES } from '../items/items.js';
import { listRecipes, recipeInputsMet, recipeSummary } from '../items/crafting.js';
import { getEncounterPreview, getExpeditionLogSummary, getEntityAt, getExpeditionProgressSummary, getFieldConsumablePreview, getFieldCraftPreview, getFieldPackSummary, getFieldServicesSummary, getFrontierAtlas, getFrontierWeatherSummary, getFrontierPatrolSummary, getFrontierContactsSummary, getFrontierCachesSummary, getFrontierRoutesSummary, getFrontierStationsSummary, getFrontierThreatsSummary, getInteractableBriefing, getNearbyActionsSummary, getNpcBriefing, getPartyFieldReadiness, getPatrolBriefing, getFastTravelBriefing, getRouteBriefing, getSafePathPreview, getTileInfo, getTileInspection, getZoneChecklist, getZoneCompassHint, getZoneExitsSummary, getZoneContactsSummary, getZoneStationsSummary, getZoneCachesSummary, getZoneThreatIntel, getZoneVantage, getZoneWeatherBriefing } from '../map/mapState.js';
import { ZONES } from '../map/zones.js';
import { escapeHTML, icon, partyStatus, resourceChip, sceneHeader, uiButton } from './components.js';
import { zoneVista } from './zoneArt.js';
import { bountyFieldText } from '../core/bounties.js';

const EXPEDITION_LOG_RECENT_LIMIT = 6;
const EXPEDITION_LOG_EXPANDED_LIMIT = 20;

function safeClass(value) {
  return String(value || '').replace(/[^a-z0-9_-]/gi, '');
}

function fieldPack(inventory, party = []) {
  const stacks = Array.isArray(inventory) ? inventory.filter(stack => stack && stack.qty > 0) : [];
  const summaries = [];
  const consumables = [];
  const companions = Array.isArray(party) ? party.slice(1) : [];
  const crafts = listRecipes()
    .filter(recipe => recipeInputsMet(stacks, recipe).ok)
    .map(recipe => {
      const craftPreview = getFieldCraftPreview({ inventory, party }, recipe.id);
      const craftTitle = craftPreview?.summary || recipeSummary(recipe);
      return `<button type="button" class="action-button action-button--ghost" data-action="craftFieldItem" data-arg="${escapeHTML(recipe.id)}" title="${escapeHTML(craftTitle)}">${icon('focus')}<span>Craft: ${escapeHTML(recipe.name)}</span></button>`;
    });

  for (const stack of stacks) {
    const item = isKnownItem(stack.id) ? getItem(stack.id) : { id: stack.id, name: stack.id };
    summaries.push(`<li title="${escapeHTML(item.description || item.name)}"><span>${escapeHTML(item.name)} ×${Math.max(0, Number(stack.qty) || 0)}</span></li>`);
    if (item.type === TYPES.CONSUMABLE) {
      const itemTitle = item.description || item.name;
      const heroPreview = getFieldConsumablePreview({ inventory, party }, item.id, 0);
      consumables.push(uiButton({
        action: 'useFieldItem',
        arg: item.id,
        label: `Use ${item.name} (${stack.qty})`,
        iconName: 'heart',
        variant: 'ghost',
        title: heroPreview?.summary || itemTitle,
      }));
      companions.forEach((ally, idx) => {
        if (!ally) return;
        const targetIdx = idx + 1;
        const allyPreview = getFieldConsumablePreview({ inventory, party }, item.id, targetIdx);
        consumables.push(uiButton({
          action: 'useFieldItem',
          arg: `${item.id}:${targetIdx}`,
          label: `Use ${item.name} → ${ally.name || `Ally ${targetIdx}`}`,
          iconName: 'heart',
          variant: 'ghost',
          title: allyPreview?.summary || itemTitle,
        }));
      });
    }
  }

  const readiness = getPartyFieldReadiness({ inventory, party });
  const packSummary = getFieldPackSummary({ inventory, party });
  return `<section class="field-pack" aria-labelledby="field-pack-title">
    <h3 id="field-pack-title">${icon('bag')}Field Pack:</h3>
    <p class="quiet-note field-pack__readiness">${escapeHTML(readiness.summary)}</p>
    <p class="quiet-note field-pack__summary">${escapeHTML(packSummary.summary)}</p>
    ${stacks.length
      ? `<ul class="field-pack__items">${summaries.join('')}</ul>${consumables.length ? `<div class="field-pack__actions">${consumables.join('')}</div>` : ''}${crafts.length ? `<div class="field-pack__actions"><strong class="field-pack__label">Craft Ready:</strong>${crafts.join('')}</div>` : ''}`
      : '<p class="quiet-note">No supplies packed. Visit Hesta in Greyhaven to prepare.</p>'}
  </section>`;
}

function mapGrid(zone, mapState, state = null) {
  const rows = [];
  for (let y = 0; y < zone.height; y += 1) {
    const cells = [];
    for (let x = 0; x < zone.width; x += 1) {
      const isPlayer = mapState.x === x && mapState.y === y;
      const entityInfo = getEntityAt(zone, mapState, x, y);
      const tile = getTileInfo(zone, x, y);
      let symbol = tile.glyph;
      let cellClass = `map-cell tile-${safeClass(tile.id)}`;
      let label = `${tile.name}, column ${x + 1}, row ${y + 1}`;
      let cellTitle = label;

      if (entityInfo) {
        cellClass += ` entity-${safeClass(entityInfo.type)}`;
        if (entityInfo.type === 'npc') {
          symbol = entityInfo.entity.symbol || 'N';
          label = `${entityInfo.entity.name}, ${entityInfo.entity.role}`;
          const briefing = getNpcBriefing(state ? { ...state, map: mapState } : { map: mapState }, entityInfo.entity, zone);
          cellTitle = briefing?.summary || label;
        } else if (entityInfo.type === 'encounter') {
          symbol = entityInfo.entity.symbol || '!';
          const cellInspection = getTileInspection(state ? { ...state, map: mapState } : { map: mapState }, x, y, zone);
          if (cellInspection?.entity?.locked) {
            label = 'Sealed challenge';
            cellTitle = cellInspection.entity.summary || 'Sealed challenge · Locked';
          } else {
            label = `Threat: ${entityInfo.entity.name}`;
            const preview = getEncounterPreview(entityInfo.entity.enemyId, state);
            cellTitle = preview?.summary ? `${label} — ${preview.summary}` : label;
          }
        } else if (entityInfo.type === 'interactable') {
          symbol = entityInfo.entity.symbol || '?';
          label = entityInfo.entity.name;
          const briefing = getInteractableBriefing(state ? { ...state, map: mapState } : { map: mapState }, entityInfo.entity, zone);
          cellTitle = briefing?.summary || label;
        } else if (entityInfo.type === 'exit') {
          symbol = '╬';
          label = entityInfo.entity.label;
          const briefing = getRouteBriefing(state ? { ...state, map: mapState } : { map: mapState }, entityInfo.entity.toZone);
          cellTitle = briefing?.summary ? `${label} — ${briefing.summary}` : label;
        }
      } else if (!isPlayer) {
        const pathPreview = getSafePathPreview(state ? { ...state, map: mapState } : { map: mapState }, x, y, zone);
        cellTitle = pathPreview?.summary || label;
      }

      if (isPlayer) {
        symbol = '@';
        cellClass += ' map-player';
        label = `Wren, your position, column ${x + 1}, row ${y + 1}`;
        const playerInspection = getTileInspection(state ? { ...state, map: mapState } : { map: mapState }, x, y, zone);
        cellTitle = playerInspection?.summary ? `${label} — ${playerInspection.summary}` : label;
      }

      cells.push(`<span class="${cellClass}" role="gridcell" aria-label="${escapeHTML(label)}"${isPlayer ? ' aria-current="location"' : ''} title="${escapeHTML(cellTitle)}" data-x="${x}" data-y="${y}"><span aria-hidden="true">${escapeHTML(symbol)}</span></span>`);
    }
    rows.push(`<div class="map-row" role="row">${cells.join('')}</div>`);
  }

  return `<div class="map-frame">
    <div class="map-grid" role="grid" aria-label="${escapeHTML(zone.name)} map" aria-rowcount="${zone.height}" aria-colcount="${zone.width}" style="--map-columns:${zone.width}">${rows.join('')}</div>
  </div>`;
}

const NEARBY_ACTION_TYPES = Object.freeze({
  talk: { name: 'mapTalk', iconName: 'journal' },
  encounter: { name: 'mapEncounter', iconName: 'sword', variant: 'danger' },
  patrol: { name: 'mapPatrol', iconName: 'sword', variant: 'secondary' },
  interact: { name: 'mapInteract', iconName: 'bag', variant: 'primary' },
  exit: { name: 'mapTravel', iconName: 'compass', variant: 'primary' },
});

function keyHint(key) {
  return `<kbd class="key-hint" aria-hidden="true">${escapeHTML(key)}</kbd>`;
}

function nearbyActionButton(action, index, characterShortcuts) {
  const type = NEARBY_ACTION_TYPES[action.kind];
  if (!type) return '';
  const shortcut = characterShortcuts && index < 9 ? String(index + 1) : null;
  const tooltipText = action.kind === 'encounter'
    ? (action.locked ? 'Sealed challenge · Locked' : action.preview?.summary)
    : action.kind === 'exit' || action.kind === 'interact' || action.kind === 'talk'
      ? action.briefing?.summary
      : action.kind === 'patrol'
        ? action.patrol?.summary
        : '';
  const titleAttr = tooltipText ? ` title="${escapeHTML(tooltipText)}"` : '';
  return `<button type="button" class="action-button action-button--${type.variant || 'secondary'} nearby-action" data-action="${escapeHTML(type.name)}" data-arg="${escapeHTML(action.id)}"${titleAttr}${shortcut ? ` aria-keyshortcuts="${shortcut}"` : ''}>
    ${icon(type.iconName)}<span>${escapeHTML(action.label)}</span>${shortcut ? keyHint(shortcut) : ''}
  </button>`;
}

function movementButton(action, label, key, arrow, className, characterShortcuts, title = null) {
  const shortcuts = {
    moveNorth: 'W ArrowUp', moveWest: 'A ArrowLeft', moveEast: 'D ArrowRight',
    moveSouth: 'S ArrowDown', waitTurn: 'E',
  };
  const binding = characterShortcuts ? shortcuts[action] : (shortcuts[action].split(' ')[1] || '');
  const titleAttr = title ? ` title="${escapeHTML(title)}"` : '';
  return `<button type="button" class="action-button movement-button ${className}" data-action="${action}" aria-label="${action === 'waitTurn' ? 'Survey Area' : `Move ${label}`}" ${binding ? `aria-keyshortcuts="${binding}"` : ''}${titleAttr}>
    <span class="movement-button__arrow" aria-hidden="true">${arrow}</span><span>${label}</span>${characterShortcuts ? `<kbd aria-hidden="true">${key}</kbd>` : ''}
  </button>`;
}

export function compassTargetLine(targetSummary, label = '') {
  return typeof targetSummary === 'string' && targetSummary && targetSummary !== label
    ? `<p class="quiet-note terrain-compass__target">Target briefing: ${escapeHTML(targetSummary)}</p>`
    : '';
}

export function compassRouteLine(routeSummary) {
  return typeof routeSummary === 'string' && routeSummary
    ? `<p class="quiet-note terrain-compass__route">${escapeHTML(routeSummary)}</p>`
    : '';
}

export function zoneWeatherLine(weatherSummary) {
  return typeof weatherSummary === 'string' && weatherSummary
    ? `<p class="quiet-note zone-weather-summary">${escapeHTML(weatherSummary)}</p>`
    : '';
}

export function zoneVantageLine(vantage) {
  if (!vantage || typeof vantage !== 'object' || typeof vantage.landmark !== 'string' || !vantage.landmark) {
    return '';
  }
  const prog = vantage.progress;
  const reconText = prog && prog.totalObjectives > 0
    ? `${prog.percent}% recon (${prog.encountersCleared}/${prog.encountersTotal} threats, ${prog.cachesOpened}/${prog.cachesTotal} caches)`
    : 'Safe haven';
  const elevation = Number.isFinite(Number(vantage.elevation)) ? Number(vantage.elevation) : 0;
  const parts = [
    `Vantage: ${vantage.landmark} (${elevation}m)`,
    reconText,
  ];
  if (typeof vantage.surveyNote === 'string' && vantage.surveyNote) {
    parts.push(vantage.surveyNote);
  }
  return `<p class="zone-checklist__vantage">${escapeHTML(parts.join(' · '))}</p>`;
}

function terrainCompass(zone, mapState, characterShortcuts, state = null) {
  const x = Number(mapState?.x);
  const y = Number(mapState?.y);
  const terrainAt = (tx, ty) => {
    const inside = Number.isInteger(tx) && Number.isInteger(ty)
      && tx >= 0 && tx < zone.width && ty >= 0 && ty < zone.height;
    const tile = getTileInfo(zone, tx, ty);
    return { name: inside ? tile.name : 'Map edge', passable: inside && tile.walkable === true };
  };
  const current = terrainAt(x, y);
  const directions = [
    { id: 'north', label: 'North', key: 'W', dx: 0, dy: -1 },
    { id: 'west', label: 'West', key: 'A', dx: -1, dy: 0 },
    { id: 'east', label: 'East', key: 'D', dx: 1, dy: 0 },
    { id: 'south', label: 'South', key: 'S', dx: 0, dy: 1 },
  ];
  const effectiveState = state ? { ...state, map: mapState } : { map: mapState };
  const inspection = getTileInspection(effectiveState, x, y, zone);
  const items = directions.map(direction => {
    const tx = x + direction.dx;
    const ty = y + direction.dy;
    const terrain = terrainAt(tx, ty);
    const neighborCell = inspection?.neighbors?.[direction.id];
    const rowTitle = neighborCell?.summary || `${terrain.name} (${tx}, ${ty}) · ${terrain.passable ? 'Passable' : 'Blocked'}`;
    return `<li data-direction="${direction.id}" data-passable="${terrain.passable}" title="${escapeHTML(rowTitle)}">
      <span class="terrain-compass__direction">${direction.label}${characterShortcuts ? keyHint(direction.key) : ''}</span>
      <span class="terrain-compass__terrain"><strong>${escapeHTML(terrain.name)}</strong><small>${escapeHTML(`${tx}, ${ty}`)} · ${terrain.passable ? 'Passable' : 'Blocked'}</small></span>
    </li>`;
  }).join('');
  const compassHint = getZoneCompassHint(effectiveState, zone);
  const bearingTitle = compassHint
    ? (compassHint.targetSummary && compassHint.targetSummary !== compassHint.label
      ? `${compassHint.summary} — ${compassHint.targetSummary}`
      : compassHint.summary)
    : '';
  const bearingLine = compassHint
    ? `<p class="terrain-compass__bearing"${bearingTitle ? ` title="${escapeHTML(bearingTitle)}"` : ''}>Compass bearing: <strong>${escapeHTML(compassHint.label)}</strong> (${escapeHTML(compassHint.bearing)}, ${compassHint.distance} ${compassHint.distance === 1 ? 'tile' : 'tiles'})</p>`
    : '';
  const targetLine = compassTargetLine(compassHint?.targetSummary, compassHint?.label);
  const routeLine = compassRouteLine(compassHint?.routeSummary);
  const waysLine = inspection?.waysSummary
    ? `<p class="quiet-note terrain-compass__ways">${escapeHTML(inspection.waysSummary)}</p>`
    : '';
  const adjacentLine = inspection?.adjacentLandmarks?.length
    ? `<p class="terrain-compass__adjacent">Adjacent landmarks: ${inspection.adjacentLandmarks.map(a => `<strong>${escapeHTML(a.dir)}:</strong> ${escapeHTML(a.label)}`).join(' · ')}</p>`
    : '';
  return `<section class="terrain-compass" aria-labelledby="terrain-compass-title">
    <div class="terrain-compass__heading"><h3 id="terrain-compass-title">Terrain compass</h3><p>Standing on <strong>${escapeHTML(current.name)}</strong> at ${escapeHTML(`${x}, ${y}`)}.</p>${bearingLine}${targetLine}${routeLine}${waysLine}${adjacentLine}</div>
    <ul aria-label="Adjacent terrain and passability">${items}</ul>
  </section>`;
}

function explorationShortcutGuide(characterShortcuts) {
  return `<details class="shortcut-guide exploration-shortcuts"><summary>Explorer keyboard commands</summary>
    ${characterShortcuts ? `<dl class="shortcut-guide__grid">
      <div><dt><kbd>WASD</kbd></dt><dd>Move one tile; arrow keys work too.</dd></div>
      <div><dt><kbd>E</kbd></dt><dd>Survey the tile beneath you.</dd></div>
      <div><dt><kbd>1–9</kbd></dt><dd>Choose a nearby action by its visible number.</dd></div>
      <div><dt><kbd>Tab</kbd></dt><dd>Move through controls; Enter or Space activates.</dd></div>
    </dl>` : `<p>Letter and number shortcuts are off. Use arrow keys to move, or Tab then Enter or Space to activate buttons.</p>`}
    <p>Turn letter and number shortcuts on or off in Display settings. Movement, E and numbered shortcuts pause while typing, using modifier keys, or viewing Display settings. Unavailable actions never activate.</p>
  </details>`;
}

function frontierAtlasPanel(state, zone, mapState) {
  const effectiveMap = mapState
    ? { ...mapState, zoneId: mapState.zoneId || zone?.id || 'greyhaven' }
    : { zoneId: zone?.id || 'greyhaven' };
  const atlas = getFrontierAtlas(state ? { ...state, map: effectiveMap } : { map: effectiveMap });
  const visitedEntries = atlas.zones.filter(entry => entry.visited);
  const unvisitedCount = Math.max(0, atlas.zonesTotal - atlas.zonesVisited);
  const items = visitedEntries.map(entry => {
    const reconText = entry.totalObjectives > 0
      ? `${entry.percent}% recon (${entry.encountersCleared}/${entry.encountersTotal} threats, ${entry.cachesOpened}/${entry.cachesTotal} caches)`
      : 'Safe haven';
    const routesText = entry.connectedNames.length > 0
      ? `Routes: ${entry.connectedNames.join(', ')}`
      : 'No outbound routes';
    const rowTitle = entry.summary || `${entry.name} · ${entry.conditionName} · ${reconText} · ${routesText}`;
    return `<li data-zone-id="${escapeHTML(entry.zoneId)}" data-current="${entry.isCurrent}" title="${escapeHTML(rowTitle)}"><strong>${escapeHTML(entry.name)}</strong>${entry.isCurrent ? ' <em>(Current)</em>' : ''} · ${escapeHTML(entry.conditionName)} · ${escapeHTML(reconText)} · ${escapeHTML(routesText)}</li>`;
  }).join('');
  const unchartedLine = unvisitedCount > 0
    ? `<p class="frontier-atlas__uncharted">${unvisitedCount} frontier ${unvisitedCount === 1 ? 'region remains' : 'regions remain'} uncharted.</p>`
    : '<p class="frontier-atlas__uncharted">All frontier regions charted.</p>';
  const effectiveState = state ? { ...state, map: effectiveMap } : { map: effectiveMap };
  const services = getFieldServicesSummary(effectiveState);
  const expedition = getExpeditionProgressSummary(effectiveState);
  const threats = getFrontierThreatsSummary(effectiveState);
  const weather = getFrontierWeatherSummary(effectiveState);
  const patrols = getFrontierPatrolSummary(effectiveState);
  const contacts = getFrontierContactsSummary(effectiveState);
  const stationsSummary = getFrontierStationsSummary(effectiveState);
  const cachesSummary = getFrontierCachesSummary(effectiveState);
  const routesSummary = getFrontierRoutesSummary(effectiveState);
  const actsTooltip = expedition.acts.map(act => act.summary).join(' | ');
  const totalsLine = `<p class="frontier-atlas__totals">Total threats cleared: ${atlas.totalEncountersCleared}/${atlas.totalEncounters} · Caches opened: ${atlas.totalCachesOpened}/${atlas.totalCaches}</p>`;
  const actsLine = `<p class="frontier-atlas__acts" title="${escapeHTML(actsTooltip)}">${escapeHTML(expedition.summary)}</p>`;
  const threatsLine = `<p class="frontier-atlas__threats">${escapeHTML(threats.summary)}</p>`;
  const weatherLine = `<p class="frontier-atlas__weather">${escapeHTML(weather.summary)}</p>`;
  const patrolsLine = `<p class="frontier-atlas__patrols">${escapeHTML(patrols.summary)}</p>`;
  const contactsLine = `<p class="frontier-atlas__contacts">${escapeHTML(contacts.summary)}</p>`;
  const stationsLine = `<p class="frontier-atlas__stations">${escapeHTML(stationsSummary.summary)}</p>`;
  const cachesLine = `<p class="frontier-atlas__caches">${escapeHTML(cachesSummary.summary)}</p>`;
  const routesLine = `<p class="frontier-atlas__routes">${escapeHTML(routesSummary.summary)}</p>`;
  const servicesLine = `<p class="frontier-atlas__services">${escapeHTML(services.summary)}</p>`;
  const packLine = `<p class="frontier-atlas__pack">${escapeHTML(services.packSummary)}</p>`;
  return `<details class="shortcut-guide frontier-atlas"><summary>Frontier atlas (${atlas.zonesVisited}/${atlas.zonesTotal} regions · ${atlas.overallPercent}% recon)</summary>
    <ul class="frontier-atlas__list" aria-label="Charted frontier regions">${items}</ul>
    ${totalsLine}
    ${actsLine}
    ${threatsLine}
    ${weatherLine}
    ${patrolsLine}
    ${contactsLine}
    ${stationsLine}
    ${cachesLine}
    ${routesLine}
    ${servicesLine}
    ${packLine}
    ${unchartedLine}
  </details>`;
}

function formatChecklistDistance(poi) {
  const dist = Math.max(0, Number(poi?.distance) || 0);
  if (dist === 0) return 'Here';
  return `${dist} ${dist === 1 ? 'tile' : 'tiles'} ${poi?.bearing || ''}`.trim();
}

function zoneChecklistPanel(state, zone, mapState) {
  const effectiveState = state ? { ...state, map: mapState || state.map } : { map: mapState };
  const checklist = getZoneChecklist(effectiveState, zone);
  const rows = [];
  for (const npc of checklist.npcs) {
    rows.push(`<li title="${escapeHTML(npc.summary || npc.name)}" data-poi-kind="npc" data-poi-id="${escapeHTML(npc.id)}"><strong>${escapeHTML(npc.name)}</strong>${npc.role ? ` (${escapeHTML(npc.role)})` : ''} · (${escapeHTML(String(npc.x))}, ${escapeHTML(String(npc.y))}) · ${escapeHTML(formatChecklistDistance(npc))}</li>`);
  }
  for (const enc of checklist.encounters) {
    rows.push(`<li title="${escapeHTML(enc.summary || enc.name)}" data-poi-kind="encounter" data-poi-id="${escapeHTML(enc.id)}" data-poi-status="${escapeHTML(enc.status)}"><strong>${escapeHTML(enc.name)}</strong> · ${escapeHTML(enc.status)} · (${escapeHTML(String(enc.x))}, ${escapeHTML(String(enc.y))}) · ${escapeHTML(formatChecklistDistance(enc))}</li>`);
  }
  for (const inter of checklist.interactables) {
    rows.push(`<li title="${escapeHTML(inter.summary || inter.name)}" data-poi-kind="interactable" data-poi-id="${escapeHTML(inter.id)}" data-poi-status="${escapeHTML(inter.status)}"><strong>${escapeHTML(inter.name)}</strong> · ${escapeHTML(inter.status)} · (${escapeHTML(String(inter.x))}, ${escapeHTML(String(inter.y))}) · ${escapeHTML(formatChecklistDistance(inter))}</li>`);
  }
  for (const ex of checklist.exits) {
    const routeStatus = !ex.unlocked ? 'Locked' : ex.visited ? 'Charted' : 'Uncharted';
    rows.push(`<li title="${escapeHTML(ex.summary || ex.label)}" data-poi-kind="exit" data-poi-id="${escapeHTML(ex.toZone)}" data-poi-status="${routeStatus}"><strong>${escapeHTML(ex.label)}</strong> · ${routeStatus} · (${escapeHTML(String(ex.x))}, ${escapeHTML(String(ex.y))}) · ${escapeHTML(formatChecklistDistance(ex))}</li>`);
  }
  const totalPois = rows.length;
  const vantage = getZoneVantage(effectiveState, zone);
  const contactsSummary = getZoneContactsSummary(effectiveState, zone);
  const threatIntel = getZoneThreatIntel(effectiveState, zone);
  const patrolBriefing = getPatrolBriefing(effectiveState, zone);
  const stationsSummary = getZoneStationsSummary(effectiveState, zone);
  const cachesSummary = getZoneCachesSummary(effectiveState, zone);
  const exitsSummary = getZoneExitsSummary(effectiveState, zone);
  const summaryLine = checklist.summary ? `<p class="zone-checklist__summary">${escapeHTML(checklist.summary)}</p>` : '';
  const vantageLine = zoneVantageLine(vantage);
  const contactsLine = contactsSummary?.summary ? `<p class="zone-checklist__contacts">${escapeHTML(contactsSummary.summary)}</p>` : '';
  const threatLine = threatIntel?.summary ? `<p class="zone-checklist__threats">${escapeHTML(threatIntel.summary)}</p>` : '';
  const patrolLine = patrolBriefing?.summary ? `<p class="zone-checklist__patrols">${escapeHTML(patrolBriefing.summary)}</p>` : '';
  const stationsLine = stationsSummary?.summary ? `<p class="zone-checklist__stations">${escapeHTML(stationsSummary.summary)}</p>` : '';
  const cachesLine = cachesSummary?.summary ? `<p class="zone-checklist__caches">${escapeHTML(cachesSummary.summary)}</p>` : '';
  const routesLine = exitsSummary?.summary ? `<p class="zone-checklist__routes">${escapeHTML(exitsSummary.summary)}</p>` : '';
  return `<details class="shortcut-guide zone-checklist"><summary>Zone field checklist (${totalPois} ${totalPois === 1 ? 'landmark' : 'landmarks'})</summary>
    <ul class="zone-checklist__list" aria-label="Zone landmarks and coordinates">${rows.join('')}</ul>
    ${summaryLine}
    ${vantageLine}
    ${contactsLine}
    ${threatLine}
    ${patrolLine}
    ${stationsLine}
    ${cachesLine}
    ${routesLine}
  </details>`;
}

export function renderExploration({ state, zone, mapState, nearbyActions, visitedZones, storyHtml = '', hasArchive = false, hasQuestJournal = false, hasCharacter = false, hasFeats = false, characterShortcuts = true, expeditionLogExpanded = false }) {
  const contextButtons = (nearbyActions || [])
    .filter(action => NEARBY_ACTION_TYPES[action?.kind])
    .map((action, index) => nearbyActionButton(action, index, characterShortcuts)).join('');
  const nearbyTalkPreviews = (nearbyActions || [])
    .filter(action => action?.kind === 'talk' && action.briefing?.summary)
    .map(action => `<p class="nearby-threat-preview nearby-talk-preview">${escapeHTML(action.briefing.summary)}</p>`)
    .join('');
  const nearbyThreatPreviews = (nearbyActions || [])
    .filter(action => action?.kind === 'encounter' && action.preview?.summary)
    .map(action => `<p class="nearby-threat-preview">${escapeHTML(action.preview.summary)}</p>`)
    .join('');
  const nearbyInteractPreviews = (nearbyActions || [])
    .filter(action => action?.kind === 'interact' && action.briefing?.summary)
    .map(action => `<p class="nearby-threat-preview nearby-interact-preview">${escapeHTML(action.briefing.summary)}</p>`)
    .join('');
  const nearbyRoutePreviews = (nearbyActions || [])
    .filter(action => action?.kind === 'exit' && action.briefing?.summary)
    .map(action => `<p class="nearby-threat-preview nearby-route-preview">${escapeHTML(action.briefing.summary)}</p>`)
    .join('');
  const nearbyPatrolPreviews = (nearbyActions || [])
    .filter(action => action?.kind === 'patrol' && action.patrol?.summary)
    .map(action => `<p class="nearby-threat-preview nearby-patrol-preview">${escapeHTML(action.patrol.summary)}</p>`)
    .join('');
  const routes = (visitedZones || [])
    .filter(zoneId => zoneId !== zone.id && ZONES[zoneId])
    .map(zoneId => {
      const briefing = getRouteBriefing(state ? { ...state, map: mapState } : { map: mapState }, zoneId);
      return uiButton({
        action: 'mapTravel',
        arg: zoneId,
        label: `Fast Travel: ${ZONES[zoneId].name}`,
        iconName: 'map',
        variant: 'ghost',
        title: briefing?.summary || null,
      });
    })
    .join('');
  const fastTravelBriefing = routes
    ? getFastTravelBriefing({ ...(state || {}), map: mapState, visitedZones }, zone)
    : null;
  const logState = state ? { ...state, map: mapState } : { map: mapState };
  const recentLogSummary = getExpeditionLogSummary(logState, EXPEDITION_LOG_RECENT_LIMIT);
  const fullLogSummary = getExpeditionLogSummary(logState, EXPEDITION_LOG_EXPANDED_LIMIT);
  const hasEarlierLogEntries = fullLogSummary.visibleCount > recentLogSummary.visibleCount;
  const showFullLog = expeditionLogExpanded === true && hasEarlierLogEntries;
  const logSummary = showFullLog ? fullLogSummary : recentLogSummary;
  const logLines = logSummary.entries;
  const logToggleLabel = showFullLog ? 'Show recent entries only' : `Show earlier entries (${fullLogSummary.visibleCount - recentLogSummary.visibleCount})`;

  return `<div class="game-shell explore-screen">
    <div class="explore-heading-row">
      ${sceneHeader({ eyebrow: 'Expedition · Turn-based exploration', title: zone.name, subtitle: zone.subtitle, iconName: 'compass' })}
      <div class="coordinate-chip" aria-label="Current coordinates">${icon('map')}<span>Position</span><strong>${mapState.x}, ${mapState.y}</strong></div>
    </div>
    <div class="explore-resource-row">
      ${resourceChip({ iconName: 'coin', label: 'Gold', value: state.gold ?? 0 })}
      <span class="location-status"><span class="status-dot"></span>One move per turn · Keyboard: ${characterShortcuts ? 'WASD or arrow keys' : 'arrow keys'}</span>
    </div>
    ${partyStatus(state.party)}
    ${renderPinnedQuest(state, { journalAction: 'openQuests', hasJournal: hasQuestJournal })}
    ${(() => { const line = bountyFieldText(state, zone); return line ? `<p class="explore-bounty-summary" role="status">${escapeHTML(line)}</p>` : ''; })()}
    <div class="explore-layout">
      <section class="panel exploration-map-panel" aria-labelledby="zone-map-title">
        <div class="section-heading">
          <div><p class="eyebrow">Current surroundings</p><h2 id="zone-map-title">${escapeHTML(zone.name)}</h2></div>
          <span class="turn-badge">Explore</span>
        </div>
        <p class="zone-description">${escapeHTML(zone.description)}</p>
        ${(() => {
          const vantage = getZoneVantage(state, zone);
          const weatherBriefing = getZoneWeatherBriefing(state, zone);
          const prog = vantage.progress;
          const objSummary = prog.totalObjectives > 0
            ? `Threats cleared ${prog.encountersCleared}/${prog.encountersTotal} · Caches ${prog.cachesOpened}/${prog.cachesTotal}`
            : 'Safe haven';
          const reconTitle = weatherBriefing?.modifiers?.length
            ? `${vantage.summary || vantage.landmark} · ${weatherBriefing.modifiers.join(', ')}`
            : (vantage.summary || vantage.landmark);
          return `<p class="zone-recon-summary" title="${escapeHTML(reconTitle)}"><strong>${escapeHTML(vantage.condition.name)}</strong> · ${escapeHTML(vantage.landmark)} (${escapeHTML(String(vantage.elevation))}m) · ${escapeHTML(objSummary)}${vantage.fieldNote ? ` — ${escapeHTML(vantage.fieldNote)}` : ''}</p>${zoneWeatherLine(weatherBriefing?.summary)}`;
        })()}
        ${zoneVista(zone)}
        ${mapGrid(zone, mapState, state)}
        ${terrainCompass(zone, mapState, characterShortcuts, state)}
        <ul class="map-legend" aria-label="Map legend">
          <li><span class="legend-symbol legend-symbol--player">@</span>You</li>
          <li><span class="legend-symbol legend-symbol--npc">M/I/T</span>People</li>
          <li><span class="legend-symbol legend-symbol--threat">!</span>Threat</li>
          <li><span class="legend-symbol legend-symbol--object">?</span>Object</li>
          <li><span class="legend-symbol legend-symbol--exit">╬</span>Route</li>
          <li><span class="legend-symbol legend-symbol--wall">#</span>Blocked</li>
        </ul>
      </section>
      <aside class="explore-sidebar" aria-label="Exploration controls">
        <section class="panel navigation-panel" aria-labelledby="navigation-title">
          <p class="eyebrow">Navigator</p><h2 id="navigation-title">Choose your route</h2>
          ${(() => {
            const navInspection = getTileInspection(state ? { ...state, map: mapState } : { map: mapState }, mapState?.x, mapState?.y, zone);
            return `<div class="movement-controls" role="group" aria-label="Movement Controls">
            ${movementButton('moveNorth', 'North', 'W', '↑', 'movement-button--north', characterShortcuts, navInspection?.neighbors?.north?.summary)}
            ${movementButton('moveWest', 'West', 'A', '←', 'movement-button--west', characterShortcuts, navInspection?.neighbors?.west?.summary)}
            ${movementButton('waitTurn', 'Survey', 'E', '◉', 'movement-button--survey', characterShortcuts, navInspection?.summary)}
            ${movementButton('moveEast', 'East', 'D', '→', 'movement-button--east', characterShortcuts, navInspection?.neighbors?.east?.summary)}
            ${movementButton('moveSouth', 'South', 'S', '↓', 'movement-button--south', characterShortcuts, navInspection?.neighbors?.south?.summary)}
          </div>`;
          })()}
          <p class="control-hint">Survey to inspect the tile beneath you, or click a passable map tile to step along a safe route (takes normal movement steps where random encounters may occur, pauses beside threats, and engages a threat if clicked directly). Movement never spends supplies.</p>
          ${explorationShortcutGuide(characterShortcuts)}
          ${frontierAtlasPanel(state, zone, mapState)}
          ${zoneChecklistPanel(state, zone, mapState)}
        </section>
        <section class="panel nearby-panel" aria-labelledby="nearby-title">
          <p class="eyebrow">Within reach</p><h2 id="nearby-title">Nearby Actions:</h2>
          <p class="quiet-note nearby-panel__summary">${escapeHTML(getNearbyActionsSummary(state ? { ...state, map: mapState } : { map: mapState }).summary)}</p>
          <div class="nearby-actions">${contextButtons || '<p class="empty-state">Move beside a person, route, cache, or threat to interact.</p>'}</div>
          ${nearbyTalkPreviews}
          ${nearbyThreatPreviews}
          ${nearbyInteractPreviews}
          ${nearbyRoutePreviews}
          ${nearbyPatrolPreviews}
          ${fieldPack(state.inventory, state.party)}
          ${routes ? `<div class="visited-routes"><h3>${icon('map')}Visited Routes:</h3>${fastTravelBriefing?.summary ? `<p class="quiet-note visited-routes__summary">${escapeHTML(fastTravelBriefing.summary)}</p>` : ''}<div>${routes}</div></div>` : ''}
          <div class="explore-utilities">
            ${hasCharacter ? uiButton({ action: 'openCharacter', label: 'Character Sheet', iconName: 'journal', variant: 'ghost' }) : ''}
            ${uiButton({ action: 'openBag', label: 'Open Bag', iconName: 'bag', variant: 'ghost' })}
            ${hasArchive ? uiButton({ action: 'openArchive', label: 'Journey Archive', iconName: 'save', variant: 'ghost' }) : ''}
            ${hasQuestJournal ? uiButton({ action: 'openQuests', label: 'Journey Journal', iconName: 'journal', variant: 'ghost' }) : ''}
            ${hasFeats ? uiButton({ action: 'openFeats', label: 'Wardens’ Feats', iconName: 'beacon', variant: 'ghost' }) : ''}
            ${uiButton({ action: 'openJournal', label: 'Field Journal', iconName: 'journal', variant: 'ghost' })}
            ${uiButton({ action: 'save', label: 'Save Game', iconName: 'save' })}
            ${uiButton({ action: 'toTownScene', label: 'Town Overview', iconName: 'beacon', variant: 'ghost' })}
          </div>
        </section>
      </aside>
    </div>
    <section class="panel expedition-log" aria-labelledby="expedition-log-title">
      <h2 id="expedition-log-title">Expedition log</h2>
      <p class="quiet-note expedition-log__summary">${escapeHTML(logSummary.summary)}</p>
      ${hasEarlierLogEntries ? `<button type="button" class="action-button action-button--ghost expedition-log__toggle" data-action="toggleExpeditionLog" aria-expanded="${showFullLog}" aria-controls="expedition-log-entries">${icon('journal')}<span>${escapeHTML(logToggleLabel)}</span></button>` : ''}
      <div class="log" id="expedition-log-entries" aria-live="polite" aria-atomic="false">
        ${logLines.length ? logLines.map(line => `<p>${escapeHTML(line)}</p>`).join('') : '<p>The road ahead is quiet. Choose a direction to begin.</p>'}
      </div>
    </section>
    ${storyHtml}
  </div>`;
}
