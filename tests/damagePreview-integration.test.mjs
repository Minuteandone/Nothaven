import test from 'node:test';
import assert from 'node:assert/strict';
import { damagePreview } from '../src/combat/damagePreview.js';
import { createCombat, heroAction, knownSkills, heroStats } from '../src/combat/rules.js';
import { ENEMIES } from '../src/data/enemies.js';

const LEVELS = [1, 2, 7, 11, 17, 20];
const DIFFICULTIES = ['story', 'standard', 'veteran', 'stormborn'];
const ROLLS = [0, .25, .5, .75, .999999];
const DAMAGING = new Set(['damage', 'magic', 'pierce', 'break']);
const HEALTH = 100000;
function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}
function heroAt(level, geared) {
  return {
    id: 'hero', name: 'Wren', level, hp: HEALTH, maxHp: HEALTH,
    mp: HEALTH, maxMp: HEALTH, atk: 6 + 2 * (level - 1),
    def: 3 + level - 1, spd: 5 + level - 1, statuses: [],
    equipment: { weapon: geared ? 'tempest_edge' : null, armor: null, trinket: null },
    temper: { weapon: geared ? 3 : 0 },
  };
}

// Synthetic formula regression, not an earned journey or a balance survey.
// Real actions supply the oracle: do not repeat the preview's damage arithmetic.
// Solo actors and ample HP/MP isolate Wren's damage without KO truncation.
test('damage previews match real action endpoints across foes, levels, fitted gear and difficulty', () => {
  let previews = 0, actions = 0;
  for (const enemyId of Object.keys(ENEMIES)) for (const level of LEVELS)
    for (const geared of [false, true]) for (const difficulty of DIFFICULTIES) {
      const hero = heroAt(level, geared);
      assert.equal(heroStats(hero).atk, hero.atk + (geared ? 27 : 0), 'Tempest Edge +21 and three +2 fittings are actually equipped');
      for (const skill of [null, ...knownSkills(hero).filter(s => DAMAGING.has(s.kind))]) {
        const label = `${enemyId}/${level}/${geared ? 'fitted' : 'bare'}/${difficulty}/${skill?.id || 'attack'}`;
        const combat = createCombat({ enemyId, difficulty });
        combat.enemy.hp = combat.enemy.maxHp = HEALTH;
        const input = freeze(structuredClone({ hero, enemy: combat.enemy, skill }));
        const before = structuredClone(input);
        const preview = damagePreview(input.skill, input.hero, input.enemy);
        assert.deepEqual(input, before, `${label}: preview is read-only`);
        assert.ok(preview, label);
        const observed = ROLLS.map(roll => {
          const actor = structuredClone(hero), battle = structuredClone(combat);
          const result = heroAction(battle, actor, skill
            ? { type: 'skill', skillId: skill.id } : { type: 'attack' }, () => roll, [actor]);
          assert.equal(result.ok, true, `${label}/${roll}: real action succeeds`);
          const damage = HEALTH - battle.enemy.hp;
          assert.ok(damage >= preview.min && damage <= preview.max,
            `${label}/${roll}: actual ${damage} outside ${preview.min}–${preview.max}`);
          actions++;
          return damage;
        });
        assert.equal(Math.min(...observed), preview.min, `${label}: exact minimum`);
        assert.equal(Math.max(...observed), preview.max, `${label}: exact maximum`);
        previews++;
      }
    }
  assert.equal(previews, Object.keys(ENEMIES).length * 264);
  assert.equal(actions, previews * ROLLS.length);
});

test('all unlocked non-damaging skills omit previews without mutating frozen inputs', () => {
  let checked = 0;
  for (const enemyId of Object.keys(ENEMIES)) for (const level of LEVELS)
    for (const geared of [false, true]) for (const difficulty of DIFFICULTIES) {
      const hero = heroAt(level, geared);
      for (const skill of knownSkills(hero).filter(s => !DAMAGING.has(s.kind))) {
        const input = freeze(structuredClone({ hero, enemy: createCombat({ enemyId, difficulty }).enemy, skill }));
        const before = structuredClone(input);
        assert.equal(damagePreview(input.skill, input.hero, input.enemy), null, `${enemyId}/${level}/${skill.id}`);
        assert.deepEqual(input, before);
        checked++;
      }
    }
  assert.equal(checked, Object.keys(ENEMIES).length * 192);
});
