import { createStoryState } from './story/index.js';
import { SAVE_VERSION, migrateSave } from './core/save.js';
const SAVE_KEY = 'stormhaven-save';

export function createInitialState() {
  return {
    saveVersion: SAVE_VERSION,
    scene: 'title',
    party: [
      { id: 'hero', name: 'Wren', hp: 30, maxHp: 30, mp: 10, maxMp: 10, atk: 6, def: 3, spd: 5, level: 1, xp: 0 },
    ],
    gold: 20,
    inventory: [],   // [{ id, qty }] — see src/items/
    flags: {},       // story flags — see src/story/
    questLog: {},    // { questId: stage }
    location: 'greyhaven',
    story: createStoryState(),
    combat: null,
  };
}

export function saveGame(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, combat: null, saveVersion: SAVE_VERSION }));
}
export function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return null;
  try {
    return migrateSave(JSON.parse(raw), createInitialState);
  } catch {
    return null; // corrupt save
  }
}
export function hasSave() { return !!localStorage.getItem(SAVE_KEY); }
