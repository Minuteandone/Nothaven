import test from 'node:test';
import assert from 'node:assert/strict';
import { ENEMIES } from '../src/data/enemies.js';
import { createInitialState } from '../src/state.js';
import { createCombat, checkBossPhase } from '../src/combat/rules.js';
import { renderCombat } from '../src/ui/combat.js';
import { meter } from '../src/ui/components.js';

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze); Object.freeze(value);
  }
  return value;
}
function render(combat, expected = null) {
  const input = { combat, party: createInitialState().party, inventory: [] };
  const before = structuredClone(input);
  const html = renderCombat(freeze(input));
  assert.deepEqual(input, before, 'render preserves the whole input');
  const descriptions = [...html.matchAll(/<p id="enemy-enrage-threshold" class="enemy-ability-detail">(.*?)<\/p>/g)];
  const links = [...html.matchAll(/<div class="meter[^>]*aria-describedby="enemy-enrage-threshold"[^>]*>/g)];
  assert.equal(descriptions.length, expected === null ? 0 : 1);
  assert.equal(links.length, expected === null ? 0 : 1);
  if (expected !== null) {
    assert.equal(descriptions[0][1], `Enrage threshold: ${expected} HP or lower.`);
    assert.ok(links[0][0].includes('aria-label="HP"'));
    const enemyCard = html.slice(html.indexOf('<article class="unit enemy'));
    assert.ok(enemyCard.includes(links[0][0]), 'only the enemy HP meter is linked');
    const meterEnd = enemyCard.indexOf('</div>\n  </div>');
    assert.ok(meterEnd >= 0 && meterEnd < enemyCard.indexOf(descriptions[0][0]), 'description follows, outside progressbar');
  }
  return html;
}

test('all canonical enemies and difficulties expose phase cutoffs without changing combat', () => {
  for (const enemy of Object.values(ENEMIES)) for (const difficulty of ['story','standard','veteran','stormborn']) {
    const combat = createCombat({ enemyId: enemy.id, difficulty });
    const expected = enemy.enrage ? Math.floor(combat.enemy.maxHp * enemy.enrage.threshold) : null;
    const html = render(combat, expected);
    if (expected !== null) {
      assert.match(html, /class="meter__marker" aria-hidden="true"/);
      const above = structuredClone(combat); above.enemy.hp = expected + 1;
      checkBossPhase(above); assert.equal(Boolean(above.enraged), false);
      if (expected > 0) {
        const at = structuredClone(combat); at.enemy.hp = expected;
        checkBossPhase(at); assert.equal(at.enraged, true, `${enemy.id}/${difficulty}`);
      }
      const already = structuredClone(combat); already.enraged = true;
      render(already, expected);
    }
  }
});

test('odd HP cutoff floors and missing threshold follows the phase default', () => {
  for (const [enrage, expected] of [[{ threshold: .35 }, 35], [{}, 50], [{ threshold: 'bad' }, 50]]) {
    const combat = createCombat({ enemyId: 'storm_rat' });
    Object.assign(combat.enemy, { maxHp: 101, hp: 101, enrage });
    render(combat, expected);
    const below = structuredClone(combat); below.enemy.hp = expected;
    checkBossPhase(below); assert.equal(below.enraged, true);
  }
});

test('invalid numeric thresholds or HP omit misleading threshold descriptions', () => {
  for (const threshold of [NaN, Infinity, -1, 0, 1, 2]) {
    const combat = createCombat({ enemyId: 'storm_rat' });
    combat.enemy.enrage = { threshold }; render(combat);
  }
  for (const maxHp of [NaN, Infinity, -1]) {
    const combat = createCombat({ enemyId: 'storm_rat' });
    Object.assign(combat.enemy, { maxHp, hp: maxHp, enrage: { threshold: .5 } }); render(combat);
  }
});

test('meter description references are optional and attribute-escaped', () => {
  const plain = meter({ label: 'MP', value: 5, max: 10, tone: 'mp' });
  assert.doesNotMatch(plain, /aria-describedby|meter__marker/);
  const escaped = meter({ label: 'HP', value: 5, max: 10, descriptionId: 'x" <tag>&' });
  assert.ok(escaped.includes('aria-describedby="x&quot; &lt;tag&gt;&amp;"'));
  assert.doesNotMatch(escaped, /<tag>/);
});
