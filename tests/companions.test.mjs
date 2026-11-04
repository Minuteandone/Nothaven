import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANIONS, MAX_PARTY, recruitCompanion, dismissCompanion, createCompanionMember, isUnlocked } from '../src/party/companions.js';
import { createCombat, heroAction, companionTurn, enemyTurn } from '../src/combat/rules.js';
import { musterScene } from '../src/scenes/muster.js';
import { combatScene } from '../src/scenes/combat.js';
import { createInitialState } from '../src/state.js';
import { migrateSave } from '../src/core/save.js';
import { GROWTH, xpForLevel, xpToNext } from '../src/core/progression.js';

const fixed = (v) => () => v;
const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };

function unlockedState() {
  const s = createInitialState();
  s.story.flags.victory_ridge_patrol = true;
  s.story.flags.victory_observatory_sentinel = true;
  return s;
}

test('companions are locked until their story victory', () => {
  const s = createInitialState();
  assert.equal(isUnlocked(s, 'tamsin'), false);
  const r = recruitCompanion(s, 'tamsin');
  assert.equal(r.ok, false);
  assert.equal(s.party.length, 1);
  s.story.flags.victory_ridge_patrol = true;
  assert.equal(recruitCompanion(s, 'tamsin').ok, true);
  assert.equal(s.party[1].id, 'tamsin');
  assert.equal(recruitCompanion(s, 'iven').ok, false, 'iven still locked');
});

test('recruit rejects unknown, inherited and duplicate ids and respects MAX_PARTY', () => {
  const s = unlockedState();
  assert.equal(recruitCompanion(s, 'constructor').ok, false);
  assert.equal(recruitCompanion(s, 'nobody').ok, false);
  assert.equal(recruitCompanion(s, 'tamsin').ok, true);
  assert.equal(recruitCompanion(s, 'tamsin').ok, false);
  assert.equal(recruitCompanion(s, 'iven').ok, true);
  assert.equal(s.party.length, MAX_PARTY);
});

test('dismissed companions keep their progress in reserve', () => {
  const s = unlockedState();
  recruitCompanion(s, 'tamsin');
  s.party[1].xp = 12; s.party[1].level = 2;
  assert.equal(dismissCompanion(s, 'tamsin').ok, true);
  assert.equal(s.party.length, 1);
  assert.equal(s.reserve.tamsin.xp, 12);
  assert.equal(dismissCompanion(s, 'hero').ok, false, 'cannot dismiss the hero');
  recruitCompanion(s, 'tamsin');
  assert.equal(s.party[1].level, 2);
  assert.equal(s.reserve.tamsin, undefined);
});

test('new companions scale to the hero level', () => {
  const m = createCompanionMember('iven', 3);
  assert.equal(m.level, 3);
  assert.equal(m.maxHp, COMPANIONS.iven.stats.hp + 2 * GROWTH.maxHp);
  assert.equal(m.maxMp, COMPANIONS.iven.stats.mp + 2 * GROWTH.maxMp);
  assert.equal(m.hp, m.maxHp);
});

test('late recruits start on the cumulative XP curve', () => {
  const m = createCompanionMember('iven', 3);
  assert.equal(m.xp, xpForLevel(3));
  assert.equal(xpToNext(m), xpForLevel(4) - xpForLevel(3));
  assert.equal(createCompanionMember('tamsin', 1).xp, 0);
});

test('keeper mends the most wounded ally; scout aimed shot', () => {
  const s = unlockedState();
  recruitCompanion(s, 'tamsin'); recruitCompanion(s, 'iven');
  const [hero, tamsin, iven] = s.party;
  hero.hp = 5;
  const c = createCombat({ enemyId: 'ridge_bandit' });
  const lines = companionTurn(c, iven, s.party, fixed(0.5));
  assert.match(lines[0], /Iven uses Mend on Wren/);
  assert.ok(hero.hp > 5);
  const hp0 = c.enemy.hp;
  const shot = companionTurn(c, tamsin, s.party, fixed(0.1));
  assert.match(shot[0], /Aimed Shot/);
  assert.ok(c.enemy.hp < hp0);
});

