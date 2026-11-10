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
  - Optional Boss Encounter: `ridge_thunderhoof` (`thunderhoof`) at `(6, 4)`, requires story flag `calibration_reward`.
  - Random Encounters (12%): `ridge_bandit`, `storm_rat`, `gale_hound`, `briar_boar`.
  - Interactables: `dispatch_ridge` at `(5, 5)`, `ridge_supply_cache` at `(1, 5)`.
  - Exits: West Trail `(0, 3)` → `greyhaven`; North Ascent `(7, 0)` → `observatory_ruins`; North Trail `(8, 3)` → `highwatch_pass`.
- `observatory_ruins` (**Observatory Ruins — Shattered Astral Dome**):
  - Story Encounter: `observatory_sentinel` (`gale_hound`) at `(4, 2)`.
  - Optional Encounter: `observatory_construct` (`rust_sentinel`) at `(7, 3)`.
  - Optional Boss Encounter: `observatory_lenswarden` (`lenswarden`) at `(7, 1)`, requires story flag `rescue_reward`.
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
  - Optional Boss Encounter: `highwatch_frostmane` (`frostmane`) at `(1, 5)`, requires story flag `rescue_reward`.
  - Optional Boss Encounter: `highwatch_glacierward` (`glacierward_colossus`) at `(5, 5)`, requires story flag `calibration_reward`.
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
  - Optional Boss Encounter: `sunscar_cinderclaw` (`cinderclaw`) at `(4, 5)`, requires story flag `spire_reward`.
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

## Zone Weather & Field Conditions (`ZONE_CONDITIONS`)

Each zone defines a baseline field condition in `src/map/zones.js`, resolved dynamically via `getZoneCondition(gameState, zoneOrId)` in `src/map/mapState.js`:

- **`sheltered` (Lantern Shelter)**: `greyhaven` (and `beacon_tower` once the Headland Beacon is relit via `story.stage === 'complete'` / `story.ending` set to `'protect_town'` or `'share_signal'`, or `flags.beacon_lit`).
- **`squall` (Coastal Squall)**: `ridge_road`, `saltmere_coast`.
- **`gale` (Headland Gale)**: `observatory_ruins`, `beacon_tower` (before the beacon is relit).
- **`rime` (Rime Front)**: `highwatch_pass`, `sunscar_relay`.
- **`tempest` (Arcing Tempest)**: `stormcrown_spire` (before `victory_storm_heart`).
- **`maelstrom` (Maelstrom Eye)**: `storms_eye` (before `victory_storm_heart`).
- **`clear` (Broken Skies)**: `stormcrown_spire` and `storms_eye` once `victory_storm_heart` is recorded.

Surveying the area (`exploreScene.actions.waitTurn`, keyboard `E`) appends the active condition name and summary to the exploration log without mutating story or party state.

## Zone Vantage & Recon Progress (`getZoneProgress`, `getZoneVantage`, `getZoneWeatherBriefing`)

Each zone defines a `vantage` metadata block (`{ landmark, elevation, surveyNote, fieldNote }`) in `src/map/zones.js`.
- `getZoneProgress(gameState, zoneOrId)` returns a read-only summary `{ zoneId, visited, encountersCleared, encountersTotal, cachesOpened, cachesTotal, completedObjectives, totalObjectives, percent }` without mutating `gameState`.
- `getZoneVantage(gameState, zoneOrId)` combines the zone's `vantage` metadata with its active weather `condition`, `progress`, and a read-only `summary` string.
- `getZoneWeatherBriefing(gameState, zoneOrId)` returns a read-only weather and field-modifier briefing (`{ zoneId, zoneName, dangerLevel, condition, baseConditionId, beaconLit, stormCalmed, routeNetworkActive, shelterNetworkActive, baseEncounterChance, baseEncounterPercent, effectiveEncounterChance, effectiveEncounterPercent, modifiers, summary }`).
- `renderExploration` displays a read-only `.zone-recon-summary` line with the active condition name, vantage landmark and elevation, threat/cache completion counts, field note, and `title` tooltip summarizing condition details and survey notes, followed by a visible `.zone-weather-summary` line (`zoneWeatherLine(weatherBriefing?.summary)`) detailing the active condition description, danger rating, step-ambush percentage, and active frontier modifiers.


