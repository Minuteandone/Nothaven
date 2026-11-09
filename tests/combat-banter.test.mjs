import test from 'node:test';
import assert from 'node:assert/strict';
import {
  combatBanter, banterFired, isBigHit, isLowHealth,
  companionKillCheck, pickSpeaker
} from '../src/party/combatBanter.js';

// Helpers
const hero = (o = {}) => ({ id: 'hero', name: 'Wren', hp: 30, maxHp: 30, mp: 10, atk: 6, def: 3, spd: 5, level: 1, statuses: [], ...o });
const comp = (id, role, hp = 25) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), role, hp, maxHp: 25, atk: 5, def: 2, spd: 4, statuses: [] });
const compKO = (id, role) => ({ id, name: id.charAt(0).toUpperCase() + id.slice(1), role, hp: 0, maxHp: 25, atk: 5, def: 2, spd: 4, statuses: [] });
const party = () => [comp('tamsin','scout'), comp('iven','keeper'), comp('bram','guardian'), comp('sela','signaler')];

// ============ Module unit tests ============

test('banterFired: Set-like with plain object', () => {
  const c = {};
  assert.equal(banterFired(c, 'victory'), false, 'first call should return false');
  assert.equal(banterFired(c, 'victory'), true, 'second call should return true (already fired)');
  assert.equal(banterFired(c, 'lowHealth'), false, 'different key should return false');
  assert.ok(c._banterFired.victory, 'key should be stored');
  // JSON clone survival
  const c2 = JSON.parse(JSON.stringify(c));
  assert.equal(banterFired(c2, 'victory'), true, 'survives JSON round-trip');
  assert.equal(banterFired(c2, 'fleeFail'), false, 'different key still works after clone');
});

test('isBigHit: damage >= 30% of maxHP', () => {
  assert.equal(isBigHit(9, hero({ hp: 30, maxHp: 30 }), 30), true, '9 >= 9');
  assert.equal(isBigHit(8, hero({ hp: 30, maxHp: 30 }), 30), false, '8 < 9');
  assert.equal(isBigHit(6, hero({ hp: 20, maxHp: 20 }), 20), true, '6 >= 6 (30%)');
  assert.equal(isBigHit(0, hero({ hp: 10, maxHp: 10 }), 10), false, '0 damage is never big');
  assert.equal(isBigHit(30, hero({ hp: 1, maxHp: 100 }), 100), true, '30 >= 30');
});

test('isLowHealth: HP > 0 and below 25% of maxHP', () => {
  assert.equal(isLowHealth(hero({ hp: 7, maxHp: 30 }), 30), true, '7 < 7.5');
  assert.equal(isLowHealth(hero({ hp: 8, maxHp: 30 }), 30), false, '8 >= 7.5');
  assert.equal(isLowHealth(hero({ hp: 0, maxHp: 30 }), 30), false, 'dead hero is not "low health"');
  assert.equal(isLowHealth(hero({ hp: 24, maxHp: 100 }), 100), true, '24 < 25% threshold');
  assert.equal(isLowHealth(hero({ hp: 26, maxHp: 100 }), 100), false, '26 > 25%');
});

test('pickSpeaker: first conscious companion', () => {
  const p = party();
  const speaker = pickSpeaker(p);
  assert.ok(speaker, 'should pick someone');
  assert.notEqual(speaker.id, 'hero', 'should not be hero');
  assert.equal(speaker, p[0], 'should be first companion (Tamsin)');

  const p2 = [compKO('tamsin','scout'), ...p.slice(1)];
  const s2 = pickSpeaker(p2);
  assert.equal(s2, p2[1], "skips first KO'd companion");

  // excludeId
  const s3 = pickSpeaker(p, 'tamsin');
  assert.equal(s3, p[1], 'excludes tamsin, picks Iven');
});

