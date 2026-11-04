import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveGame, loadGame } from '../src/state.js';
import { applyStoryEvent, getJournal } from '../src/story/index.js';
import { COMMISSIONS, getCommission, commissionProgress, getCommissionJournal } from '../src/story/commissions.js';
import { createStoryUI } from '../src/story/view.js';
import { installStory } from '../src/story/integration.js';
import { installEnding } from '../src/scenes/ending.js';
import { COMPANIONS } from '../src/party/companions.js';

const advance = (s, e) => applyStoryEvent(s, e).state;
const accept = c => ({ type: 'commission-accept', companionId: c.id });
const report = c => ({ type: 'commission-report', companionId: c.id });
const victory = c => ({ type: 'victory', encounterId: c.encounterId });
const inspect = c => ({ type: 'interact', interactionId: c.interactionId });
const click = arg => ({ dataset: { arg } });
function freeze(v) { if (v && typeof v === 'object') { Object.values(v).forEach(freeze); Object.freeze(v); } return v; }
function available(c) { const story = createInitialState().story; story.flags[c.unlock] = true; return story; }
function bus() {
  const listeners = new Map();
  return { on(k, f) { if (!listeners.has(k)) listeners.set(k, new Set()); listeners.get(k).add(f); },
    off(k, f) { listeners.get(k)?.delete(f); }, emit(k, v) { for (const f of listeners.get(k) || []) f(v); } };
}

for (const c of COMMISSIONS) {
  test(`${c.name}: exact objectives, either order, immutable once-only payment and permanent choices`, () => {
    assert.equal(c.unlock, COMPANIONS[c.id].unlock);
    for (const ending of ['protect_town', 'share_signal']) for (const reverse of [false, true]) {
      const original = freeze({ ...available(c), stage: 'complete', ending,
        flags: { ...available(c).flags, relay_choice: 'route_network', rescue_reward: true, spire_reward: true },
        expedition: { active: { id: 'spire_patrol', progress: 1 }, completed: 2 } });
      let story = advance(original, accept(c));
      for (const e of reverse ? [inspect(c), victory(c)] : [victory(c), inspect(c)]) {
        const result = applyStoryEvent(freeze(story), e); assert.deepEqual(result.rewards, []); story = result.state;
      }
      assert.equal(commissionProgress(story, c.id).ready, true);
      const result = applyStoryEvent(freeze(story), report(c));
      assert.deepEqual(result.rewards, [{ id: `commission_${c.id}_reward`, gold: c.gold }]);
      assert.equal(result.state.ending, ending); assert.equal(result.state.stage, 'complete');
      assert.equal(result.state.flags.relay_choice, 'route_network');
      assert.equal(result.state.flags.rescue_reward, true); assert.equal(result.state.flags.spire_reward, true);
      assert.deepEqual(result.state.expedition, original.expedition);
      assert.equal(original.flags[`commission_${c.id}_accepted`], undefined);
      assert.equal(getJournal(result.state).find(q => q.id === `commission_${c.id}`).status, 'complete');
      for (const e of [accept(c), victory(c), inspect(c), report(c), { type: 'talk', npcId: c.id }]) {
        assert.deepEqual(applyStoryEvent(freeze(result.state), e).rewards, []);
      }
    }
  });
  test(`${c.name}: every prerequisite is required; early facts count but species alone never does`, () => {
    for (const omitted of ['unlock', 'accept', 'victory', 'inspect']) {
      let story = omitted === 'unlock' ? createInitialState().story : available(c);
      for (const [name, e] of [['accept', accept(c)], ['victory', victory(c)], ['inspect', inspect(c)]]) if (name !== omitted) story = advance(story, e);
      assert.equal(commissionProgress(story, c.id).ready, false);
      assert.deepEqual(applyStoryEvent(story, report(c)).rewards, []);
    }
    let story = [inspect(c), victory(c)].reduce(advance, createInitialState().story);
    assert.deepEqual(getCommissionJournal(story), []);
    story = { ...story, flags: { ...story.flags, [c.unlock]: true } };
    story = advance(story, accept(c)); assert.equal(commissionProgress(story, c.id).ready, true);
    story = [accept(c), inspect(c), { type: 'victory', enemyId: c.encounterId }].reduce(advance, available(c));
    assert.equal(commissionProgress(story, c.id).defeated, false);
    assert.deepEqual(applyStoryEvent(story, report(c)).rewards, []);
    for (const truthy of [1, 'true', {}, []]) {
      story = advance(available(c), { ...accept(c), previouslyCleared: truthy, previouslyInspected: truthy });
      assert.equal(commissionProgress(story, c.id).defeated, false);
      assert.equal(commissionProgress(story, c.id).inspected, false);
    }
  });
}

test('unknown and prototype IDs never accept requests or synthesize progress', () => {
  for (const id of ['constructor', '__proto__', 'toString', '', null, {}, undefined]) {
    assert.equal(getCommission(id), null); assert.equal(commissionProgress({}, id), null);
    const game = { state: createInitialState() }, ui = createStoryUI();
    const before = structuredClone(game.state);
    ui.actions.storyCommissionAccept(game, click(id)); ui.actions.storyCommissionReport(game, click(id));
    assert.deepEqual(game.state, before);
    for (const type of ['commission-accept', 'commission-report', 'victory', 'interact']) {
      const result = applyStoryEvent(before.story, { type, companionId: id, encounterId: id, interactionId: id, previouslyCleared: true, previouslyInspected: true });
      assert.deepEqual(result.rewards, []); assert.deepEqual(result.state, before.story);
    }
  }
});

