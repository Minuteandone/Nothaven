import test from 'node:test';
import assert from 'node:assert/strict';
import { gauntletRecordText, gauntletRecord } from '../src/scenes/drills.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('gauntletRecordText reports the historical best without the current roster size', () => {
  assert.equal(gauntletRecordText(null), 'No gauntlet attempted yet.');
  assert.equal(gauntletRecordText({ runs: 0, best: 0 }), 'No gauntlet attempted yet.');
  assert.equal(gauntletRecordText({ runs: 1, best: 1 }), 'Best run: 1 foe beaten · 1 attempt');
  assert.equal(gauntletRecordText({ runs: 4, best: 0 }), 'Best run: 0 foes beaten · 4 attempts');
  assert.equal(gauntletRecordText(gauntletRecord({ drillGauntlet: { runs: 2, best: 5 } })), 'Best run: 5 foes beaten · 2 attempts');
  assert.equal(gauntletRecordText(gauntletRecord({ drillGauntlet: { runs: 'x', best: 9 } })), 'No gauntlet attempted yet.');
  assertEggFree(gauntletRecordText({ runs: 3, best: 2 }), 'gauntlet record text');
});
