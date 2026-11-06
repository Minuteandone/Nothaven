import test from 'node:test';
import assert from 'node:assert/strict';
import { foeArt, renderBestiary } from '../src/ui/bestiary.js';
import { bestiaryEntries, recordDefeat } from '../src/scenes/bestiary.js';
import { ENEMIES } from '../src/data/enemies.js';
import { fieldTip } from '../src/data/fieldTips.js';
import { getItem } from '../src/items/items.js';
import { createInitialState } from '../src/state.js';

function entriesWith(defeats = {}) {
  const state = createInitialState();
  for (const [id, count] of Object.entries(defeats)) {
    for (let i = 0; i < count; i += 1) assert.equal(recordDefeat(state, id), true);
  }
  return bestiaryEntries(state);
}

test('an empty journal is spoiler-safe and rendering does not mutate records', () => {
  const entries = entriesWith();
  const snapshot = structuredClone(entries);
  const html = renderBestiary({ entries });
  assert.deepEqual(entries, snapshot);
  assert.match(html, /Entries: 0\/\d+/);
  assert.match(html, /No foes recorded yet/);
  assert.match(html, /aria-label="Journal completion"/);
  assert.match(html, /aria-valuenow="0"/);
  for (const enemy of Object.values(ENEMIES)) assert.ok(!html.includes(enemy.name), `${enemy.name} should stay hidden`);
  assert.ok(!html.includes('Mara’s advice:'));
  assert.match(html, /\?\?\? <small>\(boss\)<\/small>/);
  assert.match(html, /data-action="leave"/);
  assert.match(html, /Back to Greyhaven/);
});

test('known records show original art, effective reference stats, tactics, spoils, and advice', () => {
  const html = renderBestiary({ entries: entriesWith({ storm_rat: 3, rust_sentinel: 1, reef_crawler: 1 }) });
  const rat = ENEMIES.storm_rat;
  assert.match(html, /data-enemy="storm_rat" data-kind="beast"/);
  assert.match(html, /data-enemy="rust_sentinel" data-kind="construct"/);
  assert.match(html, /data-enemy="reef_crawler" data-kind="crawler"/);
  assert.match(html, /class="foe-art foe-art--beast"[^>]*role="img"/);
  assert.match(html, /<title>Storm Rat<\/title><desc>Angular field sketch of a wind-running beast\.<\/desc>/);
  assert.match(html, /Entries: 3\/\d+/);
  assert.match(html, /<strong>5<\/strong> victories/);
  assert.match(html, /Defeated: 3<\/strong> confirmed victories/);
  assert.match(html, /<h4>Gnaw<\/h4>/);
  assert.match(html, /20% chance · Inflicts bleeding/);
  assert.match(html, new RegExp(`<dt>HP</dt><dd>${rat.hp}</dd>`));
  assert.match(html, new RegExp(`<dt>ATK</dt><dd>${rat.atk}</dd>`));
  for (const drop of rat.loot) assert.ok(html.includes(getItem(drop.id).name));
  assert.ok(html.includes(`Mara’s advice:</strong> ${fieldTip('storm_rat')}`));
  const ratStart = html.indexOf('data-enemy="storm_rat"');
  const ratEnd = html.indexOf('</li>', ratStart);
  assert.ok(ratStart >= 0 && ratEnd > ratStart);
  assert.ok(!html.slice(ratStart, ratEnd).includes('Second phase:'));
});

test('boss records expose phase information only after a victory and count recorded bosses', () => {
  const totalBosses = Object.values(ENEMIES).filter(enemy => enemy.boss).length;
  const hidden = renderBestiary({ entries: entriesWith() });
  assert.ok(!hidden.includes('Second phase:'));
  const html = renderBestiary({ entries: entriesWith({ relay_warden: 2, tide_wraith: 1 }) });
  assert.match(html, /data-enemy="relay_warden"[^>]*data-boss="true"/);
  assert.match(html, /Second phase: grows enraged below 50% HP \(\+3 ATK\)/);
  assert.match(html, /Second phase: grows enraged below 50% HP \(\+2 ATK\)/);
  assert.match(html, new RegExp(`<strong>2/${totalBosses}</strong> bosses recorded`));
  assert.match(html, /<strong>3<\/strong> victories/);
  assert.match(html, /Boss record/);
});

test('return destinations and catalogue summaries retain their existing action', () => {
  const entries = entriesWith({ storm_rat: 1 });
  assert.match(renderBestiary({ entries, returnScene: 'explore' }), /Back to expedition/);
  assert.match(renderBestiary({ entries, returnScene: 'town' }), /Back to Greyhaven/);
  assert.match(renderBestiary({ entries, returnScene: 'muster' }), />Back</);
  const html = renderBestiary({ entries, returnScene: 'explore' });
  assert.match(html, /1 revealed · \d+ unrecorded/);
  assert.equal((html.match(/data-action="leave"/g) || []).length, 1);
});

