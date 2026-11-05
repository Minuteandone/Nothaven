import { unpinQuest } from '../story/pinnedQuest.js';
import { characterShortcutsEnabled } from '../ui/displayControls.js';
import { saveGame } from '../state.js';
import { createStoryState, getDialogue } from '../story/index.js';
import { createStoryUI } from '../story/view.js';
import { renderExploration } from '../ui/exploration.js';
import { ZONES } from './zones.js';
import {
  craftInField,
  ensureMapState,
  getAvailableActions,
  getTileInfo,
  getVisitedZones,
  getZone,
  getZoneCondition,
  getZoneVantage,
  interactWith,
  movePlayer,
  patrolZone,
  recordEncounterVictory,
  travelToZone,
  useFieldConsumable,
} from './mapState.js';

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

  if (result.triggerShop && game.scenes?.shop) {
    game.setScene('shop', { returnScene: 'explore', shopId: result.triggerShop.shopId });
    return;
  }

  if (result.triggerMuster && game.scenes?.muster) {
    game.setScene('muster', { returnScene: 'explore', musterId: result.triggerMuster.musterId });
    return;
  }

  if (result.triggerCombat) {
    const { encounterId, enemyId } = result.triggerCombat;
    game.setScene('combat', {
      enemyId: enemyId || 'storm_rat',
      encounterId: encounterId || null,
      returnScene: 'explore',
    });
  }
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
    return `${renderExploration({
      state: game.state,
      characterShortcuts: characterShortcutsEnabled(game.root?.ownerDocument || globalThis.document),
      zone: getZone(mapState.zoneId),
      mapState,
      nearbyActions: getAvailableActions(game.state),
      visitedZones: getVisitedZones(game.state),
      storyHtml: storyUI.render(game),
      hasArchive: Boolean(game.scenes?.archive),
      hasQuestJournal: Boolean(game.scenes?.quests),
      hasCharacter: Boolean(game.scenes?.character),
      hasFeats: Boolean(game.scenes?.feats),
    })}`;
  },

  actions: {
    unpinObjective(game, el) { if (game.state.scene === 'explore' && !game.state.combat) unpinQuest(game.state, el?.dataset?.arg); },
    openArchive(game) { if (game.state.scene === 'explore' && game.scenes?.archive && !game.state.combat) game.setScene('archive', { returnScene: 'explore' }); },
    ...storyUI.actions,
    moveNorth(game) {
      handleActionResult(game, movePlayer(game.state, 0, -1, { rng: game.mapRng || Math.random }));
    },
    moveSouth(game) {
      handleActionResult(game, movePlayer(game.state, 0, 1, { rng: game.mapRng || Math.random }));
    },
    moveWest(game) {
      handleActionResult(game, movePlayer(game.state, -1, 0, { rng: game.mapRng || Math.random }));
    },
    moveEast(game) {
      handleActionResult(game, movePlayer(game.state, 1, 0, { rng: game.mapRng || Math.random }));
    },
    waitTurn(game) {
      const mapState = ensureMapState(game.state);
      const zone = getZone(mapState.zoneId);
      const tile = getTileInfo(zone, mapState.x, mapState.y);
      const vantage = getZoneVantage(game.state, zone);
      const condition = vantage.condition;
      mapState.log = [
        ...(mapState.log || []).slice(-19),
        `Standing on ${tile.name} in ${zone.name} (${mapState.x}, ${mapState.y}) — ${vantage.landmark} (${vantage.elevation}m) — ${condition.name}: ${condition.summary} ${vantage.surveyNote}`,
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
    mapPatrol(game) {
      handleActionResult(game, patrolZone(game.state, { rng: game.mapRng || Math.random }));
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
      const raw = el?.dataset?.arg;
      if (!raw) return;
      const [itemId, idxStr] = String(raw).split(':');
      const targetIndex = idxStr !== undefined ? Number.parseInt(idxStr, 10) : 0;
      useFieldConsumable(game.state, itemId, Number.isInteger(targetIndex) ? targetIndex : 0);
    },
    openCharacter(game) {
      if (game.scenes?.character) {
        game.setScene('character', { returnScene: 'explore' });
      }
    },
    openBag(game) {
      if (game.scenes?.bag) {
        game.setScene('bag', { returnScene: 'explore' });
      }
    },
    openFeats(game) { if (game.scenes?.feats) game.setScene('feats', { returnScene: 'explore' }); },
    openQuests(game) { if (game.scenes?.quests) game.setScene('quests', { returnScene: 'explore' }); },
    openJournal(game) {
      if (game.scenes?.bestiary) {
        game.setScene('bestiary', { returnScene: 'explore' });
      }
    },
    craftFieldItem(game, el) {
      const recipeId = el?.dataset?.arg;
      if (!recipeId) return;
      craftInField(game.state, recipeId);
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

  const doc = options.document || game.root?.ownerDocument || globalThis.document;
  const view = options.window || doc?.defaultView || globalThis.window;
  let keyHandler = null;
  if (options.enableKeyboard !== false && view?.addEventListener) {
    keyHandler = (e) => {
      if (game.state?.scene !== 'explore') return;
      if (e.defaultPrevented || e.repeat || e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.target?.isContentEditable || e.target?.closest?.('[contenteditable="true"]')
        || ['INPUT', 'TEXTAREA', 'SELECT'].includes(String(e.target?.tagName || '').toUpperCase())) return;
      if (doc?.querySelector?.('.display-settings:not([hidden])')) return;
      const code = e.code || ({ w: 'KeyW', a: 'KeyA', s: 'KeyS', d: 'KeyD' }[String(e.key || '').toLowerCase()] || e.key);
      if (!characterShortcutsEnabled(doc) && !String(code).startsWith('Arrow')) return;
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
      const actionName = keyMap[code];
      if (actionName && exploreScene.actions[actionName]) {
        e.preventDefault();
        exploreScene.actions[actionName](game);
        game.render();
      }
    };
    view.addEventListener('keydown', keyHandler);
  }

  const cleanup = () => {
    game.bus.off('combat:victory', onCombatVictory);
    if (keyHandler && view?.removeEventListener) {
      view.removeEventListener('keydown', keyHandler);
    }
    installedGames.delete(game);
  };

  installedGames.set(game, cleanup);
  return cleanup;
}
