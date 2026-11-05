# Beacon of Stormhaven

A single-player, turn-based browser RPG built collaboratively by the AI Village agents.
The storms have broken the beacon that shields the frontier town of **Greyhaven**; the party must recover the observatory lens and relight it.

Play: https://stormhaven-rpg.pages.dev (deployed automatically from `main`).

For controls, preparation tips, and a clearly marked five-chapter walkthrough, see the
[Player Guide](docs/PLAYER_GUIDE.md).

## Run locally
```
python3 -m http.server 8123   # then open http://localhost:8123
```
Vanilla JS ES modules — no build step, no dependencies.

## Architecture
- `src/engine.js` — `Game` class. Scenes are `{ render(game) -> html, onEnter?(game, data), actions?: { name(game, el) } }`. Buttons with `data-action="name"` call the current scene's action, then the game re-renders.
- `src/state.js` — `createInitialState()`, `saveGame`, `loadGame`. All game data lives in `game.state` (plain JSON, must stay serializable).
- `src/events.js` — `bus.on/off/emit`. Current events: `scene:enter {name,data}`, `combat:victory {enemyId}`. Story module should listen/emit here (e.g. `story:event {type,...}`).
- `src/scenes/` — title, town, combat (starter versions; owners should replace freely).
- `src/data/` — shared data tables (enemies, etc.).

## Ownership
| Area | Path | Owner |
|---|---|---|
| Core engine, scaffold, CI | `src/engine.js`, `src/state.js`, `src/main.js` | Claude Opus 5.5 |
| Combat | `src/combat/`, `src/scenes/combat.js`, `src/data/enemies.js` | DeepSeek-V4-Pro |
| Map / exploration | `src/map/` | Gemini 4 Argon |
| Items / inventory | `src/items/` | GLM-5.3 Flash |
| Story / quests / dialogue | `src/story/` | GPT-6 Astra |
| UI / art / audio | `src/ui/`, `style.css` | Kimi K3.1 Pro |

## Rules
1. Never push to `main` directly — open a merge request from a feature branch.
2. Every MR must be reviewed and approved (comment) by at least one *other* agent before merging. Reviewers: read the full diff.
3. Keep game content data-driven and state JSON-serializable.

## Chapter three: A Signal of Our Own
After explicitly reporting both settlement rescues, accept the council’s relay commission in Greyhaven. Reach **Sunscar Relay** through Highwatch Pass’s East Gate, inspect `relay_junction`, defeat fixed encounter `relay_warden`, and inspect `relay_console`. Early visit, interaction, and victory facts persist even before the commission. The journal guides each missing step; NPC conversation never accepts or completes the commission automatically.

At the console (within one map step of 7,3), explicitly choose **shelter_network** (paid rests cost 2g instead of 5) or **route_network** (half random encounter chance, fixed encounters unchanged). `story.flags.relay_choice` is permanent and exclusive; completion pays **100g once**. Chapter-one `story.stage` and `story.ending` remain unchanged. The map implements route chance and map-inn effects; the town uses `restPrice(story)` for both its label and action.

`src/story/relay.js` is the pure reducer/journal/dialogue module. Commands are `relay-accept` and `relay-choose {choiceId}`; facts use existing `visit`, `interact`, and `victory {encounterId}` events. Flags are `relay_accepted`, `relay_visit`, `relay_junction`, `relay_victory`, `relay_console`, `relay_choice`, and `relay_reward`. Shared story UI guards location and rejects stale console choices after walking away. Story rewards are committed before `story:updated`; observers must not pay them again. Focused tests cover prerequisites, early facts, both original endings × both new choices, exclusivity, immutable inputs, UI guards, real save/load and event wiring, no ending replay, and town rest price/effective caps.

### Optional companion commissions

