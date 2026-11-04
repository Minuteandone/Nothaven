import test from 'node:test';
import assert from 'node:assert/strict';
import { createCompanionMember } from '../src/party/companions.js';
import { createCombat, companionTurn, hasMastery, COMPANION_MASTERY, COMPANION_MASTERY_LEVEL } from '../src/combat/rules.js';

const fixed = (v) => () => v;

test('mastery unlocks at level 8 for every companion role', () => {
  assert.equal(COMPANION_MASTERY_LEVEL, 8);
  assert.deepEqual(Object.keys(COMPANION_MASTERY).sort(), ['guardian', 'keeper', 'scout', 'signaler']);
  assert.equal(hasMastery(createCompanionMember('bram', 7)), false);
  assert.equal(hasMastery(createCompanionMember('bram', 8)), true);
});

test('Bright Flare deals 50% more than a plain Signal Flare at the same level', () => {
  const plain = createCompanionMember('sela', 7);
  const master = createCompanionMember('sela', 8);
  const c1 = createCombat({ enemyId: 'spire_sentry' });
  const l1 = companionTurn(c1, plain, [plain], fixed(0));
  assert.match(l1[0], /Signal Flare for 19/);
  const c2 = createCombat({ enemyId: 'spire_sentry' });
  const l2 = companionTurn(c2, master, [master], fixed(0));
  assert.match(l2[0], /Sela hurls a Bright Flare for 31/); // floor((5+16)*1.5)
});

test('Keeper’s Mend heals 50% more', () => {
  const iven = createCompanionMember('iven', 8);
  const hero = createCompanionMember('bram', 8);
  hero.name = 'Wren'; hero.hp = 1;
  const c = createCombat({ enemyId: 'ridge_bandit' });
  const lines = companionTurn(c, iven, [hero, iven], fixed(0.5));
  assert.match(lines[0], /Iven uses Keeper’s Mend on Wren, restoring 39 HP/); // floor((10+16)*1.5)
  assert.equal(hero.hp, 40);
});

test('Bulwark Bash and Piercing Shot trigger more often once mastered', () => {
  const bram7 = createCompanionMember('bram', 7), bram8 = createCompanionMember('bram', 8);
  const c = createCombat({ enemyId: 'ridge_bandit' });
  assert.doesNotMatch(companionTurn(c, bram7, [bram7], fixed(0.3))[0], /Bash/);
  const c2 = createCombat({ enemyId: 'ridge_bandit' });
  assert.match(companionTurn(c2, bram8, [bram8], fixed(0.3))[0], /Bram lands a Bulwark Bash/);
  const t7 = createCompanionMember('tamsin', 7), t8 = createCompanionMember('tamsin', 8);
  const c3 = createCombat({ enemyId: 'ashen_raider' });
  assert.doesNotMatch(companionTurn(c3, t7, [t7], fixed(0.35))[0], /Shot/);
  const c4 = createCombat({ enemyId: 'ashen_raider' });
  assert.match(companionTurn(c4, t8, [t8], fixed(0.35))[0], /Tamsin looses a Piercing Shot/);
});
