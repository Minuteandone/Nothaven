import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, heroAction, gainCharge, chargeReady, BEACON_CHARGE_MAX, BEACON_CHARGE_GAIN, BEACON_BURST } from '../src/combat/rules.js';
import { createInitialState } from '../src/state.js';
import { chargeMeter, renderCombat } from '../src/ui/combat.js';

const hero = () => createInitialState().party[0];
const mid = () => 0.5;

test('gainCharge floors and clamps to the gauge', () => {
  const c = {};
  assert.equal(gainCharge(c, 12.9), 12);
  assert.equal(gainCharge(c, 500), BEACON_CHARGE_MAX);
  assert.equal(gainCharge(c, -999), 0);
  assert.equal(gainCharge(null, 10), 0);
});

test('acting and taking hits builds charge; failed actions do not', () => {
  const h = hero(); h.hp = 999; h.maxHp = 999;
  const c = createCombat({ enemyId: 'storm_heart' });
  const res = heroAction(c, h, { type: 'skill', skillId: 'no_such_skill' }, mid, [h]);
  assert.equal(res.ok, false); assert.equal(c.charge || 0, 0);
  const before = h.hp;
  heroAction(c, h, { type: 'attack' }, mid, [h]);
  assert.ok(h.hp < before, 'the enemy hit back');
  assert.ok(c.charge > BEACON_CHARGE_GAIN.attack - 1, 'attack gain applied');
});

test('Beacon Burst needs a full gauge, ignores def, resets charge and clears afflictions', () => {
  const h = hero(); h.level = 10; h.atk = 30; h.hp = 500; h.maxHp = 500;
  const c = createCombat({ enemyId: 'storm_heart' });
  const blocked = heroAction(c, h, { type: 'burst' }, mid, [h]);
  assert.equal(blocked.ok, false);
  c.charge = BEACON_CHARGE_MAX; h.statuses = ['shocked', 'bleeding'];
  assert.equal(chargeReady(c), true);
  const hp0 = c.enemy.hp;
  const res = heroAction(c, h, { type: 'burst' }, mid, [h]);
  assert.equal(res.ok, true);
  const expected = Math.floor(30 * BEACON_BURST.mult) + 10 * BEACON_BURST.perLevel;
  assert.equal(hp0 - c.enemy.hp, expected);
  assert.ok(!h.statuses.includes('shocked') && !h.statuses.includes('bleeding'));
  assert.ok(c.charge < BEACON_CHARGE_MAX, 'charge was spent (only hits taken after can refill it)');
});

test('combat UI shows the gauge and enables the burst only when full', () => {
  const h = hero();
  const c = createCombat({ enemyId: 'storm_rat' });
  assert.match(chargeMeter(c), /aria-valuenow="0"/);
  assert.match(renderCombat({ combat: c, party: [h] }), /data-action="burst"[^>]*disabled/);
  c.charge = BEACON_CHARGE_MAX;
  const html = renderCombat({ combat: c, party: [h] });
  assert.match(html, /beacon-charge--ready/);
  assert.doesNotMatch(html, /data-action="burst"[^>]*disabled/);
  assert.match(html, /Beacon Burst — ready!/);
});
