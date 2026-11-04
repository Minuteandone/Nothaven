# Story module

`index.js` is a pure reducer plus journal/dialogue selectors. `integration.js` adapts it to the Game instance without importing DOM code.

## Engine wiring

```js
import { installStory } from './story/integration.js';
installStory(game); // once after constructing game; returns cleanup
```

Progress lives in `game.state.story`, lazily created for an old/new save. `installStory` reads the current game.state on every event, including after state replacement. Do not apply returned rewards a second time: the adapter already adds gold atomically with progression. Log output is available in `game.storyMessage` and the dispatch result. The adapter does not render; the engine's existing action render cycle remains responsible.

## Gameplay facts

Emit `game.bus.emit('story:event', event)` or call `dispatchStoryEvent(game,event)`:

- `{type:'talk', npcId:'mara'|'iven'|'tamsin'}`
- `{type:'visit', locationId:'greyhaven'|'ridge_road'|'observatory_ruins'|'beacon_tower'}`
- `{type:'victory', encounterId:'ridge_patrol'|'observatory_sentinel'}`
- `{type:'interact', interactionId:'dispatch_ridge'|'dispatch_observatory'}`
- `{type:'choose', choiceId:'protect_town'|'share_signal'}`

`combat:victory` is also observed, but requires `encounterId`. An enemy species ID alone cannot prove which quest encounter was cleared. It is safe if map and combat both emit the same fact. Visits and victories persist, so early encounter clears cannot softlock the mainline. The map/scene is responsible for proximity and authentic encounter outcomes; the reducer is not a server-side anti-cheat system.

## UI contract

- `getJournal(story)` -> array `{id,title,status:'active'|'complete',objective}`. Unknown future mainline quests stay hidden.
- `getDialogue(story,npcId)` -> `{speaker,text,choices:[]}` or null. Read before dispatching `talk` to show the speech associated with that interaction; then show the returned log and updated journal.
- `getEndingChoices(story)` -> array `{id,label,description}` only in decision stage. Offer these at the beacon tower, not in town.
- `getEndingSummary(story)` -> ending narration or empty string.

The council requires talking to both Mara and Tamsin **after** returning the lens to Iven, then visiting the beacon tower. A prior tower visit does not skip this return trip. Both endings complete the chapter; optional dispatch completion remains available afterward.

## Tests

`node --test tests/story.test.mjs` (Node 22). No dependencies. Browser code remains standard ES modules.

## Optional scene panel

`view.js` exports `createStoryUI(getLocation)` for scene owners. The location getter is called both for rendering and action guards. A town-only scene may use `createStoryUI(() => 'greyhaven')`; an exploration scene should return its actual current location ID.

```js
const storyUI = createStoryUI(game => game.state.location);
// Inside the scene render: append storyUI.render(game).
// Inside scene.actions: spread ...storyUI.actions.
```

Render at most one story panel per scene (heading IDs are fixed). Town panels expose NPC buttons; only the beacon tower exposes ending buttons. Other locations still show the journal. All dynamic text is escaped. Actions dispatch directly to the adapter and preserve the engine's existing render cycle. Temporary dialogue/message properties live on `game`, not in the save; clear `game.storyDialogue` and `game.storyMessage` when starting or loading a game so old conversations do not appear in a new run.


### Post-update notifications
`dispatchStoryEvent` emits `story:updated` with `{event, state, rewards, log}` after
assigning the new story state and applying gold rewards. This fires for direct
story UI actions as well as events forwarded by `installStory`. Scene observers
(such as chapter credits) should listen to this notification, not the incoming
`story:event` command. Do not apply its rewards again or forward it back into the
reducer. The notification also occurs for no-op events; use saved flags to guard
one-time side effects.

## Optional post-chapter relief

`getReliefQuest(story)` exposes **First Light Relief** only after chapter completion.
The explicit Greyhaven `storyRelief` action consumes 2 rations + 1 bandage atomically
and pays 30 gold once; ordinary NPC conversations never consume inventory.
`handInRelief(state, location)` is pure and returns the original state on failure.
`dispatchReliefHandIn(game, location)` commits the new state before emitting
`story:updated`; its reward metadata is informational, already paid (do not reapply).
Completion lives in `story.flags.relief_reward`, with ending-specific journal prose.
The scene location getter governs both the button and action, like other story controls.

## Chapter two — Roads to Our Neighbors

`rescue.js` extends the campaign without changing `story.stage === 'complete'`
or the permanent `story.ending`. Old completed saves immediately offer an
explicit expedition acceptance button in Greyhaven; ordinary NPC conversations
neither accept the expedition nor collect its payment. Relief remains independent.

Map contract agreed with the map owner:

| Settlement | Zone ID | Fixed encounter ID | Access |
| --- | --- | --- | --- |
| Saltmere | `saltmere_coast` | `saltmere_rescue` | Greyhaven South Pier |
| Highwatch | `highwatch_pass` | `highwatch_rescue` | Ridge Road North Trail |

Each route needs both its visit and fixed encounter victory. Either order works;
facts persist before acceptance, including before the beacon ending. Enemy species
and ordinary rematches do not substitute for these fixed encounter IDs.

The scene dispatches `rescue-accept` and `rescue-report` only in Greyhaven, using
the same location getter as its rendered controls. As with chapter one's reducer,
trusted facts enter through the story bus; proximity enforcement belongs to scenes.
`rescue-report` pays 80 gold once, guarded by `story.flags.rescue_reward`, through
the standard post-commit reward adapter. Supplies are never consumed. The first
route opened is retained in `rescue_first` and affects the completed journal prose;
the earlier beacon choice also changes the aftermath and NPC dialogue.

`story-rescue.test.mjs` covers both route orders and endings, early facts, guards,
immutable input, duplicate events, adapter notifications, save/load, and ending
observer compatibility. Full physical-route campaign coverage should accompany
the matching zone implementation; these focused tests do not claim map reachability.
