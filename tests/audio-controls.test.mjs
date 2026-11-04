import test from 'node:test';
import assert from 'node:assert/strict';
import { installAudio } from '../src/audio/controls.js';
import { AUDIO_STORAGE_KEY } from '../src/audio/soundscape.js';

class FakeParam {
  constructor(value = 0) { this.value = value; }
  setTargetAtTime(value) { this.value = value; }
  setValueAtTime(value) { this.value = value; }
  linearRampToValueAtTime(value) { this.value = value; }
  exponentialRampToValueAtTime(value) { this.value = value; }
}
class FakeAudioContext {
  static instances = [];
  constructor() {
    this.state = 'suspended';
    this.currentTime = 1;
    this.sampleRate = 4;
    this.destination = {};
    FakeAudioContext.instances.push(this);
  }
  createGain() { return { gain: new FakeParam(1), connect() {}, disconnect() {} }; }
  createOscillator() { return { frequency: new FakeParam(), connect() {}, disconnect() {}, start() {}, stop() {} }; }
  createBufferSource() { return { playbackRate: new FakeParam(1), connect() {}, disconnect() {}, start() {}, stop() {} }; }
  createBiquadFilter() { return { frequency: new FakeParam(), Q: new FakeParam(), connect() {}, disconnect() {} }; }
  createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}

class FakeElement {
  constructor(tagName = 'div') {
    this.tagName = tagName;
    this.attributes = {};
    this.dataset = {};
    this.listeners = {};
    this.disabled = false;
    this.value = '';
    this.textContent = '';
    this.removed = false;
  }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(name, fn) { this.listeners[name] = fn; }
  removeEventListener(name, fn) { if (this.listeners[name] === fn) delete this.listeners[name]; }
  async emit(name, event = {}) { return this.listeners[name]?.(event); }
  remove() { this.removed = true; }
  closest() { return this; }
}

function fixture({ stored = null, AudioContextClass = FakeAudioContext } = {}) {
  const values = new Map(stored ? [[AUDIO_STORAGE_KEY, JSON.stringify(stored)]] : []);
  const storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const button = new FakeElement('button');
  const label = new FakeElement('span');
  const slider = new FakeElement('input');
  const output = new FakeElement('output');
  const status = new FakeElement('span');
  const dock = new FakeElement('aside');
  const elements = new Map([
    ['.audio-toggle', button],
    ['[data-audio-label]', label],
    ['#storm-volume', slider],
    ['[data-audio-output]', output],
    ['[data-audio-status]', status],
  ]);
  dock.querySelector = selector => elements.get(selector);
  dock.innerHTML = '';
  const root = new FakeElement('main');
  const document = new FakeElement('document');
  document.hidden = false;
  document.defaultView = { AudioContext: AudioContextClass, localStorage: storage };
  document.body = {
    firstChild: root,
    inserted: null,
    insertBefore(node) { this.inserted = node; },
  };
  document.createElement = tag => { assert.equal(tag, 'aside'); return dock; };
  const handlers = {};
  const bus = {
    on(name, fn) { (handlers[name] ||= new Set()).add(fn); },
    off(name, fn) { handlers[name]?.delete(fn); },
    emit(name, payload) { for (const fn of handlers[name] || []) fn(payload); },
  };
  const game = { root, bus, state: { scene: 'title' } };
  return { game, document, dock, button, label, slider, output, status, root, handlers, values };
}

function actionEvent(action) {
  const control = new FakeElement('button');
  control.dataset.action = action;
  return { target: { closest: () => control } };
}

