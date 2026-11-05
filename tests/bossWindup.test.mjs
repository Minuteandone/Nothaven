import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, enemyTurn, enemyWindingUp } from '../src/combat/rules.js';
import { ENEMIES } from '../src/data/enemies.js';
import { createInitialState } from '../src/state.js';
import { windupCue } from '../src/ui/combat.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const seq = (...vals) => { let i = 0; return () => vals[Math.min(i++, vals.length - 1)]; };
function hero() {
  const h = createInitialState().party[0];
  h.hp = h.maxHp = 500;
  return h;
}

test('only the listed bosses define a windup', () => {
  const withWindup = Object.keys(ENEMIES).filter((id) => ENEMIES[id].windup).sort();
  assert.deepEqual(withWindup, ['drowned_harbormaster', 'last_squall', 'pass_warlord', 'relay_warden', 'storm_heart', 'stormcrown_tyrant']);
  for (const id of withWindup) {
    const w = ENEMIES[id].windup;
    assert.ok(w.chance > 0 && w.chance < 0.5, id);
    assert.ok(w.mult >= 1.5 && w.mult <= 2.5, id);
    assert.equal(typeof w.name, 'string');
  }
});

test('a windup turn deals no damage, then the next turn lands a heavy blow', () => {
  const c = createCombat({ enemyId: 'stormcrown_tyrant' });
  const h = hero();
  const lines = enemyTurn(c, h, seq(0.01), [h]);
  assert.equal(h.hp, 500);
  assert.ok(enemyWindingUp(c));
  assert.match(lines.join(' '), /begins gathering Crown of Thunder/);
  const cue = windupCue(c);
  assert.match(cue, /windup-cue/);
  assertEggFree(cue, 'windup cue');
  const hit = enemyTurn(c, h, seq(0.5), [h]);
  assert.match(hit.join(' '), /unleashes Crown of Thunder/);
  assert.ok(500 - h.hp >= 27 * 2 - 20, `heavy blow, took ${500 - h.hp}`);
  assert.equal(enemyWindingUp(c), false);
  assert.equal(windupCue(c), '');
});

test('Defend halves the released blow', () => {
  const run = (defend) => {
    const c = createCombat({ enemyId: 'storm_heart' });
    const h = hero();
    enemyTurn(c, h, seq(0.01), [h]);
    c.defending = defend;
    const out = enemyTurn(c, h, seq(0.5), [h]);
    return { taken: 500 - h.hp, out: out.join(' '), c };
  };
  const open = run(false);
  const braced = run(true);
  assert.equal(braced.taken, Math.max(1, Math.floor(open.taken / 2)));
  assert.match(braced.out, /braced/);
  assert.equal(braced.c.defending, false);
});

test('a stun breaks a gathered blow', () => {
  const c = createCombat({ enemyId: 'last_squall' });
  const h = hero();
  enemyTurn(c, h, seq(0.01), [h]);
  assert.ok(enemyWindingUp(c));
  c.enemy.statuses.push('stunned');
  const lines = enemyTurn(c, h, seq(0.5), [h]);
  assert.match(lines.join(' '), /stun breaks/);
  assert.equal(enemyWindingUp(c), false);
  assert.equal(h.hp, 500);
});

test('foes without a windup never consume extra rng', () => {
  const c = createCombat({ enemyId: 'tide_wraith' });
  const h = hero();
  let calls = 0;
  const rng = () => { calls += 1; return 0.99; };
  enemyTurn(c, h, rng, [h]);
  const c2 = createCombat({ enemyId: 'stormcrown_tyrant' });
  let calls2 = 0;
  enemyTurn(c2, hero(), () => { calls2 += 1; return 0.99; }, [hero()]);
  assert.equal(calls2, calls + 1);
  assert.equal(c.windup, undefined);
});

test('gathering spends Defend and one ward/aegis turn like any enemy action', () => {
  const c = createCombat({ enemyId: 'stormcrown_tyrant' });
  const h = hero();
  c.defending = true; c.wardTurns = 1; c.aegisTurns = 2;
  enemyTurn(c, h, seq(0.01), [h]);
  assert.ok(enemyWindingUp(c));
  assert.equal(c.defending, false);
  assert.equal(c.wardTurns, 0);
  assert.equal(c.aegisTurns, 1);
  // With every defense spent, the released blow lands unbraced.
  c.aegisTurns = 0;
  const lines = enemyTurn(c, h, seq(0.5), [h]);
  assert.ok(lines.some((l) => /unleashes/.test(l)));
  assert.ok(!lines.some((l) => /braced/.test(l)));
});
