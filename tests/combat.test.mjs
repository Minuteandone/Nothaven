import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, heroAction, physicalDamage, knownSkills, enemyTurn, SKILLS } from '../src/combat/rules.js';
import { ENEMIES } from '../src/data/enemies.js';
import { combatScene } from '../src/scenes/combat.js';
import { createInitialState } from '../src/state.js';
import { isKnownItem } from '../src/items/items.js';

const seq = (...vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const fixed = (v) => () => v;
const hero = (o = {}) => ({ id: 'hero', name: 'Wren', hp: 30, maxHp: 30, mp: 10, maxMp: 10, atk: 6, def: 3, spd: 5, level: 1, xp: 0, statuses: [], ...o });

function fakeGame() {
  const events = [];
  const state = createInitialState();
  const g = {
    state, events, scenes: { town: {}, explore: {}, title: {}, combat: combatScene },
    bus: { emit: (k, e) => events.push([k, e]), on() {}, off() {} },
    combatRng: fixed(0.99),
    setScene(name, data) { g.last = { name, data }; state.scene = name; g.scenes[name]?.onEnter?.(g, data); },
  };
  return g;
}

test('physicalDamage: variance, minimum 1, ward halves', () => {
  assert.equal(physicalDamage(6, 1, fixed(0)), 4);        // 6-1-1
  assert.equal(physicalDamage(6, 1, fixed(0.99)), 7);     // 6-1+2
  assert.equal(physicalDamage(1, 50, fixed(0)), 1);
  assert.equal(physicalDamage(10, 0, fixed(0), { warded: true }), 4);
  assert.equal(physicalDamage(10, 0, fixed(0), { mult: 1.6 }), 15);
});

test('every enemy is well formed and drops only known items', () => {
  for (const e of Object.values(ENEMIES)) {
    for (const k of ['hp', 'atk', 'def', 'spd', 'xp', 'gold']) assert.ok(Number.isFinite(e[k]), `${e.id}.${k}`);
    for (const l of e.loot || []) assert.ok(isKnownItem(l.id), `${e.id} drops unknown ${l.id}`);
  }
});

test('enemy and skill text contains no egg references', () => {
  const banned = /\b(eggs?|yolks?|shells?|hatch\w*|nests?|chicks?|hens?|omelet\w*|scrambl\w*|humpty|benedict|faberg\w*|clutch|incubat\w*|ovum|oeuf|huevo|quail|poach\w*|fried|devil\w*|albumen|easter|roosters?|goose|oval|sunny|boil\w*|crack\w*|whisk|cackl\w*)\b/i;
  const text = JSON.stringify({ ENEMIES, SKILLS });
  assert.ok(!banned.test(text), `banned word: ${text.match(banned)?.[0]}`);
  assert.ok(!/[\u{1F95A}\u{1F423}\u{1F424}\u{1F425}\u{1F373}\u{1F414}\u{1F413}]/u.test(text));
});

test('unknown enemy falls back to storm_rat', () => {
  assert.equal(createCombat({ enemyId: 'nope' }).enemy.id, 'storm_rat');
});

test('defend halves exactly the next enemy hit, then expires', () => {
  const c = createCombat({ enemyId: 'ridge_bandit' }); const h = hero();
  // rng 0.99 → no ability, max variance: bandit atk 6 - def 3 + 2 = 5, halved → 2
  heroAction(c, h, { type: 'defend' }, fixed(0.99));
  assert.equal(h.hp, 28);
  assert.equal(c.defending, false);
  heroAction(c, h, { type: 'defend' }, fixed(0.99)); // re-defend
  enemyTurn(c, h, fixed(0.99)); // unguarded hit
  assert.equal(h.hp, 26 - 5);
});

test('skills cost MP, unlock by level, and are rejected without MP', () => {
  assert.deepEqual(knownSkills(hero()).map((s) => s.id), ['power_strike', 'mend']);
  assert.ok(knownSkills(hero({ level: 3 })).some((s) => s.id === 'warding_stance'));
  const c = createCombat({ enemyId: 'rust_sentinel' }); const h = hero({ mp: 2 });
  assert.equal(heroAction(c, h, { type: 'skill', skillId: 'power_strike' }, fixed(0.99)).ok, false);
  assert.equal(heroAction(c, h, { type: 'skill', skillId: 'spark' }, fixed(0.99)).ok, false, 'spark locked at L1');
  const h2 = hero({ level: 2, mp: 10 });
  const before = c.enemy.hp;
  heroAction(c, h2, { type: 'skill', skillId: 'spark' }, fixed(0));
  assert.equal(h2.mp, 6);
  assert.equal(before - c.enemy.hp, (8 + 4) * 2, 'spark doubles vs constructs and ignores def');
});

test('mend heals up to equipment-aware max HP', () => {
  const c = createCombat({ enemyId: 'storm_rat' }); const h = hero({ hp: 25 });
  heroAction(c, h, { type: 'skill', skillId: 'mend' }, fixed(0.99));
  // heal to 30 then rat hits: 4-3+2 = 3
  assert.equal(h.hp, 27);
});

test('bleeding ticks each round and expires; shock blocks non-damage skills', () => {
  const c = createCombat({ enemyId: 'ridge_bandit' }); const h = hero({ hp: 30 });
  // first rng call (<0.25) triggers Dirty Cut
  heroAction(c, h, { type: 'defend' }, seq(0.0, 0.0));
  assert.ok(h.statuses.includes('bleeding'));
  const sentinel = createCombat({ enemyId: 'rust_sentinel' }); const h2 = hero({ statuses: ['shocked'] });
  assert.equal(heroAction(sentinel, h2, { type: 'skill', skillId: 'mend' }, fixed(0.99)).ok, false);
  for (let i = 0; i < 4; i++) heroAction(c, h, { type: 'defend' }, fixed(0.99));
  assert.ok(!h.statuses.includes('bleeding'), 'bleeding wears off');
});

test('bosses cannot be fled', () => {
  const c = createCombat({ enemyId: 'tide_wraith' });
  assert.equal(heroAction(c, hero(), { type: 'flee' }, fixed(0)).ok, false);
  assert.equal(c.over, null);
});

test('scene victory grants xp, gold, loot and emits combat:victory with encounterId', () => {
  const g = fakeGame();
  g.state.party[0].atk = 99;
  g.combatRng = fixed(0.0); // all loot rolls succeed
  combatScene.onEnter(g, { enemyId: 'storm_rat', encounterId: 'ridge_patrol', returnScene: 'explore' });
  const gold = g.state.gold;
  combatScene.actions.attack(g);
  const c = g.state.combat;
  assert.equal(c.over, 'victory');
  assert.equal(g.state.gold, gold + 3);
  assert.equal(g.state.party[0].xp, 5);
  assert.ok(g.state.inventory.some((s) => s.id === 'scrap_metal'));
  assert.deepEqual(g.events.find(([k]) => k === 'combat:victory')[1], { enemyId: 'storm_rat', encounterId: 'ridge_patrol' });
  combatScene.actions.finish(g);
  assert.equal(g.last.name, 'explore');
  assert.equal(g.last.data.combatResult, 'victory');
  assert.equal(g.last.data.encounterId, 'ridge_patrol');
  assert.equal(g.state.combat, null);
});

test('scene item use consumes the turn and the item', () => {
  const g = fakeGame();
  g.state.inventory = [{ id: 'healing_herb', qty: 1 }];
  g.state.party[0].hp = 5;
  combatScene.onEnter(g, { enemyId: 'storm_rat' });
  combatScene.actions.item(g, { dataset: { arg: 'healing_herb' } });
  assert.equal(g.state.inventory.length, 0);
  assert.ok(g.state.party[0].hp > 5);
  assert.equal(g.state.combat.turn, 2);
  assert.ok(combatScene.render(g).includes('Round 2'));
});

test('defeat returns to title', () => {
  const g = fakeGame();
  g.state.party[0].hp = 1; g.state.party[0].def = 0;
  combatScene.onEnter(g, { enemyId: 'gale_hound' }); // faster, strikes first
  assert.equal(g.state.combat.over, 'defeat');
  combatScene.actions.finish(g);
  assert.equal(g.last.name, 'title');
});

test('inherited enemy ids like constructor fall back to storm_rat', () => {
  const c = createCombat({ enemyId: 'constructor' });
  assert.equal(c.enemy.id, 'storm_rat');
  assert.ok(Number.isFinite(c.enemy.hp));
});

test('finish does not abandon an active combat; markup is escaped', async () => {
  const { combatScene } = await import('../src/scenes/combat.js');
  const calls = [];
  const game = { state: { party: [{ id: 'hero', name: '<img src=x onerror=alert(1)>', hp: 30, maxHp: 30, mp: 10, maxMp: 10, atk: 6, def: 3, spd: 5, level: 1, xp: 0, statuses: [] }], inventory: [], gold: 0, combat: createCombat({ enemyId: 'storm_rat' }) },
    scenes: { town: {} }, setScene: (n) => calls.push(n), bus: { emit() {} } };
  combatScene.actions.finish(game);
  assert.ok(game.state.combat, 'combat still active');
  assert.equal(calls.length, 0);
  const html = combatScene.render(game);
  assert.ok(!html.includes('<img'));
  assert.ok(html.includes('&lt;img'));
});
