import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ELEMENTS, elementMultiplier, elementLabel, elementClass, elementEffectivenessText, elementMatchups,
} from '../src/combat/elements.js';
import { SKILLS, createCombat, heroAction, companionTurn } from '../src/combat/rules.js';
import { createCompanionMember } from '../src/party/companions.js';
import { ENEMIES } from '../src/data/enemies.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const fixed = (v) => () => v;

// --- Unit: elementMultiplier -------------------------------------------------

test('elemental pentagram: each element is strong against its clockwise successor', () => {
  // Fire > Ice > Lightning > Water > Fire
  assert.equal(elementMultiplier('fire', 'ice'), 1.5);
  assert.equal(elementMultiplier('ice', 'lightning'), 1.5);
  assert.equal(elementMultiplier('lightning', 'water'), 1.5);
  assert.equal(elementMultiplier('water', 'fire'), 1.5);
});

test('elemental pentagram: each element is weak against its counter', () => {
  // Fire < Water, Ice < Fire, Lightning < Ice, Water < Lightning
  assert.equal(elementMultiplier('fire', 'water'), 0.75);
  assert.equal(elementMultiplier('ice', 'fire'), 0.75);
  assert.equal(elementMultiplier('lightning', 'ice'), 0.75);
  assert.equal(elementMultiplier('water', 'lightning'), 0.75);
});

test('earth is neutral in every direction', () => {
  for (const other of ['fire', 'ice', 'lightning', 'water', 'earth']) {
    assert.equal(elementMultiplier('earth', other), 1.0, `earth vs ${other}`);
    assert.equal(elementMultiplier(other, 'earth'), 1.0, `${other} vs earth`);
  }
});

test('missing or unknown elements resolve to neutral 1.0', () => {
  assert.equal(elementMultiplier(null, 'fire'), 1.0);
  assert.equal(elementMultiplier('fire', null), 1.0);
  assert.equal(elementMultiplier(undefined, undefined), 1.0);
  assert.equal(elementMultiplier('void', 'fire'), 1.0);
  assert.equal(elementMultiplier('fire', 'void'), 1.0);
  assert.equal(elementMultiplier('fire', 'fire'), 1.0);
});

// --- Unit: label / class / effectiveness text --------------------------------

test('elementLabel renders friendly names and blanks unknown values', () => {
  assert.equal(elementLabel('fire'), 'Fire');
  assert.equal(elementLabel('ice'), 'Ice');
  assert.equal(elementLabel('lightning'), 'Lightning');
  assert.equal(elementLabel('water'), 'Water');
  assert.equal(elementLabel('earth'), 'Earth');
  assert.equal(elementLabel('void'), '');
  assert.equal(elementLabel(undefined), '');
});

test('elementClass returns a suffix only for known elements', () => {
  assert.equal(elementClass('fire'), 'element--fire');
  assert.equal(elementClass('ICE'), 'element--ice');
  assert.equal(elementClass('earth'), 'element--earth');
  assert.equal(elementClass('void'), '');
  assert.equal(elementClass(undefined), '');
});

test('elementEffectivenessText classifies strong, weak, neutral and empty', () => {
  assert.equal(elementEffectivenessText('fire', 'ice'), 'strong');
  assert.equal(elementEffectivenessText('water', 'fire'), 'strong');
  assert.equal(elementEffectivenessText('fire', 'water'), 'weak');
  assert.equal(elementEffectivenessText('ice', 'fire'), 'weak');
  assert.equal(elementEffectivenessText('fire', 'lightning'), 'neutral');
  assert.equal(elementEffectivenessText('fire', 'earth'), '');
  assert.equal(elementEffectivenessText(null, 'fire'), '');
  assert.equal(elementEffectivenessText('fire', null), '');
  assert.equal(elementEffectivenessText(undefined, undefined), '');
});

// --- Integration: heroAction applies multipliers and logs the outcome --------

const member = (extra = {}) => ({
  id: 'hero', name: 'Wren', level: 20, hp: 150, maxHp: 150, mp: 60, maxMp: 60,
  atk: 40, def: 10, spd: 5, statuses: [], equipment: {}, ...extra,
});

test('a super-effective skill multiplies damage and notes it in the log', () => {
  const hero = member();
  const c = createCombat({ enemyId: 'storm_heart' }); // lightning; ice is strong
  c.enemy.hp = 9999;
  const before = c.enemy.hp;
  const r = heroAction(c, hero, { type: 'skill', skillId: 'stillpoint_strike' }, () => 0.5, [hero]);
  assert.equal(r.ok, true);
  assert.ok(r.lines.some((l) => l.includes("It's super effective!")));
  const dealt = before - c.enemy.hp;
  assert.ok(dealt > 0);
  assert.equal(dealt % 1, 0, 'damage stays an integer after flooring');
});

