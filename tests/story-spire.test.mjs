import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveGame, loadGame } from '../src/state.js';
import { applyStoryEvent, getJournal, getDialogue } from '../src/story/index.js';
import { SPIRE_GOLD, spireReady, getSpireJournal } from '../src/story/spire.js';
import { EXPEDITIONS, activeExpedition, getExpeditionJournal } from '../src/story/expeditions.js';
import { getTownOutlook } from '../src/story/outlook.js';
import { createStoryUI } from '../src/story/view.js';
import { installStory, dispatchStoryEvent } from '../src/story/integration.js';
import { installEnding } from '../src/scenes/ending.js';

const accept = { type: 'spire-accept' }, report = { type: 'spire-report' };
const facts = [
  { type: 'visit', locationId: 'stormcrown_spire' },
  { type: 'interact', interactionId: 'survey_records_a' },
  { type: 'interact', interactionId: 'survey_records_b' },
  { type: 'victory', encounterId: 'stormcrown_tyrant', enemyId: 'stormcrown_tyrant' },
  { type: 'interact', interactionId: 'spire_summit' },
];
const advance = (s, e) => applyStoryEvent(s, e).state;
function ready(ending = 'protect_town', relay = 'shelter_network') {
  const state = createInitialState();
  state.story = { version: 1, stage: 'complete', ending, flags: { road_reward: true, lens_reward: true, chapter_reward: true, relief_reward: true, rescue_reward: true, relay_choice: relay, relay_reward: true } };
  state.flags.endingShown = true;
  return state;
}
const surveyed = (ending, relay) => [accept, ...facts].reduce(advance, ready(ending, relay).story);
const reported = () => advance(surveyed(), report);
const click = arg => ({ dataset: { arg } });
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function bus() {
  const listeners = new Map();
  return { on(k, f) { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(f); },
    off(k, f) { listeners.get(k)?.delete(f); }, emit(k, v) { for (const f of listeners.get(k) || []) f(v); } };
}

test('spire offer requires a completed beacon and valid relay choice; talk never accepts or pays', () => {
  for (const story of [createInitialState().story, { ...ready().story, flags: {} }, { ...ready().story, flags: { relay_choice: 'constructor' } }, { ...ready().story, stage: 'road' }]) {
    assert.deepEqual(getSpireJournal(story), []);
    assert.equal(advance(story, accept).flags.spire_accepted, undefined);
    assert.deepEqual(applyStoryEvent(story, report).rewards, []);
  }
  const game = { state: ready() }, ui = createStoryUI();
  assert.match(ui.render(game), /data-action="storySpire" data-arg="accept"/);
  ui.actions.storyTalk(game, click('mara'));
  assert.equal(game.state.story.flags.spire_accepted, undefined);
  assert.equal(game.state.gold, 20);
  assert.equal(getDialogue(game.state.story, '__proto__'), null);
});

for (const ending of ['protect_town', 'share_signal']) for (const relay of ['shelter_network', 'route_network']) {
  test(`summit survey preserves ${ending}/${relay}, pays 150 exactly once and opens patrols`, () => {
    const original = freeze(surveyed(ending, relay));
    const result = applyStoryEvent(original, report);
    assert.deepEqual(result.rewards, [{ id: 'spire_reward', gold: SPIRE_GOLD }]);
    assert.equal(original.flags.spire_reward, undefined);
    assert.equal(result.state.stage, 'complete'); assert.equal(result.state.ending, ending);
    assert.equal(result.state.flags.relay_choice, relay);
    for (const flag of ['relief_reward', 'rescue_reward', 'relay_reward', 'spire_reward']) assert.equal(result.state.flags[flag], true);
    assert.equal(getJournal(result.state).find(q => q.id === 'spire').status, 'complete');
    assert.equal(getExpeditionJournal(result.state).length, 1);
    assert.match(getTownOutlook(result.state).text, ending === 'protect_town' ? /blue shield/ : /silver roads/);
    assert.match(getDialogue(result.state, 'mara').text, /expedition board/);
    for (const event of [accept, report, ...facts, { type: 'talk', npcId: 'mara' }]) {
      assert.deepEqual(applyStoryEvent(freeze(result.state), event).rewards, []);
    }
  });
}

