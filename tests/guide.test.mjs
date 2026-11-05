import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideScene, GUIDE_SECTIONS, skillRoadmap } from '../src/scenes/guide.js';
import { titleScene } from '../src/scenes/title.js';
import { assertEggFree } from './helpers/eggGuard.mjs';
import { SKILL_UNLOCKS } from '../src/combat/rules.js';

if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
}

test('skill roadmap lists every unlock in level order', () => {
  const rows = skillRoadmap();
  assert.equal(rows.length, Object.keys(SKILL_UNLOCKS).length);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].level >= rows[i - 1].level);
  assert.equal(rows.at(-1).name, 'Stillpoint Strike');
});

test('guide renders every section and returns to its caller', () => {
  const scenes = { title: {}, guide: guideScene };
  const visits = [];
  const game = { scenes, setScene(name, data) { visits.push(name); if (name === 'guide') guideScene.onEnter(game, data); } };
  titleScene.actions.guide(game);
  assert.deepEqual(visits, ['guide']);
  const html = guideScene.render(game);
  for (const s of GUIDE_SECTIONS) assert.ok(html.includes(`<h2>${s.title}</h2>`));
  assert.match(html, /Level 13: Tempest Cleave/);
  assert.match(titleScene.render(), /How to play/);
  guideScene.actions.closeGuide(game);
  assert.deepEqual(visits, ['guide', 'title']);
  assert.equal(game.guideReturn, null);
});

test('field-trial guidance names all four trials, the feat, and stays egg-free', () => {
  const drill = GUIDE_SECTIONS.flatMap((s) => s.lines).find((line) => line.includes('field trials open once'));
  assert.ok(drill, 'guide explains when the optional field trials open');
  for (const name of ['Old Tusk', 'Gloomfin', 'Frostmane', 'the Lenswarden']) {
    assert.ok(drill.includes(name), `trial named in guide: ${name}`);
  }
  assert.ok(drill.includes('Warden Mara'), 'guide names Warden Mara as the gatekeeper');
  assert.ok(
    drill.includes('has paid for the Saltmere and Highwatch rescues'),
    'guide pins the explicit payment gate over both settlements'
  );
  assert.ok(drill.includes('Trial Warden'), 'guide names the Trial Warden feat');
  const prose = GUIDE_SECTIONS.flatMap((s) => [s.title, ...s.lines]).join(' ');
  assertEggFree(prose, 'guide prose');
});

test('guide scaffolding — header, roadmap and buttons — stays egg-free', () => {
  // Covers everything render() emits beyond GUIDE_SECTIONS: eyebrow, scene
  // title, subtitle, skill-roadmap rows and button labels. Attribute values
  // are stripped by the shared guard, so the benign game-shell class is fine.
  assertEggFree(guideScene.render(), 'guide rendered HTML (scaffolding included)');
});

test('guide Thunderhoof tip names its Sparkrack Tine drop', async () => {
  const { ITEMS } = await import('../src/items/items.js');
  const text = JSON.stringify(GUIDE_SECTIONS);
  assert.match(text, /Thunderhoof[^']*Sparkrack Tine/);
  assert.equal(ITEMS.sparkrack_tine.name, 'Sparkrack Tine');
});

test('guide difficulty tip names the Calm in the Gale feat', () => {
  assert.match(JSON.stringify(GUIDE_SECTIONS), /overcoming any boss on Stormborn earns the Calm in the Gale feat/);
});