test('town board is collapsed, journal opt-in, and authoritative getter rejects stale actions', () => {
  const game = { state: createInitialState() }, ui = createStoryUI();
  assert.doesNotMatch(ui.render(game), /<summary>Companion commissions/);
  for (const c of COMMISSIONS) game.state.story.flags[c.unlock] = true;
  assert.deepEqual(getCommissionJournal(freeze(structuredClone(game.state.story))), []);
  assert.match(ui.render(game), /<details class="companion-commissions"><summary>Companion commissions/);
  assert.doesNotMatch(ui.render(game), /data-action="storyCommissionReport"/);
  game.state.location = 'ridge_road';
  assert.doesNotMatch(ui.render(game), /data-action="storyCommissionAccept"/);
  ui.actions.storyCommissionAccept(game, click('tamsin'));
  assert.equal(commissionProgress(game.state.story, 'tamsin').accepted, false);
  const town = createStoryUI(() => 'greyhaven');
  town.actions.storyCommissionAccept(game, click('tamsin'));
  assert.equal(getCommissionJournal(game.state.story).length, 1);
  assert.match(getCommissionJournal(game.state.story)[0].objective, /Gale Hound.*dispatch/);
  game.state.story = [victory(COMMISSIONS[0]), inspect(COMMISSIONS[0])].reduce(advance, game.state.story);
  ui.actions.storyCommissionReport(game, click('tamsin')); assert.equal(game.state.gold, 20);
  assert.match(town.render(game), /data-action="storyCommissionReport" data-arg="tamsin"/);
  town.actions.storyCommissionReport(game, click('tamsin')); assert.equal(game.state.gold, 45);
  town.actions.storyCommissionReport(game, click('tamsin')); assert.equal(game.state.gold, 45);
  game.state.location = 'greyhaven';
  const away = createStoryUI(() => 'ridge_road');
  away.actions.storyCommissionAccept(game, click('iven')); assert.equal(commissionProgress(game.state.story, 'iven').accepted, false);
});

test('acceptance reconciles exact live map history for old saves; unrelated or nonboolean history does not count', () => {
  for (const c of COMMISSIONS) {
    const game = { state: createInitialState() }, ui = createStoryUI(); game.state.story = available(c);
    game.state.map = { clearedEncounters: { unrelated: true, [c.encounterId]: 1 }, completedInteractions: { unrelated: true, [c.interactionId]: 'true' } };
    const original = structuredClone(game.state);
    ui.actions.storyCommissionAccept(game, click(c.id));
    assert.equal(commissionProgress(game.state.story, c.id).ready, false);
    game.state = original; // Simulates loading a different save after UI creation.
    game.state.map.clearedEncounters[c.encounterId] = true;
    game.state.map.completedInteractions[c.interactionId] = true;
    ui.actions.storyCommissionAccept(game, click(c.id));
    assert.equal(commissionProgress(game.state.story, c.id).ready, true);
    ui.actions.storyCommissionReport(game, click(c.id)); assert.equal(game.state.gold, 20 + c.gold);
  }
  // Repeatable lamps/cairns have no old completedInteractions entry: reinspection supplies the fact.
  for (const c of COMMISSIONS.slice(2)) {
    const game = { state: createInitialState() }, ui = createStoryUI(); game.state.story = available(c);
    game.state.map = { clearedEncounters: { [c.encounterId]: true }, completedInteractions: {} };
    ui.actions.storyCommissionAccept(game, click(c.id)); assert.equal(commissionProgress(game.state.story, c.id).ready, false);
    game.state.story = advance(game.state.story, inspect(c));
    ui.actions.storyCommissionReport(game, click(c.id)); assert.equal(game.state.gold, 20 + c.gold);
  }
});

test('real bus, save replacements and all four payments preserve finale and notify after commit', () => {
  const oldStorage = globalThis.localStorage; let saved;
  globalThis.localStorage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  try {
    const scenes = [], paid = [];
    const game = { state: createInitialState(), bus: bus(), setScene(name) { scenes.push(name); } };
    game.state.story.stage = 'complete'; game.state.story.ending = 'share_signal';
    game.state.story.flags = { relay_choice: 'shelter_network', rescue_reward: true, spire_reward: true };
    game.state.flags.endingShown = true; game.state.flags.finaleShown = true;
    for (const c of COMMISSIONS) game.state.story.flags[c.unlock] = true;
    const cleanup = installStory(game); installEnding(game); const ui = createStoryUI();
    const checkpoint = () => { saveGame(game.state); game.state = loadGame(); };
    game.bus.on('story:updated', p => {
      assert.equal(p.state, game.state.story);
      paid.push(...p.rewards); assert.equal(game.state.gold, 20 + paid.reduce((sum, r) => sum + r.gold, 0));
    });
    for (const c of COMMISSIONS) {
      ui.actions.storyCommissionAccept(game, click(c.id)); checkpoint();
      game.bus.emit('combat:victory', { encounterId: c.encounterId }); checkpoint();
      game.bus.emit('story:event', inspect(c)); checkpoint();
      ui.actions.storyCommissionReport(game, click(c.id)); checkpoint();
      ui.actions.storyCommissionReport(game, click(c.id)); checkpoint();
    }
    assert.equal(game.state.gold, 170); assert.equal(paid.length, 4);
    assert.equal(game.state.story.ending, 'share_signal'); assert.equal(game.state.story.flags.relay_choice, 'shelter_network');
    assert.equal(game.state.story.flags.rescue_reward, true); assert.equal(game.state.flags.finaleShown, true);
    assert.deepEqual(scenes, []); assert.equal(getCommissionJournal(game.state.story).filter(q => q.status === 'complete').length, 4);
    cleanup(); const before = structuredClone(game.state);
    game.bus.emit('combat:victory', { encounterId: 'ridge_patrol' }); assert.deepEqual(game.state, before);
  } finally { if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; }
});
