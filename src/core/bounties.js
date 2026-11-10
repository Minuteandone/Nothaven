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

/** Field Journal line for one foe: its board contract and your record on it; null when no contract targets it. */
export function bountyJournalText(state, enemyId) {
  const b = BOUNTIES.find((x) => x.enemyId === enemyId);
  if (!b) return null;
  const v = bountyState(state);
  const n = v.completed[b.id] || 0;
  let text = `Board contract: “${b.title}” (defeat ${b.count}).`;
  text += n > 0 ? ` Claimed ${n} ${n === 1 ? 'time' : 'times'}.` : ' Not yet claimed.';
  if (n >= MASTERY_CLAIMS) text += ' Mastered.';
  if (v.active === b.id) text += ` Active now: ${v.progress} of ${b.count}.`;
  return text;
}

/** Journal line: lifetime claims, rank and mastery; null before the first claim. */
export function bountyRecordText(state) {
  const total = totalBountiesClaimed(state);
  if (total < 1) return null;
  const { rank } = bountyRank(state);
  return `Board record: ${total} ${total === 1 ? 'claim' : 'claims'} · ${rank.title} · ${masteredCount(state)} of ${BOUNTIES.length} contracts mastered · ${marksEarnedText(boardMarks(state).earned)}.`;
}

function marksEarnedText(n) {
  return `${n} Board ${n === 1 ? 'Mark' : 'Marks'} earned`;
}

/** Town-square rank line: null before the first claim. */
export function townBoardRankText(state) {
  return totalBountiesClaimed(state) > 0 ? bountyRankText(state) : null;
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
  const spent = Math.min(count(raw.spent), earnedMarks(completed));
  return { active, progress, completed, spent };
}

function writeState(state, view) {
  state.bounties = { active: view.active, progress: view.progress, completed: { ...view.completed }, spent: count(view.spent) };
  return state.bounties;
}

/**
 * In-battle note when the foe is the active contract's target and the contract
 * still needs kills. Returns null otherwise (no contract, other foe, complete).
 */
