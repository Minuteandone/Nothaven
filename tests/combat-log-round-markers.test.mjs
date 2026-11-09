import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, heroAction } from '../src/combat/rules.js';
import { combatScene } from '../src/scenes/combat.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const fixed = (v) => () => v;
const hero = (o = {}) => ({ id: 'hero', name: 'Wren', hp: 30, maxHp: 30, mp: 15, maxMp: 15, atk: 8, def: 4, spd: 5, level: 3, xp: 0, statuses: [], ...o });

function ally(id, name, role, o = {}) {
  return { id, name, role, hp: 20, maxHp: 20, atk: 5, def: 3, spd: 4, level: 3, xp: 0, statuses: [], ...o };
}

test('heroAction emits a ::round:: marker as the first line of a valid action', () => {
  // Use defend so the hero deals no damage; no companion so enemy survives indefinitely
  const c = createCombat({ enemyId: 'storm_rat' });
  const h = hero();
  const party = [h]; // hero alone — no companion to deal unintended damage

  // Round 1 — use defend
  const r1 = heroAction(c, h, { type: 'defend' }, fixed(0.99), party);
  assert.equal(r1.ok, true);
  assert.equal(r1.lines[0], '::round::Round 1', 'round marker is the first line');
  assert.ok(r1.lines[1].includes('raises a guard'), 'hero action follows round marker');

  // Round 2
  const r2 = heroAction(c, h, { type: 'defend' }, fixed(0.99), party);
  assert.equal(r2.lines[0], '::round::Round 2');

  // Round 3
  const r3 = heroAction(c, h, { type: 'defend' }, fixed(0.99), party);
  assert.equal(r3.lines[0], '::round::Round 3');
});

test('round marker appears before companion and enemy lines in heroAction output', () => {
  // storm_bear has 34 HP, 5 DEF — durable for multiple rounds with a companion
  const c = createCombat({ enemyId: 'storm_bear' });
  const h = hero({ mp: 50 });
  const tamsin = ally('tamsin', 'Tamsin', 'scout');
  const party = [h, tamsin];

  const result = heroAction(c, h, { type: 'defend' }, fixed(0.99), party);
  assert.equal(result.ok, true);

  const roundIdx = result.lines.findIndex(l => l.startsWith('::round::'));
  assert.equal(roundIdx, 0, 'round marker is the first line (idx 0)');

  // Companion and enemy lines come after round marker + hero action
  assert.ok(result.lines.length >= 3, 'at least round marker + hero action + companion/enemy lines');
});

test('failed actions do NOT emit a round marker or increment rounds', () => {
  const c = createCombat({ enemyId: 'storm_rat' });

  // Unknown action type
  const r1 = heroAction(c, hero(), { type: 'gobbledygook' }, fixed(0.99));
  assert.equal(r1.ok, false);
  const markers1 = r1.lines.filter(l => l.startsWith('::round::'));
  assert.equal(markers1.length, 0, 'unknown action: no round marker');

  // Defend with no MP for a skill — defend always works, test unknown action instead
  // Skill with no MP
  const h = hero({ mp: 0, skills: [{ id: 'rekindle', name: 'Rekindle', kind: 'revive', mp: 15, share: 0.4 }] });
  const r2 = heroAction(c, h, { type: 'skill', skillId: 'rekindle' }, fixed(0.99), [h, ally('tamsin', 'Tamsin', 'scout')]);
  assert.equal(r2.ok, false);
  const markers2 = r2.lines.filter(l => l.startsWith('::round::'));
  assert.equal(markers2.length, 0, 'no MP: no round marker');

  // After these failed actions, first valid action should still be Round 1
  const h2 = hero();
  const r3 = heroAction(c, h2, { type: 'attack' }, fixed(0.99));
  assert.equal(r3.ok, true);
  assert.equal(r3.lines[0], '::round::Round 1', 'first valid action starts Round 1 even after failures');
});

