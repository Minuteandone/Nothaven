import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeContextLine, renderCombat } from '../src/ui/combat.js';
import { noteItemUsed, battleSummary } from '../src/combat/rules.js';
import { assertEggFree } from './helpers/eggGuard.mjs';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function combatWithFled(rounds = 3, itemsUsed = 0) {
  const c = {
    enemy: { id: 'storm_rat', name: 'Storm Rat', maxHp: 12, hp: 10, element: 'neutral' },
    stats: { rounds, taken: 5, bursts: 0 },
    over: 'fled',
    drill: false,
    turn: rounds + 1,
    log: ['A Storm Rat appears!'],
    party: [{ id: 'wren', name: 'Wren', hp: 25, maxHp: 30 }],
    returnScene: 'ridge_road',
  };
  for (let i = 0; i < itemsUsed; i++) {
    noteItemUsed(c, 'healing_herb');
  }
  return c;
}

// ── Gating ──────────────────────────────────────────────

test('escapeContextLine returns empty for null', () => {
  assert.equal(escapeContextLine(null), '');
});

test('escapeContextLine returns empty for undefined', () => {
  assert.equal(escapeContextLine(undefined), '');
});

test('escapeContextLine returns empty for victory', () => {
  const c = combatWithFled();
  c.over = 'victory';
  assert.equal(escapeContextLine(c), '');
});

test('escapeContextLine returns empty for defeat', () => {
  const c = combatWithFled();
  c.over = 'defeat';
  assert.equal(escapeContextLine(c), '');
});

test('escapeContextLine returns empty for null over', () => {
  const c = combatWithFled();
  c.over = null;
  assert.equal(escapeContextLine(c), '');
});

test('escapeContextLine returns empty for drill', () => {
  const c = combatWithFled();
  c.drill = true;
  assert.equal(escapeContextLine(c), '');
});

// ── Content: rounds ─────────────────────────────────────

test('escapeContextLine shows round count for fled', () => {
  const c = combatWithFled(5);
  const html = escapeContextLine(c);
  assert.ok(html.includes('Escaped after:'));
  assert.ok(html.includes('5 rounds'));
});

test('escapeContextLine uses singular round for 1', () => {
  const c = combatWithFled(1);
  const html = escapeContextLine(c);
  assert.ok(html.includes('1 round'));
  assert.ok(!html.includes('1 rounds'));
});

// ── Content: items ───────────────────────────────────────

test('escapeContextLine shows items used when present', () => {
  const c = combatWithFled(3, 2);
  const html = escapeContextLine(c);
  assert.ok(html.includes('3 rounds'));
  assert.ok(html.includes('2 items'));
  assert.ok(html.includes('\u00b7'));
});

test('escapeContextLine uses singular item for 1', () => {
  const c = combatWithFled(2, 1);
  const html = escapeContextLine(c);
  assert.ok(html.includes('1 item'));
  assert.ok(!html.includes('1 items'));
});

test('escapeContextLine omits items when zero used', () => {
  const c = combatWithFled(4, 0);
  const html = escapeContextLine(c);
  assert.ok(html.includes('4 rounds'));
  assert.ok(!html.includes('item'));
});

// ── Structure ────────────────────────────────────────────

test('escapeContextLine has correct CSS class and label', () => {
  const c = combatWithFled(3);
  const html = escapeContextLine(c);
  assert.ok(html.includes('class="escape-context-line"'));
  assert.ok(html.includes('class="escape-context-line__label"'));
  assert.ok(html.includes('Escaped after:'));
  assert.ok(html.endsWith('</p>'));
});

// ── Integration: renderCombat ────────────────────────────

test('escapeContextLine renders through renderCombat for fled', () => {
  const c = combatWithFled(3, 1);
  const html = renderCombat({ combat: c, party: c.party });
  assert.ok(html.includes('escape-context-line'));
  assert.ok(html.includes('3 rounds'));
  assert.ok(html.includes('1 item'));
});

test('escapeContextLine does NOT render through renderCombat for victory', () => {
  const c = combatWithFled(3);
  c.over = 'victory';
  const html = renderCombat({ combat: c, party: c.party });
  assert.ok(!html.includes('escape-context-line'));
});

test('escapeContextLine does NOT render through renderCombat for defeat', () => {
  const c = combatWithFled(3);
  c.over = 'defeat';
  const html = renderCombat({ combat: c, party: c.party });
  assert.ok(!html.includes('escape-context-line'));
});

// ── Guide sync ───────────────────────────────────────────

test('escape guide sentence is in PLAYER_GUIDE.md', () => {
  const guide = readFileSync(join(__dirname, '..', 'docs', 'PLAYER_GUIDE.md'), 'utf-8');
  assert.ok(guide.includes('After you flee, the outcome card lists how many rounds you survived'));
});

test('escape guide sentence is in guide.js', () => {
  const guide = readFileSync(join(__dirname, '..', 'src', 'scenes', 'guide.js'), 'utf-8');
  assert.ok(guide.includes('After you flee, the outcome card lists how many rounds you survived'));
});

// ── Egg guard ────────────────────────────────────────────

test('escapeContextLine output is egg-free', () => {
  const c = combatWithFled(5, 3);
  const html = escapeContextLine(c);
  assertEggFree(html);
});

test('escapeContextLine SENTENCE is egg-free', () => {
  assertEggFree('After you flee, the outcome card lists how many rounds you survived and any items you used before escaping, so you can see what the attempt cost.');
});

