import test from 'node:test';
import assert from 'node:assert/strict';
import { FEATS, WANDERERS, FIELD_TRIALS, featStatus, featsEarned, featsScene } from '../src/scenes/feats.js';
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
    spire_reward: true, victory_storm_heart: true, victory_last_squall: true, watch_reward: true, calibration_reward: true,
    commission_tamsin_reward: true, commission_iven_reward: true, commission_bram_reward: true, commission_sela_reward: true });
  s.story.expedition = { active: null, completed: 3 };
  s.party = [{ ...s.party[0], level: 20 }, { id: 'bram' }, { id: 'iven' }];
  s.bestiary = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [`foe_${i}`, 1]));
  for (const id of WANDERERS) s.bestiary[id] = 1;
  s.bestiary.old_tusk = 1;
  s.bestiary.gloomfin = 1;
  s.bestiary.frostmane = 1;
  s.bestiary.lenswarden = 1;
  s.bestiary.cinderclaw = 1;
  s.bestiary.thunderhoof = 1;
  s.drillRecords = Object.fromEntries(DRILL_FOES.map(id => [id, { wins: 1, best: 9 }]));
  s.drillGauntlet = { runs: 1, best: DRILL_FOES.length };
  s.ledger = { victories: 20, comebacks: 1, bestStreak: 15 };
  s.party[0].temper = { weapon: 3, armor: 3 };
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

test('Tusk Breaker feat needs an Old Tusk defeat in the bestiary', () => {
  const s = createInitialState();
  const done = () => featStatus(s).find(f => f.id === 'tusk').done;
  assert.ok(ENEMIES.old_tusk && ENEMIES.old_tusk.boss === true);
  assert.equal(done(), false);
  s.bestiary = { old_tusk: 0, briar_boar: 3 };
  assert.equal(done(), false, 'zero or other boars do not count');
  s.bestiary.old_tusk = 1;
  assert.equal(done(), true);
  s.bestiary = 'broken';
  assert.equal(done(), false, 'bad bestiary is safe');
  const row = FEATS.find(f => f.id === 'tusk');
  assert.doesNotMatch(`${row.title} ${row.detail}`, EGG_RE);
});

test('Seawall Sentinel feat needs a Gloomfin defeat in the bestiary', () => {
  const s = createInitialState();
  const done = () => featStatus(s).find(f => f.id === 'gloomfin').done;
  assert.ok(ENEMIES.gloomfin && ENEMIES.gloomfin.boss === true);
  assert.equal(done(), false);
  s.bestiary = { gloomfin: 0, wrack_eel: 4 };
  assert.equal(done(), false, 'zero or ordinary eels do not count');
  s.bestiary.gloomfin = 1;
  assert.equal(done(), true);
  s.bestiary = null;
  assert.equal(done(), false, 'missing bestiary is safe');
  const row = FEATS.find(f => f.id === 'gloomfin');
  assert.doesNotMatch(`${row.title} ${row.detail}`, EGG_RE);
});

test('Packbreaker feat needs a Frostmane defeat in the bestiary', () => {
  const s = createInitialState();
  const done = () => featStatus(s).find(f => f.id === 'frostmane').done;
  assert.ok(ENEMIES.frostmane && ENEMIES.frostmane.boss === true);
  assert.equal(done(), false);
  s.bestiary = { frostmane: 0, frost_wolf: 6 };
  assert.equal(done(), false, 'zero or ordinary wolves do not count');
  s.bestiary.frostmane = 1;
  assert.equal(done(), true);
  s.bestiary = null;
  assert.equal(done(), false, 'missing bestiary is safe');
  const row = FEATS.find(f => f.id === 'frostmane');
  assert.doesNotMatch(`${row.title} ${row.detail}`, EGG_RE);
});

test('Vault Keeper feat needs a Lenswarden defeat in the bestiary', () => {
  const s = createInitialState();
  const done = () => featStatus(s).find(f => f.id === 'lenswarden').done;
  assert.ok(ENEMIES.lenswarden && ENEMIES.lenswarden.boss === true);
  assert.equal(done(), false);
  s.bestiary = { lenswarden: 0, rust_sentinel: 4 };
  assert.equal(done(), false, 'zero or ordinary constructs do not count');
  s.bestiary.lenswarden = 1;
  assert.equal(done(), true);
  s.bestiary = null;
  assert.equal(done(), false, 'missing bestiary is safe');
  const row = FEATS.find(f => f.id === 'lenswarden');
  assert.doesNotMatch(`${row.title} ${row.detail}`, EGG_RE);
});

