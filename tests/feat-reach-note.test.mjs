import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createInitialState } from '../src/state.js';
import { featCombatText } from '../src/scenes/feats.js';
import { featReachNote, renderCombat } from '../src/ui/combat.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const fight = (id, extra = {}) => ({ enemy: { id }, ...extra });
const SENTENCE = 'In a real battle whose victory would complete a feat, such as a field trial or the tenth foe in your field journal, a “Feat in reach:” line beneath the foe names the feats that winning it will earn.';

test('featCombatText names feats a real victory would earn', () => {
  const s = createInitialState();
  assert.equal(featCombatText(s, fight('old_tusk')), 'Winning this battle earns “Tusk Breaker”.');
  assert.equal(featCombatText(s, fight('storm_rat')), null);
  s.bestiary = { gloomfin: 1, frostmane: 1, lenswarden: 1 };
  assert.equal(featCombatText(s, fight('old_tusk')), 'Winning this battle earns “Tusk Breaker” and “Trial Warden”.');
  s.bestiary = { gloomfin: 1, frostmane: 1, lenswarden: 1, briar_boar: 1, lens_wisp: 1, wrack_eel: 1, storm_rat: 2, gale_hound: 1, ridge_bandit: 1 };
  assert.equal(featCombatText(s, fight('rime_wight')), 'Winning this battle earns “Field Researcher” and “Roadwise”.');
  s.bestiary.old_tusk = 1;
  assert.equal(featCombatText(s, fight('old_tusk')), null, 'already earned feats are not repeated');
});

test('featCombatText is null for drills and bad input, and does not mutate state', () => {
  const s = createInitialState();
  const before = JSON.stringify(s.bestiary ?? null);
  assert.equal(featCombatText(s, fight('old_tusk', { drill: true })), null);
  assert.equal(featCombatText(null, fight('old_tusk')), null);
  assert.equal(featCombatText(s, null), null);
  assert.equal(featCombatText(s, { enemy: {} }), null);
  assert.equal(featCombatText(s, fight(42)), null);
  featCombatText(s, fight('old_tusk'));
  assert.equal(JSON.stringify(s.bestiary ?? null), before);
});

test('featReachNote escapes text and hides in resolved, drill or empty states', () => {
  const c = { over: false };
  assert.equal(featReachNote(c, 'A <b>& “B”'), '<p class="feat-reach-note"><span class="feat-reach-note__label">Feat in reach:</span> A &lt;b&gt;&amp; “B”</p>');
  for (const bad of [null, { over: 'victory' }, { drill: true }]) assert.equal(featReachNote(bad, 'x'), '');
  assert.equal(featReachNote(c, ''), '');
  assert.equal(featReachNote(c, null), '');
  assert.ok(!featReachNote(c, 'x').includes('role='));
});

test('renderCombat shows the feat note once after the foe title', () => {
  const s = createInitialState();
  const hero = s.party[0];
  const combat = { enemy: { id: 'old_tusk', name: 'Old Tusk', hp: 30, maxHp: 60, atk: 5, def: 1, spd: 3, statuses: [] }, party: [hero], log: [], over: false, turn: 'player', stats: { rounds: 1 } };
  const text = featCombatText(s, combat);
  const html = renderCombat({ combat, party: [hero], featNote: text });
  assert.equal(html.split('feat-reach-note__label').length - 1, 1);
  assert.ok(html.indexOf('combat-enemy-title') < html.indexOf('feat-reach-note'));
  assert.ok(html.includes('Winning this battle earns “Tusk Breaker”.'));
  assertEggFree(text);
});

test('guide documents the Feat in reach line', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  assert.ok(md.includes(`(2 of 3).”). ${SENTENCE}`));
  const html = guideScene.render({ state: {} });
  assert.equal(html.split(escapeHTML(SENTENCE)).length - 1, 1);
  assertEggFree(SENTENCE);
  const src = readFileSync(new URL('../src/ui/combat.js', import.meta.url), 'utf8');
  assert.ok(src.includes('<span class="feat-reach-note__label">Feat in reach:</span>'));
});
