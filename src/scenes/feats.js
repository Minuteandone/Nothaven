// Wardens' Feats: a read-only list of journey milestones computed from the
// current save. Nothing here changes state; feats are derived, never stored.
import { escapeHTML, sceneHeader, uiButton } from '../ui/components.js';
import { ENEMIES } from '../data/enemies.js';
import { MAX_PARTY } from '../party/companions.js';
import { DRILL_FOES, drillRecord, gauntletRecord } from './drills.js';
import { ledgerOf, SERVICE_ROWS } from '../core/ledger.js';
import { FITTING_SLOTS, MAX_FITTING, fittingLevel } from '../items/forge.js';
import { BOUNTIES, bountyRank, bountyState, masteredCount, totalBountiesClaimed } from '../core/bounties.js';

const flagsOf = state => state?.story?.flags || {};
const heroOf = state => (Array.isArray(state?.party) ? state.party[0] : null) || null;
const COMMISSION_IDS = ['tamsin', 'iven', 'bram', 'sela'];

export const WANDERERS = Object.freeze(['briar_boar', 'lens_wisp', 'wrack_eel', 'rime_wight']);
export const FIELD_TRIALS = Object.freeze(['old_tusk', 'gloomfin', 'frostmane', 'lenswarden']);

export const FEATS = Object.freeze([
  Object.freeze({ id: 'first_light', title: 'First Light', detail: 'Relight the Greyhaven beacon and choose how its light is used.',
    check: s => s?.story?.stage === 'complete' || Boolean(s?.story?.ending) }),
  Object.freeze({ id: 'neighbors', title: 'Neighbors Reached', detail: 'Open the roads to both Saltmere and Highwatch.',
    check: s => Boolean(flagsOf(s).rescue_reward) }),
  Object.freeze({ id: 'relay', title: 'Signal Restored', detail: 'Bring the Sunscar Relay back online.',
    check: s => ['shelter_network', 'route_network'].includes(flagsOf(s).relay_choice) }),
  Object.freeze({ id: 'tyrant', title: 'Crown Breaker', detail: 'Defeat the Stormcrown Tyrant.',
    check: s => Boolean(flagsOf(s).victory_stormcrown_tyrant || flagsOf(s).spire_victory) }),
  Object.freeze({ id: 'summit', title: 'Above the Storm', detail: 'Report the Spire summit to Warden Mara.',
    check: s => flagsOf(s).spire_reward === true }),
  Object.freeze({ id: 'heart', title: 'Calm at the Core', detail: 'Still the Storm’s Heart.',
    check: s => flagsOf(s).victory_storm_heart === true }),
  Object.freeze({ id: 'squall', title: 'Weathered the Last Squall', detail: 'Defeat the optional Last Squall in the Storm’s Eye.',
    check: s => flagsOf(s).victory_last_squall === true }),
  Object.freeze({ id: 'watch', title: 'Keeper of the Long Watch', detail: 'Take fresh readings at the harbor lamp, the Highwatch cairn and the forecast stand, then report them to Mara.',
    check: s => flagsOf(s).watch_reward === true }),
  Object.freeze({ id: 'undaunted', title: 'Undaunted', detail: 'Win a battle after being carried home from a defeat.',
    check: s => ledgerOf(s).comebacks >= 1 }),
  Object.freeze({ id: 'steady_road', title: 'Steady Road', detail: 'Win fifteen real battles in a row without a defeat. Safe withdrawals do not break the run.',
    check: s => ledgerOf(s).bestStreak >= 15 }),
  Object.freeze({ id: 'fitted', title: 'Well Fitted', detail: 'Have the Greyhaven forge bring both the weapon and armour fittings of one party member to +3.',
    check: s => [...(Array.isArray(s?.party) ? s.party : []), ...(s?.reserve && typeof s.reserve === 'object' ? Object.values(s.reserve) : [])]
      .some(m => FITTING_SLOTS.every(slot => fittingLevel(m, slot) >= MAX_FITTING)) }),
  Object.freeze({ id: 'yard', title: 'Yard Champion', detail: 'Win a Sparring Drill against every boss in the Watch House yard.',
    check: s => DRILL_FOES.length > 0 && DRILL_FOES.every(id => drillRecord(s, id).wins >= 1) }),
  Object.freeze({ id: 'gauntlet', title: 'Unbroken Run', detail: 'Clear the full Yard Gauntlet against every yard boss without a single loss.',
    check: s => DRILL_FOES.length > 0 && gauntletRecord(s).best >= DRILL_FOES.length }),
  Object.freeze({ id: 'muster', title: 'Full Muster', detail: 'March with a full party of three.',
    check: s => Array.isArray(s?.party) && s.party.length >= MAX_PARTY }),
  Object.freeze({ id: 'commissions', title: 'Trusted by All', detail: 'Complete every companion commission.',
    check: s => COMMISSION_IDS.every(id => flagsOf(s)[`commission_${id}_reward`] === true) }),
  Object.freeze({ id: 'expeditions', title: 'Seasoned Patrols', detail: 'Complete three expedition contracts.',
    check: s => Number(s?.story?.expedition?.completed) >= 3 }),
  Object.freeze({ id: 'catalogue', title: 'Field Researcher', detail: 'Record ten different foes in the field journal.',
    check: s => Object.values(s?.bestiary && typeof s.bestiary === 'object' ? s.bestiary : {}).filter(n => Number(n) > 0).length >= 10 }),
  Object.freeze({ id: 'wanderers', title: 'Roadwise', detail: 'Defeat each of the four frontier wanderers: the Briar Boar, Lens Wisp, Wrack Eel and Rime Wight.',
    check: s => WANDERERS.every(id => Number(s?.bestiary && typeof s.bestiary === 'object' ? s.bestiary[id] : 0) > 0) }),
  Object.freeze({ id: 'tusk', title: 'Tusk Breaker', detail: 'Defeat Old Tusk, the grey king of the briar boars, on his Ridge Road ledge.',
    check: s => Number(s?.bestiary && typeof s.bestiary === 'object' ? s.bestiary.old_tusk : 0) > 0 }),
  Object.freeze({ id: 'gloomfin', title: 'Seawall Sentinel', detail: 'Drive Gloomfin, the storm-charged wrack eel, back from Saltmere’s north seawall.',
    check: s => Number(s?.bestiary && typeof s.bestiary === 'object' ? s.bestiary.gloomfin : 0) > 0 }),
  Object.freeze({ id: 'frostmane', title: 'Packbreaker', detail: 'Turn back Frostmane, the white-maned leader of the Highwatch wolf packs, at the southern bastion.',
    check: s => Number(s?.bestiary && typeof s.bestiary === 'object' ? s.bestiary.frostmane : 0) > 0 }),
  Object.freeze({ id: 'lenswarden', title: 'Vault Keeper', detail: 'Still the Lenswarden, the old opticians’ brass guardian, in the northeast vault of the Observatory Ruins.',
    check: s => Number(s?.bestiary && typeof s.bestiary === 'object' ? s.bestiary.lenswarden : 0) > 0 }),
  Object.freeze({ id: 'trials', title: 'Trial Warden', detail: 'Overcome all four optional field trials: Old Tusk, Gloomfin, Frostmane and the Lenswarden.',
    check: s => FIELD_TRIALS.every(id => Number(s?.bestiary && typeof s.bestiary === 'object' ? s.bestiary[id] : 0) > 0) }),
  Object.freeze({ id: 'veteran', title: 'Veteran Warden', detail: 'Bring Wren to level 10.',
    check: s => Number(heroOf(s)?.level) >= 10 }),
  Object.freeze({ id: 'legend', title: 'Legend of Stormhaven', detail: 'Bring Wren to level 20.',
    check: s => Number(heroOf(s)?.level) >= 20 }),
  Object.freeze({ id: 'cinderclaw', title: 'Dune Breaker', detail: 'Defeat Cinderclaw, the giant sand scorpion that waits below the Sunscar signal lift once the Spire is settled.',
    check: s => Number(s?.bestiary && typeof s.bestiary === 'object' ? s.bestiary.cinderclaw : 0) > 0 }),
  Object.freeze({ id: 'calibration', title: 'True Interval', detail: 'Carry a fresh Eye reference down to the Spire barometer and the Sunscar junction, then report Signal Calibration to Mara.',
    check: s => flagsOf(s).calibration_reward === true }),
  Object.freeze({ id: 'thunderhoof', title: 'Stampede Stopped', detail: 'Defeat Thunderhoof, the storm-charged elk that roams the ridge road once Signal Calibration is paid.',
    check: s => Number(s?.bestiary && typeof s.bestiary === 'object' ? s.bestiary.thunderhoof : 0) > 0 }),
  Object.freeze({ id: 'stormborn', title: 'Calm in the Gale', detail: 'Overcome any boss in a real battle while the Difficulty is set to Stormborn.',
    check: s => ledgerOf(s).stormbornBossVictories >= 1 }),
  Object.freeze({ id: 'glacierward', title: 'Thaw the Sentinel', detail: 'Defeat the Glacierward Colossus, the ice-plated Highwatch guardian that wakes once Signal Calibration is paid.',
    check: s => Number(s?.bestiary && typeof s.bestiary === 'object' ? s.bestiary.glacierward_colossus : 0) > 0 }),
  Object.freeze({ id: 'bounties', title: 'Every Notice Answered', detail: 'Claim every contract on the Greyhaven bounty board at least once.',
    check: s => { const done = bountyState(s).completed; return BOUNTIES.every(b => (done[b.id] || 0) >= 1); } }),
]);

