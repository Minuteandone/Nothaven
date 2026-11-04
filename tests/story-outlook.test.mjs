import test from 'node:test';
import assert from 'node:assert/strict';
import { getTownOutlook } from '../src/story/outlook.js';
import { createStoryState, getDialogue, getJournal } from '../src/story/index.js';
import { townScene } from '../src/scenes/town.js';
import { createInitialState } from '../src/state.js';

function immutable(story) {
  Object.freeze(story.flags);
  return Object.freeze(story);
}

test('town outlook preserves the opening and distinguishes the final decision', () => {
  assert.match(getTownOutlook().text, /damaged beacon/);
  const before = immutable(createStoryState());
  assert.match(getTownOutlook(before).title, /beyond the ridge/);
  const decision = immutable({ ...before, stage: 'decision' });
  assert.match(getTownOutlook(decision).text, /focusing lens is ready/);
  assert.match(getTownOutlook(decision).hint, /cannot be undone/);
  assert.equal(decision.stage, 'decision');
});

for (const ending of ['protect_town', 'share_signal']) {
  test(`town outlook follows rescue phases without changing ${ending}`, () => {
    const story = { ...createStoryState(), stage: 'complete', ending };
    const light = ending === 'protect_town' ? /blue shield/ : /Silver light/;
    const offer = getTownOutlook(immutable(story));
    assert.match(offer.text, light);
    assert.doesNotMatch(offer.text, /damaged beacon/);
    assert.match(offer.hint, /Accept Mara/);
    const accepted = { ...story, flags: { rescue_accepted: true } };
    assert.match(getTownOutlook(immutable(accepted)).text, /either route first/);
    for (const [route, name] of [['coast', 'Saltmere'], ['heights', 'Highwatch']]) {
      const partial = { ...accepted, flags: { ...accepted.flags, [`rescue_visit_${route}`]: true, [`rescue_victory_${route}`]: true } };
      assert.match(getTownOutlook(immutable(partial)).text, new RegExp(`${name} has a safe route home`));
    }
    const ready = { ...accepted, flags: { rescue_accepted: true, rescue_visit_coast: true, rescue_victory_coast: true, rescue_visit_heights: true, rescue_victory_heights: true } };
    assert.match(getTownOutlook(immutable(ready)).hint, /Report both routes/);
    const paid = { ...ready, flags: { ...ready.flags, rescue_reward: true } };
    assert.match(getTownOutlook(immutable(paid)).text, /can travel again/);
    assert.match(getTownOutlook(paid).hint, /still welcomes.*supplies/);
    const supplied = { ...paid, flags: { ...paid.flags, relief_reward: true } };
    assert.match(getTownOutlook(immutable(supplied)).hint, /supplies have joined/);
    assert.equal(supplied.ending, ending);
  });

  test(`town render reflects ${ending} and does not pay or advance quests`, () => {
    const state = createInitialState();
    state.story = { ...createStoryState(), stage: 'complete', ending };
    const before = structuredClone(state);
    const html = townScene.render({ state });
    assert.match(html, /A light worth carrying/);
    assert.doesNotMatch(html, /The damaged beacon darkens/);
    assert.deepEqual(state, before);
  });
}

test('observatory brief describes the current threat without claiming it is a keeper-recognition machine', () => {
  const story = { ...createStoryState(), stage: 'lens', flags: { road_reward: true } };
  assert.match(getDialogue(story, 'iven').text, /creatures have overrun/);
  assert.doesNotMatch(getDialogue(story, 'iven').text, /recognizes the keepers/);
  assert.match(getJournal(story).find(q => q.id === 'lens').objective, /threat guarding the focusing lens/);
});
