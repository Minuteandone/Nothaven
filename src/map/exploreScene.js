import { saveGame } from '../state.js';
import { createStoryState, getDialogue } from '../story/index.js';
import { createStoryUI } from '../story/view.js';
import { getItem, isKnownItem, TYPES } from '../items/items.js';
import { ZONES } from './zones.js';
import {
  ensureMapState,
  getAvailableActions,
  getEntityAt,
  getTileInfo,
  getVisitedZones,
  getZone,
  interactWith,
  movePlayer,
  recordEncounterVictory,
  travelToZone,
  useFieldConsumable,
} from './mapState.js';

const escapeHtml = (value) =>
  String(value ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
  );

const storyUI = createStoryUI((game) => ensureMapState(game.state).zoneId);

function emitMapEvents(game, events = []) {
  for (const evt of events) {
    if (evt.type === 'talk' && evt.npcId) {
      const dlg = getDialogue(game.state.story || createStoryState(), evt.npcId);
      if (dlg) {
        game.storyDialogue = { ...dlg, location: ensureMapState(game.state).zoneId };
      }
    }
    game.bus.emit('story:event', evt);
  }
}

function handleActionResult(game, result) {
  const mapState = ensureMapState(game.state);
  game.state.location = mapState.zoneId;
  if (result.transitioned) {
    game.storyDialogue = null;
  }
  emitMapEvents(game, result.events);

  if (result.triggerCombat) {
    const { encounterId, enemyId } = result.triggerCombat;
    game.setScene('combat', {
      enemyId: enemyId || 'storm_rat',
      encounterId: encounterId || null,
      returnScene: 'explore',
    });
  }
}

function renderFieldPackHtml(inventory) {
  const stacks = Array.isArray(inventory) ? inventory.filter((s) => s && s.qty > 0) : [];
  if (stacks.length === 0) {
    return `<div style="margin-top:0.5rem;font-size:0.9rem;color:var(--muted);"><strong>Field Pack:</strong> Empty</div>`;
  }
  const itemsSummary = [];
  const consumableButtons = [];
  for (const stack of stacks) {
    const item = isKnownItem(stack.id) ? getItem(stack.id) : { id: stack.id, name: stack.id };
    itemsSummary.push(`${escapeHtml(item.name)} ×${stack.qty}`);
    if (item.type === TYPES.CONSUMABLE) {
      consumableButtons.push(
        `<button data-action="useFieldItem" data-arg="${escapeHtml(item.id)}">Use ${escapeHtml(item.name)} (${stack.qty})</button>`
      );
    }
  }
  return `
    <div style="margin-top:0.5rem;font-size:0.9rem;">
      <div><strong>Field Pack:</strong> ${itemsSummary.join(' · ')}</div>
      ${consumableButtons.length ? `<div style="margin-top:0.25rem;">${consumableButtons.join('')}</div>` : ''}
    </div>
  `;
}

function renderGridHtml(zone, mapState) {
  const rows = [];
  for (let y = 0; y < zone.height; y++) {
    const cells = [];
    for (let x = 0; x < zone.width; x++) {
      const isPlayer = mapState.x === x && mapState.y === y;
      const entityInfo = getEntityAt(zone, mapState, x, y);
      const tile = getTileInfo(zone, x, y);

      let symbol = tile.glyph;
      let cellClass = `map-cell tile-${tile.id}`;
      let title = `${tile.name} (${x},${y})`;

      if (entityInfo) {
        cellClass += ` entity-${entityInfo.type}`;
        if (entityInfo.type === 'npc') {
          symbol = entityInfo.entity.symbol || 'N';
          title = `${entityInfo.entity.name} (${entityInfo.entity.role})`;
        } else if (entityInfo.type === 'encounter') {
          symbol = entityInfo.entity.symbol || '!';
          title = `Threat: ${entityInfo.entity.name}`;
        } else if (entityInfo.type === 'interactable') {
          symbol = entityInfo.entity.symbol || '?';
          title = entityInfo.entity.name;
        } else if (entityInfo.type === 'exit') {
          symbol = '╬';
          title = entityInfo.entity.label;
        }
      }

      if (isPlayer) {
        symbol = '@';
        cellClass += ' map-player';
        title = `Wren (You) at (${x},${y})`;
      }

      cells.push(
        `<span class="${cellClass}" title="${escapeHtml(title)}" data-x="${x}" data-y="${y}" style="display:inline-block;width:2rem;height:2rem;line-height:2rem;text-align:center;border:1px solid #2c3650;font-family:monospace;font-weight:bold;background:${
          isPlayer
            ? '#e0b04a'
            : entityInfo?.type === 'encounter'
            ? '#5a1f27'
            : entityInfo?.type === 'npc'
            ? '#1f4d3a'
            : entityInfo?.type === 'interactable'
            ? '#243b61'
            : entityInfo?.type === 'exit'
            ? '#3b3355'
            : tile.walkable
            ? '#161c28'
            : '#0c0f16'
        };color:${isPlayer ? '#111' : '#e6e6e6'};">${escapeHtml(symbol)}</span>`
      );
    }
    rows.push(`<div class="map-row" style="display:flex;justify-content:center;">${cells.join('')}</div>`);
  }
  return `<div class="map-grid" role="region" aria-label="Zone Map Grid" style="margin:0.75rem 0;">${rows.join('')}</div>`;
}

