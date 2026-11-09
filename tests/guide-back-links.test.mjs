import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { guideScene, guideContents, GUIDE_CONTENTS_ID } from '../src/scenes/guide.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('every guide section links back to the contents nav', () => {
  const html = guideScene.render({ state: {} });
  assert.equal(GUIDE_CONTENTS_ID, 'guide-contents');
  assert.equal((html.match(/id="guide-contents"/g) || []).length, 1);
  assert.match(html, /<nav class="panel guide-toc" id="guide-contents"/);
  assert.ok(!guideContents().some((r) => r.id === GUIDE_CONTENTS_ID), 'no section may reuse the contents id');
  const sections = [...html.matchAll(/<section class="guide-section" id="([^"]+)">([\s\S]*?)<\/section>/g)];
  assert.equal(sections.length, guideContents().length);
  for (const [, id, body] of sections) {
    const links = body.match(/class="guide-section__back-link" href="#guide-contents">Back to contents<\/a>/g) || [];
    assert.equal(links.length, 1, `${id} has one back link`);
    assert.ok(body.trimEnd().endsWith('Back to contents</a></p>'), `${id} ends with its back link`);
  }
  assertEggFree('Back to contents', 'guide back link');
});

test('contents nav clears the sticky audio dock and back links are touch-sized', async () => {
  const css = await readFile(new URL('../style.css', import.meta.url), 'utf8');
  const dock = Number(css.match(/\.audio-dock__inner \{[^}]*min-height: (\d+)px/)[1]);
  const rule = css.match(/\.guide-toc \{ scroll-margin-top: calc\((\d+)px \+ ([\d.]+)rem\); \}/);
  assert.ok(rule, 'nav scroll-margin rule present');
  assert.ok(Number(rule[1]) >= dock && Number(rule[2]) >= 1);
  assert.match(css, /\.guide-section__back-link \{[^}]*min-height: 44px/);
});
