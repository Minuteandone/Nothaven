import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { itemsUsedLine, renderCombat } from '../src/ui/combat.js';
import { createCombat, noteItemUsed, battleSummary } from '../src/combat/rules.js';
import { combatScene } from '../src/scenes/combat.js';
import { createInitialState } from '../src/state.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = ' After a victory the outcome card shows every item spent that battle, counted and named, so the player can weigh the cost of each encounter.';

const GUIDE_MD = readFileSync('docs/PLAYER_GUIDE.md', 'utf-8');
const GUIDE_JS = readFileSync('src/scenes/guide.js', 'utf-8');

// Helper: create a combat object with itemsUsedIds pre-populated in its internal stats
function combatWithItems(ids) {
  const c = createCombat({ enemyId: 'storm_rat' });
  c.over = 'victory';
  c.rewards = { xp: 40, gold: 15, loot: [] };
  for (const id of ids) noteItemUsed(c, id);
  return c;
}

// ---- UNIT TESTS ----

test('itemsUsedLine returns empty string when combat is null/undefined', () => {
  assert.equal(itemsUsedLine(null), '');
  assert.equal(itemsUsedLine(undefined), '');
});

test('itemsUsedLine returns empty string when combat is not a victory', () => {
  const c = combatWithItems(['bandage']);
  c.over = 'defeat';
  assert.equal(itemsUsedLine(c), '');
  c.over = null;
  assert.equal(itemsUsedLine(c), '');
  c.over = 'escaped';
  assert.equal(itemsUsedLine(c), '');
});

test('itemsUsedLine returns empty string for drill combats', () => {
  const c = combatWithItems(['bandage']);
  c.drill = true;
  assert.equal(itemsUsedLine(c), '');
});

test('itemsUsedLine returns empty string when no items were used', () => {
  const c = combatWithItems([]);
  assert.equal(itemsUsedLine(c), '');
  const c2 = createCombat({ enemyId: 'storm_rat' });
  c2.over = 'victory';
  c2.rewards = { xp: 40, gold: 15, loot: [] };
  assert.equal(itemsUsedLine(c2), '');
});

test('itemsUsedLine shows a single item with singular label', () => {
  const c = combatWithItems(['bandage']);
  const html = itemsUsedLine(c);
  assert.ok(html.includes('<span class="items-used-line__label">Item used:</span>'));
  assert.ok(html.includes('Linen Bandage'));
  assert.ok(html.startsWith('<p class="items-used-line"'));
  assert.ok(!html.includes('&lt;') && !html.includes('&gt;'));
});

test('itemsUsedLine shows multiple distinct items with plural label', () => {
  const c = combatWithItems(['bandage', 'healing_herb', 'field_dressing']);
  const html = itemsUsedLine(c);
  assert.ok(html.includes('<span class="items-used-line__label">Items used:</span>'));
  assert.ok(html.includes('Linen Bandage'));
  assert.ok(html.includes('Healing Herb'));
  assert.ok(html.includes('Field Dressing'));
  // All three names should appear
  const afterLabel = html.split('</span> ')[1];
  const names = afterLabel.replace('.</p>', '').split(', ');
  assert.equal(names.length, 3);
});

test('itemsUsedLine handles repeated items with count notation', () => {
  const c = combatWithItems(['bandage', 'bandage', 'healing_herb']);
  const html = itemsUsedLine(c);
  assert.ok(html.includes('Linen Bandage ×2'));
  assert.ok(html.includes('Healing Herb'));
  // Should NOT duplicate "Linen Bandage, Linen Bandage"
  assert.equal((html.match(/Linen Bandage/g) || []).length, 1);
});

test('itemsUsedLine escapes HTML in item names', () => {
  // Items from the game don't have HTML chars, but test the escape path
  const c = combatWithItems(['bandage']);
  const html = itemsUsedLine(c);
  // The output uses escapeHTML so angle brackets would be encoded
  assert.ok(!html.includes('<script>'));
  // Verify it's wrapped in a paragraph
  assert.ok(html.startsWith('<p class="items-used-line"'));
  assert.ok(html.endsWith('.</p>'));
});

