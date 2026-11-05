import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bestiaryQueryText, bestiaryFilterName, filterBestiaryEntries, renderBestiary } from '../src/ui/bestiary.js';
import { bestiaryScene, bestiaryEntries, recordDefeat } from '../src/scenes/bestiary.js';
import { createInitialState } from '../src/state.js';

const freeze = value => { if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); } return value; };
const rows = freeze([
  { enemy: { id: 'private_id', name: 'Copper Guard', boss: false, intro: 'secret lore' }, count: 2 },
  { enemy: { id: 'other', name: 'Copper Captain', boss: true }, count: 1 },
  { enemy: { id: 'hidden', name: 'Hidden Sentinel', boss: true }, count: 0 },
  { enemy: { id: 'plain', name: 'Hidden Scout', boss: false }, count: 0 },
]);

test('query normalization and filter whitelist reject coercion and prototype names', () => {
  assert.equal(bestiaryQueryText('  CoPpEr  '), 'CoPpEr');
  assert.equal(bestiaryQueryText('  ' + 'x'.repeat(130) + ' '), 'x'.repeat(120));
  for (const bad of [undefined, null, {}, [], 1, true]) assert.equal(bestiaryQueryText(bad), '');
  for (const id of ['all', 'bosses', 'regular']) assert.equal(bestiaryFilterName(id), id);
  for (const bad of ['constructor', '__proto__', 'toString', 'Bosses', '', null, 1, {}]) assert.equal(bestiaryFilterName(bad), 'all');
});

test('category and recorded-name search combine without reordering or changing records', () => {
  assert.deepEqual(filterBestiaryEntries(rows), rows);
  assert.deepEqual(filterBestiaryEntries(rows, 'bosses'), [rows[1], rows[2]]);
  assert.deepEqual(filterBestiaryEntries(rows, 'regular'), [rows[0], rows[3]]);
  assert.deepEqual(filterBestiaryEntries(rows, 'all', '  COPPER  '), [rows[0], rows[1]]);
  assert.deepEqual(filterBestiaryEntries(rows, 'bosses', 'copper'), [rows[1]]);
  assert.deepEqual(filterBestiaryEntries(rows, 'regular', 'copper'), [rows[0]]);
  assert.equal(filterBestiaryEntries(rows, 'all', 'guard')[0], rows[0]);
  for (const query of ['private_id', 'secret lore', 'Hidden', '???', 'copper guard captain']) assert.deepEqual(filterBestiaryEntries(rows, 'all', query), []);
  assert.deepEqual(filterBestiaryEntries(null), []);
  assert.deepEqual(filterBestiaryEntries([null, {}, ...rows]), rows);
});

test('only positive integer victories allow name searching', () => {
  for (const count of [0, -1, 0.5, NaN, Infinity, '1', true, {}, [], null, undefined]) {
    const entries = freeze([{ enemy: { name: 'Recorded Foe' }, count }]);
    assert.deepEqual(filterBestiaryEntries(entries, 'all', 'foe'), []);
    assert.equal(filterBestiaryEntries(entries).length, 1);
  }
  assert.equal(filterBestiaryEntries([{ enemy: { name: 'Recorded Foe' }, count: 1 }], 'all', 'foe').length, 1);
  assert.deepEqual(filterBestiaryEntries([{ enemy: {}, count: 1 }], 'all', 'undefined'), []);
});

test('rendering filters only the catalogue, preserving full totals and comparison cards', () => {
  const html = renderBestiary({ entries: rows, compareIds: ['private_id'], filter: 'bosses', query: 'no match' });
  assert.match(html, /Entries: 2\/4/);
  assert.match(html, /<strong>3<\/strong> victories/);
  assert.match(html, /<strong>1\/2<\/strong> bosses recorded/);
  assert.match(html, /data-comparison-enemy="private_id"/);
  assert.match(html, /Showing 0 of 4 foes\./);
  assert.match(html, /No foes match these choices\./);
  assert.ok(!html.includes('class="bestiary-list"'));
  for (const hidden of ['Hidden Sentinel', 'Hidden Scout']) assert.ok(!html.includes(hidden));
  const baseline = renderBestiary({ entries: rows });
  assert.equal((baseline.match(/class="bestiary-entry unknown"/g) || []).length, 2);
  assert.match(baseline, /data-arg="all" aria-pressed="true"/);
  assert.match(baseline, /data-action="clearBestiarySearch" disabled/);
});