## Compass Bearing & Safe Click-to-Pathfind (`getCompassBearing`, `getZoneCompassHint`, `findSafePath`, `getSafePathPreview`, `stepAlongSafePath`)

- `getCompassBearing(fromX, fromY, toX, toY)`: Computes the 8-direction cardinal/intercardinal compass code (`N`, `NE`, `E`, `SE`, `S`, `SW`, `W`, `NW`, or `HERE`).
- `getZoneCompassHint(gameState, zoneOrId)`, `getNearbyActionsSummary(gameState)`, `getZoneStationsSummary(gameState, zoneOrId)`, `getZoneContactsSummary(gameState, zoneOrId)`, & `getZoneExitsSummary(gameState, zoneOrId)`: `getZoneCompassHint` resolves the highest-priority active point of interest in the zone (1: uncleared unlocked fixed encounters, 2: unopened one-time field caches/dispatches, 3: unlocked unvisited/available exits) and returns `{ kind, id, label, x, y, distance, bearing, routeSteps, routeEffectiveSteps, routePausesNearThreat, routeEncounterPercent, routeReachable, routeSummary, targetSummary, summary, tooltip }` (rendered with threat-pause and step-ambush caveats in `.terrain-compass__bearing` tooltip). `getNearbyActionsSummary` returns a non-mutating count and breakdown of available actions at the player's current coordinates (`{ zoneId, x, y, totalCount, talkCount, encounterCount, lockedEncounterCount, interactCount, exitCount, patrolAvailable, labels, summary }`), rendered in `.nearby-panel__summary`. `getZoneExitsSummary` returns a read-only summary of outbound routes (`{ zoneId, zoneName, totalExits, unlockedCount, chartedCount, unchartedCount, lockedCount, nearestExit, exits, summary }`), rendered as `<p class="zone-checklist__routes">` inside `.zone-checklist`, while `getZoneStationsSummary` summarizes available/guarded/completed/service field stations and contacts in `<p class="zone-checklist__stations">` `.zone-checklist__contacts` renders `getZoneContactsSummary` (contact roster with roles, in-range count, and nearest contact bearing), and `.terrain-compass__route` renders visible safe-route step and ambush caveats beneath `.terrain-compass__bearing`.
- `findSafePath(zone, mapState, targetX, targetY, gameState)`, `getSafePathPreview(gameState, targetX, targetY, zoneOrId)`, & `stepAlongSafePath(gameState, targetX, targetY, options)`: Computes the shortest walkable 4-directional path across the 9×7 grid avoiding intermediate NPCs, exits, dispatches, and uncleared threats, and previews step count, adjacent-threat caution pauses (masking locked encounters as `Sealed challenge`), and step ambush percentage on terrain grid cell tooltips. Clicking a passable `.map-cell[data-x][data-y]` steps along the route using normal movement steps (random encounters remain possible), pauses 1 tile away from any uncleared fixed encounter, and intentionally engages an uncleared encounter if clicked directly as the destination. `installMap` detaches the root click listener on cleanup.

## Encounter Threat & Loot Drop Previews (`getEncounterPreview`, `getZoneThreatIntel`)

- `getEncounterPreview(enemyId, gameState)`: Returns a read-only difficulty-scaled summary (`{ enemyId, name, hp, baseHp, atk, def, spd, gold, difficulty, boss, tier, known, defeatedCount, drops, summary }`) for own-property enemy species in `ENEMIES` using `scaleEnemy(baseEnemy, getDifficulty(gameState))` without mutating `gameState`. Drop item names are revealed once the species is recorded in `gameState.bestiary` (`known: true`, `Drops: <Item> (<percent>%)`) and masked behind `Drops: Unscouted (<percent>%)` when `known: false`.
- `getZoneThreatIntel(gameState, zoneOrId)`: Returns read-only threat and drop intel for all fixed and roaming encounters in a zone (`{ zoneId, zoneName, dangerLevel, fixedActiveCount, fixedClearedCount, fixedLockedCount, fixedTotalCount, roamingCount, roamingScoutedCount, encounterChance, encounterPercent, fixedEncounters, roamingEncounters, summary }`), masking locked fixed encounters as `Sealed challenge` (`id: 'sealed_challenge'`, `enemyId: 'sealed_challenge'`, `preview: null`, `summary: 'Sealed challenge · Locked'`) until their story or guardian prerequisite is met, and rendering `summary` as `<p class="zone-checklist__threats">` inside `.zone-checklist`.
- `getAvailableActions` attaches `preview` to unlocked nearby `encounter` actions and masks locked encounters (`locked: true`, `enemyId: 'sealed_challenge'`, `label: 'Engage Sealed challenge'`, `preview: null`). `renderExploration` masks locked encounters in `mapGrid` and `nearbyActionButton` (`aria-label="Sealed challenge"`, `title="Sealed challenge · Locked"`) and exposes unlocked threat and drop summaries both in a visible `<p class="nearby-threat-preview">` readout and in `title` tooltips.

