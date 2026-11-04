// Save versioning + migration. Older saves are upgraded by filling in any
// missing fields from a fresh initial state, so new systems (map, items,
// story) never crash on a save made before they existed.
export const SAVE_VERSION = 2;

function isPlainObject(v) {
  return v !== null && typeof v === 'object' && !Array.isArray(v);
}

// Recursively add keys present in `defaults` but missing in `target`.
// Existing values (including arrays) are kept as-is.
export function fillDefaults(target, defaults) {
  const out = isPlainObject(target) ? { ...target } : {};
  for (const key of Object.keys(defaults)) {
    if (!Object.prototype.hasOwnProperty.call(out, key) || out[key] === undefined) {
      out[key] = structuredClone(defaults[key]);
    } else if (isPlainObject(out[key]) && isPlainObject(defaults[key])) {
      out[key] = fillDefaults(out[key], defaults[key]);
    }
  }
  return out;
}

export function migrateSave(raw, createInitialState) {
  if (!isPlainObject(raw)) return null;
  const fresh = createInitialState();
  let data = { ...raw };
  const from = Number.isInteger(data.saveVersion) ? data.saveVersion : 1;
  if (from > SAVE_VERSION) return null; // save from a newer build; refuse rather than corrupt
  data = fillDefaults(data, fresh);
  // Party members also get any new stat fields.
  const heroDefaults = fresh.party[0];
  if (Array.isArray(data.party)) {
    data.party = data.party.map((m) => fillDefaults(m, heroDefaults));
  }
  if (!Array.isArray(data.inventory)) data.inventory = [];
  data.combat = null;
  data.saveVersion = SAVE_VERSION;
  return data;
}
