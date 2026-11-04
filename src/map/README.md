# Map & Exploration Module (`src/map/`)

Provides 9×7 tile-grid exploration, multi-zone navigation, NPC/object proximity interactions, one-time supply caches, field crafting/consumables, and encounter triggers for **Beacon of Stormhaven**.

## Zones (`ZONE_ORDER` / `LOCATION_IDS`)

### Chapter 1 — The Stormhaven Beacon
- `greyhaven` (**Greyhaven — Storm-Battered Frontier Town**):
  - NPCs: `mara` (Warden Mara), `iven` (Apprentice Keeper), `tamsin` (Route Scout).
  - Interactables: `greyhaven_inn` (Hearthstone Inn, 5g rest to effective max HP/MP + status clear, 2g under `shelter_network`), `greyhaven_shop` (Hesta's Goods market stall), `greyhaven_watch_house` (Watch House Muster Board at `(2, 1)`), `greyhaven_board` (Watchmen Noticeboard).
  - Exits: East Gate `(8, 3)` → `ridge_road`; South Pier `(6, 6)` → `saltmere_coast`.
- `ridge_road` (**Ridge Road — Wind-Lashed Cliffside Ascent**):
  - Story Encounter: `ridge_patrol` (`ridge_bandit`) at `(5, 3)`.
  - Optional Encounter: `ridge_hound_den` (`gale_hound`) at `(2, 1)`.
  - Optional Boss Encounter: `ridge_old_tusk` (`old_tusk`) at `(6, 2)`, requires story flag `rescue_reward`.
  - Random Encounters (12%): `ridge_bandit`, `storm_rat`, `gale_hound`, `briar_boar`.
  - Interactables: `dispatch_ridge` at `(5, 5)`, `ridge_supply_cache` at `(1, 5)`.
  - Exits: West Trail `(0, 3)` → `greyhaven`; North Ascent `(7, 0)` → `observatory_ruins`; North Trail `(8, 3)` → `highwatch_pass`.
- `observatory_ruins` (**Observatory Ruins — Shattered Astral Dome**):
  - Story Encounter: `observatory_sentinel` (`gale_hound`) at `(4, 2)`.
  - Optional Encounter: `observatory_construct` (`rust_sentinel`) at `(7, 3)`.
  - Random Encounters (12%): `gale_hound`, `storm_rat`, `rust_sentinel`, `lens_wisp`.
  - Interactables: `dispatch_observatory` at `(1, 3)`, `observatory_lens_pedestal` at `(4, 1)` (requires `observatory_sentinel` cleared), `observatory_forecast_stand` at `(3, 1)` (repeatable Long Watch reading, requires `observatory_sentinel` cleared), `observatory_supply_cache` at `(7, 5)`.
  - Exits: South Steps `(4, 6)` → `ridge_road`; North Causeway `(4, 0)` → `beacon_tower`.
- `beacon_tower` (**Beacon Tower — High Spire of the Stormwatch**):
  - Optional Boss Encounter: `beacon_tide_wraith` (`tide_wraith`) at `(3, 4)`.
  - Interactables: `beacon_cradle` at `(4, 3)`, `tower_supply_cache` at `(3, 2)`.
  - Exits: Descend `(4, 5)` → `observatory_ruins`; Signal Lift `(6, 3)` → `greyhaven`.

### Chapter 2 — Roads to Our Neighbors
- `saltmere_coast` (**Saltmere Coast — Flooded Fishing Settlement**):
  - NPCs: `ona` (Ona Vell, Harbor Elder at `(6, 3)`).
  - Story Rescue Encounter: `saltmere_rescue` (`reef_crawler`) at `(4, 3)`.
  - Optional Encounters: `saltmere_squall_revenant` (`squall_revenant`) at `(1, 1)`, `saltmere_tide_wraith` (`drowned_harbormaster` boss) at `(1, 5)`.
  - Optional Boss Encounter: `saltmere_gloomfin` (`gloomfin`) at `(7, 1)`, requires story flag `rescue_reward`.
  - Random Encounters (12%): `reef_crawler`, `squall_revenant`, `gale_hound`, `wrack_eel`.
  - Interactables: `saltmere_post` (`Saltmere Trading Post` shop at `(2, 3)`), `saltmere_supply_cache` at `(7, 5)`, `saltmere_harbor_lamp` at `(4, 5)`.
  - Exits: North Causeway `(4, 0)` → `greyhaven`.
- `highwatch_pass` (**Highwatch Pass — Wind-Scoured Mountain Outpost**):
  - NPCs: `rusk` (Captain Rusk, Watch Commander at `(3, 5)`).
  - Story Rescue Encounter: `highwatch_rescue` (`frost_wolf`) at `(5, 3)`.
  - Optional Encounters: `highwatch_construct` (`rockslide_golem`) at `(7, 1)`, `highwatch_warlord` (`pass_warlord` boss) at `(1, 1)`.
  - Random Encounters (12%): `frost_wolf`, `rockslide_golem`, `ridge_bandit`, `rime_wight`.
  - Interactables: `highwatch_supply_cache` at `(7, 5)`, `highwatch_cairn` at `(4, 1)`.
  - Exits: West Switchback `(0, 3)` → `ridge_road`; East Gate `(8, 3)` → `sunscar_relay`.

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

- **`stormcrown_spire`** (*Stormcrown Spire — Summit of the Storm*, 9×7, danger 4):
  - Exits: `Lower Switchback → Sunscar Relay` at `(0, 5)` (`toSpawn: 'from_stormcrown_spire'` at `(8, 2)`) and `Signal Lift → Greyhaven` at `(8, 5)`.
  - Survey & Summit Interactables: `survey_records_a` at `(1, 1)`, `survey_records_b` at `(7, 3)`, and `spire_summit` at `(4, 0)` (`requiresEncounterCleared: 'stormcrown_tyrant'`).
  - Cache & Shop: `spire_supply_cache` (`once: true`) at `(2, 5)` and `stormcrown_post` (`kind: 'shop'`, `shopId: 'stormcrown_post'`) at `(4, 5)`.
  - Encounters: `stormcrown_tyrant` boss at `(4, 1)`, `spire_sentry_post` (`spire_sentry`) at `(3, 3)`, `spire_raider_camp` (`ashen_raider`) at `(6, 5)`, and repeatable random/patrol encounters (`ashen_raider`, `spire_sentry`).
- **`patrolZone(gameState, options)` / `mapPatrol`**:
  - Available in any zone with `randomEncounters` to deterministically launch a repeatable encounter (`encounterId: null`) for patrol contracts.

### Chapter 5: The Storm’s Eye (`storms_eye`)
- Summit Passage at Stormcrown Spire `(5,0)` leads to the eye; returning lands at
  Spire `(5,1)`, not on an exit or the Tyrant. The destination requires the exact
  boolean story flag `spire_reward` for walking, nearby exit controls, direct
  travel helpers and already-visited fast travel alike.
- Eye 9×7, danger 5: default/Spire spawn `(1,5)`, west return `(0,5)`, Greyhaven
  signal lift `(8,5)`. Pre-core `storms_eye_post` shop `(4,5)` and one-time
  `eye_supply_cache` `(2,5)` are reachable without any new fight.
- `eye_west_shade` → `tempest_shade` at `(1,2)` guards once-only
  `eye_anchor_west` at `(1,1)`. `eye_east_colossus` → `thunderhead_colossus` at
  `(7,2)` guards once-only `eye_anchor_east` at `(7,1)`.
- `storm_heart_core` → `storm_heart` at `(4,3)` requires both anchor IDs recorded
  as exact `true` in `map.completedInteractions`. Both walking and encounter
  controls enforce this before combat or position/step changes.
- Regular random encounters/patrols contain only the Shade and Colossus. Base
  random chance `.14` uses the existing regional calming and relay multipliers.
- Map schema additions: optional zone `requiresStoryFlag` /
  `travelRequirementMessage`; optional fixed-encounter `requiresInteractions`
  array / `requirementMessage`. Blocking emits no visit/victory/interaction facts.

- Optional Postgame Superboss: `eye_last_squall` (`last_squall`, `The Last Squall`) at `(4, 1)` in `storms_eye` requires story flag `heart_reward === true`.
