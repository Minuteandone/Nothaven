import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveGame, loadGame } from '../src/state.js';
import { EXPEDITIONS, applyExpeditionEvent, expeditionAvailable, activeExpedition, getExpeditionJournal } from '../src/story/expeditions.js';
import { createStoryUI } from '../src/story/view.js';
import { installStory } from '../src/story/integration.js';
const id = 'signal_line_patrol';
const ids = ['dust_marauder', 'spire_sentry', 'tempest_shade'];
const empty = () => Object.fromEntries(ids.map(x => [x, 0]));
const ready = () => ({ ...createInitialState().story, stage: 'complete', ending: 'share_signal', flags: { spire_reward: true, calibration_reward: true, heart_reward: true, relay_choice: 'route_network' } });
const accept = { type: 'expedition-accept', contractId: id }, claim = { type: 'expedition-claim' }, cancel = { type: 'expedition-cancel' };
const win = enemyId => ({ type: 'victory', enemyId });
const advance = (s, e) => applyExpeditionEvent(s, e).state;
const click = arg => ({ dataset: { arg } });
function freeze(x) { if (x && typeof x === 'object') { Object.values(x).forEach(freeze); Object.freeze(x); } return x; }
function noChange(s, e) { const result = applyExpeditionEvent(freeze(s), e); assert.deepEqual(result, { state: s, rewards: [], log: [] }); }
function complete(s = ready()) { return ids.reduce((s, enemyId) => advance(s, win(enemyId)), advance(s, accept)); }

test('Signal Line requires both strictly paid flags; existing gates and metadata stay compatible', () => {
  for (const flag of ['spire_reward', 'calibration_reward']) for (const value of [undefined, false, 1, 'true', {}, []]) {
    const s = ready(); s.flags[flag] = value;
    assert.equal(expeditionAvailable(s, id), false); noChange(s, accept);
    const malformed = { ...s, expedition: { active: { id, progress: 3, targets: Object.fromEntries(ids.map(x => [x, 1])) } } };
    assert.equal(activeExpedition(malformed), null); noChange(malformed, claim);
  }
  assert.equal(expeditionAvailable(ready(), id), true);
  assert.deepEqual(EXPEDITIONS.filter(c => !c.requiresFlag).map(c => c.id), ['sunscar_patrol', 'spire_patrol']);
  const legacy = ready(); legacy.flags.spire_reward = 1; delete legacy.flags.calibration_reward;
  for (const old of EXPEDITIONS.slice(0, 3)) assert.equal(expeditionAvailable(legacy, old.id), true);
  const c = EXPEDITIONS.find(c => c.id === id);
  assert.ok(Object.isFrozen(c) && Object.isFrozen(c.targetSpecs) && c.targetSpecs.every(Object.isFrozen));
});

for (const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]) test(`Signal Line fresh independent targets in order ${order}`, () => {
  let s = ready(); for (const target of ids) s = advance(s, win(target));
  s = advance(s, accept); assert.deepEqual(s.expedition.active, { id, progress: 0, targets: empty() });
  for (const [i, n] of order.entries()) {
    const before = freeze(s), result = applyExpeditionEvent(before, win(ids[n])); s = result.state;
    assert.equal(activeExpedition(before).progress, i); assert.deepEqual(result.rewards, []);
    assert.equal(activeExpedition(s).progress, i + 1); assert.equal(s.expedition.active.targets[ids[n]], 1);
    noChange(s, win(ids[n])); if (i < 2) noChange(s, claim);
  }
  const result = applyExpeditionEvent(freeze(s), claim);
  assert.deepEqual(result.rewards, [{ id: 'expedition_reward_1', gold: 120 }]);
  assert.deepEqual(result.state.expedition, { active: null, completed: 1 }); noChange(result.state, claim);
});

test('Signal Line ignores unrelated, prototype, fixed-only and historical events', () => {
  const s = advance(ready(), accept);
  for (const event of [null, [], {}, { type: 'victory', encounterId: 'dust_marauder' }, { type: 'inspect', enemyId: 'spire_sentry' }, ...['constructor','__proto__','toString','storm_heart','thunderhead_colossus'].map(win), { type: 'talk', npcId: 'mara' }]) noChange(s, event);
  const history = ready(); history.flags.victory_dust_marauder = true; history.bestiary = { tempest_shade: 500 };
  assert.deepEqual(advance(history, accept).expedition.active.targets, empty());
});

test('Signal Line derives progress from own strict target integers, never a saved aggregate', () => {
  const probe = targets => ({ ...ready(), expedition: { active: { id, progress: 999, targets }, completed: 0 } });
  for (const targets of [undefined, null, [], '3', Object.create(Object.fromEntries(ids.map(x => [x, 1])))]) {
    const s = probe(targets); assert.equal(activeExpedition(s).progress, 0); noChange(s, claim);
  }
  for (const n of [undefined, null, false, true, '1', -1, .5, NaN, Infinity, {}, []]) {
    const s = probe(Object.fromEntries(ids.map(x => [x, n]))); assert.equal(activeExpedition(s).progress, 0); noChange(s, claim);
  }
  const s = probe({ dust_marauder: 999, spire_sentry: 1, tempest_shade: 0, constructor: 1, unknown: 100 });
  const snapshot = structuredClone(s); assert.equal(activeExpedition(freeze(s)).progress, 2); assert.deepEqual(s, snapshot); noChange(s, claim);
  const done = advance(s, win('tempest_shade')); assert.deepEqual(done.expedition.active.targets, Object.fromEntries(ids.map(x => [x, 1])));
  done.expedition.active.progress = -99; assert.equal(applyExpeditionEvent(done, claim).rewards[0].gold, 120);
});

