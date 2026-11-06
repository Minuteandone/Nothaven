// Greyhaven bounty board: repeatable hunt contracts against roaming foes.
// A contract opens once its foe appears in the Field Journal. One contract is
// active at a time; only real victories count (drills never emit combat:victory).
import { ENEMIES } from '../data/enemies.js';
import { grantRewards } from '../items/inventory.js';
import { getItem } from '../items/items.js';

export const BOUNTIES = Object.freeze([
  Object.freeze({ id: 'ridge_rats', title: 'Ridge Road Rat Cull', enemyId: 'storm_rat', count: 4, gold: 30, items: Object.freeze([{ id: 'scrap_metal', qty: 1 }]),
    brief: 'Storm rats are chewing through the relief carts’ harness straps on the Ridge Road.' }),
  Object.freeze({ id: 'bandit_toll', title: 'Bandit Toll Road', enemyId: 'ridge_bandit', count: 3, gold: 40, items: Object.freeze([{ id: 'scrap_metal', qty: 2 }]),
    brief: 'Bandits are charging travellers a “storm toll” at the switchbacks. Persuade them to stop.' }),
  Object.freeze({ id: 'stray_lights', title: 'Stray Lens Lights', enemyId: 'lens_wisp', count: 3, gold: 45, items: Object.freeze([{ id: 'storm_glass', qty: 1 }]),
    brief: 'Lens wisps drift out of the Observatory Ruins and lure lamplighters off the safe path.' }),
  Object.freeze({ id: 'pier_clearance', title: 'Pier Clearance', enemyId: 'reef_crawler', count: 3, gold: 60, items: Object.freeze([{ id: 'salvaged_wiring', qty: 2 }]),
    brief: 'Reef crawlers have claimed the Saltmere loading piers. The supply boats need them back.' }),
  Object.freeze({ id: 'wolf_trail', title: 'Wolves on the Pass', enemyId: 'frost_wolf', count: 3, gold: 65, items: Object.freeze([{ id: 'scrap_metal', qty: 2 }]),
    brief: 'A frost wolf pack shadows every runner crossing Highwatch Pass.' }),
  Object.freeze({ id: 'upper_route', title: 'Rubble on the Upper Route', enemyId: 'rockslide_golem', count: 2, gold: 80, items: Object.freeze([{ id: 'relay_brass', qty: 1 }]),
    brief: 'Rockslide golems keep burying the upper route faster than crews can dig it out.' }),
  Object.freeze({ id: 'relay_raiders', title: 'Relay Road Raiders', enemyId: 'dust_marauder', count: 3, gold: 120, items: Object.freeze([{ id: 'sunscar_glass', qty: 1 }]),
    brief: 'Dust marauders strip copper from the Sunscar line as soon as it is repaired.' }),
  Object.freeze({ id: 'silent_sentries', title: 'Silence the Sentries', enemyId: 'spire_sentry', count: 2, gold: 160, items: Object.freeze([{ id: 'relay_brass', qty: 2 }]),
    brief: 'Spire sentries still challenge anyone on the Stormcrown stairs, long after their masters fell.' }),
  Object.freeze({ id: 'vortex_shades', title: 'Shades in the Vortex', enemyId: 'tempest_shade', count: 2, gold: 220, items: Object.freeze([{ id: 'storm_glass', qty: 2 }]),
    brief: 'Tempest shades linger in the Storm’s Heart and stir up squalls over the coast.' }),
]);

export function bountyRewardText(b) {
  const parts = [`${b.gold} gold`];
  for (const it of b.items) { let name = it.id; try { name = getItem(it.id).name; } catch { /* unknown id */ } parts.push(`${it.qty}× ${name}`); }
  return parts.join(', ');
}

export const getBounty = (id) => BOUNTIES.find((b) => b.id === id) || null;
const count = (n) => (Number.isSafeInteger(n) && n > 0 ? n : 0);

/** Sanitised read-only view of state.bounties. */
export function bountyState(state) {
  const raw = state?.bounties && typeof state.bounties === 'object' && !Array.isArray(state.bounties) ? state.bounties : {};
  const active = getBounty(raw.active) ? raw.active : null;
  const completed = {};
  const src = raw.completed && typeof raw.completed === 'object' && !Array.isArray(raw.completed) ? raw.completed : {};
  for (const b of BOUNTIES) if (count(src[b.id])) completed[b.id] = count(src[b.id]);
  const progress = active ? Math.min(count(raw.progress), getBounty(active).count) : 0;
  return { active, progress, completed };
}

