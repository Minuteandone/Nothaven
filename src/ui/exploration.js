import { renderPinnedQuest } from './pinnedQuest.js';
import { getItem, isKnownItem, TYPES } from '../items/items.js';
import { listRecipes, recipeInputsMet, recipeSummary } from '../items/crafting.js';
import { getEncounterPreview, getEntityAt, getTileInfo, getZoneCompassHint, getZoneVantage } from '../map/mapState.js';
import { ZONES } from '../map/zones.js';
import { escapeHTML, icon, partyStatus, resourceChip, sceneHeader, uiButton } from './components.js';
import { zoneVista } from './zoneArt.js';
import { bountyFieldText } from '../core/bounties.js';

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
    .map(recipe => `<button type="button" class="action-button action-button--ghost" data-action="craftFieldItem" data-arg="${escapeHTML(recipe.id)}" title="${escapeHTML(recipeSummary(recipe))}">${icon('focus')}<span>Craft: ${escapeHTML(recipe.name)}</span></button>`);

  for (const stack of stacks) {
    const item = isKnownItem(stack.id) ? getItem(stack.id) : { id: stack.id, name: stack.id };
    summaries.push(`<li><span>${escapeHTML(item.name)} ×${Math.max(0, Number(stack.qty) || 0)}</span></li>`);
    if (item.type === TYPES.CONSUMABLE) {
      consumables.push(uiButton({
        action: 'useFieldItem',
        arg: item.id,
        label: `Use ${item.name} (${stack.qty})`,
        iconName: 'heart',
        variant: 'ghost',
      }));
      companions.forEach((ally, idx) => {
        if (!ally) return;
        const targetIdx = idx + 1;
        consumables.push(uiButton({
          action: 'useFieldItem',
          arg: `${item.id}:${targetIdx}`,
          label: `Use ${item.name} → ${ally.name || `Ally ${targetIdx}`}`,
          iconName: 'heart',
          variant: 'ghost',
        }));
      });
    }
  }

  return `<section class="field-pack" aria-labelledby="field-pack-title">
    <h3 id="field-pack-title">${icon('bag')}Field Pack:</h3>
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
          cellTitle = label;
        } else if (entityInfo.type === 'encounter') {
          symbol = entityInfo.entity.symbol || '!';
          label = `Threat: ${entityInfo.entity.name}`;
          const preview = getEncounterPreview(entityInfo.entity.enemyId, state);
          cellTitle = preview?.summary ? `${label} — ${preview.summary}` : label;
        } else if (entityInfo.type === 'interactable') {
          symbol = entityInfo.entity.symbol || '?';
          label = entityInfo.entity.name;
          cellTitle = label;
        } else if (entityInfo.type === 'exit') {
          symbol = '╬';
          label = entityInfo.entity.label;
          cellTitle = label;
        }
      }

      if (isPlayer) {
        symbol = '@';
        cellClass += ' map-player';
        label = `Wren, your position, column ${x + 1}, row ${y + 1}`;
        cellTitle = label;
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
  const titleAttr = action.kind === 'encounter' && action.preview?.summary
    ? ` title="${escapeHTML(action.preview.summary)}"`
    : '';
  return `<button type="button" class="action-button action-button--${type.variant || 'secondary'} nearby-action" data-action="${escapeHTML(type.name)}" data-arg="${escapeHTML(action.id)}"${titleAttr}${shortcut ? ` aria-keyshortcuts="${shortcut}"` : ''}>
    ${icon(type.iconName)}<span>${escapeHTML(action.label)}</span>${shortcut ? keyHint(shortcut) : ''}
  </button>`;
}

function movementButton(action, label, key, arrow, className, characterShortcuts) {
  const shortcuts = {
    moveNorth: 'W ArrowUp', moveWest: 'A ArrowLeft', moveEast: 'D ArrowRight',
    moveSouth: 'S ArrowDown', waitTurn: 'E',
  };
  const binding = characterShortcuts ? shortcuts[action] : (shortcuts[action].split(' ')[1] || '');
  return `<button type="button" class="action-button movement-button ${className}" data-action="${action}" aria-label="${action === 'waitTurn' ? 'Survey Area' : `Move ${label}`}" ${binding ? `aria-keyshortcuts="${binding}"` : ''}>
    <span class="movement-button__arrow" aria-hidden="true">${arrow}</span><span>${label}</span>${characterShortcuts ? `<kbd aria-hidden="true">${key}</kbd>` : ''}
  </button>`;
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
  const items = directions.map(direction => {
    const tx = x + direction.dx;
    const ty = y + direction.dy;
    const terrain = terrainAt(tx, ty);
    return `<li data-direction="${direction.id}" data-passable="${terrain.passable}">
      <span class="terrain-compass__direction">${direction.label}${characterShortcuts ? keyHint(direction.key) : ''}</span>
      <span class="terrain-compass__terrain"><strong>${escapeHTML(terrain.name)}</strong><small>${escapeHTML(`${tx}, ${ty}`)} · ${terrain.passable ? 'Passable' : 'Blocked'}</small></span>
    </li>`;
  }).join('');
  const compassHint = getZoneCompassHint(state ? { ...state, map: mapState } : { map: mapState }, zone);
  const bearingLine = compassHint
    ? `<p class="terrain-compass__bearing">Compass bearing: <strong>${escapeHTML(compassHint.label)}</strong> (${escapeHTML(compassHint.bearing)}, ${compassHint.distance} ${compassHint.distance === 1 ? 'tile' : 'tiles'})</p>`
    : '';
  return `<section class="terrain-compass" aria-labelledby="terrain-compass-title">
    <div class="terrain-compass__heading"><h3 id="terrain-compass-title">Terrain compass</h3><p>Standing on <strong>${escapeHTML(current.name)}</strong> at ${escapeHTML(`${x}, ${y}`)}.</p>${bearingLine}</div>
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

