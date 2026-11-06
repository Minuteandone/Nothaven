import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCombat, incomingDamageHint } from '../src/ui/combat.js';
import { createCombat } from '../src/combat/rules.js';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function fixture() {
  const hero = { id: 'hero', name: 'Wren', level: 2, hp: 100, maxHp: 100,
    mp: 30, maxMp: 30, atk: 8, def: 3, spd: 6, statuses: [] };
  const combat = createCombat({ enemyId: 'storm_rat' });
  combat.enemy.atk = 20;
  return { combat, party: [hero], inventory: [], menu: 'main' };
}
function hint(input, expected = 1) {
  const before = structuredClone(input);
  const html = renderCombat(freeze(input));
  assert.deepEqual(input, before, 'whole render input unchanged');
  const matches = [...html.matchAll(/<p class="incoming-damage-hint">[\s\S]*?<\/p>/g)];
  assert.equal(matches.length, expected, 'one hint only when eligible');
  return matches[0]?.[0] || '';
}
const caveat = 'Estimate using current defenses, not a next-turn prediction.';

// Fixed numeric examples, not a second implementation of preview arithmetic.
// Synthetic renderer coverage, not earned gameplay or next-turn prediction.
test('basic incoming hint names its target and qualifies the estimate', () => {
  const text = hint(fixture());
  assert.equal(text, `<p class="incoming-damage-hint"><span class="incoming-damage-label">Basic hit vs Wren:</span> 16–19 · ${caveat} Abilities and other targets differ.</p>`);
  assert.doesNotMatch(text, /Foe attack|Unleashed/);
});

test('current Defend, Ward and Aegis change the displayed range only once', () => {
  for (const protection of [{ defending: true }, { wardTurns: 2 }, { aegisTurns: 2 },
    { defending: true, wardTurns: 2, aegisTurns: 2 }]) {
    for (const windup of [false, true]) {
      const input = fixture();
      Object.assign(input.combat, protection);
      if (windup) {
        input.combat.enemy.windup = { name: 'Crush', mult: 2, chance: .2 };
        input.combat.windup = { name: 'Crush' };
      }
      const text = hint(input);
      assert.ok(text.includes(`</span> ${windup ? '18–19' : '8–9'} (halved) · ${caveat}`));
      assert.ok(text.includes(windup ? 'Unleashed Crush vs Wren:' : 'Basic hit vs Wren:'));
      assert.equal(text.includes('Abilities and other targets differ.'), !windup);
    }
  }
});

test('windup and target names are escaped once at the rendering boundary', () => {
  const input = fixture();
  input.party[0].name = 'Wren & <Scout> "One"';
  input.combat.enemy.windup = { name: 'Fallback', mult: 2, chance: .2 };
  input.combat.windup = { name: 'Crush & <img src=x> "Now"' };
  const text = hint(input);
  assert.equal(text, `<p class="incoming-damage-hint"><span class="incoming-damage-label">Unleashed Crush &amp; &lt;img src=x&gt; &quot;Now&quot; vs Wren &amp; &lt;Scout&gt; &quot;One&quot;:</span> 36–39 · ${caveat}</p>`);
  assert.doesNotMatch(text, /<img|<Scout>|&amp;(?:amp|lt|gt|quot);/);
  const basic = fixture();
  basic.party[0].name = 'Wren & <Scout>';
  assert.ok(hint(basic).includes('Basic hit vs Wren &amp; &lt;Scout&gt;:'));
});

test('single-value minimum stays compact and unavailable previews are omitted', () => {
  const input = fixture();
  input.party[0].def = 100;
  assert.ok(hint(input).includes(`</span> 1 · ${caveat}`));
  for (const changes of [{ hp: 0 }, { atk: 0 }]) {
    const missing = fixture();
    Object.assign(missing.combat.enemy, changes);
    assert.equal(hint(missing, 0), '');
  }
  const hero = freeze(fixture().party[0]);
  const empty = freeze({});
  assert.equal(incomingDamageHint(null, hero), '');
  assert.equal(incomingDamageHint(empty, hero), '');
  assert.equal(incomingDamageHint(freeze(fixture().combat), null), '');
  assert.deepEqual(empty, {});
});
