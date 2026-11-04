import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';

function domFixture() {
  const focusCalls = [];
  const heading = {
    attributes: {},
    setAttribute(name, value) { this.attributes[name] = value; },
    focus(options) { focusCalls.push(options); },
  };
  const root = {
    innerHTML: '',
    addEventListener() {},
    querySelector(selector) {
      assert.equal(selector, 'h1, h2, [data-scene-heading]');
      return heading;
    },
  };
  return { root, heading, focusCalls };
}

test('scene changes reset scroll and focus the new heading only once', (t) => {
  const { root, heading, focusCalls } = domFixture();
  const scrollCalls = [];
  const previousWindow = globalThis.window;
  globalThis.window = { scrollTo(...args) { scrollCalls.push(args); } };
  t.after(() => {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  });

  const game = new Game(root);
  game.registerScene('title', { render: () => '<h1>Beacon</h1>' });
  game.registerScene('town', { render: () => '<h1>Greyhaven</h1>' });
  game.setScene('title');
  game.setScene('town');
  assert.deepEqual(scrollCalls, [[0, 0], [0, 0]]);
  assert.deepEqual(focusCalls, [{ preventScroll: true }, { preventScroll: true }]);
  assert.equal(heading.attributes.tabindex, '-1');

  game.render();
  assert.equal(scrollCalls.length, 2, 'same-scene updates do not reset reading position');
  assert.equal(focusCalls.length, 2, 'same-scene updates do not steal focus');
});

test('render remains safe with a non-DOM root and no window', () => {
  const root = { innerHTML: '', addEventListener() {} };
  const game = new Game(root);
  game.registerScene('title', { render: () => '<h1>Beacon</h1>' });
  assert.doesNotThrow(() => game.setScene('title'));
  assert.equal(root.innerHTML, '<h1>Beacon</h1>');
});
