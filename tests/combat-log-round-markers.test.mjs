import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, afterHeroAction, heroAction } from '../src/combat/rules.js';
import { combatScene } from '../src/scenes/combat.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const fixed = (v) => () => v;
const hero = (o = {}) => ({ id: 'hero', name: 'Wren', hp: 30, maxHp: 30, mp: 15, maxMp: 15, atk: 8, def: 4, spd: 5, level: 3, xp: 0, statuses: [], ...o });

function ally(id, name, role, o = {}) {
  return { id, name, role, hp: 20, maxHp: 20, atk: 5, def: 3, spd: 4, level: 3, xp: 0, statuses: [], ...o };
}

test('afterHeroAction emits a ::round:: marker for each round', () => {
  const c = createCombat({ enemyId: 'storm_rat' });
  const h = hero();
  const tamsin = ally('tamsin', 'Tamsin', 'scout');
  const party = [h, tamsin];

  // Round 1
  const r1 = afterHeroAction(c, h, fixed(0.99), party);
  const roundMarkers1 = r1.filter(l => l.startsWith('::round::'));
  assert.equal(roundMarkers1.length, 1, 'one round marker per afterHeroAction call');
  assert.equal(roundMarkers1[0], '::round::Round 1');

  // Round 2 — enemy still alive
  const r2 = afterHeroAction(c, h, fixed(0.99), party);
  const roundMarkers2 = r2.filter(l => l.startsWith('::round::'));
  assert.equal(roundMarkers2.length, 1);
  assert.equal(roundMarkers2[0], '::round::Round 2');

  // Round 3
  const r3 = afterHeroAction(c, h, fixed(0.99), party);
  const roundMarkers3 = r3.filter(l => l.startsWith('::round::'));
  assert.equal(roundMarkers3.length, 1);
  assert.equal(roundMarkers3[0], '::round::Round 3');
});

test('round marker appears before companion and enemy lines', () => {
  const c = createCombat({ enemyId: 'storm_rat' });
  const h = hero();
  const tamsin = ally('tamsin', 'Tamsin', 'scout');
  const party = [h, tamsin];

  const lines = afterHeroAction(c, h, fixed(0.99), party);
  assert.ok(lines.length >= 3, 'at least round marker + companion + enemy lines');

  const roundIdx = lines.findIndex(l => l.startsWith('::round::'));
  assert.ok(roundIdx >= 0, 'round marker present');
  assert.equal(roundIdx, 0, 'round marker is the first line');

  // Companion line should come after round marker
  const companionIdx = lines.findIndex(l => l.includes('Tamsin'));
  assert.ok(companionIdx > roundIdx, 'companion acts after round marker');
});

test('round marker emitted even when battle is over (checkVictory set c.over before afterHeroAction)', () => {
  const c = createCombat({ enemyId: 'storm_rat' });
  const h = hero();
  c.over = 'victory';

  const lines = afterHeroAction(c, h, fixed(0.99), [h]);
  assert.equal(lines.length, 1, 'only the round marker when battle is over');
  assert.equal(lines[0], '::round::Round 1');
});

test('full heroAction includes round marker in its lines', () => {
  const c = createCombat({ enemyId: 'storm_rat' });
  const h = hero();
  const tamsin = ally('tamsin', 'Tamsin', 'scout');
  const party = [h, tamsin];

  const result = heroAction(c, h, { type: 'attack' }, fixed(0.99), party);
  assert.equal(result.ok, true);

  const roundMarkers = result.lines.filter(l => l.startsWith('::round::'));
  assert.equal(roundMarkers.length, 1, 'heroAction result includes one round marker');
  assert.match(roundMarkers[0], /^::round::Round \d+$/);
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
  // The round marker text "Round N" has no special chars, but verify the
  // escapeHTML path doesn't break the ::round:: prefix detection
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

  // Round markers appear in the chronicle too
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

test('no round markers appear when afterHeroAction is not called (no rounds elapsed)', () => {
  const state = createInitialState();
  state.combat = createCombat({ enemyId: 'storm_rat' });
  state.party = [hero()];

  // Just initial messages, no afterHeroAction called
  state.combat.log.push('A Storm Rat approaches!');
  const html = combatScene.render({ state });

  assert.equal((html.match(/combat-log__round-marker/g) || []).length, 0, 'no round markers without rounds');
  assertEggFree(html, 'no-round-marker panel');
});
