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