const bestiaryOf = s => (s?.bestiary && typeof s.bestiary === 'object' ? s.bestiary : {});
const seen = (s, ids) => ids.filter(id => Number(bestiaryOf(s)[id]) > 0).length;
const num = v => (Number.isFinite(Number(v)) ? Math.max(0, Math.floor(Number(v))) : 0);

// Countable feats: [have, need] for a "Progress: a of b." hint on feats not yet earned.
export const FEAT_PROGRESS = Object.freeze({
  steady_road: s => [num(ledgerOf(s).bestStreak), 15],
  yard: s => [DRILL_FOES.filter(id => drillRecord(s, id).wins >= 1).length, DRILL_FOES.length],
  gauntlet: s => [num(gauntletRecord(s).best), DRILL_FOES.length],
  muster: s => [Array.isArray(s?.party) ? s.party.length : 0, MAX_PARTY],
  commissions: s => [COMMISSION_IDS.filter(id => flagsOf(s)[`commission_${id}_reward`] === true).length, COMMISSION_IDS.length],
  expeditions: s => [num(s?.story?.expedition?.completed), 3],
  catalogue: s => [Object.values(bestiaryOf(s)).filter(n => Number(n) > 0).length, 10],
  wanderers: s => [seen(s, WANDERERS), WANDERERS.length],
  trials: s => [seen(s, FIELD_TRIALS), FIELD_TRIALS.length],
  veteran: s => [num(heroOf(s)?.level), 10],
  legend: s => [num(heroOf(s)?.level), 20],
  fitted: s => [[...(Array.isArray(s?.party) ? s.party : []), ...(s?.reserve && typeof s.reserve === 'object' ? Object.values(s.reserve) : [])]
    .reduce((best, m) => Math.max(best, FITTING_SLOTS.reduce((t, slot) => t + Math.min(num(fittingLevel(m, slot)), MAX_FITTING), 0)), 0),
    FITTING_SLOTS.length * MAX_FITTING],
  bounties: s => { const done = bountyState(s).completed; return [BOUNTIES.filter(b => (done[b.id] || 0) >= 1).length, BOUNTIES.length]; },
});

