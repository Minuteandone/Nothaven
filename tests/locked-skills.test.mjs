import test from 'node:test';
import assert from 'node:assert/strict';
import { knownSkills, lockedSkills, SKILL_UNLOCKS } from '../src/combat/rules.js';
import { assertEggFree } from './helpers/eggGuard.mjs';
import fs from 'node:fs';

// --- helpers ---
const heroAt = (level) => ({ name: 'Ren', level, class: 'warden' });

// --- Unit: lockedSkills ---

test('lockedSkills returns empty array for max-level hero', () => {
  const hero = heroAt(20);
  const locked = lockedSkills(hero);
  assert.equal(locked.length, 0, 'no skills are locked at level 20');
});

test('lockedSkills returns skills sorted by unlock level ascending', () => {
  const hero = heroAt(0);
  const locked = lockedSkills(hero);
  assert.ok(locked.length > 0, 'level 0 hero has locked skills');
  for (let i = 1; i < locked.length; i++) {
    assert.ok(locked[i].unlockLevel >= locked[i - 1].unlockLevel,
      `skill ${locked[i].name} unlock level ${locked[i].unlockLevel} >= ${locked[i - 1].unlockLevel}`);
  }
});

test('lockedSkills at level 5 returns skills with unlock > 5', () => {
  const hero = heroAt(5);
  const locked = lockedSkills(hero);
  const known = knownSkills(hero);
  const allIds = Object.keys(SKILL_UNLOCKS);
  // Every skill is either known or locked, no overlap, no missing
  const knownIds = new Set(known.map(s => s.id));
  const lockedIds = new Set(locked.map(s => s.id));
  assert.equal(knownIds.size + lockedIds.size, allIds.length,
    'known + locked covers all skill IDs');
  for (const id of knownIds) {
    assert.ok(!lockedIds.has(id), `skill ${id} should not appear in both known and locked`);
  }
  for (const s of locked) {
    assert.ok(SKILL_UNLOCKS[s.id] > 5, `locked skill ${s.id} unlock ${SKILL_UNLOCKS[s.id]} > 5`);
  }
});

test('lockedSkills each item has the shape of a skill plus unlockLevel', () => {
  const hero = heroAt(1);
  const locked = lockedSkills(hero);
  for (const skill of locked) {
    assert.ok(typeof skill.id === 'string', 'has string id');
    assert.ok(typeof skill.name === 'string', 'has string name');
    assert.ok(typeof skill.kind === 'string', 'has string kind');
    assert.ok(typeof skill.unlockLevel === 'number', 'has unlockLevel');
    assert.ok(skill.unlockLevel > 0, 'unlockLevel > 0');
    assert.equal(skill.unlockLevel, SKILL_UNLOCKS[skill.id],
      `unlockLevel matches SKILL_UNLOCKS for ${skill.id}`);
  }
});

test('lockedSkills on null/undefined member returns skills locked above level 1', () => {
  // null/undefined level → 0, all skills with unlock > 0 are locked
  const lockedNull = lockedSkills(null);
  const lockedUndef = lockedSkills(undefined);
  assert.equal(lockedNull.length, lockedUndef.length);
  assert.ok(lockedNull.length > 0, 'null member yields locked skills');
});

test('lockedSkills on member without level property returns skills locked above level 1', () => {
  const locked = lockedSkills({ name: 'nolevel' });
  assert.ok(locked.length > 0, 'member without level yields locked skills');
});

test('lockedSkills and knownSkills are complementary at every boundary', () => {
  for (let level = 1; level <= 20; level++) {
    const hero = heroAt(level);
    const known = knownSkills(hero);
    const locked = lockedSkills(hero);
    const total = Object.keys(SKILL_UNLOCKS).length;
    assert.equal(known.length + locked.length, total,
      `level ${level}: known(${known.length}) + locked(${locked.length}) = ${total}`);
    for (const s of locked) {
      assert.ok(SKILL_UNLOCKS[s.id] > level,
        `level ${level}: locked ${s.id} unlock ${SKILL_UNLOCKS[s.id]} > ${level}`);
    }
  }
});

// --- Egg scan ---
test('lockedSkills module is egg-free', () => {
  assertEggFree(fs.readFileSync('src/combat/rules.js', 'utf8'), 'lockedSkills rules module');
});
