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
