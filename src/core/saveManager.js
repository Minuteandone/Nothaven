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
 * Structural validation that mirrors the Archive parser's validState
 * check: the imported state must be an object with a valid scene, a
 * non-empty party array, no active combat, and pass migrateSave.
 * Returns { ok, error?, preview? } where preview has human-readable
 * summary fields for a confirmation step.
 */
export function validateImportSave(jsonString) {
  let raw;
  try {
    raw = JSON.parse(jsonString);
  } catch {
    return { ok: false, error: 'Invalid JSON file. Please select a valid save file.' };
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'Save file is not a valid game state.' };
  }

  // Reject proto / constructor poisoning before any key access
  const forbidden = new Set(['__proto__', 'prototype', 'constructor']);
  for (const k of Object.keys(raw)) {
    if (forbidden.has(k)) return { ok: false, error: 'Save file contains disallowed keys.' };
  }

  // Structural pre-check: must have a party array, a scene string, gold
  if (!Array.isArray(raw.party) || raw.party.length === 0 || !raw.party.every(
    (m) => m !== null && typeof m === 'object'
  )) {
    return { ok: false, error: 'Save file does not contain a valid party.' };
  }
  if (typeof raw.scene !== 'string') {
    return { ok: false, error: 'Save file is missing a valid scene.' };
  }
  if (typeof raw.gold !== 'number') {
    return { ok: false, error: 'Save file is missing gold.' };
  }

  // Reject saves with active combat BEFORE migration (migrateSave nullifies it)
  if (raw.combat && typeof raw.combat === 'object' && !Array.isArray(raw.combat) && Object.keys(raw.combat).length > 0) {
    return { ok: false, error: 'Cannot import a save with an active combat encounter.' };
  }

  // Run migration to fill defaults and upgrade old formats
  const migrated = migrateSave(raw, createInitialState);
  if (!migrated) {
    return { ok: false, error: 'Save format not recognised or from a newer version of the game.' };
  }

  // Build preview summary from migrated state
  const hero = migrated.party[0];
  const preview = {
    heroName: hero?.name || 'Unknown',
    level: hero?.level ?? 1,
    location: migrated.location || 'greyhaven',
    scene: migrated.scene,
    gold: migrated.gold ?? 0,
    partyCount: migrated.party.length,
    saveVersion: migrated.saveVersion ?? SAVE_VERSION,
  };

  return { ok: true, preview };
}

/**
 * Write a validated JSON string to the main save slot, backing up the
 * existing save first.  Call only after validateImportSave succeeds and
 * the user has confirmed the preview.
 * Returns { ok: boolean, error?: string }
 */
export function commitImportSave(jsonString) {
  let raw;
  try { raw = JSON.parse(jsonString); } catch {
    return { ok: false, error: 'Invalid JSON.' };
  }
  const migrated = migrateSave(raw, createInitialState);
  if (!migrated) return { ok: false, error: 'Save format not recognised.' };

  // Backup current save before overwriting
  const existing = localStorage.getItem(SAVE_KEY);
  if (existing) {
    try { localStorage.setItem(SAVE_KEY + '.backup', existing); }
    catch { /* storage full — proceed without backup */ }
  }
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(migrated));
  } catch {
    return { ok: false, error: 'Could not write save to this device. Storage may be full.' };
  }
  return { ok: true };
}

/**
 * Import a validated save in a single step (legacy path kept for tests).
 * Returns { ok: boolean, error?: string, data?: object }
 */
export function importSave(jsonString) {
  const validation = validateImportSave(jsonString);
  if (!validation.ok) return { ok: false, error: validation.error };
  const result = commitImportSave(jsonString);
  if (!result.ok) return result;
  // Return the migrated data for callers that need it
  let raw;
  try { raw = JSON.parse(jsonString); } catch { return { ok: true }; }
  const migrated = migrateSave(raw, createInitialState);
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
