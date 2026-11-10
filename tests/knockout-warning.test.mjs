import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCombat, knockoutWarning } from '../src/ui/combat.js';
import { createCombat } from '../src/combat/rules.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function setup({ hp = 100, atk = 20, windup = false, warded = false, name = 'Wren' } = {}) {
  const hero = { id: 'hero', name, level: 2, hp, maxHp: 100, mp: 30, maxMp: 30, atk: 8, def: 3, spd: 6, statuses: [] };
  const combat = createCombat({ enemyId: 'storm_rat' });
  combat.enemy.atk = atk;
  if (windup) {
    combat.enemy.windup = { name: 'Crush', mult: 2 };
    combat.windup = { name: 'Crush' };
  }
  if (warded) combat.defending = true;
  return { hero, combat };
}

test('no warning while the top of the estimate stays below current HP', () => {
  // atk 20 − def 3 = 17 → basic 16–19
  const { hero, combat } = setup({ hp: 20 });
  assert.equal(knockoutWarning(combat, hero), '');
});

test('basic hit that could reach current HP suggests healing or Defend', () => {
  const { hero, combat } = setup({ hp: 19 });
  assert.equal(knockoutWarning(combat, hero),
    '<p class="knockout-warning"><span class="knockout-warning__label">Knockout risk:</span> A basic hit could knock out Wren (19 HP left). Heal or Defend this turn.</p>');
});

test('halved basic hit still lethal suggests healing', () => {
  const { hero, combat } = setup({ hp: 9, warded: true });
  assert.ok(knockoutWarning(combat, hero).includes('Even halved, a basic hit could knock out Wren (9 HP left). Heal this turn.'));
  assert.equal(knockoutWarning(setup({ hp: 10, warded: true }).combat, setup({ hp: 10 }).hero), '');
});

test('unleashed windup names the guard and break answers', () => {
  // floor(20×2) − 3 = 37 → 36–39
  const { hero, combat } = setup({ hp: 39, windup: true });
  assert.ok(knockoutWarning(combat, hero).includes('Unleashed Crush could knock out Wren (39 HP left). Defend or a ward halves it; a stun or Stillpoint Strike breaks it.'));
  const safe = setup({ hp: 40, windup: true });
  assert.equal(knockoutWarning(safe.combat, safe.hero), '');
});

test('halved windup still lethal suggests healing or breaking it', () => {
  const { hero, combat } = setup({ hp: 19, windup: true, warded: true });
  assert.ok(knockoutWarning(combat, hero).includes('Even halved, Crush could knock out Wren (19 HP left). Heal before it lands, or break it with a stun or Stillpoint Strike.'));
});

test('names are escaped and downed or missing heroes produce nothing', () => {
  const { hero, combat } = setup({ hp: 5, name: 'Wren <b>&' });
  const html = knockoutWarning(combat, hero);
  assert.ok(html.includes('Wren &lt;b&gt;&amp; (5 HP left)'));
  assert.doesNotMatch(html, /<b>/);
  assert.equal(knockoutWarning(combat, { ...hero, hp: 0 }), '');
  assert.equal(knockoutWarning(combat, null), '');
  assert.equal(knockoutWarning(null, hero), '');
});

test('combat render shows the warning only when at risk, and copy is egg-free', () => {
  const risky = setup({ hp: 10 });
  const html = renderCombat({ combat: risky.combat, party: [risky.hero], inventory: [], menu: 'main' });
  assert.equal(html.split('class="knockout-warning"').length - 1, 1);
  const safe = setup({ hp: 100 });
  assert.ok(!renderCombat({ combat: safe.combat, party: [safe.hero], inventory: [], menu: 'main' }).includes('knockout-warning'));
  for (const s of [setup({ hp: 1 }), setup({ hp: 1, warded: true }), setup({ hp: 1, windup: true }), setup({ hp: 1, windup: true, warded: true })]) {
    assertEggFree(knockoutWarning(s.combat, s.hero), 'knockout warning');
  }
});
