import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { ensureMapState, getAvailableActions, getVisitedZones, getZone } from '../src/map/mapState.js';
import { renderExploration } from '../src/ui/exploration.js';

function renderAt(zoneId = 'greyhaven', overrides = {}) {
  const state = createInitialState();
  const mapState = ensureMapState(state);
  mapState.zoneId = zoneId;
  mapState.visitedZones[zoneId] = true;
  Object.assign(state, overrides.state);
  Object.assign(mapState, overrides.map);
  const zone = { ...getZone(zoneId), ...overrides.zone };
  return renderExploration({
    state,
    zone,
    mapState,
    nearbyActions: overrides.nearbyActions ?? getAvailableActions(state),
    visitedZones: overrides.visitedZones ?? getVisitedZones(state),
    storyHtml: overrides.storyHtml,
  });
}

test('exploration HUD exposes a labelled grid, current position, and movement controls', () => {
  const html = renderAt();
  assert.match(html, /role="grid" aria-label="Greyhaven map"/);
  assert.match(html, /aria-rowcount="7" aria-colcount="9"/);
  assert.match(html, /role="gridcell" aria-label="Wren, your position, column 3, row 4" aria-current="location"/);
  assert.match(html, /role="group" aria-label="Movement Controls"/);
  for (const action of ['moveNorth', 'moveSouth', 'moveWest', 'moveEast', 'waitTurn']) {
    assert.ok(html.includes(`data-action="${action}"`), action);
  }
  assert.ok(html.includes('aria-label="Survey Area"'));
  assert.ok(html.includes('WASD or arrow keys'));
});

test('exploration HUD uses shared party meters and preserves all nearby action types', () => {
  const state = createInitialState();
  state.party.push({ id: 'scout', name: 'Tamsin', hp: 18, maxHp: 24, mp: 3, maxMp: 8, level: 2, xp: 15 });
  const mapState = ensureMapState(state);
  const html = renderExploration({
    state,
    zone: getZone('greyhaven'),
    mapState,
    visitedZones: ['greyhaven', 'ridge_road'],
    nearbyActions: [
      { kind: 'talk', id: 'mara', label: 'Speak to Mara' },
      { kind: 'encounter', id: 'ridge_patrol', label: 'Face patrol' },
      { kind: 'interact', id: 'cache', label: 'Open cache' },
      { kind: 'exit', id: 'ridge_road', label: 'Take Ridge Road' },
    ],
  });
  assert.equal((html.match(/class="party-member"/g) || []).length, 2);
  assert.ok(html.includes('Tamsin'));
  assert.ok(html.includes('role="progressbar"'));
  for (const action of ['mapTalk', 'mapEncounter', 'mapInteract', 'mapTravel', 'save', 'toTownScene']) {
    assert.ok(html.includes(`data-action="${action}"`), action);
  }
  assert.ok(html.includes('Fast Travel: Ridge Road'));
});

test('exploration HUD escapes zone, log, action, and story-supplied markup', () => {
  const html = renderAt('greyhaven', {
    zone: { name: '<img src=x onerror=alert(1)>', subtitle: 'A & B', description: '<script>bad()</script>' },
    map: { log: ['<b>not markup</b>'] },
    nearbyActions: [{ kind: 'talk', id: '\"><script>bad()</script>', label: '<svg onload=bad()>' }],
    storyHtml: '<section class="story-panel">Safe integration point</section>',
  });
  assert.ok(!html.includes('<script>bad()</script>'));
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<svg onload=bad()>'));
  assert.ok(html.includes('&lt;script&gt;bad()&lt;/script&gt;'));
  assert.ok(html.includes('&lt;b&gt;not markup&lt;/b&gt;'));
  assert.ok(html.includes('<section class="story-panel">Safe integration point</section>'));
});

test('empty and stocked Field Packs remain readable and consumables stay actionable', () => {
  const empty = renderAt();
  assert.ok(empty.includes('Field Pack:'));
  assert.ok(empty.includes('No supplies packed.'));
  const stocked = renderAt('greyhaven', { state: { inventory: [{ id: 'bandage', qty: 2 }] } });
  assert.ok(stocked.includes('Linen Bandage ×2'));
  assert.ok(stocked.includes('data-action="useFieldItem"'));
  assert.ok(stocked.includes('data-arg="bandage"'));
});
