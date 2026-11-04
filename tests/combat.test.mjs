import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, heroAction, physicalDamage, knownSkills, enemyTurn, SKILLS } from '../src/combat/rules.js';
import { ENEMIES } from '../src/data/enemies.js';
import { combatScene, recoverFromDefeat } from '../src/scenes/combat.js';
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
  assert.equal(before - c.enemy.hp, Math.floor((8 + 4) * 1.5), 'spark deals x1.5 vs constructs and ignores def');
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

test('defeat recovers the party in Greyhaven with half gold lost', () => {
  const g = fakeGame();
  g.state.gold = 21;
  g.state.party[0].hp = 1; g.state.party[0].def = 0;
  combatScene.onEnter(g, { enemyId: 'gale_hound', encounterId: 'ridge_patrol' }); // faster, strikes first
  assert.equal(g.state.combat.over, 'defeat');
  combatScene.actions.finish(g);
  assert.equal(g.last.name, 'town');
  assert.equal(g.last.data.combatResult, 'defeat');
  assert.equal(g.last.data.encounterId, 'ridge_patrol');
  assert.match(g.last.data.message, /infirmary/);
  assert.equal(g.state.gold, 11);
  assert.equal(g.state.party[0].hp, Math.ceil(g.state.party[0].maxHp / 2));
  assert.equal(g.state.location, 'greyhaven');
  assert.equal(g.state.combat, null);
});

test('recoverFromDefeat resets map position, statuses and mp', () => {
  const s = createInitialState();
  s.gold = 7;
  s.location = 'ridge_road';
  s.map = { zoneId: 'ridge_road', x: 5, y: 5, activeEncounterId: 'ridge_patrol' };
  s.party[0].hp = 0; s.party[0].mp = 0; s.party[0].statuses = [{ id: 'bleeding', turns: 2 }];
  const msg = recoverFromDefeat(s);
  assert.equal(s.gold, 4);
  assert.ok(s.party[0].hp >= 1);
  assert.equal(s.party[0].mp, s.party[0].maxMp);
  assert.deepEqual(s.party[0].statuses, []);
  assert.equal(s.map.zoneId, 'greyhaven');
  assert.equal(s.map.activeEncounterId, null);
  assert.equal(s.location, 'greyhaven');
  assert.match(msg, /3 gold/);
});

