import { test } from 'node:test';
import assert from 'node:assert/strict';
import { guideScene, GUIDE_SECTIONS, skillRoadmap } from '../src/scenes/guide.js';
import { titleScene } from '../src/scenes/title.js';
import { SKILL_UNLOCKS } from '../src/combat/rules.js';

if (!globalThis.localStorage) {
  const store = new Map();
  globalThis.localStorage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };
}

test('skill roadmap lists every unlock in level order', () => {
  const rows = skillRoadmap();
  assert.equal(rows.length, Object.keys(SKILL_UNLOCKS).length);
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i].level >= rows[i - 1].level);
  assert.equal(rows.at(-1).name, 'Skyfire Lance');
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
  assert.ok(drill.includes('Warden Mara'), 'guide gates the trials on Mara paying the rescue reward');
  assert.ok(drill.includes('Trial Warden'), 'guide names the Trial Warden feat');
  const eggRe = /\b(eggs?|yolks?|shells?|hatch\w*|nests?|chicks?|hens?|omelet\w*|scrambl\w*|clutch|poach\w*|fried|boil\w*|cackl\w*|easter|pearl|golden|basket|quail|goose|peeps?)\b/i;
  const prose = GUIDE_SECTIONS.flatMap((s) => [s.title, ...s.lines]).join(' ');
  assert.equal(eggRe.test(prose), false, 'no egg vocabulary in guide prose');
});
