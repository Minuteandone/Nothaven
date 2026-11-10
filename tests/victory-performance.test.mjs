import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { performanceLine, renderCombat } from '../src/ui/combat.js';
import { createCombat } from '../src/combat/rules.js';
import { createInitialState } from '../src/state.js';
import { combatScene } from '../src/scenes/combat.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = ' After a victory the outcome card rates the performance from Flawless down to Victory by a thread based on how much of your health you lost, so you can gauge whether the fight was close or comfortable.';

const GUIDE_MD = readFileSync('docs/PLAYER_GUIDE.md', 'utf-8');
const GUIDE_JS = readFileSync('src/scenes/guide.js', 'utf-8');

// Helper: create a combat set to victory with a hero at given hp/maxHp
function combatWithHero(hp, maxHp) {
  const c = createCombat({ enemyId: 'storm_rat' });
  c.over = 'victory';
  c.rewards = { xp: 40, gold: 15, loot: [] };
  const hero = { hp, maxHp };
  return { combat: c, hero };
}

// ---- GATING TESTS ----

test('performanceLine returns empty string when combat is null/undefined', () => {
  assert.equal(performanceLine(null), '');
  assert.equal(performanceLine(undefined), '');
});

test('performanceLine returns empty string for non-victory outcomes', () => {
  const { combat: c } = combatWithHero(100, 100);
  c.over = 'defeat';
  assert.equal(performanceLine(c, { hp: 100, maxHp: 100 }), '');
  c.over = 'escaped';
  assert.equal(performanceLine(c, { hp: 100, maxHp: 100 }), '');
  c.over = null;
  assert.equal(performanceLine(c, { hp: 100, maxHp: 100 }), '');
});

test('performanceLine returns empty string for drill combats', () => {
  const { combat: c } = combatWithHero(100, 100);
  c.drill = true;
  assert.equal(performanceLine(c, { hp: 100, maxHp: 100 }), '');
});

test('performanceLine returns empty string when hero has no maxHp', () => {
  const { combat: c } = combatWithHero(100, 100);
  assert.equal(performanceLine(c, { hp: 50 }), '');
  assert.equal(performanceLine(c, { hp: 50, maxHp: 0 }), '');
});

// ---- QUALITY TIER TESTS ----

test('performanceLine shows Flawless when no damage taken', () => {
  const { combat: c } = combatWithHero(100, 100);
  const html = performanceLine(c, { hp: 100, maxHp: 100 });
  assert.ok(html.includes('Flawless \u2014 no blows landed.'));
  assert.ok(html.includes('<span class="performance-line__label">Performance:</span>'));
});

test('performanceLine shows Clean win for less than 25% damage', () => {
  const { combat: c } = combatWithHero(85, 100);
  const html = performanceLine(c, { hp: 85, maxHp: 100 });
  assert.ok(html.includes('Clean win.'));
});

test('performanceLine shows Hard-fought for 25-50% damage', () => {
  const { combat: c } = combatWithHero(65, 100);
  const html = performanceLine(c, { hp: 65, maxHp: 100 });
  assert.ok(html.includes('Hard-fought.'));
});

test('performanceLine shows Costly victory for 50-75% damage', () => {
  const { combat: c } = combatWithHero(40, 100);
  const html = performanceLine(c, { hp: 40, maxHp: 100 });
  assert.ok(html.includes('Costly victory.'));
});

test('performanceLine shows Victory by a thread for 75%+ damage', () => {
  const { combat: c } = combatWithHero(10, 100);
  const html = performanceLine(c, { hp: 10, maxHp: 100 });
  assert.ok(html.includes('Victory by a thread.'));
});

// ---- BOUNDARY TESTS ----

test('performanceLine boundary: exactly 25% damage is Hard-fought', () => {
  const { combat: c } = combatWithHero(75, 100);
  const html = performanceLine(c, { hp: 75, maxHp: 100 });
  assert.ok(html.includes('Hard-fought.'));
});

test('performanceLine boundary: exactly 50% damage is Costly', () => {
  const { combat: c } = combatWithHero(50, 100);
  const html = performanceLine(c, { hp: 50, maxHp: 100 });
  assert.ok(html.includes('Costly victory.'));
});

test('performanceLine boundary: exactly 75% damage is Thread', () => {
  const { combat: c } = combatWithHero(25, 100);
  const html = performanceLine(c, { hp: 25, maxHp: 100 });
  assert.ok(html.includes('Victory by a thread.'));
});

// ---- STRUCTURE TEST ----

test('performanceLine has correct CSS class and label span', () => {
  const { combat: c } = combatWithHero(90, 100);
  const html = performanceLine(c, { hp: 90, maxHp: 100 });
  assert.ok(html.startsWith('<p class="performance-line"'));
  assert.ok(html.includes('<span class="performance-line__label">Performance:</span>'));
  assert.ok(html.endsWith('.</p>'));
});

// ---- INTEGRATION TESTS ----

test('performanceLine renders through renderCombat in victory outcome', () => {
  const state = createInitialState();
  const c = createCombat({ enemyId: 'storm_rat' });
  c.over = 'victory';
  c.rewards = { xp: 40, gold: 15, loot: [] };
  c.drill = false;
  state.party[0].hp = 70;
  state.party[0].maxHp = 100;

  const html = renderCombat({ combat: c, party: state.party, inventory: state.inventory });
  assert.ok(html.includes('performance-line'), 'renderCombat should include performance-line');
  assert.ok(html.includes('Hard-fought'), 'should show Hard-fought for 30% damage');
});

test('performanceLine does NOT render through renderCombat for drill', () => {
  const state = createInitialState();
  const c = createCombat({ enemyId: 'storm_rat' });
  c.over = 'victory';
  c.rewards = { xp: 40, gold: 15, loot: [] };
  c.drill = true;
  state.party[0].hp = 70;
  state.party[0].maxHp = 100;

  const html = renderCombat({ combat: c, party: state.party, inventory: state.inventory });
  assert.ok(!html.includes('performance-line'), 'drill should not show performance-line');
});

// ---- GUIDE SYNC ----

test('performance guide sentence is present in PLAYER_GUIDE.md', () => {
  assert.ok(GUIDE_MD.includes(SENTENCE), 'PLAYER_GUIDE.md should contain the performance guide sentence');
});

test('performance guide sentence is present in guide.js', () => {
  assert.ok(GUIDE_JS.includes(SENTENCE), 'guide.js should contain the performance guide sentence');
});

// ---- EGG GUARD ----

test('performanceLine output is egg-free', () => {
  const { combat: c } = combatWithHero(85, 100);
  const html = performanceLine(c, { hp: 85, maxHp: 100 });
  assertEggFree(html);
});

test('performance guide sentence is egg-free', () => {
  assertEggFree(SENTENCE);
});
