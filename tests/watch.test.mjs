import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveGame, loadGame } from '../src/state.js';
import { applyStoryEvent, getJournal, getDialogue } from '../src/story/index.js';
import { applyWatchEvent, WATCH_GOLD, watchAvailable, watchReady, getWatchJournal } from '../src/story/watch.js';
import { createStoryUI } from '../src/story/view.js';
import { installStory, dispatchStoryEvent } from '../src/story/integration.js';
import { installEnding } from '../src/scenes/ending.js';
import { ZONES, travelToZone, interactWith, isWalkable } from '../src/map/index.js';

const accept = { type: 'watch-accept' }, report = { type: 'watch-report' };
const ids = ['saltmere_harbor_lamp', 'highwatch_cairn', 'observatory_forecast_stand'];
const flags = ['watch_coast', 'watch_heights', 'watch_observatory'];
const facts = ids.map(interactionId => ({ type: 'interact', interactionId }));
const advance = (s, e) => applyStoryEvent(s, e).state;
const click = arg => ({ dataset: { arg } });
function ready(ending = 'protect_town', relay = 'shelter_network') {
  const state = createInitialState();
  state.story = { version: 1, stage: 'complete', ending, flags: {
    road_reward: true, lens_reward: true, chapter_reward: true, relief_reward: true,
    rescue_reward: true, relay_choice: relay, relay_reward: true, spire_reward: true,
    heart_accepted: true, heart_visit: true, eye_anchor_west: true, eye_anchor_east: true,
    victory_storm_heart: true, heart_reward: true,
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

test('Long Watch requires a strictly paid Heart, never the Last Squall', () => {
  for (const value of [undefined, false, 'true', 1, {}, []]) {
    const s = ready().story; s.flags.heart_reward = value;
    assert.equal(watchAvailable(s), false); assert.deepEqual(getWatchJournal(s), []);
    for (const e of [accept, ...facts, report]) assert.deepEqual(applyWatchEvent(freeze(s), e).state, s);
  }
  for (const s of [undefined, null, {}, { stage: 'complete' }, { ...ready().story, stage: 'road' }]) {
    assert.equal(watchAvailable(s), false); assert.equal(watchReady(s), false);
  }
  for (const value of [undefined, false, true]) {
    const s = ready().story; s.flags.victory_last_squall = value;
    assert.equal(watchAvailable(s), true);
    assert.equal(advance(s, accept).flags.watch_accepted, true);
  }
});

test('fresh readings only: early inspections and map history do not count; repeat acceptance retains progress', () => {
  let s = ready().story;
  for (const e of facts) assert.deepEqual(applyWatchEvent(freeze(s), e), { state: s, rewards: [], log: [] });
  s = advance(s, { ...accept, previouslyInspected: true, completedInteractions: Object.fromEntries(ids.map(id => [id, true])) });
  for (const flag of flags) assert.equal(s.flags[flag], undefined);
  s = advance(s, facts[0]); assert.equal(s.flags.watch_coast, true);
  assert.deepEqual(applyWatchEvent(freeze(s), accept), { state: s, rewards: [], log: [] });
  assert.deepEqual(applyWatchEvent(s, facts[0]), { state: s, rewards: [], log: [] });
  for (const id of ['constructor', '__proto__', 'toString', 'observatory_lens_pedestal', 'saltmere_coast', 'watch_coast']) {
    assert.deepEqual(applyWatchEvent(s, { type: 'interact', interactionId: id }).state, s);
  }
  for (const e of [null, undefined, 'watch-report', { type: 'constructor' }, { type: '__proto__' }, { type: 'victory', encounterId: ids[1] }, { type: 'visit', locationId: ids[2] }]) {
    assert.deepEqual(applyWatchEvent(s, e), { state: s, rewards: [], log: [] });
  }
});

for (const order of [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]]) {
  test(`all three fresh readings required in order ${order.join('-')}; one explicit 180g report`, () => {
    let s = advance(ready().story, accept);
    for (const [n, i] of order.entries()) {
      assert.equal(watchReady(s), false); assert.deepEqual(applyWatchEvent(s, report).rewards, []);
      s = advance(s, facts[i]);
      assert.equal(flags.filter(flag => s.flags[flag] === true).length, n + 1);
    }
    assert.equal(watchReady(s), true);
    const paid = applyWatchEvent(freeze(s), report);
    assert.deepEqual(paid.rewards, [{ id: 'watch_reward', gold: WATCH_GOLD }]);
    assert.equal(s.flags.watch_reward, undefined); assert.equal(paid.state.flags.watch_reward, true);
    for (const e of [accept, ...facts, report]) assert.deepEqual(applyWatchEvent(freeze(paid.state), e), { state: paid.state, rewards: [], log: [] });
  });
}

test('malformed accepted/readings are not truthy completion shortcuts', () => {
  const full = [accept, ...facts].reduce(advance, ready().story);
  for (const flag of ['watch_accepted', ...flags]) for (const value of [undefined, false, 'true', 1, {}, []]) {
    const s = { ...full, flags: { ...full.flags, [flag]: value } };
    assert.equal(watchReady(s), false); assert.deepEqual(applyWatchEvent(s, report).rewards, []);
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
    assert.equal(getJournal(paid).find(q => q.id === 'long_watch').status, 'complete');
  });
}

test('journal and dialogue are read-only, give precise remaining routes, and use strict paid aftermath', () => {
  let s = freeze(ready().story);
  assert.match(getWatchJournal(s)[0].objective, /separate from the Last Squall.*fresh readings.*old inspections do not count/);
  s = advance(s, accept);
  for (const [i, e] of facts.entries()) {
    const before = structuredClone(s), journal = getWatchJournal(freeze(s));
    assert.match(journal[0].objective, new RegExp(['Saltmere Harbor Lamp', 'Highwatch Signal Cairn', 'Observatory Forecast Stand'][i]));
    getJournal(s); for (const npc of ['mara', 'iven', 'tamsin', 'ona', 'rusk']) getDialogue(s, npc);
    assert.deepEqual(s, before);
    s = advance(s, e);
  }
  assert.match(getWatchJournal(s)[0].objective, /explicitly report.*180 gold.*Conversation alone/);
  assert.match(getDialogue(s, 'iven').text, /without the recovered lens/);
  assert.equal(getDialogue(s, '__proto__'), null);
  for (const npc of ['mara', 'iven', 'tamsin']) {
    const result = applyStoryEvent(s, { type: 'talk', npcId: npc });
    assert.equal(result.state.flags.watch_reward, undefined); assert.deepEqual(result.rewards, []);
  }
  for (const value of ['true', 1, false]) {
    const malformed = { ...s, flags: { ...s.flags, watch_reward: value } };
    assert.equal(getWatchJournal(malformed)[0].status, 'active');
    assert.doesNotMatch(getDialogue(malformed, 'ona').text, /same timetable/);
  }
  s = advance(s, report);
  assert.match(getWatchJournal(s)[0].objective, /ordinary storms and road threats remain/);
  assert.match(getDialogue(s, 'ona').text, /same timetable/);
  assert.match(getDialogue(s, 'rusk').text, /do not replace sentries/);
});

test('survey controls use the authoritative location and reject invalid/stale actions before clearing dialogue', () => {
  const game = { state: ready(), storyDialogue: { text: 'keep this' } };
  game.state.map = { zoneId: 'saltmere_coast' };
  const ui = createStoryUI(g => g.state.map.zoneId);
  const unchanged = fn => { const before = structuredClone(game); fn(); assert.deepEqual(game, before); };
  for (const arg of ['accept', 'report', 'constructor']) unchanged(() => ui.actions.storyWatch(game, click(arg)));
  assert.doesNotMatch(ui.render(game), /data-action="storyWatch"/);
  game.state.map.zoneId = 'greyhaven'; game.state.location = 'saltmere_coast';
  for (const arg of ['constructor', '__proto__', null, 'report']) unchanged(() => ui.actions.storyWatch(game, click(arg)));
  assert.match(ui.render(game), /data-action="storyWatch" data-arg="accept"/);
  ui.actions.storyWatch(game, click('accept')); assert.equal(game.storyDialogue, null);
  game.storyDialogue = { text: 'keep this' };
  unchanged(() => ui.actions.storyWatch(game, click('accept')));
  unchanged(() => ui.actions.storyWatch(game, click('report')));
  assert.doesNotMatch(ui.render(game), /data-action="storyWatch" data-arg="report"/);
  facts.forEach(e => dispatchStoryEvent(game, e));
  assert.match(ui.render(game), /data-action="storyWatch" data-arg="report"/);
  game.state.map.zoneId = 'highwatch_pass'; unchanged(() => ui.actions.storyWatch(game, click('report')));
  game.state.map.zoneId = 'greyhaven'; ui.actions.storyWatch(game, click('report'));
  assert.equal(game.state.gold, 200); assert.equal(game.storyDialogue, null);
  game.storyDialogue = { text: 'keep this' };
  for (const arg of ['accept', 'report']) unchanged(() => ui.actions.storyWatch(game, click(arg)));
  assert.doesNotMatch(ui.render(game), /data-action="storyWatch"/);
  assert.match(ui.render(game), /The Long Watch.*complete/s);
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
      if (p.rewards.length) { paid.push(...p.rewards); assert.equal(game.state.gold, 200); }
    });
    checkpoint(); game.bus.emit('story:event', accept); checkpoint();
    for (const e of facts) { game.bus.emit('story:event', e); checkpoint(); }
    createStoryUI().actions.storyTalk(game, click('mara')); assert.equal(game.state.gold, 20);
    createStoryUI().actions.storyWatch(game, click('report')); checkpoint();
    game.bus.emit('story:event', report); checkpoint();
    assert.deepEqual(paid, [{ id: 'watch_reward', gold: 180 }]); assert.deepEqual(scenes, []);
    assert.deepEqual(game.state.flags, before.flags); assert.deepEqual(game.state.party, before.party);
    assert.deepEqual(game.state.inventory, before.inventory); assert.equal(game.state.story.ending, before.story.ending);
    cleanup(); cleanupEnding(); const after = structuredClone(game.state);
    game.bus.emit('story:event', accept); assert.deepEqual(game.state, after);
  } finally { if (oldStorage === undefined) delete globalThis.localStorage; else globalThis.localStorage = oldStorage; }
});

