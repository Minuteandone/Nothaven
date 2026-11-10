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

// ── Content: percentage-only output ─────────────────────

test('zoneProgressLine renders for zone with objectives', () => {
  const { state, mapState } = mockState({ zoneId: 'ridge_road' });
  const zone = getZone('ridge_road');
  const progress = getZoneProgress({ ...state, map: mapState }, zone);
  assert.ok(progress.totalObjectives > 0);
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(html.length > 0);
  assert.ok(html.includes('Zone recon:'));
  assert.ok(html.includes('% complete.'));
});

test('zoneProgressLine shows 0% complete with nothing cleared', () => {
  const { state, mapState } = mockState();
  const zone = {
    id: 'test_zone5',
    name: 'Test Zone 5',
    encounters: [{ id: 'e1', encounterId: 'e1', enemyId: 'storm_rat', name: 'Rat' }],
    interactables: [{ id: 'c1', kind: 'cache', description: 'Cache' }],
  };
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(html.includes('0% complete.'));
});

test('zoneProgressLine shows 50% complete with half cleared', () => {
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
  assert.ok(html.includes('50% complete.'));
});

test('zoneProgressLine shows 100% complete with everything cleared', () => {
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
  assert.ok(html.includes('100% complete.'));
});

test('zoneProgressLine does NOT include encounter or cache counts', () => {
  const { state, mapState } = mockState({ zoneId: 'ridge_road', visitedZones: ['ridge_road'] });
  const zone = getZone('ridge_road');
  const html = zoneProgressLine(state, zone, mapState);
  assert.ok(!html.includes('encounter'));
  assert.ok(!html.includes('cache'));
  assert.ok(!html.includes('cleared'));
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
  assert.ok(html.includes('Zone recon:'));
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
  assert.ok(html.includes('>Zone recon:</span>'));
});

test('zoneProgressLine matches exact format', () => {
  const { state, mapState } = mockState({
    zoneId: 'test_zone10',
    visitedZones: ['test_zone10'],
    clearedEncounters: { e10: true },
  });
  const zone = {
    id: 'test_zone10',
    name: 'Test Zone 10',
    encounters: [
      { id: 'e10', encounterId: 'e10', enemyId: 'storm_rat', name: 'Rat' },
      { id: 'e11', encounterId: 'e11', enemyId: 'gale_hound', name: 'Hound' },
    ],
    interactables: [],
  };
  const html = zoneProgressLine(state, zone, mapState);
  assert.equal(html, '<p class="zone-progress-line"><span class="zone-progress-line__label">Zone recon:</span> 50% complete.</p>');
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
  assert.ok(html.includes('Zone recon:'));
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
  assert.ok(guide.includes('Above the zone field checklist, a Zone progress line shows exploration progress as a completion percentage'));
});

test('zone progress guide sentence is in guide.js', () => {
  const guideJs = readFileSync(join(__dirname, '..', 'src', 'scenes', 'guide.js'), 'utf-8');
  assert.ok(guideJs.includes('Above the zone field checklist, a Zone progress line shows exploration progress as a completion percentage'));
});

// ── Egg guard ────────────────────────────────────────────

test('zoneProgressLine output is egg-free', () => {
  const { state, mapState } = mockState({ visitedZones: ['ridge_road'] });
  const zone = getZone('ridge_road');
  const html = zoneProgressLine(state, zone, mapState);
  assertEggFree(html);
});

test('zone progress guide sentence is egg-free', () => {
  assertEggFree('Above the zone field checklist, a Zone progress line shows exploration progress as a completion percentage at a glance, so you can see how much of a region you have finished without expanding the full list.');
});
