# Map & Exploration Module (`src/map/`)

Provides tile-grid exploration, multi-zone navigation, NPC/object proximity interactions, and encounter triggers for **Beacon of Stormhaven**.

## Zones (`LOCATION_IDS`)
- `greyhaven`: Storm-battered frontier hub town containing NPCs `mara`, `iven`, and `tamsin`, plus the Hearthstone Inn (`greyhaven_inn`) and noticeboard.
- `ridge_road`: Wind-lashed cliffside pass containing the main encounter `ridge_patrol` and courier report `dispatch_ridge`.
- `observatory_ruins`: Shattered astral dome containing the main encounter `observatory_sentinel`, report `dispatch_observatory`, and the lens pedestal.
- `beacon_tower`: High storm spire overlooking Greyhaven where the final beacon alignment choice (`protect_town` or `share_signal`) is made.

## Public API (`src/map/index.js`)
- `installMap(game, options)`: Registers the `'explore'` scene, initializes `game.state.map`, listens to `combat:victory` to record cleared encounters, and wires optional keyboard navigation (WASD / Arrow keys).
- `exploreScene`: Scene implementation (`onEnter`, `render`, `actions`) compatible with `Game` and `createStoryUI`.
- Pure state helpers: `createMapState`, `ensureMapState`, `movePlayer`, `interactWith`, `travelToZone`, `recordEncounterVictory`, `getAvailableActions`, `getClearedEncounters`, `getVisitedZones`.
