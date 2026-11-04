import { getItem, isKnownItem, TYPES } from '../items/items.js';
import { listRecipes, recipeInputsMet, recipeSummary } from '../items/crafting.js';
import { getEntityAt, getTileInfo } from '../map/mapState.js';
import { ZONES } from '../map/zones.js';
import { escapeHTML, icon, partyStatus, resourceChip, sceneHeader, uiButton } from './components.js';

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

function mapGrid(zone, mapState) {
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

      if (entityInfo) {
        cellClass += ` entity-${safeClass(entityInfo.type)}`;
        if (entityInfo.type === 'npc') {
          symbol = entityInfo.entity.symbol || 'N';
          label = `${entityInfo.entity.name}, ${entityInfo.entity.role}`;
        } else if (entityInfo.type === 'encounter') {
          symbol = entityInfo.entity.symbol || '!';
          label = `Threat: ${entityInfo.entity.name}`;
        } else if (entityInfo.type === 'interactable') {
          symbol = entityInfo.entity.symbol || '?';
          label = entityInfo.entity.name;
        } else if (entityInfo.type === 'exit') {
          symbol = '╬';
          label = entityInfo.entity.label;
        }
      }

      if (isPlayer) {
        symbol = '@';
        cellClass += ' map-player';
        label = `Wren, your position, column ${x + 1}, row ${y + 1}`;
      }

      cells.push(`<span class="${cellClass}" role="gridcell" aria-label="${escapeHTML(label)}"${isPlayer ? ' aria-current="location"' : ''} title="${escapeHTML(label)}" data-x="${x}" data-y="${y}"><span aria-hidden="true">${escapeHTML(symbol)}</span></span>`);
    }
    rows.push(`<div class="map-row" role="row">${cells.join('')}</div>`);
  }

  return `<div class="map-frame">
    <div class="map-grid" role="grid" aria-label="${escapeHTML(zone.name)} map" aria-rowcount="${zone.height}" aria-colcount="${zone.width}" style="--map-columns:${zone.width}">${rows.join('')}</div>
  </div>`;
}

function nearbyActionButton(action) {
  const types = {
    talk: { name: 'mapTalk', iconName: 'journal' },
    encounter: { name: 'mapEncounter', iconName: 'sword', variant: 'danger' },
    patrol: { name: 'mapPatrol', iconName: 'sword', variant: 'secondary' },
    interact: { name: 'mapInteract', iconName: 'bag', variant: 'primary' },
    exit: { name: 'mapTravel', iconName: 'compass', variant: 'primary' },
  };
  const type = types[action.kind];
  if (!type) return '';
  return uiButton({
    action: type.name,
    arg: action.id,
    label: action.label,
    iconName: type.iconName,
    variant: type.variant || 'secondary',
  });
}

function movementButton(action, label, key, arrow, className) {
  return `<button type="button" class="action-button movement-button ${className}" data-action="${action}" aria-label="${action === 'waitTurn' ? 'Survey Area' : `Move ${label}`}">
    <span class="movement-button__arrow" aria-hidden="true">${arrow}</span><span>${label}</span><kbd aria-hidden="true">${key}</kbd>
  </button>`;
}

export function renderExploration({ state, zone, mapState, nearbyActions, visitedZones, storyHtml = '' }) {
  const contextButtons = (nearbyActions || []).map(nearbyActionButton).join('');
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
      <span class="location-status"><span class="status-dot"></span>One move per turn · Keyboard: WASD or arrow keys</span>
    </div>
    ${partyStatus(state.party)}
    <div class="explore-layout">
      <section class="panel exploration-map-panel" aria-labelledby="zone-map-title">
        <div class="section-heading">
          <div><p class="eyebrow">Current surroundings</p><h2 id="zone-map-title">${escapeHTML(zone.name)}</h2></div>
          <span class="turn-badge">Explore</span>
        </div>
        <p class="zone-description">${escapeHTML(zone.description)}</p>
        ${mapGrid(zone, mapState)}
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
            ${movementButton('moveNorth', 'North', 'W', '↑', 'movement-button--north')}
            ${movementButton('moveWest', 'West', 'A', '←', 'movement-button--west')}
            ${movementButton('waitTurn', 'Survey', '·', '◉', 'movement-button--survey')}
            ${movementButton('moveEast', 'East', 'D', '→', 'movement-button--east')}
            ${movementButton('moveSouth', 'South', 'S', '↓', 'movement-button--south')}
          </div>
          <p class="control-hint">Survey to inspect the tile beneath you. Movement never spends supplies.</p>
        </section>
        <section class="panel nearby-panel" aria-labelledby="nearby-title">
          <p class="eyebrow">Within reach</p><h2 id="nearby-title">Nearby Actions:</h2>
          <div class="nearby-actions">${contextButtons || '<p class="empty-state">Move beside a person, route, cache, or threat to interact.</p>'}</div>
          ${fieldPack(state.inventory, state.party)}
          ${routes ? `<div class="visited-routes"><h3>${icon('map')}Visited Routes:</h3><div>${routes}</div></div>` : ''}
          <div class="explore-utilities">
            ${uiButton({ action: 'openBag', label: 'Open Bag', iconName: 'bag', variant: 'ghost' })}
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