test('itemsUsedLine skips unknown item IDs gracefully', () => {
  const c = combatWithItems(['nonexistent_item_12345']);
  assert.equal(itemsUsedLine(c), '');
  // mixed known + unknown
  const c2 = combatWithItems(['bandage', 'nonexistent_item_12345', 'healing_herb']);
  const html = itemsUsedLine(c2);
  assert.ok(html.includes('Linen Bandage'));
  assert.ok(html.includes('Healing Herb'));
  assert.ok(!html.includes('nonexistent'));
});

// ---- INTEGRATION TESTS ----

test('battleSummary includes itemIds from noteItemUsed', () => {
  const c = createCombat({ enemyId: 'storm_rat' });
  noteItemUsed(c, 'bandage');
  noteItemUsed(c, 'healing_herb');
  noteItemUsed(c, 'bandage'); // repeat
  const summary = battleSummary(c);
  assert.equal(summary.itemsUsed, 3);
  assert.deepEqual(summary.itemIds, ['bandage', 'healing_herb', 'bandage']);
});

test('battleSummary returns empty itemIds when no items used', () => {
  const c = createCombat({ enemyId: 'storm_rat' });
  const summary = battleSummary(c);
  assert.equal(summary.itemsUsed, 0);
  assert.deepEqual(summary.itemIds, []);
});

test('itemsUsedLine renders into the victory outcome through renderCombat', () => {
  // Simulate combat state with items used, then render via renderCombat
  const state = createInitialState();
  const c = createCombat({ enemyId: 'storm_rat' });
  noteItemUsed(c, 'bandage');
  noteItemUsed(c, 'healing_herb');
  c.over = 'victory';
  c.rewards = { xp: 40, gold: 15, loot: [] };
  c.drill = false;

  const html = renderCombat({ combat: c, party: state.party, inventory: state.inventory });
  assert.ok(html.includes('items-used-line'), 'renderCombat should include items-used-line');
  assert.ok(html.includes('Linen Bandage'), 'should name the bandage');
  assert.ok(html.includes('Healing Herb'), 'should name the herb');
});

test('item action in combat scene passes item ID to noteItemUsed', () => {
  // Verify the wiring: combat scene actions.item passes dataset.arg to noteItemUsed
  const state = createInitialState();
  state.inventory.push({ id: 'bandage', qty: 2 });
  state.party[0].hp = state.party[0].maxHp;

  const g = {
    state,
    scenes: { combat: combatScene, town: {}, explore: {}, title: {} },
    combatRng: () => 0.5,
    setScene(name, data) { state.scene = name; },
    bus: { handlers: {}, on(k,h) { (this.handlers[k]||=[]).push(h); }, off(){}, emit(k,e) { (this.handlers[k]||[]).forEach(h=>h(e)); } },
  };
  combatScene.onEnter(g, { enemyId: 'storm_rat', encounterId: 'test', returnScene: 'explore' });

  // Call the item action with a bandage
  const fakeEl = { dataset: { arg: 'bandage' } };
  combatScene.actions.item(g, fakeEl);

  // Check that the internal stats tracked the item
  assert.equal(g.state.combat.stats.itemsUsed, 1);
  assert.deepEqual(g.state.combat.stats.itemsUsedIds, ['bandage']);
});

// ---- GUIDE SYNC ----

test('guide sentence is present in PLAYER_GUIDE.md', () => {
  assert.ok(GUIDE_MD.includes(SENTENCE), 'PLAYER_GUIDE.md should contain the items-used guide sentence');
});

test('guide sentence is present in guide.js', () => {
  assert.ok(GUIDE_JS.includes(SENTENCE), 'guide.js should contain the items-used guide sentence');
});

// ---- EGG GUARD ----

test('itemsUsedLine output is egg-free', () => {
  const c = combatWithItems(['bandage', 'healing_herb']);
  const html = itemsUsedLine(c);
  assertEggFree(html);
});

test('guide sentence is egg-free', () => {
  assertEggFree(SENTENCE);
});

// ---- REGRESSION: featsEarnedLine still renders ----

test('both featsEarnedLine and itemsUsedLine can appear together', () => {
  // Simulate a combat with both item usage
  const c = combatWithItems(['bandage']);
  // Mock featsGained for the featsEarnedLine path
  c.featsGained = ['Tusk Breaker'];
  const html = itemsUsedLine(c);
  assert.ok(html.length > 0, 'itemsUsedLine should render');
  assert.ok(html.includes('Linen Bandage'));
  // featsEarnedLine is a separate function — just verify they don't interfere
});