export function bountyCombatText(state, enemyId) {
  const view = bountyState(state);
  const b = getBounty(view.active);
  if (!b || typeof enemyId !== 'string' || b.enemyId !== enemyId || view.progress >= b.count) return null;
  const next = view.progress + 1;
  return next >= b.count
    ? `“${b.title}” — ${view.progress}/${b.count} defeated; winning this battle completes the contract.`
    : `“${b.title}” — ${view.progress}/${b.count} defeated; winning this battle makes it ${next}/${b.count}.`;
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

/**
 * Town-square line shown when no contract is active: names the urgent notice
 * (or says it is unposted) and any Board Marks waiting to be spent. Null until
 * the board has at least one posted contract, or while a contract is active.
 */
export function bountyIdleText(state) {
  if (getBounty(bountyState(state).active)) return null;
  if (!BOUNTIES.some((b) => bountyUnlocked(state, b.id))) return null;
  const urgent = getBounty(urgentBountyId(state));
  const pct = `+${Math.round(URGENT_BONUS * 100)}% gold`;
  const notice = bountyUnlocked(state, urgent.id)
    ? `“${urgent.title}” is urgent (${pct}).`
    : `The urgent notice is still unposted.`;
  const available = boardMarks(state).available;
  const marks = available > 0 ? ` ${marksWord(available)} to spend at the Exchange.` : '';
  return `Bounty board: no contract taken. ${notice}${marks}`;
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
  writeState(state, { active: null, progress: 0, completed, spent: v.spent });
  const after = bountyRank(state).rank;
  const promoted = after.id !== before.id ? ` Board rank raised to ${after.title}.` : '';
  const mastery = mastered ? ` Mastery bonus: +1 ${firstItemName(b)}.` : '';
  const newly = !mastered && completed[b.id] === MASTERY_CLAIMS ? ` “${b.title}” is now mastered: future claims pay one extra of its first item.` : '';
  const marks = markValue(b.id);
  const markLine = ` +${marks} Board ${marks === 1 ? 'Mark' : 'Marks'}.`;
  return { ok: true, message: `Claimed “${b.title}”: ${bountyRewardText({ ...b, items }, gold)}.${markLine}${urgent}${mastery}${newly}${promoted}` };
}

// Board Exchange: every claim also earns Board Marks, spent on supplies at the board.
// Marks are derived from claim counts, so only the amount spent is stored.
/** Marks one claim of a contract earns: 1 for the first six postings, 2 for the next six, 3 for the rest. */
export function markValue(id) {
  const i = BOUNTIES.findIndex((b) => b.id === id);
  return i < 0 ? 0 : i < 6 ? 1 : i < 12 ? 2 : 3;
}
function earnedMarks(completed) {
  return Object.entries(completed).reduce((sum, [id, n]) => sum + markValue(id) * n, 0);
}
/** {earned, spent, available} Board Marks for this save. */
export function boardMarks(state) {
  const v = bountyState(state);
  const earned = earnedMarks(v.completed);
  return { earned, spent: v.spent, available: earned - v.spent };
}
export const EXCHANGE_OFFERS = Object.freeze([
  Object.freeze({ id: 'dressings', itemId: 'field_dressing', qty: 2, cost: 2 }),
  Object.freeze({ id: 'flask', itemId: 'highland_flask', qty: 1, cost: 3 }),
  Object.freeze({ id: 'broth', itemId: 'spiced_broth', qty: 1, cost: 4 }),
  Object.freeze({ id: 'glass', itemId: 'storm_glass', qty: 1, cost: 5 }),
  Object.freeze({ id: 'brass', itemId: 'relay_brass', qty: 1, cost: 7 }),
  Object.freeze({ id: 'sunscar', itemId: 'sunscar_glass', qty: 1, cost: 8 }),
  Object.freeze({ id: 'iron', itemId: 'thunder_iron', qty: 1, cost: 9 }),
]);
export const getExchangeOffer = (id) => EXCHANGE_OFFERS.find((o) => o.id === id) || null;
/** Wardens of the Board pay this many marks less for every offer. */
export const WARDEN_EXCHANGE_DISCOUNT = 1;
/** Marks this save pays for an offer: list price, less the Warden discount (never below 1). */
export function exchangeCost(state, o) {
  const discount = bountyRank(state).rank.id === 'warden' ? WARDEN_EXCHANGE_DISCOUNT : 0;
  return Math.max(1, o.cost - discount);
}
const marksWord = (n) => `${n} Board ${n === 1 ? 'Mark' : 'Marks'}`;
export function exchangeOfferText(o, cost = o.cost) {
  return `${o.qty}× ${getItem(o.itemId)?.name || o.itemId} for ${cost} ${cost === 1 ? 'mark' : 'marks'}`;
}
/** "In pack: N." — how many of an offer's item the pack already holds. */
export function exchangeOwnedText(state, o) {
  const inv = Array.isArray(state?.inventory) ? state.inventory : [];
  const id = o?.itemId;
  let n = 0;
  for (const e of inv) if (e && e.id === id && Number.isFinite(e.qty) && e.qty > 0) n += Math.floor(e.qty);
  return `In pack: ${n}.`;
}

/** How many offers the available marks cover, and how far off the cheapest one out of reach is. */
export function exchangeAffordText(state) {
  const { available } = boardMarks(state);
  const have = Number.isFinite(available) && available > 0 ? available : 0;
  const costs = EXCHANGE_OFFERS.map((o) => ({ o, cost: exchangeCost(state, o) }));
  const n = costs.filter((c) => c.cost <= have).length;
  const total = EXCHANGE_OFFERS.length;
  if (n === total) return `You can afford every offer (${total} of ${total}).`;
  const next = costs.filter((c) => c.cost > have).sort((a, b) => a.cost - b.cost)[0];
  const short = next.cost - have;
  return `You can afford ${n} of ${total} offers. Cheapest out of reach: ${getItem(next.o.itemId)?.name || next.o.itemId} at ${next.cost} ${next.cost === 1 ? 'mark' : 'marks'} (${short} more needed).`;
}

export function exchangePerkText(state) {
  const { rank, total } = bountyRank(state);
  if (rank.id === 'warden') return `Warden of the Board: every offer costs ${WARDEN_EXCHANGE_DISCOUNT} mark less.`;
  const warden = BOUNTY_RANKS.find((r) => r.id === 'warden');
  const left = warden.min - total;
  return `Reach Warden of the Board (${left} more ${left === 1 ? 'claim' : 'claims'}) and every offer costs ${WARDEN_EXCHANGE_DISCOUNT} mark less.`;
}
/** "Board Marks: N available (E earned, S spent)." */
export function boardMarksText(state) {
  const m = boardMarks(state);
  return `Board Marks: ${m.available} available (${m.earned} earned, ${m.spent} spent).`;
}
/** Trade marks for an offer. Writes nothing unless the whole exchange succeeds. */
export function exchangeMarks(state, offerId) {
  const o = getExchangeOffer(offerId);
  if (!o) return { ok: false, message: 'The clerk does not stock that.' };
  const m = boardMarks(state);
  const cost = exchangeCost(state, o);
  if (m.available < cost) return { ok: false, message: `You need ${marksWord(cost)} for that; you have ${m.available}.` };
  const inv = Array.isArray(state.inventory) ? state.inventory : [];
  const granted = grantRewards(inv, [{ id: o.itemId, qty: o.qty }]);
  if (!granted || !granted.ok) return { ok: false, message: 'Your pack cannot hold that right now.' };
  const v = bountyState(state);
  state.inventory = granted.inv;
  writeState(state, { ...v, spent: v.spent + cost });
  return { ok: true, message: `Exchanged ${marksWord(cost)} for ${o.qty}× ${getItem(o.itemId)?.name || o.itemId}. ${m.available - cost} left.` };
}
