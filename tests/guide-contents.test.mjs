import test from 'node:test';
import assert from 'node:assert/strict';
import { GUIDE_SECTIONS, guideScene, guideSectionId, guideContents, skillRoadmap } from '../src/scenes/guide.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('guideSectionId makes stable, safe anchor ids', () => {
  assert.equal(guideSectionId('Exploring'), 'guide-exploring');
  assert.equal(guideSectionId('Party and growth'), 'guide-party-and-growth');
  assert.equal(guideSectionId('Settings and saving'), 'guide-settings-and-saving');
  assert.equal(guideSectionId('  <Odd> & title!! '), 'guide-odd-title');
  assert.equal(guideSectionId(''), 'guide-section');
  assert.equal(guideSectionId(null), 'guide-section');
});

test('guideContents lists every section once, then the skill roadmap, with line counts', () => {
  const rows = guideContents();
  assert.equal(rows.length, GUIDE_SECTIONS.length + 1);
  GUIDE_SECTIONS.forEach((s, i) => {
    assert.deepEqual(rows[i], { id: guideSectionId(s.title), title: s.title, count: s.lines.length });
  });
  assert.deepEqual(rows.at(-1), { id: 'guide-skill-roadmap', title: 'Skill roadmap', count: skillRoadmap().length });
  assert.equal(new Set(rows.map((r) => r.id)).size, rows.length, 'ids are unique');
  for (const r of rows) assertEggFree(r.title, `contents ${r.id}`);
});

test('guide render puts a contents nav before the sections, and every link targets a real section', () => {
  const html = guideScene.render({ state: {} });
  const nav = html.indexOf('<nav class="panel guide-toc" aria-label="Guide contents">');
  assert.ok(nav >= 0, 'contents nav renders');
  assert.ok(nav < html.indexOf('<section class="guide-section"'), 'contents come before the first section');
  const hrefs = [...html.matchAll(/class="guide-toc__link" href="#([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(hrefs, guideContents().map((r) => r.id));
  for (const id of hrefs) {
    assert.equal(html.split(`id="${id}"`).length - 1, 1, `exactly one target for ${id}`);
  }
  assert.ok(html.includes('>Exploring (' + GUIDE_SECTIONS[0].lines.length + ')</a>'));
  assert.ok(html.includes(`>Skill roadmap (${skillRoadmap().length})</a>`));
  assert.ok(html.includes('<h2>Skill roadmap</h2>'));
  assertEggFree(html, 'guide render');
});
