import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guideScene } from '../src/scenes/guide.js';
import { rewardsLine } from '../src/ui/combat.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'After a victory, the outcome panel also lists the experience and gold earned and any items found, in a line such as “+10 XP · +9 gold”.';

test('player guide and in-game guide describe the victory rewards line once', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  const html = guideScene.render({ state: {} });
  assert.equal(md.split(SENTENCE).length - 1, 1);
  assert.equal(html.split(SENTENCE).length - 1, 1);
  assertEggFree(SENTENCE, 'victory rewards guide sentence');
});

test('the documented example matches rewardsLine output', () => {
  const out = rewardsLine({ rewards: { xp: 10, gold: 9, items: [] } });
  assert.ok(out.includes('+10 XP · +9 gold'), out);
});
