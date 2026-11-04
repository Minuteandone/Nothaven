# Map & Exploration Module (`src/map/`)

Provides 9×7 tile-grid exploration, multi-zone navigation, NPC/object proximity interactions, one-time supply caches, field crafting/consumables, and encounter triggers for **Beacon of Stormhaven**.

## Zones (`ZONE_ORDER` / `LOCATION_IDS`)

### Chapter 1 — The Stormhaven Beacon
- `greyhaven` (**Greyhaven — Storm-Battered Frontier Town**):
  - NPCs: `mara` (Warden Mara), `iven` (Apprentice Keeper), `tamsin` (Route Scout).
  - Interactables: `greyhaven_inn` (Hearthstone Inn, 5g rest to effective max HP/MP + status clear), `greyhaven_shop` (Hesta's Goods market stall), `greyhaven_board` (Watchmen Noticeboard).
  - Exits: East Gate `(8, 3)` → `ridge_road`; South Pier `(6, 6)` → `saltmere_coast`.
- `ridge_road` (**Ridge Road — Wind-Lashed Cliffside Ascent**):
  - Story Encounter: `ridge_patrol` (`ridge_bandit`) at `(5, 3)`.
  - Optional Encounter: `ridge_hound_den` (`gale_hound`) at `(2, 1)`.
  - Interactables: `dispatch_ridge` at `(5, 5)`, `ridge_supply_cache` at `(1, 5)`.
  - Exits: West Trail `(0, 3)` → `greyhaven`; North Ascent `(7, 0)` → `observatory_ruins`; North Trail `(8, 3)` → `highwatch_pass`.
- `observatory_ruins` (**Observatory Ruins — Shattered Astral Dome**):
  - Story Encounter: `observatory_sentinel` (`gale_hound`) at `(4, 2)`.
  - Optional Encounter: `observatory_construct` (`rust_sentinel`) at `(7, 3)`.
  - Interactables: `dispatch_observatory` at `(1, 3)`, `observatory_lens_pedestal` at `(4, 1)` (requires `observatory_sentinel` cleared), `observatory_supply_cache` at `(7, 5)`.
  - Exits: South Steps `(4, 6)` → `ridge_road`; North Causeway `(4, 0)` → `beacon_tower`.
- `beacon_tower` (**Beacon Tower — High Spire of the Stormwatch**):
  - Optional Boss Encounter: `beacon_tide_wraith` (`tide_wraith`) at `(3, 4)`.
  - Interactables: `beacon_cradle` at `(4, 3)`, `tower_supply_cache` at `(3, 2)`.
  - Exits: Descend `(4, 5)` → `observatory_ruins`; Signal Lift `(6, 3)` → `greyhaven`.

### Chapter 2 — Roads to Our Neighbors
- `saltmere_coast` (**Saltmere Coast — Flooded Fishing Settlement**):
  - Story Rescue Encounter: `saltmere_rescue` (`gale_hound`) at `(4, 3)`.
  - Optional Boss Encounter: `saltmere_tide_wraith` (`tide_wraith`) at `(1, 5)`.
  - Interactables: `saltmere_supply_cache` at `(7, 5)`, `saltmere_harbor_lamp` at `(4, 5)`.
  - Exits: North Causeway `(4, 0)` → `greyhaven`.
- `highwatch_pass` (**Highwatch Pass — Wind-Scoured Mountain Outpost**):
  - Story Rescue Encounter: `highwatch_rescue` (`ridge_bandit`) at `(5, 3)`.
  - Optional Encounter: `highwatch_construct` (`rust_sentinel`) at `(7, 1)`.
  - Interactables: `highwatch_supply_cache` at `(7, 5)`, `highwatch_cairn` at `(4, 1)`.
  - Exits: West Switchback `(0, 3)` → `ridge_road`.

## Public API (`src/map/index.js`)
- `installMap(game, options)`: Registers the `'explore'` scene, initializes `game.state.map`, listens to `combat:victory` to record cleared encounters, and wires optional keyboard navigation (WASD / Arrow keys).
- `exploreScene`: Scene implementation (`onEnter`, `render`, `actions`) compatible with `Game` and `createStoryUI`.
- Pure state helpers: `createMapState`, `ensureMapState`, `movePlayer`, `interactWith`, `travelToZone`, `recordEncounterVictory`, `getAvailableActions`, `getClearedEncounters`, `getVisitedZones`, `pickRandomEncounter`, `useFieldConsumable(gameState, itemId, targetIndex = 0)`, `craftInField(gameState, recipeId)`.

### Chapter 3: Sunscar Relay (`sunscar_relay`)
- **`sunscar_relay`** (Sunscar Relay — Inland Signal Station, 9×7):
  - Connected via `highwatch_pass` East Gate `(8, 3)` <-> `sunscar_relay` West Trail `(0, 3)`, plus `Signal Lift → Greyhaven` at `(6, 5)`.
  - Quest Interactables: `relay_junction` at `(3, 1)` and `relay_console` at `(7, 3)`.
  - Main Encounter: `relay_warden` (`enemyId: 'relay_warden'`) at `(5, 3)`.
  - Optional Encounter: `sunscar_drone_patrol` (`enemyId: 'relay_drone'`) at `(7, 1)`.
  - Shop & Supply Cache: `relay_outpost` (`kind: 'shop'`, `shopId: 'relay_outpost'`) at `(6, 4)` and one-time `relay_supply_cache` at `(2, 5)`.
  - **Relay Choice Effects (`state.story.flags.relay_choice`)**:
    - `shelter_network`: reduces map inn rest cost (`greyhaven_inn`) from `5g` to `2g` via `getInnCost`.
    - `route_network`: halves `zone.randomEncounterChance` in `movePlayer` via `getEffectiveRandomEncounterChance` while leaving fixed encounters unchanged.
