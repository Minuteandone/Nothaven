import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FEATS, FEAT_PROGRESS, featProgressText, featsScene, WANDERERS } from '../src/scenes/feats.js';
import { DRILL_FOES } from '../src/scenes/drills.js';
import { BOUNTIES } from '../src/core/bounties.js';
import { createInitialState } from '../src/state.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'Feats that count toward a target, such as level, contracts or drill wins, show your progress beneath their description until earned (for example “Progress: 2 of 4.”).';

test('every progress entry names a real feat', () => {
  const ids = new Set(FEATS.map(f => f.id));
  for (const id of Object.keys(FEAT_PROGRESS)) assert.ok(ids.has(id), id);
  assert.ok(Object.isFrozen(FEAT_PROGRESS));
});

test('progress text on a fresh save, unknown ids and malformed saves', () => {
  const s = createInitialState();
  assert.equal(featProgressText(s, 'veteran'), 'Progress: 1 of 10.');
  assert.equal(featProgressText(s, 'legend'), 'Progress: 1 of 20.');
  assert.equal(featProgressText(s, 'muster'), 'Progress: 1 of 3.');
  assert.equal(featProgressText(s, 'wanderers'), `Progress: 0 of ${WANDERERS.length}.`);
  assert.equal(featProgressText(s, 'bounties'), `Progress: 0 of ${BOUNTIES.length}.`);
  assert.equal(featProgressText(s, 'yard'), `Progress: 0 of ${DRILL_FOES.length}.`);
  assert.equal(featProgressText(s, 'first_light'), null);
  assert.equal(featProgressText(s, 'nope'), null);
  assert.equal(featProgressText(s, 'toString'), null);
  assert.equal(featProgressText(null, 'catalogue'), 'Progress: 0 of 10.');
  assert.equal(featProgressText({ ledger: { bestStreak: -4 }, story: { expedition: { completed: 'x' } } }, 'steady_road'), 'Progress: 0 of 15.');
  assert.equal(featProgressText({ story: { expedition: { completed: 'x' } } }, 'expeditions'), 'Progress: 0 of 3.');
});

test('progress counts real records and caps at the target', () => {
  const s = createInitialState();
  s.bestiary = { briar_boar: 1, lens_wisp: 2, storm_rat: 0, old_tusk: 1 };
  s.ledger = { ...(s.ledger || {}), bestStreak: 22 };
  s.story.flags = { ...(s.story.flags || {}), commission_iven_reward: true, commission_bram_reward: 'yes' };
  s.drillRecords = { [DRILL_FOES[0]]: { wins: 2, best: 4 }, [DRILL_FOES[1]]: { wins: 0 } };
  s.bounties = { ...(s.bounties || {}), completed: { ridge_rats: 3, bandit_toll: 1, nope: 2 } };
  assert.equal(featProgressText(s, 'wanderers'), 'Progress: 2 of 4.');
  assert.equal(featProgressText(s, 'catalogue'), 'Progress: 3 of 10.');
  assert.equal(featProgressText(s, 'trials'), 'Progress: 1 of 4.');
  assert.equal(featProgressText(s, 'steady_road'), 'Progress: 15 of 15.');
  assert.equal(featProgressText(s, 'commissions'), 'Progress: 1 of 4.');
  assert.equal(featProgressText(s, 'yard'), `Progress: 1 of ${DRILL_FOES.length}.`);
  assert.equal(featProgressText(s, 'bounties'), `Progress: 2 of ${BOUNTIES.length}.`);
  assert.equal(featProgressText(s, 'fitted'), 'Progress: 0 of 6.');
  s.party[0].temper = { weapon: 2, armor: 1 };
  s.reserve = { ...(s.reserve || {}), ghost: { id: 'ghost', temper: { weapon: 3, armor: 2 } } };
  assert.equal(featProgressText(s, 'fitted'), 'Progress: 5 of 6.');
  s.reserve.ghost.temper = { weapon: 9, armor: 'x' };
  assert.equal(featProgressText(s, 'fitted'), 'Progress: 3 of 6.');
  for (const id of Object.keys(FEAT_PROGRESS)) { const t = featProgressText(s, id); if (t) assertEggFree(t, id); }
});

test('feats list shows progress only on unearned countable feats', () => {
  const s = createInitialState();
  s.bestiary = { briar_boar: 1, lens_wisp: 1, wrack_eel: 1, rime_wight: 1 };
  const html = featsScene.render({ state: s, featsReturn: 'town', scenes: {} });
  assert.match(html, /<p class="feat__progress">Progress: 1 of 10\.<\/p>/);
  assert.match(html, /<p class="feat__progress">Progress: 4 of 10\.<\/p>/);
  const roadwise = html.slice(html.indexOf('Roadwise'), html.indexOf('</li>', html.indexOf('Roadwise')));
  assert.ok(roadwise.includes('Earned') && !roadwise.includes('feat__progress'), 'earned feats hide progress');
  const first = html.slice(html.indexOf('First Light'), html.indexOf('</li>', html.indexOf('First Light')));
  assert.ok(!first.includes('feat__progress'));
});

test('player guide and in-game guide document feat progress', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(SENTENCE)));
  assertEggFree(SENTENCE, 'feat progress doc');
});
