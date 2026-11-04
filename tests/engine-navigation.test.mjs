import test from 'node:test';
import assert from 'node:assert/strict';
import { Game } from '../src/engine.js';

const HEADING_SELECTOR = 'h1, h2, [data-scene-heading]';
const FOCUS_TARGET_SELECTOR = '[data-action], [data-focus-key], [id]';

function parseAttributes(source) {
  const attributes = {};
  for (const match of source.matchAll(/([:\w-]+)(?:="([^"]*)")?/g)) {
    attributes[match[1]] = match[2] ?? '';
  }
  return attributes;
}

function domFixture() {
  const focusCalls = [];
  const document = { activeElement: null };
  let children = [];

  function makeElement(tagName, attributes = {}) {
    return {
      tagName,
      attributes,
      dataset: {
        action: attributes['data-action'],
        arg: attributes['data-arg'],
      },
      disabled: Object.hasOwn(attributes, 'disabled'),
      getAttribute(name) { return Object.hasOwn(this.attributes, name) ? this.attributes[name] : null; },
      hasAttribute(name) { return Object.hasOwn(this.attributes, name); },
      setAttribute(name, value) { this.attributes[name] = String(value); },
      matches(selector) {
        assert.equal(selector, HEADING_SELECTOR);
        return this.tagName === 'H1' || this.tagName === 'H2' || Object.hasOwn(this.attributes, 'data-scene-heading');
      },
      focus(options) {
        document.activeElement = this;
        focusCalls.push({ element: this, options });
      },
    };
  }

  const root = {
    ownerDocument: document,
    listeners: {},
    addEventListener(type, listener) { this.listeners[type] = listener; },
    contains(element) { return element === root || children.includes(element); },
    set innerHTML(html) {
      this._innerHTML = html;
      children = [];
      const heading = html.match(/<(h[12])\b([^>]*)>/i);
      if (heading) children.push(makeElement(heading[1].toUpperCase(), parseAttributes(heading[2])));
      for (const match of html.matchAll(/<button\b([^>]*)>/g)) {
        children.push(makeElement('BUTTON', parseAttributes(match[1])));
      }
      for (const match of html.matchAll(/<input\b([^>]*)>/g)) {
        children.push(makeElement('INPUT', parseAttributes(match[1])));
      }
    },
    get innerHTML() { return this._innerHTML; },
    querySelector(selector) {
      assert.equal(selector, HEADING_SELECTOR);
      return children.find((el) => el.matches(selector)) || null;
    },
    querySelectorAll(selector) {
      assert.equal(selector, FOCUS_TARGET_SELECTOR);
      return children.filter((el) => ['data-action', 'data-focus-key', 'id'].some((key) => el.hasAttribute(key)));
    },
  };
  return { root, document, focusCalls };
}

function action(root, name, arg = null) {
  return root.querySelectorAll(FOCUS_TARGET_SELECTOR).find((el) =>
    el.getAttribute('data-action') === name && el.getAttribute('data-arg') === arg);
}

test('scene changes reset scroll and focus the new heading only once', (t) => {
  const { root, document, focusCalls } = domFixture();
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
  assert.deepEqual(focusCalls.map((call) => call.options), [{ preventScroll: true }, { preventScroll: true }]);
  assert.equal(root.querySelector(HEADING_SELECTOR).getAttribute('tabindex'), '-1');

  const outside = { focus() { throw new Error('outside focus should not move'); } };
  document.activeElement = outside;
  game.render();
  assert.equal(scrollCalls.length, 2, 'same-scene updates do not reset reading position');
  assert.equal(focusCalls.length, 2, 'same-scene updates do not steal outside focus');
  assert.equal(document.activeElement, outside);
});

test('same-scene rendering restores the exact enabled action and argument', () => {
  const { root, document, focusCalls } = domFixture();
  const game = new Game(root);
  game.registerScene('combat', {
    render: () => '<h2>Battle</h2><button data-action="attack" data-arg="wren">Attack</button><button data-action="attack" data-arg="tamsin">Attack</button>',
  });
  game.setScene('combat');
  action(root, 'attack', 'tamsin').focus();
  focusCalls.length = 0;

  game.render();
  assert.equal(document.activeElement, action(root, 'attack', 'tamsin'));
  assert.notEqual(document.activeElement, action(root, 'attack', 'wren'));
  assert.deepEqual(focusCalls.map((call) => call.options), [{ preventScroll: true }]);
});

test('a replaced submenu command focuses the first enabled replacement action', () => {
  const { root, document } = domFixture();
  let menu = 'main';
  const game = new Game(root);
  game.registerScene('combat', {
    render: () => menu === 'main'
      ? '<h2>Battle</h2><button data-action="skills">Skills</button><button data-action="defend">Defend</button>'
      : '<h2>Battle</h2><button data-action="skill" data-arg="costly" disabled>Costly</button><button data-action="back">Back</button>',
  });
  game.setScene('combat');
  action(root, 'skills').focus();
  menu = 'skills';

  game.render();
  assert.equal(document.activeElement, action(root, 'back'));
  assert.notEqual(document.activeElement, action(root, 'skill', 'costly'));
});

test('heading focus survives setScene followed by the outer click render', () => {
  const { root, document, focusCalls } = domFixture();
  const game = new Game(root);
  game.registerScene('title', {
    render: () => '<h1>Beacon</h1><button data-action="start">Start</button>',
    actions: { start(current) { current.setScene('town'); } },
  });
  game.registerScene('town', { render: () => '<h1>Greyhaven</h1><button data-action="explore">Explore</button>' });
  game.setScene('title');
  const start = action(root, 'start');
  start.focus();
  focusCalls.length = 0;

  root.listeners.click({ target: { closest: () => start } });
  assert.match(root.innerHTML, /Greyhaven/);
  assert.equal(document.activeElement, root.querySelector(HEADING_SELECTOR));
  assert.equal(focusCalls.length, 2, 'setScene and the outer render each preserve heading focus');
  assert.equal(root.querySelector(HEADING_SELECTOR).getAttribute('tabindex'), '-1');
});

test('stable focus keys survive rerendering non-button controls', () => {
  const { root, document } = domFixture();
  const game = new Game(root);
  game.registerScene('settings', {
    render: () => '<h2>Settings</h2><input data-focus-key="volume" aria-label="Volume"><button data-action="close">Close</button>',
  });
  game.setScene('settings');
  const volume = root.querySelectorAll(FOCUS_TARGET_SELECTOR).find((el) => el.getAttribute('data-focus-key') === 'volume');
  volume.focus();

  game.render();
  assert.equal(document.activeElement.getAttribute('data-focus-key'), 'volume');
});

test('render remains safe with a non-DOM root and no window', () => {
  const root = { innerHTML: '', addEventListener() {} };
  const game = new Game(root);
  game.registerScene('title', { render: () => '<h1>Beacon</h1>' });
  assert.doesNotThrow(() => game.setScene('title'));
  assert.doesNotThrow(() => game.render());
  assert.equal(root.innerHTML, '<h1>Beacon</h1>');
});
