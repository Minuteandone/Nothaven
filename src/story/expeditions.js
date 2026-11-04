/** Repeatable patrols count new combat victories, never lifetime bestiary totals. */
export const EXPEDITIONS = Object.freeze([
  Object.freeze({ id: 'sunscar_patrol', title: 'Sunscar Road Patrol', enemyId: 'dust_marauder', enemyName: 'Dust Marauders', region: 'Sunscar Relay', goal: 2, gold: 35 }),
  Object.freeze({ id: 'spire_patrol', title: 'Stormcrown Sentry Patrol', enemyId: 'spire_sentry', enemyName: 'Spire Sentries', region: 'Stormcrown Spire', goal: 2, gold: 60 }),
]);
export function activeExpedition(story) {
  const active = story?.expedition?.active;
  const contract = EXPEDITIONS.find(c => c.id === active?.id);
  if (!contract) return null;
  const progress = Number.isInteger(active.progress) ? Math.max(0, Math.min(contract.goal, active.progress)) : 0;
  return { ...contract, progress };
}
export function completedExpeditions(story) {
  const count = story?.expedition?.completed;
  return Number.isSafeInteger(count) && count >= 0 ? count : 0;
}
export function applyExpeditionEvent(previous, event) {
  const state = { ...previous };
  const rewards = [], log = [];
  if (!state.flags?.spire_reward || !event || typeof event !== 'object') return { state, rewards, log };
  const active = activeExpedition(state), completed = completedExpeditions(state);
  const store = value => { state.expedition = { completed, active: value }; };
  if (event.type === 'expedition-accept' && !active) {
    const contract = EXPEDITIONS.find(c => c.id === event.contractId);
    if (contract) {
      store({ id: contract.id, progress: 0 });
      log.push(`Accepted ${contract.title}: defeat ${contract.goal} ${contract.enemyName} in new battles, then claim ${contract.gold} gold at the Greyhaven expedition board. Earlier victories do not count.`);
    }
  }
  if (event.type === 'victory' && active && event.enemyId === active.enemyId && active.progress < active.goal) {
    store({ id: active.id, progress: active.progress + 1 });
    log.push(`${active.title}: ${active.progress + 1}/${active.goal} victories.${active.progress + 1 === active.goal ? ' Return to Greyhaven to claim your payment.' : ''}`);
  }
  if (event.type === 'expedition-claim' && active && active.progress === active.goal) {
    state.expedition = { active: null, completed: completed + 1 };
    rewards.push({ id: `expedition_reward_${completed + 1}`, gold: active.gold });
    log.push(`${active.title} complete. Received ${active.gold} gold. The board is ready for another contract.`);
  }
  if (event.type === 'expedition-cancel' && active) {
    store(null);
    log.push(`${active.title} cancelled without payment. Its progress has been discarded.`);
  }
  return { state, rewards, log };
}
export function getExpeditionJournal(story) {
  if (!story?.flags?.spire_reward) return [];
  const active = activeExpedition(story);
  return [{ id: 'expeditions', title: 'Greyhaven Expedition Board', status: 'active', objective: active
    ? `${active.title}: ${active.progress}/${active.goal} ${active.enemyName}. ${active.progress === active.goal ? `Claim ${active.gold} gold at the board in Greyhaven.` : `Patrol ${active.region} for new random encounters, then return for ${active.gold} gold.`}`
    : `Choose a repeatable patrol in Greyhaven. Only victories after acceptance count; one contract can be active at a time. Contracts completed: ${completedExpeditions(story)}.` }];
}
