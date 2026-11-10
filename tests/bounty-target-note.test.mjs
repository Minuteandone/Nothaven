import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bountyCombatText, getBounty } from '../src/core/bounties.js';
import { bountyTargetNote, renderCombat } from '../src/ui/combat.js';
import { combatScene } from '../src/scenes/combat.js';
import { createCombat } from '../src/combat/rules.js';
import { createInitialState } from '../src/state.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = ' During a battle against your contract’s target, a “Bounty target:” line beneath the foe shows your progress and what winning that battle will bring it to.';
const withContract = (active, progress = 0) => ({ bounties: { active, progress, completed: {}, spent: 0 } });
const wrap = (text) => `<p class="bounty-target-note"><span class="bounty-target-note__label">Bounty target:</span> ${text}</p>`;

test('bountyCombatText reports progress and the next count for the contract target', () => {
  assert.equal(getBounty('ridge_rats').count, 4);
  assert.equal(bountyCombatText(withContract('ridge_rats', 0), 'storm_rat'), `“${getBounty('ridge_rats').title}” — 0/4 defeated; winning this battle makes it 1/4.`);
  assert.equal(bountyCombatText(withContract('ridge_rats', 2), 'storm_rat'), `“${getBounty('ridge_rats').title}” — 2/4 defeated; winning this battle makes it 3/4.`);
  assert.equal(bountyCombatText(withContract('ridge_rats', 3), 'storm_rat'), `“${getBounty('ridge_rats').title}” — 3/4 defeated; winning this battle completes the contract.`);
});

test('bountyCombatText is null without a contract, for other foes, or once complete', () => {
  assert.equal(bountyCombatText({}, 'storm_rat'), null);
  assert.equal(bountyCombatText(null, 'storm_rat'), null);
  assert.equal(bountyCombatText(withContract('ridge_rats', 1), 'gale_hound'), null);
  assert.equal(bountyCombatText(withContract('ridge_rats', 4), 'storm_rat'), null);
  assert.equal(bountyCombatText(withContract('ridge_rats', 1), undefined), null);
  assert.equal(bountyCombatText(withContract('no_such_contract', 1), 'storm_rat'), null);
});

test('bountyTargetNote escapes text and hides for resolved fights, drills and empty text', () => {
  const combat = createCombat({ enemyId: 'storm_rat' });
  assert.equal(bountyTargetNote(combat, 'A <b> & “B”'), wrap('A &lt;b&gt; &amp; “B”'));
  assert.equal(bountyTargetNote(combat, null), '');
  assert.equal(bountyTargetNote(combat, ''), '');
  assert.equal(bountyTargetNote(null, 'x'), '');
  for (const over of ['victory', 'defeat', 'fled']) assert.equal(bountyTargetNote({ ...combat, over }, 'x'), '');
  assert.equal(bountyTargetNote({ ...combat, drill: true }, 'x'), '');
});

test('renderCombat shows the note once on the enemy side only when given', () => {
  const combat = createCombat({ enemyId: 'storm_rat' });
  const hero = { id: 'hero', name: 'Wren', level: 1, hp: 30, maxHp: 30, mp: 10, maxMp: 10, atk: 6, def: 3, spd: 5, statuses: [] };
  assert.doesNotMatch(renderCombat({ combat, party: [hero] }), /bounty-target-note/);
  const html = renderCombat({ combat, party: [hero], bountyNote: 'Test — 1/4 defeated' });
  assert.equal(html.split('class="bounty-target-note"').length - 1, 1);
  assert.ok(html.indexOf('bounty-target-note') > html.indexOf('combat-enemy-title'));
});

function sceneGame(contract, drill = false) {
  const state = createInitialState();
  Object.assign(state, contract);
  const g = { state, bus: { emit() {} }, scenes: { town: {}, combat: combatScene }, setScene(name) { state.scene = name; } };
  combatScene.onEnter(g, { enemyId: 'storm_rat', returnScene: 'town', ...(drill ? { drill: true } : {}) });
  return g;
}

test('combat scene passes the active contract note, but not in drills or for other targets', () => {
  const html = combatScene.render(sceneGame(withContract('ridge_rats', 2)));
  assert.match(html, /Bounty target:<\/span> “[^”]+” — 2\/4 defeated; winning this battle makes it 3\/4\./);
  assertEggFree(html.match(/<p class="bounty-target-note">.*?<\/p>/)[0]);
  assert.doesNotMatch(combatScene.render(sceneGame(withContract('ridge_rats', 2), true)), /bounty-target-note/);
  assert.doesNotMatch(combatScene.render(sceneGame(withContract('howling_pass', 0))), /bounty-target-note/);
  assert.doesNotMatch(combatScene.render(sceneGame({})), /bounty-target-note/);
});

test('player guide and in-game guide document the bounty target line once', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  assert.ok(md.includes(`and in the Journey Journal.${SENTENCE} When no contract is active`));
  const html = guideScene.render({ state: {} });
  assert.equal(html.split(escapeHTML(SENTENCE)).length - 1, 1);
  assertEggFree(SENTENCE);
  assert.ok(readFileSync(new URL('../src/ui/combat.js', import.meta.url), 'utf8').includes('<span class="bounty-target-note__label">Bounty target:</span>'));
});
