import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveGame, loadGame } from '../src/state.js';
import { getReliefQuest, handInRelief } from '../src/story/relief.js';
import { createStoryUI } from '../src/story/view.js';
import { dispatchReliefHandIn } from '../src/story/integration.js';

function ready(ending = 'protect_town') {
  const state = createInitialState();
  state.story = { ...state.story, stage: 'complete', ending };
  state.flags.endingShown = true;
  state.inventory = [{ id: 'rations', qty: 3 }, { id: 'bandage', qty: 2 }, { id: 'scrap_metal', qty: 4 }];
  return state;
}
function freeze(value) {
  if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
  return value;
}

test('relief remains hidden and blocked until chapter completion', () => {
  const state = ready(); state.story.stage = 'decision';
  assert.equal(getReliefQuest(state.story), null);
  assert.equal(handInRelief(state, 'greyhaven').state, state);
  assert.equal(handInRelief(state, 'greyhaven').ok, false);
  assert.doesNotMatch(createStoryUI().render({ state }), /data-action="storyRelief"/);
});
test('wrong location and missing supplies cause no partial changes', () => {
  const state = ready();
  assert.equal(handInRelief(state, 'beacon_tower').state, state);
  for (const inventory of [[], [{ id: 'rations', qty: 2 }], [{ id: 'rations', qty: 1 }, { id: 'bandage', qty: 1 }]]) {
    const input = freeze({ ...state, inventory });
    const before = JSON.stringify(input);
    const result = handInRelief(input, 'greyhaven');
    assert.equal(result.ok, false);
    assert.equal(result.state, input);
    assert.equal(JSON.stringify(input), before);
    assert.match(result.message, /No supplies were taken/);
  }
});
for (const ending of ['protect_town', 'share_signal']) test(`relief is a one-time immutable exchange: ${ending}`, () => {
  const state = freeze(ready(ending));
  const result = handInRelief(state, 'greyhaven');
  assert.equal(result.ok, true);
  assert.equal(state.gold, 20);
  assert.equal(state.story.flags.relief_reward, undefined);
  assert.equal(result.state.gold, 50);
  assert.deepEqual(result.state.inventory, [{ id: 'rations', qty: 1 }, { id: 'bandage', qty: 1 }, { id: 'scrap_metal', qty: 4 }]);
  assert.equal(result.state.story.ending, ending);
  assert.equal(getReliefQuest(result.state.story).status, 'complete');
  assert.match(result.message, ending === 'share_signal' ? /silver-lit roads/ : /strong shield/);
  const repeat = handInRelief(result.state, 'greyhaven');
  assert.equal(repeat.ok, false);
  assert.equal(repeat.state, result.state);
});
test('town UI requires an explicit hand-in and uses the scene location getter', () => {
  const game = { state: ready() }, ui = createStoryUI();
  assert.match(ui.render(game), /Rations: 3\/2 · Bandages: 2\/1/);
  assert.match(ui.render(game), /Hand over 2 rations \+ 1 bandage for 30 gold/);
  ui.actions.storyTalk(game, { dataset: { arg: 'tamsin' } });
  assert.equal(game.state.inventory[0].qty, 3);
  assert.equal(game.state.gold, 20);
  game.state.location = 'ridge_road';
  ui.actions.storyRelief(game);
  assert.equal(game.state.gold, 20);
  assert.doesNotMatch(ui.render(game), /data-action="storyRelief"/);
  const townUI = createStoryUI(() => 'greyhaven');
  townUI.actions.storyRelief(game);
  assert.equal(game.state.gold, 50);
  assert.equal(game.storyDialogue, null);
  assert.doesNotMatch(townUI.render(game), /data-action="storyRelief"/);
  townUI.actions.storyRelief(game);
  assert.equal(game.state.gold, 50);
});
test('observers see a committed exchange and failed repeats emit no reward notification', () => {
  const notifications = [];
  const game = { state: ready(), bus: { emit(name, payload) {
    assert.equal(name, 'story:updated');
    assert.equal(game.state.gold, 50);
    assert.equal(game.state.inventory[0].qty, 1);
    assert.equal(payload.state, game.state.story);
    notifications.push(payload);
  } } };
  dispatchReliefHandIn(game, 'greyhaven');
  dispatchReliefHandIn(game, 'greyhaven');
  assert.equal(notifications.length, 1);
  assert.deepEqual(notifications[0].rewards, [{ id: 'relief_reward', gold: 30 }]);
});
test('real save/load preserves the relief completion guard and inventory', () => {
  const oldStorage = globalThis.localStorage;
  let saved;
  globalThis.localStorage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  try {
    const completed = handInRelief(ready(), 'greyhaven').state;
    saveGame(completed);
    const restored = loadGame();
    assert.deepEqual(restored.inventory, completed.inventory);
    assert.equal(restored.story.flags.relief_reward, true);
    assert.equal(handInRelief(restored, 'greyhaven').ok, false);
    assert.equal(restored.gold, 50);
  } finally { if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; }
});
