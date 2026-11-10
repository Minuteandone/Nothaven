import test from 'node:test';
import assert from 'node:assert/strict';
import { zoneProgressLine, renderExploration } from '../src/ui/exploration.js';
import { createInitialState } from '../src/state.js';
import { ensureMapState, getZone, getZoneProgress } from '../src/map/mapState.js';
import { assertEggFree } from './helpers/eggGuard.mjs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// ── Helpers ──────────────────────────────────────────────

function mockState(overrides = {}) {
  const state = createInitialState();
  const mapState = ensureMapState(state);
  if (overrides.zoneId) mapState.zoneId = overrides.zoneId;
  if (overrides.visitedZones) {
    for (const zid of overrides.visitedZones) mapState.visitedZones[zid] = true;
  }
  if (overrides.clearedEncounters) {
    mapState.clearedEncounters = { ...mapState.clearedEncounters, ...overrides.clearedEncounters };
  }
  if (overrides.completedInteractions) {
    mapState.completedInteractions = { ...mapState.completedInteractions, ...overrides.completedInteractions };
  }
  return { state, mapState };
}

// ── Gating ──────────────────────────────────────────────

test('zoneProgressLine returns empty for null state and null zone', () => {
  assert.equal(zoneProgressLine(null, null, {}), '');
});

test('zoneProgressLine returns empty for undefined state', () => {
  assert.equal(zoneProgressLine(undefined, undefined, {}), '');
});

test('zoneProgressLine returns empty for zone with zero totalObjectives', () => {
  const { state, mapState } = mockState({ zoneId: 'greyhaven', visitedZones: ['greyhaven'] });
  const zone = getZone('greyhaven');
  const progress = getZoneProgress({ ...state, map: mapState }, zone);
  assert.equal(progress.totalObjectives, 0);
  const html = zoneProgressLine(state, zone, mapState);
  assert.equal(html, '');
});

test('zoneProgressLine renders for zone with objectives even if nothing cleared', () => {
  const { state, mapState } = mockState({ zoneId: 'ridge_road' });
  const zone = getZone('ridge_road');
  const progress = getZoneProgress({ ...state, map: mapState }, zone);
  assert.ok(progress.totalObjectives > 0);
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(html.length > 0);
  assert.ok(html.includes('Zone progress:'));
});

// ── Content: encounters only ─────────────────────────────

test('zoneProgressLine shows "encounters cleared" when zone has encounters', () => {
  const { state, mapState } = mockState({ zoneId: 'ridge_road', visitedZones: ['ridge_road'] });
  const zone = getZone('ridge_road');
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(html.includes('encounters cleared'));
  assert.ok(html.includes('0/'));
  assert.ok(html.includes('%'));
});

test('zoneProgressLine uses singular "encounter" when total is 1', () => {
  const { state, mapState } = mockState();
  const zone = {
    id: 'test_zone',
    name: 'Test Zone',
    encounters: [{ id: 'test_encounter', encounterId: 'test_encounter', enemyId: 'storm_rat', name: 'Test Encounter' }],
    interactables: [],
  };
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(html.includes('0/1 encounter cleared'));
  assert.ok(!html.includes('encounters cleared'));
});

// ── Content: caches only ─────────────────────────────────

test('zoneProgressLine shows "caches opened" when zone has caches', () => {
  const { state, mapState } = mockState();
  const zone = {
    id: 'test_zone2',
    name: 'Test Zone 2',
    encounters: [],
    interactables: [
      { id: 'cache1', kind: 'cache', description: 'A crate' },
      { id: 'cache2', kind: 'cache', description: 'A barrel' },
    ],
  };
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(html.includes('caches opened'));
  assert.ok(!html.includes('encounter'));
});

test('zoneProgressLine uses singular "cache" when total is 1', () => {
  const { state, mapState } = mockState();
  const zone = {
    id: 'test_zone3',
    name: 'Test Zone 3',
    encounters: [],
    interactables: [{ id: 'cache_only', kind: 'cache', description: 'A single chest' }],
  };
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(html.includes('0/1 cache opened'));
  assert.ok(!html.includes('caches opened'));
});

// ── Content: both encounters and caches ───────────────────

test('zoneProgressLine shows both encounters and caches', () => {
  const { state, mapState } = mockState();
  const zone = {
    id: 'test_zone4',
    name: 'Test Zone 4',
    encounters: [
      { id: 'enc1', encounterId: 'enc1', enemyId: 'storm_rat', name: 'Rat 1' },
      { id: 'enc2', encounterId: 'enc2', enemyId: 'gale_hound', name: 'Hound 1' },
    ],
    interactables: [
      { id: 'cache_a', kind: 'cache', description: 'Crate A' },
    ],
  };
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(html.includes('encounters cleared'));
  assert.ok(html.includes('cache opened'));
  assert.ok(html.includes(', '));
});

// ── Content: progress percentages ────────────────────────

