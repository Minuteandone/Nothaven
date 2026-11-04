import test from 'node:test';
import assert from 'node:assert/strict';
import { titleScene } from '../src/scenes/title.js';
import { townScene } from '../src/scenes/town.js';
import { createInitialState } from '../src/state.js';

function gameStub() {
  return {
    state: createInitialState(),
    storyDialogue: { speaker: 'Old conversation', location: 'greyhaven' },
    storyMessage: 'Old update',
    setScene(name) { this.enteredScene = name; },
  };
}

test('new journey resets story transients and enters town', () => {
  const game = gameStub();
  titleScene.actions.newGame(game);
  assert.equal(game.storyDialogue, null);
  assert.equal(game.storyMessage, '');
  assert.equal(game.enteredScene, 'town');
  assert.equal(game.state.location, 'greyhaven');
});

test('continue clears story transients after loading a valid save', () => {
  const saved = createInitialState();
  saved.gold = 47;
  globalThis.localStorage = { getItem: key => key === 'stormhaven-save' ? JSON.stringify(saved) : null };
  try {
    const game = gameStub();
    titleScene.actions.continue(game);
    assert.equal(game.state.gold, 47);
    assert.equal(game.storyDialogue, null);
    assert.equal(game.storyMessage, '');
    assert.equal(game.enteredScene, 'town');
  } finally {
    delete globalThis.localStorage;
  }
});

test('town renders the shared story panel and exposes its actions', () => {
  const game = gameStub();
  game.storyDialogue = null;
  game.storyMessage = '';
  const html = townScene.render(game);
  assert.match(html, /Speak to Warden Mara/);
  assert.match(html, /Quest journal/);
  assert.equal(typeof townScene.actions.storyTalk, 'function');
  townScene.actions.storyTalk(game, { dataset: { arg: 'mara' } });
  assert.equal(game.state.story.stage, 'road');
  assert.match(townScene.render(game), /story-dialogue/);
});