test('defeat falls back to title when no town scene exists', () => {
  const g = fakeGame();
  delete g.scenes.town;
  g.state.party[0].hp = 1; g.state.party[0].def = 0;
  combatScene.onEnter(g, { enemyId: 'gale_hound' });
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

test('chapter two enemies are valid and loot uses known items', async () => {
  const { ITEMS } = await import('../src/items/items.js');
  for (const id of ['reef_crawler', 'squall_revenant', 'frost_wolf', 'rockslide_golem']) {
    const e = ENEMIES[id];
    assert.ok(e && e.id === id && e.hp > 0 && e.intro, id);
    for (const l of e.loot) assert.ok(ITEMS[l.id], `${id} drops unknown ${l.id}`);
  }
  assert.ok(ENEMIES.rockslide_golem.tags.includes('construct'));
});

test('chapter two bosses are valid, and flagged as bosses', async () => {
  const { ITEMS } = await import('../src/items/items.js');
  for (const id of ['pass_warlord', 'drowned_harbormaster']) {
    const e = ENEMIES[id];
    assert.ok(e && e.id === id && e.boss === true && e.hp > 50 && e.intro && e.ability, id);
    for (const l of e.loot) assert.ok(ITEMS[l.id], `${id} drops unknown ${l.id}`);
    const c = createCombat({ enemyId: id });
    assert.equal(c.enemy.id, id);
  }
});

test('advanced skills unlock at levels 4 and 5', async () => {
  const { knownSkills } = await import('../src/combat/rules.js');
  const ids = (lvl) => knownSkills({ level: lvl }).map((s) => s.id);
  assert.ok(!ids(3).includes('rallying_light'));
  assert.ok(ids(4).includes('rallying_light'));
  assert.ok(!ids(4).includes('stormbreaker'));
  assert.ok(ids(5).includes('stormbreaker'));
});

test('Rallying Light heals every standing ally and stops bleeding', async () => {
  const { createCombat, heroAction } = await import('../src/combat/rules.js');
  const hero = { id: 'hero', name: 'Wren', hp: 10, maxHp: 50, mp: 20, maxMp: 20, atk: 6, def: 3, spd: 9, level: 4, statuses: ['bleeding'] };
  const ally = { id: 'tamsin', name: 'Tamsin', hp: 5, maxHp: 30, mp: 0, maxMp: 0, atk: 5, def: 2, spd: 1, level: 4, statuses: ['bleeding'] };
  const down = { id: 'iven', name: 'Iven', hp: 0, maxHp: 30, mp: 0, maxMp: 0, atk: 1, def: 1, spd: 1, level: 4, statuses: [] };
  const party = [hero, ally, down];
  const c = createCombat({ enemyId: 'storm_rat' });
  c.heroTimers.bleeding = 3;
  c.allyTimers = { tamsin: { bleeding: 2 } };
  const res = heroAction(c, hero, { type: 'skill', skillId: 'rallying_light' }, () => 0.99, party);
  assert.ok(res.ok);
  assert.equal(hero.mp, 14);
  assert.ok(!hero.statuses.includes('bleeding'));
  assert.ok(!ally.statuses.includes('bleeding'));
  assert.equal(down.hp, 0, 'knocked-out allies are not revived');
  assert.ok(ally.hp >= 5 + 14 - 20, 'ally healed (before any enemy hit)');
  assert.match(res.lines.join('\n'), /Rallying Light/);
});

test('Stormbreaker deals heavy damage', async () => {
  const { createCombat, heroAction } = await import('../src/combat/rules.js');
  const hero = { id: 'hero', name: 'Wren', hp: 50, maxHp: 50, mp: 20, maxMp: 20, atk: 20, def: 3, spd: 9, level: 5, statuses: [] };
  const c = createCombat({ enemyId: 'rockslide_golem' });
  const before = c.enemy.hp;
  heroAction(c, hero, { type: 'skill', skillId: 'stormbreaker' }, () => 0.5, [hero]);
  assert.equal(hero.mp, 13);
  assert.ok(before - c.enemy.hp >= Math.floor(20 * 2.2) - c.enemy.def - 1);
});

test('bosses enrage once at half HP: atk bonus, ability chance, log line', async () => {
  const { createCombat, checkBossPhase, enemyTurn } = await import('../src/combat/rules.js');
  const c = createCombat({ enemyId: 'pass_warlord' });
  const baseAtk = c.enemy.atk;
  assert.deepEqual(checkBossPhase(c), []);
  c.enemy.hp = Math.floor(c.enemy.maxHp / 2);
  const hero = { id: 'hero', name: 'Wren', hp: 30, maxHp: 30, mp: 10, maxMp: 10, atk: 6, def: 3, spd: 5, level: 1, statuses: [] };
  const lines = enemyTurn(c, hero, () => 0.99, [hero]);
  assert.equal(c.enraged, true);
  assert.equal(c.enemy.atk, baseAtk + 3);
  assert.equal(c.enemy.ability.chance, 0.5);
  assert.match(lines[0], /Warlord/);
  assert.deepEqual(checkBossPhase(c), [], 'only once per fight');
  const fresh = createCombat({ enemyId: 'pass_warlord' });
  assert.equal(fresh.enemy.atk, baseAtk, 'base enemy data is not mutated');
  assert.equal(fresh.enemy.ability.chance, 0.35);
});

test('non-boss enemies never enrage', async () => {
  const { createCombat, checkBossPhase } = await import('../src/combat/rules.js');
  const c = createCombat({ enemyId: 'storm_rat' });
  c.enemy.hp = 1;
  assert.deepEqual(checkBossPhase(c), []);
  assert.ok(!c.enraged);
});
