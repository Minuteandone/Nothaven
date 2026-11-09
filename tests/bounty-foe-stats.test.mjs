import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bountiesScene } from '../src/scenes/bounties.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { createInitialState } from '../src/state.js';
import { BOUNTIES } from '../src/core/bounties.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function render(setup) {
  const s = createInitialState();
  s.scene = 'bounties'; s.combat = null;
  setup(s);
  const game = { state: s, setScene() {} };
  bountiesScene.onEnter(game);
  return bountiesScene.render(game);
}

test('posted notices show the target stats and element at the current difficulty', () => {
  let html = render((s) => { s.bestiary = { storm_rat: 1 }; });
  assert.match(html, /<p class="bounty__foe-stats">Foe at Standard: 12 HP · 4 attack · 1 defense · 4 speed\.<\/p>/);
  assert.match(html, /<p class="bounty__foe-element">No element: every skill hits it at normal strength\.<\/p>/);
  assert.equal((html.match(/class="bounty__foe-stats"/g) || []).length, 1, 'only the posted notice shows stats');
  assertEggFree(html, 'bounty foe stats');
  html = render((s) => { s.bestiary = { storm_rat: 1 }; s.settings = { ...(s.settings || {}), difficulty: 'veteran' }; });
  assert.match(html, /Foe at Veteran: 16 HP · 5 attack · 1 defense · 4 speed\./);
});

test('every posted notice gets exactly one stats line and unposted notices get none', () => {
  const html = render((s) => { s.bestiary = Object.fromEntries(BOUNTIES.map((b) => [b.enemyId, 1])); });
  assert.equal((html.match(/class="bounty__foe-stats"/g) || []).length, BOUNTIES.length);
  assert.equal((html.match(/class="bounty__foe-element"/g) || []).length, BOUNTIES.length);
  const none = render((s) => { s.bestiary = {}; });
  assert.doesNotMatch(none, /bounty__foe-(stats|element)/);
});

test('the guide documents the bounty foe stats line', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  const sentence = 'Each posted notice also shows its target’s health, attack, defense and speed at your current difficulty, and its element with the skill elements that hit it harder or are resisted.';
  assert.equal(md.split(sentence).length - 1, 1);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(sentence)));
  assertEggFree(sentence, 'bounty foe stats doc');
});
