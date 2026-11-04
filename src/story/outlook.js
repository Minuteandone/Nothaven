import { getHeartJournal, heartAftermath, heartAvailable } from './heart.js';
import { getSpireJournal, spireAftermath } from './spire.js';
import { getExpeditionJournal } from './expeditions.js';
import { getRelayJournal, relayAftermath } from './relay.js';
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
  if (heartAvailable(story) && (flags.heart_accepted || flags.victory_storm_heart)) return {
    title: flags.victory_storm_heart ? 'A quieter sky over Stormcrown' : 'Beyond the summit',
    text: flags.heart_reward ? heartAftermath(story) : flags.victory_storm_heart
      ? `${light} The great storm over Stormcrown has broken. Fewer wandering threats trouble the spire and the Storm’s Eye, but fixed foes and ordinary weather remain.`
      : `${light} The summit instruments are quiet, yet the shared forecasts trace a lingering storm beyond them. Your company has chosen to investigate the Storm’s Eye.`,
    hint: getHeartJournal(story)[0].objective,
  };
  if (flags.spire_reward) return {
    title: 'A shared forecast, an open road',
    text: spireAftermath(story),
    hint: getExpeditionJournal(story)[0].objective,
  };
  if (flags.spire_accepted && getSpireJournal(story).length) return {
    title: 'Above the gathering storm',
    text: `${light} The relay has traced the violent weather to Stormcrown Spire. The summit survey will turn an enemy’s weapon into knowledge shared by every settlement.`,
    hint: getSpireJournal(story)[0].objective,
  };
  if (flags.relay_choice) return {
    title: 'The inland lights answer',
    text: relayAftermath(story),
    hint: flags.relief_reward ? 'Accept Mara’s summit survey in Greyhaven when your party is ready for Stormcrown Spire.' : 'Mara still welcomes the First Light Relief supplies listed in your journal.',
  };
  if (flags.relay_accepted && flags.rescue_reward) return {
    title: 'An inland signal to restore',
    text: `${light} The council’s commission will give the returning settlements a network of their own.`,
    hint: getRelayJournal(story)[0].objective,
  };
  if (flags.rescue_reward) return {
    title: 'The roads bring people home',
    text: `${light} Saltmere’s harbor watch and Highwatch’s supply crews can travel again. The first returning caravans bring neighbors, medicine, and news through the gates.`,
    hint: flags.relief_reward
      ? 'Your relief supplies have joined the caravans. Accept the council’s relay commission to restore Sunscar’s inland network.'
      : 'Accept the council’s relay commission for the next expedition. Mara still welcomes the First Light Relief supplies.',
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
