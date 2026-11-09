import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { getItem } from '../src/items/items.js';
import { countItem } from '../src/items/inventory.js';
import { REWARD_CHOICE_POOLS, rewardChoicePool, claimRewardChoice, rewardChoiceFlag } from '../src/items/rewardChoice.js';
import { installRewardChoice } from '../src/scenes/rewardChoice.js';
import { combatScene } from '../src/scenes/combat.js';
import { assertEggFree } from './helpers/eggGuard.mjs';

function fakeGame() {
  const game = {
    state: createInitialState(),
    scenes: {},
    lastScene: null,
    emits: [],
    bus: { emit(type, data) { game.emits.push({ type, data }); } },
    setScene(name, data) { game.scenes[name]?.onEnter?.(game, data); game.lastScene = { name, data }; },
    registerScene(name, scene) { game.scenes[name] = scene; },
  };
  return game;
}

function stackOf(inv, id) {
  return inv.find((s) => s.id === id);
}

test('reward pools: ten encounters, three known-item options each, frozen', () => {
  const ids = Object.keys(REWARD_CHOICE_POOLS);
  assert.equal(ids.length, 10);
  for (const id of ids) {
    assert.ok(Object.isFrozen(REWARD_CHOICE_POOLS[id]), `pool ${id} frozen`);
    const options = REWARD_CHOICE_POOLS[id];
    assert.equal(options.length, 3);
    for (const option of options) {
      assert.ok(Number.isInteger(option.qty) && option.qty >= 1, `${id} option qty`);
      const item = getItem(option.itemId); // throws on unknown ids
      assert.ok(item.name);
    }
  }
});

test('rewardChoicePool: known pool returned with copies, unknown or claimed yields null', () => {
  const state = createInitialState();
  const pool = rewardChoicePool(state, 'ridge_thunderhoof');
  assert.equal(pool.id, 'ridge_thunderhoof');
  assert.equal(pool.options.length, 3);
  pool.options[0].qty = 99; // mutating the copy must not touch the catalog
  assert.equal(REWARD_CHOICE_POOLS.ridge_thunderhoof[0].qty, 2);
  assert.equal(rewardChoicePool(state, 'not_an_encounter'), null);
  assert.equal(rewardChoicePool(state, null), null);
  state.flags[rewardChoiceFlag('ridge_thunderhoof')] = true;
  assert.equal(rewardChoicePool(state, 'ridge_thunderhoof'), null);
});

test('claimRewardChoice: success grants the bundle and sets the flag', () => {
  const state = createInitialState();
  const res = claimRewardChoice(state, 'ridge_thunderhoof', '1');
  assert.equal(res.ok, true);
  assert.equal(countItem(res.inv, 'thunder_iron'), 2);
  assert.deepEqual(stackOf(state.inventory, 'thunder_iron'), { id: 'thunder_iron', qty: 2 });
  assert.equal(state.flags[rewardChoiceFlag('ridge_thunderhoof')], true);
  assert.match(res.message, /Thunder Iron/);
});

test('claimRewardChoice: single-qty message omits the multiplier', () => {
  const state = createInitialState();
  const res = claimRewardChoice(state, 'sunscar_cinderclaw', '0');
  assert.equal(res.ok, true);
  assert.equal(countItem(state.inventory, 'ember_broth'), 1);
  assert.match(res.message, /^Claimed Ember Broth from the spoils\.$/);
});

test('claimRewardChoice: refusals leave state untouched', () => {
  for (const [encounterId, optionIndex] of [
    ['ridge_thunderhoof', -1], ['ridge_thunderhoof', 3], ['ridge_thunderhoof', 'x'],
    ['ridge_thunderhoof', undefined], ['ridge_thunderhoof', 1.5], ['not_an_encounter', 0],
  ]) {
    const state = createInitialState();
    const before = JSON.stringify(state);
    const res = claimRewardChoice(state, encounterId, optionIndex);
    assert.equal(res.ok, false, `${encounterId}/${optionIndex}`);
    assert.equal(typeof res.message, 'string');
    assert.equal(JSON.stringify(state), before, `${encounterId}/${optionIndex} mutated state`);
  }
});

test('claimRewardChoice: an encounter can only be claimed once', () => {
  const state = createInitialState();
  const first = claimRewardChoice(state, 'storm_heart_core', 0);
  assert.equal(first.ok, true);
  const snapshot = JSON.stringify(state);
  const second = claimRewardChoice(state, 'storm_heart_core', 2);
  assert.equal(second.ok, false);
  assert.match(second.message, /no longer available/);
  assert.equal(JSON.stringify(state), snapshot);
});

test('rewardChoice scene: render offers three bundles plus a way to decline', () => {
  const game = fakeGame();
  installRewardChoice(game);
  const scene = game.scenes.rewardChoice;
  scene.onEnter(game, { encounterId: 'highwatch_glacierward', returnScene: 'explore', message: 'You return victorious.' });
  const html = scene.render(game);
  assert.match(html, /Victory spoils/);
  assert.match(html, /You return victorious\./);
  assert.equal((html.match(/data-action="choose"/g) || []).length, 3);
  assert.match(html, /data-action="skip"/);
  assert.match(html, /Tide Glass Focus/);
  assertEggFree(html);
});

