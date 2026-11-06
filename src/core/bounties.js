// Greyhaven bounty board: repeatable hunt contracts against roaming foes.
// A contract opens once its foe appears in the Field Journal. One contract is
// active at a time; only real victories count (drills never emit combat:victory).
import { ENEMIES } from '../data/enemies.js';
import { grantRewards } from '../items/inventory.js';
import { getItem } from '../items/items.js';
import { ZONES, ZONE_ORDER } from '../map/zones.js';

export const BOUNTIES = Object.freeze([
  Object.freeze({ id: 'ridge_rats', title: 'Ridge Road Rat Cull', enemyId: 'storm_rat', count: 4, gold: 30, items: Object.freeze([{ id: 'scrap_metal', qty: 1 }]),
    brief: 'Storm rats are chewing through the relief carts’ harness straps on the Ridge Road.' }),
  Object.freeze({ id: 'howling_pass', title: 'Hounds on the Wind', enemyId: 'gale_hound', count: 3, gold: 35, items: Object.freeze([{ id: 'scrap_metal', qty: 1 }]),
    brief: 'Gale hounds run the exposed stretches of road, spooking the cart horses whenever the wind turns.' }),
  Object.freeze({ id: 'bandit_toll', title: 'Bandit Toll Road', enemyId: 'ridge_bandit', count: 3, gold: 40, items: Object.freeze([{ id: 'scrap_metal', qty: 2 }]),
    brief: 'Bandits are charging travellers a “storm toll” at the switchbacks. Persuade them to stop.' }),
  Object.freeze({ id: 'stray_lights', title: 'Stray Lens Lights', enemyId: 'lens_wisp', count: 3, gold: 45, items: Object.freeze([{ id: 'storm_glass', qty: 1 }]),
    brief: 'Lens wisps drift out of the Observatory Ruins and lure lamplighters off the safe path.' }),
  Object.freeze({ id: 'hedgerow_boars', title: 'Boars in the Hedgerows', enemyId: 'briar_boar', count: 3, gold: 50, items: Object.freeze([{ id: 'scrap_metal', qty: 1 }]),
    brief: 'Briar boars are tearing up the Ridge Road hedgerows that shelter the relief carts from the wind.' }),
  Object.freeze({ id: 'rusted_watchmen', title: 'Rusted Watchmen', enemyId: 'rust_sentinel', count: 2, gold: 55, items: Object.freeze([{ id: 'scrap_metal', qty: 2 }]),
    brief: 'Rust sentinels still patrol the observatory ruins and turn back the scholars sent to study them.' }),
  Object.freeze({ id: 'pier_clearance', title: 'Pier Clearance', enemyId: 'reef_crawler', count: 3, gold: 60, items: Object.freeze([{ id: 'salvaged_wiring', qty: 2 }]),
    brief: 'Reef crawlers have claimed the Saltmere loading piers. The supply boats need them back.' }),
  Object.freeze({ id: 'kelp_tangle', title: 'Eels in the Kelp', enemyId: 'wrack_eel', count: 3, gold: 62, items: Object.freeze([{ id: 'salvaged_wiring', qty: 1 }]),
    brief: 'Wrack eels lurk in the kelp beds off Saltmere and drag the fishing lines under.' }),
  Object.freeze({ id: 'wolf_trail', title: 'Wolves on the Pass', enemyId: 'frost_wolf', count: 3, gold: 65, items: Object.freeze([{ id: 'scrap_metal', qty: 2 }]),
    brief: 'A frost wolf pack shadows every runner crossing Highwatch Pass.' }),
  Object.freeze({ id: 'drowned_watch', title: 'The Drowned Watch', enemyId: 'squall_revenant', count: 3, gold: 70, items: Object.freeze([{ id: 'salvaged_wiring', qty: 1 }]),
    brief: 'Squall revenants walk the Saltmere tideline at dusk, calling out the names of lost crews.' }),
  Object.freeze({ id: 'cold_cairns', title: 'Cold Cairns', enemyId: 'rime_wight', count: 3, gold: 75, items: Object.freeze([{ id: 'storm_glass', qty: 1 }]),
    brief: 'Rime wights gather at the Highwatch cairns and smother the signal fires before they catch.' }),
  Object.freeze({ id: 'upper_route', title: 'Rubble on the Upper Route', enemyId: 'rockslide_golem', count: 2, gold: 80, items: Object.freeze([{ id: 'relay_brass', qty: 1 }]),
    brief: 'Rockslide golems keep burying the upper route faster than crews can dig it out.' }),
  Object.freeze({ id: 'relay_raiders', title: 'Relay Road Raiders', enemyId: 'dust_marauder', count: 3, gold: 120, items: Object.freeze([{ id: 'sunscar_glass', qty: 1 }]),
    brief: 'Dust marauders strip copper from the Sunscar line as soon as it is repaired.' }),
  Object.freeze({ id: 'static_drones', title: 'Static on the Relay', enemyId: 'relay_drone', count: 2, gold: 130, items: Object.freeze([{ id: 'relay_brass', qty: 1 }]),
    brief: 'Relay drones fill the Sunscar line with static, garbling every message the keepers send.' }),
  Object.freeze({ id: 'ash_survey', title: 'Ash on the Survey Line', enemyId: 'ashen_raider', count: 2, gold: 140, items: Object.freeze([{ id: 'sunscar_glass', qty: 1 }]),
    brief: 'Ashen raiders pick through the Stormcrown ruins and ambush the survey crews mapping them.' }),
  Object.freeze({ id: 'silent_sentries', title: 'Silence the Sentries', enemyId: 'spire_sentry', count: 2, gold: 160, items: Object.freeze([{ id: 'relay_brass', qty: 2 }]),
    brief: 'Spire sentries still challenge anyone on the Stormcrown stairs, long after their masters fell.' }),
  Object.freeze({ id: 'vortex_shades', title: 'Shades in the Vortex', enemyId: 'tempest_shade', count: 2, gold: 220, items: Object.freeze([{ id: 'storm_glass', qty: 2 }]),
    brief: 'Tempest shades linger in the Storm’s Heart and stir up squalls over the coast.' }),
  Object.freeze({ id: 'colossus_thunder', title: 'Thunder over the Eye', enemyId: 'thunderhead_colossus', count: 2, gold: 260, items: Object.freeze([{ id: 'relay_brass', qty: 2 }, { id: 'storm_glass', qty: 1 }]),
    brief: 'Thunderhead colossi grind across the Storm’s Heart, and every step rolls thunder down to the coast.' }),
]);

