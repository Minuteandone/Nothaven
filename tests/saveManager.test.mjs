import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, saveGame, hasSave, enableAutosave, disableAutosave, scheduleAutosave, isAutosaveEnabled, hasAutosave, loadAutosave, clearAutosave } from '../src/state.js';
import { exportSave, importSave, deleteSave } from '../src/core/saveManager.js';
import { SAVE_VERSION } from '../src/core/save.js';

const SAVE_KEY = 'stormhaven-save';
const AUTOSAVE_KEY = 'stormhaven-autosave';
const EGG_RE = /\b(egg|yolk|hatch|lay|nest|roost|brood|coop|fowl|flock|talon|beak|plumage|fledgling|peck|yoke|layer|ovoid|oval|ellipse|shell|crack|chick|hen|rooster|easter)\b/i;

function storage() {
  const data = new Map();
  return { data, getItem(k) { return data.get(k) ?? null; }, setItem(k, v) { data.set(k, String(v)); }, removeItem(k) { data.delete(k); } };
}

test('exportSave produces valid JSON string from state', () => {
  const state = createInitialState();
  const data = { ...state, combat: null, saveVersion: SAVE_VERSION };
  const json = JSON.stringify(data);
  const parsed = JSON.parse(json);
  assert.equal(parsed.saveVersion, SAVE_VERSION);
  assert.equal(parsed.combat, null);
  assert.equal(parsed.scene, 'title');
});

test('exportSave output contains no egg words', () => {
  const state = createInitialState();
  const data = { ...state, combat: null, saveVersion: SAVE_VERSION };
  const json = JSON.stringify(data);
  assert.ok(!EGG_RE.test(json), 'exportSave JSON must not contain egg words');
});

test('importSave rejects invalid JSON', () => {
  const result = importSave('not valid json {{{');
  assert.equal(result.ok, false);
  assert.ok(result.error);
});

test('importSave rejects non-object JSON', () => {
  const result = importSave('"just a string"');
  assert.equal(result.ok, false);
});

test('importSave rejects null', () => {
  const result = importSave('null');
  assert.equal(result.ok, false);
});

test('importSave migrates and accepts valid save', () => {
  const st = storage();
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  try {
    const state = createInitialState();
    const json = JSON.stringify({ ...state, saveVersion: 1, scene: 'town' });
    const result = importSave(json);
    assert.equal(result.ok, true);
    assert.ok(result.data);
    assert.equal(result.data.saveVersion, SAVE_VERSION);
  } finally {
    globalThis.localStorage = old;
  }
});

test('importSave backs up existing save before overwriting', () => {
  const st = storage();
  st.setItem(SAVE_KEY, '{"saveVersion":2,"scene":"town"}');
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  try {
    const state = createInitialState();
    state.scene = 'explore';
    const json = JSON.stringify(state);
    const result = importSave(json);
    assert.equal(result.ok, true);
    assert.ok(st.getItem(SAVE_KEY + '.backup'), 'backup should exist');
    assert.equal(JSON.parse(st.getItem(SAVE_KEY + '.backup')).scene, 'town');
  } finally {
    globalThis.localStorage = old;
  }
});

test('deleteSave removes both save and backup', () => {
  const st = storage();
  st.setItem(SAVE_KEY, '{}');
  st.setItem(SAVE_KEY + '.backup', '{}');
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  try {
    deleteSave();
    assert.equal(st.getItem(SAVE_KEY), null);
    assert.equal(st.getItem(SAVE_KEY + '.backup'), null);
  } finally {
    globalThis.localStorage = old;
  }
});

test('hasSave returns false after deleteSave', () => {
  const st = storage();
  st.setItem(SAVE_KEY, '{}');
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  try {
    assert.equal(hasSave(), true);
    deleteSave();
    assert.equal(hasSave(), false);
  } finally {
    globalThis.localStorage = old;
  }
});

test('autosave is initially disabled', () => {
  assert.equal(isAutosaveEnabled(), false);
});

test('enableAutosave sets enabled flag', () => {
  disableAutosave();
  enableAutosave();
  assert.equal(isAutosaveEnabled(), true);
  disableAutosave();
});

test('disableAutosave clears enabled flag', () => {
  enableAutosave();
  disableAutosave();
  assert.equal(isAutosaveEnabled(), false);
});

test('hasAutosave returns false when no autosave exists', () => {
  const st = storage();
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  try {
    assert.equal(hasAutosave(), false);
  } finally {
    globalThis.localStorage = old;
  }
});

test('scheduleAutosave does nothing when disabled', (_, done) => {
  const st = storage();
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  disableAutosave();
  try {
    const state = createInitialState();
    scheduleAutosave(state);
    setTimeout(() => {
      assert.equal(st.getItem(AUTOSAVE_KEY), null);
      done();
    }, 50);
  } finally {
    globalThis.localStorage = old;
  }
});

test('scheduleAutosave skips combat state', (_, done) => {
  const st = storage();
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  enableAutosave();
  try {
    const state = createInitialState();
    state.combat = { active: true };
    scheduleAutosave(state);
    setTimeout(() => {
      assert.equal(st.getItem(AUTOSAVE_KEY), null);
      disableAutosave();
      done();
    }, 100);
  } finally {
    globalThis.localStorage = old;
  }
});

test('loadAutosave returns null when no autosave exists', () => {
  const st = storage();
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  try {
    assert.equal(loadAutosave(), null);
  } finally {
    globalThis.localStorage = old;
  }
});

test('clearAutosave removes autosave key', () => {
  const st = storage();
  st.setItem(AUTOSAVE_KEY, '{"saveVersion":2}');
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  try {
    clearAutosave();
    assert.equal(st.getItem(AUTOSAVE_KEY), null);
  } finally {
    globalThis.localStorage = old;
  }
});

test('saveManager module source has no egg words', async () => {
  const fs = await import('node:fs');
  const src = fs.readFileSync(new URL('../src/core/saveManager.js', import.meta.url), 'utf-8');
  assert.ok(!EGG_RE.test(src), 'saveManager.js must not contain egg words');
});
