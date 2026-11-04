import { relayAftermath } from './relay.js';

export const SPIRE_GOLD = 150;
export function spireAvailable(story) {
  return story?.stage === 'complete' && ['shelter_network', 'route_network'].includes(story.flags?.relay_choice);
}
export function spireReady(story) {
  const f = story?.flags || {};
  return Boolean(spireAvailable(story) && f.spire_accepted && f.spire_visit && f.survey_records_a
    && f.survey_records_b && f.spire_victory && f.spire_summit);
}
export function spireAftermath(story) {
  return `${relayAftermath(story)} The summit instruments no longer feed the Tyrant’s storm. Recovered survey records let the settlements forecast dangerous weather together. The expedition board is open; keeping the roads safe remains a shared task.`;
}

/** Preserve early facts; only an explicit report pays the commission. */
export function applySpireEvent(previous, event) {
  const state = { ...previous, flags: { ...previous.flags } };
  const f = state.flags, rewards = [], log = [];
  if (!event || typeof event !== 'object') return { state, rewards, log };
  if (event.type === 'visit' && event.locationId === 'stormcrown_spire') f.spire_visit = true;
  if (event.type === 'victory' && event.encounterId === 'stormcrown_tyrant') f.spire_victory = true;
  if (event.type === 'interact' && ['survey_records_a', 'survey_records_b', 'spire_summit'].includes(event.interactionId)) f[event.interactionId] = true;
  if (event.type === 'spire-accept' && spireAvailable(state) && !f.spire_accepted) {
    f.spire_accepted = true;
    log.push('Mara commissions a survey of Stormcrown Spire. Recover both storm-survey records, defeat the Tyrant, and inspect the summit instruments. Bring your findings home; the council will fund a permanent expedition board.');
  }
  if (event.type === 'spire-report' && spireReady(state) && !f.spire_reward) {
    f.spire_reward = true;
    rewards.push({ id: 'spire_reward', gold: SPIRE_GOLD });
    log.push(`Received ${SPIRE_GOLD} gold for the summit survey.`, spireAftermath(state));
  }
  return { state, rewards, log };
}

export function getSpireJournal(story) {
  if (!spireAvailable(story)) return [];
  const f = story.flags;
  const objective = f.spire_reward ? spireAftermath(story)
    : !f.spire_accepted ? `Accept Mara’s summit survey in Greyhaven. Recovering both records and securing the summit earns ${SPIRE_GOLD} gold and opens the repeatable expedition board.`
    : !f.spire_visit ? 'Follow Highwatch’s East Gate to Sunscar Relay, then take the northeastern Spire Switchback to Stormcrown Spire.'
    : !f.survey_records_a || !f.survey_records_b ? `Recover the storm-survey records: ${[!f.survey_records_a && 'the northwest archive', !f.survey_records_b && 'the eastern observation station'].filter(Boolean).join(' and ')}. Prepare your party at the Stormcrown Trading Post before the summit battle.`
    : !f.spire_victory ? 'Defeat the Stormcrown Tyrant guarding the summit. Bring companions, upgraded equipment, and remedies for shock.'
    : !f.spire_summit ? 'Inspect the summit instruments beyond the defeated Tyrant.'
    : `Return to Greyhaven and report the summit survey to Mara for ${SPIRE_GOLD} gold. Speaking alone does not submit the report.`;
  return [{ id: 'spire', title: 'Above the Gathering Storm', status: f.spire_reward ? 'complete' : 'active', objective }];
}

export function getSpireDialogue(story, npcId) {
  if (!spireAvailable(story)) return null;
  const f = story.flags;
  if (npcId === 'mara') return { speaker: 'Warden Mara', choices: [], text: f.spire_reward ? spireAftermath(story)
    : !f.spire_accepted ? `${relayAftermath(story)} The relay has traced the violent weather to Stormcrown Spire. Accept the summit survey when your party is ready.`
    : spireReady(story) ? 'You have the records and a clear summit. Submit the survey report here, and we can put those findings to work for every settlement.'
    : 'Bring both survey records home, and make sure the summit instruments can no longer serve the Tyrant. We need knowledge as much as victory.' };
  if (npcId === 'iven') return { speaker: 'Iven, Beacon Apprentice', choices: [], text: f.spire_reward
    ? 'The old instruments measured storms before the Tyrant turned them into weapons. Now Saltmere and Highwatch can read the same forecasts as Greyhaven.'
    : 'There are two survey stations on the spire: one northwest, one east. Compare their records, then inspect the summit instruments after the battle.' };
  if (npcId === 'tamsin') return { speaker: 'Tamsin, Route Scout', choices: [], text: f.spire_reward
    ? 'The expedition board pays for new patrol victories, not stories of old ones. Choose a contract in Greyhaven, patrol the named region, and return to claim your pay.'
    : 'Look for the Spire Switchback northeast of Sunscar Relay. Rest before the ascent; the summit is no place to discover your supplies are gone.' };
  return null;
}
