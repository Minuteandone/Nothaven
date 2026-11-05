export const SUPPLY_LINE_GOLD = 280;
export const SUPPLY_LINE_ROUTES = Object.freeze([
  Object.freeze({ id: 'coastal', label: 'Coastal', enemyId: 'wrack_eel', enemyName: 'Wrack Eel', region: 'Saltmere', stationId: 'saltmere_harbor_lamp', stationName: 'Harbor Lamp', stationLocation: 'Saltmere (4,5)', approach: 'harbor' }),
  Object.freeze({ id: 'highland', label: 'Highland', enemyId: 'rime_wight', enemyName: 'Rime Wight', region: 'Highwatch', stationId: 'highwatch_cairn', stationName: 'Highwatch Cairn', stationLocation: 'Highwatch (4,1)', approach: 'mountain' }),
]);
const STEP_FLAGS = Object.freeze(['supply_patrol', 'supply_station', 'supply_relay_patrol', 'supply_junction']);
export function supplyLineAvailable(story) {
  return story?.stage === 'complete' && story.flags?.calibration_reward === true;
}
export function supplyLineRoute(story) {
  return SUPPLY_LINE_ROUTES.find(route => route.id === story?.flags?.supply_route) || null;
}
export function supplyLineReady(story) {
  return Boolean(supplyLineAvailable(story) && supplyLineRoute(story) && STEP_FLAGS.every(flag => story.flags[flag] === true));
}
function steps(route) {
  return [
    { flag: STEP_FLAGS[0], type: 'victory', key: 'enemyId', id: route.enemyId, objective: `Use Patrol in ${route.region} until you find and defeat a ${route.enemyName} in a new battle. Then inspect the ${route.stationName} in ${route.stationLocation}. Earlier victories do not count.` },
    { flag: STEP_FLAGS[1], type: 'interact', key: 'interactionId', id: route.stationId, objective: `Inspect the ${route.stationName} in ${route.stationLocation} after the fresh ${route.enemyName} victory. Next, survey the Sunscar approach.` },
    { flag: STEP_FLAGS[2], type: 'victory', key: 'enemyId', id: 'dust_marauder', objective: 'Use Patrol in Sunscar Relay until you find and defeat a Dust Marauder in a new battle. Then inspect the Relay Capacitor Junction on the northern terrace (3,1). Earlier victories do not count.' },
    { flag: STEP_FLAGS[3], type: 'interact', key: 'interactionId', id: 'relay_junction', objective: 'Inspect the Relay Capacitor Junction in Sunscar Relay (3,1) after the fresh Dust Marauder victory, then return to Greyhaven and explicitly report Supply Lines for 280 gold.' },
  ];
}
function aftermath(route) {
  return `Your ${route.id} survey gives the supply crews a checked ${route.approach} approach and a fresh Sunscar junction reading. The route still needs ordinary patrols; the beacon and relay keep their chosen purpose.`;
}

/** Ordered, fresh facts only: this is advance surveying, not an escort simulation. */
export function applySupplyLineEvent(previous, event) {
  const state = { ...previous, flags: { ...previous?.flags } }, rewards = [], log = [];
  if (!event || typeof event !== 'object' || !supplyLineAvailable(state) || state.flags.supply_reward === true) return { state, rewards, log };
  const f = state.flags;
  let route = supplyLineRoute(state);
  if (event.type === 'supply-line-accept' && !route) {
    route = SUPPLY_LINE_ROUTES.find(candidate => candidate.id === event.routeId);
    if (route) {
      f.supply_route = route.id;
      // A newly accepted route never inherits partial progress from a malformed save.
      for (const flag of STEP_FLAGS) delete f[flag];
      log.push(`Accepted the ${route.label} Supply Lines survey. This route cannot be changed after acceptance. ${steps(route)[0].objective}`);
    }
  }
  if (route) {
    const next = steps(route).find(step => f[step.flag] !== true);
    if (next && event.type === next.type && event[next.key] === next.id) {
      f[next.flag] = true;
      const remaining = steps(route).find(step => f[step.flag] !== true);
      log.push(`Supply Lines — ${route.label}: ${remaining ? remaining.objective : 'Survey complete. Return to Greyhaven and explicitly report for 280 gold.'}`);
    }
    if (event.type === 'supply-line-report' && supplyLineReady(state)) {
      f.supply_reward = true;
      rewards.push({ id: 'supply_reward', gold: SUPPLY_LINE_GOLD });
      log.push(`Received ${SUPPLY_LINE_GOLD} gold for Supply Lines.`, aftermath(route));
    }
  }
  return { state, rewards, log };
}

export function getSupplyLineJournal(story) {
  if (!supplyLineAvailable(story)) return [];
  const route = supplyLineRoute(story), paid = story.flags.supply_reward === true;
  const objective = !route ? 'Optional: choose a Coastal or Highland Supply Lines survey in Greyhaven after reporting Signal Calibration. Survey one route in order, then explicitly report for 280 gold. Earlier victories and inspections do not count; this is advance surveying, not an escort.'
    : paid ? aftermath(route)
    : supplyLineReady(story) ? `${route.label} survey complete. Return to Greyhaven and explicitly report Supply Lines for 280 gold. Conversation alone does not submit the report.`
    : `${route.label} survey: ${steps(route).find(step => story.flags[step.flag] !== true).objective}`;
  return [{ id: 'supply_lines', title: 'Supply Lines', status: paid && route ? 'complete' : 'active', objective }];
}
export function getSupplyLineDialogue(story, npcId) {
  if (!supplyLineAvailable(story)) return null;
  if (npcId === 'mara') return { speaker: 'Warden Mara', choices: [], text: getSupplyLineJournal(story)[0].objective };
  if (npcId === 'iven') return { speaker: 'Iven, Beacon Apprentice', choices: [], text: 'The supply crews will use the same calibrated signal interval. The focusing lens stays installed at the beacon; this survey changes neither its reach nor the relay’s chosen purpose.' };
  if (npcId === 'tamsin') {
    const route = supplyLineRoute(story);
    return { speaker: 'Tamsin, Route Scout', choices: [], text: `${route ? `You chose the ${route.label} survey.` : 'Choose the Coastal or Highland survey before setting out.'} Check the regional threat and station first, then the Sunscar threat and junction. We are surveying ahead of the supply crews, not escorting them. A survey does not clear a road permanently; ordinary patrols remain necessary.` };
  }
  return null;
}
