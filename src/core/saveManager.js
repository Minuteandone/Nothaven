import { createInitialState } from '../state.js';
import { migrateSave, SAVE_VERSION } from './save.js';

const SAVE_KEY = 'stormhaven-save';
const AUTOSAVE_KEY = 'stormhaven-autosave';

/**
 * Export the current saved game as a downloadable JSON file.
 * Reads directly from localStorage so the latest persisted state is always
 * exported — not a stale in-memory default.
 * Returns true if the download was triggered successfully.
 */
export function exportSave() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return false;
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    return false;
  }
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `stormhaven-save-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  return true;
}

/**
 * Import a save from a JSON string with full validation and migration.
 * Backs up the existing save before overwriting.
 * Returns { ok: boolean, error?: string, data?: object }
 */
export function importSave(jsonString) {
  let raw;
  try {
    raw = JSON.parse(jsonString);
  } catch {
    return { ok: false, error: 'Invalid JSON file. Please select a valid save file.' };
  }
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'Save file is not a valid game state.' };
  }
  const migrated = migrateSave(raw, createInitialState);
  if (!migrated) {
    return { ok: false, error: 'Save format not recognised or from a newer version of the game.' };
  }
  // Backup current save before overwriting
  const existing = localStorage.getItem(SAVE_KEY);
  if (existing) {
    try {
      localStorage.setItem(SAVE_KEY + '.backup', existing);
    } catch { /* storage full — proceed without backup */ }
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
  } catch {
    return { ok: false, error: 'Could not write save to this device. Storage may be full.' };
  }
  return { ok: true, data: migrated };
}

/**
 * Delete the current save, backup, and any autosave.
 * Returns true after removal.
 */
export function deleteSave() {
  localStorage.removeItem(SAVE_KEY);
  localStorage.removeItem(SAVE_KEY + '.backup');
  localStorage.removeItem(AUTOSAVE_KEY);
  return true;
}

/**
 * Check whether a save exists.
 */
export function hasSave() {
  return localStorage.getItem(SAVE_KEY) !== null;
}
