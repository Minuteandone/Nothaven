import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  DEFAULT_DISPLAY_PREFERENCES,
  DISPLAY_STORAGE_KEY,
  applyDisplayPreferences,
  installDisplayControls,
  loadDisplayPreferences,
  normalizeDisplayPreferences,
  saveDisplayPreferences,
} from '../src/ui/displayControls.js';

class FakeElement {
  constructor(tagName = 'div', ownerDocument = null) {
    this.tagName = tagName;
    this.ownerDocument = ownerDocument;
    this.attributes = {};
    this.dataset = {};
    this.listeners = new Map();
    this.children = [];
    this.hidden = false;
    this.checked = false;
    this.value = '';
    this.textContent = '';
    this.innerHTML = '';
    this.removed = false;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  removeAttribute(name) { delete this.attributes[name]; }
  addEventListener(name, fn) { this.listeners.set(name, fn); }
  removeEventListener(name, fn) { if (this.listeners.get(name) === fn) this.listeners.delete(name); }
  emit(name, event = {}) { return this.listeners.get(name)?.(event); }
  append(child) { child.parentNode = this; this.children.push(child); }
  remove() {
    this.removed = true;
    if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(child => child !== this);
  }
  focus() { if (this.ownerDocument) this.ownerDocument.activeElement = this; }
}

function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    values,
    getItem(key) { return values.get(key) ?? null; },
    setItem(key, value) { values.set(key, String(value)); },
  };
}

function fixture({ stored, storage } = {}) {
  const doc = new FakeElement('document');
  doc.documentElement = new FakeElement('html', doc);
  doc.activeElement = null;
  const dock = new FakeElement('aside', doc);
  const bar = new FakeElement('div', doc);
  dock.append(bar);
  dock.querySelector = selector => selector === '.audio-dock__inner' ? bar : null;
  doc.querySelector = selector => selector === '.audio-dock' ? dock : null;

  const toggle = new FakeElement('button', doc);
  const panel = new FakeElement('section', doc);
  const controls = {
    scale: new FakeElement('select', doc),
    contrast: new FakeElement('input', doc),
    motion: new FakeElement('input', doc),
    reset: new FakeElement('button', doc),
    done: new FakeElement('button', doc),
    status: new FakeElement('span', doc),
  };
  const selectors = new Map([
    ['[data-display-scale]', controls.scale],
    ['[data-display-contrast]', controls.contrast],
    ['[data-display-motion]', controls.motion],
    ['[data-display-reset]', controls.reset],
    ['[data-display-done]', controls.done],
    ['[data-display-status]', controls.status],
  ]);
  panel.querySelector = selector => selectors.get(selector) ?? null;
  doc.createElement = tag => {
    if (tag === 'button') return toggle;
    assert.equal(tag, 'section');
    return panel;
  };

  const actualStorage = storage ?? memoryStorage(stored === undefined ? {} : { [DISPLAY_STORAGE_KEY]: stored });
  doc.defaultView = { localStorage: actualStorage };
  const game = { state: { scene: 'explore', gold: 20 }, scenes: { explore: {} } };
  const before = JSON.stringify(game);
  const controller = installDisplayControls(game, { document: doc });
  assert.equal(JSON.stringify(game), before, 'display controls never mutate game state');
  return { doc, dock, bar, toggle, panel, controls, controller, storage: actualStorage, game };
}

test('normalization accepts only supported scales and exact boolean flags', () => {
  assert.deepEqual(normalizeDisplayPreferences(null), DEFAULT_DISPLAY_PREFERENCES);
  assert.deepEqual(normalizeDisplayPreferences({ textScale: '115', highContrast: true, reducedMotion: true }),
    { textScale: 115, highContrast: true, reducedMotion: true });
  for (const value of [0, 99, 116, 200, 'large', NaN, null, {}, []]) {
    assert.equal(normalizeDisplayPreferences({ textScale: value }).textScale, 100);
  }
  for (const value of ['true', 1, 'yes', {}, []]) {
    assert.deepEqual(normalizeDisplayPreferences({ highContrast: value, reducedMotion: value }), DEFAULT_DISPLAY_PREFERENCES);
  }
});

test('storage round trips preferences and survives malformed or denied storage', () => {
  const storage = memoryStorage();
  assert.equal(saveDisplayPreferences(storage, { textScale: 130, highContrast: true, reducedMotion: true }), true);
  assert.deepEqual(loadDisplayPreferences(storage), { textScale: 130, highContrast: true, reducedMotion: true });
  storage.setItem(DISPLAY_STORAGE_KEY, '{broken');
  assert.deepEqual(loadDisplayPreferences(storage), DEFAULT_DISPLAY_PREFERENCES);
  storage.setItem(DISPLAY_STORAGE_KEY, JSON.stringify({ textScale: 999, highContrast: 'yes' }));
  assert.deepEqual(loadDisplayPreferences(storage), DEFAULT_DISPLAY_PREFERENCES);
  const denied = { getItem() { throw new Error('denied'); }, setItem() { throw new Error('denied'); } };
  assert.deepEqual(loadDisplayPreferences(denied), DEFAULT_DISPLAY_PREFERENCES);
  assert.equal(saveDisplayPreferences(denied, { textScale: 115 }), false);
  assert.equal(saveDisplayPreferences(null, { textScale: 115 }), false);
});

