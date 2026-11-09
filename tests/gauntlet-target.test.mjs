import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drillsScene, DRILL_FOES, gauntletTargetText } from '../src/scenes/drills.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { featStatus } from '../src/scenes/feats.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const unlock = (n) => Object.fromEntries(DRILL_FOES.slice(0, n).map((id) => [id, 1]));
const N = DRILL_FOES.length;

test('target line is null while the gauntlet is locked', () => {
  assert.equal(gauntletTargetText({ bestiary: unlock(2) }), null);
  assert.equal(gauntletTargetText(null), null);
  assert.equal(gauntletTargetText({}), null);
  assert.ok(!drillsScene.render({ state: { bestiary: unlock(2) } }).includes('drills__gauntlet-target'));
});

test('counts unlocked yard bosses until all are unlocked', () => {
  assert.equal(N, 7);
  const t = gauntletTargetText({ bestiary: unlock(3) });
  assert.equal(t, 'Unbroken Run needs all 7 yard bosses in one run; 3 of 7 are unlocked so far.');
  assertEggFree(t, 'gauntlet target partial');
  assert.equal(gauntletTargetText({ bestiary: unlock(6), drillGauntlet: { runs: 2, best: 6 } }),
    'Unbroken Run needs all 7 yard bosses in one run; 6 of 7 are unlocked so far.');
});

test('shows remaining foes once all are unlocked', () => {
  assert.equal(gauntletTargetText({ bestiary: unlock(N) }), 'Unbroken Run target: beat all 7 foes in one run.');
  assert.equal(gauntletTargetText({ bestiary: unlock(N), drillGauntlet: { runs: 3, best: 4 } }),
    'Unbroken Run target: beat all 7 foes in one run (3 more than your best).');
  assert.equal(gauntletTargetText({ bestiary: unlock(N), drillGauntlet: { runs: 1, best: 'x' } }),
    'Unbroken Run target: beat all 7 foes in one run (7 more than your best).');
  const state = { bestiary: unlock(N), drillGauntlet: { runs: 4, best: 7 } };
  assert.equal(gauntletTargetText(state), 'Unbroken Run earned: all 7 yard bosses beaten in one run.');
  assert.equal(featStatus(state).find((r) => r.id === 'gauntlet').done, true);
});

test('renders after the gauntlet record', () => {
  const html = drillsScene.render({ state: { bestiary: unlock(N), drillGauntlet: { runs: 1, best: 2 } } });
  const rec = html.indexOf('<p class="drill__record">Best run:');
  const tgt = html.indexOf('<p class="drills__gauntlet-target">Unbroken Run target: beat all 7 foes in one run (5 more than your best).</p>');
  const btn = html.indexOf('data-action="startGauntlet"');
  assert.ok(rec > -1 && tgt > rec && btn > tgt);
});

test('guide documents the target line', () => {
  const S = 'Beneath the record, a target line tracks the Unbroken Run feat: until every yard boss is unlocked it counts how many are, and afterwards it shows how many more foes your best run must beat.';
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(S).length - 1, 1);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(S)));
  assertEggFree(S, 'gauntlet target doc');
});
