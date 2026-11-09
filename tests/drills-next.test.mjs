import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DRILL_FOES, drillsNextText, drillsScene } from '../src/scenes/drills.js';
import { ENEMIES } from '../src/data/enemies.js';
import { escapeHTML } from '../src/ui/components.js';
import { guideScene } from '../src/scenes/guide.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const [a, b, c] = DRILL_FOES;
const st = (ids, records = {}) => ({ bestiary: Object.fromEntries(ids.map((id) => [id, 1])), drillRecords: records });

test('drillsNextText is null with no drills unlocked', () => {
  assert.equal(drillsNextText(null), null);
  assert.equal(drillsNextText({}), null);
  assert.equal(drillsNextText(st([])), null);
});

test('drillsNextText names the first unwon unlocked drill', () => {
  assert.equal(drillsNextText(st([a])), `Next drill to try: ${ENEMIES[a].name}.`);
  assert.equal(drillsNextText(st([a, b, c])), `Next drill to try: ${ENEMIES[a].name} (and 2 more not yet won).`);
  assert.equal(drillsNextText(st([a, b, c], { [a]: { wins: 1, best: 4 } })), `Next drill to try: ${ENEMIES[b].name} (and 1 more not yet won).`);
  // malformed records count as unwon
  assert.equal(drillsNextText(st([a], { [a]: { wins: 'x', best: 2 } })), `Next drill to try: ${ENEMIES[a].name}.`);
});

test('drillsNextText names the slowest best once all unlocked drills are won', () => {
  const t = drillsNextText(st([a, b], { [a]: { wins: 2, best: 3 }, [b]: { wins: 1, best: 7 } }));
  assert.equal(t, `Every unlocked drill won. Slowest best: ${ENEMIES[b].name} in 7 rounds — try to beat it.`);
  assert.match(drillsNextText(st([a], { [a]: { wins: 1, best: 1 } })), /in 1 round —/);
  assertEggFree(t, 'drills next');
});

test('drills scene renders the hint only when a drill is unlocked', () => {
  const none = drillsScene.render({ state: st([]) });
  assert.ok(!none.includes('drills__next'));
  const html = drillsScene.render({ state: st([a]) });
  assert.ok(html.includes(`<p class="drills__next">${escapeHTML(`Next drill to try: ${ENEMIES[a].name}.`)}</p>`));
  assert.ok(html.indexOf('drills__summary') < html.indexOf('drills__next'));
});

test('guide documents the drill hint', () => {
  const S = 'Beneath it, a hint names the next unlocked drill you have not yet won or, once all are won, the one with your slowest best time.';
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(S).length - 1, 1);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(S)));
  assertEggFree(S, 'drills guide');
});