export function bountyRewardText(b, gold = b.gold) {
  const parts = [`${gold} gold`];
  for (const it of b.items) { let name = it.id; try { name = getItem(it.id).name; } catch { /* unknown id */ } parts.push(`${it.qty}× ${name}`); }
  return parts.join(', ');
}

export const getBounty = (id) => BOUNTIES.find((b) => b.id === id) || null;

// Board ranks: claiming more contracts raises the gold every contract pays.
export const BOUNTY_RANKS = Object.freeze([
  Object.freeze({ id: 'runner', title: 'Notice Runner', min: 0, bonus: 0 }),
  Object.freeze({ id: 'hand', title: 'Contract Hand', min: 3, bonus: 0.1 }),
  Object.freeze({ id: 'regular', title: 'Board Regular', min: 8, bonus: 0.2 }),
  Object.freeze({ id: 'tracker', title: 'Ridge Tracker', min: 15, bonus: 0.3 }),
  Object.freeze({ id: 'warden', title: 'Warden of the Board', min: 25, bonus: 0.4 }),
]);

export function bountyRank(state) {
  const total = totalBountiesClaimed(state);
  let i = 0;
  while (i + 1 < BOUNTY_RANKS.length && total >= BOUNTY_RANKS[i + 1].min) i += 1;
  const next = BOUNTY_RANKS[i + 1] || null;
  return { rank: BOUNTY_RANKS[i], next, total, toNext: next ? next.min - total : 0 };
}

// Urgent notice: one contract at a time pays a premium on top of rank. It
// rotates by a fixed stride after every claim (7 is coprime with 18, so all
// contracts take a turn) and never depends on unlocks, so it stays put while
// a contract is being worked.
export const URGENT_BONUS = 0.25;
export function urgentBountyId(state) {
  return BOUNTIES[(totalBountiesClaimed(state) * 7 + 5) % BOUNTIES.length].id;
}

export function bountyPay(state, b) {
  const urgent = b.id === urgentBountyId(state) ? Math.floor(b.gold * URGENT_BONUS) : 0;
  return b.gold + Math.floor(b.gold * bountyRank(state).rank.bonus) + urgent;
}

