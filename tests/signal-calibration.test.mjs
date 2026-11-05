import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveGame, loadGame } from '../src/state.js';
import { applyStoryEvent, getJournal, getDialogue } from '../src/story/index.js';
import { applyCalibrationEvent, CALIBRATION_GOLD, calibrationAvailable, calibrationReady, getCalibrationJournal } from '../src/story/calibration.js';
import { createStoryUI } from '../src/story/view.js';
import { installStory, dispatchStoryEvent } from '../src/story/integration.js';
import { installEnding } from '../src/scenes/ending.js';
import { ZONES, travelToZone, interactWith, isWalkable } from '../src/map/index.js';

const accept = { type: 'calibration-accept' }, report = { type: 'calibration-report' };
const ids = ['eye_reference_gauge', 'survey_records_b', 'relay_junction'];
const flags = ['calibration_reference', 'calibration_spire', 'calibration_relay'];
const facts = ids.map(interactionId => ({ type: 'interact', interactionId }));
const advance = (s, e) => applyStoryEvent(s, e).state;
const click = arg => ({ dataset: { arg } });
function ready(ending = 'protect_town', relay = 'shelter_network') {
  const state = createInitialState();
  state.story = { version: 1, stage: 'complete', ending, flags: {
    road_reward: true, lens_reward: true, chapter_reward: true, relief_reward: true,
    rescue_reward: true, relay_choice: relay, relay_reward: true, spire_reward: true,
    heart_accepted: true, heart_visit: true, eye_anchor_west: true, eye_anchor_east: true,
    victory_storm_heart: true, heart_reward: true, watch_reward: true,
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

test('Signal Calibration requires a strictly paid Long Watch, never the Last Squall', () => {
  for (const value of [undefined, false, 'true', 1, {}, []]) {
    const s = ready().story; s.flags.watch_reward = value;
    assert.equal(calibrationAvailable(s), false); assert.deepEqual(getCalibrationJournal(s), []);
    for (const e of [accept, ...facts, report]) assert.deepEqual(applyCalibrationEvent(freeze(s), e).state, s);
  }
  for (const s of [undefined, null, {}, { stage: 'complete' }, { ...ready().story, stage: 'road' }]) {
    assert.equal(calibrationAvailable(s), false); assert.equal(calibrationReady(s), false);
  }
  for (const value of [undefined, false, true]) {
    const s = ready().story; s.flags.victory_last_squall = value;
    assert.equal(calibrationAvailable(s), true);
    assert.equal(advance(s, accept).flags.calibration_accepted, true);
  }
});

test('fresh readings only: early inspections and map history do not count; repeat acceptance retains progress', () => {
  let s = ready().story;
  for (const e of facts) assert.deepEqual(applyCalibrationEvent(freeze(s), e), { state: s, rewards: [], log: [] });
  s = advance(s, { ...accept, previouslyInspected: true, completedInteractions: Object.fromEntries(ids.map(id => [id, true])) });
  for (const flag of flags) assert.equal(s.flags[flag], undefined);
  s = advance(s, facts[0]); assert.equal(s.flags.calibration_reference, true);
  assert.deepEqual(applyCalibrationEvent(freeze(s), accept), { state: s, rewards: [], log: [] });
  assert.deepEqual(applyCalibrationEvent(s, facts[0]), { state: s, rewards: [], log: [] });
  for (const id of ['constructor', '__proto__', 'toString', 'observatory_lens_pedestal', 'saltmere_coast', 'calibration_reference']) {
    assert.deepEqual(applyCalibrationEvent(s, { type: 'interact', interactionId: id }).state, s);
  }
  for (const e of [null, undefined, 'calibration-report', { type: 'constructor' }, { type: '__proto__' }, { type: 'victory', encounterId: ids[1] }, { type: 'visit', locationId: ids[2] }]) {
    assert.deepEqual(applyCalibrationEvent(s, e), { state: s, rewards: [], log: [] });
  }
});

for (const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]) {
  test(`ordered fresh readings reject premature stages in permutation ${order.join('-')}; explicit 220g once`, () => {
    let s = advance(ready().story, accept), next = 0;
    for (const i of order) {
      const before = structuredClone(s), result = applyCalibrationEvent(freeze(s), facts[i]);
      if (i === next) { next++; assert.equal(result.state.flags[flags[i]], true); }
      else assert.deepEqual(result, { state: before, rewards: [], log: [] });
      s = result.state;
      assert.equal(flags.filter(flag => s.flags[flag] === true).length, next);
      if (next < 3) assert.deepEqual(applyCalibrationEvent(s, report).rewards, []);
    }
    for (; next < 3; next++) {
      assert.equal(calibrationReady(s), false);
      s = advance(s, facts[next]);
    }
    assert.equal(calibrationReady(s), true);
    const before = structuredClone(s), paid = applyCalibrationEvent(freeze(s), report);
    assert.deepEqual(s, before);
    assert.deepEqual(paid.rewards, [{ id: 'calibration_reward', gold: CALIBRATION_GOLD }]);
    assert.equal(CALIBRATION_GOLD, 220);
    assert.equal(s.flags.calibration_reward, undefined); assert.equal(paid.state.flags.calibration_reward, true);
    for (const e of [accept, ...facts, report]) assert.deepEqual(applyCalibrationEvent(freeze(paid.state), e), { state: paid.state, rewards: [], log: [] });
  });
}

test('malformed accepted/readings are not truthy completion shortcuts', () => {
  const full = [accept, ...facts].reduce(advance, ready().story);
  for (const flag of ['calibration_accepted', ...flags]) for (const value of [undefined, false, 'true', 1, {}, []]) {
    const s = { ...full, flags: { ...full.flags, [flag]: value } };
    assert.equal(calibrationReady(s), false); assert.deepEqual(applyCalibrationEvent(s, report).rewards, []);
  }
});

for (const ending of ['protect_town', 'share_signal']) for (const relay of ['shelter_network', 'route_network']) {
  test(`survey preserves ${ending}/${relay} and existing progression`, () => {
    const before = freeze(ready(ending, relay).story);
    const paid = [accept, ...facts, report].reduce(advance, before);
    assert.equal(paid.stage, before.stage); assert.equal(paid.ending, ending);
    assert.deepEqual(paid.expedition, before.expedition);
    for (const [key, value] of Object.entries(before.flags)) assert.equal(paid.flags[key], value);
    assert.equal(paid.flags.victory_last_squall, undefined);
    assert.equal(getJournal(paid).find(q => q.id === 'signal_calibration').status, 'complete');
  });
}

test('journal and dialogue are read-only, give precise remaining routes, and use strict paid aftermath', () => {
  let s = freeze(ready().story);
  assert.match(getCalibrationJournal(s)[0].objective, /after reporting The Long Watch.*fresh reference.*Earlier inspections do not count/);
  s = advance(s, accept);
  for (const [i, e] of facts.entries()) {
    const before = structuredClone(s), journal = getCalibrationJournal(freeze(s));
    assert.match(journal[0].objective, new RegExp(['Eye Reference Gauge.*3,5', 'Eastern Barometer Logbook.*7,3', 'Relay Capacitor Junction.*3,1'][i]));
    getJournal(s); for (const npc of ['mara', 'iven', 'tamsin', 'ona', 'rusk']) getDialogue(s, npc);
    assert.deepEqual(s, before);
    s = advance(s, e);
  }
  assert.match(getCalibrationJournal(s)[0].objective, /explicitly report.*220 gold.*Conversation alone/);
  assert.match(getDialogue(s, 'iven').text, /stays installed at the beacon/);
  assert.equal(getDialogue(s, '__proto__'), null);
  for (const npc of ['mara', 'iven', 'tamsin']) {
    const result = applyStoryEvent(s, { type: 'talk', npcId: npc });
    assert.equal(result.state.flags.calibration_reward, undefined); assert.deepEqual(result.rewards, []);
  }
  for (const value of ['true', 1, false]) {
    const malformed = { ...s, flags: { ...s.flags, calibration_reward: value } };
    assert.equal(getCalibrationJournal(malformed)[0].status, 'active');
    assert.equal(calibrationReady(malformed), true);
  }
  s = advance(s, report);
  assert.match(getCalibrationJournal(s)[0].objective, /Ordinary weather and road threats remain/);
  assert.match(getDialogue(s, 'tamsin').text, /does not clear a road/);
});

test('survey controls use the authoritative location and reject invalid/stale actions before clearing dialogue', () => {
  const game = { state: ready(), storyDialogue: { text: 'keep this' } };
  game.state.map = { zoneId: 'saltmere_coast' };
  const ui = createStoryUI(g => g.state.map.zoneId);
  const unchanged = fn => { const before = structuredClone(game); fn(); assert.deepEqual(game, before); };
  for (const arg of ['accept', 'report', 'constructor']) unchanged(() => ui.actions.storyCalibration(game, click(arg)));
  assert.doesNotMatch(ui.render(game), /data-action="storyCalibration"/);
  game.state.map.zoneId = 'greyhaven'; game.state.location = 'saltmere_coast';
  for (const arg of ['constructor', '__proto__', null, 'report']) unchanged(() => ui.actions.storyCalibration(game, click(arg)));
  assert.match(ui.render(game), /data-action="storyCalibration" data-arg="accept"/);
  game.state.combat = {}; unchanged(() => ui.actions.storyCalibration(game, click('accept'))); delete game.state.combat;
  game.state.story.flags.watch_reward = false; unchanged(() => ui.actions.storyCalibration(game, click('accept'))); game.state.story.flags.watch_reward = true;
  ui.actions.storyCalibration(game, click('accept')); assert.equal(game.storyDialogue, null);
  game.storyDialogue = { text: 'keep this' };
  unchanged(() => ui.actions.storyCalibration(game, click('accept')));
  unchanged(() => ui.actions.storyCalibration(game, click('report')));
  assert.doesNotMatch(ui.render(game), /data-action="storyCalibration" data-arg="report"/);
  facts.forEach(e => dispatchStoryEvent(game, e));
  assert.match(ui.render(game), /data-action="storyCalibration" data-arg="report"/);
  game.state.combat = {}; unchanged(() => ui.actions.storyCalibration(game, click('report'))); delete game.state.combat;
  game.state.map.zoneId = 'highwatch_pass'; unchanged(() => ui.actions.storyCalibration(game, click('report')));
  game.state.map.zoneId = 'greyhaven'; ui.actions.storyCalibration(game, click('report'));
  assert.equal(game.state.gold, 240); assert.equal(game.storyDialogue, null);
  game.storyDialogue = { text: 'keep this' };
  for (const arg of ['accept', 'report']) unchanged(() => ui.actions.storyCalibration(game, click(arg)));
  assert.doesNotMatch(ui.render(game), /data-action="storyCalibration"/);
  assert.match(ui.render(game), /Signal Calibration.*complete/s);
});

test('real bus and save/load retain partial readings and pay before notification without either finale', () => {
  const oldStorage = globalThis.localStorage; let saved;
  globalThis.localStorage = { setItem: (_, value) => { saved = value; }, getItem: () => saved };
  try {
    const scenes = [], paid = [], game = { state: ready(), bus: bus(), setScene(name) { scenes.push(name); } };
    const cleanup = installStory(game), cleanupEnding = installEnding(game);
    const before = structuredClone(game.state);
    const checkpoint = () => { saveGame(game.state); game.state = loadGame(); };
    game.bus.on('story:updated', p => {
      assert.equal(p.state, game.state.story);
      if (p.rewards.length) { paid.push(...p.rewards); assert.equal(game.state.gold, 240); }
    });
    checkpoint(); game.bus.emit('story:event', accept); checkpoint();
    for (const e of facts) { game.bus.emit('story:event', e); checkpoint(); }
    createStoryUI().actions.storyTalk(game, click('mara')); assert.equal(game.state.gold, 20);
    createStoryUI().actions.storyCalibration(game, click('report')); checkpoint();
    game.bus.emit('story:event', report); checkpoint();
    assert.deepEqual(paid, [{ id: 'calibration_reward', gold: 220 }]); assert.deepEqual(scenes, []);
    assert.deepEqual(game.state.flags, before.flags); assert.deepEqual(game.state.party, before.party);
    assert.deepEqual(game.state.inventory, before.inventory); assert.equal(game.state.story.ending, before.story.ending);
    cleanup(); cleanupEnding(); const after = structuredClone(game.state);
    game.bus.emit('story:event', accept); assert.deepEqual(game.state, after);
  } finally { if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; }
});

test('Eye gauge is unique, repeatable, walkable and proximity guarded; old landmarks keep their semantics', () => {
  const state = ready(); travelToZone(state, 'storms_eye');
  const zone = ZONES.storms_eye, gauge = zone.interactables.find(i => i.id === ids[0]);
  assert.deepEqual([gauge.x, gauge.y, gauge.kind, gauge.once], [3, 5, 'quest', false]);
  assert.equal(gauge.requiresEncounterCleared, undefined);
  assert.equal(isWalkable(zone, state.map, gauge.x, gauge.y), true);
  assert.ok(![...zone.interactables.filter(i => i !== gauge), ...zone.npcs, ...zone.exits, ...zone.encounters].some(i => i.x === gauge.x && i.y === gauge.y));
  assert.deepEqual(interactWith(state, 'interact', gauge.id).events, []);
  state.map.x = 2; state.map.y = 5;
  for (let i = 0; i < 2; i++) {
    const result = interactWith(state, 'interact', gauge.id);
    assert.deepEqual(result.events, [facts[0]]);
    assert.equal(state.map.completedInteractions[gauge.id], undefined);
  }
  for (const id of ['eye_anchor_west', 'eye_anchor_east']) {
    const anchor = zone.interactables.find(i => i.id === id);
    assert.equal(anchor.once, true); assert.ok(anchor.requiresEncounterCleared);
  }
  for (const [zoneId, id] of [['stormcrown_spire', ids[1]], ['sunscar_relay', ids[2]]]) {
    const landmark = ZONES[zoneId].interactables.find(i => i.id === id);
    assert.equal(landmark.once, false);
  }
});
