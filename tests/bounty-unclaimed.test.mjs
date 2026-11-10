import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bountyUnclaimedText, bountiesScene } from '../src/scenes/bounties.js';
import { BOUNTIES, bountyRows } from '../src/core/bounties.js';
import { escapeHTML } from '../src/ui/components.js';
import { guideScene } from '../src/scenes/guide.js';
import { assertEggFree } from './helpers/eggGuard.mjs';
import { createInitialState } from '../src/state.js';

const SENTENCE = 'Beneath it, a “Still unclaimed:” line names up to three posted contracts you have never claimed, in board order.';

function stateWith(postedCount, completed) {
  const s = createInitialState();
  s.bestiary = Object.fromEntries(BOUNTIES.slice(0, postedCount).map((b) => [b.enemyId, 1]));
  s.bounties = { active: null, progress: 0, completed: { ...completed }, spent: 0 };
  return s;
}

test('bountyUnclaimedText is null before any claim and for bad input', () => {
  assert.equal(bountyUnclaimedText(null), null);
  assert.equal(bountyUnclaimedText([]), null);
  assert.equal(bountyUnclaimedText(bountyRows(createInitialState())), null);
  assert.equal(bountyUnclaimedText(bountyRows(stateWith(5, {}))), null);
});

test('bountyUnclaimedText names up to three posted, never-claimed contracts in board order', () => {
  const text = bountyUnclaimedText(bountyRows(stateWith(5, { ridge_rats: 2 })));
  assert.equal(text, 'Still unclaimed: “Hounds on the Wind”, “Bandit Toll Road” and “Stray Lens Lights” (and 1 more).');
  assertEggFree(text, 'unclaimed line');
  const one = bountyUnclaimedText(bountyRows(stateWith(2, { ridge_rats: 1 })));
  assert.equal(one, `Still unclaimed: “${BOUNTIES[1].title}”.`);
  const two = bountyUnclaimedText(bountyRows(stateWith(3, { ridge_rats: 1 })));
  assert.equal(two, `Still unclaimed: “${BOUNTIES[1].title}” and “${BOUNTIES[2].title}”.`);
});

test('bountyUnclaimedText points at locked notices once every posted one is claimed, and vanishes at 18', () => {
  const five = Object.fromEntries(BOUNTIES.slice(0, 5).map((b) => [b.id, 1]));
  assert.equal(bountyUnclaimedText(bountyRows(stateWith(5, five))), 'Still unclaimed: none posted — defeat new foes to open the remaining 13 notices.');
  const seventeen = Object.fromEntries(BOUNTIES.slice(0, 17).map((b) => [b.id, 1]));
  assert.equal(bountyUnclaimedText(bountyRows(stateWith(17, seventeen))), 'Still unclaimed: none posted — defeat new foes to open the remaining 1 notice.');
  const all = Object.fromEntries(BOUNTIES.map((b) => [b.id, 3]));
  assert.equal(bountyUnclaimedText(bountyRows(stateWith(18, all))), null);
});

test('the board renders the unclaimed line once, right after the answered line', () => {
  const s = stateWith(3, {});
  s.scene = 'bounties'; s.combat = null;
  const game = { state: s, setScene() {} };
  bountiesScene.onEnter(game);
  assert.ok(!bountiesScene.render(game).includes('bounties__unclaimed'));
  s.bounties.completed = { ridge_rats: 1 };
  const html = bountiesScene.render(game);
  const lines = [...html.matchAll(/<p class="bounties__unclaimed">([^<]*)<\/p>/g)].map((m) => m[1]);
  assert.equal(lines.length, 1);
  assert.equal(lines[0], escapeHTML(`Still unclaimed: “${BOUNTIES[1].title}” and “${BOUNTIES[2].title}”.`));
  assert.ok(html.indexOf('bounties__answered') < html.indexOf('bounties__unclaimed'));
  assert.ok(html.indexOf('bounties__unclaimed') < html.indexOf('bounties__rank'));
});

test('unclaimed sentence is documented once in both guides, after the answered sentence', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  assert.ok(md.includes('“Every Notice Answered” feat. ' + SENTENCE));
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(SENTENCE)));
  assertEggFree(SENTENCE, 'unclaimed sentence');
});
