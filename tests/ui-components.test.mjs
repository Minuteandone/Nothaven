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

test('meter renders enrage marker when marker param is set for hp meters', () => {
  // marker=0 (default): no marker rendered
  const noMarker = meter({ label: 'Health', value: 50, max: 100 });
  assert.doesNotMatch(noMarker, /meter__marker/);
  // marker=50, tone=hp: marker rendered at correct position with tooltip
  const withMarker = meter({ label: 'Health', value: 80, max: 100, marker: 50 });
  assert.match(withMarker, /meter__marker/);
  assert.match(withMarker, /left:50%/);
  assert.match(withMarker, /Boss enrages at or below 50% HP/);
  // marker should not render on non-hp meters
  const mpMeter = meter({ label: 'Mana', value: 5, max: 10, tone: 'mp', marker: 30 });
  assert.doesNotMatch(mpMeter, /meter__marker/);
  // marker at 100 or 0 should not render
  const edge1 = meter({ label: 'Health', value: 10, max: 100, marker: 100 });
  assert.doesNotMatch(edge1, /meter__marker/);
  const edge2 = meter({ label: 'Health', value: 10, max: 100, marker: 0 });
  assert.doesNotMatch(edge2, /meter__marker/);
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
  // level 2 with 30 XP: floor=15, ceiling=45, earned=15, needed=30
  const html = partyStatus([{ name: '<Wren>', level: 2, hp: 12, maxHp: 30, mp: 4, maxMp: 10, xp: 30 }]);
  assert.match(html, /&lt;Wren&gt;/);
  assert.match(html, /Level 2/);
  assert.match(html, /15 \/ 30 XP/);
  assert.match(html, /· to Level 3/);
  assert.doesNotMatch(html, /<Wren>/);
});

test('partyStatus shows XP progress toward next level', () => {
  // level 2 at floor (15 XP): 0 / 30 earned
  let html = partyStatus([{ name: 'Wren', level: 2, hp: 20, maxHp: 30, mp: 5, maxMp: 10, xp: 15 }]);
  assert.match(html, /0 \/ 30 XP/);
  assert.match(html, /· to Level 3/);

  // level 20 max: should show (Max level) without progress
  html = partyStatus([{ name: 'Wren', level: 20, hp: 200, maxHp: 200, mp: 50, maxMp: 50, xp: 9999 }]);
  assert.match(html, /9999 XP \(Max level\)/);
  assert.doesNotMatch(html, /· to Level/);

  // level 1 fresh: 0 / 15 XP
  html = partyStatus([{ name: 'Wren', level: 1, hp: 20, maxHp: 20, mp: 5, maxMp: 5, xp: 0 }]);
  assert.match(html, /0 \/ 15 XP/);
  assert.match(html, /· to Level 2/);
});

test('partyStatus renders role badge for companions', () => {
  // Keeper companion
  let html = partyStatus([{ name: 'Iven', role: 'keeper', level: 5, hp: 40, maxHp: 40, mp: 8, maxMp: 8, xp: 100 }]);
  assert.match(html, /class="party-member__role"/);
  assert.match(html, /Keeper/);

  // Guardian companion
  html = partyStatus([{ name: 'Bram', role: 'guardian', level: 4, hp: 60, maxHp: 60, mp: 3, maxMp: 3, xp: 80 }]);
  assert.match(html, /Guardian/);

  // Signaler companion
  html = partyStatus([{ name: 'Sela', role: 'signaler', level: 3, hp: 35, maxHp: 35, mp: 9, maxMp: 9, xp: 60 }]);
  assert.match(html, /Signaler/);

  // Scout companion
  html = partyStatus([{ name: 'Tamsin', role: 'scout', level: 6, hp: 45, maxHp: 45, mp: 4, maxMp: 4, xp: 120 }]);
  assert.match(html, /Scout/);
});

test('partyStatus does not render role badge for hero (no role)', () => {
  const html = partyStatus([{ name: 'Wren', level: 3, hp: 25, maxHp: 25, mp: 6, maxMp: 6, xp: 50 }]);
  assert.doesNotMatch(html, /class="party-member__role"/);
  assert.doesNotMatch(html, /Keeper|Guardian|Signaler|Scout/);
});

test('partyStatus role badge ignores unknown, inherited, and non-string roles', () => {
  const roles = [
    'bard', 'constructor', 'toString', '__proto__',
    { toString: () => 'keeper' }, 1, Symbol('keeper'),
  ];
  for (const role of roles) {
    const html = partyStatus([{ name: 'Traveller', role, level: 1, hp: 20, maxHp: 20, mp: 5, maxMp: 5, xp: 0 }]);
    assert.doesNotMatch(html, /class="party-member__role"/, `role ${String(role)} should not render a badge`);
  }
});

test('party headings escape', () => {
  assert.match(sceneHeader({ title: '<Greyhaven>', eyebrow: 'Ward' }), /&lt;Greyhaven&gt;/);
});