test('companionKillCheck: detect companion name near killing blow', () => {
  assert.equal(companionKillCheck(null, []), null, 'no combat returns null');
  const c = {};
  assert.equal(companionKillCheck({ enemy: { hp: 0 } }, ['Tamsin lands the killing blow!', 'Enemy is defeated.']), 'Tamsin', 'finds tamsin');
  assert.equal(companionKillCheck({ enemy: { hp: 0 } }, ['Bram strikes the final blow.']), 'Bram', 'finds bram');
  // companionNames only checks Tamsin/Iven/Bram/Sela, Wren (hero) won't match
  assert.equal(companionKillCheck({ enemy: { hp: 0 } }, ['Wren attacks for 5 damage.', 'Enemy defeated.']), null, 'hero is not a companion');
  // No killing language
  assert.equal(companionKillCheck({ enemy: { hp: 0 } }, ['Iven heals for 10 HP.']), null, 'no kill language');
});

// ============ combatBanter event tests ============

test('combatBanter: returns ::banter:: prefixed string', () => {
  const c = {};
  const p = party();
  const h = hero();
  const result = combatBanter(c, 'victory', { party: p, hero: h });
  assert.ok(result, 'should return a string');
  assert.ok(result.startsWith('::banter::'), 'should have ::banter:: prefix');
  assert.ok(result.length > '::banter::'.length, 'should have content after prefix');
});

test('combatBanter: each event type returns a line', () => {
  const events = [
    'bigHit', 'lowHealth', 'allyDown', 'enemyEnrage',
    'victory', 'fleeSuccess', 'fleeFail', 'windupWarning',
    'heroShocked', 'heroBleeding', 'companionKill'
  ];
  const p = party();
  const h = hero();
  for (const evt of events) {
    const c = {};
    const result = combatBanter(c, evt, { party: p, hero: h });
    assert.ok(result, `event '${evt}' should return a line`);
    assert.ok(result.startsWith('::banter::'), `'${evt}' should have banter prefix`);
    assert.ok(!result.includes('undefined'), `'${evt}' should not contain undefined`);
  }
});

test('combatBanter: one-shot events fire only once', () => {
  const p = party();
  const h = hero();
  const oneShots = ['lowHealth', 'enemyEnrage', 'victory', 'fleeSuccess', 'fleeFail'];
  for (const evt of oneShots) {
    const c = {};
    const first = combatBanter(c, evt, { party: p, hero: h });
    assert.ok(first, `${evt} first call should return a line`);
    const second = combatBanter(c, evt, { party: p, hero: h });
    assert.equal(second, null, `${evt} second call should return null (one-shot)`);
  }
});

test('combatBanter: repeatable events fire every time', () => {
  const p = party();
  const h = hero();
  const repeatable = ['bigHit', 'allyDown', 'windupWarning', 'heroShocked', 'heroBleeding', 'companionKill'];
  for (const evt of repeatable) {
    const c = {};
    const first = combatBanter(c, evt, { party: p, hero: h });
    assert.ok(first, `${evt} first call should return a line`);
    const second = combatBanter(c, evt, { party: p, hero: h });
    assert.ok(second, `${evt} second call should return a line (repeatable)`);
  }
});

test("combatBanter: allyDown excludes the KO'd companion", () => {
  const p = [comp('tamsin','scout', 0), comp('iven','keeper'), comp('bram','guardian')];
  const h = hero();
  const c = {};
  const result = combatBanter(c, 'allyDown', { party: p, hero: h, excludeId: 'tamsin' });
  assert.ok(result, 'should get a line');
  assert.ok(!result.includes('Tamsin'), "should not be spoken by Tamsin (KO'd)");
});

test('combatBanter: forceRole for companionKill', () => {
  const p = [comp('tamsin','scout'), comp('iven','keeper'), comp('bram','guardian'), comp('sela','signaler')];
  const h = hero();
  const c = {};
  const result = combatBanter(c, 'companionKill', { party: p, hero: h, forceRole: 'scout' });
  assert.ok(result, 'should get a line');
  assert.ok(result.includes('Tamsin'), 'forceRole=scout should have Tamsin speak');
});

test('combatBanter: no conscious companions returns null', () => {
  const p = [compKO('tamsin','scout'), compKO('iven','keeper'), compKO('bram','guardian'), compKO('sela','signaler')];
  const h = hero();
  const c = {};
  const result = combatBanter(c, 'bigHit', { party: p, hero: h });
  assert.equal(result, null, "all KO'd companions → null");
});

test('combatBanter: party with only hero returns null', () => {
  const h = hero();
  const c = {};
  const result = combatBanter(c, 'bigHit', { party: [h], hero: h });
  assert.equal(result, null, 'only hero → null');
});
