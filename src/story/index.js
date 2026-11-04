import { getSettlerDialogue } from './settlers.js';
import { applySpireEvent, getSpireJournal, getSpireDialogue } from './spire.js';
import { applyExpeditionEvent, getExpeditionJournal } from './expeditions.js';
import { applyRelayEvent, getRelayJournal, getRelayDialogue } from './relay.js';
import { applyRescueEvent, getRescueJournal, getRescueDialogue } from './rescue.js';
import { getReliefQuest } from './relief.js';

/** Serializable, DOM-free campaign progression for Beacon of Stormhaven. */
export const LOCATION_IDS = Object.freeze(['greyhaven', 'ridge_road', 'observatory_ruins', 'beacon_tower']);
const ENCOUNTERS = ['ridge_patrol', 'observatory_sentinel'];
const NPCS = ['mara', 'iven', 'tamsin'];
const ENDINGS = ['protect_town', 'share_signal'];

export function createStoryState() {
  return { version: 1, stage: 'briefing', flags: {}, ending: null };
}

/** Inputs are trusted gameplay facts; the scene must enforce interaction proximity. */
export function applyStoryEvent(previous = createStoryState(), event) {
  const state = { ...previous, flags: { ...previous.flags } };
  const rewards = [], log = [];
  const f = state.flags;
  const reward = (id, gold) => {
    if (f[id]) return;
    f[id] = true;
    rewards.push({ id, gold });
    log.push(`Received ${gold} gold.`);
  };
  const reconcile = () => {
    if (state.stage === 'road' && f.visit_ridge_road && f.victory_ridge_patrol) {
      state.stage = 'road_report';
      log.push('The ridge road is safe. Report to Mara in Greyhaven.');
    }
    if (state.stage === 'lens' && f.visit_observatory_ruins && f.victory_observatory_sentinel) {
      state.stage = 'lens_report';
      log.push('The focusing lens is recovered. Bring it to Iven in Greyhaven.');
    }
  };
  if (!event || typeof event !== 'object') return { state, rewards, log };
  switch (event.type) {
    case 'visit':
      if (!LOCATION_IDS.includes(event.locationId)) break;
      f[`visit_${event.locationId}`] = true;
      if (event.locationId === 'beacon_tower' && state.stage === 'council' && f.heard_mara && f.heard_tamsin) {
        state.stage = 'decision';
        log.push('The beacon is ready. Choose where its light will reach.');
      }
      break;
    case 'victory':
      if (ENCOUNTERS.includes(event.encounterId)) f[`victory_${event.encounterId}`] = true;
      break;
    case 'interact':
      if (event.interactionId === 'dispatch_ridge' && f.visit_ridge_road) f.dispatch_ridge = true;
      if (event.interactionId === 'dispatch_observatory' && f.visit_observatory_ruins) f.dispatch_observatory = true;
      break;
    case 'talk':
      if (!NPCS.includes(event.npcId)) break;
      if (event.npcId === 'mara') {
        if (state.stage === 'briefing') {
          state.stage = 'road';
          log.push('Mara asks you to clear the ridge road so supplies can reach Greyhaven.');
        } else if (state.stage === 'road_report') {
          state.stage = 'lens_briefing';
          reward('road_reward', 20);
          log.push('Mara sends you to Iven, the apprentice beacon keeper.');
        } else if (state.stage === 'council') f.heard_mara = true;
      }
      if (event.npcId === 'iven') {
        if (state.stage === 'lens_briefing') {
          state.stage = 'lens';
          log.push('Iven needs the focusing lens from the observatory ruins.');
        } else if (state.stage === 'lens_report') {
          state.stage = 'council';
          reward('lens_reward', 35);
          log.push('The lens is repaired. Hear Mara and Tamsin before climbing the beacon tower.');
        }
      }
      if (event.npcId === 'tamsin') {
        f.met_tamsin = true;
        if (state.stage === 'council') f.heard_tamsin = true;
        if (f.dispatch_ridge && f.dispatch_observatory) {
          reward('dispatch_reward', 15);
        }
      }
      break;
    case 'choose':
      if (state.stage === 'decision' && ENDINGS.includes(event.choiceId)) {
        state.ending = event.choiceId;
        state.stage = 'complete';
        reward('chapter_reward', 50);
        log.push(getEndingSummary(state));
      }
      break;
  }
  reconcile();
  const rescue = applyRescueEvent(state, event);
  const relay = applyRelayEvent(rescue.state, event);
  const spire = applySpireEvent(relay.state, event);
  const expedition = applyExpeditionEvent(spire.state, event);
  return { state: expedition.state, rewards: [...rewards, ...rescue.rewards, ...relay.rewards, ...spire.rewards, ...expedition.rewards], log: [...log, ...rescue.log, ...relay.log, ...spire.log, ...expedition.log] };
}

