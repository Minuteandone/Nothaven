import test from 'node:test';
import assert from 'node:assert/strict';
import { drillsText, endingScene } from '../src/scenes/ending.js';
import { DRILL_FOES } from '../src/scenes/drills.js';

test('drillsText is null before any drill or gauntlet', () => {
  assert.equal(drillsText({}), null);
  assert.equal(drillsText({ drillRecords: { [DRILL_FOES[0]]: { wins: 0, best: 0 } } }), null);
  assert.equal(drillsText(null), null);
});

test('drillsText sums drill wins and ignores malformed or unknown records', () => {
  const [a, b] = DRILL_FOES;
  const state = { drillRecords: { [a]: { wins: 2, best: 4 }, [b]: { wins: 3, best: 5 }, not_a_boss: { wins: 9, best: 1 }, [DRILL_FOES[2]]: { wins: 'x' } } };
  assert.equal(drillsText(state), 'Sparring drills won: 5');
});

test('drillsText adds the best Yard Gauntlet run with singular and plural foes', () => {
  const a = DRILL_FOES[0];
  assert.equal(drillsText({ drillRecords: { [a]: { wins: 1, best: 3 } }, drillGauntlet: { runs: 2, best: 4 } }), 'Sparring drills won: 1 (Yard Gauntlet best: 4 foes beaten)');
  assert.equal(drillsText({ drillGauntlet: { runs: 1, best: 1 } }), 'Sparring drills won: 0 (Yard Gauntlet best: 1 foe beaten)');
});

test('ending renders the drills line only after a drill, between feats and the board record', () => {
  const base = { party: [{ name: 'Wren', level: 5 }], gold: 0, inventory: [], story: { flags: {} } };
  assert.doesNotMatch(endingScene.render({ state: base }), /ending-drills/);
  const html = endingScene.render({ state: { ...base, drillRecords: { [DRILL_FOES[0]]: { wins: 2, best: 3 } } } });
  assert.match(html, /<li class="ending-drills">Sparring drills won: 2<\/li>/);
  assert.ok(html.indexOf('ending-feats') < html.indexOf('ending-drills'));
});