test('controls opt in explicitly, persist settings, react to events, and clean up', async () => {
  FakeAudioContext.instances = [];
  const f = fixture();
  const controller = installAudio(f.game, { document: f.document, random: () => 0.5 });
  assert.equal(FakeAudioContext.instances.length, 0, 'installing controls does not create audio');
  assert.equal(f.document.body.inserted, f.dock);
  assert.equal(f.label.textContent, 'Enable sound');
  assert.equal(f.slider.value, '35');
  assert.equal(f.status.textContent, 'Sound is off.');
  f.game.bus.emit('scene:enter', { name: 'explore' });
  assert.equal(FakeAudioContext.instances.length, 0, 'scene changes never autoplay');

  const cues = [];
  controller.audio.playCue = name => { cues.push(name); return true; };
  await f.button.emit('click');
  assert.equal(FakeAudioContext.instances.length, 1);
  assert.equal(controller.audio.muted, false);
  assert.equal(f.label.textContent, 'Mute sound');
  assert.equal(f.button.getAttribute('aria-pressed'), 'true');
  assert.deepEqual(cues, ['ui']);
  assert.deepEqual(JSON.parse(f.values.get(AUDIO_STORAGE_KEY)), { muted: false, volume: 0.35 });

  f.root.emit('click', actionEvent('attack'));
  f.root.emit('click', actionEvent('skill'));
  f.root.emit('click', actionEvent('defend'));
  f.root.emit('click', actionEvent('buyItem'));
  f.game.bus.emit('scene:enter', { name: 'combat' });
  f.game.bus.emit('combat:victory', {});
  f.game.bus.emit('party:levelup', {});
  assert.equal(controller.audio.scene, 'combat');
  assert.deepEqual(cues, ['ui', 'attack', 'skill', 'defend', 'item', 'victory', 'levelup']);

  f.slider.value = '70';
  f.slider.emit('input');
  assert.equal(controller.audio.volume, 0.7);
  assert.equal(f.output.textContent, '70%');
  assert.equal(f.slider.getAttribute('aria-valuetext'), '70 percent');
  assert.equal(JSON.parse(f.values.get(AUDIO_STORAGE_KEY)).volume, 0.7);
  await f.button.emit('click');
  assert.equal(controller.audio.muted, true);
  assert.equal(f.label.textContent, 'Unmute sound');
  assert.equal(JSON.parse(f.values.get(AUDIO_STORAGE_KEY)).muted, true);

  await controller.destroy();
  assert.equal(f.dock.removed, true);
  assert.equal(f.root.listeners.click, undefined);
  assert.equal(f.handlers['scene:enter'].size, 0);
  assert.equal(controller.audio.context, null);
});

test('a previously enabled preference still requires an explicit resume gesture', async () => {
  FakeAudioContext.instances = [];
  const f = fixture({ stored: { muted: false, volume: 0.6 } });
  const controller = installAudio(f.game, { document: f.document });
  assert.equal(f.label.textContent, 'Resume sound');
  assert.equal(f.slider.value, '60');
  assert.equal(FakeAudioContext.instances.length, 0);
  await f.button.emit('click');
  assert.equal(FakeAudioContext.instances.length, 1);
  assert.equal(controller.audio.volume, 0.6);
  assert.equal(controller.audio.muted, false);
  await controller.destroy();
});

test('hidden tabs suspend and visible tabs resume only previously enabled audio', async () => {
  const f = fixture();
  const controller = installAudio(f.game, { document: f.document });
  await f.button.emit('click');
  const context = controller.audio.context;
  f.document.hidden = true;
  await f.document.emit('visibilitychange');
  assert.equal(context.state, 'suspended');
  assert.equal(f.label.textContent, 'Resume sound');
  f.document.hidden = false;
  await f.document.emit('visibilitychange');
  assert.equal(context.state, 'running');
  assert.equal(f.label.textContent, 'Mute sound');
  await controller.destroy();
});

test('a pending audio resume times out without leaving the controls busy', async () => {
  class PendingControlAudioContext extends FakeAudioContext {
    resume() { return new Promise(() => {}); }
  }
  const f = fixture({ AudioContextClass: PendingControlAudioContext });
  const controller = installAudio(f.game, { document: f.document, startTimeoutMs: 5 });
  const activation = f.button.emit('click');
  assert.equal(f.label.textContent, 'Starting sound…');
  assert.equal(f.button.disabled, true);
  await activation;
  assert.notEqual(f.label.textContent, 'Starting sound…');
  assert.equal(f.label.textContent, 'Sound unavailable');
  assert.equal(f.dock.dataset.sound, 'unavailable');
  assert.match(f.status.textContent, /fully playable/);
  assert.equal(f.button.disabled, true, 'failed audio is unavailable rather than stuck busy');
  await controller.destroy();
});

test('unsupported audio disables only the controls and non-DOM installs are safe', async () => {
  const f = fixture({ AudioContextClass: null });
  const controller = installAudio(f.game, { document: f.document });
  assert.equal(f.button.disabled, true);
  assert.equal(f.slider.disabled, true);
  assert.equal(f.label.textContent, 'Sound unavailable');
  assert.match(f.status.textContent, /fully playable/);
  assert.equal(installAudio(null, { document: null }), null);
  await controller.destroy();
});

test('real shop and bag transaction actions cue the item sound', async () => {
  FakeAudioContext.instances = [];
  const f = fixture();
  const controller = installAudio(f.game, { document: f.document, random: () => 0.5 });
  const cues = [];
  controller.audio.playCue = name => { cues.push(name); return true; };
  await f.button.emit('click');
  cues.length = 0;
  for (const action of ['buy', 'buy5', 'sell', 'sellAll', 'craft', 'use']) {
    f.root.emit('click', actionEvent(action));
  }
  assert.deepEqual(cues, ['item', 'item', 'item', 'item', 'item', 'item'],
    'purchases, sales, crafting, and item use all cue the item sound');
  f.root.emit('click', actionEvent('leave'));
  assert.deepEqual(cues.slice(-1), ['ui'], 'navigation stays on the generic cue');
  await controller.destroy();
});