const OBJECTIVES = {
  briefing: 'Speak to Warden Mara in Greyhaven.',
  road: 'Visit the ridge road and defeat the ridge patrol.',
  road_report: 'Return to Mara in Greyhaven to report the cleared road.',
  lens_briefing: 'Speak to Iven in Greyhaven about the broken beacon.',
  lens: 'Visit the observatory ruins and defeat the threat guarding the focusing lens.',
  lens_report: 'Bring the focusing lens to Iven in Greyhaven.',
  decision: 'Choose the beacon’s reach: protect Greyhaven or share its signal.',
};

export function getJournal(state = createStoryState()) {
  const f = state.flags;
  const journal = [];
  const roadDone = Boolean(f.road_reward), lensDone = Boolean(f.lens_reward);
  journal.push({ id: 'road', title: 'A Light in the Storm', status: roadDone ? 'complete' : 'active',
    objective: roadDone ? 'The ridge road is open; supplies can reach Greyhaven.' : OBJECTIVES[state.stage] || OBJECTIVES.briefing });
  if (roadDone) journal.push({ id: 'lens', title: 'A Clearer Sky', status: lensDone ? 'complete' : 'active',
    objective: lensDone ? 'Iven has repaired the focusing lens.' : OBJECTIVES[state.stage] });
  if (lensDone) {
    let objective = OBJECTIVES[state.stage];
    if (state.stage === 'council') {
      const unheard = [!f.heard_mara && 'Mara', !f.heard_tamsin && 'Tamsin'].filter(Boolean);
      objective = unheard.length ? `Hear ${unheard.join(' and ')} in Greyhaven before choosing the beacon’s reach.` : 'Travel to the beacon tower to set the repaired lens.';
    }
    if (state.stage === 'complete') objective = getEndingSummary(state);
    journal.push({ id: 'beacon', title: 'Beyond the Walls', status: state.stage === 'complete' ? 'complete' : 'active', objective });
  }
  if (f.met_tamsin || f.dispatch_ridge || f.dispatch_observatory) {
    const missing = [!f.dispatch_ridge && 'the ridge road', !f.dispatch_observatory && 'the observatory ruins'].filter(Boolean);
    journal.push({ id: 'dispatches', title: 'Lost Dispatches', status: f.dispatch_reward ? 'complete' : 'active',
      objective: f.dispatch_reward ? 'Tamsin has the field reports and can plan relief routes.' : missing.length ? `Recover the field reports at ${missing.join(' and ')}.` : 'Return both field reports to Tamsin in Greyhaven.' });
  }
  const relief = getReliefQuest(state);
  if (relief) journal.push(relief);
  journal.push(...getRescueJournal(state));
  journal.push(...getRelayJournal(state));
  journal.push(...getSpireJournal(state));
  journal.push(...getExpeditionJournal(state));
  return journal;
}

