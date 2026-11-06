import test from 'node:test';
import assert from 'node:assert/strict';
import { BESTIARY_ELEMENT_FILTERS, bestiaryFilterElement, filterBestiaryEntries, renderBestiary } from '../src/ui/bestiary.js';
import { bestiaryScene, bestiaryEntries, recordDefeat } from '../src/scenes/bestiary.js';
import { ENEMIES } from '../src/data/enemies.js';
import { createInitialState } from '../src/state.js';

const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };

const elementRows = freeze([
  { enemy: { id: 'ember', name: 'Ember Cur', boss: false, element: 'fire' }, count: 1 },
  { enemy: { id: 'frost', name: 'Frost Whelp', boss: false, element: 'ice' }, count: 1 },
  { enemy: { id: 'boulder', name: 'Boulder Skulk', boss: false, element: 'earth' }, count: 1 },
  { enemy: { id: 'plain', name: 'Plain Thug', boss: false }, count: 1 },
  { enemy: { id: 'cinderlord', name: 'Cinder Lord', boss: true, element: 'fire' }, count: 1 },
]);

test('element filter whitelist normalizes values and rejects coercion and prototype names', () => {
  for (const v of ['all', 'fire', 'ice', 'lightning', 'water', 'earth', 'untyped']) {
    assert.equal(bestiaryFilterElement(v), v);
  }
  for (const bad of ['constructor', '__proto__', 'toString', 'Fire', 'FIRE', '', null, 1, {}, [], undefined]) {
    assert.equal(bestiaryFilterElement(bad), 'all');
  }
  assert.deepEqual(BESTIARY_ELEMENT_FILTERS, ['all', 'fire', 'ice', 'lightning', 'water', 'earth', 'untyped']);
});

test('element filter selects matching foes and an untyped bucket', () => {
  assert.deepEqual(filterBestiaryEntries(elementRows, 'all', '', 'all'), elementRows);
  assert.deepEqual(filterBestiaryEntries(elementRows, 'all', '', 'fire'), [elementRows[0], elementRows[4]]);
  assert.deepEqual(filterBestiaryEntries(elementRows, 'all', '', 'ice'), [elementRows[1]]);
  assert.deepEqual(filterBestiaryEntries(elementRows, 'all', '', 'earth'), [elementRows[2]]);
  assert.deepEqual(filterBestiaryEntries(elementRows, 'all', '', 'untyped'), [elementRows[3]]);
  assert.deepEqual(filterBestiaryEntries(elementRows, 'all', '', 'lightning'), []);
  assert.deepEqual(filterBestiaryEntries(elementRows, 'all', '', 'water'), []);
});

test('element filter combines with category and recorded-name search without reordering', () => {
  assert.deepEqual(filterBestiaryEntries(elementRows, 'bosses', '', 'fire'), [elementRows[4]]);
  assert.deepEqual(filterBestiaryEntries(elementRows, 'regular', '', 'fire'), [elementRows[0]]);
  assert.deepEqual(filterBestiaryEntries(elementRows, 'all', 'ember', 'fire'), [elementRows[0]]);
  assert.deepEqual(filterBestiaryEntries(elementRows, 'all', 'ember', 'ice'), []);
  assert.deepEqual(filterBestiaryEntries(elementRows, 'bosses', 'cinder', 'all'), [elementRows[4]]);
  // invalid element value falls back to 'all'
  assert.deepEqual(filterBestiaryEntries(elementRows, 'all', '', 'nope'), elementRows);
});

test('element filter over the full bestiary matches ENEMIES element assignments', () => {
  const state = createInitialState();
  const entries = bestiaryEntries(state);
  const counts = {};
  for (const element of ['fire', 'ice', 'lightning', 'water', 'earth']) {
    counts[element] = Object.values(ENEMIES).filter(e => e.element === element).length;
  }
  counts.untyped = Object.values(ENEMIES).filter(e => !e.element).length;
  assert.equal(counts.fire + counts.ice + counts.lightning + counts.water + counts.earth + counts.untyped, entries.length);
  for (const element of Object.keys(counts)) {
    assert.equal(filterBestiaryEntries(entries, 'all', '', element).length, counts[element], `element ${element} count`);
  }
});

test('renderBestiary renders element filter buttons and reflects the active element', () => {
  const html = renderBestiary({ entries: bestiaryEntries(createInitialState()), elementFilter: 'lightning' });
  for (const [id, label] of [['all', 'All'], ['fire', 'Fire'], ['ice', 'Ice'], ['lightning', 'Lightning'], ['water', 'Water'], ['earth', 'Earth'], ['untyped', 'Untyped']]) {
    assert.match(html, new RegExp(`data-action="bestiaryElementFilter" data-arg="${id}"`));
    assert.ok(html.includes(`>${label}</button>`), `label ${label} present`);
  }
  assert.match(html, /data-action="bestiaryElementFilter" data-arg="lightning" aria-pressed="true"/);
  assert.match(html, /data-action="bestiaryElementFilter" data-arg="all" aria-pressed="false"/);
  assert.match(html, /role="group" aria-label="Foe element"/);
  // unknown element filter value is normalized to 'all' in the render path
  const html2 = renderBestiary({ entries: bestiaryEntries(createInitialState()), elementFilter: 'plasma' });
  assert.match(html2, /data-arg="all" aria-pressed="true"/);
});

function gameFor() {
  const state = createInitialState(); state.scene = 'bestiary'; recordDefeat(state, 'storm_rat');
  const game = { state, bestiaryComparison: ['storm_rat'], setScene(scene) { this.destination = scene; } };
  bestiaryScene.onEnter(game, { returnScene: 'explore' });
  return game;
}
const act = (game, name, arg) => bestiaryScene.actions[name](game, { dataset: { arg } });

test('scene element-filter action is transient, whitelisted, and preserves other controls', () => {
  const game = gameFor(); const before = structuredClone(game.state); freeze(game.state);
  assert.equal(game.bestiaryElement, 'all');
  act(game, 'bestiaryElementFilter', 'earth');
  assert.equal(game.bestiaryElement, 'earth');
  assert.match(bestiaryScene.render(game), /data-action="bestiaryElementFilter" data-arg="earth" aria-pressed="true"/);
  for (const bad of ['constructor', '__proto__', 'toString', 'Earth', '', undefined, null, {}]) {
    act(game, 'bestiaryElementFilter', bad);
    assert.equal(game.bestiaryElement, 'earth');
  }
  assert.deepEqual(game.bestiaryComparison, ['storm_rat']);
  assert.deepEqual(game.state, before);
  bestiaryScene.onEnter(game);
  assert.equal(game.bestiaryElement, 'all');
});

test('scene element-filter action ignores stale scenes and active combat', () => {
  const game = gameFor(); game.bestiaryElement = 'fire';
  for (const [scene, combat] of [['town', null], ['bestiary', {}]]) {
    game.state.scene = scene; game.state.combat = combat;
    const before = structuredClone(game.state);
    act(game, 'bestiaryElementFilter', 'water');
    assert.equal(game.bestiaryElement, 'fire');
    assert.deepEqual(game.state, before);
  }
});
