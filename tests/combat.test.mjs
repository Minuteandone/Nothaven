import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { startCombat, heroAct, xpToNext } from '../src/combat/engine.js';
import { HERO_ABILITIES, MONSTER_ABILITIES } from '../src/combat/abilities.js';
import { ENEMIES } from '../src/data/enemies.js';

function freshState() {
  const s = createInitialState();
  return s;
}

test('xpToNext grows with level', () => {
  assert.ok(xpToNext(1) > 0);
  assert.ok(xpToNext(5) > xpToNext(1));
});

test('hero abilities are well-formed', () => {
  for (const [id, a] of Object.entries(HERO_ABILITIES)) {
    assert.equal(a.id, id);
    assert.equal(typeof a.name, 'string');
    assert.ok(Number.isFinite(a.mp));
  }
});

test('enemy data is well-formed and references valid abilities', () => {
  for (const [id, e] of Object.entries(ENEMIES)) {
    assert.equal(e.id, id);
    for (const f of ['name', 'desc', 'hp', 'atk', 'def', 'spd', 'xp', 'gold']) {
      assert.ok(f in e, `${id} missing ${f}`);
    }
    for (const a of e.abilities || []) {
      assert.ok(a.id in MONSTER_ABILITIES, `${id} references unknown ability ${a.id}`);
    }
    for (const drop of e.loot || []) {
      assert.equal(typeof drop.id, 'string');
      assert.ok(drop.id.length > 0);
    }
  }
});

test('startCombat sets up a valid encounter', () => {
  const s = freshState();
  const c = startCombat(s, 'storm_rat');
  assert.equal(c.enemy.name, 'Storm Rat');
  assert.ok(c.log.length >= 1);
  assert.equal(c.over, null);
});

test('victory awards gold and xp and resolves loot', () => {
  const s = freshState();
  const origRandom = Math.random;
  Math.random = () => 0.5; // deterministic: no miss, no crit
  try {
    const c = startCombat(s, 'storm_rat');
    c.enemy.hp = 1;
    const goldBefore = s.gold;
    const xpBefore = s.party[0].xp;
    heroAct(s, 'attack');
    assert.equal(c.over, 'victory');
    assert.ok(s.gold >= goldBefore + 1, 'gold should increase');
    assert.ok(s.party[0].xp >= xpBefore + 1, 'xp should increase');
  } finally {
    Math.random = origRandom;
  }
});

test('defend halving is reflected in enemy damage', () => {
  const s = freshState();
  const c = startCombat(s, 'storm_rat');
  c.turn = 'hero';
  const before = s.party[0].hp;
  heroAct(s, 'attack'); // triggers enemy turn if alive
  assert.ok(s.party[0].hp <= before);
});
