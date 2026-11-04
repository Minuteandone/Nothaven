// Wardens' Feats: a read-only list of journey milestones computed from the
// current save. Nothing here changes state; feats are derived, never stored.
import { escapeHTML, sceneHeader, uiButton } from '../ui/components.js';
import { MAX_PARTY } from '../party/companions.js';
import { DRILL_FOES, drillRecord, gauntletRecord } from './drills.js';

const flagsOf = state => state?.story?.flags || {};
const heroOf = state => (Array.isArray(state?.party) ? state.party[0] : null) || null;
const COMMISSION_IDS = ['tamsin', 'iven', 'bram', 'sela'];

export const WANDERERS = Object.freeze(['briar_boar', 'lens_wisp', 'wrack_eel', 'rime_wight']);

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
  Object.freeze({ id: 'veteran', title: 'Veteran Warden', detail: 'Bring Wren to level 10.',
    check: s => Number(heroOf(s)?.level) >= 10 }),
  Object.freeze({ id: 'legend', title: 'Legend of Stormhaven', detail: 'Bring Wren to level 20.',
    check: s => Number(heroOf(s)?.level) >= 20 }),
]);

export function featStatus(state) {
  return FEATS.map(feat => {
    let done = false;
    try { done = Boolean(feat.check(state)); } catch { done = false; }
    return { id: feat.id, title: feat.title, detail: feat.detail, done };
  });
}

export function featsEarned(state) {
  return featStatus(state).filter(f => f.done).length;
}

const returnScene = (game, value) => ['town', 'explore'].includes(value) && game.scenes?.[value] ? value : 'town';

export const featsScene = {
  onEnter(game, data = {}) {
    game.featsReturn = returnScene(game, data.returnScene);
  },
  render(game) {
    const rows = featStatus(game.state);
    const earned = rows.filter(r => r.done).length;
    const items = rows.map(r => `<li class="feat${r.done ? ' feat--done' : ''}">
        <span class="feat__mark" aria-hidden="true">${r.done ? '✦' : '·'}</span>
        <div><h2>${escapeHTML(r.title)}</h2><p>${escapeHTML(r.detail)}</p></div>
        <span class="feat__status">${r.done ? 'Earned' : 'Not yet'}</span>
      </li>`).join('');
    return `<main class="game-shell feats">
      ${sceneHeader({ eyebrow: 'Watch House records', title: 'Wardens’ Feats', subtitle: 'Milestones of your journey across the storm frontier.', iconName: 'beacon' })}
      <section class="panel" aria-label="Feats earned">
        <p class="feats__count">${earned} of ${rows.length} feats earned</p>
        <ul class="feats__list">${items}</ul>
      </section>
      <div class="title-actions">${uiButton({ action: 'closeFeats', label: game.featsReturn === 'explore' ? 'Back to expedition' : 'Back to Greyhaven', iconName: 'compass', variant: 'primary' })}</div>
    </main>`;
  },
  actions: {
    closeFeats(game) { game.setScene(returnScene(game, game.featsReturn)); },
  },
};

export function installFeats(game) {
  game.registerScene('feats', featsScene);
}
