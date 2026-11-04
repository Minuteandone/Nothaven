import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveGame, loadGame } from '../src/state.js';
import { applyStoryEvent, getJournal, getDialogue } from '../src/story/index.js';
import { HEART_GOLD, heartAvailable, heartReady, getHeartJournal } from '../src/story/heart.js';
import { createStoryUI } from '../src/story/view.js';
import { getTownOutlook } from '../src/story/outlook.js';
import { installStory, dispatchStoryEvent } from '../src/story/integration.js';
import { installEnding } from '../src/scenes/ending.js';
import { getEffectiveRandomEncounterChance } from '../src/map/mapState.js';

const accept = { type: 'heart-accept' }, report = { type: 'heart-report' };
const facts = [
  { type: 'visit', locationId: 'storms_eye' },
  { type: 'interact', interactionId: 'eye_anchor_west' },
  { type: 'interact', interactionId: 'eye_anchor_east' },
  { type: 'victory', encounterId: 'storm_heart_core', enemyId: 'storm_heart' },
];
const advance = (s, e) => applyStoryEvent(s, e).state;
const click = arg => ({ dataset: { arg } });
function ready(ending = 'protect_town', relay = 'shelter_network') {
  const state = createInitialState();
  state.story = { version: 1, stage: 'complete', ending, flags: {
    road_reward: true, lens_reward: true, chapter_reward: true, relief_reward: true,
    rescue_reward: true, relay_choice: relay, relay_reward: true, spire_reward: true,
    commission_tamsin_reward: true,
  }, expedition: { active: { id: 'spire_patrol', progress: 1 }, completed: 2 } };
  state.flags.endingShown = true; state.flags.finaleShown = true;
  return state;
}
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function bus() {
  const listeners = new Map();
  return { on(k, f) { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(f); },
    off(k, f) { listeners.get(k)?.delete(f); }, emit(k, v) { for (const f of listeners.get(k) || []) f(v); } };
}

test('heart expedition is optional after the paid summit survey; talking never accepts or pays', () => {
  for (const story of [createInitialState().story, { ...ready().story, flags: {} }, { ...ready().story, flags: { spire_reward: 'true' } }, { ...ready().story, stage: 'road' }]) {
    assert.equal(heartAvailable(story), false); assert.deepEqual(getHeartJournal(story), []);
    assert.equal(advance(story, accept).flags.heart_accepted, undefined);
    assert.deepEqual(applyStoryEvent(story, report).rewards, []);
  }
  const game = { state: ready() }, ui = createStoryUI();
  assert.match(ui.render(game), /data-action="storyHeart" data-arg="accept"/);
  assert.match(getHeartJournal(game.state.story)[0].objective, /Optional/);
  for (const npc of ['mara', 'iven', 'tamsin']) {
    ui.actions.storyTalk(game, click(npc));
    assert.equal(game.state.story.flags.heart_accepted, undefined); assert.equal(game.state.gold, 20);
  }
  assert.equal(getDialogue(game.state.story, '__proto__'), null);
});

for (const ending of ['protect_town', 'share_signal']) for (const relay of ['shelter_network', 'route_network']) {
  test(`heart report preserves ${ending}/${relay}, previous rewards and patrols, and pays once`, () => {
    const before = ready(ending, relay).story;
    const original = freeze([accept, ...facts].reduce(advance, before));
    const result = applyStoryEvent(original, report);
    assert.deepEqual(result.rewards, [{ id: 'heart_reward', gold: HEART_GOLD }]);
    assert.equal(original.flags.heart_reward, undefined);
    assert.equal(result.state.stage, before.stage); assert.equal(result.state.ending, ending);
    assert.deepEqual(result.state.expedition, before.expedition);
    for (const [key, value] of Object.entries(before.flags)) assert.equal(result.state.flags[key], value);
    assert.equal(getJournal(result.state).find(q => q.id === 'heart').status, 'complete');
    assert.match(getTownOutlook(result.state).text, /great storm over Stormcrown breaks/);
    assert.match(getDialogue(result.state, 'mara').text, /Ordinary weather and fixed foes remain/);
    for (const event of [accept, report, ...facts, { type: 'talk', npcId: 'mara' }]) {
      assert.deepEqual(applyStoryEvent(freeze(result.state), event).rewards, []);
    }
  });
}

test('every heart prerequisite is required; reverse-order discoveries before acceptance are retained', () => {
  for (const omitted of [accept, ...facts]) {
    const story = [accept, ...facts].filter(e => e !== omitted).reduce(advance, ready().story);
    assert.equal(heartReady(story), false); assert.deepEqual(applyStoryEvent(story, report).rewards, []);
  }
  let early = [...facts].reverse().reduce(advance, createInitialState().story);
  assert.equal(heartReady(early), false); assert.equal(early.flags.victory_storm_heart, true);
  assert.deepEqual(applyStoryEvent(early, report).rewards, []);
  early = { ...early, stage: 'complete', ending: 'share_signal', flags: { ...early.flags, spire_reward: true } };
  assert.deepEqual(applyStoryEvent(early, report).rewards, []);
  early = advance(early, accept); assert.equal(heartReady(early), true);
  assert.equal(applyStoryEvent(early, report).rewards[0].gold, 200);
});

