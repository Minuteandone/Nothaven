import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { bountiesScene, huntHealth, sortBountyRows } from '../src/scenes/bounties.js';
import { guideScene } from '../src/scenes/guide.js';
import { escapeHTML } from '../src/ui/components.js';
import { createInitialState } from '../src/state.js';
import { BOUNTIES, bountyRows } from '../src/core/bounties.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

const SENTENCE = 'Sort buttons list the posted notices in board order, by highest pay, by fewest claims, or by easiest hunt (the least total base health across all the foes a contract asks for, shown on each posted notice as a line such as “Hunt total: 48 base HP across 4 foes.”); unposted notices always stay at the bottom.';

test('huntHealth multiplies the target count by its base HP; unknown foes sort last', () => {
  assert.equal(huntHealth(BOUNTIES[0]), 48);
  assert.equal(huntHealth(BOUNTIES.find((b) => b.id === 'bandit_toll')), 60);
  assert.equal(huntHealth(BOUNTIES.find((b) => b.id === 'colossus_thunder')), 380);
  assert.equal(huntHealth({ enemyId: 'nobody', count: 2 }), Number.MAX_SAFE_INTEGER);
  assert.equal(huntHealth({ enemyId: 'toString', count: 2 }), Number.MAX_SAFE_INTEGER);
});

test('Easiest hunt orders posted notices by total health with board-order ties, locked rows last', () => {
  const s = createInitialState();
  s.bestiary = { storm_rat: 1, ridge_bandit: 1, gale_hound: 1, wrack_eel: 1, frost_wolf: 1, thunderhead_colossus: 1 };
  s.scene = 'bounties'; s.combat = null;
  const rows = bountyRows(s);
  const ids = sortBountyRows(rows, 'easiest').map((r) => r.id);
  assert.deepEqual(ids.slice(0, 6), ['ridge_rats', 'howling_pass', 'bandit_toll', 'kelp_tangle', 'wolf_trail', 'colossus_thunder']);
  assert.equal(ids.length, BOUNTIES.length);
  assert.equal(rows[0].id, BOUNTIES[0].id, 'sorting never mutates the source rows');
  const game = { state: s, setScene() {} };
  bountiesScene.onEnter(game);
  bountiesScene.actions.sortBounties(game, { dataset: { arg: 'easiest' } });
  assert.equal(game.bountySort, 'easiest');
  const html = bountiesScene.render(game);
  assert.match(html, /aria-pressed="true">Easiest hunt</);
  const titles = [...html.matchAll(/<h2 class="bounty__title">([^<]*)<\/h2>/g)].map((m) => m[1]);
  assert.equal(titles[0], 'Ridge Road Rat Cull');
  assert.ok(titles.slice(6).every((t) => t === 'Unposted contract'));
  assertEggFree(html, 'easiest hunt sort');
});

test('guides document the Easiest hunt sort identically', () => {
  const md = readFileSync(new URL('../docs/PLAYER_GUIDE.md', import.meta.url), 'utf8');
  assert.equal(md.split(SENTENCE).length - 1, 1);
  assert.ok(guideScene.render({ state: {} }).includes(escapeHTML(SENTENCE)));
  assertEggFree(SENTENCE, 'easiest hunt doc');
});
