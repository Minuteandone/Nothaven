import { isCompanionId } from './companions.js';

// Missing and malformed preferences preserve the original automatic behavior.
export function companionTactic(member) {
  return member?.tactic === 'conserve' ? 'conserve' : 'auto';
}

export function setCompanionTactic(state, id, tactic) {
  if (!isCompanionId(id) || !['auto', 'conserve'].includes(tactic) || !Array.isArray(state?.party)) return false;
  const member = state.party.slice(1).find(m => m && m.id === id);
  if (!member || !(member.hp > 0)) return false;
  member.tactic = tactic;
  return true;
}
