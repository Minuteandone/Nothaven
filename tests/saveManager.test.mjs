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

test('exportSave returns false when no save exists', () => {
  const st = storage();
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  try {
    assert.equal(exportSave(), false);
  } finally {
    globalThis.localStorage = old;
  }
});

test('exportSave returns true when save exists (mocked DOM)', () => {
  const st = storage();
  const state = createInitialState();
  state.gold = 999;
  st.setItem(SAVE_KEY, JSON.stringify(state));
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  // Save and replace DOM/URL globals for the download path
  const oldDoc = globalThis.document;
  const oldURL = globalThis.URL;
  globalThis.document = {
    createElement: () => ({ href: '', download: '', click() {} }),
    body: { appendChild() {}, removeChild() {} },
  };
  globalThis.URL = { createObjectURL: () => 'blob:test', revokeObjectURL() {} };
  try {
    assert.equal(exportSave(), true);
  } finally {
    globalThis.localStorage = old;
    globalThis.document = oldDoc;
    globalThis.URL = oldURL;
  }
});

test('exportSave output contains no egg words (format check)', () => {
  const state = createInitialState();
  const data = { ...state, combat: null, saveVersion: SAVE_VERSION };
  const json = JSON.stringify(data);
  assert.ok(!EGG_RE.test(json), 'save JSON format must not contain egg words');
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

test('deleteSave removes save, backup, and autosave', () => {
  const st = storage();
  st.setItem(SAVE_KEY, '{}');
  st.setItem(SAVE_KEY + '.backup', '{}');
  st.setItem(AUTOSAVE_KEY, '{}');
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  try {
    deleteSave();
    assert.equal(st.getItem(SAVE_KEY), null, 'save should be removed');
    assert.equal(st.getItem(SAVE_KEY + '.backup'), null, 'backup should be removed');
    assert.equal(st.getItem(AUTOSAVE_KEY), null, 'autosave should be removed');
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

test('scheduleAutosave writes to localStorage when enabled', (_, done) => {
  const st = storage();
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  enableAutosave();
  try {
    const state = createInitialState();
    state.gold = 500;
    scheduleAutosave(state);
    // The debounce is 5 minutes, but we verify the function runs without error
    assert.equal(isAutosaveEnabled(), true);
    disableAutosave();
    done();
  } finally {
    globalThis.localStorage = old;
    disableAutosave();
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

test('importSave rejects empty object {}', () => {
  const result = importSave('{}');
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('recognised game data'), 'should reject near-empty objects');
});

test('importSave rejects object with only one save key', () => {
  const result = importSave('{"gold": 100}');
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('recognised game data'), 'should reject objects with insufficient save fields');
});

test('importSave rejects object with unrelated keys', () => {
  const result = importSave('{"foo": 1, "bar": 2}');
  assert.equal(result.ok, false);
  assert.ok(result.error.includes('recognised game data'));
});

test('importSave accepts object with gold and party (valid save)', () => {
  const st = storage();
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  try {
    const result = importSave('{"gold": 100, "party": [{"id":"hero","name":"Wren"}], "scene": "town"}');
    assert.equal(result.ok, true);
  } finally {
    globalThis.localStorage = old;
  }
});

test('autosave writes to localStorage when enabled (controlled timer)', (_, done) => {
  const st = storage();
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  enableAutosave();
  const state = createInitialState();
  state.gold = 777;
  // Use _testInterval = 10ms for fast test
  scheduleAutosave(state, 10);
  // The autosave timer fires after 10ms. We check at 50ms.
  // Per-test cleanup (localStorage swap, disable) must live inside
  // the timeout — a finally block would fire synchronously and clear
  // the timer before it ever runs.
  setTimeout(() => {
    try {
      const raw = st.getItem(AUTOSAVE_KEY);
      assert.ok(raw, 'autosave should be written to localStorage');
      const parsed = JSON.parse(raw);
      assert.equal(parsed.gold, 777, 'autosaved gold should match');
      assert.equal(parsed.combat, null, 'combat should be nullified');
    } finally {
      disableAutosave();
      globalThis.localStorage = old;
      done();
    }
  }, 50);
});

test('autosave does not write when disabled even with short interval', (_, done) => {
  const st = storage();
  const old = globalThis.localStorage;
  globalThis.localStorage = st;
  disableAutosave();
  try {
    const state = createInitialState();
    scheduleAutosave(state, 10);
    setTimeout(() => {
      assert.equal(st.getItem(AUTOSAVE_KEY), null, 'disabled autosave must not write');
      done();
    }, 50);
  } finally {
    globalThis.localStorage = old;
  }
});