// "Progress: a of b." for a countable feat (have capped at need); null for other or malformed feats.
function featProgressPair(state, id) {
  const fn = Object.prototype.hasOwnProperty.call(FEAT_PROGRESS, id) ? FEAT_PROGRESS[id] : null;
  if (!fn) return null;
  let pair;
  try { pair = fn(state); } catch { return null; }
  const need = num(pair?.[1]);
  if (need <= 0) return null;
  return [Math.min(num(pair?.[0]), need), need];
}

export function featProgressText(state, id) {
  const pair = featProgressPair(state, id);
  return pair ? `Progress: ${pair[0]} of ${pair[1]}.` : null;
}

// Unearned countable feat with the highest share of its target already reached (list order breaks ties); null if none has started.
export function closestFeatText(state, rows = featStatus(state)) {
  let best = null;
  for (const r of rows) {
    if (r.done) continue;
    const pair = featProgressPair(state, r.id);
    if (!pair || pair[0] <= 0 || pair[0] >= pair[1]) continue;
    const share = pair[0] / pair[1];
    if (!best || share > best.share) best = { title: r.title, have: pair[0], need: pair[1], share };
  }
  return best ? `Closest to earning: ${best.title} (${best.have} of ${best.need}).` : null;
}

export function featStatus(state) {
  return FEATS.map(feat => {
    let done = false;
    try { done = Boolean(feat.check(state)); } catch { done = false; }
    return { id: feat.id, title: feat.title, detail: feat.detail, done };
  });
}