test('forecast stand is repeatable, separate, walkable, proximity/guardian guarded; pedestal stays once-only', () => {
  const state = ready(); travelToZone(state, 'observatory_ruins');
  const zone = ZONES.observatory_ruins, stand = zone.interactables.find(i => i.id === ids[2]);
  const pedestal = zone.interactables.find(i => i.id === 'observatory_lens_pedestal');
  assert.deepEqual([stand.x, stand.y, stand.kind, stand.once], [3, 1, 'lore', false]);
  assert.equal(stand.requiresEncounterCleared, 'observatory_sentinel');
  assert.equal(isWalkable(zone, state.map, stand.x, stand.y), true);
  assert.ok(![...zone.interactables.filter(i => i !== stand), ...zone.npcs, ...zone.exits, ...zone.encounters].some(i => i.x === stand.x && i.y === stand.y));
  assert.deepEqual([pedestal.x, pedestal.y, pedestal.once], [4, 1, true]);
  assert.deepEqual(interactWith(state, 'interact', stand.id).events, []);
  state.map.x = 3; state.map.y = 2;
  assert.deepEqual(interactWith(state, 'interact', stand.id).events, []);
  state.map.clearedEncounters.observatory_sentinel = true;
  for (let i = 0; i < 2; i++) {
    const result = interactWith(state, 'interact', stand.id);
    assert.deepEqual(result.events, [facts[2]]); assert.match(result.log.join(' '), /empty lens mounting/);
    assert.equal(state.map.completedInteractions[stand.id], undefined);
  }
  state.map.x = 4; state.map.y = 1;
  assert.equal(interactWith(state, 'interact', pedestal.id).events.length, 1);
  assert.equal(state.map.completedInteractions[pedestal.id], true);
  assert.deepEqual(interactWith(state, 'interact', pedestal.id).events, []);
  assert.deepEqual(interactWith(state, 'interact', stand.id).events, [facts[2]]);
  for (const [zoneId, id] of [['saltmere_coast', ids[0]], ['highwatch_pass', ids[1]]]) {
    const landmark = ZONES[zoneId].interactables.find(i => i.id === id);
    assert.equal(landmark.once, false); assert.equal(landmark.kind, 'lore');
  }
});
