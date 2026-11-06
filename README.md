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
defeat, and saved progress. After the earned Ridge victory, it also checks three
manual archive slots, 130% text layout, overwrite/load/delete confirmations and
cancellation, exact whole-journey restoration including a Title reload, and
unchanged quick-save bytes.
Only randomness is controlled; stats, items, positions, story facts, and victories
are never injected. This short new-game route is **not** the full campaign,
postgame, cross-browser, accessibility, or balance test suite.

The same fresh route also toggles letter/number shortcuts off and back on through
Display, checks device-local persistence after Save/reload, and exercises blocked
exploration/combat keys alongside working arrows, Escape, and native buttons.
These keyboard checks do not validate speech input or screen-reader support.

Screenshots and Playwright traces are written to the ignored `browser-artifacts/`
folder, including a failure screenshot when possible. View a trace with
`npx playwright show-trace browser-artifacts/320-trace.zip`. The local server only
serves game source/assets.

CI also offers an optional **browser-smoke** job: open a branch pipeline and run
that manual job to install the locked dependencies and Chromium, then execute the
same smoke. It has a 15-minute limit and is explicitly non-blocking; it does not
change the default Node checks or deployment script. On a browser-test failure,
its artifacts retain only the failing viewport's screenshot(s) and trace(s), when
available, for one day. Setup failures may provide only the job log. Successful
viewports are not uploaded; use the local command above to retain a complete run.

The browser smoke also checks the Muster Board at 115% and 130% text size,
including heading/count containment, without changing party progress.

The portable smoke also compares its one genuinely defeated Ridge Bandit at 115%
and 130% text size, then checks Remove/re-add/Clear and Back without progress changes.
This fresh route does not claim three-card comparison coverage.

With that same earned foe, the smoke checks Field Journal All/Bosses/Regular and
explicit recorded-name Search at 115% and 130% in all three viewports. Category
and query combine; unknown names, placeholders and raw IDs never match. A zero-result
catalogue keeps the one comparison card and full progress totals. Long and hostile
queries, Clear retaining category, Back/reopen reset, 44px controls, document fit,
whole journey state and raw quick-save preservation are covered. This remains a
one-victory route, not three-card, full-campaign, screen-reader or full visual coverage.

The smoke also searches the Bag containing its genuinely purchased rations at
115% and 130% text size in all three viewports. It checks item/recipe matching,
sort retention, Clear, reset on reopening, escaped query text, and a 120-character
unbroken no-match query with both document and visible-text bounds. Whole journey
state and the raw quick save stay unchanged; this does not test crafting or make
screen-reader or whole-game visual claims.

## Earned campaign regression

`tests/campaign-integration.test.mjs` walks sixteen combinations of the original
ending, early exploration, rescue order and relay service through the campaign.
Supply Lines coverage splits eight Coastal and eight Highland surveys across those
combinations: permanent acceptance, fresh regional patrol then station inspection,
fresh Sunscar patrol then junction reading, explicit 280-gold reporting, and
Save/load at each step. It checks premature inspections, unavailable/stale actions,
conversation without payment, exact combat rewards, and preservation of older
quests and expedition state.
Signal Calibration coverage rejects acceptance before the Watch reward, walks to the
Eye through two premature lower-station inspections, then takes fresh readings
in downhill order. Each step survives save/load; explicit reporting pays 220 gold
once while preserving the earlier story, relay choice, party, inventory and records.
Cinderclaw coverage approaches its Sunscar tile before the Spire payment, checks
that both encounter actions refuse without moving or consuming map RNG, then
returns after payment with earned equipment and allies for a real fight. It checks
260 XP per member, 140 gold, deterministic loot, Dune Breaker, unchanged Trial
Warden/drill eligibility, one-time rewards, and save/load persistence. This fixed-RNG
route is a regression check, not a first-availability difficulty estimate.

Thunderhoof coverage checks its Ridge gate before Calibration payment with both
encounter controls and no map RNG or events, then fights it after Signal Line
Patrol using earned allies, gear and supplies. It checks exact 400 XP per member,
240 gold and deterministic loot minus used tonics, a single victory event,
unchanged story and drill records, Finish/save-load persistence and stale-action
rejection. All sixteen routes include this optional fight before the Last Squall;
fixed randomness does not establish its first-availability difficulty.

Glacierward coverage checks the unpaid Calibration gate in Highwatch with direct
encounter and southward movement actions, no map RNG or scene/story/victory events,
and no state change beyond the refusal log. All sixteen routes then physically
reach and defeat the optional colossus after Thunderhoof using earned party levels,
gear and supplies. Checks cover exact 440 XP per member, 260 gold and deterministic
loot minus actual tonic use; one victory event; Finish/save-load and stale-action
rejection; unchanged older story, reserve and drill records; and exclusion from
the seven drills and four Field Trials. This is one deterministic Standard tactical
path, not a balance survey, browser, accessibility or visual test.

