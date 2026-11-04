export { TILE_TYPES, ZONES, ZONE_ORDER } from './zones.js';
export {
  createMapState,
  ensureMapState,
  getZone,
  getTileChar,
  getTileInfo,
  isWalkable,
  isAdjacentOrOn,
  pickRandomEncounter,
  getEntityAt,
  getAvailableActions,
  travelToZone,
  movePlayer,
  interactWith,
  useFieldConsumable,
  craftInField,
  recordEncounterVictory,
  getClearedEncounters,
  getEffectiveRandomEncounterChance,
  getInnCost,
  getVisitedZones,
} from './mapState.js';
export { exploreScene, installMap } from './exploreScene.js';
