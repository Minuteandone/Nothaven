import test from 'node:test';
import assert from 'node:assert/strict';
import { escapeHTML, icon, meter, partyStatus, sceneHeader, uiButton } from '../src/ui/components.js';

test('escapeHTML neutralizes markup and attribute delimiters', () => {
  assert.equal(escapeHTML(`<img src=x onerror="oops"> & '`), '&lt;img src=x onerror=&quot;oops&quot;&gt; &amp; &#39;');
});

test('meter clamps invalid and out-of-range values and exposes ARIA state', () => {
  const high = meter({ label: 'Health', value: 30, max: 20 });
  assert.match(high, /aria-valuenow="20"/);
  assert.match(high, /aria-valuemax="20"/);
  assert.match(high, /width:100%/);
  const invalid = meter({ label: 'Health', value: 'bad', max: 0 });
  assert.match(invalid, /aria-valuenow="0"/);
  assert.match(invalid, /aria-valuemax="1"/);
});

test('button escapes labels and args and uses native disabled state', () => {
  const html = uiButton({ action: 'talk', label: '<Talk>', iconName: 'journal', arg: '" onmouseover="bad', disabled: true });
  assert.match(html, /&lt;Talk&gt;/);
  assert.match(html, /data-arg="&quot; onmouseover=&quot;bad"/);
  assert.match(html, / disabled/);
  assert.doesNotMatch(html, /<Talk>/);
});

test('icons are decorative and unknown names use the compass fallback', () => {
  assert.equal(icon('not-an-icon'), icon('compass'));
  assert.match(icon('heart'), /aria-hidden="true"/);
  assert.match(icon('heart'), /focusable="false"/);
});

test('party and headings escape content and render resources', () => {
  const html = partyStatus([{ name: '<Wren>', level: 2, hp: 12, maxHp: 30, mp: 4, maxMp: 10, xp: 8 }]);
  assert.match(html, /&lt;Wren&gt;/);
  assert.match(html, /Level 2/);
  assert.match(html, /8 XP/);
  assert.doesNotMatch(html, /<Wren>/);
  assert.match(sceneHeader({ title: '<Greyhaven>', eyebrow: 'Ward' }), /&lt;Greyhaven&gt;/);
});
