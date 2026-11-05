import test from 'node:test';
import assert from 'node:assert/strict';
import { STATUS_INFO, statusLabel } from '../src/ui/combat.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('every combat status has a readable label and hint', () => {
  for (const id of ['bleeding', 'shocked', 'stunned']) {
    assert.ok(STATUS_INFO[id], id);
    assert.match(STATUS_INFO[id].label, /^[A-Z]/);
    assert.ok(STATUS_INFO[id].hint.length > 10);
  }
  assert.equal(statusLabel('shocked'), 'Shocked');
  assert.equal(statusLabel('mystery'), 'mystery');
  assert.equal(statusLabel(undefined), 'Unknown');
});

test('status hint text stays content-clean', () => {
  for (const info of Object.values(STATUS_INFO)) assertEggFree(`${info.label} ${info.hint}`);
});