The browser smoke also exports its genuinely earned Ridge checkpoint through the
Archive textarea and selects the whole text, then manually fills that text into
an independent, initially empty browser context. At 130% text and all three
widths it checks explicit destination preview, cancel, confirmation of the captured
preview despite later paste-box edits, exact checkpoint/timestamp preservation,
reload, and a separate confirmed Load. Malformed markup is refused, leaving the
source archive and live journey unchanged; transfer controls fit at least 44px.
Only the chosen destination archive key may be created: neither a quick save nor
other slots are written, and import does not automatically resume the journey.
This uses native export/select-all and Playwright textarea fill, not the operating
system clipboard, downloads, or cloud synchronization. Separate transfer traces
and screenshots use the `archive-transfer` filename prefix after the width. It
remains a Chromium smoke check, not a full campaign, screen-reader, cross-browser,
visual-design, or balance evaluation.


## Optional earned first-chapter browser journey

After the same Playwright installation above, run `npm run test:browser:chapter`.
This separate suite leaves `npm run test:browser` and its optional CI job unchanged.
It starts a restricted loopback server and six fresh Chromium journeys: both beacon
endings at 320, 375, and 768px, using 130% text. Native buttons physically traverse
Greyhaven, Ridge Road, the Observatory and Beacon Tower, win the two chapter fights,
collect both dispatches, recruit Tamsin/Iven and rest, verify the premature tower
visit cannot bypass the council, and check exact payments and exclusive endings.
Five exploration checkpoints per journey save/reload/Continue and compare the whole
state and unchanged saved bytes. Repeated home conversations and a chronicle roundtrip
must not repay rewards. Choice/ending/save controls and document width are checked;
screenshots and traces are retained under ignored `browser-artifacts/chapter/`, with
case-specific failure screenshots when possible.

Only `Math.random` is fixed to 0.5; no stats, items, locations, flags, saves, or
victories are injected. This covers the normal first-chapter route, not early-order
variants, the full postgame, balance, other browsers, or actual screen-reader use.
It is an opt-in local command, not included in the existing CI browser job.

## Optional earned bounty browser journey

After `npm ci` and the Playwright Chromium installation described above, run
`npm run test:browser:bounties`. This separate opt-in suite leaves the existing
smoke, chapter, default unit-test command and CI jobs unchanged. Three fresh
journeys at 320/375/768px and 130% text start with eighteen locked contracts, win the
Ridge encounter and six real rat patrols, accept a newly unlocked contract with
no historical progress, check the four-victory cap, and claim exactly 30 gold
and one Scrap Metal. Reaccepting starts at zero; abandoning preserves rewards.
Whole-state Save/reload/Continue checkpoints cover ready and claimed contracts.

The journey then earns three more rat contracts through ordinary acceptance,
rest, travel, and four real patrol victories each. Claims two and three pay 30
gold; promotion to Contract Hand happens only on claim three, and claim four
pays the advertised 33 gold. Each claim checks the entire resulting state,
reward item, cleared contract, rank text, and disappearance of the claim control.
Whole Explore Save/reload/Continue checkpoints after each claim preserve the rank.

The Feats Service Record shows Notice Runner when fresh and after claim two,
then Contract Hand after claims three and four. All/earned/pending filters check
that exact rank, whole live-state and quick-save stability, and native Back.

On the original contract route, the Journey Journal is checked before acceptance,
after acceptance and every victory, after reload, and after claiming. All three filters preserve the whole
live state and quick-save text, and native Back restores the previous scene.
The active/ready text, document width, and control sizes are checked; screenshots
and traces go under ignored `browser-artifacts/bounties/`, including failure
screenshots when possible. Only randomness is controlled: no progress, items,
stats, coordinates, or saves are injected. This is not completion of all eighteen
contracts, actual screen-reader testing, cross-browser coverage, a full visual
audit, or a balance certificate.

### Earned regional browser journey

Run `npm run test:browser:regions` after installing Playwright Chromium. This
separate suite starts 12 fresh journeys: widths 320/375/768, both chapter endings,
and both coast-first/highland-first rescue orders, all at 130% text size. It
retains the chapter checks and continues through purchased Relief supplies,
both physical rescue routes and one-time caches, explicit payments, and
recruiting Bram/Sela while retaining Tamsin/Iven in reserve. Exact combat rewards
and eleven whole Explore Save/reload checkpoints are checked per journey.
Progress uses native UI actions; evaluations only observe state/catalog/layout,
and Math.random is held at 0.5 to avoid incidental patrols. Ignored screenshots
and traces go to `browser-artifacts/regions/`, including failures. This is not
a full-campaign, screen-reader, cross-browser, or first-availability balance proof.
