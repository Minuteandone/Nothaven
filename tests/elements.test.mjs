import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ELEMENTS, elementMultiplier, elementLabel, elementClass, elementEffectivenessText,
} from '../src/combat/elements.js';
import { SKILLS, createCombat, heroAction } from '../src/combat/rules.js';
import { ENEMIES } from '../src/data/enemies.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

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
