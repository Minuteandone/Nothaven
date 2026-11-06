import test from 'node:test';
import assert from 'node:assert/strict';
import { drillsSummaryText, drillsScene, DRILL_FOES } from '../src/scenes/drills.js';

test('drillsSummaryText counts unlocked drills, foes bested and victories', () => {
  const total = DRILL_FOES.length;
  assert.equal(drillsSummaryText({}), `Drills unlocked: 0 of ${total} · Foes bested in drills: 0 · Drill victories: 0`);
  assert.equal(drillsSummaryText(null), `Drills unlocked: 0 of ${total} · Foes bested in drills: 0 · Drill victories: 0`);
  const [a, b, c] = DRILL_FOES;
  const state = {
    bestiary: { [a]: 1, [b]: 2, [c]: 'x' },
    drillRecords: { [a]: { wins: 2, best: 4 }, [b]: { wins: 'x' }, not_a_boss: { wins: 9, best: 1 } },
  };
  assert.equal(drillsSummaryText(state), `Drills unlocked: 2 of ${total} · Foes bested in drills: 1 · Drill victories: 2`);
});

test('drills scene renders the escaped summary above the roster', () => {
  const html = drillsScene.render({ state: { bestiary: { [DRILL_FOES[0]]: 1 }, drillRecords: { [DRILL_FOES[0]]: { wins: 3, best: 2 } } } });
  assert.match(html, /<p class="drills__summary">Drills unlocked: 1 of \d+ · Foes bested in drills: 1 · Drill victories: 3<\/p>/);
  assert.ok(html.indexOf('drills__summary') < html.indexOf('drills__list'));
});
