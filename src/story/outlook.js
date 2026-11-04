import { RESCUE_ROUTES, routeRescued } from './rescue.js';

// Read-only scene copy: viewing the town never advances or rewards a quest.
export function getTownOutlook(story) {
  const flags = story?.flags || {};
  if (story?.stage === 'decision') return {
    title: 'The beacon awaits your answer',
    text: 'The focusing lens is ready. Mara has spoken for the walls, and Tamsin for the roads beyond them. At the tower, you must decide how far the restored light will reach.',
    hint: 'Return to the Beacon Tower to choose. This decision cannot be undone.',
  };
  if (story?.stage !== 'complete') return {
    title: 'A light beyond the ridge',
    text: 'The damaged beacon darkens the headland while storm clouds gather over the ridge road. Beyond it, the old observatory may hold the means to rekindle the light.',
    hint: 'Prepare in town before setting out. The wilds are dangerous, and every turn matters.',
  };
  const light = story.ending === 'protect_town'
    ? 'A steady blue shield holds over Greyhaven.'
    : 'Silver light marks the roads beyond Greyhaven, while watch crews tend the thinner town shield.';
  if (flags.rescue_reward) return {
    title: 'The roads bring people home',
    text: `${light} Saltmere’s harbor watch and Highwatch’s supply crews can travel again. The first returning caravans bring neighbors, medicine, and news through the gates.`,
    hint: flags.relief_reward
      ? 'Your relief supplies have joined the caravans. Rest, regroup, and explore the dangers still beyond the cleared roads.'
      : 'The roads are open. Mara still welcomes the First Light Relief supplies listed in your journal.',
  };
  if (flags.rescue_accepted) {
    const safe = RESCUE_ROUTES.filter(route => routeRescued(story, route));
    return {
      title: safe.length === 2 ? 'Two roads open, one report to make' : 'Carry the light beyond the walls',
      text: `${light} ${safe.length === 2
        ? 'Both settlement routes are clear. Mara is waiting to organize the returning convoys.'
        : safe.length === 1
          ? `${safe[0].name} has a safe route home. The other settlement is still waiting for your patrol.`
          : 'The rescue crews need safe passage to Saltmere and Highwatch. You can open either route first.'}`,
      hint: safe.length === 2
        ? 'Report both routes to Mara using the expedition control in your journal.'
        : 'Gather companions at the watch house and follow the expedition directions in your journal.',
    };
  }
  return {
    title: 'A light worth carrying',
    text: `${light} The beacon is restored, but light alone cannot clear flooded piers or open the mountain crossing. Your neighbors still need a way home.`,
    hint: 'Accept Mara’s relief expedition in your journal when you are ready. First Light Relief supplies can be handed in separately.',
  };
}
