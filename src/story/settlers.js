/** Settlers outside Greyhaven react to rescues, the relay choice, and the summit survey. */
export const SETTLERS = Object.freeze({
  ona: Object.freeze({
    speaker: 'Ona Vell, Saltmere Harbormaster',
    victoryFlag: 'rescue_victory_coast',
    lines: Object.freeze({
      waiting: 'Saltmere has weathered storms for a hundred years, but reef creatures now block the landing. Our evacuation boats need someone to clear the coast road.',
      rescued: 'Our nets are drying in the sun again. Tell Warden Mara that Saltmere remembers who came down the coast road for us.',
      shelter_network: 'The relay shelters mean our carters can sleep dry at every waystation inland. Fewer of them come home with fever.',
      route_network: 'With the relay routing patrols, the coast road is quiet enough that our youngest run messages to Highwatch on their own.',
      spire: 'Your summit forecasts reach us by noon. We haul the boats in a full day before a squall now, not an hour.',
    }),
  }),
  rusk: Object.freeze({
    speaker: 'Captain Rusk, Highwatch Garrison',
    victoryFlag: 'rescue_victory_heights',
    lines: Object.freeze({
      waiting: 'Frost wolves have cut off the supply crossing. My sentries are cold and running short of provisions; clear a way through before the next caravan arrives.',
      rescued: 'The supply crossing is open again. Our sentries can bring the stranded caravan through, though the upper pass still needs a careful watch.',
      shelter_network: 'The relay shelters along the East Gate road saved two frostbitten couriers last week. I owe your council a barrel of cider.',
      route_network: 'Since the relay started routing patrols, ambushes on the pass are down by half. My sentries actually sleep now.',
      spire: 'After your survey we read the wind off the Spire like a ledger. Not one caravan caught on the ice this season.',
    }),
  }),
});

export function getSettlerDialogue(story, npcId) {
  const settler = Object.prototype.hasOwnProperty.call(SETTLERS, npcId) ? SETTLERS[npcId] : null;
  if (!settler) return null;
  const f = story?.flags || {};
  let key = 'waiting';
  if (f.spire_reward) key = 'spire';
  else if (f.relay_choice === 'shelter_network' || f.relay_choice === 'route_network') key = f.relay_choice;
  else if (f[settler.victoryFlag]) key = 'rescued';
  return { speaker: settler.speaker, text: settler.lines[key], choices: [] };
}