test('only the exact fixed core victory enables regional calming, immediately and once', () => {
  for (const event of [
    { type: 'victory', enemyId: 'storm_heart' },
    { type: 'victory', encounterId: 'storm_heart' },
    { type: 'victory', encounterId: 'other_core', enemyId: 'storm_heart' },
    { type: 'interact', interactionId: 'constructor' },
    { type: 'visit', locationId: 'constructor' },
  ]) assert.deepEqual(advance(freeze(ready().story), event), ready().story);
  for (const relay of ['shelter_network', 'route_network']) {
    const result = applyStoryEvent(freeze(ready('protect_town', relay).story), facts[3]);
    assert.equal(result.state.flags.victory_storm_heart, true);
    assert.equal(result.state.flags.heart_reward, undefined); assert.deepEqual(result.rewards, []);
    assert.match(result.log.join(' '), /half as likely.*halves that chance again/);
    for (const id of ['stormcrown_spire', 'storms_eye']) {
      const chance = getEffectiveRandomEncounterChance({ story: result.state }, { id, randomEncounterChance: 0.14 });
      assert.equal(chance, relay === 'route_network' ? 0.035 : 0.07);
    }
    assert.equal(getEffectiveRandomEncounterChance({ story: result.state }, { id: 'sunscar_relay', randomEncounterChance: 0.14 }), relay === 'route_network' ? 0.07 : 0.14);
    assert.deepEqual(applyStoryEvent(result.state, facts[3]).log, []);
  }
});

test('heart journal and outlook are read-only and identify each remaining objective', () => {
  let story = advance(freeze(ready().story), accept);
  for (const [i, pattern] of [/passage into the Storm’s Eye/, /western anchor and the eastern anchor/, /eastern anchor/, /Defeat the Storm Heart/].entries()) {
    assert.match(getHeartJournal(freeze(story))[0].objective, pattern);
    assert.match(getTownOutlook(story).hint, pattern);
    story = advance(story, facts[i]);
  }
  assert.match(getHeartJournal(freeze(story))[0].objective, /report to Mara for 200 gold/);
  assert.match(getTownOutlook(story).text, /great storm over Stormcrown has broken/);
});

test('heart controls reject stale locations and unknown arguments using the authoritative getter', () => {
  const game = { state: ready() }, ui = createStoryUI(); game.state.location = 'storms_eye';
  for (const arg of ['accept', 'report', 'constructor']) ui.actions.storyHeart(game, click(arg));
  assert.equal(game.state.story.flags.heart_accepted, undefined);
  assert.doesNotMatch(ui.render(game), /data-action="storyHeart"/);
  const town = createStoryUI(() => 'greyhaven');
  for (const arg of ['constructor', '__proto__', null]) town.actions.storyHeart(game, click(arg));
  assert.equal(game.state.story.flags.heart_accepted, undefined);
  town.actions.storyHeart(game, click('accept'));
  assert.doesNotMatch(town.render(game), /data-action="storyHeart" data-arg="report"/);
  facts.forEach(e => dispatchStoryEvent(game, e));
  assert.match(town.render(game), /data-action="storyHeart" data-arg="report"/);
  ui.actions.storyHeart(game, click('report')); assert.equal(game.state.gold, 20);
  town.actions.storyHeart(game, click('report')); assert.equal(game.state.gold, 220);
  town.actions.storyHeart(game, click('report')); assert.equal(game.state.gold, 220);
  assert.doesNotMatch(town.render(game), /data-action="storyHeart"/);
});

test('real bus saves early facts, pays before notification, and never replays either finale', () => {
  const oldStorage = globalThis.localStorage; let saved;
  globalThis.localStorage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  try {
    const scenes = [], paid = [];
    const game = { state: ready(), bus: bus(), setScene(name) { scenes.push(name); } };
    const cleanup = installStory(game), cleanupEnding = installEnding(game);
    const checkpoint = () => { saveGame(game.state); game.state = loadGame(); };
    game.bus.on('story:updated', p => {
      assert.equal(p.state, game.state.story);
      if (p.rewards.length) { paid.push(...p.rewards); assert.equal(game.state.gold, 220); }
    });
    for (const e of facts) { game.bus.emit(e.type === 'victory' ? 'combat:victory' : 'story:event', e); checkpoint(); }
    assert.equal(game.state.gold, 20); assert.equal(game.state.story.flags.victory_storm_heart, true);
    game.bus.emit('story:event', report); assert.equal(game.state.gold, 20);
    game.bus.emit('story:event', accept); checkpoint();
    createStoryUI().actions.storyTalk(game, click('mara')); assert.equal(game.state.gold, 20);
    createStoryUI().actions.storyHeart(game, click('report')); checkpoint();
    game.bus.emit('story:event', report); game.bus.emit('combat:victory', facts[3]);
    assert.deepEqual(paid, [{ id: 'heart_reward', gold: 200 }]); assert.deepEqual(scenes, []);
    assert.equal(game.state.flags.endingShown, true); assert.equal(game.state.flags.finaleShown, true);
    assert.equal(game.state.story.ending, 'protect_town');
    assert.equal(game.state.story.flags.relay_choice, 'shelter_network');
    cleanup(); cleanupEnding();
    const before = structuredClone(game.state); game.bus.emit('story:event', accept); assert.deepEqual(game.state, before);
  } finally { if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; }
});