export const exploreScene = {
  onEnter(game, data = {}) {
    const mapState = ensureMapState(game.state);
    if (data?.zoneId && ZONES[data.zoneId] && data.zoneId !== mapState.zoneId) {
      const res = travelToZone(game.state, data.zoneId, data.spawnKey || 'default');
      emitMapEvents(game, res.events);
    } else {
      game.state.location = mapState.zoneId;
      mapState.visitedZones[mapState.zoneId] = true;
      emitMapEvents(game, [{ type: 'visit', locationId: mapState.zoneId }]);
    }

    if (data?.combatResult === 'victory' && (data.encounterId || mapState.activeEncounterId)) {
      const vRes = recordEncounterVictory(game.state, data.encounterId || mapState.activeEncounterId);
      emitMapEvents(game, vRes.events);
    } else if (data?.combatResult === 'fled') {
      mapState.activeEncounterId = null;
    }

    if (data?.message) {
      mapState.log = [...(mapState.log || []).slice(-19), data.message];
    }
  },

  render(game) {
    const mapState = ensureMapState(game.state);
    const zone = getZone(mapState.zoneId);
    const hero = game.state.party?.[0] || {
      name: 'Wren',
      level: 1,
      hp: 30,
      maxHp: 30,
      mp: 10,
      maxMp: 10,
      xp: 0,
    };
    const nearbyActions = getAvailableActions(game.state);
    const visitedZones = getVisitedZones(game.state);

    const contextButtons = nearbyActions
      .map((act) => {
        if (act.kind === 'talk') {
          return `<button data-action="mapTalk" data-arg="${escapeHtml(act.id)}">${escapeHtml(act.label)}</button>`;
        }
        if (act.kind === 'encounter') {
          return `<button data-action="mapEncounter" data-arg="${escapeHtml(act.id)}">${escapeHtml(act.label)}</button>`;
        }
        if (act.kind === 'interact') {
          return `<button data-action="mapInteract" data-arg="${escapeHtml(act.id)}">${escapeHtml(act.label)}</button>`;
        }
        if (act.kind === 'exit') {
          return `<button data-action="mapTravel" data-arg="${escapeHtml(act.id)}">${escapeHtml(act.label)}</button>`;
        }
        return '';
      })
      .join('');

    const fastTravelButtons = visitedZones
      .filter((zId) => zId !== zone.id)
      .map((zId) => {
        const z = ZONES[zId];
        return `<button data-action="mapTravel" data-arg="${escapeHtml(zId)}">Fast Travel: ${escapeHtml(z.name)}</button>`;
      })
      .join('');

    const logLines = (mapState.log || []).slice(-6);

    return `
      <div class="panel">
        <div style="display:flex;justify-content:space-between;align-items:baseline;flex-wrap:wrap;">
          <h2>${escapeHtml(zone.name)} <small style="color:var(--muted);font-size:0.85em;">— ${escapeHtml(zone.subtitle)}</small></h2>
          <span>Coords: (${mapState.x}, ${mapState.y})</span>
        </div>
        <div class="stats">
          <span>${escapeHtml(hero.name)} Lv ${hero.level ?? 1}</span>
          <span class="hp">HP ${hero.hp}/${hero.maxHp}</span>
          <span>MP ${hero.mp ?? 0}/${hero.maxMp ?? 0}</span>
          <span>XP ${hero.xp ?? 0}</span>
          <span>Gold ${game.state.gold ?? 0}</span>
        </div>
        <p>${escapeHtml(zone.description)}</p>
        ${renderGridHtml(zone, mapState)}
        <div style="display:flex;gap:1rem;flex-wrap:wrap;align-items:center;justify-content:space-between;">
          <div aria-label="Movement Controls">
            <div style="text-align:center;">
              <button data-action="moveNorth" aria-label="Move North">▲ North (W)</button>
            </div>
            <div style="text-align:center;">
              <button data-action="moveWest" aria-label="Move West">◀ West (A)</button>
              <button data-action="waitTurn" aria-label="Survey Area">● Survey</button>
              <button data-action="moveEast" aria-label="Move East">East (D) ▶</button>
            </div>
            <div style="text-align:center;">
              <button data-action="moveSouth" aria-label="Move South">▼ South (S)</button>
            </div>
          </div>
          <div style="flex:1;min-width:220px;">
            <div><strong>Nearby Actions:</strong></div>
            <div>${contextButtons || '<span style="color:var(--muted);">Move adjacent to NPCs, gates, dispatches, caches, or encounters to interact.</span>'}</div>
            ${renderFieldPackHtml(game.state.inventory)}
            ${fastTravelButtons ? `<div style="margin-top:0.5rem;"><strong>Visited Routes:</strong> ${fastTravelButtons}</div>` : ''}
            <div style="margin-top:0.5rem;">
              <button data-action="save">Save Game</button>
              <button data-action="toTownScene">Town Overview</button>
            </div>
          </div>
        </div>
        <div style="margin-top:0.5rem;font-size:0.85rem;color:var(--muted);">
          Legend: <strong>@</strong> Hero · <strong>M/I/T</strong> NPCs · <strong>!</strong> Encounter · <strong>✉/◈/▣/?/✦</strong> Objects · <strong>╬</strong> Zone Exit · <strong>#</strong> Wall · <strong>≈</strong> Chasm
        </div>
      </div>
      <div class="panel log" aria-live="polite">
        ${logLines.map((l) => `<p>${escapeHtml(l)}</p>`).join('')}
      </div>
      ${storyUI.render(game)}
    `;
  },

  actions: {
    ...storyUI.actions,
    moveNorth(game) {
      handleActionResult(game, movePlayer(game.state, 0, -1, { disableRandomEncounters: true }));
    },
    moveSouth(game) {
      handleActionResult(game, movePlayer(game.state, 0, 1, { disableRandomEncounters: true }));
    },
    moveWest(game) {
      handleActionResult(game, movePlayer(game.state, -1, 0, { disableRandomEncounters: true }));
    },
    moveEast(game) {
      handleActionResult(game, movePlayer(game.state, 1, 0, { disableRandomEncounters: true }));
    },
    waitTurn(game) {
      const mapState = ensureMapState(game.state);
      const zone = getZone(mapState.zoneId);
      const tile = getTileInfo(zone, mapState.x, mapState.y);
      mapState.log = [
        ...(mapState.log || []).slice(-19),
        `Standing on ${tile.name} in ${zone.name} (${mapState.x}, ${mapState.y}).`,
      ];
    },
    mapTalk(game, el) {
      const npcId = el?.dataset?.arg;
      if (!npcId) return;
      handleActionResult(game, interactWith(game.state, 'talk', npcId));
    },
    mapEncounter(game, el) {
      const encId = el?.dataset?.arg;
      if (!encId) return;
      handleActionResult(game, interactWith(game.state, 'encounter', encId));
    },
    mapInteract(game, el) {
      const intId = el?.dataset?.arg;
      if (!intId) return;
      handleActionResult(game, interactWith(game.state, 'interact', intId));
    },
    mapTravel(game, el) {
      const toZone = el?.dataset?.arg;
      if (!toZone) return;
      handleActionResult(game, interactWith(game.state, 'exit', toZone));
    },
    useFieldItem(game, el) {
      const itemId = el?.dataset?.arg;
      if (!itemId) return;
      useFieldConsumable(game.state, itemId);
    },
    save(game) {
      saveGame(game.state);
      const mapState = ensureMapState(game.state);
      mapState.log = [...(mapState.log || []).slice(-19), 'Game saved.'];
    },
    toTownScene(game) {
      const mapState = ensureMapState(game.state);
      if (mapState.zoneId !== 'greyhaven') {
        handleActionResult(game, travelToZone(game.state, 'greyhaven', 'default'));
      } else {
        game.state.location = 'greyhaven';
      }
      game.setScene('town', { message: 'Returned to Greyhaven overview.' });
    },
  },
};

