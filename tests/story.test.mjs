import test from 'node:test';
import assert from 'node:assert/strict';
import { applyStoryEvent, createStoryState, getJournal, getDialogue, getEndingChoices, getEndingSummary } from '../src/story/index.js';
import { dispatchStoryEvent, installStory } from '../src/story/integration.js';
const talk = npcId => ({ type: 'talk', npcId });
const visit = locationId => ({ type: 'visit', locationId });
const victory = encounterId => ({ type: 'victory', encounterId });
const interact = interactionId => ({ type: 'interact', interactionId });
const choose = choiceId => ({ type: 'choose', choiceId });
const route = [talk('mara'), visit('ridge_road'), victory('ridge_patrol'), talk('mara'), talk('iven'), visit('observatory_ruins'), victory('observatory_sentinel'), talk('iven'), talk('mara'), talk('tamsin'), visit('beacon_tower')];
function run(events, initial = createStoryState()) {
  let state = initial;
  const rewards = [];
  for (const event of events) {
    const result = applyStoryEvent(state, event);
    state = result.state;
    rewards.push(...result.rewards);
  }
  return { state, rewards };
}
for (const ending of ['protect_town', 'share_signal']) test(`complete campaign: ${ending}`, () => {
  const { state, rewards } = run([...route, choose(ending)]);
  assert.equal(state.stage, 'complete');
  assert.equal(state.ending, ending);
  assert.equal(rewards.reduce((sum, r) => sum + r.gold, 0), 105);
  assert.equal(getEndingChoices(state).length, 0);
  assert.ok(getEndingSummary(state).length > 50);
  assert.ok(getJournal(state).filter(q => q.id !== 'dispatches').every(q => q.status === 'complete'));
  assert.equal(applyStoryEvent(state, choose(ending === 'protect_town' ? 'share_signal' : 'protect_town')).state.ending, ending);
});
test('duplicate events never duplicate any reward', () => {
  const events = [...route, choose('share_signal'), interact('dispatch_ridge'), interact('dispatch_observatory'), talk('tamsin')];
  const { state, rewards } = run(events.flatMap(e => [e, e, e]));
  assert.equal(state.stage, 'complete');
  assert.equal(rewards.length, 4);
  assert.equal(new Set(rewards.map(r => r.id)).size, 4);
});
test('early irreversible victories reconcile when their quest unlocks', () => {
  const { state } = run([visit('ridge_road'), victory('ridge_patrol'), visit('observatory_ruins'), victory('observatory_sentinel'), talk('mara'), talk('mara'), talk('iven')]);
  assert.equal(state.stage, 'lens_report');
});
test('victory alone does not meet visit prerequisite', () => {
  const { state } = run([talk('mara'), victory('ridge_patrol')]);
  assert.equal(state.stage, 'road');
  assert.equal(applyStoryEvent(state, visit('ridge_road')).state.stage, 'road_report');
});
test('invalid events and choices do not progress or reward', () => {
  const state = createStoryState();
  for (const event of [null, undefined, 1, '', {}, talk('unknown'), visit('__proto__'), victory('storm_rat'), interact('unknown'), choose('share_signal')]) {
    const result = applyStoryEvent(state, event);
    assert.deepEqual(result.state, state);
    assert.deepEqual(result.rewards, []);
  }
  const decision = run(route).state;
  assert.equal(applyStoryEvent(decision, choose('unknown')).state.stage, 'decision');
});
test('council requires both viewpoints and a subsequent tower visit', () => {
  let state = run(route.slice(0, 8)).state;
  assert.equal(state.stage, 'council');
  state = run([visit('beacon_tower'), talk('mara'), visit('beacon_tower')], state).state;
  assert.equal(state.stage, 'council');
  assert.match(getJournal(state).find(q => q.id === 'beacon').objective, /Tamsin/);
  state = run([talk('tamsin'), visit('beacon_tower')], state).state;
  assert.equal(state.stage, 'decision');
  assert.equal(getEndingChoices(state).length, 2);
});
test('dispatches require known locations and pay only on return', () => {
  assert.equal(run([interact('dispatch_ridge')]).state.flags.dispatch_ridge, undefined);
  const { state, rewards } = run([talk('tamsin'), visit('ridge_road'), interact('dispatch_ridge'), visit('observatory_ruins'), interact('dispatch_observatory')]);
  assert.equal(rewards.length, 0);
  assert.match(getJournal(state).find(q => q.id === 'dispatches').objective, /Return/);
  const result = applyStoryEvent(state, talk('tamsin'));
  assert.deepEqual(result.rewards, [{ id: 'dispatch_reward', gold: 15 }]);
  assert.equal(getJournal(result.state).find(q => q.id === 'dispatches').status, 'complete');
});
test('reducer does not mutate frozen input and survives JSON at every stage', () => {
  let state = createStoryState();
  for (const event of [...route, choose('protect_town')]) {
    const serialized = JSON.stringify(state);
    Object.freeze(state.flags); Object.freeze(state); Object.freeze(event);
    const result = applyStoryEvent(state, event);
    assert.equal(JSON.stringify(state), serialized);
    assert.deepEqual(applyStoryEvent(JSON.parse(serialized), event), result);
    state = JSON.parse(JSON.stringify(result.state));
    assert.ok(getJournal(state).every(q => typeof q.objective === 'string'));
    for (const npc of ['mara', 'iven', 'tamsin']) assert.ok(getDialogue(state, npc).text.length > 10);
  }
});
test('journal does not spoil locked quests and unknown dialogue is absent', () => {
  assert.deepEqual(getJournal().map(q => q.id), ['road']);
  assert.equal(getDialogue(createStoryState(), 'unknown'), null);
  assert.deepEqual(getEndingChoices(), []);
});
test('adapter applies rewards once, ignores enemy species, and follows new state after load', () => {
  const handlers = new Map();
  const bus = { on(k, fn) { if (!handlers.has(k)) handlers.set(k, new Set()); handlers.get(k).add(fn); }, off(k, fn) { handlers.get(k)?.delete(fn); }, emit(k, e) { handlers.get(k)?.forEach(fn => fn(e)); } };
  const game = { state: { gold: 0 }, bus };
  const cleanup = installStory(game);
  assert.equal(installStory(game), cleanup);
  assert.equal(handlers.get('story:event').size, 1);
  bus.emit('story:event', talk('mara'));
  bus.emit('story:event', visit('ridge_road'));
  bus.emit('combat:victory', { enemyId: 'ridge_patrol' });
  assert.equal(game.state.story.stage, 'road');
  bus.emit('combat:victory', { encounterId: 'ridge_patrol' });
  bus.emit('story:event', talk('mara'));
  bus.emit('story:event', talk('mara'));
  assert.equal(game.state.gold, 20);
  game.state = { gold: 7 };
  dispatchStoryEvent(game, talk('mara'));
  assert.equal(game.state.story.stage, 'road');
  assert.equal(game.state.gold, 7);
  cleanup();
  assert.equal(handlers.get('story:event').size, 0);
});
