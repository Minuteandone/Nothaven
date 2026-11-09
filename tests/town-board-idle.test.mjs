import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bountyIdleText, urgentBountyId } from '../src/core/bounties.js';
import { createInitialState } from '../src/state.js';
import { escapeHTML } from '../src/ui/components.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'When no contract is active, the town square instead names the current urgent notice and any Board Marks you have to spend.';

test('idle board line is null until a contract is posted, and while one is active', () => {
  const s = createInitialState();
  assert.equal(bountyIdleText(s), null);
  assert.equal(bountyIdleText(null), null);
  s.bestiary = { storm_rat: 1 };
  s.bounties = { active: 'ridge_rats', progress: 1, completed: {} };
  assert.equal(bountyIdleText(s), null);
});

test('idle board line names the urgent notice or says it is unposted, plus spendable marks', () => {
  const s = createInitialState();
  s.bestiary = { storm_rat: 1 };
  assert.equal(urgentBountyId(s), 'rusted_watchmen');
  assert.equal(bountyIdleText(s), 'Bounty board: no contract taken. The urgent notice is still unposted.');
  s.bestiary.rust_sentinel = 1;
  assert.equal(bountyIdleText(s), 'Bounty board: no contract taken. “Rusted Watchmen” is urgent (+25% gold).');
  s.bounties = { active: null, progress: 0, completed: { ridge_rats: 1 } };
  const one = bountyIdleText(s);
  assert.match(one, / 1 Board Mark to spend at the Exchange\.$/);
  s.bounties.completed.ridge_rats = 3;
  assert.match(bountyIdleText(s), / 3 Board Marks to spend at the Exchange\.$/);
  s.bounties.spent = 3;
  assert.ok(!bountyIdleText(s).includes('to spend'));
  assertEggFree(one, 'idle board line');
});

test('town renders the idle line only without an active contract and with a board', async () => {
  const { townScene } = await import('../src/scenes/town.js');
  const s = createInitialState();
  s.scene = 'town'; s.combat = null;
  s.bestiary = { storm_rat: 1 };
  const game = { state: s, scenes: { bounties: {} }, message: '' };
  const html = townScene.render(game);
  assert.ok(html.includes('<p class="town-bounty-idle">Bounty board: no contract taken. The urgent notice is still unposted.</p>'), html);
  assert.ok(!html.includes('town-bounty-summary'));
  assert.ok(!townScene.render({ ...game, scenes: {} }).includes('town-bounty-idle'));
  s.bounties = { active: 'ridge_rats', progress: 2, completed: {} };
  const active = townScene.render(game);
  assert.ok(active.includes('town-bounty-summary'));
  assert.ok(!active.includes('town-bounty-idle'));
});

test('guide documents the idle town line', async () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  const { guideScene } = await import('../src/scenes/guide.js');
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(SENTENCE)));
  assertEggFree(SENTENCE, 'idle guide sentence');
});
