import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { fleeChance } from '../src/combat/rules.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = ' Outside boss fights, the Flee button shows your current escape odds as a percentage: they start at 50% and move 10% for each point of speed you have above or below the foe, up to 90%.';

test('guide documents flee odds once in PLAYER_GUIDE and the in-game guide', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  const html = guideScene.render({ state: {} });
  assert.equal(html.split(escapeHTML(SENTENCE)).length - 1, 1);
  assertEggFree(SENTENCE, 'flee odds sentence');
});

test('flee odds sentence matches fleeChance: 50% base, 10% per speed point, 90% cap, none for bosses', () => {
  const hero = { id: 'wren', name: 'Wren', hp: 30, maxHp: 30, mp: 10, atk: 6, def: 3, spd: 5, level: 1 };
  const at = spd => fleeChance({ enemy: { id: 'x', spd } }, hero);
  const base = at(5);
  assert.ok(Math.abs(base - 0.5) < 1e-9);
  assert.ok(Math.abs(at(4) - base - 0.1) < 1e-9);
  assert.ok(Math.abs(at(-20) - 0.9) < 1e-9);
  assert.equal(fleeChance({ enemy: { id: 'b', spd: 1, boss: true } }, hero), null);
});
