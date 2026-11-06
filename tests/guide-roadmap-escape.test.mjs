import test from 'node:test';
import assert from 'node:assert/strict';
import { guideScene, skillRoadmap, GUIDE_SECTIONS } from '../src/scenes/guide.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('guide skill roadmap renders every skill as escaped plain text in level order', () => {
  const html = guideScene.render({});
  const items = [...html.matchAll(/<ul class="guide-skills">(.*?)<\/ul>/gs)][0][1];
  const lines = [...items.matchAll(/<li>(.*?)<\/li>/g)].map((m) => m[1]);
  const roadmap = skillRoadmap();
  assert.equal(lines.length, roadmap.length);
  assert.equal(lines.length, 15);
  roadmap.forEach((r, i) => assert.equal(lines[i], `Level ${r.level}: ${r.name}`));
  assert.equal(lines[0].startsWith('Level 1: '), true);
  assert.equal(lines.at(-1), 'Level 20: Stillpoint Strike');
  for (const s of GUIDE_SECTIONS) assert.ok(html.includes(`<h2>${s.title}</h2>`));
  assertEggFree(lines.join('\n'), 'guide skill roadmap');
});