## Frontier Atlas / World Map Overview (`getFrontierAtlas`)

- `getFrontierAtlas(gameState)`: Pure, read-only helper returning world-level recon progress across all 9 zones in `ZONE_ORDER` (`{ currentZoneId, zonesVisited, zonesTotal, totalEncountersCleared, totalEncounters, totalCachesOpened, totalCaches, completedObjectives, totalObjectives, overallPercent, summary, zones }`), including each zone's active weather `conditionName`, recon completion `percent`, unlocked status, outbound route `connections` / `connectedNames`, and spoiler-safe `summary`.
- `renderExploration` renders a collapsible `<details class="shortcut-guide frontier-atlas">` summary listing charted frontier regions (with `title` tooltips), active weather conditions, recon progress, and connected routes while keeping uncharted regions unspoiled, and attaches `title` tooltips to item stack rows in `.field-pack__items`.

## Route Briefings & Expedition Log Deduplication (`getRouteBriefing`, `formatExpeditionLog`, `getExpeditionLogSummary`)

- `getRouteBriefing(gameState, toZoneId)`: Pure, read-only helper returning a destination route summary (`{ zoneId, name, subtitle, dangerLevel, visited, unlocked, lockReason, conditionName, percent, encountersCleared, encountersTotal, cachesOpened, cachesTotal, summary }`) for own-property zones in `ZONES`. Locked destinations report `Locked — <lockReason>` and unvisited destinations report `Uncharted region (Danger <N>)` without spoiling weather or objective counts; visited destinations report `<Zone Name> · <Condition Name> · <percent>% recon (<encountersCleared>/<encountersTotal> threats, <cachesOpened>/<cachesTotal> caches)` (or `Safe haven`). Attached to `exit` actions in `getAvailableActions`, exit map cells, and visible `<p class="nearby-threat-preview nearby-route-preview">` readouts in `src/ui/exploration.js`.
- `formatExpeditionLog(lines, limit = 6)`: Pure, read-only helper that collapses consecutive identical expedition log lines into `<line> (×N)` ordered newest-first up to `limit` entries while leaving `mapState.log` untouched.

## Zone Field Checklist & Fast-Travel Route Tooltips (`getZoneChecklist`)

