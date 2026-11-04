import test from 'node:test';
import assert from 'node:assert/strict';
import { createCombat, heroAction, BEACON_CHARGE_MAX, BURST_CHEERS, burstCheer } from '../src/combat/rules.js';
import { createInitialState } from '../src/state.js';

test('burstCheer picks the first conscious companion with a known role', () => {
  assert.equal(burstCheer([{ role: 'keeper', hp: 0 }, { role: 'guardian', hp: 5 }]), BURST_CHEERS.guardian);
  assert.equal(burstCheer([{ name: 'Wren', hp: 30 }]), '');
  assert.equal(burstCheer(null), '');
  assert.ok(Object.isFrozen(BURST_CHEERS));
  assert.deepEqual(Object.keys(BURST_CHEERS).sort(), ['guardian', 'keeper', 'scout', 'signaler']);
});

test('Beacon Burst logs a companion cheer when a companion is present', () => {
  const s = createInitialState();
  const hero = s.party[0]; hero.hp = 999; hero.maxHp = 999;
  const party = [hero, { name: 'Sela', role: 'signaler', hp: 22, maxHp: 22, mp: 12, maxMp: 12, atk: 5, def: 2, spd: 6, level: 1, companion: true, statuses: [] }];
  const c = createCombat({ enemyId: 'storm_heart' });
  c.charge = BEACON_CHARGE_MAX;
  const res = heroAction(c, hero, { type: 'burst' }, () => 0.5, party);
  assert.ok(res.lines.includes(BURST_CHEERS.signaler));
  const solo = createCombat({ enemyId: 'storm_heart' });
  solo.charge = BEACON_CHARGE_MAX;
  const r2 = heroAction(solo, hero, { type: 'burst' }, () => 0.5);
  assert.ok(!Object.values(BURST_CHEERS).some((l) => r2.lines.includes(l)));
});
