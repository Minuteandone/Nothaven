import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIO_STORAGE_KEY,
  DEFAULT_AUDIO_PREFERENCES,
  StormSoundscape,
  loadAudioPreferences,
  normalizeAudioPreferences,
  saveAudioPreferences,
} from '../src/audio/soundscape.js';

class FakeParam {
  constructor(value = 0) { this.value = value; this.events = []; }
  setTargetAtTime(...args) { this.value = args[0]; this.events.push(['target', ...args]); }
  setValueAtTime(...args) { this.value = args[0]; this.events.push(['set', ...args]); }
  linearRampToValueAtTime(...args) { this.value = args[0]; this.events.push(['linear', ...args]); }
  exponentialRampToValueAtTime(...args) { this.value = args[0]; this.events.push(['exponential', ...args]); }
}

class FakeAudioContext {
  static instances = [];
  constructor() {
    this.currentTime = 2;
    this.sampleRate = 4;
    this.state = 'suspended';
    this.destination = {};
    this.oscillators = [];
    this.bufferSources = [];
    FakeAudioContext.instances.push(this);
  }
  createGain() { return { gain: new FakeParam(1), connect() {}, disconnect() {} }; }
  createOscillator() {
    const node = { frequency: new FakeParam(), type: 'sine', connect() {}, disconnect() {}, start() { this.started = true; }, stop() { this.stopped = true; } };
    this.oscillators.push(node);
    return node;
  }
  createBufferSource() {
    const node = { playbackRate: new FakeParam(1), connect() {}, disconnect() {}, start() { this.started = true; }, stop() { this.stopped = true; } };
    this.bufferSources.push(node);
    return node;
  }
  createBiquadFilter() { return { frequency: new FakeParam(), Q: new FakeParam(), connect() {}, disconnect() {} }; }
  createBuffer(channels, length) { const data = new Float32Array(length); return { getChannelData: () => data }; }
  async resume() { this.state = 'running'; }
  async suspend() { this.state = 'suspended'; }
  async close() { this.state = 'closed'; }
}

test('audio preferences normalize invalid values and survive storage failures', () => {
  assert.deepEqual(normalizeAudioPreferences(null), DEFAULT_AUDIO_PREFERENCES);
  assert.deepEqual(normalizeAudioPreferences({ muted: false, volume: 4 }), { muted: false, volume: 1 });
  assert.deepEqual(normalizeAudioPreferences({ muted: 'no', volume: -2 }), { muted: true, volume: 0 });
  assert.deepEqual(normalizeAudioPreferences({ muted: false, volume: 'invalid' }), { muted: false, volume: 0.35 });
  assert.deepEqual(loadAudioPreferences({ getItem() { return '{broken'; } }), DEFAULT_AUDIO_PREFERENCES);
  assert.deepEqual(loadAudioPreferences({ getItem() { throw new Error('blocked'); } }), DEFAULT_AUDIO_PREFERENCES);
  assert.equal(saveAudioPreferences({ setItem() { throw new Error('full'); } }, {}), false);
  assert.equal(saveAudioPreferences(null, {}), false);
});

test('audio preferences round-trip under the versioned storage key', () => {
  const values = new Map();
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) };
  assert.equal(saveAudioPreferences(storage, { muted: false, volume: 0.6 }), true);
  assert.equal(values.has(AUDIO_STORAGE_KEY), true);
  assert.deepEqual(loadAudioPreferences(storage), { muted: false, volume: 0.6 });
});

test('soundscape construction is silent and start creates one resumable context', async () => {
  FakeAudioContext.instances = [];
  const audio = new StormSoundscape({ AudioContextClass: FakeAudioContext, random: () => 0.5 });
  assert.equal(FakeAudioContext.instances.length, 0, 'no autoplay or context before explicit start');
  assert.equal(audio.playCue('ui'), false);
  audio.setMuted(false);
  audio.setVolume(0.5);
  await audio.start();
  await audio.start();
  assert.equal(FakeAudioContext.instances.length, 1);
  assert.equal(audio.context.state, 'running');
  assert.equal(audio.ambience.master.gain.value, 0.5);
  assert.equal(audio.sources.length, 5);
  assert.equal(audio.sources.every(source => source.started), true);
  await audio.destroy();
  assert.equal(audio.context, null);
});

test('muting, scene mixes, and synthesized cues do not throw', async () => {
  const audio = new StormSoundscape({ AudioContextClass: FakeAudioContext, random: () => 0.25 });
  audio.setMuted(false);
  await audio.start();
  const baselineOscillators = audio.context.oscillators.length;
  assert.equal(audio.playCue('attack'), true);
  assert.equal(audio.playCue('skill'), true);
  assert.equal(audio.playCue('defend'), true);
  assert.equal(audio.playCue('item'), true);
  assert.equal(audio.playCue('victory'), true);
  assert.equal(audio.playCue('levelup'), true);
  assert.ok(audio.context.oscillators.length > baselineOscillators);
  audio.setScene('combat');
  assert.equal(audio.ambience.droneGain.gain.value, 0.018);
  audio.setScene('town');
  assert.equal(audio.ambience.windGain.gain.value, 0.026);
  audio.setMuted(true);
  assert.equal(audio.ambience.master.gain.value, 0);
  assert.equal(audio.playCue('ui'), false);
  audio.setVolume(Number.POSITIVE_INFINITY);
  assert.equal(audio.volume, 0.35);
  await audio.destroy();
});


test('a pending audio resume rejects promptly instead of locking the controls', async () => {
  class PendingAudioContext extends FakeAudioContext {
    resume() { return new Promise(() => {}); }
  }
  const audio = new StormSoundscape({ AudioContextClass: PendingAudioContext, startTimeoutMs: 5 });
  await assert.rejects(audio.start(), /Audio resume timed out/);
  await audio.destroy();
});

test('unsupported browsers remain silent and safe', async () => {
  const audio = new StormSoundscape({ AudioContextClass: null });
  assert.equal(audio.available, false);
  assert.equal(await audio.start(), false);
  assert.doesNotThrow(() => { audio.setScene('combat'); audio.setVolume(0.5); audio.setMuted(false); });
  assert.equal(audio.playCue('ui'), false);
  await audio.destroy();
});