// Feats a real victory over this foe would earn right now: replays the field-journal entry the win
// records (bestiary count + 1) and lists unearned feats that flip to earned. Drills record nothing, so null.
export function featCombatText(state, combat) {
  if (!state || !combat || combat.drill === true) return null;
  const id = combat.enemy?.id;
  if (typeof id !== 'string' || !Object.prototype.hasOwnProperty.call(ENEMIES, id)) return null;
  const book = state.bestiary && typeof state.bestiary === 'object' && !Array.isArray(state.bestiary) ? state.bestiary : {};
  const prev = Object.prototype.hasOwnProperty.call(book, id) && Number.isInteger(book[id]) && book[id] > 0 ? book[id] : 0;
  const before = featStatus(state);
  const after = featStatus({ ...state, bestiary: { ...book, [id]: prev + 1 } });
  const gained = after.filter((f, i) => f.done && !before[i].done).map(f => `“${f.title}”`);
  if (!gained.length) return null;
  const list = gained.length === 1 ? gained[0] : `${gained.slice(0, -1).join(', ')} and ${gained[gained.length - 1]}`;
  return `Winning this battle earns ${list}.`;
}

// Titles of feats that are done in `after` but were not done in `before` (FEATS order).
// Both arguments are featStatus() rows; anything malformed yields an empty list.
export function newlyEarnedFeats(before, after) {
  if (!Array.isArray(before) || !Array.isArray(after)) return [];
  const had = new Set(before.filter(f => f && f.done).map(f => f.id));
  return after.filter(f => f && f.done && !had.has(f.id)).map(f => String(f.title));
}

export function featsEarned(state) {
  return featStatus(state).filter(f => f.done).length;
}

// The first feat (in list order) not yet earned, as a one-line pointer; null when all are earned.
export function nextFeatText(state) {
  const next = featStatus(state).find(f => !f.done);
  return next ? `Next unearned feat: ${next.title} — ${next.detail}` : null;
}

// Town-square progress line: earned count plus the next unearned feat's title; null before the first feat.
export function townFeatsText(state, rows = featStatus(state)) {
  const earned = rows.filter(f => f.done).length;
  if (earned === 0) return null;
  const next = rows.find(f => !f.done);
  const head = `Wardens’ Feats: ${earned} of ${rows.length} earned.`;
  return next ? `${head} Next: ${next.title}.` : `${head} Every feat earned.`;
}

export const FEAT_FILTERS = ['all', 'earned', 'pending'];
const FEAT_FILTER_LABELS = { all: 'All', earned: 'Earned', pending: 'Not yet' };
const FEAT_FILTER_EMPTY = { earned: 'No feats earned yet. Your first victories will start this list.', pending: 'Every feat is earned. The whole frontier knows your name.' };

export function featFilterOf(value) {
  return FEAT_FILTERS.includes(value) ? value : 'all';
}

export function filterFeatRows(rows, filter) {
  const f = featFilterOf(filter);
  const list = Array.isArray(rows) ? rows : [];
  if (f === 'earned') return list.filter(r => r?.done === true);
  if (f === 'pending') return list.filter(r => r?.done !== true);
  return list.slice();
}

