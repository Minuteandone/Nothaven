// Pick-one-of-three spoils: after certain hard-fought victories, the Finish
// panel routes to a one-time choice between three bonus bundles. Pools are
// keyed by encounterId; claiming grants one bundle and sets a per-encounter
// flag so the offer never repeats. Pure helpers only — the caller writes
// state.inventory back, mirroring the performTrade pattern.

import { getItem } from './items.js';
import { grantRewards } from './inventory.js';

const OPTION = (itemId, qty) => Object.freeze({ itemId, qty });

/** encounterId -> exactly three bundle options. Ids must exist in the item catalog. */
export const REWARD_CHOICE_POOLS = Object.freeze({
  ridge_old_tusk: Object.freeze([OPTION('rations', 3), OPTION('bandage', 2), OPTION('tin_whistle', 1)]),
  saltmere_gloomfin: Object.freeze([OPTION('field_dressing', 2), OPTION('storm_glass', 2), OPTION('storm_tonic', 1)]),
  highwatch_frostmane: Object.freeze([OPTION('hearty_chowder', 2), OPTION('relay_brass', 2), OPTION('gale_charm', 1)]),
  observatory_lenswarden: Object.freeze([OPTION('healing_herb', 2), OPTION('salvaged_wiring', 2), OPTION('lens_shard', 1)]),
  sunscar_cinderclaw: Object.freeze([OPTION('ember_broth', 1), OPTION('scrap_metal', 3), OPTION('scout_compass', 1)]),
  ridge_thunderhoof: Object.freeze([OPTION('highland_flask', 2), OPTION('thunder_iron', 2), OPTION('signal_prism', 1)]),
  highwatch_glacierward: Object.freeze([OPTION('spiced_broth', 2), OPTION('storm_glass', 3), OPTION('pearl_focus', 1)]),
  stormcrown_tyrant: Object.freeze([OPTION('tempest_salve', 1), OPTION('relay_brass', 3), OPTION('storm_lantern', 1)]),
  storm_heart_core: Object.freeze([OPTION('skyward_flask', 2), OPTION('thunder_iron', 3), OPTION('tempest_salve', 1)]),
  eye_last_squall: Object.freeze([OPTION('field_dressing', 2), OPTION('storm_glass', 3), OPTION('storm_lantern', 1)]),
  // Fixed map encounters without a spoils offer before this expansion, in zone order.
  ridge_patrol: Object.freeze([OPTION('bandage', 2), OPTION('scrap_metal', 2), OPTION('storm_tonic', 1)]),
  ridge_hound_den: Object.freeze([OPTION('rations', 3), OPTION('storm_glass', 2), OPTION('healing_herb', 1)]),
  observatory_sentinel: Object.freeze([OPTION('bandage', 3), OPTION('storm_glass', 2), OPTION('tin_whistle', 1)]),
  observatory_construct: Object.freeze([OPTION('scrap_metal', 3), OPTION('storm_tonic', 2), OPTION('healing_herb', 2)]),
  beacon_tide_wraith: Object.freeze([OPTION('storm_glass', 2), OPTION('rations', 2), OPTION('bandage', 3)]),
  saltmere_rescue: Object.freeze([OPTION('field_dressing', 2), OPTION('scrap_metal', 2), OPTION('hearty_chowder', 1)]),
  saltmere_tide_wraith: Object.freeze([OPTION('storm_glass', 3), OPTION('hearty_chowder', 2), OPTION('storm_tonic', 2)]),
  saltmere_squall_revenant: Object.freeze([OPTION('storm_glass', 2), OPTION('hearty_chowder', 2), OPTION('gale_charm', 1)]),
  highwatch_rescue: Object.freeze([OPTION('hearty_chowder', 2), OPTION('bandage', 3), OPTION('storm_glass', 2)]),
  highwatch_construct: Object.freeze([OPTION('scrap_metal', 4), OPTION('salvaged_wiring', 2), OPTION('spiced_broth', 1)]),
  highwatch_warlord: Object.freeze([OPTION('salvaged_wiring', 3), OPTION('spiced_broth', 2), OPTION('storm_glass', 3)]),
  relay_warden: Object.freeze([OPTION('relay_brass', 3), OPTION('sunscar_glass', 2), OPTION('spiced_broth', 2)]),
  sunscar_drone_patrol: Object.freeze([OPTION('relay_brass', 2), OPTION('sunscar_glass', 2), OPTION('ember_broth', 1)]),
  spire_sentry_post: Object.freeze([OPTION('thunder_iron', 2), OPTION('salvaged_wiring', 2), OPTION('spiced_broth', 2)]),
  spire_raider_camp: Object.freeze([OPTION('thunder_iron', 2), OPTION('highland_flask', 2), OPTION('storm_lantern', 1)]),
  eye_west_shade: Object.freeze([OPTION('tempest_salve', 2), OPTION('thunder_iron', 2), OPTION('storm_glass', 3)]),
  eye_east_colossus: Object.freeze([OPTION('thunder_iron', 3), OPTION('skyward_flask', 2), OPTION('tempest_salve', 2)]),
});

/** Save flag key marking a spoils choice as already claimed for an encounter. */
export function rewardChoiceFlag(encounterId) {
  return `reward_choice_${encounterId}`;
}

/**
 * The pending spoils offer for an encounter, or null when there is none
 * (unknown encounterId, or the choice was already claimed on this save).
 * Returns defensive copies so callers cannot mutate the catalog.
 */
export function rewardChoicePool(state, encounterId) {
  if (typeof encounterId !== 'string'
    || !Object.prototype.hasOwnProperty.call(REWARD_CHOICE_POOLS, encounterId)) return null;
  const claimed = state?.flags?.[rewardChoiceFlag(encounterId)] === true;
  if (claimed) return null;
  const options = REWARD_CHOICE_POOLS[encounterId].map((option) => ({ ...option }));
  return { id: encounterId, options };
}

/**
 * Accept only unambiguous bundle indexes: a finite integer number, or a
 * digits-only string (what the DOM's data-arg provides). Anything else —
 * null, '', booleans, arrays, floats, ' 0 ' — is rejected rather than
 * coerced toward 0.
 */
function parseOptionIndex(raw) {
  if (typeof raw === 'number') return Number.isInteger(raw) ? raw : NaN;
  if (typeof raw === 'string' && /^[0-9]+$/.test(raw)) return Number(raw);
  return NaN;
}

/**
 * Grant one bundle from an encounter's spoils. Atomic: either the inventory
 * write succeeds and the claimed flag is set, or nothing changes at all.
 * Returns { ok, inv?, message } — the caller must write back res.inv.
 */
export function claimRewardChoice(state, encounterId, optionIndex) {
  const pool = rewardChoicePool(state, encounterId);
  if (!pool) return { ok: false, message: 'That spoils choice is no longer available.' };
  const index = parseOptionIndex(optionIndex);
  if (!Number.isInteger(index) || index < 0 || index >= pool.options.length) {
    return { ok: false, message: 'Choose one of the offered bundles.' };
  }
  const option = pool.options[index];
  const grant = grantRewards(state.inventory || [], [{ id: option.itemId, qty: option.qty }]);
  if (!grant.ok) return { ok: false, message: grant.message || 'The spoils could not be claimed.' };
  state.inventory = grant.inv;
  state.flags = state.flags || {};
  state.flags[rewardChoiceFlag(encounterId)] = true;
  const name = getItem(option.itemId).name;
  const amount = option.qty === 1 ? '' : `${option.qty}× `;
  return { ok: true, inv: grant.inv, message: `Claimed ${amount}${name} from the spoils.` };
}