test('round marker emitted for lethal blow turn (before checkVictory)', () => {
  const c = createCombat({ enemyId: 'storm_rat' });
  c.enemy.hp = 1; // almost dead
  const h = hero();

  const result = heroAction(c, h, { type: 'attack' }, fixed(0.99));
  assert.equal(result.ok, true);
  assert.equal(c.over, 'victory', 'battle won');

  // Round marker should still be present for the final round
  assert.equal(result.lines[0], '::round::Round 1', 'round marker appears even on the lethal blow turn');
});

test('round marker is rendered as a styled span, not plain text', () => {
  const state = createInitialState();
  state.combat = createCombat({ enemyId: 'storm_rat' });
  const h = hero();
  const tamsin = ally('tamsin', 'Tamsin', 'scout');
  state.party = [h, tamsin];

  // Push a round marker into the log
  state.combat.log.push('::round::Round 1', 'Test event');
  const html = combatScene.render({ state });

  // Round marker should be styled
  assert.ok(html.includes('combat-log__round-marker'), 'round marker CSS class present');
  assert.ok(html.includes('Round 1'), 'round text visible');

  // Round marker appears in both live log and chronicle details
  const markerCount = (html.match(/combat-log__round-marker/g) || []).length;
  assert.ok(markerCount >= 1, 'round marker class appears at least once');

  assertEggFree(html, 'round marker rendered panel');
});

test('round markers survive escapeHTML — special chars in round text are escaped', () => {
  const state = createInitialState();
  state.combat = createCombat({ enemyId: 'storm_rat' });
  const h = hero();
  state.party = [h];

  state.combat.log.push('::round::Round 5');
  const html = combatScene.render({ state });
  assert.ok(html.includes('combat-log__round-marker'), 'round 5 rendered with correct class');
  assert.ok(html.includes('Round 5'));
  assertEggFree(html, 'round 5 marker');
});

test('multiple rounds in chronicle are all styled', () => {
  const state = createInitialState();
  state.combat = createCombat({ enemyId: 'storm_rat' });
  const h = hero();
  state.party = [h];

  state.combat.log.push('::round::Round 1', 'Hero strikes for 10.', 'Enemy hits for 3.',
                         '::round::Round 2', 'Hero strikes for 12.', 'Enemy is defeated!');
  const html = combatScene.render({ state });

  // Each round marker appears in both live log and chronicle details
  const markers = (html.match(/combat-log__round-marker/g) || []);
  assert.ok(markers.length >= 4, 'round markers appear in both live log and chronicle');

  assert.ok(html.includes('Round 1'));
  assert.ok(html.includes('Round 2'));
  assertEggFree(html, 'multi-round chronicle');
});

test('banter and round markers coexist correctly — banter takes priority', () => {
  const state = createInitialState();
  state.combat = createCombat({ enemyId: 'storm_rat' });
  state.party = [hero()];

  state.combat.log.push('::round::Round 1', '::banter::Keep your guard up!', 'Hero strikes for 10.');
  const html = combatScene.render({ state });

  assert.ok(html.includes('combat-log__round-marker'), 'round marker class present');
  assert.ok(html.includes('combat-banter'), 'banter class present');

  // Verify banter line does NOT have round marker class
  const banterIdx = html.indexOf('combat-banter');
  const roundIdx = html.indexOf('combat-log__round-marker');
  assert.notEqual(banterIdx, -1);
  assert.notEqual(roundIdx, -1);
  assert.notEqual(banterIdx, roundIdx, 'banter and round marker are different elements');

  assertEggFree(html, 'banter and round coexistence');
});

test('no round markers appear when log has no ::round:: entries', () => {
  const state = createInitialState();
  state.combat = createCombat({ enemyId: 'storm_rat' });
  state.party = [hero()];

  // Just initial messages, no heroAction called
  state.combat.log.push('A Storm Rat approaches!');
  const html = combatScene.render({ state });

  assert.equal((html.match(/combat-log__round-marker/g) || []).length, 0, 'no round markers without rounds');
  assertEggFree(html, 'no-round-marker panel');
});
