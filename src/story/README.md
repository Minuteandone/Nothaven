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
