import test from 'node:test';
import assert from 'node:assert/strict';
import { DRILL_FOES, drillEntries, drillUnlocked, drillXp, drillsScene } from '../src/scenes/drills.js';
import { combatScene } from '../src/scenes/combat.js';
import { ENEMIES } from '../src/data/enemies.js';
import { createInitialState } from '../src/state.js';

const EGG_RE = /\b(eggs?|yolks?|shells?|hatch\w*|nests?|chicks?|hens?|omelet\w*|scrambl\w*|clutch|poach\w*|fried|easter|oval|boil\w*|crack\w*|golden|birds?|feathers?|basket)\b/i;

function makeGame(state) {
  const events = [], scenes = [];
  const game = {
    state, events, scenes: { town: {}, drills: drillsScene, combat: combatScene }, sceneCalls: scenes,
    combatRng: () => 0.5,
    bus: { emit: (k, e) => events.push([k, e]), on() {}, off() {} },
    setScene(name, data = {}) { scenes.push([name, data]); if (name === 'combat') combatScene.onEnter(game, data); if (name === 'drills') drillsScene.onEnter(game, data); },
  };
  return game;
}

test('drill roster lists every boss and gates on bestiary defeats', () => {
  assert.deepEqual([...DRILL_FOES], Object.keys(ENEMIES).filter((id) => ENEMIES[id].boss === true && ENEMIES[id].drill !== false));
  assert.equal(DRILL_FOES.length, 7);
  assert.ok(!DRILL_FOES.includes('old_tusk'));
  assert.ok(DRILL_FOES.includes('tide_wraith') && DRILL_FOES.includes('last_squall'));
  const s = createInitialState();
  assert.ok(drillEntries(s).every((r) => !r.unlocked));
  s.bestiary = { tide_wraith: 1, pass_warlord: '3', storm_rat: 4 };
  assert.equal(drillUnlocked(s, 'tide_wraith'), true);
  assert.equal(drillUnlocked(s, 'pass_warlord'), false);
  assert.equal(drillUnlocked(s, 'storm_rat'), false);
  assert.equal(drillXp('tide_wraith'), Math.floor(ENEMIES.tide_wraith.xp / 2));
});

test('locked drills cannot be started', () => {
  const g = makeGame(createInitialState());
  drillsScene.actions.startDrill(g, { dataset: { arg: 'last_squall' } });
  assert.equal(g.sceneCalls.length, 0);
  assert.equal(g.state.combat ?? null, null);
});

test('a won drill grants half XP only and touches nothing else', () => {
  const s = createInitialState();
  s.bestiary = { tide_wraith: 1 };
  s.flags = { ...(s.flags || {}) };
  const g = makeGame(s);
  const before = JSON.stringify({ gold: s.gold, inv: s.inventory, best: s.bestiary, story: s.story, flags: s.flags });
  drillsScene.actions.startDrill(g, { dataset: { arg: 'tide_wraith' } });
  const c = s.combat;
  assert.equal(c.drill, true);
  assert.equal(c.encounterId, null);
  c.enemy.hp = 1;
  s.party[0].atk = 999;
  combatScene.actions.attack(g);
  assert.equal(c.over, 'victory');
  assert.deepEqual(c.rewards, { xp: drillXp('tide_wraith'), gold: 0, items: [] });
  assert.ok(c.log.some((l) => l.startsWith('Drill complete!')));
  assert.equal(g.events.filter(([k]) => k === 'combat:victory').length, 0);
  combatScene.actions.finish(g);
  assert.equal(JSON.stringify({ gold: s.gold, inv: s.inventory, best: s.bestiary, story: s.story, flags: s.flags }), before);
  assert.ok(s.party[0].level >= 2, 'tide wraith drill XP levels a fresh hero');
  assert.equal(g.sceneCalls.at(-1)[0], 'drills');
});

test('a lost drill keeps gold and location and returns to the yard', () => {
  const s = createInitialState();
  s.bestiary = { last_squall: 1 };
  s.gold = 500; s.location = 'storms_eye';
  const g = makeGame(s);
  drillsScene.actions.startDrill(g, { dataset: { arg: 'last_squall' } });
  s.combat.over = 'defeat'; s.party[0].hp = 0;
  combatScene.actions.finish(g);
  assert.equal(s.gold, 500);
  assert.equal(s.location, 'storms_eye');
  assert.ok(s.party[0].hp >= 1);
  assert.equal(g.sceneCalls.at(-1)[0], 'drills');
  assert.match(g.drillsMessage, /nothing is lost but pride/);
});

test('drill scene renders roster and is egg-free', () => {
  const s = createInitialState();
  s.bestiary = { tide_wraith: 2 };
  const g = makeGame(s);
  drillsScene.onEnter(g, { message: 'Drill complete. Mara nods and resets the targets.' });
  const html = drillsScene.render(g);
  assert.match(html, /Sparring Drills/);
  assert.match(html, /data-action="startDrill"/);
  assert.match(html, /Defeat this foe in the field first\./);
  const text = html.replace(/<[^>]*>/g, ' ');
  assert.ok(!EGG_RE.test(text), String(text.match(EGG_RE)));
});
