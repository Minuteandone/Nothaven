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
  recordEncounterVictory,
  getClearedEncounters,
  getVisitedZones,
} from './mapState.js';
export { exploreScene, installMap } from './exploreScene.js';
