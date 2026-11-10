import test from 'node:test';
import assert from 'node:assert/strict';
import { renderCombat, finishingBlowHint } from '../src/ui/combat.js';
import { createCombat } from '../src/combat/rules.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

// Level-2 Wren (atk 8) vs Storm Rat (def 1): Attack 6–9, Power Strike 10–13 (3 MP), Spark 12–14 (4 MP, magic).
function setup({ foeHp = 6, foeMax = 40, mp = 30, level = 2, hp = 30, statuses = [] } = {}) {
  const hero = { id: 'hero', name: 'Wren', level, hp, maxHp: 30, mp, maxMp: 30, atk: 8, def: 3, spd: 6, statuses };
  const combat = createCombat({ enemyId: 'storm_rat' });
  combat.enemy.maxHp = foeMax;
  combat.enemy.hp = foeHp;
  return { hero, combat };
}
const hint = (opts) => { const { hero, combat } = setup(opts); return finishingBlowHint(combat, hero); };
const wrap = (text) => `<p class="finishing-blow-hint"><span class="finishing-blow-hint__label">Finishing blow:</span> ${text}</p>`;

test('stays hidden while the foe is above half health, even if a skill could finish it', () => {
  assert.equal(hint({ foeHp: 11, foeMax: 20 }), '');
  assert.equal(hint({ foeHp: 10, foeMax: 20 }), wrap('Power Strike or Spark will defeat Storm Rat (10 HP left).'));
});

test('lists every action whose lowest roll reaches the remaining health', () => {
  assert.equal(hint({ foeHp: 6 }), wrap('Attack, Power Strike or Spark will defeat Storm Rat (6 HP left).'));
  assert.equal(hint({ foeHp: 7 }), wrap('Power Strike or Spark will defeat Storm Rat (7 HP left).'));
  assert.equal(hint({ foeHp: 12 }), wrap('Spark will defeat Storm Rat (12 HP left).'));
});

test('falls back to high-roll options when nothing is certain', () => {
  assert.equal(hint({ foeHp: 13 }), wrap('Power Strike or Spark could defeat Storm Rat (13 HP left) on a high roll.'));
  assert.equal(hint({ foeHp: 14 }), wrap('Spark could defeat Storm Rat (14 HP left) on a high roll.'));
  assert.equal(hint({ foeHp: 15 }), '');
});

test('skips skills the leader cannot afford', () => {
  assert.equal(hint({ foeHp: 12, mp: 3 }), wrap('Power Strike could defeat Storm Rat (12 HP left) on a high roll.'));
  assert.equal(hint({ foeHp: 12, mp: 2 }), '');
});

test('skips magic while shocked, keeping physical skills', () => {
  assert.equal(hint({ foeHp: 12, statuses: ['shocked'] }), wrap('Power Strike could defeat Storm Rat (12 HP left) on a high roll.'));
});

test('caps the list at three names', () => {
  const html = hint({ foeHp: 1, level: 20 });
  assert.equal(html, wrap('Attack, Power Strike or Spark (or 6 more) will defeat Storm Rat (1 HP left).'));
});

test('nothing once the battle is resolved or someone is down', () => {
  for (const over of ['victory', 'defeat', 'fled']) {
    const { hero, combat } = setup({ foeHp: 6 });
    combat.over = over;
    assert.equal(finishingBlowHint(combat, hero), '');
  }
  assert.equal(hint({ foeHp: 0 }), '');
  assert.equal(hint({ foeHp: 6, hp: 0 }), '');
  assert.equal(finishingBlowHint(null, setup().hero), '');
  assert.equal(finishingBlowHint(setup().combat, null), '');
});

test('escapes the foe name', () => {
  const { hero, combat } = setup({ foeHp: 6 });
  combat.enemy.name = 'Rat <b>&</b> Co';
  assert.ok(finishingBlowHint(combat, hero).includes('Rat &lt;b&gt;&amp;&lt;/b&gt; Co (6 HP left)'));
});

test('renders in the combat view below the knockout line and is egg-free', () => {
  const { hero, combat } = setup({ foeHp: 6 });
  const html = renderCombat({ combat, party: [hero], inventory: [], menu: 'main' });
  assert.equal(html.split('class="finishing-blow-hint"').length - 1, 1);
  assert.ok(html.indexOf('finishing-blow-hint') > html.indexOf('combat-enemy-title'));
  assert.ok(!/role="status"[^>]*>\s*<span class="finishing-blow-hint__label"/.test(html));
  assertEggFree(html.replace(/<[^>]+>/g, ' '), 'finishing blow hint');
});