function writeState(state, view) {
  state.bounties = { active: view.active, progress: view.progress, completed: { ...view.completed } };
  return state.bounties;
}

/** One-line status of the active contract for other screens, or null when none is active. */
export function bountySummaryText(state) {
  const view = bountyState(state);
  const b = getBounty(view.active);
  if (!b) return null;
  return view.progress >= b.count
    ? `Bounty contract: “${b.title}” complete — claim it at the Greyhaven bounty board.`
    : `Bounty contract: “${b.title}” — ${view.progress}/${b.count} defeated.`;
}

// Exploration-screen line: the active contract plus whether its foe roams the
// zone being explored. `zone` is a ZONES entry (or null); kept pure for tests.
export function bountyFieldText(state, zone) {
  const base = bountySummaryText(state);
  if (!base) return null;
  const b = getBounty(bountyState(state).active);
  if (bountyState(state).progress >= b.count) return base;
  const roams = Array.isArray(zone?.randomEncounters)
    && zone.randomEncounters.some((r) => r?.enemyId === b.enemyId);
  const foe = ENEMIES[b.enemyId]?.name || b.enemyId;
  return roams
    ? `${base} The ${foe} roams this area.`
    : `${base} The ${foe} does not roam this area.`;
}

export function bountyUnlocked(state, id) {
  const b = getBounty(id);
  return Boolean(b) && count(state?.bestiary?.[b.enemyId]) >= 1;
}

export function totalBountiesClaimed(state) {
  return Object.values(bountyState(state).completed).reduce((a, n) => a + n, 0);
}

export function bountyRows(state) {
  const v = bountyState(state);
  return BOUNTIES.map((b) => ({
    ...b,
    foe: ENEMIES[b.enemyId]?.name || b.enemyId,
    unlocked: bountyUnlocked(state, b.id),
    active: v.active === b.id,
    progress: v.active === b.id ? v.progress : 0,
    ready: v.active === b.id && v.progress >= b.count,
    claimed: v.completed[b.id] || 0,
  }));
}

export function acceptBounty(state, id) {
  const b = getBounty(id);
  if (!b) return { ok: false, message: 'That contract is not on the board.' };
  if (!bountyUnlocked(state, id)) return { ok: false, message: 'Defeat that foe once before taking its contract.' };
  const v = bountyState(state);
  if (v.active) return { ok: false, message: 'Finish or abandon your current contract first.' };
  writeState(state, { ...v, active: id, progress: 0 });
  return { ok: true, message: `Accepted “${b.title}”: defeat ${b.count} ${ENEMIES[b.enemyId]?.name || b.enemyId} in the wilds.` };
}

export function abandonBounty(state) {
  const v = bountyState(state);
  if (!v.active) return { ok: false, message: 'You have no active contract.' };
  const b = getBounty(v.active);
  writeState(state, { ...v, active: null, progress: 0 });
  return { ok: true, message: `Abandoned “${b.title}”. It stays on the board if you change your mind.` };
}

/** Called for every real victory. Returns a log line when progress advances. */
export function recordBountyKill(state, enemyId) {
  const v = bountyState(state);
  if (!v.active || typeof enemyId !== 'string') return null;
  const b = getBounty(v.active);
  if (b.enemyId !== enemyId || v.progress >= b.count) return null;
  const progress = v.progress + 1;
  writeState(state, { ...v, progress });
  return progress >= b.count ? `Bounty complete: “${b.title}”. Claim it at the Greyhaven bounty board.` : `Bounty progress: ${progress}/${b.count} for “${b.title}”.`;
}

export function claimBounty(state, lookup = getBounty) {
  const v = bountyState(state);
  const b = v.active ? lookup(v.active) : null;
  if (!b || v.progress < b.count) return { ok: false, message: 'No contract is ready to claim.' };
  const inv = Array.isArray(state.inventory) ? state.inventory : [];
  const granted = grantRewards(inv, b.items);
  if (!granted || !granted.ok) return { ok: false, message: 'The bounty clerk cannot pay out that contract right now.' };
  state.inventory = granted.inv;
  state.gold = (Number.isFinite(state.gold) ? state.gold : 0) + b.gold;
  const completed = { ...v.completed, [b.id]: (v.completed[b.id] || 0) + 1 };
  writeState(state, { active: null, progress: 0, completed });
  return { ok: true, message: `Claimed “${b.title}”: ${bountyRewardText(b)}.` };
}