test('a not-very-effective skill reduces damage and notes it in the log', () => {
  const hero = member();
  const c = createCombat({ enemyId: 'last_squall' }); // water; fire is weak
  c.enemy.hp = 9999;
  const before = c.enemy.hp;
  const r = heroAction(c, hero, { type: 'skill', skillId: 'skyfire_lance' }, () => 0.5, [hero]);
  assert.equal(r.ok, true);
  assert.ok(r.lines.some((l) => l.includes("It's not very effective")));
  assert.ok(before - c.enemy.hp > 0);
});

test('basic attacks carry no element and stay neutral against elemental foes', () => {
  const hero = member();
  const c = createCombat({ enemyId: 'frost_wolf' }); // ice; a plain strike has no element
  const r = heroAction(c, hero, { type: 'attack' }, () => 0.5, [hero]);
  assert.equal(r.ok, true);
  assert.ok(!r.lines.some((l) => /super effective|not very effective/.test(l)),
    'no effectiveness note for an untyped attack');
});

// --- Integration: every declared element is a known value --------------------

test('every skill element is a declared ELEMENTS value', () => {
  for (const [id, sk] of Object.entries(SKILLS)) {
    if (sk.element) {
      assert.ok(Object.values(ELEMENTS).includes(sk.element), `${id} uses valid element ${sk.element}`);
    }
  }
});

test('every enemy element is a declared ELEMENTS value', () => {
  for (const [id, e] of Object.entries(ENEMIES)) {
    if (e.element) {
      assert.ok(Object.values(ELEMENTS).includes(e.element), `${id} uses valid element ${e.element}`);
    }
  }
});

test('elemental labels and notes are egg-free', () => {
  const sample = Object.values(ELEMENTS)
    .map((el) => `${elementLabel(el)} ${elementClass(el)}`)
    .join(' ');
  assertEggFree(sample);
  assertEggFree("It's super effective! It's not very effective");
});

// --- Integration: UI renders element chips -----------------------------------

import { renderCombat } from '../src/ui/combat.js';

const uiHero = { id: 'hero', name: 'Wren', level: 5, hp: 28, maxHp: 36, mp: 12, maxMp: 16, atk: 6, def: 3, spd: 5, statuses: [], equipment: {} };

test('enemy element renders as a chip and skill cards show effectiveness', () => {
  const combat = createCombat({ enemyId: 'frost_wolf' }); // ice
  const enemyHtml = renderCombat({ combat, party: [uiHero], inventory: [], menu: 'main' });
  assert.match(enemyHtml, /element-chip element--ice/);
  assert.match(enemyHtml, /Ice/);

  const skillsHtml = renderCombat({ combat, party: [{ ...uiHero, level: 20, mp: 60 }], inventory: [], menu: 'skills' });
  // fire skills are strong vs ice; lightning skills are weak vs ice
  assert.match(skillsHtml, /element--fire/);
  assert.match(skillsHtml, /Fire\s*<em>strong<\/em>/);
});

test('element chip HTML escapes untrusted element labels', () => {
  const combat = createCombat({ enemyId: 'frost_wolf' });
  combat.enemy.element = '<img src=x onerror=alert(1)>';
  const html = renderCombat({ combat, party: [uiHero], inventory: [], menu: 'main' });
  assert.ok(!html.includes('<img src=x'), 'element label is escaped');
});
test('hero-action log lines include ::elem:: marker for elemental skills', () => {
  const hero = member({ atk: 40, mp: 60 });
  // Spark (lightning) vs storm_heart (lightning) — same element, neutral multiplier
  const c = createCombat({ enemyId: 'storm_heart' });
  const r = heroAction(c, hero, { type: 'skill', skillId: 'spark' }, fixed(0), [hero]);
  assert.ok(r.lines.some((l) => /^::elem:lightning::/.test(l)),
    'spark log line should start with ::elem:lightning:: marker');

  // Basic attack (no element) vs frost_wolf — no ::elem:: markers expected
  const c2 = createCombat({ enemyId: 'frost_wolf' });
  const r2 = heroAction(c2, hero, { type: 'attack' }, fixed(0), [hero]);
  assert.ok(!r2.lines.some((l) => l.includes('::elem:')),
    'basic attack log lines should not include ::elem:: markers');
});

test('renderCombat converts known ::elem:: markers to chips and leaves unknown ones literal', () => {
  const combat = createCombat({ enemyId: 'frost_wolf' });
  combat.log = [
    '::elem:fire::Wren strikes with fury!',
    '::elem:lightning::Wren casts Spark.',
    '::elem:plasma::Wren casts ???',
    '<waits>',
  ];
  combat.turn = 4;
  const html = renderCombat({ combat, party: [uiHero], inventory: [], menu: 'main' });

  // Known elements render as chips
  assert.match(html, /element-chip element--fire/);
  assert.match(html, /element-chip element--lightning/);
  // Trailing space after chip before text
  assert.match(html, /<span class="element-chip element--fire">Fire<\/span> Wren/);
  assert.match(html, /<span class="element-chip element--lightning">Lightning<\/span> Wren/);
  // Unknown element marker stays literal, no chip class generated
  assert.ok(html.includes('::elem:plasma::'), 'unknown element marker stays literal');
  assert.ok(!html.includes('element--plasma'), 'unknown element marker does not get a chip');
  // HTML injection is escaped
  assert.ok(html.includes('&lt;waits&gt;'), '<waits> is HTML-escaped');
  assert.ok(!html.includes('<waits>'), 'unescaped <waits> must not appear');
});


