import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BESTIARY_COMPARISON_LIMIT, bestiaryComparisonIds, renderBestiary } from '../src/ui/bestiary.js';
import { bestiaryEntries, bestiaryScene, recordDefeat } from '../src/scenes/bestiary.js';
import { createInitialState } from '../src/state.js';
import { ENEMIES } from '../src/data/enemies.js';

function entriesWith(defeats = {}) {
  const state = createInitialState();
  for (const [id, count] of Object.entries(defeats)) {
    for (let i = 0; i < count; i += 1) assert.equal(recordDefeat(state, id), true);
  }
  return bestiaryEntries(state);
}

function entryMarkup(html, id) {
  const start = html.indexOf(`data-enemy="${id}"`);
  assert.ok(start >= 0, `known entry ${id}`);
  return html.slice(start, html.indexOf('</div>\n  </li>', start));
}

function cardMarkup(html, id) {
  const start = html.indexOf(`data-comparison-enemy="${id}"`);
  assert.ok(start >= 0, `comparison card ${id}`);
  return html.slice(start, html.indexOf('</article>', start));
}

function fakeGame() {
  return {
    state: createInitialState(), bestiaryReturn: 'town', bestiaryComparison: [], last: null,
    setScene(name) { this.last = name; },
  };
}

test('comparison IDs whitelist confirmed records, deduplicate, cap at three, and do not mutate input', () => {
  const entries = entriesWith({ storm_rat: 1, gale_hound: 1, reef_crawler: 1, rust_sentinel: 1 });
  const requested = Object.freeze(['storm_rat', 'storm_rat', 'tide_wraith', 'gale_hound', 'reef_crawler', 'rust_sentinel']);
  const snapshot = structuredClone(entries);
  assert.deepEqual(bestiaryComparisonIds(entries, requested), ['storm_rat', 'gale_hound', 'reef_crawler']);
  assert.deepEqual(bestiaryComparisonIds(entries, ['constructor', 'missing', null, 7, {}]), []);
  assert.deepEqual(bestiaryComparisonIds(null, 'storm_rat'), []);
  assert.deepEqual(entries, snapshot);
  assert.equal(BESTIARY_COMPARISON_LIMIT, 3);
});

