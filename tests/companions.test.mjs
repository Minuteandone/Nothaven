import test from 'node:test';
import assert from 'node:assert/strict';
import { COMPANIONS, MAX_PARTY, recruitCompanion, dismissCompanion, createCompanionMember, isUnlocked } from '../src/party/companions.js';
import { createCombat, heroAction, companionTurn, enemyTurn } from '../src/combat/rules.js';
import { musterScene } from '../src/scenes/muster.js';
import { combatScene } from '../src/scenes/combat.js';
import { createInitialState } from '../src/state.js';
import { migrateSave } from '../src/core/save.js';
import { GROWTH, xpForLevel, xpToNext } from '../src/core/progression.js';
import { assertEggFree } from './eggGuard.mjs';

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
  assert.match(lines[0], /Spark for 15/);
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
  // Word-boundary guard from the shared module: catches 'henhouse', 'the hen.'
  // and compound smuggling ('eggshell') that the old substring list missed.
  assertEggFree(JSON.stringify(COMPANIONS), 'COMPANIONS data');
});

test('enemy specials can target companions and inflict their status', () => {
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
  assert.deepEqual(tamsin.statuses, ['bleeding']);
  assert.equal(c.allyTimers.tamsin.bleeding, 2);
});

test('rescued settlers unlock from chapter two rescue victories', () => {
  const s = createInitialState();
  assert.equal(isUnlocked(s, 'bram'), false);
  assert.equal(isUnlocked(s, 'sela'), false);
  assert.equal(recruitCompanion(s, 'bram').ok, false);
  s.story.flags.rescue_victory_coast = true;
  assert.equal(recruitCompanion(s, 'bram').ok, true);
  assert.equal(recruitCompanion(s, 'sela').ok, false, 'sela still locked');
  s.story.flags.rescue_victory_heights = true;
  assert.equal(recruitCompanion(s, 'sela').ok, true);
  assert.equal(s.party.length, MAX_PARTY);
});

test('guardian Shield Bash stuns ordinary foes but not bosses', () => {
  const bram = createCompanionMember('bram', 1);
  const c = createCombat({ enemyId: 'ridge_bandit' });
  const hp0 = c.enemy.hp;
  const lines = companionTurn(c, bram, [bram], fixed(0));
  assert.match(lines[0], /Bram lands a Shield Bash/);
  assert.ok(c.enemy.hp < hp0);
  assert.match(lines[1], /is stunned/);
  const boss = createCombat({ enemyId: 'tide_wraith' });
  const bossLines = companionTurn(boss, bram, [bram], fixed(0));
  assert.match(bossLines[0], /Shield Bash/);
  assert.equal(bossLines.length, 1, 'bosses are never stunned');
});

test('signaler Signal Flare spends 3 MP and ignores defense', () => {
  const sela = createCompanionMember('sela', 1);
  const c = createCombat({ enemyId: 'rust_sentinel' });
  const mp0 = sela.mp, hp0 = c.enemy.hp;
  const lines = companionTurn(c, sela, [sela], fixed(0));
  assert.match(lines[0], /Sela hurls a Signal Flare for 7/);
  assert.equal(sela.mp, mp0 - 3);
  assert.equal(c.enemy.hp, hp0 - 7);
  sela.mp = 2;
  const plain = companionTurn(c, sela, [sela], fixed(0.9));
  assert.doesNotMatch(plain[0], /Signal Flare/);
});

test('muster board lists all four companions', () => {
  const s = createInitialState();
  const html = musterScene.render({ state: s, musterMessage: '' });
  for (const name of ['Tamsin', 'Iven', 'Bram', 'Sela']) assert.ok(html.includes(name), name);
});

test('enemy specials inflict statuses on companions; bleeding ticks and expires', async () => {
  const { afterHeroAction, tickAllyStatuses } = await import('../src/combat/rules.js');
  const hero = createInitialState().party[0];
  const tam = createCompanionMember('tamsin', 1);
  const c = createCombat({ enemyId: 'ridge_bandit' });
  // rng 0.9 -> picks living[1] (tamsin) of 2; 0 -> special fires
  const seq = [0.9, 0, 0.5];
  let i = 0; const rng = () => seq[i++] ?? 0.5;
  const lines = enemyTurn(c, hero, rng, [hero, tam]);
  assert.ok(tam.statuses.includes('bleeding'), lines.join('|'));
  assert.ok(lines.some((l) => /Tamsin is bleeding!/.test(l)));
  const hp = tam.hp;
  const t1 = tickAllyStatuses(c, [hero, tam], hero);
  assert.equal(tam.hp, hp - 2);
  assert.ok(t1.some((l) => /bleeds for 2/.test(l)));
  for (let k = 0; k < 5; k++) tickAllyStatuses(c, [hero, tam], hero);
  assert.ok(!tam.statuses.includes('bleeding'), 'bleeding expires');
  assert.equal(typeof afterHeroAction, 'function');
});

test('shocked keeper cannot Mend and attacks instead; shocked signaler cannot flare', () => {
  const hero = createInitialState().party[0];
  hero.hp = 3;
  const iven = createCompanionMember('iven', 1);
  iven.statuses = ['shocked'];
  const c = createCombat({ enemyId: 'storm_rat' });
  const mp = iven.mp;
  const lines = companionTurn(c, iven, [hero, iven], fixed(0.5));
  assert.equal(iven.mp, mp);
  assert.ok(lines.some((l) => /strikes for/.test(l)), lines.join('|'));
  const sela = createCompanionMember('sela', 1);
  sela.statuses = ['shocked'];
  const smp = sela.mp;
  companionTurn(c, sela, [hero, sela], fixed(0.5));
  assert.equal(sela.mp, smp);
});

test('combat render shows companion status chips', () => {
  const g = { state: createInitialState(), scenes: {}, combatMenu: 'main' };
  const tam = createCompanionMember('tamsin', 1);
  tam.statuses = ['bleeding'];
  g.state.party.push(tam);
  g.state.combat = createCombat({ enemyId: 'storm_rat' });
  const html = combatScene.render(g);
  const ally = html.slice(html.indexOf('unit ally'));
  assert.match(ally, /class="status">bleeding/);
});
