import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_SECTIONS } from '../src/scenes/guide.js';
import { FEATS } from '../src/scenes/feats.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('field guide explains the chronicle and its Your journey list', () => {
  const lines = GUIDE_SECTIONS.find((s) => s.title === 'Settings and saving').lines;
  const line = lines.find((l) => l.startsWith('After the finale, Read the chronicle'));
  assert.ok(line, 'chronicle line present');
  for (const phrase of ['without paying rewards again', 'Your journey', 'current difficulty', 'battles won', 'Field Journal', 'Yard Gauntlet', 'bounty board record', 'Beyond the storm']) {
    assert.ok(line.includes(phrase), `mentions ${phrase}`);
  }
  assert.equal(FEATS.length, 31);
  assert.ok(line.includes('out of thirty-one'));
  assertEggFree(line, 'guide chronicle line');
});