- `getTileInspection(gameState, x, y, zoneOrId)`: Returns a spoiler-safe inspection of the tile at `(x, y)` (defaulting to current position) and its 4 cardinal neighbors (`north`, `west`, `east`, `south`), plus adjacent terrain walkability counts and labels (`passableDirections`, `blockedDirections`, `passableCount`, `blockedCount`, `waysSummary`, rendered in `.terrain-compass__ways`), `adjacentLandmarks`, and `summary` (masking locked encounters as `'Sealed challenge'`). Rendered in `.terrain-compass__adjacent`.
- `getNpcBriefing(gameState, npcOrId, zoneOrId = null)`: Pure, read-only helper returning a field contact briefing (`{ id, name, role, x, y, zoneId, zoneName, distance, adjacent, line, defaultLine, summary }`) for any zone NPC. Attached to `talk` actions in `getAvailableActions`, NPC checklist entries in `getZoneChecklist`, NPC map cell tooltips, and visible `<p class="nearby-threat-preview nearby-talk-preview">` readouts in `src/ui/exploration.js`.
- `getInteractableBriefing(gameState, interactableOrId, zoneOrId = null)`: Pure, read-only helper returning a spoiler-safe field station and cache briefing (`{ id, name, kind, x, y, once, completed, requiresEncounterCleared, guardianCleared, guardianName, status, costGold, canAfford, rewardCount, summary }`) for any zone interactable (`inn`, `shop`, `muster`, `cache`, `dispatch`, `relic`, `beacon`, `quest`, `lore`). Summarizes inn rest cost (`5g` or `2g` with `shelter_network`) and affordability, unopened cache supply item counts without spoiling item names, guardian encounter requirements (`Guarded by <Guardian>`), and completion state. Attached to `interact` actions in `getAvailableActions`, interactable map cells, and visible `<p class="nearby-threat-preview nearby-interact-preview">` readouts in `src/ui/exploration.js`.
- `getZoneChecklist(gameState, zoneOrId)`: Pure, read-only helper returning a structured point-of-interest roster for the zone (`{ zoneId, name, originX, originY, npcs, encounters, interactables, exits, counts, summary }`) with coordinates, relative tile distances & compass bearings, spoiler-safe tooltips (`summary`), and live status (`Active`, `Cleared`, `Locked`, `Available`, `Completed`, `Service`, `Charted`, `Uncharted`).
- `renderExploration` renders a collapsible `<details class="shortcut-guide zone-checklist">` in the Navigator panel and attaches spoiler-safe `getRouteBriefing` summaries as `title` tooltips on `Visited Routes` fast-travel buttons via `uiButton({ ..., title })`.

