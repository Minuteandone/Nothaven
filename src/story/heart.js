import { spireAftermath } from './spire.js';

export const HEART_GOLD = 200;
export function heartAvailable(story) {
  return story?.stage === 'complete' && story.flags?.spire_reward === true;
}
export function heartReady(story) {
  const f = story?.flags || {};
  return Boolean(heartAvailable(story) && f.heart_accepted && f.heart_visit
    && f.eye_anchor_west && f.eye_anchor_east && f.victory_storm_heart);
}
export function heartAftermath(story) {
  return `${spireAftermath(story)} The great storm over Stormcrown breaks. Grounded lightning anchors and the fallen Storm Heart leave fewer wandering threats on Stormcrown Spire and in the Storm’s Eye. Ordinary weather and fixed foes remain; patrols and forecasts still matter.`;
}

/** Exact map facts survive early exploration; only a deliberate report pays. */
export function applyHeartEvent(previous, event) {
  const state = { ...previous, flags: { ...previous.flags } };
  const f = state.flags, rewards = [], log = [];
  if (!event || typeof event !== 'object') return { state, rewards, log };
  if (event.type === 'visit' && event.locationId === 'storms_eye') f.heart_visit = true;
  if (event.type === 'interact' && ['eye_anchor_west', 'eye_anchor_east'].includes(event.interactionId)) f[event.interactionId] = true;
  if (event.type === 'victory' && event.encounterId === 'storm_heart_core') {
    if (!f.victory_storm_heart) log.push('The great storm over Stormcrown breaks. Wandering encounters are now half as likely on Stormcrown Spire and in the Storm’s Eye; route-network guidance, if chosen, halves that chance again. Fixed encounters are unchanged.');
    f.victory_storm_heart = true;
  }
  if (event.type === 'heart-accept' && heartAvailable(state) && !f.heart_accepted && !f.heart_reward) {
    f.heart_accepted = true;
    log.push('Mara commissions a final expedition into the Storm’s Eye. Ground the western and eastern lightning anchors, defeat the Storm Heart at the core, and return with your report. Earlier findings count toward the commission.');
  }
  if (event.type === 'heart-report' && heartReady(state) && !f.heart_reward) {
    f.heart_reward = true;
    rewards.push({ id: 'heart_reward', gold: HEART_GOLD });
    log.push(`Received ${HEART_GOLD} gold for the Storm’s Eye expedition.`, heartAftermath(state));
  }
  return { state, rewards, log };
}

export function getHeartJournal(story) {
  if (!heartAvailable(story)) return [];
  const f = story.flags;
  const objective = f.heart_reward ? heartAftermath(story)
    : !f.heart_accepted ? `Optional: accept Mara’s Storm’s Eye expedition in Greyhaven for ${HEART_GOLD} gold. Earlier discoveries count; your beacon and relay choices will not change.`
    : !f.heart_visit ? 'Return to the summit of Stormcrown Spire and take the passage into the Storm’s Eye.'
    : !f.eye_anchor_west || !f.eye_anchor_east ? `Ground the lightning anchors: ${[!f.eye_anchor_west && 'the western anchor', !f.eye_anchor_east && 'the eastern anchor'].filter(Boolean).join(' and ')}. Prepare companions, upgraded equipment, and shock remedies before approaching the core.`
    : !f.victory_storm_heart ? 'Defeat the Storm Heart at the core. The anchored lightning opens the way, but the core must still be fought.'
    : `The great storm over Stormcrown has broken. Return to Greyhaven and explicitly report to Mara for ${HEART_GOLD} gold; conversation alone does not submit the report.`;
  return [{ id: 'heart', title: 'The Storm’s Heart', status: f.heart_reward ? 'complete' : 'active', objective }];
}

export function getHeartDialogue(story, npcId) {
  if (!heartAvailable(story)) return null;
  const f = story.flags;
  if (npcId === 'mara') return { speaker: 'Warden Mara', choices: [], text: f.heart_reward ? heartAftermath(story)
    : !f.heart_accepted ? `${spireAftermath(story)} The shared forecasts show a storm still circling beyond the summit. If you choose to investigate its heart, the council offers ${HEART_GOLD} gold for grounding both lightning anchors and defeating the core. Accept the expedition here when ready.`
    : heartReady(story) ? 'The storm has broken over Stormcrown. Submit your expedition report here so the council can pay your company and share the news.'
    : 'Ground both lightning anchors in the Storm’s Eye before confronting its heart. Bring everyone home; this expedition is a choice, not a debt.' };
  if (npcId === 'iven') return { speaker: 'Iven, Beacon Apprentice', choices: [], text: f.victory_storm_heart
    ? 'The storm over Stormcrown has broken, not weather itself. We will keep sharing forecasts; the old instruments finally have a quieter sky to measure.'
    : 'The Tyrant’s instruments no longer feed the storm, but something beyond the summit sustains it. Ground the western and eastern lightning anchors before you approach the core.' };
  if (npcId === 'tamsin') return { speaker: 'Tamsin, Route Scout', choices: [], text: f.victory_storm_heart
    ? 'There are fewer wandering threats on the spire and in the eye now, not empty roads. Fixed foes still hold their ground, and the expedition board still needs patrols.'
    : 'Return to the summit and look for the passage beyond it. Take a rested company and shock remedies. Our expedition board will still be here when you return.' };
  return null;
}
