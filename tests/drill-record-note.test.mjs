import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { drillCombatText, DRILL_FOES } from '../src/scenes/drills.js';
import { drillRecordNote, renderCombat } from '../src/ui/combat.js';
import { combatScene } from '../src/scenes/combat.js';
import { createCombat } from '../src/combat/rules.js';
import { createInitialState } from '../src/state.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = ' During a drill or Gauntlet bout, a “Drill record:” line beneath the foe shows the record that bout is competing for and what winning it would set.';
const FOE = 'tide_wraith';
const st = (records = {}, gauntlet) => ({ drillRecords: records, ...(gauntlet ? { drillGauntlet: gauntlet } : {}) });
const drill = (extra = {}) => ({ drill: true, enemy: { id: FOE }, ...extra });
const wrap = (text) => `<p class="drill-record-note"><span class="drill-record-note__label">Drill record:</span> ${text}</p>`;

test('single drills report the record to beat', () => {
  assert.ok(DRILL_FOES.includes(FOE));
  assert.equal(drillCombatText(st(), drill()), 'No drill win yet against this foe — winning sets your first record.');
  assert.equal(drillCombatText(st({ [FOE]: { wins: 2, best: 5 } }), drill()), 'Best: 5 rounds over 2 wins — win in fewer than 5 rounds to set a new record.');
  assert.equal(drillCombatText(st({ [FOE]: { wins: 1, best: 2 } }), drill()), 'Best: 2 rounds over 1 win — win in fewer than 2 rounds to set a new record.');
  assert.equal(drillCombatText(st({ [FOE]: { wins: 3, best: 1 } }), drill()), 'Best: 1 round over 3 wins — the fastest possible.');
  assert.equal(drillCombatText(st({ [FOE]: { wins: 1 } }), drill()), '1 win, no best time yet — winning records one.');
});

test('gauntlet bouts report the run against the best run', () => {
  const q = DRILL_FOES.slice(0, 4);
  const g = (best, index) => drillCombatText(st({}, { runs: 1, best }), drill({ gauntlet: { queue: q, index } }));
  assert.equal(drillCombatText(st(), drill({ gauntlet: { queue: q, index: 0 } })), 'Yard Gauntlet bout 1 of 4 · best run: 0 foes beaten. Winning this bout sets a new best run.');
  assert.equal(g(1, 1), 'Yard Gauntlet bout 2 of 4 · best run: 1 foe beaten. Winning this bout sets a new best run.');
  assert.equal(g(2, 1), 'Yard Gauntlet bout 2 of 4 · best run: 2 foes beaten. Win 2 more bouts to set a new best run.');
  assert.equal(g(2, 2), 'Yard Gauntlet bout 3 of 4 · best run: 2 foes beaten. Winning this bout sets a new best run.');
  assert.equal(g(3, 0), 'Yard Gauntlet bout 1 of 4 · best run: 3 foes beaten. Win 4 more bouts to set a new best run.');
  assert.equal(g(3, 2), 'Yard Gauntlet bout 3 of 4 · best run: 3 foes beaten. Win 2 more bouts to set a new best run.');
  assert.equal(g(4, 3), 'Yard Gauntlet bout 4 of 4 · best run: 4 foes beaten. Your best run already clears every bout.');
});

test('drillCombatText is null outside drills and for unknown or malformed input', () => {
  assert.equal(drillCombatText(st(), null), null);
  assert.equal(drillCombatText(st(), { enemy: { id: FOE } }), null);
  assert.equal(drillCombatText(st(), { drill: 'yes', enemy: { id: FOE } }), null);
  assert.equal(drillCombatText(st(), drill({ enemy: { id: 'storm_rat' } })), null);
  assert.equal(drillCombatText(st(), drill({ enemy: {} })), null);
  assert.equal(drillCombatText(null, drill()), 'No drill win yet against this foe — winning sets your first record.');
});

test('drillRecordNote escapes text and hides outside live drills', () => {
  assert.equal(drillRecordNote({ drill: true }, 'A <b>&'), wrap('A &lt;b&gt;&amp;'));
  assert.equal(drillRecordNote({ drill: true, over: 'victory' }, 'x'), '');
  assert.equal(drillRecordNote({ drill: true, over: 'defeat' }, 'x'), '');
  assert.equal(drillRecordNote({}, 'x'), '');
  assert.equal(drillRecordNote(null, 'x'), '');
  assert.equal(drillRecordNote({ drill: true }, ''), '');
  assert.equal(drillRecordNote({ drill: true }, null), '');
});

test('renderCombat places the drill note once after the foe title', () => {
  const state = createInitialState();
  const combat = createCombat({ enemyId: FOE });
  combat.drill = true;
  const html = renderCombat({ combat, party: state.party, drillNote: 'Best: 5 rounds' });
  assert.equal(html.split('drill-record-note__label').length - 1, 1);
  assert.ok(html.indexOf('drill-record-note') > html.indexOf('combat-enemy-title'));
  assertEggFree(html, 'drill note render');
  assert.doesNotMatch(renderCombat({ combat, party: state.party }), /drill-record-note/);
});

function sceneGame(records, data) {
  const state = createInitialState();
  state.drillRecords = records;
  const g = { state, bus: { emit() {} }, scenes: { drills: {}, combat: combatScene }, setScene(name) { state.scene = name; } };
  combatScene.onEnter(g, { returnScene: 'drills', ...data });
  return g;
}

test('combat scene shows the note in drills and gauntlet bouts only', () => {
  const html = combatScene.render(sceneGame({ [FOE]: { wins: 2, best: 5 } }, { enemyId: FOE, drill: true }));
  assert.ok(html.includes(wrap(escapeHTML('Best: 5 rounds over 2 wins — win in fewer than 5 rounds to set a new record.'))));
  const q = DRILL_FOES.slice(0, 3);
  const gh = combatScene.render(sceneGame({}, { enemyId: q[0], drill: true, gauntlet: { queue: q, index: 0 } }));
  assert.ok(gh.includes(escapeHTML('Yard Gauntlet bout 1 of 3 · best run: 0 foes beaten. Winning this bout sets a new best run.')));
  assert.doesNotMatch(combatScene.render(sceneGame({ [FOE]: { wins: 2, best: 5 } }, { enemyId: FOE })), /drill-record-note/);
});

test('guide documents the Drill record line in both copies', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  assert.ok(md.includes(`how many more foes your best run must beat.${SENTENCE}`));
  const html = guideScene.render({ state: {} });
  assert.equal(html.split(escapeHTML(SENTENCE)).length - 1, 1);
  assertEggFree(SENTENCE, 'drill record guide sentence');
  const src = readFileSync(new URL('../src/ui/combat.js', import.meta.url), 'utf8');
  assert.ok(src.includes('<span class="drill-record-note__label">Drill record:</span>'));
});
