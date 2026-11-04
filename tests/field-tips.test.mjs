import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';
import { FIELD_TIPS, fieldTip } from '../src/data/fieldTips.js';
import { bestiaryScene } from '../src/scenes/bestiary.js';

test('every enemy has a field tip and no stray tips exist', () => {
  assert.deepEqual(Object.keys(FIELD_TIPS).sort(), Object.keys(ENEMIES).sort());
  assert.equal(fieldTip('constructor'), '');
  assert.equal(fieldTip('nope'), '');
});

test('field tips appear only for defeated foes', () => {
  const html = bestiaryScene.render({ state: { bestiary: { relay_warden: 1 } } });
  assert.match(html, /Mara’s advice:<\/strong> A towering construct boss/);
  assert.doesNotMatch(html, /Rallying Light keeps the whole party/);
});
