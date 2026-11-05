import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../src/state.js';
import { ensureMapState, getAvailableActions, getVisitedZones, getZone } from '../src/map/mapState.js';
import { renderExploration } from '../src/ui/exploration.js';
import { explorationShortcutTarget, installExplorationControls } from '../src/ui/explorationControls.js';

function renderAt({ x = 2, y = 3, nearbyActions, zoneId = 'greyhaven', characterShortcuts = true } = {}) {
  const state = createInitialState();
  const mapState = ensureMapState(state);
  mapState.zoneId = zoneId;
  mapState.x = x;
  mapState.y = y;
  const before = JSON.stringify(mapState);
  const html = renderExploration({
    state,
    characterShortcuts,
    zone: getZone(zoneId),
    mapState,
    nearbyActions: nearbyActions ?? getAvailableActions(state),
    visitedZones: getVisitedZones(state),
  });
  assert.equal(JSON.stringify(mapState), before, 'rendering must not mutate exploration state');
  return html;
}

function fakeButton(action, { nearby = false, disabled = false, ariaDisabled = null } = {}) {
  return {
    dataset: { action }, disabled, clicks: 0,
    classList: { contains: name => nearby && name === 'nearby-action' },
    click() { this.clicks += 1; },
    hasAttribute(name) { return name === 'disabled' && disabled; },
    getAttribute(name) {
      if (name === 'data-action') return action;
      if (name === 'aria-disabled') return ariaDisabled;
      return null;
    },
  };
}

function fakeRoot(buttons, { displayOpen = false } = {}) {
  return {
    ownerDocument: { querySelector: selector => displayOpen && selector === '.display-settings:not([hidden])' ? {} : null },
    querySelectorAll: selector => selector === 'button[data-action]' ? buttons : [],
  };
}

function key(code, overrides = {}) {
  return { code, target: { tagName: 'DIV' }, preventDefault() { this.prevented = true; }, ...overrides };
}

