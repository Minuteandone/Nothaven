import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { ensureMapState, getAvailableActions, getVisitedZones, getZone } from '../src/map/mapState.js';
import { exploreScene } from '../src/map/exploreScene.js';
import { characterScene } from '../src/scenes/character.js';
import { renderExploration } from '../src/ui/exploration.js';
import { zoneArt, zoneVista } from '../src/ui/zoneArt.js';

const ZONE_IDS = [
  'greyhaven', 'ridge_road', 'observatory_ruins', 'beacon_tower',
  'saltmere_coast', 'highwatch_pass', 'sunscar_relay', 'stormcrown_spire', 'storms_eye',
];

function renderAt(zoneId = 'greyhaven', options = {}) {
  const state = createInitialState();
  const mapState = ensureMapState(state);
  mapState.zoneId = zoneId;
  mapState.visitedZones[zoneId] = true;
  return renderExploration({
    state,
    zone: getZone(zoneId),
    mapState,
    nearbyActions: getAvailableActions(state),
    visitedZones: getVisitedZones(state),
    ...options,
  });
}

function navigationGame() {
  const state = createInitialState();
  ensureMapState(state);
  return {
    state,
    scenes: { town: {}, explore: exploreScene, character: characterScene },
    bus: { emit() {} },
    setScene(name, data = {}) {
      this.enteredScene = name;
      this.enteredData = data;
      this.state.scene = name;
      this.scenes[name]?.onEnter?.(this, data);
    },
  };
}

test('all nine expedition vistas are distinct, captioned, and accessibly described', () => {
  const signatures = new Set();
  for (const id of ZONE_IDS) {
    const html = zoneVista(id);
    assert.ok(html.includes(`data-zone="${id}"`), id);
    assert.match(html, /viewBox="0 0 800 260" role="img"/);
    assert.ok(html.includes(`aria-labelledby="zone-vista-${id}-title zone-vista-${id}-desc"`), id);
    assert.ok(html.includes(`<title id="zone-vista-${id}-title">`), id);
    assert.ok(html.includes(`<desc id="zone-vista-${id}-desc">`), id);
    assert.match(html, /<figcaption><span>Field vista<\/span><strong>.+<\/strong><\/figcaption>/);
    signatures.add(html);
  }
  assert.equal(signatures.size, ZONE_IDS.length);
});

test('vistas use original path-only vector geometry with no scripts or external assets', () => {
  for (const id of [...ZONE_IDS, 'unknown-frontier']) {
    const art = zoneArt(id);
    assert.ok((art.match(/<path\b/g) || []).length >= 5, id);
    assert.doesNotMatch(art, /<(?:circle|ellipse|rect|image|img|script|foreignObject)\b/i);
    assert.doesNotMatch(art, /\son[a-z]+\s*=|(?:href|src)\s*=/i);
    assert.doesNotMatch(art, /https?:|url\(/i);
  }
});

test('unknown and hostile zone identifiers use a non-spoiler safe frontier fallback', () => {
  for (const hostile of ['missing_zone', '\"><img src=x onerror=alert(1)>', '__proto__', null, 42, { id: '<svg onload=bad()>' }]) {
    const html = zoneVista(hostile);
    assert.ok(html.includes('data-zone="frontier"'));
    assert.ok(html.includes('An uncharted road beneath the storm'));
    assert.doesNotMatch(html, /<img src=x|<svg onload|onerror=alert/);
    const injected = typeof hostile === 'string' ? hostile : hostile?.id;
    if (typeof injected === 'string') assert.ok(!html.includes(injected));
  }
  assert.equal(zoneArt(), zoneArt('greyhaven'));
});

test('exploration places scenic art before its existing tactical map and preserves controls', () => {
  const html = renderAt('ridge_road', { hasCharacter: true, hasQuestJournal: true });
  assert.ok(html.indexOf('class="zone-vista"') > html.indexOf('class="zone-description"'));
  assert.ok(html.indexOf('class="zone-vista"') < html.indexOf('class="map-frame"'));
  assert.ok(html.includes('Switchbacks above the storm chasm'));
  for (const action of ['moveNorth', 'moveSouth', 'moveWest', 'moveEast', 'waitTurn', 'openCharacter', 'openBag', 'openQuests', 'openJournal', 'save', 'toTownScene']) {
    assert.ok(html.includes(`data-action="${action}"`), action);
  }
  assert.match(html, /role="grid" aria-label="Ridge Road map"/);
  assert.ok(html.includes('Field Pack:'));
});

test('character and journal utility links remain optional for older integrations', () => {
  const html = renderAt();
  assert.ok(!html.includes('data-action="openCharacter"'));
  assert.ok(!html.includes('data-action="openQuests"'));
  assert.ok(html.includes('data-action="openJournal"'));
  const withCharacter = renderAt('greyhaven', { hasCharacter: true });
  assert.match(withCharacter, /data-action="openCharacter"[^>]*>.*Character Sheet/s);
});

test('Explore opens the real character scene and returns to the expedition', () => {
  const game = navigationGame();
  const rendered = exploreScene.render(game);
  assert.ok(rendered.includes('data-action="openCharacter"'));
  exploreScene.actions.openCharacter(game);
  assert.equal(game.enteredScene, 'character');
  assert.deepEqual(game.enteredData, { returnScene: 'explore' });
  assert.equal(game.characterReturn, 'explore');
  assert.match(characterScene.render(game), /Back to expedition/);
  characterScene.actions.leave(game);
  assert.equal(game.enteredScene, 'explore');
  assert.equal(game.state.scene, 'explore');
  const guarded = navigationGame();
  delete guarded.scenes.character;
  assert.ok(!exploreScene.render(guarded).includes('data-action="openCharacter"'));
  assert.doesNotThrow(() => exploreScene.actions.openCharacter(guarded));
  assert.equal(guarded.enteredScene, undefined);
});