### Patrol Briefings & Frontier Atlas Totals
- `getPatrolBriefing(gameState, zoneOrId = null)`: Pure, read-only helper returning roaming encounter probabilities and scouted status (`{ zoneId, zoneName, hasHostiles, encounterChance, encounterPercent, scoutedCount, totalCount, hostiles, summary }`).
- Masks unscouted roaming foes as `enemyId: 'unscouted_hostile'`, `name: 'Unscouted hostile'` (`Unscouted hostile (<percent>%)`, `drops: []`, `dropSummary: null`) until defeated at least once in `gameState.bestiary`, and reveals `${name} (${percent}%, ${hp} HP)` plus scouted `drops` and `dropSummary` once scouted.
- Attached to `patrol` actions in `getAvailableActions`, surfaced as the `title` tooltip on the `Patrol <Zone> for Hostiles` button, and rendered as `<p class="zone-checklist__patrols">` inside `.zone-checklist` in `src/ui/exploration.js`.
- `.frontier-atlas__totals` in `src/ui/exploration.js` summarizes aggregate campaign threats cleared (`totalEncountersCleared/totalEncounters`) and caches opened (`totalCachesOpened/totalCaches`).
- `getFrontierWeatherSummary(gameState)` — Pure read-only summary of active weather conditions across charted frontier regions (`{ currentZoneId, chartedCount, unchartedCount, zonesTotal, shelteredCount, clearCount, hazardousCount, calmedCount, beaconLit, stormCalmed, routeNetworkActive, shelterNetworkActive, activeModifiers, chartedRegions, summary }`), keeping uncharted regions masked and rendered as `.frontier-atlas__weather` inside `.frontier-atlas` in `src/ui/exploration.js`.
- `getFieldServicesSummary(gameState)` — Pure read-only summary of repeatable field services (`inn`, `shop`, `muster`) across charted regions, plus live inn rest cost (`5g` vs. `2g` with `shelter_network`), `routeNetworkActive`, `stormCalmed` status, and field pack supply/craft readiness (`consumableStacks`, `consumableUnits`, `craftableCount`, `craftableNames`, `packSummary`), rendered as `.frontier-atlas__services` and `.frontier-atlas__pack` (plus `useFieldItem` button `title` tooltips) in `src/ui/exploration.js`.
- **Field Consumable Previews, Pack Manifest, & Party Readiness (`src/map/mapState.js`, `src/ui/exploration.js`)**: `getFieldConsumablePreview(gameState, itemId, targetIndex)` computes immediate HP/MP restoration and status-cure previews for `useFieldItem` buttons in the Field Pack without mutating state, `getFieldPackSummary(gameState)` summarizes Field Pack stack/item counts by category and craftable recipes (rendered in `.field-pack__summary`), and `getPartyFieldReadiness(gameState)` summarizes aggregate party HP/MP percentages, active status conditions, and rest readiness.
- **Regional Act Completion & Expedition Summary (`src/map/mapState.js`, `src/ui/exploration.js`)**: `getExpeditionProgressSummary(gameState)` computes pure read-only regional theater progress across Act I (`Highland Signal Line`), Act II (`Frontier Outposts`), and Act III (`Upper Tempest`) without leaking uncharted zone names, rendered as `.frontier-atlas__acts` inside `.frontier-atlas`.
- **Fast-Travel Route Briefing (`src/map/mapState.js`, `src/ui/exploration.js`)**: `getFastTravelBriefing(gameState, currentZoneOrId)` computes a pure read-only summary across all charted fast-travel destinations outside the active zone (`{ currentZoneId, destinationCount, securedCount, activeZoneCount, remainingEncounters, remainingCaches, safeHavenAvailable, destinations, summary }`), rendered as `.visited-routes__summary` inside `.visited-routes`.
- `getFrontierPatrolSummary(gameState = null)`: Summarizes roaming patrol regions (`patrolZoneCount`, `safeZoneCount`, `fullyScoutedZoneCount`) and Bestiary scouting progress (`scoutedSpeciesCount`, `chartedSpeciesTotal`, `unscoutedSpeciesCount`, `scoutedSpeciesNames`) across charted frontier regions without spoiling uncharted regions or unscouted species; rendered in `.frontier-atlas__patrols`.
- `getFrontierContactsSummary(gameState = null)`: Summarizes NPC field contacts across charted frontier regions (`contactZoneCount`, `contactCount`, `currentZoneContactCount`, `inRangeCount`, `chartedContacts`) without spoiling contacts in unvisited regions; rendered in `.frontier-atlas__contacts`.
- `getFrontierThreatsSummary(gameState = null)`: Summarizes fixed frontier threats across charted regions (`safeZoneCount`, `threatZoneCount`, `fullyClearedZoneCount`, `chartedThreatTotal`, `clearedThreatCount`, `activeThreatCount`, `lockedThreatCount`, `currentZoneThreatTotal`, `currentZoneClearedCount`, `currentZoneActiveCount`, `currentZoneLockedCount`, `chartedRegions`, `chartedThreats`, and `summary`), rendered as `.frontier-atlas__threats` inside `.frontier-atlas` while masking unvisited regions and locked (`Sealed challenge`) encounters.
- `getFrontierRoutesSummary(gameState = null)` — pure read-only helper summarizing outbound frontier routes across charted regions for `.frontier-atlas__routes` while masking unvisited destination names.
- `getFrontierStationsSummary(gameState = null)`: Summarizes interactable field stations (`stationZoneCount`, `chartedStationTotal`, `availableCount`, `guardedCount`, `completedCount`, `serviceCount`, `currentZoneStationTotal`, `currentZoneAvailableCount`, `currentZoneGuardedCount`, `currentZoneCompletedCount`, `currentZoneServiceCount`, `chartedRegions`, `chartedStations`, and `summary`) across charted regions without spoiling unvisited regions; rendered as `.frontier-atlas__stations` inside `.frontier-atlas`.
- `getFrontierCachesSummary(gameState = null)`: Summarizes frontier supply caches (`safeZoneCount`, `cacheZoneCount`, `chartedCacheTotal`, `openedCacheCount`, `unopenedCacheCount`, `unclaimedSupplyUnits`, `currentZoneCacheTotal`, `currentZoneOpenedCount`, `currentZoneUnopenedCount`, `currentZoneUnclaimedUnits`, `chartedRegions`, `chartedCaches`, and `summary`) across charted regions without spoiling unvisited regions or item names; rendered as `.frontier-atlas__caches` inside `.frontier-atlas`.
- `getZoneCachesSummary(gameState = null, zoneOrId = null)`: Summarizes one-time supply caches in the current zone (`zoneId`, `zoneName`, `totalCaches`, `openedCount`, `readyCount`, `guardedCount`, `nearestCache`, `caches`, and `summary`) with compass bearing, tile distance, guardian status, and spoiler-safe reward item counts; rendered as `.zone-checklist__caches` inside `.zone-checklist`.
