import test from 'node:test';
import assert from 'node:assert/strict';
import { elementalMatchupBanner } from '../src/ui/combat.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('elementalMatchupBanner returns empty for hero with no elemental skills (level 1)', () => {
  const hero = { level: 1 };
  const enemy = { element: 'fire' };
  assert.equal(elementalMatchupBanner(hero, enemy), '');
});

test('elementalMatchupBanner returns empty for enemy with no element', () => {
  const hero = { level: 20 };
  const enemy = { element: null };
  assert.equal(elementalMatchupBanner(hero, enemy), '');
});

test('elementalMatchupBanner returns empty for null hero', () => {
  assert.equal(elementalMatchupBanner(null, { element: 'fire' }), '');
});

test('elementalMatchupBanner returns empty for null enemy', () => {
  assert.equal(elementalMatchupBanner({ level: 20 }, null), '');
});

test('elementalMatchupBanner shows all three categories vs ice enemy (fire strong, lightning weak, ice neutral)', () => {
  const hero = { level: 20 };
  const enemy = { element: 'ice' };
  const result = elementalMatchupBanner(hero, enemy);
  assert.ok(result.includes('matchup-strong'), 'fire skills should be strong vs ice');
  assert.ok(result.includes('matchup-weak'), 'lightning skills should be weak vs ice');
  assert.ok(result.includes('matchup-neutral'), 'ice/earth skills should be neutral vs ice');
  assert.ok(result.includes('1.5'), 'should show 1.5x for strong');
  assert.ok(result.includes('0.75'), 'should show 0.75x for weak');
});

test('elementalMatchupBanner vs fire enemy (ice weak, lightning and fire neutral)', () => {
  const hero = { level: 20 };
  const enemy = { element: 'fire' };
  const result = elementalMatchupBanner(hero, enemy);
  assert.ok(result.includes('matchup-weak'), 'ice skills should be weak vs fire');
  assert.ok(result.includes('matchup-neutral'), 'lightning and fire skills should be neutral vs fire');
  assert.ok(result.includes('0.75'), 'should show 0.75x for weak');
  assert.ok(!result.includes('matchup-strong'), 'no skills are strong vs fire (no water at level 20)');
  assert.ok(!result.includes('1.5'), '1.5x should not appear (no strong skills vs fire)');
});

test('elementalMatchupBanner vs water enemy (lightning strong, fire weak, ice neutral)', () => {
  const hero = { level: 20 };
  const enemy = { element: 'water' };
  const result = elementalMatchupBanner(hero, enemy);
  assert.ok(result.includes('matchup-strong'), 'lightning skills should be strong vs water');
  assert.ok(result.includes('matchup-weak'), 'fire skills should be weak vs water');
});

test('elementalMatchupBanner renders clean banner without ARIA attributes', () => {
  const hero = { level: 20 };
  const enemy = { element: 'ice' };
  const result = elementalMatchupBanner(hero, enemy);
  assert.ok(result.startsWith('<div class="elemental-matchup-banner">'), 'should start with banner div');
  assert.ok(!result.includes('role='), 'should not have role attribute');
  assert.ok(!result.includes('aria-label='), 'should not have aria-label');
  assert.ok(result.includes('matchup-strong'), 'should have matchup classes');
});

test('elementalMatchupBanner is egg-free for all outputs', () => {
  const hero = { level: 20 };
  for (const element of ['fire', 'ice', 'lightning', 'water', 'earth']) {
    const result = elementalMatchupBanner(hero, { element });
    assertEggFree(result, 'elementalMatchupBanner vs ' + element);
  }
  // Empty cases
  assertEggFree(elementalMatchupBanner(hero, { element: null }), 'elementalMatchupBanner null element');
  assertEggFree(elementalMatchupBanner({ level: 1 }, { element: 'fire' }), 'elementalMatchupBanner no skills');
});