test('keeper sparks constructs when nobody needs healing', () => {
  const iven = createCompanionMember('iven', 1);
  const c = createCombat({ enemyId: 'rust_sentinel' });
  const lines = companionTurn(c, iven, [iven], fixed(0));
  assert.match(lines[0], /Spark for 20/);
});

test('companions act after the hero and before the enemy', () => {
  const s = unlockedState();
  recruitCompanion(s, 'tamsin');
  const c = createCombat({ enemyId: 'ridge_bandit' });
  const r = heroAction(c, s.party[0], { type: 'attack' }, fixed(0.99), s.party);
  assert.ok(r.ok);
  const iHero = r.lines.findIndex((l) => l.startsWith('Wren strikes'));
  const iTam = r.lines.findIndex((l) => l.startsWith('Tamsin'));
  const iEnemy = r.lines.findIndex((l) => l.startsWith('Ridge'));
  assert.ok(iHero >= 0 && iTam > iHero && iEnemy > iTam, r.lines.join(' | '));
});

test('enemy can target companions; knocked-out allies revive at 1 HP after battle', () => {
  const s = unlockedState();
  recruitCompanion(s, 'tamsin');
  const tamsin = s.party[1];
  tamsin.hp = 1;
  const c = createCombat({ enemyId: 'storm_rat' });
  // first rng picks target index 1 (tamsin), then damage variance
  const lines = enemyTurn(c, s.party[0], seq(0.9, 0.5), s.party);
  assert.match(lines.join(' '), /Tamsin is knocked out/);
  assert.equal(c.over, null, 'a downed companion does not end the battle');
  const g = { state: s, scenes: { town: {} }, bus: { emit() {} }, setScene(n) { g.last = n; } };
  s.combat = c; c.over = 'fled';
  combatScene.actions.finish(g);
  assert.equal(tamsin.hp, 1);
});

test('muster scene renders and recruits', () => {
  const s = unlockedState();
  const g = { state: s, scenes: { town: {} }, setScene(n) { g.last = n; } };
  musterScene.onEnter(g, {});
  assert.match(musterScene.render(g), /Muster Board/);
  musterScene.actions.recruit(g, { dataset: { arg: 'iven' } });
  assert.equal(s.party[1].id, 'iven');
  assert.match(musterScene.render(g), /Iven joins the party/);
  musterScene.actions.leave(g);
  assert.equal(g.last, 'town');
});

test('companions and reserve survive save migration', () => {
  const s = unlockedState();
  recruitCompanion(s, 'tamsin'); recruitCompanion(s, 'iven'); dismissCompanion(s, 'iven');
  const loaded = migrateSave(JSON.parse(JSON.stringify(s)), createInitialState);
  assert.equal(loaded.party[1].id, 'tamsin');
  assert.equal(loaded.party[1].role, 'scout');
  assert.equal(loaded.reserve.iven.id, 'iven');
});

test('companion text contains no egg references', () => {
  const text = JSON.stringify(COMPANIONS).toLowerCase();
  for (const w of ['egg', 'yolk', 'hatch', 'nest', 'chick', 'omelet', 'shell', 'hen ']) assert.ok(!text.includes(w), w);
});

test('enemy specials can target companions (damage only, no status)', () => {
  const s = unlockedState();
  recruitCompanion(s, 'tamsin');
  const tamsin = s.party[1];
  const c = createCombat({ enemyId: 'storm_rat' });
  c.enemy.ability = { name: 'Gnaw', chance: 1, mult: 2, status: 'bleeding', turns: 2 };
  const before = tamsin.hp;
  // target index 1 (tamsin), special roll succeeds, damage variance
  const lines = enemyTurn(c, s.party[0], seq(0.9, 0.0, 0.5), s.party);
  assert.match(lines.join(' '), /uses Gnaw! Tamsin takes/);
  assert.ok(tamsin.hp < before);
  assert.deepEqual(tamsin.statuses, []);
});
