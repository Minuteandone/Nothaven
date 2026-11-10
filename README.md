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

## Damage-preview action parity

`tests/damagePreview-integration.test.mjs` compares previews with real solo
`heroAction` results across catalog foes, six levels, bare and fitted Tempest
Edge gear, all four difficulties, and five RNG values. It checks exact damage
endpoints, read-only inputs, and absent previews for non-damaging skills without
copying the damage formula. HP/MP are amplified only in these synthetic fixtures;
this is regression coverage, not an earned journey or a balance survey.

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
At 115% and 130% text size in all three viewports, the earned Ridge fight also
checks all seven command buttons, visible labels and shortcut hints for containment
and 44px minimum height, while preference changes preserve the whole fight and
quick-save bytes; this is layout coverage, not a full campaign or screen-reader test.

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

The fresh locked board has no region buttons. After genuine Bandit and Rat
victories, native Ridge Road, Observatory Ruins, and Highwatch Pass filters
show exact contract lists, retain the active Rat contract outside its region,
and distinguish matching counts from that extra active notice. Checks cover
one pressed filter, whole live-state and quick-save stability, reopening at
All regions with all eighteen rows, and 44px controls fitting at 130% text.

The journey then earns three more rat contracts through ordinary acceptance,
rest, travel, and four real patrol victories each. Claims two and three pay 30
gold; promotion to Contract Hand happens only on claim three, and claim four
pays the advertised 33 gold plus a second Scrap Metal from mastery. Each claim checks the entire resulting state,
reward item, cleared contract, rank text, and disappearance of the claim control.
Whole Explore Save/reload/Continue checkpoints after each claim preserve the rank.

The Feats Service Record shows Notice Runner when fresh and after claim two,
then Contract Hand after claims three and four. All/earned/pending filters check
that exact rank, whole live-state and quick-save stability, and native Back.
They also verify Contracts mastered stays at 0 of 18 until claim three, then
reads 1 of 18 after claims three and four; this is not an all-contract mastery run.

Native Board order, Highest pay, Fewest claims, and Easiest hunt controls are checked on the
fresh locked board, each earned region, the reopened full board, and after real
claims two through four. Explicit expected orders cover tied and non-tied claim
counts, higher-paying Bandit before Rat, locked rows last, active-outside-region
retention, one pressed sort, region preservation, and reset to Board order on
reentry. Sorting preserves the whole live state and raw quick save; all three
widths check 44px controls and 130% text fit.

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

`tests/protected-outgoing-preview.test.mjs` compares the actual rendered Attack badge
and learned skill-card ranges with real solo `heroAction` damage endpoints, without
reusing preview arithmetic. It checks baseline, Defend, Warding Stance, Beacon Aegis,
and combined incoming protections across every foe, levels 2/17/20, bare/fitted
gear, all four difficulties, and five RNG samples. Frozen whole render inputs stay
unchanged, non-damaging skills have no range, and incoming protections do not reduce
outgoing damage. This is synthetic regression coverage, not an earned journey,
browser/screen-reader check, or balance survey.

### Upcoming-skills disclosure regression

The retained smoke journey checks the earned level-one Ridge fight at 320, 375,
and 768 pixels with 115% and 130% text. It opens and closes Upcoming skills,
requires a 44px summary target with fitting text, and verifies all thirteen
future cards are disabled, ordered by unlock level, and show no action shortcut
or damage range. An unused digit cannot activate a future skill; the whole
fight and quick save remain unchanged. This is not all-level earned coverage,
a full visual audit, or screen-reader testing.

The retained Journal layout check enumerates the original six controls and all seven element filters, checking all thirteen at 115%/130% text. This updates its pre-element-filter control count; it does not remove the original search, category, unknown-foe, comparison, or whole-state checks.

### Conditional incoming-damage hints

Combat labels the ordinary incoming estimate as a **basic hit versus the leader**,
not every possible foe action. Both basic and active-windup hints explicitly use
current defenses and are not next-turn predictions; the basic hint also notes
that abilities and other targets differ. Windup and target names are escaped once
at the rendering boundary. `tests/incoming-damage-hint.test.mjs` exercises frozen
full-render inputs, fixed ranges, protections, omissions, and hostile text. This
is synthetic renderer coverage, not browser, screen-reader, or balance evidence;
combat rules and preview arithmetic are unchanged.

