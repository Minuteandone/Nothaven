import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATS, featStatus, featsEarned, featsScene } from '../src/scenes/feats.js';
import { createInitialState } from '../src/state.js';

const EGG_RE = /\b(eggs?|yolks?|shells?|hatch\w*|nests?|chicks?|hens?|omelet\w*|scrambl\w*|clutch|poach\w*|fried|easter|oval|boil\w*|crack\w*|golden|birds?|feathers?|basket)\b/i;

test('a fresh journey has earned no feats', () => {
  assert.equal(featsEarned(createInitialState()), 0);
  assert.equal(featStatus(createInitialState()).length, FEATS.length);
});

test('feats unlock from story flags, party, bestiary and level', () => {
  const s = createInitialState();
  s.story.stage = 'complete'; s.story.ending = 'share_signal';
  Object.assign(s.story.flags, { rescue_reward: true, relay_choice: 'route_network', victory_stormcrown_tyrant: true,
    spire_reward: true, victory_storm_heart: true, victory_last_squall: true,
    commission_tamsin_reward: true, commission_iven_reward: true, commission_bram_reward: true, commission_sela_reward: true });
  s.story.expedition = { active: null, completed: 3 };
  s.party = [{ ...s.party[0], level: 20 }, { id: 'bram' }, { id: 'iven' }];
  s.bestiary = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`foe_${i}`, 1]));
  assert.equal(featsEarned(s), FEATS.length);
});

test('strict flags are not satisfied by truthy look-alikes', () => {
  const s = createInitialState();
  Object.assign(s.story.flags, { spire_reward: 'yes', victory_storm_heart: 1, victory_last_squall: 'true' });
  const done = featStatus(s).filter(f => f.done).map(f => f.id);
  assert.deepEqual(done, []);
});

test('malformed state never throws', () => {
  for (const bad of [null, undefined, {}, { story: null, party: 'x', bestiary: [] }]) {
    assert.equal(featsEarned(bad), 0);
  }
});

test('scene renders a count, returns to the right place, and is egg-free', () => {
  const calls = [];
  const game = { state: createInitialState(), scenes: { town: {}, explore: {} }, setScene: (n) => calls.push(n) };
  featsScene.onEnter(game, { returnScene: 'explore' });
  const html = featsScene.render(game);
  assert.match(html, /0 of \d+ feats earned/);
  assert.match(html, /Back to expedition/);
  featsScene.actions.closeFeats(game);
  assert.deepEqual(calls, ['explore']);
  featsScene.onEnter(game, { returnScene: 'combat' });
  assert.equal(game.featsReturn, 'town');
  const text = FEATS.map(f => `${f.title} ${f.detail}`).join(' ') + html.replace(/<[^>]*>/g, ' ');
  assert.ok(!EGG_RE.test(text), String(text.match(EGG_RE)));
});