test('all summit prerequisites are necessary and early facts survive reverse order', () => {
  for (const omitted of [accept, ...facts]) {
    const story = [accept, ...facts].filter(e => e !== omitted).reduce(advance, ready().story);
    assert.equal(spireReady(story), false); assert.deepEqual(applyStoryEvent(story, report).rewards, []);
  }
  let early = [...facts].reverse().reduce(advance, createInitialState().story);
  assert.equal(spireReady(early), false);
  early = { ...early, stage: 'complete', ending: 'share_signal', flags: { ...early.flags, relay_choice: 'route_network' } };
  early = advance(early, accept);
  assert.equal(spireReady(early), true); assert.equal(applyStoryEvent(early, report).rewards[0].gold, 150);
  for (const e of [{ type: 'victory', enemyId: 'stormcrown_tyrant' }, { type: 'victory', encounterId: 'spire_sentry_post' }, { type: 'interact', interactionId: 'constructor' }]) {
    const s = advance(ready().story, e); assert.equal(s.flags.spire_victory, undefined); assert.equal(s.flags.spire_summit, undefined);
  }
});

test('summit journal stages and town outlook are read-only and direct the next objective', () => {
  let story = freeze(ready().story);
  assert.match(getSpireJournal(story)[0].objective, /Accept/);
  story = advance(story, accept);
  for (const [i, pattern] of [/Spire Switchback/, /northwest archive and the eastern/, /eastern observation/, /Defeat/, /Inspect/].entries()) {
    assert.match(getSpireJournal(freeze(story))[0].objective, pattern);
    assert.match(getTownOutlook(story).hint, pattern);
    story = advance(story, facts[i]);
  }
  assert.match(getSpireJournal(story)[0].objective, /report.*150 gold/);
});

test('patrols unlock only after report, reject invalid IDs and ignore pre-acceptance victories', () => {
  const event = { type: 'expedition-accept', contractId: 'sunscar_patrol' };
  assert.equal(activeExpedition(advance(surveyed(), event)), null);
  for (const contractId of ['constructor', '__proto__', 'stormcrown_tyrant', null]) {
    assert.equal(activeExpedition(advance(reported(), { ...event, contractId })), null);
  }
  let s = advance(reported(), { type: 'victory', enemyId: 'dust_marauder' });
  s = advance(s, event); assert.equal(activeExpedition(s).progress, 0);
  for (const e of [{ type: 'victory', enemyId: 'relay_drone' }, { type: 'victory', encounterId: 'dust_marauder' }, { type: 'expedition-accept', contractId: 'spire_patrol' }]) s = advance(freeze(s), e);
  assert.equal(activeExpedition(s).id, 'sunscar_patrol'); assert.equal(activeExpedition(s).progress, 0);
  assert.deepEqual(applyStoryEvent(s, { type: 'expedition-claim' }).rewards, []);
});

for (const c of EXPEDITIONS) test(`${c.id} counts new species victories, caps progress, and can be completed twice`, () => {
  let story = freeze(reported());
  for (let cycle = 1; cycle <= 2; cycle++) {
    story = advance(story, { type: 'expedition-accept', contractId: c.id });
    for (let n = 1; n <= 3; n++) {
      const previous = freeze(story);
      const result = applyStoryEvent(previous, { type: 'victory', enemyId: c.enemyId });
      story = result.state;
      assert.equal(activeExpedition(story).progress, Math.min(n, 2));
      assert.equal(activeExpedition(previous).progress, Math.min(n - 1, 2));
      assert.deepEqual(result.rewards, []);
    }
    assert.match(getExpeditionJournal(story)[0].objective, /Claim/);
    const result = applyStoryEvent(freeze(story), { type: 'expedition-claim' });
    assert.deepEqual(result.rewards, [{ id: `expedition_reward_${cycle}`, gold: c.gold }]);
    story = result.state; assert.equal(activeExpedition(story), null); assert.equal(story.expedition.completed, cycle);
    assert.deepEqual(applyStoryEvent(story, { type: 'expedition-claim' }).rewards, []);
    assert.equal(story.ending, 'protect_town'); assert.equal(story.flags.relay_choice, 'shelter_network');
  }
});

