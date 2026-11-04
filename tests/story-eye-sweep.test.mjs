import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveGame, loadGame } from '../src/state.js';
import { applyExpeditionEvent, expeditionAvailable, activeExpedition, getExpeditionJournal } from '../src/story/expeditions.js';
import { createStoryUI } from '../src/story/view.js';
import { dispatchStoryEvent } from '../src/story/integration.js';

const accept = { type: 'expedition-accept', contractId: 'eye_sweep' };
const victory = { type: 'victory', enemyId: 'tempest_shade' };
const claim = { type: 'expedition-claim' };
const advance = (s, e) => applyExpeditionEvent(s, e).state;
const click = arg => ({ dataset: { arg } });
const ready = () => ({ ...createInitialState().story, stage: 'complete', ending: 'share_signal', flags: {
  spire_reward: true, heart_reward: true, victory_storm_heart: true, relay_choice: 'route_network',
} });
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }

test('Sweep requires strict paid Heart flag, not core victory or truthy substitutes', () => {
  for (const heart_reward of [undefined, false, 'true', 1, {}]) {
    const story = { ...ready(), flags: { ...ready().flags, heart_reward } };
    assert.equal(expeditionAvailable(story, 'eye_sweep'), false);
    assert.equal(activeExpedition(advance(freeze(story), accept)), null);
    assert.equal(expeditionAvailable(story, 'spire_patrol'), true);
    assert.equal(expeditionAvailable(story, 'sunscar_patrol'), true);
    const malformed = { ...story, expedition: { active: { id: 'eye_sweep', progress: 2 } } };
    assert.deepEqual(applyExpeditionEvent(malformed, claim).rewards, []);
  }
  assert.equal(expeditionAvailable({ ...ready(), flags: { heart_reward: true } }, 'eye_sweep'), false);
  for (const id of ['constructor', '__proto__', null]) assert.equal(expeditionAvailable(ready(), id), false);
});

test('Sweep counts only new matching victories, caps quota and pays 90 exactly once per cycle', () => {
  let story = advance(ready(), victory);
  for (let cycle = 1; cycle <= 2; cycle++) {
    story = advance(story, accept);
    assert.equal(activeExpedition(story).progress, 0);
    for (const event of [{ type: 'victory', enemyId: 'thunderhead_colossus' }, { type: 'victory', encounterId: 'tempest_shade' }, { type: 'expedition-accept', contractId: 'spire_patrol' }, claim]) {
      const result = applyExpeditionEvent(freeze(story), event);
      assert.deepEqual(result.rewards, []); story = result.state;
      assert.equal(activeExpedition(story).id, 'eye_sweep'); assert.equal(activeExpedition(story).progress, 0);
    }
    for (let n = 1; n <= 3; n++) {
      const previous = freeze(story), result = applyExpeditionEvent(previous, victory);
      assert.equal(activeExpedition(previous).progress, Math.min(n - 1, 2));
      assert.deepEqual(result.rewards, []); story = result.state;
      assert.equal(activeExpedition(story).progress, Math.min(n, 2));
    }
    assert.match(getExpeditionJournal(story)[0].objective, /Claim 90 gold/);
    const result = applyExpeditionEvent(freeze(story), claim);
    assert.deepEqual(result.rewards, [{ id: `expedition_reward_${cycle}`, gold: 90 }]);
    story = result.state;
    assert.equal(story.expedition.completed, cycle); assert.equal(activeExpedition(story), null);
    assert.deepEqual(applyExpeditionEvent(story, claim).rewards, []);
    assert.equal(story.ending, 'share_signal'); assert.deepEqual(story.flags, ready().flags);
  }
});

test('Sweep cancellation discards partial progress without payment; malformed progress normalizes', () => {
  let story = advance(advance(ready(), accept), victory);
  const result = applyExpeditionEvent(story, { type: 'expedition-cancel' });
  assert.deepEqual(result.rewards, []); assert.equal(result.state.expedition.completed, 0);
  story = advance(result.state, accept); assert.equal(activeExpedition(story).progress, 0);
  for (const progress of ['2', -1, NaN, 0.5]) {
    const malformed = { ...ready(), expedition: { active: { id: 'eye_sweep', progress }, completed: -1 } };
    assert.equal(activeExpedition(malformed).progress, 0);
    assert.deepEqual(applyExpeditionEvent(malformed, claim).rewards, []);
  }
});

test('board visibility and stale actions share the gate and authoritative location', () => {
  const game = { state: createInitialState(), storyDialogue: 'retained' }, ui = createStoryUI();
  game.state.story = ready(); delete game.state.story.flags.heart_reward;
  assert.doesNotMatch(ui.render(game), /data-arg="eye_sweep"/);
  assert.match(ui.render(game), /data-arg="spire_patrol"/);
  ui.actions.storyExpedition(game, click('eye_sweep'));
  assert.equal(game.storyDialogue, 'retained'); assert.equal(game.state.story.expedition, undefined);
  game.state.story.flags.heart_reward = true;
  assert.match(ui.render(game), /data-arg="eye_sweep"/);
  const outside = createStoryUI(() => 'storms_eye');
  assert.doesNotMatch(outside.render(game), /data-arg="eye_sweep"/);
  outside.actions.storyExpedition(game, click('eye_sweep')); assert.equal(game.state.story.expedition, undefined);
  ui.actions.storyExpedition(game, click('eye_sweep')); assert.equal(activeExpedition(game.state.story).progress, 0);
  assert.doesNotMatch(ui.render(game), /data-arg="spire_patrol"/);
});

test('Sweep live actions survive real save replacement and never replay an ending or duplicate gold', () => {
  const old = globalThis.localStorage; let saved;
  globalThis.localStorage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  try {
    const game = { state: createInitialState() }, ui = createStoryUI(); game.state.story = ready();
    game.state.flags.endingShown = true; game.state.flags.finaleShown = true;
    const checkpoint = () => { saveGame(game.state); game.state = loadGame(); };
    ui.actions.storyExpedition(game, click('eye_sweep')); checkpoint();
    for (let n = 1; n <= 2; n++) { dispatchStoryEvent(game, victory); checkpoint(); assert.equal(activeExpedition(game.state.story).progress, n); }
    assert.equal(game.state.gold, 20);
    game.state.location = 'storms_eye'; ui.actions.storyExpedition(game, click('claim')); assert.equal(game.state.gold, 20);
    game.state.location = 'greyhaven'; ui.actions.storyExpedition(game, click('claim')); checkpoint();
    assert.equal(game.state.gold, 110); assert.equal(game.state.story.expedition.completed, 1);
    ui.actions.storyExpedition(game, click('claim')); assert.equal(game.state.gold, 110);
    assert.equal(game.state.flags.endingShown, true); assert.equal(game.state.flags.finaleShown, true);
  } finally { if (old === undefined) delete globalThis.localStorage; else globalThis.localStorage = old; }
});
