import test from 'node:test';
import assert from 'node:assert/strict';
import { guideScene, GUIDE_SECTIONS } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

test('guide lines are stored as plain text and rendered escaped exactly once', () => {
  const html = guideScene.render({});
  const lines = GUIDE_SECTIONS.flatMap((s) => s.lines);
  for (const line of lines) {
    assert.doesNotMatch(line, /&(amp|lt|gt|quot|#39);/, 'guide data holds plain text, not pre-escaped entities');
    assert.doesNotMatch(line, /<[a-z\/]/i, 'guide data holds no markup');
    assert.ok(html.includes(`<li>${escapeHTML(line)}</li>`), `rendered once-escaped: ${line.slice(0, 40)}`);
  }
  assert.ok(html.includes('Buy 5 and Buy &amp; equip stay unchanged'));
  assert.ok(!html.includes('&amp;amp;'), 'no double escaping');
  assert.ok(html.includes('It&#39;s super effective!'));
  assertEggFree(lines.join('\n'), 'guide lines');
});