Greyhaven's collapsed **Companion commissions** board offers four personal requests
as their companions unlock; recruitment and active party slots are not required.
Accept explicitly, complete the fixed encounter and landmark, then report explicitly
in Greyhaven. Tamsin pays 25 gold (ridge hound den + ridge dispatch), Iven 35
(eastern observatory construct + lens pedestal), Bram 45 (Drowned Harbormaster +
harbor lamp), and Sela 45 (Rockslide Golem + signal cairn), each once per save.
Only accepted requests enter the journal. These requests do not alter the original
beacon ending, relay service, rescue progression, or finale.

`src/story/commissions.js` retains exact fixed-encounter and interaction facts even
before acceptance; species-only patrol victories cannot substitute. On acceptance,
the town UI reconciles exact boolean entries from the **live** map's
`clearedEncounters` and `completedInteractions` for older saves, without fabricating
combat events. Old once-only dispatch/pedestal inspections therefore still count;
the repeatable harbor lamp and cairn can be inspected again if their earlier use
was not recorded. Reports and acceptance use the same authoritative location getter
as board rendering. Rewards are committed before `story:updated`, as with other quests.

## Optional chapter five: The Storm’s Heart

After the summit survey is reported (`spire_reward`), Greyhaven offers an optional
**200g** expedition. Explicitly accept, visit `storms_eye`, ground both
`eye_anchor_west` and `eye_anchor_east`, defeat fixed encounter `storm_heart_core`,
and explicitly report in Greyhaven. Earlier discoveries count. Conversation never
accepts or reports for the player, and neither the original beacon ending nor the
Chapter 4 finale is replayed or changed.

`src/story/heart.js` owns the pure reducer, journal, and dialogue. Commands are
`heart-accept` and `heart-report`; progress flags are `heart_accepted`, `heart_visit`,
`eye_anchor_west`, `eye_anchor_east`, `victory_storm_heart`, and `heart_reward`.
Only the exact fixed-core victory sets `victory_storm_heart`, not a species-only
victory. This flag immediately halves random encounters on Stormcrown Spire and
in the Storm’s Eye, independent of accepting/reporting the gold commission;
route-network guidance stacks to one quarter of base chance. Other regions and
fixed encounters are unchanged. The prose describes a regional storm breaking,
not the end of all weather or danger. Rewards commit before `story:updated`.

## Optional real-browser smoke test

The default `npm test` stays a dependency-free Node suite. To additionally check
real Chromium navigation, narrow-screen layout, and a short earned combat route:

```sh
npm ci
npx playwright install chromium  # add --with-deps if your system needs browser libraries
npm run test:browser
```

The smoke test starts its own loopback-only server on a free port and fresh browser
contexts at **320, 375, and 768px**. It uses actual buttons for the guide, Journey
Journal filters, bestiary, muster, bag, Buy 5 purchase, save/reload, exploration,
and a real ridge patrol victory. Combat uses actual keyboard shortcuts for menus,
Attack, and Continue; disabled Burst, modifiers, and the display-overlay guard
must not change state. It checks horizontal overflow, read-only screens and the
full retained battle chronicle, actual purchase totals, victory summary, recorded
defeat, and saved progress.
Only randomness is controlled; stats, items, positions, story facts, and victories
are never injected. This short new-game route is **not** the full campaign,
postgame, cross-browser, accessibility, or balance test suite.

The same fresh route also toggles letter/number shortcuts off and back on through
Display, checks device-local persistence after Save/reload, and exercises blocked
exploration/combat keys alongside working arrows, Escape, and native buttons.
These keyboard checks do not validate speech input or screen-reader support.

Screenshots and Playwright traces are written to the ignored `browser-artifacts/`
folder, including a failure screenshot when possible. View a trace with
`npx playwright show-trace browser-artifacts/320-trace.zip`. No changes are made to
CI or the deployment path, and the local server only serves game source/assets.

The browser smoke also checks the Muster Board at 115% and 130% text size,
including heading/count containment, without changing party progress.

The portable smoke also compares its one genuinely defeated Ridge Bandit at 115%
and 130% text size, then checks Remove/re-add/Clear and Back without progress changes.
This fresh route does not claim three-card comparison coverage.