test('hostile search text is escaped in the labelled bounded input only', () => {
  const query = '\"><img src=x onerror=alert(1)>';
  const html = renderBestiary({ entries: rows, query });
  assert.ok(!html.includes('<img src=x'));
  assert.match(html, /value="&quot;&gt;&lt;img src=x onerror=alert\(1\)&gt;"/);
  assert.match(html, /for="bestiary-search">Search recorded foes/);
  assert.match(html, /type="search" maxlength="120"/);
  assert.match(html, /aria-describedby="bestiary-search-help"/);
  assert.match(html, /role="status">Showing 0 of 4 foes/);
});

function gameFor() {
  const state = createInitialState(); state.scene = 'bestiary'; recordDefeat(state, 'storm_rat');
  const game = { state, bestiaryComparison: ['storm_rat'], draft: '  RAT  ', root: { querySelector(id) { assert.equal(id, '#bestiary-search'); return { value: game.draft }; } }, setScene(scene) { this.destination = scene; } };
  bestiaryScene.onEnter(game, { returnScene: 'explore' });
  return game;
}
const act = (game, name, arg) => bestiaryScene.actions[name](game, { dataset: { arg } });

test('scene controls are transient, explicit-submit, and preserve progress and comparison', () => {
  const game = gameFor(); const before = structuredClone(game.state); freeze(game.state);
  assert.equal(game.bestiaryQuery, '');
  bestiaryScene.render(game); assert.equal(game.bestiaryQuery, '', 'render does not read an unsubmitted draft');
  act(game, 'bestiaryFilter', 'regular'); act(game, 'searchBestiary');
  assert.equal(game.bestiaryQuery, 'RAT'); assert.equal(game.bestiaryFilter, 'regular');
  assert.match(bestiaryScene.render(game), /Showing 1 of /);
  act(game, 'clearBestiarySearch'); assert.equal(game.bestiaryQuery, ''); assert.equal(game.bestiaryFilter, 'regular');
  assert.deepEqual(game.bestiaryComparison, ['storm_rat']);
  game.draft = 'x'.repeat(150); act(game, 'searchBestiary'); assert.equal(game.bestiaryQuery.length, 120);
  act(game, 'leave'); assert.equal(game.destination, 'explore');
  bestiaryScene.onEnter(game); assert.equal(game.bestiaryQuery, ''); assert.equal(game.bestiaryFilter, 'all');
  assert.deepEqual(game.bestiaryComparison, ['storm_rat']); assert.deepEqual(game.state, before);
  assert.equal(bestiaryEntries(game.state).filter(row => row.count > 0).length, 1);
});

test('invalid arguments, missing inputs, stale scenes and combat cannot change controls or progress', () => {
  const game = gameFor(); game.bestiaryFilter = 'bosses'; game.bestiaryQuery = 'saved query';
  for (const bad of ['constructor', '__proto__', 'toString', 'ALL', '', undefined, null, {}]) act(game, 'bestiaryFilter', bad);
  assert.equal(game.bestiaryFilter, 'bosses');
  for (const bad of [undefined, {}, 4, null]) { game.draft = bad; act(game, 'searchBestiary'); assert.equal(game.bestiaryQuery, 'saved query'); }
  delete game.root; act(game, 'searchBestiary'); assert.equal(game.bestiaryQuery, 'saved query');
  for (const [scene, combat] of [['town', null], ['bestiary', {}]]) {
    game.state.scene = scene; game.state.combat = combat;
    const before = structuredClone(game.state);
    act(game, 'bestiaryFilter', 'regular'); act(game, 'searchBestiary'); act(game, 'clearBestiarySearch');
    assert.equal(game.bestiaryFilter, 'bosses'); assert.equal(game.bestiaryQuery, 'saved query');
    assert.deepEqual(game.state, before); assert.deepEqual(game.bestiaryComparison, ['storm_rat']);
  }
});

test('control styles wrap and retain minimum native target sizes', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /\.bestiary-filters, \.bestiary-search-row \{[^}]*flex-wrap: wrap;[^}]*min-width: 0;/);
  assert.match(css, /\.bestiary-tools input \{[^}]*box-sizing: border-box;[^}]*min-width: 0;[^}]*min-height: 44px;/);
  assert.match(css, /\.bestiary-tools button \{[^}]*min-height: 44px;[^}]*white-space: normal;[^}]*overflow-wrap: anywhere;/);
});