test('empty, one-foe, and full trays render accurate native controls without revealing unknown foes', () => {
  const empty = renderBestiary({ entries: entriesWith(), compareIds: ['tide_wraith'] });
  assert.match(empty, /0\/3 selected/);
  assert.match(empty, /unrecorded foes stay hidden/);
  assert.ok(!empty.includes('data-comparison-enemy='));
  assert.ok(!empty.includes('Tide Wraith'));
  assert.ok(!empty.includes('data-action="compareFoe"'));

  const entries = entriesWith({ storm_rat: 1, gale_hound: 1, reef_crawler: 1, rust_sentinel: 1 });
  const one = renderBestiary({ entries, compareIds: ['storm_rat'] });
  assert.match(one, /1\/3 selected/);
  assert.equal((one.match(/data-comparison-enemy=/g) || []).length, 1);
  assert.match(entryMarkup(one, 'storm_rat'), /data-action="removeComparedFoe"[^>]*aria-pressed="true"/);
  assert.match(entryMarkup(one, 'gale_hound'), /data-action="compareFoe"[^>]*aria-pressed="false"/);
  assert.match(one, /data-action="clearComparison"/);

  const full = renderBestiary({ entries, compareIds: ['storm_rat', 'gale_hound', 'reef_crawler', 'rust_sentinel'] });
  assert.match(full, /3\/3 selected\. Tray full/);
  assert.equal((full.match(/data-comparison-enemy=/g) || []).length, 3);
  assert.ok(!full.includes('data-comparison-enemy="rust_sentinel"'));
  assert.match(entryMarkup(full, 'rust_sentinel'), /aria-pressed="false"[^>]*disabled title="Remove a foe/);
  assert.match(entryMarkup(full, 'reef_crawler'), /aria-pressed="true"/);
});

test('comparison cards repeat confirmed stats, signature details, and second-phase information', () => {
  const html = renderBestiary({
    entries: entriesWith({ storm_rat: 1, relay_warden: 1 }),
    compareIds: ['storm_rat', 'relay_warden'],
  });
  const rat = cardMarkup(html, 'storm_rat');
  assert.match(rat, new RegExp(`<dt>HP</dt><dd>${ENEMIES.storm_rat.hp}</dd>`));
  assert.match(rat, new RegExp(`<dt>Gold</dt><dd>${ENEMIES.storm_rat.gold}</dd>`));
  assert.match(rat, /<h4>Gnaw<\/h4>/);
  assert.match(rat, /Inflicts bleeding\. 20% use chance\./);
  assert.match(cardMarkup(html, 'relay_warden'), /Second phase: grows enraged below 50% HP \(\+3 ATK\)/);

  const custom = [{ count: 1, enemy: { id: 'plain_foe', name: 'Plain Foe', hp: 4 } }];
  assert.match(renderBestiary({ entries: custom, compareIds: ['plain_foe'] }), /No signature move recorded\./);
});

test('comparison rendering escapes every dynamic field and preserves frozen records', () => {
  const id = 'bad"><img src=x onerror=alert(1)>';
  const entries = [{ count: 1, enemy: {
    id, name: '<script>alert(1)</script>', hp: 'bad', atk: 2, def: 3, spd: 4, xp: 5, gold: 6,
    ability: { name: '<b>Unsafe</b>', status: '<i>cursed</i>', chance: 0.25 },
  } }];
  const snapshot = structuredClone(entries);
  const html = renderBestiary({ entries, compareIds: [id] });
  assert.deepEqual(entries, snapshot);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<img src=x onerror=alert(1)>'));
  assert.ok(!html.includes('<b>Unsafe</b>'));
  assert.ok(!html.includes('<i>cursed</i>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('Inflicts &lt;i&gt;cursed&lt;/i&gt;. 25% use chance.'));
  assert.match(html, /<dt>HP<\/dt><dd>0<\/dd>/);
});

test('scene actions add, ignore duplicates and unknown IDs, enforce capacity, remove, clear, and return safely', () => {
  const game = fakeGame();
  for (const id of ['storm_rat', 'gale_hound', 'reef_crawler', 'rust_sentinel']) recordDefeat(game.state, id);
  const snapshot = structuredClone(game.state);
  const act = (name, arg) => bestiaryScene.actions[name](game, { dataset: { arg } });
  act('compareFoe', 'storm_rat');
  act('compareFoe', 'storm_rat');
  act('compareFoe', 'tide_wraith');
  act('compareFoe', 'constructor');
  assert.deepEqual(game.bestiaryComparison, ['storm_rat']);
  act('compareFoe', 'gale_hound');
  act('compareFoe', 'reef_crawler');
  act('compareFoe', 'rust_sentinel');
  assert.deepEqual(game.bestiaryComparison, ['storm_rat', 'gale_hound', 'reef_crawler']);
  act('removeComparedFoe', 'gale_hound');
  assert.deepEqual(game.bestiaryComparison, ['storm_rat', 'reef_crawler']);
  act('compareFoe', 'rust_sentinel');
  assert.deepEqual(game.bestiaryComparison, ['storm_rat', 'reef_crawler', 'rust_sentinel']);
  assert.match(bestiaryScene.render(game), /3\/3 selected\. Tray full/);
  bestiaryScene.actions.clearComparison(game);
  assert.deepEqual(game.bestiaryComparison, []);
  bestiaryScene.onEnter(game, { returnScene: 'explore' });
  bestiaryScene.actions.leave(game);
  assert.equal(game.last, 'explore');
  assert.deepEqual(game.state, snapshot, 'comparison never changes journey or victory records');
});

test('comparison styles retain responsive columns, narrow stacking, contrast, and native target sizing', () => {
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  assert.match(css, /\.bestiary-comparison__grid \{ display: grid; grid-template-columns: repeat\(auto-fit, minmax\(min\(100%, 15rem\), 1fr\)\)/);
  assert.match(css, /@media \(max-width: 520px\)[\s\S]*?\.bestiary-comparison__grid \{ grid-template-columns: 1fr; \}/);
  assert.match(css, /html\[data-contrast="high"\] \.comparison-card/);
  assert.match(css, /\.comparison-card__heading \.comparison-remove \{ flex: none; min-height: 44px;/);
});
