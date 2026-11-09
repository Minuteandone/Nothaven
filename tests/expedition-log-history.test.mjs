import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../src/state.js';
import { exploreScene } from '../src/map/exploreScene.js';
import { ensureMapState, getAvailableActions, getVisitedZones, getZone } from '../src/map/mapState.js';
import { renderExploration } from '../src/ui/exploration.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function renderLog(log, expeditionLogExpanded = false) {
  const state = createInitialState();
  state.scene = 'explore';
  const mapState = ensureMapState(state);
  mapState.log = log;
  const before = structuredClone(state);
  const html = renderExploration({
    state,
    zone: getZone(mapState.zoneId),
    mapState,
    nearbyActions: getAvailableActions(state),
    visitedZones: getVisitedZones(state),
    expeditionLogExpanded,
  });
  assert.deepEqual(state, before, 'rendering must not mutate journey state');
  return html;
}

function sceneGame(log) {
  const state = createInitialState();
  state.scene = 'explore';
  ensureMapState(state).log = log;
  return {
    state,
    scenes: {},
    bus: { emit() {} },
    root: { ownerDocument: null },
    storyDialogue: null,
  };
}

test('expedition log reveals retained older entries only on request', () => {
  const log = Array.from({ length: 9 }, (_, i) => `Entry ${i + 1}`);
  const recent = renderLog(log);
  assert.match(recent, /data-action="toggleExpeditionLog" aria-expanded="false" aria-controls="expedition-log-entries"/);
  assert.match(recent, /Show earlier entries \(3\)/);
  assert.match(recent, /Showing 6 recent entries/);
  assert.ok(recent.includes('<p>Entry 9</p>'));
  assert.ok(recent.includes('<p>Entry 4</p>'));
  assert.ok(!recent.includes('<p>Entry 3</p>'));

  const full = renderLog(log, true);
  assert.match(full, /data-action="toggleExpeditionLog" aria-expanded="true" aria-controls="expedition-log-entries"/);
  assert.match(full, /Show recent entries only/);
  assert.match(full, /Showing 9 recent entries/);
  for (let i = 1; i <= 9; i += 1) assert.ok(full.includes(`<p>Entry ${i}</p>`), `missing Entry ${i}`);
  assertEggFree(full, 'expanded expedition log');
});

test('expanded history remains bounded to the map retention limit', () => {
  const log = Array.from({ length: 25 }, (_, i) => `Retained entry ${i + 1}`);
  const html = renderLog(log, true);
  assert.match(html, /Showing 20 recent entries/);
  assert.ok(html.includes('<p>Retained entry 25</p>'));
  assert.ok(html.includes('<p>Retained entry 6</p>'));
  assert.ok(!html.includes('<p>Retained entry 5</p>'));
  assert.equal((html.match(/<p>Retained entry /g) || []).length, 20);
});

test('collapsed repeats do not create a misleading earlier-entry control', () => {
  const log = ['Alpha', 'Alpha', 'Bravo', 'Bravo', 'Charlie', 'Delta', 'Echo', 'Foxtrot'];
  const html = renderLog(log, true);
  assert.doesNotMatch(html, /toggleExpeditionLog|Show earlier entries|Show recent entries only/);
  assert.match(html, /Showing 6 recent entries \(2 repeats collapsed\)/);
  assert.ok(html.includes('<p>Alpha (×2)</p>'));
  assert.ok(html.includes('<p>Bravo (×2)</p>'));
  const sevenGroups = renderLog(['Repeat', 'Repeat', '2', '3', '4', '5', '6', '7']);
  assert.match(sevenGroups, /Show earlier entries \(1\)/);
  assert.ok(!sevenGroups.includes('<p>Repeat (×2)</p>'));
  assert.ok(sevenGroups.includes('<p>2</p>'));
  const expandedGroups = renderLog(['Repeat', 'Repeat', '2', '3', '4', '5', '6', '7'], true);
  assert.ok(expandedGroups.includes('<p>Repeat (×2)</p>'));
  assert.ok(expandedGroups.includes('<p>2</p>'));
  assert.match(expandedGroups, /Showing 7 recent entries \(1 repeat collapsed\)/);
});

test('scene toggle is transient, state-preserving, and guarded outside active exploration', () => {
  const game = sceneGame(Array.from({ length: 8 }, (_, i) => `Scene entry ${i + 1}`));
  exploreScene.onEnter(game);
  assert.equal(game.expeditionLogExpanded, false);
  assert.match(exploreScene.render(game), /Show earlier entries \(2\)/);

  const before = structuredClone(game.state);
  exploreScene.actions.toggleExpeditionLog(game);
  assert.equal(game.expeditionLogExpanded, true);
  assert.deepEqual(game.state, before, 'toggle must not change journey state');
  const expanded = exploreScene.render(game);
  assert.match(expanded, /aria-expanded="true"/);
  assert.ok(expanded.includes('<p>Scene entry 1</p>'));

  game.state.scene = 'town';
  const townBefore = structuredClone(game.state);
  exploreScene.actions.toggleExpeditionLog(game);
  assert.equal(game.expeditionLogExpanded, true, 'stale town action must be ignored');
  assert.deepEqual(game.state, townBefore, 'town guard must not change journey state');
  game.state.scene = 'explore'; game.state.combat = { active: true };
  const combatBefore = structuredClone(game.state);
  exploreScene.actions.toggleExpeditionLog(game);
  assert.equal(game.expeditionLogExpanded, true, 'combat-stale action must be ignored');
  assert.deepEqual(game.state, combatBefore, 'combat guard must not change journey state');

  game.state.combat = null;
  exploreScene.onEnter(game);
  assert.equal(game.expeditionLogExpanded, false, 're-entering exploration restores the recent view');
});

test('older hostile log text stays escaped and both guides document the control', () => {
  const hostile = '<img src=x onerror=alert(1)>';
  const recent = renderLog([hostile, '2', '3', '4', '5', '6', '7', '8']);
  assert.ok(!recent.includes(escapeHTML(hostile)), 'collapsed view must not expose the older entry');
  const full = renderLog([hostile, '2', '3', '4', '5', '6', '7', '8'], true);
  assert.ok(full.includes(`<p>${escapeHTML(hostile)}</p>`));
  assert.ok(!full.includes(hostile));

  const sentence = 'The Expedition log groups consecutive repeats and shows six recent entries. When older entries are retained, Show earlier entries reveals them; Show recent entries only restores the shorter view. This viewing choice is not saved and never spends a turn.';
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(sentence).length - 1, 1);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(sentence)));
  assertEggFree(sentence, 'expedition log history guide');
});
