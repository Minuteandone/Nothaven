// Recruitable companions for Beacon of Stormhaven.
// The hero (party[0]) is player-controlled; companions in party[1..] act
// automatically in combat (see companionTurn in src/combat/rules.js).
import { createEquipment } from '../items/equipment.js';
import { GROWTH, xpForLevel } from '../core/progression.js';

export const MAX_PARTY = 3;

export const COMPANIONS = Object.freeze({
  tamsin: Object.freeze({
    id: 'tamsin', name: 'Tamsin', role: 'scout',
    title: 'Ridge Scout',
    blurb: 'Quick with a bow and quicker on her feet. Lands aimed shots that hit harder than they look.',
    unlock: 'victory_ridge_patrol',
    unlockHint: 'Clear the ridge patrol so Tamsin can leave the road watch.',
    stats: { hp: 24, mp: 6, atk: 7, def: 2, spd: 7 },
  }),
  iven: Object.freeze({
    id: 'iven', name: 'Iven', role: 'keeper',
    title: 'Apprentice Keeper',
    blurb: 'Knows the beacon machinery by heart. Mends wounds in a pinch and throws sparks at anything made of gears.',
    unlock: 'victory_observatory_sentinel',
    unlockHint: 'Defeat the observatory sentinel so Iven can safely leave the tower.',
    stats: { hp: 20, mp: 14, atk: 4, def: 2, spd: 4 },
  }),
  bram: Object.freeze({
    id: 'bram', name: 'Bram', role: 'guardian',
    title: 'Saltmere Harbor Warden',
    blurb: 'A broad-shouldered dockhand who held the flooded pier alone. Bashes foes off balance with his tide-scarred shield.',
    unlock: 'rescue_victory_coast',
    unlockHint: 'Break the siege at Saltmere so Bram can leave the harbor watch.',
    stats: { hp: 32, mp: 4, atk: 6, def: 4, spd: 3 },
  }),
  sela: Object.freeze({
    id: 'sela', name: 'Sela', role: 'signaler',
    title: 'Highwatch Signal Runner',
    blurb: 'Keeps the mountain cairns lit through any gale. Hurls blinding signal flares that burn straight through armor.',
    unlock: 'rescue_victory_heights',
    unlockHint: 'Clear the frost wolves from the Highwatch supply crossing so Sela can rejoin the signal line.',
    stats: { hp: 22, mp: 12, atk: 5, def: 2, spd: 6 },
  }),
});

const has = (o, k) => o != null && Object.prototype.hasOwnProperty.call(o, k);

export function isCompanionId(id) {
  return typeof id === 'string' && has(COMPANIONS, id);
}

export function isUnlocked(state, id) {
  if (!isCompanionId(id)) return false;
  return Boolean(state?.story?.flags?.[COMPANIONS[id].unlock]);
}

export function inParty(state, id) {
  return Array.isArray(state?.party) && state.party.some((m) => m && m.id === id);
}

/** Build a fresh party member for a companion, scaled to `level` (defaults to 1). */
export function createCompanionMember(id, level = 1) {
  const c = COMPANIONS[id];
  const s = c.stats;
  const lv = Math.max(1, Math.floor(level) || 1);
  const up = lv - 1;
  const maxHp = s.hp + up * GROWTH.maxHp;
  const maxMp = s.mp + up * GROWTH.maxMp;
  return {
    id: c.id, name: c.name, role: c.role, companion: true,
    hp: maxHp, maxHp, mp: maxMp, maxMp,
    atk: s.atk + up * GROWTH.atk, def: s.def + up * GROWTH.def, spd: s.spd + up * GROWTH.spd,
    level: lv, xp: xpForLevel(lv), statuses: [], equipment: createEquipment(),
  };
}

/**
 * Recruit a companion into the active party. Companions keep their progress
 * in `state.reserve` while benched. Returns {ok, message}.
 */
export function recruitCompanion(state, id) {
  if (!isCompanionId(id)) return { ok: false, message: 'No one by that name is available.' };
  const c = COMPANIONS[id];
  if (!isUnlocked(state, id)) return { ok: false, message: c.unlockHint };
  if (inParty(state, id)) return { ok: false, message: `${c.name} is already with you.` };
  if (state.party.length >= MAX_PARTY) return { ok: false, message: 'Your party is full.' };
  state.reserve = state.reserve && typeof state.reserve === 'object' ? state.reserve : {};
  let member = has(state.reserve, id) ? state.reserve[id] : null;
  if (member) delete state.reserve[id];
  else member = createCompanionMember(id, state.party[0]?.level || 1);
  state.party.push(member);
  return { ok: true, message: `${c.name} joins the party.` };
}

/** Move an active companion one place earlier or later, leaving Wren fixed. */
export function moveActiveCompanion(state, id, direction) {
  if (!isCompanionId(id)) return { ok: false, message: 'No companion by that name is available.' };
  const name = COMPANIONS[id].name;
  if (direction !== 'earlier' && direction !== 'later') {
    return { ok: false, message: 'Choose earlier or later in the formation.' };
  }
  if (!Array.isArray(state?.party)) return { ok: false, message: 'The active formation is unavailable.' };
  const index = state.party.findIndex((member, i) => i > 0 && member?.id === id);
  if (index < 0) return { ok: false, message: `${name} is not in the active formation.` };
  const target = direction === 'earlier' ? index - 1 : index + 1;
  if (target <= 0 || target >= state.party.length) {
    return { ok: false, message: `${name} is already ${direction === 'earlier' ? 'first' : 'last'} among the companions.` };
  }
  const member = state.party[index];
  const adjacent = state.party[target];
  if (!isCompanionId(adjacent?.id) || adjacent.id === id) {
    return { ok: false, message: 'Companions can only swap with another active companion.' };
  }
  state.party[index] = adjacent;
  state.party[target] = member;
  return { ok: true, message: `${name} moves ${direction} in the formation.` };
}

/** Send a companion back to Greyhaven; their stats are kept in reserve. */
export function dismissCompanion(state, id) {
  if (!isCompanionId(id)) return { ok: false, message: 'No one by that name is in your party.' };
  const idx = state.party.findIndex((m, i) => i > 0 && m && m.id === id);
  if (idx < 0) return { ok: false, message: `${COMPANIONS[id].name} is not in your party.` };
  const [member] = state.party.splice(idx, 1);
  member.statuses = [];
  state.reserve = state.reserve && typeof state.reserve === 'object' ? state.reserve : {};
  state.reserve[id] = member;
  return { ok: true, message: `${member.name} heads back to the Greyhaven watch house.` };
}