test('cancelling a patrol discards progress and never pays; malformed saved patrols cannot create rewards', () => {
  let s = advance(reported(), { type: 'expedition-accept', contractId: 'spire_patrol' });
  s = advance(s, { type: 'victory', enemyId: 'spire_sentry' });
  const result = applyStoryEvent(freeze(s), { type: 'expedition-cancel' });
  assert.deepEqual(result.rewards, []); assert.equal(activeExpedition(result.state), null);
  s = advance(result.state, { type: 'expedition-accept', contractId: 'spire_patrol' });
  assert.equal(activeExpedition(s).progress, 0);
  for (const active of [null, {}, { id: 'constructor', progress: 2 }, { id: 'spire_patrol', progress: '2' }, { id: 'spire_patrol', progress: -1 }]) {
    assert.deepEqual(applyStoryEvent({ ...reported(), expedition: { active } }, { type: 'expedition-claim' }).rewards, []);
  }
});

test('survey and board actions reject stale outside-town controls and use the authoritative location getter', () => {
  const game = { state: ready() }, ui = createStoryUI(); game.state.location = 'stormcrown_spire';
  ui.actions.storySpire(game, click('accept')); assert.equal(game.state.story.flags.spire_accepted, undefined);
  const townUI = createStoryUI(() => 'greyhaven'); townUI.actions.storySpire(game, click('accept'));
  facts.forEach(e => dispatchStoryEvent(game, e));
  ui.actions.storySpire(game, click('report')); assert.equal(game.state.gold, 20);
  townUI.actions.storySpire(game, click('report')); assert.equal(game.state.gold, 170);
  assert.doesNotMatch(ui.render(game), /data-action="storyExpedition"/);
  ui.actions.storyExpedition(game, click('spire_patrol')); assert.equal(activeExpedition(game.state.story), null);
  townUI.actions.storyExpedition(game, click('constructor')); assert.equal(activeExpedition(game.state.story), null);
  townUI.actions.storyExpedition(game, click('spire_patrol'));
  assert.doesNotMatch(townUI.render(game), /data-action="storyExpedition" data-arg="claim"/);
  for (let i = 0; i < 2; i++) dispatchStoryEvent(game, { type: 'victory', enemyId: 'spire_sentry' });
  assert.match(townUI.render(game), /data-action="storyExpedition" data-arg="claim"/);
  ui.actions.storyExpedition(game, click('claim')); assert.equal(game.state.gold, 170);
  townUI.actions.storyExpedition(game, click('claim')); assert.equal(game.state.gold, 230);
  townUI.actions.storyExpedition(game, click('claim')); assert.equal(game.state.gold, 230);
});

test('real event bus commits survey and repeated patrol payments before notification across save replacements', () => {
  const oldStorage = globalThis.localStorage; let saved;
  globalThis.localStorage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  try {
    const scenes = [];
    const game = { state: ready(), bus: bus(), setScene(name) { scenes.push(name); } };
    const cleanup = installStory(game); installEnding(game);
    const checkpoint = () => { saveGame(game.state); game.state = loadGame(); };
    const paid = [];
    game.bus.on('story:updated', p => {
      if (p.rewards.length) { paid.push(...p.rewards); assert.equal(p.state, game.state.story); assert.equal(game.state.gold, 20 + paid.reduce((sum, r) => sum + r.gold, 0)); }
    });
    game.bus.emit('story:event', accept);
    for (const e of facts) { game.bus.emit(e.type === 'victory' ? 'combat:victory' : 'story:event', e); checkpoint(); }
    assert.deepEqual(scenes, [], 'postgame must not replay the chapter 1 ending');
    dispatchStoryEvent(game, report); checkpoint();
    assert.deepEqual(scenes, ['ending'], 'spire report shows the finale once');
    for (const contract of EXPEDITIONS) {
      dispatchStoryEvent(game, { type: 'expedition-accept', contractId: contract.id }); checkpoint();
      for (let n = 1; n <= 2; n++) {
        game.bus.emit('combat:victory', { enemyId: contract.enemyId }); checkpoint();
        assert.equal(activeExpedition(game.state.story).progress, n);
      }
      dispatchStoryEvent(game, { type: 'expedition-claim' }); checkpoint();
      dispatchStoryEvent(game, { type: 'expedition-claim' });
    }
    assert.deepEqual(scenes, ['ending'], 'finale never repeats');
    assert.equal(game.state.gold, 265); assert.equal(paid.length, 3);
    assert.equal(game.state.story.expedition.completed, 2);
    assert.equal(game.state.story.flags.victory_ridge_patrol, undefined);
    assert.equal(game.state.story.flags.spire_victory, true);
    cleanup();
    const before = structuredClone(game.state); game.bus.emit('combat:victory', { enemyId: 'spire_sentry' }); assert.deepEqual(game.state, before);
  } finally { if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; }
});