test('zoneProgressLine shows 0% with nothing cleared', () => {
  const { state, mapState } = mockState();
  const zone = {
    id: 'test_zone5',
    name: 'Test Zone 5',
    encounters: [{ id: 'e1', encounterId: 'e1', enemyId: 'storm_rat', name: 'Rat' }],
    interactables: [{ id: 'c1', kind: 'cache', description: 'Cache' }],
  };
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(html.includes('(0%)'));
});

test('zoneProgressLine shows 50% with half cleared', () => {
  const { state, mapState } = mockState({
    zoneId: 'test_zone6',
    visitedZones: ['test_zone6'],
    clearedEncounters: { enc1: true },
  });
  const zone = {
    id: 'test_zone6',
    name: 'Test Zone 6',
    encounters: [
      { id: 'enc1', encounterId: 'enc1', enemyId: 'storm_rat', name: 'Rat' },
      { id: 'enc2', encounterId: 'enc2', enemyId: 'gale_hound', name: 'Hound' },
    ],
    interactables: [],
  };
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(html.includes('1/2 encounters cleared'));
  assert.ok(html.includes('(50%)'));
});

test('zoneProgressLine shows 100% with everything cleared', () => {
  const { state, mapState } = mockState({
    zoneId: 'test_zone7',
    visitedZones: ['test_zone7'],
    clearedEncounters: { enc_a: true },
    completedInteractions: { cache_x: true },
  });
  const zone = {
    id: 'test_zone7',
    name: 'Test Zone 7',
    encounters: [{ id: 'enc_a', encounterId: 'enc_a', enemyId: 'storm_rat', name: 'Rat' }],
    interactables: [{ id: 'cache_x', kind: 'cache', description: 'Cache' }],
  };
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(html.includes('(100%)'));
});

// ── Structure ────────────────────────────────────────────

test('zoneProgressLine has correct CSS class and label', () => {
  const { state, mapState } = mockState();
  const zone = {
    id: 'test_zone8',
    name: 'Test Zone 8',
    encounters: [{ id: 'e8', encounterId: 'e8', enemyId: 'storm_rat', name: 'Rat' }],
    interactables: [],
  };
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(html.includes('class="zone-progress-line"'));
  assert.ok(html.includes('class="zone-progress-line__label"'));
  assert.ok(html.includes('Zone progress:'));
  assert.ok(html.startsWith('<p '));
  assert.ok(html.endsWith('</p>'));
});

test('zoneProgressLine label span contains the label text', () => {
  const { state, mapState } = mockState();
  const zone = {
    id: 'test_zone9',
    name: 'Test Zone 9',
    encounters: [{ id: 'e9', encounterId: 'e9', enemyId: 'storm_rat', name: 'Rat' }],
    interactables: [],
  };
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(html.includes('>Zone progress:</span>'));
});

// ── Integration: renderExploration ────────────────────────

test('zoneProgressLine renders through renderExploration for zone with objectives', () => {
  const state = createInitialState();
  const mapState = ensureMapState(state);
  mapState.zoneId = 'ridge_road';
  mapState.visitedZones['ridge_road'] = true;
  const zone = getZone('ridge_road');
  const html = renderExploration({
    state,
    zone,
    mapState,
    nearbyActions: [],
    visitedZones: ['ridge_road'],
  });
  assert.ok(html.includes('zone-progress-line'));
  assert.ok(html.includes('Zone progress:'));
});

test('zoneProgressLine does NOT render through renderExploration for zero-objectives zone', () => {
  const state = createInitialState();
  const mapState = ensureMapState(state);
  mapState.zoneId = 'greyhaven';
  mapState.visitedZones['greyhaven'] = true;
  const zone = getZone('greyhaven');
  const html = renderExploration({
    state,
    zone,
    mapState,
    nearbyActions: [],
    visitedZones: ['greyhaven'],
  });
  assert.ok(!html.includes('zone-progress-line'));
});

// ── Guide sync ───────────────────────────────────────────

test('zone progress guide sentence is in PLAYER_GUIDE.md', () => {
  const guide = readFileSync(join(__dirname, '..', 'docs', 'PLAYER_GUIDE.md'), 'utf-8');
  assert.ok(guide.includes('Above the zone field checklist, a Zone progress line shows encounters cleared'));
});

test('zone progress guide sentence is in guide.js', () => {
  const guideJs = readFileSync(join(__dirname, '..', 'src', 'scenes', 'guide.js'), 'utf-8');
  assert.ok(guideJs.includes('Above the zone field checklist, a Zone progress line shows encounters cleared'));
});

// ── Egg guard ────────────────────────────────────────────

test('zoneProgressLine output is egg-free', () => {
  const { state, mapState } = mockState({ visitedZones: ['ridge_road'] });
  const zone = getZone('ridge_road');
  const html = zoneProgressLine(state, zone, mapState);
  assertEggFree(html);
});

test('zone progress guide sentence is egg-free', () => {
  assertEggFree('Above the zone field checklist, a Zone progress line shows encounters cleared, caches opened, and a completion percentage at a glance, so you can see how much of a region you have finished without expanding the full list.');
});
