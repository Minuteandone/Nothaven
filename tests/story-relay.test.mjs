import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveGame, loadGame } from '../src/state.js';
import { applyStoryEvent, getJournal, getDialogue } from '../src/story/index.js';
import { RELAY_CHOICES, RELAY_GOLD, relayReady, getRelayJournal, getRelayChoices, restPrice } from '../src/story/relay.js';
import { getTownOutlook } from '../src/story/outlook.js';
import { createStoryUI } from '../src/story/view.js';
import { installStory, dispatchStoryEvent } from '../src/story/integration.js';
import { installEnding } from '../src/scenes/ending.js';
import { townScene } from '../src/scenes/town.js';
import { effectiveStats } from '../src/items/equipment.js';

const accept = { type: 'relay-accept' };
const facts = [
  { type: 'visit', locationId: 'sunscar_relay' },
  { type: 'interact', interactionId: 'relay_junction' },
  { type: 'victory', encounterId: 'relay_warden' },
  { type: 'interact', interactionId: 'relay_console' },
];
const choose = choiceId => ({ type: 'relay-choose', choiceId });
const advance = (story, event) => applyStoryEvent(story, event).state;
function ready(ending = 'protect_town') {
  const state = createInitialState();
  state.story = { version: 1, stage: 'complete', ending, flags: { road_reward: true, lens_reward: true, chapter_reward: true, rescue_reward: true, relief_reward: true } };
  state.flags.endingShown = true;
  return state;
}
function primed(ending) { return [accept, ...facts].reduce(advance, ready(ending).story); }
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function bus() {
  const listeners = new Map();
  return { on(k, f) { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(f); },
    off(k, f) { listeners.get(k)?.delete(f); }, emit(k, v) { for (const f of listeners.get(k) || []) f(v); } };
}

test('relay commission requires the reported rescue, not merely the beacon ending', () => {
  for (const story of [createInitialState().story, { ...ready().story, flags: {} }]) {
    assert.deepEqual(getRelayJournal(story), []);
    assert.equal(advance(story, accept).flags.relay_accepted, undefined);
    assert.deepEqual(applyStoryEvent(story, choose('shelter_network')).rewards, []);
  }
  const game = { state: ready() }, ui = createStoryUI();
  assert.match(ui.render(game), /data-action="storyRelayAccept"/);
  ui.actions.storyTalk(game, { dataset: { arg: 'mara' } });
  assert.equal(game.state.story.flags.relay_accepted, undefined);
  assert.match(getDialogue(game.state.story, 'iven').text, /northern junction/);
  assert.equal(getDialogue(game.state.story, 'constructor'), null);
});

for (const ending of ['protect_town', 'share_signal']) for (const choice of RELAY_CHOICES) {
  test(`relay ${choice.id} preserves ${ending} and pays exactly once`, () => {
    const initial = freeze(primed(ending));
    const result = applyStoryEvent(initial, choose(choice.id));
    assert.deepEqual(result.rewards, [{ id: 'relay_reward', gold: RELAY_GOLD }]);
    assert.equal(result.state.stage, 'complete'); assert.equal(result.state.ending, ending);
    assert.equal(result.state.flags.relief_reward, true); assert.equal(result.state.flags.rescue_reward, true);
    assert.equal(result.state.flags.relay_choice, choice.id); assert.equal(initial.flags.relay_choice, undefined);
    assert.equal(getRelayJournal(result.state)[0].status, 'complete');
    assert.equal(getJournal(result.state).find(q => q.id === 'relay').status, 'complete');
    assert.deepEqual(getRelayChoices(result.state), []);
    assert.match(getTownOutlook(result.state).text, ending === 'protect_town' ? /blue shield/ : /silver roads/);
    assert.match(getDialogue(result.state, 'mara').text, choice.id === 'shelter_network' ? /2 gold/ : /halved/);
    for (const event of [accept, ...facts, ...RELAY_CHOICES.map(c => choose(c.id))]) {
      const replay = applyStoryEvent(freeze(result.state), event);
      assert.deepEqual(replay.rewards, []); assert.equal(replay.state.flags.relay_choice, choice.id);
    }
  });
}

test('every relay prerequisite is required; facts explored before commission persist', () => {
  for (const omitted of [accept, ...facts]) {
    const incomplete = [accept, ...facts].filter(e => e !== omitted).reduce(advance, ready().story);
    assert.equal(relayReady(incomplete), false);
    assert.deepEqual(applyStoryEvent(incomplete, choose('route_network')).rewards, []);
  }
  let early = [...facts].reverse().reduce(advance, createInitialState().story);
  assert.equal(relayReady(early), false);
  early = { ...early, stage: 'complete', ending: 'share_signal', flags: { ...early.flags, rescue_reward: true } };
  early = advance(early, accept);
  assert.equal(relayReady(early), true);
  assert.equal(applyStoryEvent(early, choose('route_network')).rewards[0].gold, 100);
  for (const choiceId of ['constructor', '__proto__', 'protect_town', null]) assert.deepEqual(applyStoryEvent(early, choose(choiceId)).rewards, []);
  const unknown = [
    { type: 'visit', locationId: 'constructor' }, { type: 'interact', interactionId: '__proto__' },
    { type: 'victory', enemyId: 'relay_warden' }, { type: 'victory', encounterId: 'relay_drone' },
  ].reduce(advance, advance(ready().story, accept));
  assert.equal(unknown.flags.relay_victory, undefined); assert.equal(unknown.flags.relay_visit, undefined);
});

