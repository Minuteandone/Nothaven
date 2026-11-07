import test from 'node:test';
import assert from 'node:assert/strict';
import { skillRestorationPreview } from '../src/combat/restorationPreview.js';
import { createInitialState } from '../src/state.js';
import { createCombat, heroAction, heroStats, knownSkills } from '../src/combat/rules.js';
import { renderCombat } from '../src/ui/combat.js';
import { escapeHTML } from '../src/ui/components.js';

const ids = ['mend', 'rallying_light', 'steady_signal', 'rekindle', 'stormhaven_vigil'];
function freeze(o) {
  if (o && typeof o === 'object') { Object.values(o).forEach(freeze); Object.freeze(o); }
  return o;
}
function party(level = 20) {
  const base = createInitialState().party[0];
  return ['Wren', 'Bram', 'Sela'].map((name, i) => ({ ...base, id: ['hero', 'bram', 'sela'][i], name,
    level, maxHp: 127, hp: 10, mp: 100, maxMp: 100, statuses: [], tactic: 'conserve' }));
}
function card(html, id) {
  const match = html.match(new RegExp(`<button[^>]*data-action="skill"[^>]*data-arg="${id}"[^>]*>[\\s\\S]*?<\\/button>`));
  assert.ok(match, id); return match[0];
}

test('Mend previews literal self-only restoration, effective caps, zero and negative overcap deltas', () => {
  const p = party(1); p[0].maxHp = 30;
  assert.equal(skillRestorationPreview('mend', p), 'If used now: Wren +12 HP.');
  p[0].hp = 28;
  assert.equal(skillRestorationPreview('mend', p), 'If used now: Wren +2 HP.');
  p[0].hp = 30;
  assert.equal(skillRestorationPreview('mend', p), 'If used now: Wren +0 HP.');
  p[0].hp = 32;
  assert.equal(skillRestorationPreview('mend', p), 'If used now: Wren -2 HP.');
  p[0].equipment = { armor: 'maelstrom_plate' }; p[0].hp = 40;
  assert.equal(skillRestorationPreview('mend', p), 'If used now: Wren +4 HP.');
});

test('party support previews include only eligible members and actual conditions', () => {
  const p = party(19); p[0].statuses = ['bleeding']; p[1].hp = 127; p[1].statuses = ['bleeding', 'shocked']; p[2].hp = 0; p[2].statuses = ['bleeding'];
  assert.equal(skillRestorationPreview('rallying_light', p), 'If used now: Wren +44 HP · Clears bleeding; Bram +0 HP · Clears bleeding.');
  assert.equal(skillRestorationPreview('stormhaven_vigil', p), 'If used now: Wren +45 HP · Clears bleeding; Bram +0 HP · Clears bleeding, shocked.');
  assert.equal(skillRestorationPreview('steady_signal', p), 'If used now: Wren Clears bleeding; Bram Clears bleeding, shocked.');
  assert.equal(skillRestorationPreview('rekindle', p), 'If used now: Sela rises with 51 HP · Clears all conditions.');
  p[2].statuses = [];
  assert.equal(skillRestorationPreview('rekindle', p), 'If used now: Sela rises with 51 HP.');
  p[2].hp = 1;
  assert.equal(skillRestorationPreview('rekindle', p), 'No fallen ally to revive.');
  for (const m of p) m.statuses = ['stunned'];
  assert.equal(skillRestorationPreview('steady_signal', p), 'No bleeding or shock to clear.');
  // Stunned Wren is not rejected by the current heroAction path; do not invent a new gate.
  assert.equal(skillRestorationPreview('mend', p), 'If used now: Wren +48 HP.');
});

test('previews are read-only and omit unknown, unlearned, unaffordable or shock-blocked effects', () => {
  const p = party(1);
  for (const id of ['constructor', '__proto__', null, {}, 'power_strike', 'rallying_light', 'rekindle']) assert.equal(skillRestorationPreview(id, p), '');
  for (const value of [null, {}, [], [null], [{ ...p[0], hp: 0 }], [{ ...p[0], hp: NaN }]]) assert.equal(skillRestorationPreview('mend', value), '');
  p[0].mp = 3; assert.equal(skillRestorationPreview('mend', p), '');
  p[0].mp = 100; p[0].level = 20; p[0].statuses = ['shocked'];
  for (const id of ['mend', 'rallying_light', 'rekindle']) assert.equal(skillRestorationPreview(id, p), '');
  assert.match(skillRestorationPreview('steady_signal', p), /Wren Clears shocked/);
  assert.match(skillRestorationPreview('stormhaven_vigil', p), /Wren \+45 HP · Clears shocked/);
  const before = structuredClone(p); freeze(p);
  for (const id of ids) skillRestorationPreview(id, p);
  assert.deepEqual(p, before);
});