test('applying preferences uses safe root attributes without mutating the input', () => {
  const root = new FakeElement('html');
  const input = { textScale: '130', highContrast: true, reducedMotion: false };
  const snapshot = JSON.stringify(input);
  const applied = applyDisplayPreferences({ documentElement: root }, input);
  assert.deepEqual(applied, { textScale: 130, highContrast: true, reducedMotion: false });
  assert.equal(JSON.stringify(input), snapshot);
  assert.equal(root.getAttribute('data-text-size'), '130');
  assert.equal(root.getAttribute('data-contrast'), 'high');
  assert.equal(root.getAttribute('data-motion'), 'default');
  assert.doesNotThrow(() => applyDisplayPreferences(null, input));
});

test('saved preferences apply before interaction and the disclosure restores focus', () => {
  const { doc, dock, toggle, panel, controls, controller } = fixture({
    stored: JSON.stringify({ textScale: 130, highContrast: true, reducedMotion: true }),
  });
  assert.equal(dock.getAttribute('aria-label'), 'Game controls');
  assert.equal(doc.documentElement.getAttribute('data-text-size'), '130');
  assert.equal(doc.documentElement.getAttribute('data-contrast'), 'high');
  assert.equal(doc.documentElement.getAttribute('data-motion'), 'reduced');
  assert.equal(panel.hidden, true);
  assert.equal(toggle.getAttribute('aria-expanded'), 'false');
  assert.equal(toggle.getAttribute('aria-controls'), 'display-settings');

  toggle.emit('click');
  assert.equal(panel.hidden, false);
  assert.equal(toggle.getAttribute('aria-expanded'), 'true');
  assert.equal(dock.dataset.display, 'open');
  assert.equal(controls.scale.value, '130');
  assert.equal(controls.contrast.checked, true);
  assert.equal(controls.motion.checked, true);

  let prevented = false;
  doc.emit('keydown', { key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(panel.hidden, true);
  assert.equal(doc.activeElement, toggle);
  toggle.emit('click');
  controls.done.emit('click');
  assert.equal(panel.hidden, true);
  assert.equal(doc.activeElement, toggle);
  controller.destroy();
});

test('changes persist, reset restores defaults, and a reload honors saved choices', () => {
  const storage = memoryStorage();
  const first = fixture({ storage });
  first.toggle.emit('click');
  first.controls.scale.value = '115';
  first.controls.scale.emit('change');
  first.controls.contrast.checked = true;
  first.controls.contrast.emit('change');
  first.controls.motion.checked = true;
  first.controls.motion.emit('change');
  assert.deepEqual(first.controller.preferences, { textScale: 115, highContrast: true, reducedMotion: true });
  assert.equal(first.controls.status.textContent, 'Reduced motion on.');
  assert.deepEqual(JSON.parse(storage.getItem(DISPLAY_STORAGE_KEY)), first.controller.preferences);
  assert.equal(first.doc.documentElement.getAttribute('data-text-size'), '115');
  assert.equal(first.doc.documentElement.getAttribute('data-contrast'), 'high');
  assert.equal(first.doc.documentElement.getAttribute('data-motion'), 'reduced');
  first.controller.destroy();

  const second = fixture({ storage });
  assert.deepEqual(second.controller.preferences, { textScale: 115, highContrast: true, reducedMotion: true });
  second.controls.reset.emit('click');
  assert.deepEqual(second.controller.preferences, DEFAULT_DISPLAY_PREFERENCES);
  assert.equal(second.controls.status.textContent, 'Display settings reset to defaults.');
  assert.equal(second.doc.documentElement.getAttribute('data-text-size'), '100');
  assert.equal(second.doc.documentElement.getAttribute('data-contrast'), 'standard');
  assert.equal(second.doc.documentElement.getAttribute('data-motion'), 'default');
  second.controller.destroy();
});

test('missing docks are safe and destroy removes UI, listeners, and applied attributes', () => {
  assert.equal(installDisplayControls({}, { document: null }), null);
  assert.equal(installDisplayControls({}, { document: { querySelector() { return null; } } }), null);
  const { doc, dock, toggle, panel, controller } = fixture();
  controller.destroy();
  assert.equal(toggle.removed, true);
  assert.equal(panel.removed, true);
  assert.equal(doc.listeners.has('keydown'), false);
  assert.equal('display' in dock.dataset, false);
  assert.equal(doc.documentElement.getAttribute('data-text-size'), null);
  assert.equal(doc.documentElement.getAttribute('data-contrast'), null);
  assert.equal(doc.documentElement.getAttribute('data-motion'), null);
  assert.doesNotThrow(() => toggle.emit('click'));
});

test('bootstrap installs display controls after audio and before the first scene', () => {
  const main = readFileSync(new URL('../src/main.js', import.meta.url), 'utf8');
  const audio = main.indexOf('installAudio(game);');
  const display = main.indexOf('installDisplayControls(game);');
  const title = main.indexOf("game.setScene('title')");
  assert.ok(audio >= 0 && display > audio && title > display);
  const css = readFileSync(new URL('../style.css', import.meta.url), 'utf8');
  for (const selector of ['html[data-text-size="115"]', 'html[data-text-size="130"]', 'html[data-contrast="high"]', 'html[data-motion="reduced"]']) {
    assert.ok(css.includes(selector), selector);
  }
  assert.ok(css.includes('@media (max-width: 400px)'));
  assert.ok(css.includes('html[data-text-size="130"] .scene-header h1 { font-size: 1.8rem; overflow-wrap: break-word; }'));
});