Combat item cards preview the selected living recipient's **immediate** HP/MP
restoration, including equipment and forge caps, and show a status cure only
when it applies. Full or over-cap resources show `+0`; those items remain usable.
The preview uses the pure consumable result without consuming anything. It is
not an end-of-turn prediction: companions, the normal enemy reply and status
ticks can change the final totals. Choosing a recipient still costs no turn;
using an item keeps its existing consumption and turn cost.

`tests/item-restoration-preview.test.mjs` checks literal cap/over-cap/cure cases,
read-only full renders, escaping, target switching, and all consumables against
real item-action restoration logs for three recipients, bare/fitted equipment,
and low/near-cap/full/over-cap resources. These synthetic fixtures do not claim
an earned journey, screen-reader validation, or combat balance coverage.

### Combat card title layout regression

`npm run test:browser:cards` serves the real app and styles locally and renders
frozen synthetic combat fixtures for all 11 consumables and 15 learned skills.
At 320, 375 and 768 pixels, 100/115/130% text size, and with shortcut hints on
and off, it checks that each title word stays on one line, card text fits the
viewport, and buttons remain at least 44 pixels tall. It also checks unchanged
fixture/live journey state and the quick-save key. Header metadata can wrap to
its own row rather than squeezing the title. This is renderer/layout coverage,
not an earned campaign, screen-reader assessment, or balance test.

### Earned combat item preview check

The retained `npm run test:browser` route now checks genuinely purchased Trail
Rations on wounded solo Wren in the first Ridge fight. At 320/375/768px,
115/130% text and shortcut hints on/off, the preview, recipient, quantity,
44px card and text bounds are checked while whole journey and quick-save bytes
stay unchanged. Escape/reopen is free. A native ration use consumes one item
and one turn; the immediate item log must match the independently capped
10 HP preview, while the normal enemy reply is explicitly separate. Reopening
checks the new HP-based preview and remaining quantity before the existing
victory/save/Journal/Archive route continues. All earlier assertions remain.
This earned solo check complements synthetic all-item/all-recipient coverage;
it does not establish screen-reader accessibility or general combat balance.

### Visible boss enrage threshold

Enemy HP meters now link to a visible “Enrage threshold: N HP or lower.” line.
The cutoff uses the current fight's maximum HP and the phase rule's floor,
including difficulty scaling; it describes the threshold, not a promise about
when the enemy next acts. The marker remains decorative. Tests compare each
canonical enrage cutoff with the actual phase check and preserve whole render
inputs. This adds visible text and an `aria-describedby` association, not a
claim of completed screen-reader testing; combat rules and saves are unchanged.

### Earned victory receipt browser regression

The retained fresh-game smoke route now checks the solo Ridge Bandit victory's
exact +10 XP and +9 gold receipt against independent literals and actual party,
gold, and inventory deltas. Its unchanged RNG of 0.5 earns no loot: the ration
actually used earlier is the only inventory change. Native Display115/130 and
shortcut hints on/off give four receipt renders per width (12 overall), checking
text glyph bounds, document fit, Continue's 44px target, whole-journey and actual
quick-save stability. Continue must not repay XP, gold, or items. The original
Chronicle, save/reload, Journal, and Archive route/assertions remain intact.
No reward-helper oracle or injected progress/markup is used. This is not earned
item-drop or drill coverage, a balance study, or real screen-reader testing.

### Immediate support-skill previews

The Skills menu previews current named HP restoration and applicable condition
removal for Mend, Rallying Light, Steady Signal, Rekindle, and Stormhaven Vigil.
These are immediate effects before allies act, the enemy replies, or statuses
expire—not end-of-turn totals. Effective equipment caps and partial/zero healing
are reflected; downed allies appear only for Rekindle. Unknown, unlearned,
unaffordable, or shock-blocked support skills have no effect preview. This changes
neither skill availability nor combat mechanics, shortcuts, or saves.

`tests/skill-restoration-preview.test.mjs` pins literal values, frozen inputs,
escaping, and 416 real-action comparisons using each target's first HP/status
write rather than post-turn totals. Browser layout checks remain distinct from
an earned campaign or screen-reader test.

### Earned Mend preview browser regression

`npm run test:browser:mend` starts three fresh, solo level-one journeys at
320/375/768px. Actual Ridge Bandit damage creates a four-HP gap; twelve native
115/130% and shortcut-hint layouts check Mend's literal capped preview, glyph
bounds, 44px targets, and whole-state/quick-save stability. Two real Mend actions
verify four immediate HP restored, four MP spent, and the normal enemy reply;
insufficient MP disables Mend and omits its preview. The same fights finish with
one earned victory receipt and no duplicate rewards. No saved progress, stats,
or markup are injected. This covers Mend, not the other four support skills,
high-level progression, balance, or real screen-reader operation.

