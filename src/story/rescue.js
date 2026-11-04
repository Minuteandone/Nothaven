/** Chapter two uses independent flags: chapter one's ending remains permanent. */
export const RESCUE_ROUTES = Object.freeze([
  Object.freeze({ id: 'coast', locationId: 'saltmere_coast', encounterId: 'saltmere_rescue', name: 'Saltmere', directions: 'Take Greyhaven’s South Pier route to the coast.', task: 'Open the coastal evacuation route.' }),
  Object.freeze({ id: 'heights', locationId: 'highwatch_pass', encounterId: 'highwatch_rescue', name: 'Highwatch', directions: 'Take the ridge road’s North Trail to the pass.', task: 'Clear the mountain supply crossing.' }),
]);
export const RESCUE_GOLD = 80;

export function routeRescued(story, route) {
  return Boolean(story.flags?.[`rescue_visit_${route.id}`] && story.flags?.[`rescue_victory_${route.id}`]);
}

export function rescueReady(story) {
  return Boolean(story.stage === 'complete' && story.flags?.rescue_accepted && RESCUE_ROUTES.every(route => routeRescued(story, route)));
}

/** Pure reducer; map/combat supply facts, while UI guards acceptance/report location. */
export function applyRescueEvent(previous, event) {
  const state = { ...previous, flags: { ...previous.flags } };
  const f = state.flags, rewards = [], log = [];
  if (!event || typeof event !== 'object') return { state, rewards, log };
  // Facts persist even before accepting the expedition, preventing early-clear softlocks.
  for (const route of RESCUE_ROUTES) {
    const wasSafe = routeRescued(state, route);
    if (event.type === 'visit' && event.locationId === route.locationId) f[`rescue_visit_${route.id}`] = true;
    if (event.type === 'victory' && event.encounterId === route.encounterId) f[`rescue_victory_${route.id}`] = true;
    if (!wasSafe && routeRescued(state, route)) {
      if (!f.rescue_first) f.rescue_first = route.id;
      log.push(`${route.name}'s relief route is open. The waiting crews can bring people and supplies through.`);
    }
  }
  if (event.type === 'rescue-accept' && state.stage === 'complete' && !f.rescue_accepted) {
    f.rescue_accepted = true;
    log.push('Mara entrusts you with the relief expedition. Reach both settlements, clear their routes, then report to her in Greyhaven.');
  }
  if (event.type === 'rescue-report' && rescueReady(state) && !f.rescue_reward) {
    f.rescue_reward = true;
    rewards.push({ id: 'rescue_reward', gold: RESCUE_GOLD });
    log.push(`Both settlements are connected to Greyhaven. Received ${RESCUE_GOLD} gold.`, rescueAftermath(state));
  }
  return { state, rewards, log };
}

export function rescueAftermath(story) {
  const first = RESCUE_ROUTES.find(route => route.id === story.flags?.rescue_first)?.name;
  const light = story.ending === 'share_signal'
    ? 'The roads you lit now carry more than signals: food, medicine, and neighbors travel together.'
    : 'Beyond the shelter of Greyhaven’s shield, your crews have carried its promise to the people in the dark.';
  return `${light}${first ? ` ${first}'s first returning caravan helps guide the second home.` : ''}`;
}

export function getRescueJournal(story) {
  if (story.stage !== 'complete') return [];
  const f = story.flags || {};
  const journal = [{ id: 'rescue', title: 'Roads to Our Neighbors', status: f.rescue_reward ? 'complete' : 'active',
    objective: f.rescue_reward ? rescueAftermath(story)
      : !f.rescue_accepted ? 'Accept Mara’s relief expedition in Greyhaven. Both settlements need a safe route.'
      : rescueReady(story) ? `Report both open routes to Mara in Greyhaven for ${RESCUE_GOLD} gold.`
      : 'Reach both settlements and defeat the forces blocking their relief routes. You may visit them in either order.' }];
  if (f.rescue_accepted) for (const route of RESCUE_ROUTES) {
    const done = routeRescued(story, route);
    journal.push({ id: `rescue_${route.id}`, title: `${route.name}: A Road Home`, status: done ? 'complete' : 'active',
      objective: done ? `${route.name}'s route is safe for the relief crews.` : `${route.directions} Visit ${route.name}. ${route.task}` });
  }
  return journal;
}

export function getRescueDialogue(story, npcId) {
  if (story.stage !== 'complete' || !story.flags?.rescue_accepted) return null;
  if (npcId === 'mara') return { speaker: 'Warden Mara', choices: [], text: story.flags.rescue_reward
    ? rescueAftermath(story)
    : rescueReady(story) ? 'Both routes are open. Give me your full report and I will release the expedition’s payment.'
    : 'We cannot carry every burden from these walls. Open both routes and the settlements can begin helping each other.' };
  if (npcId === 'iven') return { speaker: 'Iven, Beacon Apprentice', choices: [], text: story.ending === 'share_signal'
    ? 'The answering lights are still there. Follow them, but do not mistake a signal for a safe road.'
    : 'The shield is holding here. Beyond its reach, carry lanterns and trust the people beside you.' };
  if (npcId === 'tamsin') return { speaker: 'Tamsin, Route Scout', choices: [], text: story.flags.rescue_reward
    ? 'The first caravans are moving. Next time the storm closes in, these settlements will know who stands beside them.'
    : 'Coast or heights first: your choice. Clear both crossings, and the crews can move without leaving anyone behind.' };
  return null;
}
