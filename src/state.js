const SAVE_KEY = 'stormhaven-save';

export function createInitialState() {
  return {
    scene: 'title',
    party: [
      { id: 'hero', name: 'Wren', hp: 30, maxHp: 30, mp: 10, maxMp: 10, atk: 6, def: 3, spd: 5, level: 1, xp: 0 },
    ],
    gold: 20,
    inventory: [],   // [{ id, qty }] — see src/items/
    flags: {},       // story flags — see src/story/
    questLog: {},    // { questId: stage }
    location: 'town',
    combat: null,
  };
}

export function saveGame(state) {
  localStorage.setItem(SAVE_KEY, JSON.stringify({ ...state, combat: null }));
}
export function loadGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  return raw ? JSON.parse(raw) : null;
}
export function hasSave() { return !!localStorage.getItem(SAVE_KEY); }
