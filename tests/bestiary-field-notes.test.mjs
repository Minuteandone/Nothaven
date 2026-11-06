import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { bestiaryEntries, recordDefeat } from '../src/scenes/bestiary.js';
import { renderBestiary } from '../src/ui/bestiary.js';
import { BOUNTIES, bountyJournalText } from '../src/core/bounties.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function card(html, id) {
  const start = html.indexOf(`data-enemy="${id}"`);
  assert.ok(start > 0, `card for ${id} should render`);
  return html.slice(start, html.indexOf('</li>\n', start) + 1 || undefined);
}

test('bountyJournalText describes the contract and the player record', () => {
  const s = createInitialState();
  assert.equal(bountyJournalText(s, 'storm_heart'), null);
  assert.equal(bountyJournalText(s, 'no_such_foe'), null);
  assert.equal(bountyJournalText(s, 'storm_rat'), 'Board contract: “Ridge Road Rat Cull” (defeat 4). Not yet claimed.');
  s.bounties = { active: 'ridge_rats', progress: 2, completed: { ridge_rats: 1 } };
  assert.equal(bountyJournalText(s, 'storm_rat'), 'Board contract: “Ridge Road Rat Cull” (defeat 4). Claimed 1 time. Active now: 2 of 4.');
  s.bounties = { active: null, progress: 0, completed: { ridge_rats: 3 } };
  assert.equal(bountyJournalText(s, 'storm_rat'), 'Board contract: “Ridge Road Rat Cull” (defeat 4). Claimed 3 times. Mastered.');
  s.bounties = { active: 'ridge_rats', progress: 99, completed: { ridge_rats: -2 } };
  assert.equal(bountyJournalText(s, 'storm_rat'), 'Board contract: “Ridge Road Rat Cull” (defeat 4). Not yet claimed. Active now: 4 of 4.');
  for (const b of BOUNTIES) assertEggFree(bountyJournalText(createInitialState(), b.enemyId), b.id);
});

test('known Field Journal cards show where a foe roams and its contract', () => {
  const s = createInitialState();
  recordDefeat(s, 'gale_hound');
  recordDefeat(s, 'tide_wraith');
  const html = renderBestiary({ entries: bestiaryEntries(s) });
  const hound = card(html, 'gale_hound');
  assert.match(hound, /<p class="foe-roams"><strong>Roams:<\/strong> Ridge Road, Observatory Ruins, Saltmere Coast\.<\/p>/);
  assert.match(hound, /<p class="foe-bounty">Board contract: “Hounds on the Wind” \(defeat 3\)\. Not yet claimed\.<\/p>/);
  const boss = card(html, 'tide_wraith');
  assert.doesNotMatch(boss, /foe-roams|foe-bounty/);
});

test('unrecorded foes reveal neither habitat nor contract', () => {
  const html = renderBestiary({ entries: bestiaryEntries(createInitialState()) });
  assert.doesNotMatch(html, /foe-roams|foe-bounty|Board contract/);
});

test('roam names and contract text are escaped', () => {
  const s = createInitialState();
  recordDefeat(s, 'storm_rat');
  const entries = bestiaryEntries(s).map((e) => e.enemy.id === 'storm_rat' ? { ...e, roams: ['<b>Ridge</b>', 7, ''], contract: '<i>x</i>' } : e);
  const html = card(renderBestiary({ entries }), 'storm_rat');
  assert.match(html, /Roams:<\/strong> &lt;b&gt;Ridge&lt;\/b&gt;\.<\/p>/);
  assert.match(html, /<p class="foe-bounty">&lt;i&gt;x&lt;\/i&gt;<\/p>/);
});
