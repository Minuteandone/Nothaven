import test from 'node:test';
import assert from 'node:assert';
import { defeatClosenessLine, renderCombat } from '../src/ui/combat.js';
import { assertEggFree } from './helpers/eggGuard.mjs';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function combatWithDealt(dealt, maxHp = 100, name = 'Goblin Scout') {
  const hp = Math.max(0, maxHp - dealt);
  const c = {
    enemy: { id: 'goblin_scout', name, maxHp, hp, element: 'neutral' },
    stats: { rounds: 1, taken: 0, bursts: 0 },
    over: 'defeat',
    drill: false,
    turn: 1,
    log: [`A ${name} appears!`],
    party: [{ id: 'wren', name: 'Wren', hp: 1, maxHp: 30 }],
    returnScene: 'town',
  };
  return c;
}

// --- gating ---

test('returns empty for null combat', async (t) => {
  assert.strictEqual(defeatClosenessLine(null), '');
});

test('returns empty for undefined combat', async (t) => {
  assert.strictEqual(defeatClosenessLine(undefined), '');
});

test('returns empty for victory', async (t) => {
  const c = combatWithDealt(30);
  c.over = 'victory';
  assert.strictEqual(defeatClosenessLine(c), '');
});

test('returns empty for escaped', async (t) => {
  const c = combatWithDealt(30);
  c.over = 'fled';
  assert.strictEqual(defeatClosenessLine(c), '');
});

test('returns empty for null over', async (t) => {
  const c = combatWithDealt(30);
  c.over = null;
  assert.strictEqual(defeatClosenessLine(c), '');
});

test('returns empty for drill', async (t) => {
  const c = combatWithDealt(30);
  c.drill = true;
  assert.strictEqual(defeatClosenessLine(c), '');
});

test('returns empty when enemy has no maxHp', async (t) => {
  const c = {
    enemy: { id: 'goblin_scout', name: 'Goblin Scout', hp: 50, element: 'neutral' },
    stats: { rounds: 0, taken: 0, bursts: 0 },
    over: 'defeat',
    drill: false,
    turn: 1,
    log: ['A Goblin Scout appears!'],
  };
  assert.strictEqual(defeatClosenessLine(c), '');
});

// --- tier tests ---

test('tier: never landed a blow (dealt=0)', async (t) => {
  const out = defeatClosenessLine(combatWithDealt(0));
  assert.ok(out.includes('never landed a blow'));
});

test('tier: barely felt (dealt=15)', async (t) => {
  const out = defeatClosenessLine(combatWithDealt(15));
  assert.ok(out.includes('barely felt'));
});

test('tier: bloodied (dealt=35)', async (t) => {
  const out = defeatClosenessLine(combatWithDealt(35));
  assert.ok(out.includes('bloodied but far from beaten'));
});

test('tier: heavily wounded (dealt=60)', async (t) => {
  const out = defeatClosenessLine(combatWithDealt(60));
  assert.ok(out.includes('heavily wounded'));
});

test('tier: brink of collapse (dealt=85)', async (t) => {
  const out = defeatClosenessLine(combatWithDealt(85));
  assert.ok(out.includes('on the brink of collapse'));
});

test('tier: mere moments (dealt=98)', async (t) => {
  const out = defeatClosenessLine(combatWithDealt(98));
  assert.ok(out.includes('mere moments left'));
});

// --- boundary tests ---

test('boundary: 25% is bloodied', async (t) => {
  const out = defeatClosenessLine(combatWithDealt(25));
  assert.ok(out.includes('bloodied'));
});

test('boundary: 50% is heavily wounded', async (t) => {
  const out = defeatClosenessLine(combatWithDealt(50));
  assert.ok(out.includes('heavily wounded'));
});

test('boundary: 75% is brink', async (t) => {
  const out = defeatClosenessLine(combatWithDealt(75));
  assert.ok(out.includes('brink of collapse'));
});

test('boundary: 90% is moments', async (t) => {
  const out = defeatClosenessLine(combatWithDealt(90));
  assert.ok(out.includes('mere moments'));
});

// --- structure test ---

test('structure: has CSS class and label', async (t) => {
  const out = defeatClosenessLine(combatWithDealt(50));
  assert.ok(out.includes('class="defeat-closeness-line"'));
  assert.ok(out.includes('defeat-closeness-line__label'));
  assert.ok(out.includes('How close:'));
  assert.ok(out.endsWith('</p>'));
});

// --- integration tests ---

test('integration: renders through renderCombat in defeat', async (t) => {
  const c = {
    enemy: { id: 'goblin_scout', name: 'Goblin Scout', maxHp: 100, hp: 40, element: 'neutral' },
    stats: { rounds: 3, taken: 30, bursts: 0 },
    over: 'defeat',
    drill: false,
    turn: 1,
    log: ['A Goblin Scout appears!'],
    party: [{ id: 'wren', name: 'Wren', hp: 1, maxHp: 30 }],
    returnScene: 'town',
  };
  const html = renderCombat({ combat: c, party: c.party });
  assert.ok(html.includes('defeat-closeness-line'));
});

test('integration: does NOT render for victory', async (t) => {
  const c = {
    enemy: { id: 'goblin_scout', name: 'Goblin Scout', maxHp: 100, hp: 40, element: 'neutral' },
    stats: { rounds: 3, taken: 30, bursts: 0 },
    over: 'victory',
    drill: false,
    turn: 1,
    log: ['A Goblin Scout appears!'],
    party: [{ id: 'wren', name: 'Wren', hp: 30, maxHp: 30 }],
    returnScene: 'town',
  };
  const html = renderCombat({ combat: c, party: c.party });
  assert.ok(!html.includes('defeat-closeness-line'));
});

// --- guide sync ---

test('guide sync: PLAYER_GUIDE.md', async (t) => {
  const content = readFileSync(join(import.meta.dirname, '..', 'docs', 'PLAYER_GUIDE.md'), 'utf8');
  assert.ok(content.includes('how close the enemy was to falling'));
});

test('guide sync: guide.js', async (t) => {
  const content = readFileSync(join(import.meta.dirname, '..', 'src', 'scenes', 'guide.js'), 'utf8');
  assert.ok(content.includes('how close the enemy was to falling'));
});

// --- egg guard ---

test('egg guard: output text', async (t) => {
  const out = defeatClosenessLine(combatWithDealt(85));
  assertEggFree(out);
});

test('egg guard: SENTENCE', async (t) => {
  const sentence = 'When you are defeated the outcome card shows how close the enemy was to falling, using the same damage ratio you dealt, so you know how near the fight was to turning out differently.';
  assertEggFree(sentence);
});