export function urgentBountyText(state) {
  const b = getBounty(urgentBountyId(state));
  const pct = `+${Math.round(URGENT_BONUS * 100)}% gold`;
  return bountyUnlocked(state, b.id)
    ? `Urgent notice: “${b.title}” pays ${pct} until the next claim.`
    : `Urgent notice: an unposted contract pays ${pct} until the next claim — meet new foes in the wilds to open it.`;
}

/** Claims of one contract needed before it counts as mastered. */
export const MASTERY_CLAIMS = 3;
export function bountyMastered(state, id) {
  return (bountyState(state).completed[id] || 0) >= MASTERY_CLAIMS;
}
/** Items a claim pays now: a mastered contract adds one more of its first item. */
export function bountyItems(state, b) {
  const items = b.items.map((it) => ({ id: it.id, qty: it.qty }));
  if (items.length && bountyMastered(state, b.id)) items[0].qty += 1;
  return items;
}
function firstItemName(b) {
  const id = b.items[0]?.id;
  if (!id) return '';
  try { return getItem(id).name; } catch { return id; }
}
export function masteredCount(state) {
  return BOUNTIES.filter((b) => bountyMastered(state, b.id)).length;
}
export function masteryText(state) {
  return `Contracts mastered: ${masteredCount(state)} of ${BOUNTIES.length}. A contract is mastered after ${MASTERY_CLAIMS} claims and then pays one extra of its first item.`;
}

export function bountyRankText(state) {
  const { rank, next, toNext } = bountyRank(state);
  const pct = (r) => `+${Math.round(r.bonus * 100)}% gold`;
  const here = `Board rank: ${rank.title} (${pct(rank)}).`;
  return next
    ? `${here} ${toNext} more ${toNext === 1 ? 'claim' : 'claims'} to ${next.title} (${pct(next)}).`
    : `${here} The highest rank on the board.`;
}
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

// Region names (in journey order) where a foe turns up as a roaming encounter.
export function bountyHabitats(enemyId) {
  return ZONE_ORDER
    .filter((id) => Array.isArray(ZONES[id]?.randomEncounters)
      && ZONES[id].randomEncounters.some((r) => r?.enemyId === enemyId))
    .map((id) => ZONES[id].name);
}

export function bountyRows(state) {
  const v = bountyState(state);
  return BOUNTIES.map((b) => ({
    ...b,
    pay: bountyPay(state, b),
    foe: ENEMIES[b.enemyId]?.name || b.enemyId,
    roams: bountyHabitats(b.enemyId),
    unlocked: bountyUnlocked(state, b.id),
    active: v.active === b.id,
    progress: v.active === b.id ? v.progress : 0,
    ready: v.active === b.id && v.progress >= b.count,
    claimed: v.completed[b.id] || 0,
    urgent: b.id === urgentBountyId(state),
    mastered: bountyMastered(state, b.id),
    rewardItems: bountyItems(state, b),
    rewardName: firstItemName(b),
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
  const mastered = bountyMastered(state, b.id) && b.items.length > 0;
  const items = mastered ? bountyItems(state, b) : b.items;
  const granted = grantRewards(inv, items);
  if (!granted || !granted.ok) return { ok: false, message: 'The bounty clerk cannot pay out that contract right now.' };
  const before = bountyRank(state).rank;
  const urgent = b.id === urgentBountyId(state) ? ' Urgent notice premium included.' : '';
  const gold = bountyPay(state, b);
  state.inventory = granted.inv;
  state.gold = (Number.isFinite(state.gold) ? state.gold : 0) + gold;
  const completed = { ...v.completed, [b.id]: (v.completed[b.id] || 0) + 1 };
  writeState(state, { active: null, progress: 0, completed });
  const after = bountyRank(state).rank;
  const promoted = after.id !== before.id ? ` Board rank raised to ${after.title}.` : '';
  const mastery = mastered ? ` Mastery bonus: +1 ${firstItemName(b)}.` : '';
  const newly = !mastered && completed[b.id] === MASTERY_CLAIMS ? ` “${b.title}” is now mastered: future claims pay one extra of its first item.` : '';
  return { ok: true, message: `Claimed “${b.title}”: ${bountyRewardText({ ...b, items }, gold)}.${urgent}${mastery}${newly}${promoted}` };
}
