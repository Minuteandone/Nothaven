import test from 'node:test';
import assert from 'node:assert/strict';
import { GAUNTLET_MIN, gauntletQueue, gauntletReady, gauntletRecord, recordGauntlet, validGauntlet, drillsScene } from '../src/scenes/drills.js';
import { combatScene } from '../src/scenes/combat.js';
import { createInitialState } from '../src/state.js';
import { migrateSave } from '../src/core/save.js';

const EGG_RE = /\b(eggs?|yolks?|shells?|hatch\w*|nests?|chicks?|hens?|omelet\w*|scrambl\w*|clutch|poach\w*|fried|easter|oval|boil\w*|crack\w*|golden|birds?|feathers?|basket)\b/i;
const THREE = { tide_wraith: 1, pass_warlord: 2, drowned_harbormaster: 1 };

function makeGame(state) {
  const events = [], calls = [];
  const game = {
    state, events, sceneCalls: calls, scenes: { town: {}, drills: drillsScene, combat: combatScene },
    combatRng: () => 0.5,
    bus: { emit: (k, e) => events.push([k, e]), on() {}, off() {} },
    setScene(name, data = {}) { calls.push([name, data]); if (name === 'combat') combatScene.onEnter(game, data); if (name === 'drills') drillsScene.onEnter(game, data); },
  };
  return game;
}

const strong = (s) => Object.assign(s.party[0], { atk: 999, def: 999, maxHp: 9999, hp: 9999 });
const strip = (html) => html.replace(/<[^>]*>/g, ' ');

test('gauntlet opens at three unlocked drills and records sanitize junk', () => {
  const s = createInitialState();
  assert.equal(GAUNTLET_MIN, 3);
  s.bestiary = { tide_wraith: 1, pass_warlord: 1 };
  assert.equal(gauntletReady(s), false);
  const g = makeGame(s);
  drillsScene.actions.startGauntlet(g);
  assert.equal(g.sceneCalls.length, 0);
  assert.match(strip(drillsScene.render(g)), /Unlock 3 drills/);
  s.bestiary = { ...THREE, storm_rat: 9 };
  assert.deepEqual(gauntletQueue(s), ['tide_wraith', 'pass_warlord', 'drowned_harbormaster']);
  assert.deepEqual(gauntletRecord({ drillGauntlet: { runs: 'x', best: 9 } }), { runs: 0, best: 0 });
  assert.deepEqual(recordGauntlet(s, 2), { runs: 1, best: 2, newBest: true });
  assert.deepEqual(recordGauntlet(s, 1), { runs: 2, best: 2, newBest: false });
  assert.equal(validGauntlet({ queue: ['storm_rat'], index: 0 }, 'storm_rat'), false);
  assert.equal(validGauntlet({ queue: ['tide_wraith'], index: 1 }, 'tide_wraith'), false);
  assert.equal(validGauntlet({ queue: ['tide_wraith'], index: 0 }, 'tide_wraith'), true);
});

test('a full gauntlet chains bouts, keeps HP between them, and records the run', () => {
  const s = createInitialState();
  s.bestiary = { ...THREE };
  strong(s);
  const g = makeGame(s);
  const before = JSON.stringify({ gold: s.gold, inv: s.inventory, best: s.bestiary, story: s.story });
  drillsScene.actions.startGauntlet(g);
  const order = [];
  for (let bout = 0; bout < 3; bout++) {
    const c = s.combat;
    assert.equal(c.drill, true);
    assert.equal(c.gauntlet.index, bout);
    assert.ok(c.log.some((l) => l === `Yard Gauntlet — bout ${bout + 1} of 3.`));
    order.push(c.enemy.id);
    for (let t = 0; !c.over && t < 20; t++) combatScene.actions.attack(g);
    assert.equal(c.over, 'victory');
    if (bout === 0) s.party[0].hp = 5000; // wounds must carry into the next bout
    combatScene.actions.finish(g);
    if (bout === 0) assert.equal(s.party[0].hp, 5000);
  }
  assert.deepEqual(order, ['tide_wraith', 'pass_warlord', 'drowned_harbormaster']);
  assert.equal(s.combat, null);
  assert.equal(g.sceneCalls.at(-1)[0], 'drills');
  assert.match(g.drillsMessage, /Gauntlet complete! You beat all 3 foes/);
  assert.deepEqual(gauntletRecord(s), { runs: 1, best: 3 });
  assert.equal(s.drillRecords.pass_warlord.wins, 1);
  assert.equal(g.events.filter(([k]) => k === 'combat:victory').length, 0);
  assert.equal(JSON.stringify({ gold: s.gold, inv: s.inventory, best: s.bestiary, story: s.story }), before);
  const restored = migrateSave(JSON.parse(JSON.stringify(s)), createInitialState);
  assert.deepEqual(gauntletRecord(restored), { runs: 1, best: 3 });
  const text = strip(drillsScene.render(g));
  assert.match(text, /Best run: 3 foes beaten · 1 attempt/);
  assert.doesNotMatch(text, EGG_RE);
});

test('losing mid-gauntlet ends the run, revives the party and costs no gold', () => {
  const s = createInitialState();
  s.bestiary = { ...THREE };
  strong(s);
  const g = makeGame(s);
  const gold = s.gold;
  drillsScene.actions.startGauntlet(g);
  for (let t = 0; !s.combat.over && t < 20; t++) combatScene.actions.attack(g);
  combatScene.actions.finish(g);
  assert.equal(s.combat.gauntlet.index, 1);
  Object.assign(s.party[0], { atk: 1, def: 0, hp: 1 });
  for (let t = 0; !s.combat.over && t < 50; t++) combatScene.actions.defend(g);
  assert.equal(s.combat.over, 'defeat');
  combatScene.actions.finish(g);
  assert.equal(g.sceneCalls.at(-1)[0], 'drills');
  assert.match(g.drillsMessage, /ends after 1 of 3 foes/);
  assert.ok(s.party[0].hp >= 1);
  assert.equal(s.gold, gold);
  assert.deepEqual(gauntletRecord(s), { runs: 1, best: 1 });
});

test('a forged gauntlet payload is ignored by combat', () => {
  const s = createInitialState();
  s.bestiary = { ...THREE };
  const g = makeGame(s);
  g.setScene('combat', { enemyId: 'tide_wraith', encounterId: null, returnScene: 'drills', drill: true, gauntlet: { queue: ['storm_rat', 'tide_wraith'], index: 1 } });
  assert.equal(s.combat.gauntlet, undefined);
});