test('skill cards escape previews once and retain descriptions, damage ranges, shortcuts and caveat', () => {
  const p = party(); p[0].name = '<Wren & "Bram">'; p[2].hp = 0;
  const c = createCombat({ enemyId: 'ridge_bandit' }); const before = structuredClone({ p, c });
  freeze(p); freeze(c);
  const html = renderCombat({ combat: c, party: p, menu: 'skills' });
  const mend = card(html, 'mend');
  assert.ok(mend.includes(escapeHTML('If used now: <Wren & "Bram"> +50 HP.')));
  assert.doesNotMatch(mend, /&amp;lt;|<Wren/);
  assert.match(mend, /Steady breath and practiced hands restore health\./);
  assert.match(mend, /skill-use-preview/); assert.match(mend, /key-hint[^]*?2/);
  assert.match(card(html, 'power_strike'), /class="damage-range"/);
  assert.doesNotMatch(card(html, 'power_strike'), /skill-use-preview/);
  assert.match(html, /Restoration previews show immediate effects before allies act and the normal enemy reply, not end-of-turn totals\./);
  assert.deepEqual({ p, c }, before);
  const low = party(1), lowHtml = renderCombat({ combat: c, party: low, menu: 'skills' });
  const upcoming = lowHtml.match(/<details class="locked-skills">[\s\S]*?<\/details>/)[0];
  assert.doesNotMatch(upcoming, /skill-use-preview|If used now:/);
  assert.doesNotMatch(renderCombat({ combat: c, party: p, menu: 'main' }), /Restoration previews|skill-use-preview/);
});

test('previews match first HP and status writes from real support actions, not end-of-turn totals', () => {
  let checked = 0; const bySkill = Object.fromEntries(ids.map(id => [id, 0]));
  for (const level of [1, 4, 6, 15, 19, 20]) for (const geared of [false, true])
    for (const resource of ['low', 'near', 'full', 'over']) for (const conditions of [[], ['bleeding'], ['shocked'], ['bleeding', 'shocked']])
      for (const id of ids) {
        const p = party(level);
        for (const m of p) {
          if (geared) { m.equipment = { armor: 'maelstrom_plate' }; m.temper = { armor: 3 }; }
          const max = heroStats(m).maxHp;
          m.hp = resource === 'low' ? 1 : max + ({ near: -2, full: 0, over: 7 }[resource]);
          m.statuses = [...conditions];
        }
        p[2].hp = 0;
        if (!knownSkills(p[0]).some(s => s.id === id) || (conditions.includes('shocked') && !['steady_signal', 'stormhaven_vigil'].includes(id))) continue;
        const before = structuredClone(p), expectedPreview = skillRestorationPreview(id, freeze(p));
        const live = structuredClone(before), writes = live.map(() => ({}));
        live.forEach((m, i) => {
          for (const key of ['hp', 'statuses']) {
            let value = m[key];
            Object.defineProperty(m, key, { enumerable: true, configurable: true,
              get: () => value, set: next => { if (!(key in writes[i])) writes[i][key] = structuredClone(next); value = next; } });
          }
        });
        const c = createCombat({ enemyId: 'storm_heart' }); c.enemy.hp = c.enemy.maxHp = 1000000;
        c.enemy.statuses = ['stunned']; c.enemyTimers = { stunned: 1 };
        const result = heroAction(c, live[0], { type: 'skill', skillId: id }, () => .5, live);
        assert.equal(result.ok, true);
        const rows = [];
        before.forEach((m, i) => {
          const eligible = id === 'mend' ? i === 0 : id === 'rekindle' ? i > 0 && m.hp <= 0 : m.hp > 0;
          if (!eligible) return;
          const parts = [];
          if (id === 'rekindle') {
            assert.ok('hp' in writes[i]); parts.push(`rises with ${writes[i].hp} HP`);
            if (m.statuses.length) { assert.deepEqual(writes[i].statuses, []); parts.push('Clears all conditions'); }
          } else {
            if (id !== 'steady_signal') {
              assert.ok('hp' in writes[i]); const delta = writes[i].hp - m.hp;
              parts.push(`${delta >= 0 ? '+' : ''}${delta} HP`);
            }
            if (id !== 'mend') {
              assert.ok(Array.isArray(writes[i].statuses));
              const cleared = ['bleeding', 'shocked'].filter(s => m.statuses.includes(s) && !writes[i].statuses.includes(s));
              if (cleared.length) parts.push(`Clears ${cleared.join(', ')}`);
            }
          }
          if (parts.length) rows.push(`${m.name} ${parts.join(' · ')}`);
        });
        const observed = rows.length ? `If used now: ${rows.join('; ')}.` : 'No bleeding or shock to clear.';
        assert.equal(expectedPreview, observed, `${id} L${level} ${geared} ${resource} ${conditions}`);
        assert.deepEqual(p, before); checked++; bySkill[id]++;
      }
  assert.equal(checked, 416);
  assert.deepEqual(bySkill, { mend: 96, rallying_light: 80, steady_signal: 128, rekindle: 48, stormhaven_vigil: 64 });
});