export function getEndingChoices(state = createStoryState()) {
  return state.stage === 'decision' ? [
    { id: 'protect_town', label: 'Shield Greyhaven', description: 'Concentrate the beacon on the town. The walls will hold, but distant routes stay dark.' },
    { id: 'share_signal', label: 'Light the distant routes', description: 'Spread a weaker shield along the roads. Other settlements can find their way, but Greyhaven must share the risk.' },
  ] : [];
}

export function getEndingSummary(state) {
  if (state.ending === 'protect_town') return 'A steady blue light settles over Greyhaven. The town is safe tonight; tomorrow, its people must find another way to reach their neighbors.';
  if (state.ending === 'share_signal') return 'Lines of silver light trace the distant roads. Greyhaven’s shield is thinner, but answering lanterns appear along the horizon. No settlement faces the storm alone.';
  return '';
}

export function getDialogue(state = createStoryState(), npcId) {
  const settler = getSettlerDialogue(state, npcId);
  if (settler) return settler;
  const spire = getSpireDialogue(state, npcId);
  if (spire) return spire;
  const relay = getRelayDialogue(state, npcId);
  if (relay) return relay;
  const rescue = getRescueDialogue(state, npcId);
  if (rescue) return rescue;
  const s = state.stage;
  const f = state.flags;
  if (npcId === 'mara') {
    let text = 'The beacon kept these streets safe for thirty years. Clear the ridge road, and we can bring supplies home.';
    if (s === 'road') text = 'The ridge patrol still blocks our supply route. Take care out there.';
    if (s === 'road_report') text = 'You opened the road. Take this payment, then speak to Iven about the beacon.';
    if (['lens_briefing', 'lens', 'lens_report'].includes(s)) text = 'Iven knows the old observatory. With its lens, we may yet turn back this storm.';
    if (['council', 'decision'].includes(s)) text = 'Focus the beacon on Greyhaven. A promise to everyone means nothing if we cannot keep even these walls standing.';
    if (s === 'complete') text = state.ending === 'protect_town' ? 'The walls are holding. Now we owe our neighbors a rescue plan.' : 'I will reinforce the walls. If we share the light, we share the work.';
    return { speaker: 'Warden Mara', text, choices: [] };
  }
  if (npcId === 'iven') {
    let text = 'The beacon failed on my watch. I have studied every drawing, but drawings cannot replace a broken lens.';
    if (['lens_briefing', 'lens'].includes(s)) text = 'A focusing lens survives in the observatory ruins. Storm-driven creatures have overrun its galleries. Recover it, and I can repair the beacon.';
    if (s === 'lens_report') text = 'You found it! I can fit the lens, but we must choose how far to spread its light. Listen to Mara and Tamsin first.';
    if (['council', 'decision'].includes(s)) text = 'One strong shield or many smaller ones. Neither setting can do everything. Hear them both, then meet the storm at the beacon tower.';
    if (s === 'complete') text = 'For the first time since the storm, I can look up at the tower without shame. Thank you.';
    return { speaker: 'Iven, Beacon Apprentice', text, choices: [] };
  }
  if (npcId === 'tamsin') {
    let text = 'Two field reports went missing: one on the ridge road, one near the observatory. Bring them back and I can chart safe relief routes.';
    if (f.dispatch_ridge && f.dispatch_observatory && !f.dispatch_reward) text = 'Both reports! These will guide the relief crews. Here is your payment.';
    if (f.dispatch_reward) text = 'The reports are already helping us map a safer route beyond town.';
    if (['council', 'decision'].includes(s)) text = 'There are families beyond these walls. Spread the beacon along the roads, and they have a chance to reach us. We can bear a little more storm together.';
    if (s === 'complete') text = state.ending === 'share_signal' ? 'I saw answering lanterns. At first light, I will lead the relief crews out.' : 'Greyhaven is safe. I will still carry supplies out to the settlements that cannot see our light.';
    return { speaker: 'Tamsin, Route Scout', text, choices: [] };
  }
  return null;
}
