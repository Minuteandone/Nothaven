import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drillsScene, DRILL_FOES, gauntletOrderText, gauntletQueue } from '../src/scenes/drills.js';
import { ENEMIES } from '../src/data/enemies.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const unlock = (ids) => Object.fromEntries(ids.map((id) => [id, 1]));
const SENTENCE = ' Once it opens, a “Bout order:” line lists the unlocked yard bosses in the order the run will face them.';

test('bout order is null while the gauntlet is locked', () => {
  assert.equal(gauntletOrderText(null), null);
  assert.equal(gauntletOrderText({}), null);
  assert.equal(gauntletOrderText({ bestiary: unlock(DRILL_FOES.slice(0, 2)) }), null);
  assert.ok(!drillsScene.render({ state: { bestiary: unlock(DRILL_FOES.slice(0, 2)) } }).includes('drills__gauntlet-order'));
});

test('lists unlocked bosses in queue order, numbered', () => {
  const t = gauntletOrderText({ bestiary: unlock(DRILL_FOES.slice(0, 3)) });
  assert.equal(t, 'Bout order: 1. Tide Wraith · 2. Highwatch Warlord · 3. Drowned Harbormaster.');
  assertEggFree(t, 'gauntlet order');
  const skip = [DRILL_FOES[0], DRILL_FOES[3], DRILL_FOES[6]];
  const state = { bestiary: unlock(skip) };
  assert.deepEqual(gauntletQueue(state), skip);
  assert.equal(gauntletOrderText(state), `Bout order: ${skip.map((id, i) => `${i + 1}. ${ENEMIES[id].name}`).join(' · ')}.`);
  const all = gauntletOrderText({ bestiary: unlock(DRILL_FOES) });
  assert.ok(all.includes(`7. ${ENEMIES[DRILL_FOES[6]].name}`));
  assertEggFree(all, 'gauntlet order full');
});

test('renders once, after the target line and before the begin button', () => {
  const html = drillsScene.render({ state: { bestiary: unlock(DRILL_FOES.slice(0, 4)) } });
  assert.equal(html.split('drills__gauntlet-order').length, 2);
  const i = html.indexOf('drills__gauntlet-order');
  assert.ok(html.indexOf('drills__gauntlet-target') < i);
  assert.ok(i < html.indexOf('startGauntlet'));
  assert.ok(html.includes(escapeHTML(gauntletOrderText({ bestiary: unlock(DRILL_FOES.slice(0, 4)) }))));
});

test('guide sentence documents the bout order line in both guides', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length, 2);
  assert.ok(md.includes('what winning it would set.' + SENTENCE));
  const html = guideScene.render({ state: {} });
  assert.ok(html.includes(escapeHTML(SENTENCE.trim())));
  assertEggFree(SENTENCE, 'gauntlet order guide');
});
