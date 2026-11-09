import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DRILL_FOES, drillElementText, drillsScene } from '../src/scenes/drills.js';
import { ENEMIES } from '../src/data/enemies.js';
import { escapeHTML } from '../src/ui/components.js';
import { guideScene } from '../src/scenes/guide.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('drillElementText describes each element case', () => {
  assert.equal(drillElementText('tide_wraith'), 'Element: Water. Lightning skills hit it harder; Fire skills are resisted.');
  assert.equal(drillElementText('stormcrown_tyrant'), 'Element: Lightning. Ice skills hit it harder; Water skills are resisted.');
  assert.equal(drillElementText('relay_warden'), 'Element: Earth. Every skill hits it at normal strength.');
  assert.equal(drillElementText('pass_warlord'), 'No element: every skill hits it at normal strength.');
  assert.equal(drillElementText('toString'), 'No element: every skill hits it at normal strength.');
  assert.equal(drillElementText(undefined), 'No element: every skill hits it at normal strength.');
  for (const id of DRILL_FOES) assertEggFree(drillElementText(id), id);
});

test('only unlocked drills render the element line', () => {
  const [a, b] = DRILL_FOES;
  const game = { state: { bestiary: { [a]: 1 } }, drillsMessage: '' };
  const html = drillsScene.render(game);
  assert.equal((html.match(/class="drill__element"/g) || []).length, 1);
  assert.ok(html.includes(`<p class="drill__element">${escapeHTML(drillElementText(a))}</p>`));
  assert.ok(ENEMIES[b]);
  const none = drillsScene.render({ state: {}, drillsMessage: '' });
  assert.equal((none.match(/class="drill__element"/g) || []).length, 0);
});

test('both guides document the element line', () => {
  const s = ' Each unlocked drill also names its foe’s element and which skill elements hit it harder or are resisted (for example “Element: Water. Lightning skills hit it harder; Fire skills are resisted.”).';
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(s).length - 1, 1);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(s)));
  assertEggFree(s, 'drill element doc');
});
