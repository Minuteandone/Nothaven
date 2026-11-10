import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { DRILL_FOES, drillLocationText, drillsScene } from '../src/scenes/drills.js';
import { escapeHTML } from '../src/ui/components.js';
import { guideScene } from '../src/scenes/guide.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('drillLocationText names the region that fields each yard boss', () => {
  const expected = {
    tide_wraith: 'Found in: Beacon Tower.',
    pass_warlord: 'Found in: Highwatch Pass.',
    drowned_harbormaster: 'Found in: Saltmere Coast.',
    relay_warden: 'Found in: Sunscar Relay.',
    stormcrown_tyrant: 'Found in: Stormcrown Spire.',
    storm_heart: 'Found in: The Storm’s Eye.',
    last_squall: 'Found in: The Storm’s Eye.',
  };
  assert.deepEqual(Object.keys(expected).sort(), [...DRILL_FOES].sort());
  for (const id of DRILL_FOES) {
    assert.equal(drillLocationText(id), expected[id], id);
    assertEggFree(drillLocationText(id), id);
  }
  for (const bad of ['storm_rat', 'old_tusk', '__proto__', 'toString', undefined, null]) assert.equal(drillLocationText(bad), null);
});

test('only locked drills render the Found in line, after the locked note', () => {
  const fresh = drillsScene.render({ state: {}, drillsMessage: '' });
  assert.equal((fresh.match(/class="drill__where"/g) || []).length, DRILL_FOES.length);
  const locked = 'Defeat this foe in the field first.';
  const where = `<p class="drill__where">${escapeHTML(drillLocationText('tide_wraith'))}</p>`;
  assert.ok(fresh.includes(`${locked}</p>${where}`));
  const [a] = DRILL_FOES;
  const one = drillsScene.render({ state: { bestiary: { [a]: 1 } }, drillsMessage: '' });
  assert.equal((one.match(/class="drill__where"/g) || []).length, DRILL_FOES.length - 1);
  assert.ok(!one.includes(`<p class="drill__where">${escapeHTML(drillLocationText(a))}</p><p class="drill__record"`));
  const all = drillsScene.render({ state: { bestiary: Object.fromEntries(DRILL_FOES.map((id) => [id, 1])) }, drillsMessage: '' });
  assert.equal((all.match(/class="drill__where"/g) || []).length, 0);
});

test('guide documents the Found in line in both copies, after the stats sentence', () => {
  const sentence = 'A drill you have not unlocked yet names where its boss waits in the field (for example “Found in: Beacon Tower.”).';
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(sentence).length - 1, 1);
  assert.ok(md.includes(`6 speed.”). ${sentence}`));
  const html = guideScene.render({ state: {} });
  assert.equal(html.split(escapeHTML(sentence)).length - 1, 1);
  assertEggFree(sentence, 'drill location doc');
});