test('terrain compass mirrors actual adjacent tiles, passability, coordinates, and map edges without mutation', () => {
  const html = renderAt({ x: 5, y: 3 });
  assert.match(html, /<section class="terrain-compass" aria-labelledby="terrain-compass-title">/);
  assert.match(html, /Standing on <strong>Cobble \/ Trail<\/strong> at 5, 3/);
  assert.match(html, /aria-label="Adjacent terrain and passability"/);
  assert.equal((html.match(/data-direction="/g) || []).length, 4);
  assert.match(html, /data-direction="south" data-passable="false"[\s\S]*?<strong>Stone Wall \/ Cliff<\/strong><small>5, 4 · Blocked<\/small>/);
  assert.match(html, /data-direction="north" data-passable="true"[\s\S]*?<small>5, 2 · Passable<\/small>/);
  assert.match(html, /role="grid" aria-label="Greyhaven map"/);
  assert.match(html, /aria-label="Wren, your position, column 6, row 4" aria-current="location"/);

  const edge = renderAt({ x: 0, y: 0 });
  assert.match(edge, /data-direction="north" data-passable="false"[\s\S]*?<strong>Map edge<\/strong><small>0, -1 · Blocked<\/small>/);
  assert.match(edge, /data-direction="west" data-passable="false"[\s\S]*?<strong>Map edge<\/strong><small>-1, 0 · Blocked<\/small>/);
});

test('movement buttons expose accurate key metadata and the explorer guide preserves ordinary keyboard navigation', () => {
  const html = renderAt();
  for (const [action, shortcuts] of [
    ['moveNorth', 'W ArrowUp'], ['moveWest', 'A ArrowLeft'], ['moveEast', 'D ArrowRight'],
    ['moveSouth', 'S ArrowDown'], ['waitTurn', 'E'],
  ]) {
    assert.ok(html.includes(`data-action="${action}"`), action);
    assert.ok(html.includes(`aria-keyshortcuts="${shortcuts}"`), shortcuts);
  }
  assert.match(html, /aria-label="Survey Area" aria-keyshortcuts="E"[\s\S]*?<kbd aria-hidden="true">E<\/kbd>/);
  assert.match(html, /<details class="shortcut-guide exploration-shortcuts"><summary>Explorer keyboard commands<\/summary>/);
  assert.match(html, /<kbd>WASD<\/kbd>/);
  assert.match(html, /<kbd>1–9<\/kbd>/);
  assert.match(html, /Enter or Space activates/);
  assert.match(html, /typing, using modifier keys, or viewing Display settings/);
});

test('nearby actions retain every action and label while only the first nine visible positions receive hints', () => {
  const kinds = ['talk', 'encounter', 'patrol', 'interact', 'exit'];
  const actions = Array.from({ length: 11 }, (_, index) => ({
    kind: kinds[index % kinds.length], id: `target-${index + 1}`, label: `Action ${index + 1}`,
  }));
  actions[0].id = '\"><script>bad()</script>';
  actions[0].label = '<img src=x onerror=bad()>';
  const html = renderAt({ nearbyActions: [null, { kind: 'unknown', id: 'ignored', label: 'Ignored' }, ...actions] });
  assert.equal((html.match(/class="action-button action-button--[a-z]+ nearby-action"/g) || []).length, 11);
  assert.equal((html.match(/aria-keyshortcuts="[1-9]"/g) || []).length, 9);
  assert.match(html, /data-action="mapTalk" data-arg="&quot;&gt;&lt;script&gt;bad\(\)&lt;\/script&gt;" aria-keyshortcuts="1"/);
  assert.match(html, /aria-keyshortcuts="1"[\s\S]*?<kbd class="key-hint" aria-hidden="true">1<\/kbd>/);
  const ninth = html.split('data-arg="target-9"')[1].split('</button>')[0];
  const tenth = html.split('data-arg="target-10"')[1].split('</button>')[0];
  assert.ok(ninth.includes('aria-keyshortcuts="9"'));
  assert.ok(!tenth.includes('aria-keyshortcuts'));
  assert.ok(!tenth.includes('key-hint'));
  assert.ok(html.includes('&lt;img src=x onerror=bad()&gt;'));
  assert.ok(!html.includes('<script>bad()</script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('Ignored'));
  assert.ok(!html.includes('data-arg="ignored"'));
});

test('shortcut resolution chooses Survey or exact enabled nearby actions and honors every safety guard', () => {
  const survey = fakeButton('waitTurn');
  const first = fakeButton('mapTalk', { nearby: true });
  const second = fakeButton('mapEncounter', { nearby: true });
  const root = fakeRoot([survey, first, second]);
  assert.equal(explorationShortcutTarget(root, key('KeyE')), survey);
  assert.equal(explorationShortcutTarget(root, key('', { key: 'e' })), survey);
  assert.equal(explorationShortcutTarget(root, key('Digit1')), first);
  assert.equal(explorationShortcutTarget(root, key('', { key: '2' })), second);
  assert.equal(explorationShortcutTarget(root, key('Numpad2')), second);
  assert.equal(explorationShortcutTarget(root, key('KeyA')), null);
  for (const modifier of ['altKey', 'ctrlKey', 'metaKey', 'shiftKey', 'repeat', 'defaultPrevented']) {
    assert.equal(explorationShortcutTarget(root, key('KeyE', { [modifier]: true })), null, modifier);
  }
  for (const tagName of ['INPUT', 'TEXTAREA', 'SELECT']) {
    assert.equal(explorationShortcutTarget(root, key('KeyE', { target: { tagName } })), null, tagName);
  }
  assert.equal(explorationShortcutTarget(root, key('KeyE', { target: { tagName: 'DIV', isContentEditable: true } })), null);
  assert.equal(explorationShortcutTarget(root, key('KeyE', { target: { tagName: 'DIV', closest: () => ({}) } })), null);
  assert.equal(explorationShortcutTarget(fakeRoot([survey], { displayOpen: true }), key('KeyE')), null);
  assert.equal(explorationShortcutTarget(fakeRoot([fakeButton('waitTurn', { disabled: true })]), key('KeyE')), null);
  assert.equal(explorationShortcutTarget(fakeRoot([fakeButton('waitTurn', { ariaDisabled: 'true' })]), key('KeyE')), null);
});

test('numbered nearby actions follow visible positions and disabled choices never shift activation', () => {
  const survey = fakeButton('waitTurn');
  const first = fakeButton('mapTalk', { nearby: true, disabled: true });
  const second = fakeButton('mapEncounter', { nearby: true });
  const third = fakeButton('mapInteract', { nearby: true });
  const fastTravel = fakeButton('mapTravel');
  const root = fakeRoot([survey, first, fastTravel, second, third]);
  assert.equal(explorationShortcutTarget(root, key('Digit1')), null);
  assert.equal(explorationShortcutTarget(root, key('Digit2')), second);
  assert.equal(explorationShortcutTarget(root, key('Numpad3')), third);
  assert.equal(explorationShortcutTarget(root, key('Digit4')), null);
  assert.equal(explorationShortcutTarget(root, key('Digit0')), null);
});

test('installed listener is exploration-scoped, clicks existing controls, deduplicates, and cleans up', () => {
  const survey = fakeButton('waitTurn');
  const nearby = fakeButton('mapTalk', { nearby: true });
  const root = fakeRoot([survey, nearby]);
  const listeners = new Map();
  const view = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  const game = { root, state: { scene: 'town' } };
  const cleanup = installExplorationControls(game, { window: view, document: root.ownerDocument });
  assert.equal(installExplorationControls(game, { window: view }), cleanup);
  assert.equal(listeners.has('keydown'), true);

  const outside = key('KeyE');
  listeners.get('keydown')(outside);
  assert.equal(survey.clicks, 0);
  assert.equal(outside.prevented, undefined);
  game.state.scene = 'explore';
  const surveyEvent = key('KeyE');
  listeners.get('keydown')(surveyEvent);
  assert.equal(survey.clicks, 1);
  assert.equal(surveyEvent.prevented, true);
  const nearbyEvent = key('Digit1');
  listeners.get('keydown')(nearbyEvent);
  assert.equal(nearby.clicks, 1);
  assert.equal(nearbyEvent.prevented, true);
  const unrelated = key('KeyQ');
  listeners.get('keydown')(unrelated);
  assert.equal(unrelated.prevented, undefined);

  cleanup();
  assert.equal(listeners.has('keydown'), false);
  assert.equal(typeof installExplorationControls(null), 'function');
  assert.equal(typeof installExplorationControls({ root: null, state: {} }), 'function');
});

test('bootstrap installs exploration controls after map registration and before initial title rendering', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const installation = main.indexOf('installExplorationControls(game);');
  const map = main.indexOf('installMap(game);');
  const title = main.indexOf("game.setScene('title');");
  assert.ok(map >= 0 && installation > map && title > installation);
});


test('character opt-out renders arrow-only metadata without letter or nearby-number hints', () => {
  const html = renderAt({ characterShortcuts: false, nearbyActions: [{ kind: 'talk', id: 'mara', label: 'Talk to Warden Mara' }] });
  assert.match(html, /Letter and number shortcuts are off/);
  for (const arrow of ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight']) {
    assert.ok(html.includes(`aria-keyshortcuts="${arrow}"`));
  }
  assert.ok(!/aria-keyshortcuts="[WASDE1-9](?: |")/.test(html));
  assert.ok(!html.includes('class="key-hint"'));
  assert.ok(!html.includes('<kbd aria-hidden="true">'));
  assert.match(html, /data-action="waitTurn"/);
  assert.match(html, /class="action-button action-button--[a-z]+ nearby-action"/);
});

test('exploration opt-out blocks Survey and all numbered positions live without preventing native input', () => {
  const survey = fakeButton('waitTurn');
  const nearby = Array.from({ length: 9 }, () => fakeButton('mapTalk', { nearby: true }));
  const root = fakeRoot([survey, ...nearby]);
  let enabled = true;
  root.ownerDocument.documentElement = { getAttribute: () => enabled ? 'on' : 'off' };
  const bindings = [['KeyE', survey], ...nearby.flatMap((button, i) => [[`Digit${i + 1}`, button], [`Numpad${i + 1}`, button]])];
  for (const [code, button] of bindings) assert.equal(explorationShortcutTarget(root, key(code)), button);
  enabled = false;
  for (const [code] of bindings) assert.equal(explorationShortcutTarget(root, key(code)), null);
  assert.equal(explorationShortcutTarget(root, key('', { key: 'e' })), null);
  assert.equal(explorationShortcutTarget(root, key('', { key: '1' })), null);
  const listeners = new Map();
  const window = {
    addEventListener: (name, fn) => listeners.set(name, fn),
    removeEventListener: name => listeners.delete(name),
  };
  const cleanup = installExplorationControls({ root, state: { scene: 'explore' } }, { window });
  const off = key('KeyE');
  listeners.get('keydown')(off);
  assert.equal(survey.clicks, 0);
  assert.equal(off.prevented, undefined);
  survey.click();
  assert.equal(survey.clicks, 1);
  enabled = true;
  const on = key('KeyE');
  listeners.get('keydown')(on);
  assert.equal(survey.clicks, 2);
  assert.equal(on.prevented, true);
  cleanup();
  assert.equal(listeners.size, 0);
});
