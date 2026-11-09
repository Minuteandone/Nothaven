import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DRILL_FOES, drillStatsText, drillsScene } from '../src/scenes/drills.js';
import { escapeHTML } from '../src/ui/components.js';
import { guideScene } from '../src/scenes/guide.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('drillStatsText reports stats at the current difficulty', () => {
  assert.equal(drillStatsText({}, 'tide_wraith'), 'Foe at Standard: 50 HP · 10 attack · 4 defense · 6 speed.');
  assert.equal(drillStatsText({ settings: { difficulty: 'stormborn' } }, 'tide_wraith'), 'Foe at Stormborn: 80 HP · 14 attack · 4 defense · 6 speed.');
  assert.equal(drillStatsText({ settings: { difficulty: 'story' } }, 'last_squall'), 'Foe at Story: 1125 HP · 35 attack · 13 defense · 8 speed.');
  assert.equal(drillStatsText({ settings: { difficulty: 'bogus' } }, 'pass_warlord'), 'Foe at Standard: 96 HP · 13 attack · 6 defense · 5 speed.');
  assert.equal(drillStatsText({}, 'toString'), '');
  assert.equal(drillStatsText({}, undefined), '');
  for (const id of DRILL_FOES) assertEggFree(drillStatsText({}, id), id);
});

test('only unlocked drills render the stats line', () => {
  const [a] = DRILL_FOES;
  const html = drillsScene.render({ state: { bestiary: { [a]: 1 } }, drillsMessage: '' });
  assert.equal((html.match(/class="drill__stats"/g) || []).length, 1);
  assert.ok(html.includes(`<p class="drill__stats">${escapeHTML(drillStatsText({}, a))}</p>`));
  const none = drillsScene.render({ state: {}, drillsMessage: '' });
  assert.equal((none.match(/class="drill__stats"/g) || []).length, 0);
});

test('guide documents the drill stats line in both copies', () => {
  const sentence = 'A line beneath it lists the foe’s health, attack, defense and speed at your current difficulty (for example “Foe at Standard: 50 HP · 10 attack · 4 defense · 6 speed.”).';
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(sentence).length - 1, 1);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(sentence)));
  assertEggFree(sentence, 'drill stats doc');
});