test('relay journal guides each stage and town outlook remains read-only', () => {
  let story = freeze(ready().story);
  assert.match(getRelayJournal(story)[0].objective, /Accept/);
  story = advance(story, accept);
  for (const [i, expected] of [/East Gate/, /Junction/, /Defeat/, /Inspect the Relay Console/].entries()) {
    assert.match(getRelayJournal(freeze(story))[0].objective, expected);
    assert.match(getTownOutlook(story).hint, expected);
    story = advance(story, facts[i]);
  }
  assert.match(getRelayJournal(story)[0].objective, /permanent/);
});

test('relay UI validates commission location and console distance using the authoritative getter', () => {
  const game = { state: ready() }, ui = createStoryUI();
  game.state.location = 'sunscar_relay';
  ui.actions.storyRelayAccept(game); assert.equal(game.state.story.flags.relay_accepted, undefined);
  createStoryUI(() => 'greyhaven').actions.storyRelayAccept(game);
  assert.equal(game.state.story.flags.relay_accepted, true);
  facts.forEach(e => dispatchStoryEvent(game, e));
  const click = id => ui.actions.storyRelayChoose(game, { dataset: { arg: id } });
  for (const map of [{ zoneId: 'highwatch_pass', x: 7, y: 3 }, { zoneId: 'sunscar_relay', x: 5, y: 3 }, { zoneId: 'sunscar_relay', x: 7, y: 1 }, {}]) {
    game.state.map = map; click('shelter_network');
    assert.equal(game.state.gold, 20); assert.doesNotMatch(ui.render(game), /data-action="storyRelayChoose"/);
  }
  game.state.map = { zoneId: 'sunscar_relay', x: 6, y: 3 };
  assert.match(ui.render(game), /data-action="storyRelayChoose"/);
  game.state.location = 'greyhaven'; click('shelter_network'); assert.equal(game.state.gold, 20);
  const mapUI = createStoryUI(g => g.state.map.zoneId);
  mapUI.actions.storyRelayChoose(game, { dataset: { arg: 'constructor' } }); assert.equal(game.state.gold, 20);
  mapUI.actions.storyRelayChoose(game, { dataset: { arg: 'shelter_network' } }); assert.equal(game.state.gold, 120);
  mapUI.actions.storyRelayChoose(game, { dataset: { arg: 'route_network' } }); assert.equal(game.state.gold, 120);
  assert.doesNotMatch(mapUI.render(game), /data-action="storyRelayChoose"/);
});

test('relay commits payment before notification, survives save replacement, and never replays ending', () => {
  const oldStorage = globalThis.localStorage; let saved;
  globalThis.localStorage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  try {
    const game = { state: ready(), bus: bus(), setScene() { assert.fail('relay must not replay ending'); } };
    const cleanup = installStory(game); installEnding(game);
    game.bus.emit('story:event', accept);
    for (const event of facts) {
      game.bus.emit(event.type === 'victory' ? 'combat:victory' : 'story:event', event);
      saveGame(game.state); game.state = loadGame();
    }
    let paid = 0;
    game.bus.on('story:updated', payload => {
      if (payload.rewards.some(r => r.id === 'relay_reward')) {
        paid++; assert.equal(game.state.gold, 120); assert.equal(payload.state, game.state.story);
      }
    });
    dispatchStoryEvent(game, choose('route_network'));
    saveGame(game.state); game.state = loadGame();
    dispatchStoryEvent(game, choose('shelter_network'));
    assert.equal(paid, 1); assert.equal(game.state.gold, 120);
    assert.equal(game.state.story.flags.relay_choice, 'route_network');
    assert.equal(restPrice(game.state.story), 5); cleanup();
  } finally { if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; }
});

test('shelter town rest costs exactly two gold, heals effective caps, and blocks insufficient funds', () => {
  const state = ready(); state.story = advance(primed(), choose('shelter_network'));
  state.party[0].equipment = { trinket: 'storm_lantern' };
  state.party[0].hp = 1; state.party[0].mp = 0; state.party[0].statuses = ['shocked'];
  state.gold = 1; const game = { state };
  const before = structuredClone(state); townScene.actions.rest(game); assert.deepEqual(state, before);
  assert.match(townScene.render(game), /Rest at the inn · 2 gold/);
  state.gold = 2; townScene.actions.rest(game);
  assert.equal(state.gold, 0); assert.equal(state.party[0].hp, effectiveStats(state.party[0]).maxHp);
  assert.equal(state.party[0].mp, effectiveStats(state.party[0]).maxMp); assert.deepEqual(state.party[0].statuses, []);
  assert.equal(restPrice(ready().story), 5);
});
