import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { journalYardText, DRILL_FOES } from '../src/scenes/drills.js';
import { townFeatsText } from '../src/scenes/feats.js';
import { questJournalScene } from '../src/scenes/quests.js';
import { createInitialState } from '../src/state.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'The Journey Journal repeats that feat line and, once you have won a drill or attempted the Yard Gauntlet, adds a training yard line with your drill victories, the foes you have bested in drills and your best gauntlet run.';

test('training yard line is null with no drill wins and no gauntlet runs, including malformed saves', () => {
  assert.equal(journalYardText(createInitialState()), null);
  assert.equal(journalYardText(null), null);
  assert.equal(journalYardText({}), null);
  assert.equal(journalYardText({ drillRecords: { [DRILL_FOES[0]]: { wins: -3, best: 'x' } }, drillGauntlet: { runs: 0, best: 4 } }), null);
  assert.equal(journalYardText({ drillRecords: 'bad', drillGauntlet: 'bad' }), null);
});

test('training yard line counts victories, distinct foes and the gauntlet best', () => {
  const [a, b] = DRILL_FOES;
  assert.equal(journalYardText({ drillRecords: { [a]: { wins: 1, best: 3 } } }), 'Training yard: 1 drill victory over 1 foe.');
  const two = { drillRecords: { [a]: { wins: 2, best: 3 }, [b]: { wins: 3, best: 5 } } };
  assert.equal(journalYardText(two), 'Training yard: 5 drill victories over 2 foes.');
  assert.equal(journalYardText({ ...two, drillGauntlet: { runs: 2, best: 1 } }), 'Training yard: 5 drill victories over 2 foes · Yard Gauntlet best: 1 foe beaten.');
  assert.equal(journalYardText({ drillGauntlet: { runs: 1, best: 0 } }), 'Training yard: Yard Gauntlet best: 0 foes beaten.');
  const text = journalYardText({ ...two, drillGauntlet: { runs: 4, best: 6 } });
  assert.equal(text, 'Training yard: 5 drill victories over 2 foes · Yard Gauntlet best: 6 foes beaten.');
  assertEggFree(text, 'training yard line');
});

test('journal renders feats and yard lines only with their scenes and progress', () => {
  const s = createInitialState();
  s.scene = 'quests'; s.combat = null;
  const game = { state: s, scenes: { feats: {}, drills: {} }, questJournalFilter: 'active' };
  let html = questJournalScene.render(game);
  assert.ok(!html.includes('quest-feats') && !html.includes('quest-yard'));
  s.story.flags = { ...(s.story.flags || {}), rescue_reward: true };
  s.drillRecords = { [DRILL_FOES[0]]: { wins: 2, best: 4 } };
  s.drillGauntlet = { runs: 1, best: 2 };
  html = questJournalScene.render(game);
  const feats = `<p class="quest-feats">${escapeHTML(townFeatsText(s))}</p>`;
  const yard = `<p class="quest-yard">${escapeHTML(journalYardText(s))}</p>`;
  assert.ok(html.includes(feats), html);
  assert.ok(html.includes(yard), html);
  assert.ok(html.indexOf(feats) < html.indexOf(yard));
  assert.ok(html.indexOf(yard) < html.indexOf('quest-journal__filters'));
  const bare = questJournalScene.render({ ...game, scenes: {} });
  assert.ok(!bare.includes('quest-feats') && !bare.includes('quest-yard'));
});

test('guide documents the journal feats and training yard lines', async () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  const { guideScene } = await import('../src/scenes/guide.js');
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(SENTENCE)));
  assertEggFree(SENTENCE, 'journal feats and yard guide sentence');
});
