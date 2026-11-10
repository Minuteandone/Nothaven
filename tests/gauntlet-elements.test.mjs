import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drillsScene, DRILL_FOES, gauntletElementsText, gauntletQueue } from '../src/scenes/drills.js';
import { ENEMIES } from '../src/data/enemies.js';
import { elementMatchups } from '../src/combat/elements.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const unlock = (ids) => Object.fromEntries(ids.map((id) => [id, 1]));
const SENTENCE = ' Beneath it, a “Bout elements:” line counts how many of those bouts each skill element hits harder or is resisted by, so you can plan which skills to lean on.';

test('bout elements is null while the gauntlet is locked', () => {
  assert.equal(gauntletElementsText(null), null);
  assert.equal(gauntletElementsText({}), null);
  assert.equal(gauntletElementsText({ bestiary: unlock(DRILL_FOES.slice(0, 2)) }), null);
  assert.ok(!drillsScene.render({ state: { bestiary: unlock(DRILL_FOES.slice(0, 2)) } }).includes('drills__gauntlet-elements'));
});

test('counts strong and resisted bouts for the first three and all seven', () => {
  assert.equal(gauntletElementsText({ bestiary: unlock(DRILL_FOES.slice(0, 3)) }),
    'Bout elements: Lightning skills hit 2 of 3 bouts harder · Fire skills are resisted in 2 of 3.');
  assert.equal(gauntletElementsText({ bestiary: unlock(DRILL_FOES) }),
    'Bout elements: Ice skills hit 2 of 7 bouts harder · Lightning skills hit 3 of 7 bouts harder · Fire skills are resisted in 3 of 7 · Water skills are resisted in 2 of 7.');
  assert.equal(gauntletElementsText({ bestiary: unlock(['pass_warlord', 'relay_warden', 'tide_wraith']) }),
    'Bout elements: Lightning skills hit 1 of 3 bouts harder · Fire skills are resisted in 1 of 3.');
});

test('counts agree with elementMatchups for every 3+ subset of drill foes', () => {
  const n = DRILL_FOES.length;
  for (let mask = 0; mask < (1 << n); mask += 1) {
    const ids = DRILL_FOES.filter((_, i) => mask & (1 << i));
    const state = { bestiary: unlock(ids) };
    const text = gauntletElementsText(state);
    const queue = gauntletQueue(state);
    if (queue.length < 3) { assert.equal(text, null); continue; }
    for (const el of ['fire', 'ice', 'lightning', 'water']) {
      const label = el[0].toUpperCase() + el.slice(1);
      const s = queue.filter((id) => elementMatchups(ENEMIES[id].element).strong.includes(el)).length;
      const r = queue.filter((id) => elementMatchups(ENEMIES[id].element).resist.includes(el)).length;
      assert.equal(text.includes(`${label} skills hit ${s} of ${queue.length} bouts harder`), s > 0);
      assert.equal(text.includes(`${label} skills are resisted in ${r} of ${queue.length}`), r > 0);
    }
  }
});

test('renders after the bout order line and before Begin; guides carry the sentence', () => {
  const html = drillsScene.render({ state: { bestiary: unlock(DRILL_FOES) } });
  const order = html.indexOf('drills__gauntlet-order');
  const el = html.indexOf('drills__gauntlet-elements');
  assert.ok(order > -1 && el > order);
  assert.ok(html.indexOf('Ice skills hit 2 of 7') > el);
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length, 2);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(SENTENCE)));
  assertEggFree(SENTENCE);
  assertEggFree(gauntletElementsText({ bestiary: unlock(DRILL_FOES) }));
});
