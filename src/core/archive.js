import { createInitialState } from '../state.js';
import { migrateSave, SAVE_VERSION } from './save.js';

export const ARCHIVE_SLOTS = Object.freeze(['1', '2', '3']);
const validSlot = id => typeof id === 'string' && ARCHIVE_SLOTS.includes(id);
const object = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const key = id => `stormhaven.archive.v1.${id}`;
const storageFor = storage => storage === undefined ? globalThis.localStorage : storage;
const validState = state => object(state) && ['town', 'explore'].includes(state.scene)
  && !state.combat && Array.isArray(state.party) && state.party.length > 0 && state.party.every(object);

/** Read-only slot inspection. The raw token protects later confirmations from stale writes. */
export function readArchiveSlot(id, storage) {
  if (!validSlot(id)) return { status: 'invalid-slot' };
  let raw;
  try { raw = storageFor(storage).getItem(key(id)); }
  catch { return { status: 'unavailable' }; }
  if (raw === null) return { status: 'empty', raw };
  try {
    const envelope = JSON.parse(raw);
    if (!object(envelope) || envelope.version !== 1 || typeof envelope.savedAt !== 'string'
      || !Number.isFinite(Date.parse(envelope.savedAt)) || !validState(envelope.state)) {
      return { status: 'invalid', raw };
    }
    const state = migrateSave(envelope.state, createInitialState);
    if (!state) return { status: 'invalid', raw };
    return { status: 'ready', raw, savedAt: envelope.savedAt, state };
  } catch { return { status: 'invalid', raw }; }
}

/** Save only a noncombat Town/Explore snapshot; never alter the quick-save key or live state. */
export function writeArchiveSlot(id, state, expectedRaw, { storage, now = () => new Date() } = {}) {
  if (!validSlot(id) || !validState(state) || !(expectedRaw === null || typeof expectedRaw === 'string')) {
    return { ok: false, reason: 'invalid' };
  }
  try {
    const target = storageFor(storage);
    if (target.getItem(key(id)) !== expectedRaw) return { ok: false, reason: 'changed' };
    const raw = JSON.stringify({ version: 1, savedAt: now().toISOString(), state: { ...state, combat: null, saveVersion: SAVE_VERSION } });
    target.setItem(key(id), raw);
    return { ok: true };
  } catch { return { ok: false, reason: 'unavailable' }; }
}

export function deleteArchiveSlot(id, expectedRaw, storage) {
  if (!validSlot(id) || typeof expectedRaw !== 'string') return { ok: false, reason: 'invalid' };
  try {
    const target = storageFor(storage);
    if (target.getItem(key(id)) !== expectedRaw) return { ok: false, reason: 'changed' };
    target.removeItem(key(id));
    return { ok: true };
  } catch { return { ok: false, reason: 'unavailable' }; }
}