test('direct renderer input escapes untrusted content and safely handles malformed optional fields', () => {
  const entries = [{
    count: '2.9',
    enemy: {
      id: 'intruder\" onmouseover=\"alert(1)', name: '<img src=x onerror=alert(1)>',
      hp: 'not-a-number', atk: 7, def: null, spd: 4, xp: 9, gold: 2,
      tags: 'construct', loot: { id: 'not-an-array' }, intro: '<script>alert(1)</script>',
      ability: { name: '<b>Unsafe</b>', status: '<i>cursed</i>', chance: 0.5 },
    },
  }];
  const snapshot = structuredClone(entries);
  const html = renderBestiary({ entries });
  assert.deepEqual(entries, snapshot);
  assert.ok(!html.includes('<img src=x'));
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(!html.includes('<b>Unsafe</b>'));
  assert.ok(!html.includes('<i>cursed</i>'));
  assert.ok(html.includes('&lt;img src=x onerror=alert(1)&gt;'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
  assert.ok(html.includes('data-enemy="intruder&quot; onmouseover=&quot;alert(1)"'));
  assert.match(html, /data-kind="humanoid"/);
  assert.match(html, /<dt>HP<\/dt><dd>0<\/dd>/);
  assert.match(html, /Defeated: 2<\/strong>/);
  assert.match(html, /<strong>2<\/strong> victories/);
  assert.ok(!html.includes('Known spoils:'));
});

test('foeArt has a safe humanoid fallback and escapes accessible labels', () => {
  const html = foeArt({ id: 'unknown_future_foe', name: 'Road <Captain> & Crew' });
  assert.match(html, /foe-art--humanoid/);
  assert.match(html, /role="img"/);
  assert.match(html, /Road &lt;Captain&gt; &amp; Crew: an armed storm-road adversary/);
  assert.ok(!html.includes('Road <Captain>'));
  assert.ok(!html.includes('<defs>'));
});

test('element badge renders in known entry for elemental foe', () => {
  const html = renderBestiary({ entries: entriesWith({ frost_wolf: 1 }) });
  assert.match(html, /element-chip element--ice/);
  assert.match(html, /<span class="element-chip element--ice">Ice<\/span>/);
  assert.match(html, /foe-element/);
});

test('no element badge in known entry for non-elemental foe', () => {
  const html = renderBestiary({ entries: entriesWith({ storm_rat: 1 }) });
  const ratStart = html.indexOf('data-enemy="storm_rat"');
  const ratEnd = html.indexOf('</li>', ratStart);
  const snippet = html.slice(ratStart, ratEnd);
  assert.ok(!snippet.includes('foe-element'), 'storm_rat entry must not contain foe-element');
  assert.ok(!snippet.includes('element-chip'), 'storm_rat entry must not contain element-chip');
});

test('element badge renders in tactical comparison card', () => {
  const html = renderBestiary({ entries: entriesWith({ frost_wolf: 1 }), compareIds: ['frost_wolf'] });
  assert.match(html, /data-comparison-enemy="frost_wolf"/);
  const compStart = html.indexOf('data-comparison-enemy="frost_wolf"');
  const compEnd = html.indexOf('</article>', compStart);
  const snippet = html.slice(compStart, compEnd);
  assert.match(snippet, /element-chip element--ice/);
  assert.match(snippet, /foe-element/);
});

test('element badge safely handles unknown element values without XSS', () => {
  const entries = [{
    count: 1,
    enemy: {
      id: 'hazard', name: 'Hazard',
      hp: 10, atk: 3, def: 1, spd: 2, xp: 5, gold: 1,
      element: '<img src=x onerror=alert(1)>',
      tags: [], loot: [],
    },
  }];
  const html = renderBestiary({ entries });
  assert.ok(!html.includes('<img src=x'), 'must not contain raw img tag');
  assert.ok(!html.includes('onerror='), 'must not contain raw onerror');
  assert.ok(!html.includes('<script'), 'must not contain raw script tag');
  // Unknown element normalises to empty class -> elementBadge returns '' -> no badge at all
  assert.ok(!html.includes('&lt;img'), 'unknown element value must not leak into HTML');
});

test('unknown element value renders no chip span', () => {
  const entries = [{
    count: 1,
    enemy: {
      id: 'mystery', name: 'Mystery',
      hp: 10, atk: 3, def: 1, spd: 2, xp: 5, gold: 1,
      element: 'plasma',
      tags: [], loot: [],
    },
  }];
  const html = renderBestiary({ entries });
  assert.ok(!html.includes('foe-element'), 'unknown element must not render foe-element');
  assert.ok(!html.includes('element-chip'), 'unknown element must not render empty chip span');
});