const returnScene = (game, value) => ['town', 'explore'].includes(value) && game.scenes?.[value] ? value : 'town';

export const featsScene = {
  onEnter(game, data = {}) {
    game.featsReturn = returnScene(game, data.returnScene);
    game.featsFilter = 'all';
  },
  render(game) {
    const rows = featStatus(game.state);
    const earned = rows.filter(r => r.done).length;
    const nextFeat = nextFeatText(game.state);
    const closest = closestFeatText(game.state, rows);
    const ledger = ledgerOf(game.state);
    const record = SERVICE_ROWS.map(r => `<div><dt>${escapeHTML(r.label)}</dt><dd>${escapeHTML(String(ledger[r.key]))}</dd></div>`).join('');
    const bountyRecord = `<div><dt>Bounties claimed</dt><dd>${escapeHTML(String(totalBountiesClaimed(game.state)))}</dd></div>`;
    const boardRank = bountyRank(game.state).rank;
    const rankRecord = `<div><dt>Board rank</dt><dd>${escapeHTML(boardRank.title)}</dd></div>`;
    const masteryRecord = `<div><dt>Contracts mastered</dt><dd>${escapeHTML(`${masteredCount(game.state)} of ${BOUNTIES.length}`)}</dd></div>`;
    const filter = featFilterOf(game.featsFilter);
    const shown = filterFeatRows(rows, filter);
    const filters = FEAT_FILTERS.map(id => `<button type="button" class="action-button action-button--ghost" data-action="filterFeats" data-arg="${id}" aria-pressed="${id === filter}">${escapeHTML(`${FEAT_FILTER_LABELS[id]} (${filterFeatRows(rows, id).length})`)}</button>`).join('');
    const items = shown.map(r => `<li class="feat${r.done ? ' feat--done' : ''}">
        <span class="feat__mark" aria-hidden="true">${r.done ? '✦' : '·'}</span>
        <div><h2>${escapeHTML(r.title)}</h2><p>${escapeHTML(r.detail)}</p>${!r.done && featProgressText(game.state, r.id) ? `<p class="feat__progress">${escapeHTML(featProgressText(game.state, r.id))}</p>` : ''}</div>
        <span class="feat__status">${r.done ? 'Earned' : 'Not yet'}</span>
      </li>`).join('');
    return `<main class="game-shell feats">
      ${sceneHeader({ eyebrow: 'Watch House records', title: 'Wardens’ Feats', subtitle: 'Milestones of your journey across the storm frontier.', iconName: 'beacon' })}
      <section class="panel" aria-label="Feats earned">
        <p class="feats__count">${escapeHTML(`${earned} of ${rows.length} feats earned`)}</p>
        ${nextFeat ? `<p class="feats__next">${escapeHTML(nextFeat)}</p>` : ''}
        ${closest ? `<p class="feats__closest">${escapeHTML(closest)}</p>` : ''}
        <div class="feats__filters" role="group" aria-label="Show feats">${filters}</div>
        ${shown.length ? `<ul class="feats__list">${items}</ul>` : `<p class="feats__empty">${escapeHTML(FEAT_FILTER_EMPTY[filter] || '')}</p>`}
      </section>
      <section class="panel service-record" aria-labelledby="service-record-title">
        <h2 id="service-record-title">Service record</h2>
        <p class="service-record__note">Real battles only; Sparring Drills are not counted.</p>
        <dl class="service-record__list">${record}${bountyRecord}${rankRecord}${masteryRecord}</dl>
      </section>
      <div class="title-actions">${uiButton({ action: 'closeFeats', label: game.featsReturn === 'explore' ? 'Back to expedition' : 'Back to Greyhaven', iconName: 'compass', variant: 'primary' })}</div>
    </main>`;
  },
  actions: {
    filterFeats(game, el) {
      game.featsFilter = featFilterOf(el?.dataset?.arg);
    },
    closeFeats(game) { delete game.featsFilter; game.setScene(returnScene(game, game.featsReturn)); },
  },
};

export function installFeats(game) {
  game.registerScene('feats', featsScene);
}