test('Signal Line cancellation, repeat cycles and all old contracts share one slot without changing old save shape', () => {
  for (const old of EXPEDITIONS.slice(0, 3)) {
    let s = advance(ready(), { ...accept, contractId: old.id });
    assert.deepEqual(s.expedition.active, { id: old.id, progress: 0 }); noChange(s, accept);
    s = advance(s, win(old.enemyId)); assert.deepEqual(s.expedition.active, { id: old.id, progress: 1 });
    s = advance(s, cancel); s = advance(s, accept); noChange(s, { ...accept, contractId: old.id });
    s = advance(s, win('dust_marauder')); s = advance(s, cancel); s = advance(s, accept);
    assert.deepEqual(s.expedition.active, { id, progress: 0, targets: empty() });
  }
  let s = ready(); for (let cycle = 1; cycle <= 2; cycle++) {
    s = complete(s); const r = applyExpeditionEvent(s, claim); s = r.state;
    assert.deepEqual(r.rewards, [{ id: `expedition_reward_${cycle}`, gold: 120 }]);
    assert.equal(s.expedition.completed, cycle);
  }
});

test('Signal Line journal and offers are readonly and explicit about all names and regions', () => {
  const ui = createStoryUI(), game = { state: createInitialState() }; game.state.story = ready();
  const before = structuredClone(game.state); const html = ui.render(game);
  for (const text of ['Signal Line Patrol', '1 Dust Marauder (Sunscar Relay)', '1 Spire Sentry (Stormcrown Spire)', '1 Tempest Shade (The Storm’s Eye)', 'any order']) assert.ok(html.includes(text));
  assert.deepEqual(game.state, before);
  const s = advance(advance(ready(), accept), win('spire_sentry'));
  assert.match(getExpeditionJournal(freeze(s))[0].objective, /0\/1 Dust Marauder.*1\/1 Spire Sentry.*0\/1 Tempest Shade/);
  assert.match(getExpeditionJournal(complete())[0].objective, /Claim 120 gold/);
});

test('Signal Line actions guard actual location, combat, unavailable, partial and stale buttons before clearing dialogue', () => {
  const game = { state: createInitialState(), storyDialogue: 'retained', storyMessage: 'retained' };
  game.state.story = ready(); game.state.map = { zoneId: 'storms_eye' };
  const ui = createStoryUI(g => g.state.map.zoneId);
  const unchanged = arg => { const before = structuredClone(game); ui.actions.storyExpedition(game, click(arg)); assert.deepEqual(game, before); };
  unchanged(id); game.state.map.zoneId = 'greyhaven'; game.state.combat = {}; unchanged(id); game.state.combat = null;
  delete game.state.story.flags.calibration_reward; unchanged(id); game.state.story.flags.calibration_reward = true;
  unchanged('claim'); unchanged('cancel'); unchanged('constructor');
  ui.actions.storyExpedition(game, click(id)); game.storyDialogue = 'retained'; unchanged(id); unchanged('claim');
  game.state.story = complete(); game.state.combat = {}; unchanged('claim'); unchanged('cancel'); game.state.combat = null;
  ui.actions.storyExpedition(game, click('claim')); game.storyDialogue = 'retained'; unchanged('claim'); unchanged('cancel');
});

for (const ending of ['protect_town','share_signal']) for (const relay of ['route_network','shelter_network']) test(`Signal Line preserves ${ending}/${relay}`, () => {
  const s = ready(); s.ending = ending; s.flags.relay_choice = relay; s.flags.unchanged = true;
  const result = applyExpeditionEvent(complete(s), claim); assert.deepEqual({ ...result.state, expedition: undefined }, { ...s, expedition: undefined });
});

test('Signal Line installed bus reads live saved targets and pays before updated exactly once', () => {
  const previous = globalThis.localStorage; let saved; const handlers = new Map();
  globalThis.localStorage = { setItem: (_, v) => { saved = v; }, getItem: () => saved };
  const bus = { on(k, fn) { handlers.set(k, [...(handlers.get(k) || []), fn]); }, off(k, fn) { handlers.set(k, (handlers.get(k) || []).filter(f => f !== fn)); }, emit(k, p) { for (const f of handlers.get(k) || []) f(p); } };
  const game = { state: createInitialState(), bus }, ui = createStoryUI(); game.state.story = ready();
  game.state.flags.endingShown = true; game.state.flags.finaleShown = true;
  const cleanup = installStory(game); const checkpoint = () => { const before = structuredClone(game.state); saveGame(game.state); game.state = loadGame(); assert.deepEqual(game.state.story, before.story); };
  try {
    ui.actions.storyExpedition(game, click(id)); checkpoint();
    for (const [n, enemyId] of ids.entries()) { bus.emit('combat:victory', { enemyId }); checkpoint(); assert.equal(activeExpedition(game.state.story).progress, n + 1); }
    assert.equal(game.state.gold, 20); let payments = 0;
    bus.on('story:updated', result => { if (result.rewards.length) { payments++; assert.equal(game.state.gold, 140); assert.equal(game.state.story.expedition.active, null); } });
    game.state.location = 'storms_eye'; ui.actions.storyExpedition(game, click('claim')); assert.equal(game.state.gold, 20);
    game.state.location = 'greyhaven'; ui.actions.storyTalk(game, click('mara')); assert.equal(game.state.gold, 20);
    ui.actions.storyExpedition(game, click('claim')); checkpoint(); ui.actions.storyExpedition(game, click('claim'));
    assert.equal(payments, 1); assert.equal(game.state.gold, 140); assert.equal(game.state.flags.endingShown, true); assert.equal(game.state.flags.finaleShown, true);
  } finally { cleanup(); if (previous === undefined) delete globalThis.localStorage; else globalThis.localStorage = previous; }
});
