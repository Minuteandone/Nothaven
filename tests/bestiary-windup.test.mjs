import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';
import { renderBestiary } from '../src/ui/bestiary.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const bosses = Object.values(ENEMIES).filter(enemy => enemy.windup);
const occurrences = (html, text) => html.split(text).length - 1;
const render = (enemy, count = 1) => renderBestiary({ entries: [{ enemy, count }], compareIds: [enemy.id] });

for (const enemy of bosses) {
  test(`${enemy.id}: both known views show the catalogue windup without mutation`, () => {
    const input = { entries: [{ enemy: structuredClone(enemy), count: 1 }], compareIds: [enemy.id] };
    const before = structuredClone(input);
    const html = renderBestiary(input);
    assert.equal(occurrences(html, ' foe-windup'), 2);
    assert.equal(occurrences(html, `Windup: ${enemy.windup.name}`), 2);
    assert.equal(occurrences(html, `${Math.round(enemy.windup.chance * 100)}% chance to begin gathering.`), 2);
    assert.equal(occurrences(html, `×${enemy.windup.mult} ATK strike at Wren on its next action.`), 2);
    assert.equal(occurrences(html, 'Gathers for one enemy action'), 2);
    assert.equal(occurrences(html, 'After the warning, Defend or a ward halves the strike; stunning the foe interrupts it.'), 2);
    assert.deepEqual(input, before);
    assertEggFree(html, 'known windup reference');
  });
}

test('unknown bosses hide names and windups even when requested for comparison', () => {
  for (const enemy of bosses) {
    const html = render(enemy, 0);
    assert.equal(occurrences(html, ' foe-windup'), 0);
    assert.ok(!html.includes(enemy.windup.name));
    assert.ok(!html.includes(enemy.name));
    assert.ok(!html.includes('data-comparison-enemy='));
  }
});

test('known foes without windups have no windup reference', () => {
  assert.ok(!render(ENEMIES.storm_rat).includes('foe-windup'));
});

test('mixed comparisons include only selected known foes and do not reveal unknown tactics', () => {
  const [a, b, c] = bosses;
  const input = { entries: [{ enemy: a, count: 1 }, { enemy: b, count: 2 }, { enemy: c, count: 0 }], compareIds: [a.id, c.id] };
  const before = structuredClone(input);
  const html = renderBestiary(input);
  assert.equal(occurrences(html, ' foe-windup'), 3);
  assert.equal(occurrences(html, `Windup: ${a.windup.name}`), 2);
  assert.equal(occurrences(html, `Windup: ${b.windup.name}`), 1);
  assert.ok(!html.includes(c.windup.name));
  assert.deepEqual(input, before);
});

test('windup names are escaped in both known views', () => {
  const enemy = structuredClone(bosses[0]);
  enemy.windup.name = '<img src=x onerror="alert(1)"> & \'test\'';
  const html = render(enemy);
  assert.equal(occurrences(html, 'Windup: &lt;img src=x onerror=&quot;alert(1)&quot;&gt; &amp; &#39;test&#39;'), 2);
  assert.ok(!html.includes('<img src=x'));
});

test('invalid windup fields produce no misleading guidance and remain unchanged', () => {
  const valid = bosses[0].windup;
  const invalid = [null, {}, { ...valid, name: '' }, { ...valid, name: '  ' }, { ...valid, name: 4 },
    ...[NaN, Infinity, '0.15', 0, -1, 1.1].map(chance => ({ ...valid, chance })),
    ...[NaN, Infinity, '1.8', 0, -1].map(mult => ({ ...valid, mult }))];
  for (const windup of invalid) {
    const enemy = { ...structuredClone(bosses[0]), windup };
    const before = structuredClone(enemy);
    assert.ok(!render(enemy).includes('foe-windup'));
    assert.deepEqual(enemy, before);
  }
});
