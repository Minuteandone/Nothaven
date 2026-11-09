import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FEATS, featStatus, townFeatsText } from '../src/scenes/feats.js';
import { createInitialState } from '../src/state.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'Once you have earned a feat, the town square also shows your feat count and the title of the next feat still to earn.';

test('town feats line is null before the first feat and for malformed saves', () => {
  assert.equal(townFeatsText(createInitialState()), null);
  assert.equal(townFeatsText(null), null);
  assert.equal(townFeatsText({}), null);
});

test('town feats line counts earned feats and names the next one in list order', () => {
  const s = createInitialState();
  s.story.flags = { ...(s.story.flags || {}), rescue_reward: true };
  const n = featStatus(s).filter(f => f.done).length;
  const next = featStatus(s).find(f => !f.done);
  assert.ok(n >= 1);
  const text = townFeatsText(s);
  assert.equal(text, `Wardens’ Feats: ${n} of ${FEATS.length} earned. Next: ${next.title}.`);
  assert.ok(text.startsWith(`Wardens’ Feats: ${n} of 31 earned.`));
  assertEggFree(text, 'town feats line');
});

test('town feats line says every feat is earned when nothing is left', () => {
  const all = FEATS.map(f => ({ id: f.id, title: f.title, done: true }));
  assert.equal(townFeatsText(null, all), 'Wardens’ Feats: 31 of 31 earned. Every feat earned.');
  const lastLeft = all.map((r, i) => (i === all.length - 1 ? { ...r, done: false } : r));
  assert.equal(townFeatsText(null, lastLeft), `Wardens’ Feats: 30 of 31 earned. Next: ${FEATS.at(-1).title}.`);
});

test('town renders the feats line only with a feats scene and an earned feat', async () => {
  const { townScene } = await import('../src/scenes/town.js');
  const s = createInitialState();
  s.scene = 'town'; s.combat = null;
  const game = { state: s, scenes: { feats: {} }, message: '' };
  assert.ok(!townScene.render(game).includes('town-feats'));
  s.story.flags = { ...(s.story.flags || {}), rescue_reward: true };
  const html = townScene.render(game);
  assert.ok(html.includes(`<p class="town-feats">${escapeHTML(townFeatsText(s))}</p>`), html);
  assert.ok(!townScene.render({ ...game, scenes: {} }).includes('town-feats'));
});

test('guide documents the town feats line', async () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  const { guideScene } = await import('../src/scenes/guide.js');
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(SENTENCE)));
  assertEggFree(SENTENCE, 'town feats guide sentence');
});