test('Trial Warden feat needs all four field trials in the bestiary', () => {
  const s = createInitialState();
  const done = () => featStatus(s).find(f => f.id === 'trials').done;
  for (const id of FIELD_TRIALS) assert.ok(ENEMIES[id] && ENEMIES[id].boss === true && ENEMIES[id].drill === false, id);
  assert.equal(done(), false);
  s.bestiary = { old_tusk: 1, gloomfin: 2, frostmane: 1, lenswarden: 0 };
  assert.equal(done(), false, 'three trials are not enough');
  s.bestiary.lenswarden = 1;
  assert.equal(done(), true);
  s.bestiary = null;
  assert.equal(done(), false, 'missing bestiary is safe');
  const ids = FEATS.map(f => f.id);
  assert.equal(ids.indexOf('trials'), ids.indexOf('lenswarden') + 1);
  const row = FEATS.find(f => f.id === 'trials');
  assert.doesNotMatch(`${row.title} ${row.detail}`, EGG_RE);
});

test('Well Fitted needs both fittings at +3 on the same member, in party or reserve', () => {
  const earned = s => featStatus(s).find(f => f.id === 'fitted').done;
  const s = createInitialState();
  assert.equal(earned(s), false);
  s.party[0].temper = { weapon: 3, armor: 2 };
  assert.equal(earned(s), false);
  s.party.push({ id: 'iven', temper: { weapon: 0, armor: 3 } });
  assert.equal(earned(s), false, 'split across members does not count');
  s.party[0].temper = { weapon: 3, armor: '3' };
  assert.equal(earned(s), false, 'non-integer levels are ignored');
  s.reserve = { bram: { id: 'bram', temper: { weapon: 3, armor: 3 } } };
  assert.equal(earned(s), true);
});

test('Dune Breaker feat needs a Cinderclaw defeat and sits last', () => {
  const s = createInitialState();
  const done = () => featStatus(s).find(f => f.id === 'cinderclaw').done;
  assert.equal(done(), false);
  s.bestiary = { cinderclaw: 0, old_tusk: 1, gloomfin: 1, frostmane: 1, lenswarden: 1 };
  assert.equal(done(), false, 'the four field trials do not count');
  s.bestiary.cinderclaw = 1;
  assert.equal(done(), true);
  s.bestiary = null;
  assert.equal(done(), false, 'missing bestiary is safe');
  assert.equal(FEATS[FEATS.length - 3].id, 'cinderclaw');
  assert.ok(!FIELD_TRIALS.includes('cinderclaw'));
});

test('True Interval feat needs the paid Signal Calibration report and sits last', () => {
  const s = createInitialState();
  const done = () => featStatus(s).find(f => f.id === 'calibration').done;
  assert.equal(done(), false);
  Object.assign(s.story.flags, { watch_reward: true, calibration_accepted: true, calibration_reference: true, calibration_spire: true, calibration_relay: true });
  assert.equal(done(), false, 'finished readings without the report do not count');
  s.story.flags.calibration_reward = 'yes';
  assert.equal(done(), false, 'strictly true');
  s.story.flags.calibration_reward = true;
  assert.equal(done(), true);
  assert.equal(FEATS[FEATS.length - 2].id, 'calibration');
  assert.equal(FEATS.length, 28);
});

test('Stampede Stopped feat needs a recorded Thunderhoof victory and sits last', () => {
  const s = createInitialState();
  const done = () => featStatus(s).find(f => f.id === 'thunderhoof').done;
  assert.equal(done(), false);
  s.bestiary = { thunderhoof: 0, cinderclaw: 1 };
  assert.equal(done(), false);
  s.bestiary.thunderhoof = 1;
  assert.equal(done(), true);
  assert.equal(FEATS[FEATS.length - 1].id, 'thunderhoof');
  assert.equal(FEATS[FEATS.length - 1].title, 'Stampede Stopped');
  assert.equal(FEATS.length, 28);
});
