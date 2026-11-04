import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRemark } from '../src/party/remarks.js';
import { COMPANIONS } from '../src/party/companions.js';
import { musterScene } from '../src/scenes/muster.js';
import { createInitialState } from '../src/state.js';

test('every companion has remarks for each story phase', () => {
  for (const id of Object.keys(COMPANIONS)) {
    assert.ok(companionRemark(id, { stage: 'road' }).length > 10, id);
    const p = companionRemark(id, { stage: 'complete', ending: 'protect_town', flags: {} });
    const sh = companionRemark(id, { stage: 'complete', ending: 'share_signal', flags: {} });
    const r = companionRemark(id, { stage: 'complete', ending: 'share_signal', flags: { rescue_reward: true } });
    assert.notEqual(p, sh); assert.notEqual(sh, r);
  }
  assert.equal(companionRemark('constructor', {}), '');
  assert.equal(companionRemark(undefined, {}), '');
});

test('muster Talk shows a remark only for unlocked companions and never changes state', () => {
  const state = createInitialState();
  const game = { state, scenes: {}, setScene() {} };
  musterScene.onEnter(game, {});
  musterScene.actions.talk(game, { dataset: { arg: 'tamsin' } });
  assert.equal(game.musterTalk, null, 'locked companion cannot be talked to');
  state.story.flags.victory_ridge_patrol = true;
  const before = structuredClone(state);
  musterScene.actions.talk(game, { dataset: { arg: 'tamsin' } });
  const html = musterScene.render(game);
  assert.match(html, /class="remark"/);
  assert.match(html, /ridge road/);
  assert.deepEqual(state, before);
});

test('companion remarks avoid egg words', () => {
  const re = /\b(egg|yolk|shell|hatch|nest|chick|hen|omelet|scrambl|poach|fried|devil|easter|rooster|goose|oval|sunny|boil|crack|cackle|golden|basket)/i;
  for (const id of Object.keys(COMPANIONS)) for (const story of [{}, { stage: 'complete', ending: 'protect_town' }, { stage: 'complete', ending: 'share_signal' }, { flags: { rescue_reward: true } }]) {
    assert.doesNotMatch(companionRemark(id, story), re);
  }
});

test('relay choice remarks take priority once the relay is restored', async () => {
  const { companionRemark } = await import('../src/party/remarks.js');
  for (const id of ['tamsin', 'iven', 'bram', 'sela']) {
    const base = { stage: 'complete', ending: 'share_signal', flags: { rescue_reward: true } };
    const rescued = companionRemark(id, base);
    const shelter = companionRemark(id, { ...base, flags: { ...base.flags, relay_choice: 'shelter_network' } });
    const route = companionRemark(id, { ...base, flags: { ...base.flags, relay_choice: 'route_network' } });
    assert.ok(shelter && route && shelter !== route && shelter !== rescued && route !== rescued, id);
    assert.equal(companionRemark(id, { ...base, flags: { ...base.flags, relay_choice: 'bogus' } }), rescued);
  }
});

test('chapter-4 summit remarks take priority over relay lines', async () => {
  const { companionRemark } = await import('../src/party/remarks.js');
  for (const id of ['tamsin', 'iven', 'bram', 'sela']) {
    for (const flag of ['spire_summit', 'spire_victory', 'victory_stormcrown_tyrant']) {
      const line = companionRemark(id, { flags: { relay_choice: 'route_network', rescue_reward: true, [flag]: true } });
      const relay = companionRemark(id, { flags: { relay_choice: 'route_network' } });
      assert.ok(line.length > 20);
      assert.notEqual(line, relay);
      assert.doesNotMatch(line, /egg|yolk|shell|hatch|nest|chick|\bhen\b|boil|crack|pearl|golden|feather/i);
    }
  }
});