// --- Regression: minimum-damage clamp and companion routing -----------------

test('a resisted skill floors to a minimum of 1 damage instead of 0', () => {
  const hero = member({ atk: 1, mp: 60 });
  const c = createCombat({ enemyId: 'last_squall' }); // water; fire is weak
  c.enemy.hp = 9999;
  const before = c.enemy.hp;
  const r = heroAction(c, hero, { type: 'skill', skillId: 'skyfire_lance' }, fixed(0), [hero]);
  assert.equal(r.ok, true);
  assert.ok(r.lines.some((l) => l.includes("It's not very effective")));
  assert.equal(before - c.enemy.hp, 1, 'weak hit clamps to 1 rather than flooring to 0');
});

test('companion Spark and Signal Flare route through the elemental wheel', () => {
  // Spark (lightning) is weak vs an ice construct: floor((8 + 7*2 + 0) * 0.75 * 1.5) = 24
  const iven = createCompanionMember('iven', 7);
  const c1 = createCombat({ enemyId: 'glacierward_colossus' }); // ice + construct
  const spark = companionTurn(c1, iven, [iven], fixed(0));
  assert.match(spark[0], /Spark for 24/);

  // Signal Flare (fire) is weak vs water: floor((5 + 7*2 + 0) * 0.75) = 14
  const sela = createCompanionMember('sela', 7);
  const c2 = createCombat({ enemyId: 'tide_wraith' }); // water
  const flare = companionTurn(c2, sela, [sela], fixed(0));
  assert.match(flare[0], /Signal Flare for 14/);
});


// --- Unit: elementMatchups ---------------------------------------------------

test('elementMatchups returns correct strong/resist for ice defender', () => {
  const { strong, resist } = elementMatchups('ice');
  assert.deepEqual(strong, ['fire'], 'fire is strong vs ice');
  assert.deepEqual(resist, ['lightning'], 'lightning is weak vs ice');
});

test('elementMatchups returns correct strong/resist for lightning defender', () => {
  const { strong, resist } = elementMatchups('lightning');
  assert.deepEqual(strong, ['ice'], 'ice is strong vs lightning');
  assert.deepEqual(resist, ['water'], 'water is weak vs lightning');
});

test('elementMatchups returns empty arrays for earth defender', () => {
  assert.deepEqual(elementMatchups('earth'), { strong: [], resist: [] });
});

test('elementMatchups returns empty arrays for null or missing element', () => {
  assert.deepEqual(elementMatchups(null), { strong: [], resist: [] });
  assert.deepEqual(elementMatchups(undefined), { strong: [], resist: [] });
  assert.deepEqual(elementMatchups(''), { strong: [], resist: [] });
});

test('elementMatchups result labels are egg-free', () => {
  const mu = elementMatchups('ice');
  assertEggFree(mu.strong.join(' '));
  assertEggFree(mu.resist.join(' '));
});

// --- Integration: enemy matchup hint renders in combat UI ---------------------

test('enemy unit card shows weakness/resistance hint below stats', () => {
  const combat = createCombat({ enemyId: 'frost_wolf' }); // ice: weak to fire, resists lightning
  const html = renderCombat({ combat, party: [uiHero], inventory: [], menu: 'main' });
  assert.match(html, /enemy-matchup-hint/);
  assert.match(html, /Weak to Fire/);
  assert.match(html, /Resists Lightning/);
});

test('earth enemy unit card shows no matchup hint', () => {
  const combat = createCombat({ enemyId: 'briar_boar' }); // earth
  const html = renderCombat({ combat, party: [uiHero], inventory: [], menu: 'main' });
  assert.ok(!html.includes('enemy-matchup-hint'), 'earth foes should not have a matchup hint');
});

test('matchup hint HTML-escapes element labels', () => {
  const combat = createCombat({ enemyId: 'frost_wolf' });
  combat.enemy.element = '<img src=x onerror=alert(1)>';
  const html = renderCombat({ combat, party: [uiHero], inventory: [], menu: 'main' });
  // The malicious element label should not appear as an injection in the hint
  assert.ok(!html.includes('onerror'), 'no unescaped event handler in matchup hint');
  assert.ok(!html.includes('<img'), 'no unescaped tag in matchup hint');
  // The raw string may appear escaped
});
