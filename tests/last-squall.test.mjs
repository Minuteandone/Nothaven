import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState } from '../src/state.js';
import { ZONES, travelToZone, movePlayer, interactWith } from '../src/map/index.js';
import { ENEMIES } from '../src/data/enemies.js';
import { fieldTip } from '../src/data/fieldTips.js';
import { applyHeartEvent, getHeartJournal } from '../src/story/heart.js';

function eyeState(heartReward) {
  const s = createInitialState();
  s.story.flags.spire_reward = true;
  s.story.stage = 'complete';
  if (heartReward !== undefined) s.story.flags.heart_reward = heartReward;
  travelToZone(s, 'storms_eye');
  s.map.x = 4; s.map.y = 2;
  return s;
}

test('the Last Squall is a tougher optional boss with a field tip', () => {
  const sq = ENEMIES.last_squall, heart = ENEMIES.storm_heart;
  assert.equal(sq.boss, true);
  assert.ok(sq.hp > heart.hp && sq.atk > heart.atk);
  assert.ok(fieldTip('last_squall'));
  const enc = ZONES.storms_eye.encounters.find(e => e.encounterId === 'eye_last_squall');
  assert.deepEqual([enc.x, enc.y, enc.main, enc.requiresStoryFlag], [4, 1, false, 'heart_reward']);
});

test('the squall stays locked until the Heart report is strictly paid', () => {
  for (const value of [undefined, false, 'true', 1]) {
    const s = eyeState(value);
    const moved = movePlayer(s, 0, -1);
    assert.equal(moved.triggerCombat, null);
    assert.deepEqual([s.map.x, s.map.y], [4, 2]);
    assert.match(moved.log.join(' '), /Report the Storm’s Heart/);
    const direct = interactWith(s, 'encounter', 'eye_last_squall');
    assert.equal(direct.triggerCombat, null);
  }
});

test('after the Heart report the squall can be engaged', () => {
  const s = eyeState(true);
  const res = interactWith(s, 'encounter', 'eye_last_squall');
  assert.equal(res.triggerCombat?.enemyId, 'last_squall');
});

test('victory is recorded only after the Heart report and adds no reward', () => {
  const base = { stage: 'complete', flags: { spire_reward: true } };
  const early = applyHeartEvent(base, { type: 'victory', encounterId: 'eye_last_squall' });
  assert.notEqual(early.state.flags.victory_last_squall, true);
  const paid = { stage: 'complete', flags: { spire_reward: true, heart_reward: true } };
  const r = applyHeartEvent(paid, { type: 'victory', encounterId: 'eye_last_squall' });
  assert.equal(r.state.flags.victory_last_squall, true);
  assert.deepEqual(r.rewards, []);
  assert.equal(r.log.length, 1);
  assert.equal(applyHeartEvent(r.state, { type: 'victory', encounterId: 'eye_last_squall' }).log.length, 0);
});

test('journal lists the optional trial only after the Heart report', () => {
  assert.equal(getHeartJournal({ stage: 'complete', flags: { spire_reward: true } }).length, 1);
  const open = getHeartJournal({ stage: 'complete', flags: { spire_reward: true, heart_reward: true } });
  assert.deepEqual(open.map(e => [e.id, e.status]), [['heart', 'complete'], ['last_squall', 'active']]);
  const done = getHeartJournal({ stage: 'complete', flags: { spire_reward: true, heart_reward: true, victory_last_squall: true } });
  assert.equal(done[1].status, 'complete');
});
