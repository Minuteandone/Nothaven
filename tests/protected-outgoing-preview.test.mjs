import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCombat } from '../src/ui/combat.js';
import { createCombat, heroAction, knownSkills, heroStats } from '../src/combat/rules.js';
import { ENEMIES } from '../src/data/enemies.js';

const LEVELS = [2, 17, 20];
const DIFFICULTIES = ['story', 'standard', 'veteran', 'stormborn'];
const ROLLS = [0, .25, .5, .75, .999999];
const DAMAGING = new Set(['damage', 'magic', 'pierce', 'break']);
const HEALTH = 100000;
const PROTECTIONS = [
  { name: 'baseline', defending: false, wardTurns: 0, aegisTurns: 0 },
  { name: 'defending', defending: true, wardTurns: 0, aegisTurns: 0 },
  { name: 'ward', defending: false, wardTurns: 2, aegisTurns: 0 },
  { name: 'aegis', defending: false, wardTurns: 0, aegisTurns: 2 },
  { name: 'combined', defending: true, wardTurns: 2, aegisTurns: 2 },
];
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
function button(html, action, arg, label) {
  const matches = [...html.matchAll(/<button\b[^>]*>[\s\S]*?<\/button>/g)]
    .map(match => match[0]).filter(markup => {
      const opening = markup.slice(0, markup.indexOf('>'));
      return opening.includes(`data-action="${action}"`) &&
        (arg === undefined || opening.includes(`data-arg="${arg}"`));
    });
  assert.equal(matches.length, 1, `${label}: exactly one command button`);
  return matches[0];
}
function range(markup, className, label) {
  const matches = [...markup.matchAll(new RegExp(`<span class="${className}">(\\d+)–(\\d+)</span>`, 'g'))];
  assert.equal(matches.length, 1, `${label}: exactly one numeric range`);
  return { min: Number(matches[0][1]), max: Number(matches[0][2]) };
}
function renderFrozen(combat, hero, menu, label) {
  const input = freeze(structuredClone({ combat, party: [hero], inventory: [], menu }));
  const before = structuredClone(input), html = renderCombat(input);
  assert.deepEqual(input, before, `${label}/${menu}: whole render input unchanged`);
  return html;
}

// Synthetic renderer-to-action regression, not earned gameplay, balance, or browser/SR coverage.
// Incoming protections must not halve outgoing badges. Real actions, not preview arithmetic,
// supply the oracle; solo actors and ample HP/MP avoid allies and KO truncation.
test('rendered outgoing ranges match real actions under Defend, Ward and Aegis', () => {
  let renders = 0, ranges = 0, actions = 0, nonDamaging = 0;
  for (const enemyId of Object.keys(ENEMIES)) for (const level of LEVELS)
    for (const geared of [false, true]) for (const difficulty of DIFFICULTIES) {
      const hero = heroAt(level, geared), skills = knownSkills(hero);
      assert.equal(heroStats(hero).atk, hero.atk + (geared ? 27 : 0), 'equipped Edge plus three fittings');
      const baseline = new Map();
      for (const { name, ...protection } of PROTECTIONS) {
        const label = `${enemyId}/L${level}/${geared ? 'fitted' : 'bare'}/${difficulty}/${name}`;
        const combat = createCombat({ enemyId, difficulty });
        combat.enemy.hp = combat.enemy.maxHp = HEALTH;
        Object.assign(combat, protection);
        const main = renderFrozen(combat, hero, 'main', label);
        const menu = renderFrozen(combat, hero, 'skills', label);
        renders += 2;
        for (const skill of [null, ...skills]) {
          const id = skill?.id || 'attack', commandLabel = `${label}/${id}`;
          const markup = button(skill ? menu : main, skill ? 'skill' : 'attack', skill?.id, commandLabel);
          if (skill && !DAMAGING.has(skill.kind)) {
            assert.doesNotMatch(markup, /class="(?:damage-range|damage-preview-badge)"/, `${commandLabel}: no damage range`);
            nonDamaging++;
            continue;
          }
          const displayed = range(markup, skill ? 'damage-range' : 'damage-preview-badge', commandLabel);
          const observed = ROLLS.map(roll => {
            const actor = structuredClone(hero), battle = structuredClone(combat);
            const result = heroAction(battle, actor, skill
              ? { type: 'skill', skillId: skill.id } : { type: 'attack' }, () => roll, [actor]);
            assert.equal(result.ok, true, `${commandLabel}/${roll}: real action succeeds`);
            const damage = HEALTH - battle.enemy.hp;
            assert.ok(damage >= displayed.min && damage <= displayed.max,
              `${commandLabel}/${roll}: actual ${damage} outside rendered ${displayed.min}–${displayed.max}`);
            actions++;
            return damage;
          });
          assert.equal(displayed.min, Math.min(...observed), `${commandLabel}: exact minimum`);
          assert.equal(displayed.max, Math.max(...observed), `${commandLabel}: exact maximum`);
          if (name === 'baseline') baseline.set(id, { displayed, observed });
          else assert.deepEqual({ displayed, observed }, baseline.get(id), `${commandLabel}: incoming protection leaves outgoing damage unchanged`);
          ranges++;
        }
      }
    }
  const configurations = Object.keys(ENEMIES).length * 2 * DIFFICULTIES.length * PROTECTIONS.length;
  const damagePerLevels = LEVELS.reduce((n, level) => n + 1 + knownSkills(heroAt(level, false)).filter(s => DAMAGING.has(s.kind)).length, 0);
  const nonDamagePerLevels = LEVELS.reduce((n, level) => n + knownSkills(heroAt(level, false)).filter(s => !DAMAGING.has(s.kind)).length, 0);
  assert.ok(damagePerLevels > 0 && nonDamagePerLevels > 0);
  assert.equal(renders, configurations * LEVELS.length * 2);
  assert.equal(ranges, configurations * damagePerLevels);
  assert.equal(actions, ranges * ROLLS.length);
  assert.equal(nonDamaging, configurations * nonDamagePerLevels);
});
