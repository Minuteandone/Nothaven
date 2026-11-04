import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATS, WANDERERS, featStatus, featsEarned, featsScene } from '../src/scenes/feats.js';
import { ENEMIES } from '../src/data/enemies.js';
import { createInitialState } from '../src/state.js';
import { DRILL_FOES } from '../src/scenes/drills.js';

const EGG_RE = /\b(eggs?|yolks?|shells?|hatch\w*|nests?|chicks?|hens?|omelet\w*|scrambl\w*|clutch|poach\w*|fried|easter|oval|boil\w*|crack\w*|golden|birds?|feathers?|basket)\b/i;

test('a fresh journey has earned no feats', () => {
  assert.equal(featsEarned(createInitialState()), 0);
  assert.equal(featStatus(createInitialState()).length, FEATS.length);
});

test('feats unlock from story flags, party, bestiary and level', () => {
  const s = createInitialState();
  s.story.stage = 'complete'; s.story.ending = 'share_signal';
  Object.assign(s.story.flags, { rescue_reward: true, relay_choice: 'route_network', victory_stormcrown_tyrant: true,
    spire_reward: true, victory_storm_heart: true, victory_last_squall: true, watch_reward: true,
    commission_tamsin_reward: true, commission_iven_reward: true, commission_bram_reward: true, commission_sela_reward: true });
  s.story.expedition = { active: null, completed: 3 };
  s.party = [{ ...s.party[0], level: 20 }, { id: 'bram' }, { id: 'iven' }];
  s.bestiary = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`foe_${i}`, 1]));
  for (const id of WANDERERS) s.bestiary[id] = 1;
  s.drillRecords = Object.fromEntries(DRILL_FOES.map(id => [id, { wins: 1, best: 9 }]));
  s.drillGauntlet = { runs: 1, best: DRILL_FOES.length };
  assert.equal(featsEarned(s), FEATS.length);
});

test('strict flags are not satisfied by truthy look-alikes', () => {
  const s = createInitialState();
  Object.assign(s.story.flags, { spire_reward: 'yes', victory_storm_heart: 1, victory_last_squall: 'true', watch_reward: 'yes' });
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

test('Yard Champion needs a drill win against every boss', () => {
  const s = createInitialState();
  const yard = () => featStatus(s).find(f => f.id === 'yard').done;
  assert.equal(yard(), false);
  s.drillRecords = Object.fromEntries(DRILL_FOES.slice(1).map(id => [id, { wins: 2, best: 5 }]));
  assert.equal(yard(), false, 'one boss still unbeaten in the yard');
  s.drillRecords[DRILL_FOES[0]] = { wins: 'lots', best: 3 };
  assert.equal(yard(), false, 'malformed records do not count');
  s.drillRecords[DRILL_FOES[0]] = { wins: 1, best: 3 };
  assert.equal(yard(), true);
  const row = FEATS.find(f => f.id === 'yard');
  assert.doesNotMatch(`${row.title} ${row.detail}`, EGG_RE);
});

test('Unbroken Run feat needs a full-length gauntlet best', () => {
  const s = createInitialState();
  const done = () => featStatus(s).find(f => f.id === 'gauntlet').done;
  assert.equal(done(), false);
  s.drillGauntlet = { runs: 4, best: DRILL_FOES.length - 1 };
  assert.equal(done(), false, 'one bout short does not count');
  s.drillGauntlet = { runs: 'x', best: 'all' };
  assert.equal(done(), false, 'malformed record does not count');
  s.drillGauntlet = { runs: 5, best: DRILL_FOES.length };
  assert.equal(done(), true);
  const row = FEATS.find(f => f.id === 'gauntlet');
  assert.doesNotMatch(`${row.title} ${row.detail}`, /egg|yolk|shell|hatch|nest|chick|omelet|scramble|cluck|hen\b/i);
});

test('Roadwise feat needs every frontier wanderer in the bestiary', () => {
  const s = createInitialState();
  const done = () => featStatus(s).find(f => f.id === 'wanderers').done;
  for (const id of WANDERERS) assert.ok(ENEMIES[id] && !ENEMIES[id].boss, `${id} is a real non-boss foe`);
  assert.equal(done(), false);
  s.bestiary = { briar_boar: 2, lens_wisp: 1, wrack_eel: 1 };
  assert.equal(done(), false, 'three of four is not enough');
  s.bestiary.rime_wight = 0;
  assert.equal(done(), false, 'a zero count does not count');
  s.bestiary.rime_wight = 1;
  assert.equal(done(), true);
  s.bestiary = null;
  assert.equal(done(), false, 'missing bestiary is safe');
  const row = FEATS.find(f => f.id === 'wanderers');
  assert.doesNotMatch(`${row.title} ${row.detail}`, EGG_RE);
});
