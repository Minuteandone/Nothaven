import { takeRewards, countItem } from '../items/inventory.js';

export const RELIEF_REQUIREMENTS = Object.freeze({ rations: 2, bandage: 1 });
export const RELIEF_GOLD = 30;

export function getReliefQuest(story) {
  if (story?.stage !== 'complete') return null;
  const complete = Boolean(story.flags?.relief_reward);
  const aftermath = story.ending === 'share_signal'
    ? 'Tamsin’s crews follow the silver-lit roads with food and medical supplies. Greyhaven shares more than its light.'
    : 'Tamsin’s crews carry food and medical supplies beyond the town’s strong shield. Its safety becomes a promise to its neighbors.';
  return { id: 'relief', title: 'First Light Relief', status: complete ? 'complete' : 'active',
    objective: complete ? aftermath : 'Deliver 2 rations and 1 bandage to Tamsin in Greyhaven. Reward: 30 gold. Supplies are consumed only when you choose to hand them over.' };
}

export function reliefSupplies(inventory = []) {
  return `Rations: ${countItem(inventory, 'rations')}/2 · Bandages: ${countItem(inventory, 'bandage')}/1`;
}

/** Pure all-or-nothing transaction. The scene supplies its authoritative location. */
export function handInRelief(state, location) {
  const quest = getReliefQuest(state.story);
  const fail = message => ({ ok: false, state, message });
  if (location !== 'greyhaven') return fail('Bring the supplies to Tamsin in Greyhaven.');
  if (!quest) return fail('Restore the beacon before preparing the relief crews.');
  if (quest.status === 'complete') return fail('The relief crews already have your supplies.');
  const taken = takeRewards(state.inventory || [], RELIEF_REQUIREMENTS);
  if (!taken.ok) return fail('You need 2 rations and 1 bandage. No supplies were taken.');
  const story = { ...state.story, flags: { ...state.story.flags, relief_reward: true } };
  return { ok: true, state: { ...state, story, inventory: taken.inv, gold: state.gold + RELIEF_GOLD },
    message: `Handed over 2 rations and 1 bandage. Received ${RELIEF_GOLD} gold. ${getReliefQuest(story).objective}` };
}