### Earned Flee preview browser regression

Run `npm run test:browser:flee` after installing Playwright and Chromium as above.
The standalone runner starts a fresh game at 320, 375 and 768 px and reaches the
first Ridge Bandit using native UI actions, without injected progress or markup.
It checks the literal 50% speed-tie badge at 115/130% scale with hints on/off,
whole-state/quick-save stability, text bounds and a 44px Flee target. Controlled
RNG 0.5 fails at the strict boundary and gives one normal enemy reply; 0.49 then
escapes without another reply. Finish returns to the uncleared encounter with
one recorded escape and no rewards or quick-save write. This is not coverage
of bosses, other speed gaps, screen readers, save/reload, or balance.


## Optional Guide navigation browser regression

After the same `npm ci` and Playwright Chromium installation described above,
run `npm run test:browser:guide`. This opt-in suite leaves the default unit tests,
existing browser smoke, and CI jobs unchanged. Fresh Chromium contexts at
320, 375, and 768px wide by 800px high check the Guide at 115% and 130% text size.

Literal expectations cover all seven Contents anchors and seven Back to contents
links, their labels and destinations, 44px minimum link heights, visible-text
containment, and document width. Every clicked section heading and returned
Contents heading must fit the viewport and clear the measured sticky audio dock.
A native Tab/Enter roundtrip reaches the Skill roadmap, then uses the next Tab
stop and Enter to return to Contents. Whole journey state and raw quick-save
bytes stay unchanged during navigation and text-size changes; Title, reopen,
and New journey transitions are also checked.

Screenshots and traces are retained under ignored `browser-artifacts/guide/`,
including failure screenshots when possible. For example, open a trace with
`npx playwright show-trace browser-artifacts/guide/320.zip`. No progress, saves,
items, or randomness are injected. This is not actual screen-reader testing,
cross-browser coverage, a full visual review, or a gameplay/balance evaluation.

## Optional Bag Details browser regression

After `npm ci` and installing Playwright Chromium as above, run
`npm run test:browser:bag-details`. Fresh Chromium contexts at 320, 375, and
768px by 800px buy one Bandage and one Ration through the shop (20 → 4 gold),
then inspect their literal sourcing text at 115% and 130% text size. Native
clicks and Enter check drawer swapping, focus retention, `aria-expanded`,
closing and reopening the Bag, 44px Details controls, text Range containment,
and document width. Whole journey state and raw quick-save bytes stay unchanged
by presentation operations. This short journey injects no state, saves, items,
or randomness.

The separate `npm run test:browser:bounties` also inspects the two Field Dressings
actually purchased with two of four earned Board Marks, after Save/Reload. It
checks literal shop and Board Exchange sourcing, Enter/focus/expanded state,
115/130% containment and reset behavior while preserving the whole earned state
and saved bytes. First Bag entry explicitly checks the existing empty hero
equipment initialization; subsequent presentation operations preserve that
whole state. All previous bounty assertions remain. This covers ordinary
Exchange pricing, not an earned Warden discount or all seven offers.

Screenshots and traces are in ignored `browser-artifacts/bag-details/` and
`browser-artifacts/bounties/`, including failure screenshots when possible.
Default unit tests, browser smoke, CI jobs, and production code are unchanged.
These are targeted Chromium regressions, not all-item native coverage, actual
screen-reader testing, full visual review, or gameplay/balance evidence.

### Expedition history browser regression (optional)

```sh
npm ci
npx playwright install chromium
npm run test:browser:expedition-log
```

This opt-in Chromium runner starts a fresh journey in Greyhaven at 320, 375,
and 768px. Eight normal steps and eight Surveys, one additional repeated
Survey, and native Save create eleven raw log entries: ten grouped entries,
six recent and four older. No state, save, item, coordinate, or log injection
and no RNG override is used.

At native Display 115% and 130%, it checks literal summary and toggle labels,
independently grouped entries, click/Enter toggling, retained focus,
`aria-expanded`/`aria-controls`, a unique controlled log, horizontal glyph
bounds and a 44px control. Whole journey state and raw quicksave remain
unchanged through display/toggle operations; Town → Explore resets the
transient expansion. The scrollable history need not all fit vertically.
Screenshots and traces go to `browser-artifacts/expedition-log/`. This is not
actual screen-reader, cross-browser, or combat-balance validation.


