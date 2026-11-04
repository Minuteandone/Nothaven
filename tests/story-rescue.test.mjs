import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveGame, loadGame } from '../src/state.js';
import { applyStoryEvent, getJournal, getDialogue } from '../src/story/index.js';
import { RESCUE_ROUTES, RESCUE_GOLD, rescueReady, getRescueJournal } from '../src/story/rescue.js';
import { createStoryUI } from '../src/story/view.js';
import { dispatchStoryEvent, installStory } from '../src/story/integration.js';
import { installEnding } from '../src/scenes/ending.js';

const event = (state, event) => applyStoryEvent(state, event);
const accept = { type: 'rescue-accept' }, report = { type: 'rescue-report' };
const visit = r => ({ type: 'visit', locationId: r.locationId });
const victory = r => ({ type: 'victory', encounterId: r.encounterId });
function ready(ending = 'protect_town') {
  const state = createInitialState();
  state.story.stage = 'complete'; state.story.ending = ending;
  state.story.flags = { road_reward: true, lens_reward: true, chapter_reward: true, relief_reward: true };
  state.flags.endingShown = true;
  return state;
}
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function bus() {
  const listeners = new Map();
  return { on(k, f) { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(f); },
    off(k, f) { listeners.get(k)?.delete(f); }, emit(k, v) { for (const f of listeners.get(k) || []) f(v); } };
}

test('rescue acceptance and journal wait for the beacon ending', () => {
  const story = createInitialState().story;
  assert.deepEqual(getRescueJournal(story), []);
  assert.equal(event(story, accept).state.flags.rescue_accepted, undefined);
  assert.deepEqual(event(story, report).rewards, []);
  assert.doesNotMatch(createStoryUI().render({ state: createInitialState() }), /data-action="storyRescue"/);
});

for (const ending of ['protect_town', 'share_signal']) for (const reverse of [false, true]) {
  test(`rescue route order is free and rewards once: ${ending}, reverse=${reverse}`, () => {
    const initial = freeze(ready(ending).story);
    let story = event(initial, accept).state;
    const routes = reverse ? [...RESCUE_ROUTES].reverse() : RESCUE_ROUTES;
    for (const route of routes) {
      story = event(story, visit(route)).state;
      story = event(story, victory(route)).state;
      story = JSON.parse(JSON.stringify(story));
    }
    assert.equal(rescueReady(story), true);
    assert.equal(story.flags.rescue_first, routes[0].id);
    const result = event(freeze(story), report);
    assert.deepEqual(result.rewards, [{ id: 'rescue_reward', gold: RESCUE_GOLD }]);
    assert.equal(result.state.stage, 'complete');
    assert.equal(result.state.ending, ending);
    assert.equal(result.state.flags.relief_reward, true);
    assert.equal(initial.flags.rescue_accepted, undefined);
    assert.equal(getRescueJournal(result.state).every(q => q.status === 'complete'), true);
    assert.match(getRescueJournal(result.state)[0].objective, ending === 'protect_town' ? /shield/ : /roads you lit/);
    assert.match(getRescueJournal(result.state)[0].objective, new RegExp(routes[0].name));
    for (const replay of [report, accept, ...routes.flatMap(r => [visit(r), victory(r)])]) {
      assert.deepEqual(event(result.state, replay).rewards, []);
      assert.equal(event(result.state, replay).state.flags.rescue_first, routes[0].id);
    }
  });
}

test('early victories persist but visits, acceptance and explicit report are all required', () => {
  let story = createInitialState().story;
  for (const r of RESCUE_ROUTES) story = event(story, victory(r)).state;
  story = { ...story, stage: 'complete', ending: 'share_signal' };
  assert.equal(rescueReady(story), false);
  assert.deepEqual(event(story, report).rewards, []);
  story = event(story, accept).state;
  for (const r of RESCUE_ROUTES) story = event(story, visit(r)).state;
  assert.equal(rescueReady(story), true);
  assert.equal(event(story, { type: 'talk', npcId: 'mara' }).state.flags.rescue_reward, undefined);
  assert.equal(event(story, report).rewards[0].gold, 80);
});

test('unknown identifiers and enemy species cannot satisfy rescue encounters', () => {
  let story = event(ready().story, accept).state;
  for (const r of RESCUE_ROUTES) story = event(story, visit(r)).state;
  for (const id of ['tide_wraith', 'rust_sentinel', 'constructor', null]) story = event(story, { type: 'victory', encounterId: id }).state;
  assert.equal(rescueReady(story), false);
  assert.deepEqual(event(story, report).rewards, []);
  assert.equal(getDialogue(story, 'unknown'), null);
});

test('shared UI guards location and requires explicit accept and report', () => {
  const game = { state: ready() }, ui = createStoryUI();
  const act = arg => ui.actions.storyRescue(game, { dataset: { arg } });
  ui.actions.storyTalk(game, { dataset: { arg: 'mara' } });
  assert.equal(game.state.story.flags.rescue_accepted, undefined);
  game.state.location = RESCUE_ROUTES[0].locationId;
  act('accept'); assert.equal(game.state.story.flags.rescue_accepted, undefined);
  assert.doesNotMatch(ui.render(game), /data-action="storyRescue"/);
  game.state.location = 'greyhaven';
  assert.match(ui.render(game), /data-arg="accept"/);
  act('constructor'); act('report'); assert.equal(game.state.gold, 20);
  act('accept'); assert.equal(game.state.story.flags.rescue_accepted, true);
  assert.doesNotMatch(ui.render(game), /data-arg="report"/);
  for (const r of RESCUE_ROUTES) for (const e of [visit(r), victory(r)]) dispatchStoryEvent(game, e);
  assert.match(ui.render(game), /data-arg="report"/);
  assert.match(getDialogue(game.state.story, 'mara').text, /full report/);
  game.state.location = 'ridge_road'; act('report'); assert.equal(game.state.gold, 20);
  createStoryUI(() => 'greyhaven').actions.storyRescue(game, { dataset: { arg: 'report' } });
  assert.equal(game.state.gold, 100);
  assert.doesNotMatch(createStoryUI(() => 'greyhaven').render(game), /data-action="storyRescue"/);
  act('report'); assert.equal(game.state.gold, 100);
});

test('real story bus, ending observer and save/load preserve a single rescue payment', () => {
  const oldStorage = globalThis.localStorage;
  let saved;
  globalThis.localStorage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  try {
    const game = { state: ready(), bus: bus(), setScene() { assert.fail('rescue must not replay chapter-one ending'); } };
    game.state.inventory = [{ id: 'rations', qty: 2 }];
    installStory(game); installEnding(game);
    game.bus.emit('story:event', accept);
    for (const r of RESCUE_ROUTES) {
      game.bus.emit('story:event', visit(r));
      game.bus.emit('combat:victory', { encounterId: r.encounterId, enemyId: 'tide_wraith' });
      saveGame(game.state); game.state = loadGame();
    }
    let paid = 0;
    game.bus.on('story:updated', payload => {
      if (payload.rewards.some(r => r.id === 'rescue_reward')) {
        paid++; assert.equal(game.state.gold, 100); assert.equal(payload.state, game.state.story);
      }
    });
    dispatchStoryEvent(game, report);
    saveGame(game.state); game.state = loadGame();
    dispatchStoryEvent(game, report);
    assert.equal(paid, 1); assert.equal(game.state.gold, 100);
    assert.deepEqual(game.state.inventory, [{ id: 'rations', qty: 2 }]);
    assert.equal(getJournal(game.state.story).find(q => q.id === 'rescue').status, 'complete');
  } finally { if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; }
});
