import test from 'node:test';
import assert from 'node:assert/strict';
import { drillRecord, recordDrillWin, drillsScene, drillEntries } from '../src/scenes/drills.js';
import { combatScene } from '../src/scenes/combat.js';
import { createInitialState } from '../src/state.js';
import { migrateSave } from '../src/core/save.js';

const EGG_RE = /\b(eggs?|yolks?|shells?|hatch\w*|nests?|chicks?|hens?|omelet\w*|scrambl\w*|clutch|poach\w*|fried|easter|oval|boil\w*|crack\w*|golden|birds?|feathers?|basket)\b/i;

function makeGame(state) {
  const scenes = [];
  const game = {
    state, scenes: { town: {}, drills: drillsScene, combat: combatScene }, sceneCalls: scenes,
    combatRng: () => 0.5,
    bus: { emit() {}, on() {}, off() {} },
    setScene(name, data = {}) { scenes.push([name, data]); if (name === 'combat') combatScene.onEnter(game, data); if (name === 'drills') drillsScene.onEnter(game, data); },
  };
  return game;
}

test('records track wins and the fewest rounds, ignoring junk', () => {
  const s = createInitialState();
  assert.deepEqual(drillRecord(s, 'tide_wraith'), { wins: 0, best: 0 });
  assert.equal(recordDrillWin(s, 'storm_rat', 3), null, 'non-boss ids are ignored');
  assert.equal(recordDrillWin(s, 'tide_wraith', 6).newBest, true);
  assert.equal(recordDrillWin(s, 'tide_wraith', 9).newBest, false);
  const third = recordDrillWin(s, 'tide_wraith', 4);
  assert.deepEqual({ wins: third.wins, best: third.best, newBest: third.newBest }, { wins: 3, best: 4, newBest: true });
  s.drillRecords.pass_warlord = { wins: '2', best: -1 };
  assert.deepEqual(drillRecord(s, 'pass_warlord'), { wins: 0, best: 0 });
  assert.deepEqual(drillRecord({ drillRecords: 'x' }, 'tide_wraith'), { wins: 0, best: 0 });
  assert.equal(drillRecord(null, 'tide_wraith').wins, 0);
});

test('winning a drill in combat stores a record that survives a save round-trip', () => {
  const s = createInitialState();
  s.bestiary = { tide_wraith: 1 };
  const g = makeGame(s);
  for (let i = 0; i < 2; i += 1) {
    drillsScene.actions.startDrill(g, { dataset: { arg: 'tide_wraith' } });
    s.combat.enemy.hp = 1;
    s.party[0].atk = 999;
    combatScene.actions.attack(g);
    assert.equal(s.combat.over, 'victory');
    combatScene.actions.finish(g);
  }
  assert.deepEqual(drillRecord(s, 'tide_wraith'), { wins: 2, best: 1 });
  const loaded = migrateSave(JSON.parse(JSON.stringify(s)), createInitialState);
  assert.deepEqual(drillRecord(loaded, 'tide_wraith'), { wins: 2, best: 1 });
  assert.equal(drillEntries(loaded)[0].record.wins, 2);
});

test('drills screen shows the record line and stays egg-free', () => {
  const s = createInitialState();
  s.bestiary = { tide_wraith: 1, pass_warlord: 1 };
  recordDrillWin(s, 'tide_wraith', 1);
  const g = makeGame(s);
  drillsScene.onEnter(g, {});
  const html = drillsScene.render(g);
  assert.ok(html.includes('Won 1 time · best 1 round'));
  assert.ok(html.includes('No drills won yet.'));
  assert.ok(!EGG_RE.test(html.replace(/<[^>]*>/g, ' ')));
});
