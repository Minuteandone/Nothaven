import test from 'node:test';
import assert from 'node:assert/strict';
import { companionRemark } from '../src/party/remarks.js';

const IDS = ['tamsin', 'iven', 'bram', 'sela'];
import { EGG_RE } from './helpers/eggGuard.mjs';

test('companions remark on Old Tusk after the rescues, before the relay choice', () => {
  for (const id of IDS) {
    const story = { flags: { rescue_reward: true } };
    const rescued = companionRemark(id, story);
    const tusk = companionRemark(id, story, { old_tusk: 1 });
    assert.notEqual(tusk, rescued, id);
    assert.match(tusk, /Tusk|boar/, id);
    assert.doesNotMatch(tusk, EGG_RE, id);
    assert.equal(companionRemark(id, story, { old_tusk: 0 }), rescued, `${id} needs a defeat`);
    assert.equal(companionRemark(id, story, null), rescued, `${id} null bestiary`);
    const relay = companionRemark(id, { flags: { rescue_reward: true, relay_choice: 'route_network' } });
    assert.equal(companionRemark(id, { flags: { rescue_reward: true, relay_choice: 'route_network' } }, { old_tusk: 2 }), relay, `${id} relay wins`);
  }
});

test('Gloomfin remarks come after the rescues and take priority over Old Tusk', () => {
  for (const id of IDS) {
    const story = { flags: { rescue_reward: true } };
    const tusk = companionRemark(id, story, { old_tusk: 1 });
    const fin = companionRemark(id, story, { old_tusk: 1, gloomfin: 1 });
    assert.notEqual(fin, tusk, id);
    assert.equal(companionRemark(id, story, { gloomfin: 1 }), fin, id);
    assert.doesNotMatch(fin, EGG_RE, id);
    assert.equal(companionRemark(id, { flags: {} }, { gloomfin: 1 }), companionRemark(id, { flags: {} }), `${id} needs rescue_reward`);
  }
});

test('Frostmane remarks come after the rescues and take priority over Gloomfin and Old Tusk', () => {
  for (const id of IDS) {
    const story = { flags: { rescue_reward: true } };
    const fin = companionRemark(id, story, { old_tusk: 1, gloomfin: 1 });
    const mane = companionRemark(id, story, { old_tusk: 1, gloomfin: 1, frostmane: 1 });
    assert.notEqual(mane, fin, id);
    assert.equal(companionRemark(id, story, { frostmane: 1 }), mane, id);
    assert.doesNotMatch(mane, EGG_RE, id);
    assert.equal(companionRemark(id, { flags: {} }, { frostmane: 1 }), companionRemark(id, { flags: {} }), `${id} needs rescue_reward`);
    assert.notEqual(companionRemark(id, { flags: { rescue_reward: true, relay_choice: 'shelter_network' } }, { frostmane: 1 }), mane, `${id} relay outranks`);
  }
});

test('Lenswarden remarks come after the rescues and take priority over the other field trials', () => {
  for (const id of IDS) {
    const story = { flags: { rescue_reward: true } };
    const mane = companionRemark(id, story, { old_tusk: 1, gloomfin: 1, frostmane: 1 });
    const lens = companionRemark(id, story, { gloomfin: 1, frostmane: 1, lenswarden: 1 });
    assert.notEqual(lens, mane, id);
    assert.equal(companionRemark(id, story, { lenswarden: 1 }), lens, id);
    assert.doesNotMatch(lens, EGG_RE, id);
    assert.equal(companionRemark(id, { flags: {} }, { lenswarden: 1 }), companionRemark(id, { flags: {} }), `${id} needs rescue_reward`);
    assert.notEqual(companionRemark(id, { flags: { rescue_reward: true, relay_choice: 'shelter_network' } }, { lenswarden: 1 }), lens, `${id} relay outranks`);
  }
});

test('Trial Warden remarks need all four field trials and outrank single-trial lines', () => {
  for (const id of IDS) {
    const story = { flags: { rescue_reward: true } };
    const all = { old_tusk: 1, gloomfin: 1, frostmane: 1, lenswarden: 1 };
    const trials = companionRemark(id, story, all);
    const lens = companionRemark(id, story, { lenswarden: 1 });
    assert.notEqual(trials, lens, id);
    assert.equal(companionRemark(id, story, { ...all, old_tusk: 0 }), lens, `${id} needs all four`);
    assert.doesNotMatch(trials, EGG_RE, id);
    assert.equal(companionRemark(id, { flags: {} }, all), companionRemark(id, { flags: {} }), `${id} needs rescue_reward`);
    assert.notEqual(companionRemark(id, { flags: { rescue_reward: true, relay_choice: 'route_network' } }, all), trials, `${id} relay outranks`);
  }
});