export function renderExploration({ state, zone, mapState, nearbyActions, visitedZones, storyHtml = '', hasArchive = false, hasQuestJournal = false, hasCharacter = false, hasFeats = false, characterShortcuts = true }) {
  const contextButtons = (nearbyActions || [])
    .filter(action => NEARBY_ACTION_TYPES[action?.kind])
    .map((action, index) => nearbyActionButton(action, index, characterShortcuts)).join('');
  const nearbyThreatPreviews = (nearbyActions || [])
    .filter(action => action?.kind === 'encounter' && action.preview?.summary)
    .map(action => `<p class="nearby-threat-preview">${escapeHTML(action.preview.summary)}</p>`)
    .join('');
  const routes = (visitedZones || [])
    .filter(zoneId => zoneId !== zone.id && ZONES[zoneId])
    .map(zoneId => uiButton({
      action: 'mapTravel',
      arg: zoneId,
      label: `Fast Travel: ${ZONES[zoneId].name}`,
      iconName: 'map',
      variant: 'ghost',
    }))
    .join('');
  const logLines = (mapState.log || []).slice(-6).reverse();

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
          const prog = vantage.progress;
          const objSummary = prog.totalObjectives > 0
            ? `Threats cleared ${prog.encountersCleared}/${prog.encountersTotal} · Caches ${prog.cachesOpened}/${prog.cachesTotal}`
            : 'Safe haven';
          return `<p class="zone-recon-summary"><strong>${escapeHTML(vantage.condition.name)}</strong> · ${escapeHTML(vantage.landmark)} (${escapeHTML(String(vantage.elevation))}m) · ${escapeHTML(objSummary)}${vantage.fieldNote ? ` — ${escapeHTML(vantage.fieldNote)}` : ''}</p>`;
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
          <div class="movement-controls" role="group" aria-label="Movement Controls">
            ${movementButton('moveNorth', 'North', 'W', '↑', 'movement-button--north', characterShortcuts)}
            ${movementButton('moveWest', 'West', 'A', '←', 'movement-button--west', characterShortcuts)}
            ${movementButton('waitTurn', 'Survey', 'E', '◉', 'movement-button--survey', characterShortcuts)}
            ${movementButton('moveEast', 'East', 'D', '→', 'movement-button--east', characterShortcuts)}
            ${movementButton('moveSouth', 'South', 'S', '↓', 'movement-button--south', characterShortcuts)}
          </div>
          <p class="control-hint">Survey to inspect the tile beneath you, or click a passable map tile to step along a safe route (takes normal movement steps where random encounters may occur, pauses beside threats, and engages a threat if clicked directly). Movement never spends supplies.</p>
          ${explorationShortcutGuide(characterShortcuts)}
        </section>
        <section class="panel nearby-panel" aria-labelledby="nearby-title">
          <p class="eyebrow">Within reach</p><h2 id="nearby-title">Nearby Actions:</h2>
          <div class="nearby-actions">${contextButtons || '<p class="empty-state">Move beside a person, route, cache, or threat to interact.</p>'}</div>
          ${nearbyThreatPreviews}
          ${fieldPack(state.inventory, state.party)}
          ${routes ? `<div class="visited-routes"><h3>${icon('map')}Visited Routes:</h3><div>${routes}</div></div>` : ''}
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
      <div class="log" aria-live="polite" aria-atomic="false">
        ${logLines.length ? logLines.map(line => `<p>${escapeHTML(line)}</p>`).join('') : '<p>The road ahead is quiet. Choose a direction to begin.</p>'}
      </div>
    </section>
    ${storyHtml}
  </div>`;
}