test('rewardChoice scene: settled pool renders a plain continue, no choices', () => {
  const game = fakeGame();
  installRewardChoice(game);
  const scene = game.scenes.rewardChoice;
  scene.onEnter(game, { encounterId: 'mystery_foe', returnScene: 'explore', message: '' });
  const html = scene.render(game);
  assert.match(html, /already been settled/);
  assert.equal((html.match(/data-action="choose"/g) || []).length, 0);
  assertEggFree(html);
});

test('rewardChoice scene: choose claims, sets the flag and returns to the field', () => {
  const game = fakeGame();
  installRewardChoice(game);
  game.registerScene('explore', { name: 'explore' });
  const scene = game.scenes.rewardChoice;
  scene.onEnter(game, { encounterId: 'ridge_old_tusk', returnScene: 'explore', message: 'You return victorious.' });
  scene.actions.choose(game, { dataset: { arg: '0' } });
  assert.equal(game.lastScene.name, 'explore');
  assert.equal(countItem(game.state.inventory, 'rations'), 3);
  assert.equal(game.state.flags[rewardChoiceFlag('ridge_old_tusk')], true);
  assert.match(game.lastScene.data.message, /Trail Rations/);
});

test('rewardChoice scene: a bad pick keeps the offer open with a note', () => {
  const game = fakeGame();
  installRewardChoice(game);
  const scene = game.scenes.rewardChoice;
  scene.onEnter(game, { encounterId: 'ridge_old_tusk', returnScene: 'explore', message: 'You return victorious.' });
  scene.actions.choose(game, { dataset: { arg: '7' } });
  assert.equal(game.lastScene, null);
  assert.match(game.rewardChoiceNote, /Choose one of the offered bundles/);
});

test('rewardChoice scene: skipping leaves the offer unclaimed', () => {
  const game = fakeGame();
  installRewardChoice(game);
  game.registerScene('explore', { name: 'explore' });
  const scene = game.scenes.rewardChoice;
  scene.onEnter(game, { encounterId: 'ridge_old_tusk', returnScene: 'explore', message: 'You return victorious.' });
  scene.actions.skip(game, {});
  assert.equal(game.lastScene.name, 'explore');
  assert.equal(game.state.flags[rewardChoiceFlag('ridge_old_tusk')], undefined);
  assert.equal(countItem(game.state.inventory, 'rations'), 0);
});

test('combat finish: a pool victory routes through the spoils offer exactly once', () => {
  const game = fakeGame();
  installRewardChoice(game);
  game.registerScene('explore', { name: 'explore' });
  game.state.combat = {
    over: 'victory', encounterId: 'ridge_thunderhoof', returnScene: 'explore',
    enemy: { id: 'thunderhoof' }, log: [], rewards: { xp: 400, gold: 240, items: [] },
  };
  combatScene.actions.finish(game, {});
  assert.equal(game.lastScene.name, 'rewardChoice');
  assert.equal(game.lastScene.data.encounterId, 'ridge_thunderhoof');
  assert.equal(game.lastScene.data.returnScene, 'explore');
  assert.equal(game.state.combat, null);
  assert.equal(game.emits.filter((e) => e.type === 'combat:victory').length, 0);
  game.scenes.rewardChoice.actions.choose(game, { dataset: { arg: '1' } });
  assert.equal(game.lastScene.name, 'explore');
  assert.equal(countItem(game.state.inventory, 'thunder_iron'), 2);
});

test('combat finish: fled, defeat and drill victories never open the spoils offer', () => {
  // Fled: routes back and emits the escape event.
  const fled = fakeGame();
  installRewardChoice(fled);
  fled.registerScene('explore', { name: 'explore' });
  fled.state.combat = { over: 'fled', encounterId: 'ridge_patrol', returnScene: 'explore', enemy: { id: 'ridge_bandit' }, log: [] };
  combatScene.actions.finish(fled, {});
  assert.equal(fled.lastScene.name, 'explore');
  assert.deepEqual(fled.emits.map((e) => e.type), ['combat:escape']);

  // Defeat: wakes in town.
  const lost = fakeGame();
  installRewardChoice(lost);
  lost.registerScene('town', { name: 'town' });
  lost.state.combat = { over: 'defeat', encounterId: 'ridge_patrol', returnScene: 'explore', enemy: { id: 'ridge_bandit' }, log: [] };
  combatScene.actions.finish(lost, {});
  assert.equal(lost.lastScene.name, 'town');

  // Drill victory: back to the drills screen, no offer.
  const drilled = fakeGame();
  installRewardChoice(drilled);
  drilled.registerScene('drills', { name: 'drills' });
  drilled.state.combat = { over: 'victory', drill: true, encounterId: null, gauntlet: null, enemy: { id: 'storm_rat' }, log: [] };
  combatScene.actions.finish(drilled, {});
  assert.equal(drilled.lastScene.name, 'drills');
});

test('combat finish: a claimed pool falls through to the usual return', () => {
  const game = fakeGame();
  installRewardChoice(game);
  game.registerScene('explore', { name: 'explore' });
  game.state.flags[rewardChoiceFlag('ridge_thunderhoof')] = true;
  game.state.combat = {
    over: 'victory', encounterId: 'ridge_thunderhoof', returnScene: 'explore',
    enemy: { id: 'thunderhoof' }, log: [], rewards: { xp: 400, gold: 240, items: [] },
  };
  combatScene.actions.finish(game, {});
  assert.equal(game.lastScene.name, 'explore');
  assert.match(game.lastScene.data.message, /You return victorious\./);
});
