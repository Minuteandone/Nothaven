import test from 'node:test';
import assert from 'node:assert/strict';
import { abilityDetail } from '../src/ui/combat.js';

test('abilityDetail returns descriptive tooltip', () => {
  // Full ability with all fields
  assert.equal(
    abilityDetail({ name: 'Dirty Cut', chance: 0.25, mult: 1.2, status: 'bleeding', turns: 3 }),
    '25% ability roll · 1.2× ATK · Inflicts bleeding for 3 turns'
  );
  // Ability with just name and chance, no status
  assert.equal(
    abilityDetail({ name: 'Lunging Bite', chance: 0.3, mult: 1.4 }),
    '30% ability roll · 1.4× ATK'
  );
  // Ability with just chance, mult=1 (should not show mult)
  assert.equal(
    abilityDetail({ name: 'Gnaw', chance: 0.2, mult: 1, status: 'bleeding', turns: 2 }),
    '20% ability roll · Inflicts bleeding for 2 turns'
  );
  // Ability with status but no turns
  assert.equal(
    abilityDetail({ name: 'Arc Discharge', chance: 0.3, mult: 1.1, status: 'shocked' }),
    '30% ability roll · 1.1× ATK · Inflicts shocked'
  );
  // Turn singular
  assert.equal(
    abilityDetail({ name: 'Stun Blow', chance: 0.4, status: 'stunned', turns: 1 }),
    '40% ability roll · Inflicts stunned for 1 turn'
  );
  // No ability
  assert.equal(abilityDetail(null), '');
  assert.equal(abilityDetail(undefined), '');
  assert.equal(abilityDetail({}), '');
  assert.equal(abilityDetail({ name: '' }), '');
  // ability with only a name (no extra details)
  assert.equal(abilityDetail({ name: 'Basic Strike' }), '');
});

test('abilityDetail output is egg-free', () => {
  const outputs = [
    abilityDetail({ name: 'Dirty Cut', chance: 0.25, mult: 1.2, status: 'bleeding', turns: 3 }),
    abilityDetail({ name: 'Lunging Bite', chance: 0.3, mult: 1.4 }),
    abilityDetail({ name: 'Arc Discharge', chance: 0.3, mult: 1.1, status: 'shocked' }),
  ];
  const eggWords = /\b(egg|roe|caviar|ovul|yolk|omelet|scrambled|fried|boiled|sunny|easter|hatch|nest|chick|poach|shell|deviled|benedict|quail|hen|coddle|clutch|ovum|oeuf|huevo|molt|preen|gizzard|poultry|pinion|avian|plume|broiler|wattle|down|perch|comb|spur|crop)\b/i;
  for (const output of outputs) {
    assert.ok(!eggWords.test(output), `output contains egg word: "${output}"`);
  }
});