### Field Pack manifest browser regression (optional)

```sh
npm ci
npx playwright install chromium
npm run test:browser:field-pack
```

This optional Chromium runner uses fresh journeys at 320, 375, and 768px.
It checks an empty Field Pack, buys two Linen Bandages with the starting 20g,
crafts one Field Dressing through the native field action, then saves and
reloads through Continue. No state, inventory, coordinate, save, or RNG
injection is used. Literal manifest text and the craft-ready button are
checked before and after crafting.

At native Display 115% and 130%, each display action must preserve the whole
journey and raw quicksave. Text Range bounds must fit horizontally and
vertically, with no document overflow. Crafting may change only inventory
and its literal log entry; Save must serialize the whole pre-save journey
and add only its log entry; Continue must restore that whole journey.
Full-page and viewport screenshots, failure screenshots when possible, and
traces go to `browser-artifacts/field-pack/`. Default tests, smoke, CI, and
production code are unchanged. This is not all-recipes native coverage,
actual screen-reader, cross-browser, visual-review, or balance evidence.

### Optional knockout-warning browser regression

```sh
npm run test:browser:knockout-warning
```

This optional Chromium runner starts fresh at 320, 375, and 768px, reaches
the fixed Ridge Bandit, and uses Defend to reach 4 HP. It checks the literal
basic-hit warning at 115% and 130% text size, uses Mend to clear the warning,
then reaches 4 HP again and flees to check that resolved combat has no warning.
Display interactions preserve the whole game state and raw quick save; the
runner also checks warning text geometry, uniqueness, non-live semantics,
and browser errors. RNG is fixed at 0.5 until switching to 0.49 for Flee; no
state, inventory, coordinate, or save grants are used. Screenshots and traces
go in `browser-artifacts/knockout-warning/`. This is not a boss-balance,
victory/defeat browser, or screen-reader audit, and does not change default CI.

### Optional finishing-blow browser regression

```sh
npm ci
npx playwright install chromium
npm run test:browser:finishing-blow
```

This optional Chromium runner starts fresh at 320, 375, and 768px. Three
native Attacks against the fixed Ridge Bandit leave it at 5 HP; the runner
checks the exact Power Strike finishing-blow hint at 115% and 130% text size.
Each Display action and opening Skills preserve the whole game state and
raw quicksave. A real Power Strike wins the fight, spends 3 MP, and removes
the hint; resolved Display interactions also preserve whole state and save.

Checks include unique non-live text, nonempty text Range bounds within the
paragraph and horizontal viewport, document fit, and browser errors. RNG
is fixed at 0.5; no state, inventory, coordinate, or save grants are used.
Screenshots and traces go to `browser-artifacts/finishing-blow/`. This covers
only the early sure-hit branch, not high-roll or late-game hints, Save/Reload,
actual screen-reader testing, cross-browser behavior, or balance. Production,
default tests, browser smoke, and CI are unchanged.

### Optional cache-summary browser regression

```sh
npm ci
npx playwright install chromium
npm run test:browser:cache-summary
```

This optional Chromium runner starts fresh at 320, 375, and 768px. It checks
both the Frontier Atlas and zone-checklist cache paragraphs in Greyhaven,
at Ridge Road's entrance, adjacent to the Wayfarer Supply Crate, after
actually collecting it, and after Save/Reload/Continue. Literal expectations
cover zero caches, unopened counts and supply units, two-tile and one-tile
bearings, and the opened summaries at 115% and 130% text size.

Every Display step and opening either details panel preserves the whole
game state and raw quick save. Collection must change only the literal
inventory (one Healing Herb and two Scrap Metal), completion flag, and
literal log entry. Save and Reload are checked against the whole state.
The runner checks unique ordinary non-live paragraphs, nonempty positive
text Range bounds inside each paragraph and horizontal viewport, document
fit, and browser errors. Screenshots and traces go to
`browser-artifacts/cache-summary/`.

RNG is fixed at 0.5; no inventory, state, coordinate, progress, or save grants
are used. This is one early unguarded cache, not all eight caches, guardian
battles, an actual screen-reader audit, cross-browser testing, visual review,
or balance evidence. Production, default tests, browser smoke, and CI are
unchanged.
