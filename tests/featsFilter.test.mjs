import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATS, FEAT_FILTERS, featFilterOf, filterFeatRows, featStatus, featsScene } from '../src/scenes/feats.js';
import { createInitialState } from '../src/state.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const earnedState = () => {
  const s = createInitialState();
  s.story.flags.rescue_reward = true;
  return s;
};
const makeGame = (state) => ({ state, scenes: { town: {}, explore: {} }, setScene() {} });
const shownTitles = (html) => [...html.matchAll(/<li class="feat[^"]*">[\s\S]*?<h2>([^<]*)<\/h2>/g)].map(m => m[1]);

test('filter ids are validated and fall back to all', () => {
  assert.deepEqual(FEAT_FILTERS, ['all', 'earned', 'pending']);
  for (const id of FEAT_FILTERS) assert.equal(featFilterOf(id), id);
  for (const bad of [undefined, null, '', 'EARNED', 'done', '__proto__', 'constructor', 1, {}]) assert.equal(featFilterOf(bad), 'all');
});

test('filterFeatRows splits earned and pending strictly without mutating', () => {
  const rows = [{ id: 'a', done: true }, { id: 'b', done: false }, { id: 'c', done: 'true' }, null];
  const copy = structuredClone(rows);
  assert.deepEqual(filterFeatRows(rows, 'earned').map(r => r.id), ['a']);
  assert.deepEqual(filterFeatRows(rows, 'pending').map(r => r?.id), ['b', 'c', undefined]);
  assert.equal(filterFeatRows(rows, 'all').length, 4);
  assert.notEqual(filterFeatRows(rows, 'all'), rows);
  assert.deepEqual(rows, copy);
  assert.deepEqual(filterFeatRows(null, 'earned'), []);
});

test('scene filter shows the chosen feats, keeps the count, and resets on enter', () => {
  const state = earnedState();
  const before = structuredClone(state);
  const game = makeGame(state);
  featsScene.onEnter(game, {});
  const status = featStatus(state);
  const earned = status.filter(r => r.done).map(r => r.title);
  assert.ok(earned.length >= 1 && earned.length < FEATS.length);
  let html = featsScene.render(game);
  assert.equal(shownTitles(html).length, FEATS.length);
  assert.match(html, /data-arg="all" aria-pressed="true"/);
  featsScene.actions.filterFeats(game, { dataset: { arg: 'earned' } });
  html = featsScene.render(game);
  assert.deepEqual(shownTitles(html), earned);
  assert.match(html, /data-arg="earned" aria-pressed="true"/);
  assert.match(html, new RegExp(`${earned.length} of ${FEATS.length} feats earned`));
  featsScene.actions.filterFeats(game, { dataset: { arg: 'pending' } });
  html = featsScene.render(game);
  assert.equal(shownTitles(html).length, FEATS.length - earned.length);
  assert.ok(!html.includes('feat--done'));
  featsScene.actions.filterFeats(game, { dataset: { arg: '<img>' } });
  assert.equal(game.featsFilter, 'all');
  featsScene.actions.filterFeats(game, { dataset: { arg: 'earned' } });
  featsScene.onEnter(game, {});
  assert.equal(game.featsFilter, 'all');
  featsScene.actions.closeFeats(game);
  assert.equal('featsFilter' in game, false);
  assert.deepEqual(state, before, 'filtering never changes saved progress');
});

test('empty filters show a message instead of a list, and text is clean', () => {
  const game = makeGame(createInitialState());
  featsScene.onEnter(game, {});
  featsScene.actions.filterFeats(game, { dataset: { arg: 'earned' } });
  const html = featsScene.render(game);
  assert.ok(!html.includes('feats__list'));
  assert.match(html, /class="feats__empty">No feats earned yet\./);
  assertEggFree(html.replace(/<[^>]*>/g, ' '), 'feats filter');
});