const installedGames = new WeakMap();

export function installMap(game, options = {}) {
  if (installedGames.has(game)) return installedGames.get(game);

  ensureMapState(game.state);
  game.registerScene('explore', exploreScene);

  const onCombatVictory = (payload) => {
    const mapState = ensureMapState(game.state);
    const encId = payload?.encounterId || mapState.activeEncounterId;
    if (encId) {
      recordEncounterVictory(game.state, encId, payload?.enemyId || null);
    }
  };
  game.bus.on('combat:victory', onCombatVictory);

  let keyHandler = null;
  if (options.enableKeyboard !== false && typeof window !== 'undefined' && window.addEventListener) {
    keyHandler = (e) => {
      if (game.state?.scene !== 'explore') return;
      if (e.target && ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)) return;
      const keyMap = {
        ArrowUp: 'moveNorth',
        KeyW: 'moveNorth',
        ArrowDown: 'moveSouth',
        KeyS: 'moveSouth',
        ArrowLeft: 'moveWest',
        KeyA: 'moveWest',
        ArrowRight: 'moveEast',
        KeyD: 'moveEast',
      };
      const actionName = keyMap[e.code] || keyMap[e.key];
      if (actionName && exploreScene.actions[actionName]) {
        e.preventDefault();
        exploreScene.actions[actionName](game);
        game.render();
      }
    };
    window.addEventListener('keydown', keyHandler);
  }

  const cleanup = () => {
    game.bus.off('combat:victory', onCombatVictory);
    if (keyHandler && typeof window !== 'undefined' && window.removeEventListener) {
      window.removeEventListener('keydown', keyHandler);
    }
    installedGames.delete(game);
  };

  installedGames.set(game, cleanup);
  return cleanup;
}
