import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { ensureMapState, getAvailableActions, getVisitedZones, getZone } from '../src/map/mapState.js';
import { renderExploration } from '../src/ui/exploration.js';
import { zoneArt, zoneVista } from '../src/ui/zoneArt.js';

const ZONE_IDS = Object.freeze([
  'greyhaven', 'ridge_road', 'observatory_ruins', 'beacon_tower',
  'saltmere_coast', 'highwatch_pass', 'sunscar_relay', 'stormcrown_spire', 'storms_eye',
]);

function explorationAt(zoneId) {
  const state = createInitialState();
  const mapState = ensureMapState(state);
  mapState.zoneId = zoneId;
  mapState.visitedZones[zoneId] = true;
  return {
    state,
    html: renderExploration({
      state,
      zone: getZone(zoneId),
      mapState,
      nearbyActions: getAvailableActions(state),
      visitedZones: getVisitedZones(state),
      hasCharacter: true,
      hasQuestJournal: true,
    }),
  };
}

test('each fixed vista has a unique decorative life layer within its accessible artwork', () => {
  const layers = new Set();
  for (const id of ZONE_IDS) {
    const html = zoneArt(id);
    const className = `zone-vista__life zone-vista__life--${id}`;
    assert.ok(html.includes(`<g class="${className}" aria-hidden="true">`), id);
    assert.equal(html.split(className).length - 1, 1, id);
    assert.match(html, /role="img" focusable="false" aria-labelledby=/);
    assert.ok(html.indexOf('zone-vista__life') > html.indexOf('</desc>'), id);
    const layer = html.slice(html.indexOf(`<g class="${className}`), html.lastIndexOf('</g>'));
    assert.ok((layer.match(/<path\b/g) || []).length >= 3, id);
    layers.add(layer);
  }
  assert.equal(layers.size, ZONE_IDS.length);
});

test('decorative layers retain path-only, noninteractive, network-free artwork', () => {
  for (const id of ZONE_IDS) {
    const html = zoneVista(id);
    const layer = html.slice(html.indexOf('zone-vista__life'), html.lastIndexOf('</g>'));
    assert.ok(layer.includes('<path'), id);
    assert.doesNotMatch(layer, /<(?:circle|ellipse|rect|image|img|script|foreignObject|button|a)\b/i, id);
    assert.doesNotMatch(layer, /\son[a-z]+\s*=|(?:href|src|tabindex)\s*=|https?:|url\(/i, id);
    assert.doesNotMatch(layer, /data-action|role="(?:button|link)"/i, id);
  }
});

test('unknown and malformed zones never receive a fixed-zone detail layer or echo input', () => {
  for (const value of ['missing', '__proto__', 'constructor', '\"><img src=x onerror=alert(1)>', null, 42, {}, { id: 'ridge_road<script>' }]) {
    const html = zoneArt(value);
    assert.ok(html.includes('data-zone="frontier"'));
    assert.ok(!html.includes('zone-vista__life'));
    assert.doesNotMatch(html, /<img|onerror=|<script/);
  }
  assert.equal(zoneArt(), zoneArt('greyhaven'));
});

test('object identifiers and repeated renders do not mutate caller data or cached artwork', () => {
  for (const id of ZONE_IDS) {
    const zone = Object.freeze({ id });
    const first = zoneArt(zone);
    const second = zoneArt(zone);
    assert.equal(first, second, id);
    assert.deepEqual(zone, { id }, id);
    assert.equal(zoneVista(zone), zoneVista(id), id);
  }
});

test('all scenic integrations preserve tactical controls and journey state', () => {
  for (const id of ZONE_IDS) {
    const { state, html } = explorationAt(id);
    const snapshot = structuredClone(state);
    assert.ok(html.indexOf('zone-vista__life') > html.indexOf('zone-description'), id);
    assert.ok(html.indexOf('zone-vista__life') < html.indexOf('map-frame'), id);
    for (const action of ['moveNorth', 'moveSouth', 'moveWest', 'moveEast', 'waitTurn', 'openCharacter', 'openBag', 'openQuests', 'openJournal', 'save', 'toTownScene']) {
      assert.ok(html.includes(`data-action="${action}"`), `${id}: ${action}`);
    }
    assert.match(html, /role="grid"/, id);
    assert.deepEqual(state, snapshot, id);
  }
});
