import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { guideScene } from '../src/scenes/guide.js';
import { getFieldPackSummary } from '../src/map/mapState.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'The Field Pack’s Pack manifest counts nonempty stacks and individual items, breaks down consumables, materials, equipment and key items, and lists the recipes currently ready to craft; reading it never changes supplies.';

test('both guides explain the Field Pack manifest exactly once', () => {
  const markdown = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  const html = guideScene.render({ state: {} });
  assert.equal(markdown.split(SENTENCE).length - 1, 1);
  assert.equal(html.split(escapeHTML(SENTENCE)).length - 1, 1);
  assertEggFree(SENTENCE, 'Field Pack manifest guide sentence');
});

test('the documented manifest facts match the real read-only helper', () => {
  const state = { inventory: [
    { id: 'bandage', qty: 2 },
    { id: 'scrap_metal', qty: 1 },
    { id: 'iron_sword', qty: 1 },
    { id: 'observatory_lens', qty: 1 },
  ] };
  const snapshot = JSON.stringify(state);
  const result = getFieldPackSummary(state);
  assert.equal(result.totalStacks, 4);
  assert.equal(result.totalUnits, 5);
  assert.equal(result.consumableUnits, 2);
  assert.equal(result.materialUnits, 1);
  assert.equal(result.equipmentUnits, 1);
  assert.equal(result.keyUnits, 1);
  assert.deepEqual(result.craftableNames, ['Pack a Field Dressing']);
  assert.match(result.summary, /4 stacks \(5 items\)/);
  assert.match(result.summary, /2 consumables · 1 material · 1 equipment · 1 key item/);
  assert.match(result.summary, /Craft ready: 1 \(Pack a Field Dressing\)/);
  assert.equal(JSON.stringify(state), snapshot);
  assertEggFree(result.summary, 'Field Pack manifest helper summary');
});
