/** Chapter three preserves the beacon ending and records early exploration facts. */
export const RELAY_GOLD = 100;
export const RELAY_CHOICES = Object.freeze([
  Object.freeze({ id: 'shelter_network', label: 'Power the shelter network', description: 'Send steady power to the inns and refuge houses. Paid rests cost 2 gold instead of 5.' }),
  Object.freeze({ id: 'route_network', label: 'Power the route network', description: 'Send warning signals along the trails. Random encounter chance is halved; fixed encounters remain unchanged.' }),
]);

export function relayAvailable(story) {
  return Boolean(story.stage === 'complete' && story.flags?.rescue_reward);
}
export function relayReady(story) {
  const f = story.flags || {};
  return Boolean(relayAvailable(story) && f.relay_accepted && f.relay_visit && f.relay_junction && f.relay_victory && f.relay_console);
}
export function getRelayChoices(story) {
  return relayReady(story) && !story.flags.relay_choice ? RELAY_CHOICES : [];
}
export function restPrice(story) {
  return story?.flags?.relay_choice === 'shelter_network' ? 2 : 5;
}
export function relayAftermath(story) {
  const origin = story.ending === 'protect_town'
    ? 'Greyhaven’s blue shield still holds; the inland relay now carries that promise beyond its walls.'
    : 'The silver roads still shine; the inland relay gives the answering settlements power of their own.';
  const effect = story.flags?.relay_choice === 'shelter_network'
    ? 'Refuge lamps burn through the night. Paid rests now cost 2 gold instead of 5.'
    : 'Trail watchers can signal danger before travelers meet it. Random encounter chance is halved; fixed encounters are unchanged.';
  return `${origin} ${effect}`;
}

/** Gameplay supplies facts; the scene adapter validates commission/console location. */
export function applyRelayEvent(previous, event) {
  const state = { ...previous, flags: { ...previous.flags } };
  const f = state.flags, rewards = [], log = [];
  if (!event || typeof event !== 'object') return { state, rewards, log };
  if (event.type === 'visit' && event.locationId === 'sunscar_relay') f.relay_visit = true;
  if (event.type === 'victory' && event.encounterId === 'relay_warden') f.relay_victory = true;
  if (event.type === 'interact' && ['relay_junction', 'relay_console'].includes(event.interactionId)) f[event.interactionId] = true;
  if (event.type === 'relay-accept' && relayAvailable(state) && !f.relay_accepted) {
    f.relay_accepted = true;
    log.push('The council commissions you to restore Sunscar Relay. Prime its junction, defeat its rogue warden, and inspect the control console to choose how the inland power will serve the settlements.');
  }
  if (event.type === 'relay-choose' && getRelayChoices(state).some(choice => choice.id === event.choiceId)) {
    f.relay_choice = event.choiceId;
    if (!f.relay_reward) {
      f.relay_reward = true;
      rewards.push({ id: 'relay_reward', gold: RELAY_GOLD });
      log.push(`The inland relay is restored. Received ${RELAY_GOLD} gold from the council’s commission.`);
    }
    log.push(relayAftermath(state));
  }
  return { state, rewards, log };
}

export function getRelayJournal(story) {
  if (!relayAvailable(story)) return [];
  const f = story.flags || {};
  const objective = f.relay_choice ? relayAftermath(story)
    : !f.relay_accepted ? 'Accept the council’s inland relay commission in Greyhaven. Restoring Sunscar Relay earns 100 gold and one permanent network benefit.'
    : !f.relay_visit ? 'Take the ridge road’s North Trail to Highwatch Pass, then its East Gate to Sunscar Relay.'
    : !f.relay_junction ? 'Inspect the Relay Capacitor Junction in the north of Sunscar Relay to prime the inland power lines.'
    : !f.relay_victory ? 'Defeat the Relay Warden guarding the station’s central causeway. Prepare your party at the outpost before the fight.'
    : !f.relay_console ? 'Inspect the Master Relay Console east of the warden’s post.'
    : `Return to the Master Relay Console and choose the shelter or route network. This choice is permanent and pays ${RELAY_GOLD} gold once.`;
  return [{ id: 'relay', title: 'A Signal of Our Own', status: f.relay_choice ? 'complete' : 'active', objective }];
}

export function getRelayDialogue(story, npcId) {
  if (!relayAvailable(story)) return null;
  const f = story.flags || {};
  if (npcId === 'mara') return { speaker: 'Warden Mara', choices: [], text: f.relay_choice ? relayAftermath(story)
    : f.relay_accepted ? 'The relay belongs to every settlement that kept the roads open. Restore it, then choose the service they need most. The original beacon will keep the duty you gave it.'
    : 'Our neighbors have returned with news of an inland signal station. Accept the council’s commission, and we can build something stronger than a single town standing alone.' };
  if (npcId === 'iven') return { speaker: 'Iven, Beacon Apprentice', choices: [], text: f.relay_choice
    ? 'The inland circuit is stable. Its service is fixed now, but the beacon’s original lens remains untouched.'
    : 'Prime the northern junction before setting the console. There is only enough steady power for one service: refuge houses or trail warnings. Choose carefully.' };
  if (npcId === 'tamsin') return { speaker: 'Tamsin, Route Scout', choices: [], text: f.relay_choice
    ? 'A working network is a promise kept every day. Keep your companions close; even good warnings cannot clear every danger.'
    : 'The East Gate in Highwatch leads to Sunscar. Shelter keeps exhausted crews alive; warnings keep travelers out of ambushes. Neither choice makes the other need disappear.' };
  return null;
}
