import test from 'node:test';
import assert from 'node:assert/strict';
import { endingScene, epilogueLines, postgameLines, POSTGAME_DEEDS } from '../src/scenes/ending.js';
import { assertEggFree } from './helpers/eggGuard.mjs';
import { BOUNTIES } from '../src/core/bounties.js';

const full = {
  story: { flags: { spire_reward: true, heart_reward: true, victory_last_squall: true, watch_reward: true,
    calibration_reward: true, supply_reward: true } },
  bestiary: { cinderclaw: 1, thunderhoof: 2, glacierward_colossus: 1 },
  ledger: { stormbornBossVictories: 1 },
  bounties: { active: null, progress: 0, completed: Object.fromEntries(BOUNTIES.map((b) => [b.id, 1])) },
  party: [{ name: 'Wren', level: 20 }], gold: 0, inventory: [],
};

test('a fresh or main-story-only save shows no postgame deeds', () => {
  assert.deepEqual(postgameLines({}), []);
  assert.deepEqual(postgameLines(null), []);
  assert.deepEqual(postgameLines({ story: { flags: { spire_reward: true, heart_reward: true } } }), []);
  const html = endingScene.render({ state: { story: { flags: { spire_reward: true } }, party: [{}] } });
  assert.ok(!html.includes('Beyond the storm'));
});

test('every earned deed is listed once, in order', () => {
  const lines = postgameLines(full);
  assert.equal(lines.length, POSTGAME_DEEDS.length);
  assert.deepEqual(lines, POSTGAME_DEEDS.map((d) => d.text));
  const html = endingScene.render({ state: full });
  assert.ok(html.includes('<h3>Beyond the storm</h3>'));
  assert.equal((html.match(/<ul class="postgame-deeds">/g) || []).length, 1);
  assert.ok(html.indexOf('Beyond the storm') < html.indexOf('Your journey'));
});

test('deeds key off strict flags, bestiary counts and the ledger', () => {
  for (const v of ['yes', 1, 'true', {}]) {
    assert.deepEqual(postgameLines({ story: { flags: { victory_last_squall: v, watch_reward: v, calibration_reward: v, supply_reward: v } } }), [], `lookalike ${JSON.stringify(v)}`);
  }
  assert.deepEqual(postgameLines({ bestiary: { thunderhoof: 0, cinderclaw: 'x' } }), []);
  assert.deepEqual(postgameLines({ ledger: { stormbornBossVictories: -2 } }), []);
  assert.deepEqual(postgameLines({ bestiary: { glacierward_colossus: 1 } }), [POSTGAME_DEEDS.find((d) => d.id === 'glacierward').text]);
  assert.deepEqual(postgameLines({ ledger: { stormbornBossVictories: 3 } }), [POSTGAME_DEEDS.find((d) => d.id === 'stormborn').text]);
});

test('postgame deeds leave the chapter epilogue unchanged and pass the content guard', () => {
  assert.equal(epilogueLines(full).length, 2);
  for (const d of POSTGAME_DEEDS) assertEggFree(d.text);
});

test('the bounty deed needs every contract claimed at least once', () => {
  const deed = POSTGAME_DEEDS.find((d) => d.id === 'bounties').text;
  const all = Object.fromEntries(BOUNTIES.map((b) => [b.id, 1]));
  assert.deepEqual(postgameLines({ bounties: { completed: all } }), [deed]);
  const missing = { ...all }; delete missing[BOUNTIES.at(-1).id];
  assert.deepEqual(postgameLines({ bounties: { completed: missing } }), []);
  assert.deepEqual(postgameLines({ bounties: { completed: { ...all, [BOUNTIES[0].id]: 'x' } } }), []);
  assert.deepEqual(postgameLines({ bounties: 'nope' }), []);
});
