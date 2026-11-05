/** Repeatable patrols count new combat victories, never lifetime bestiary totals. */
const SIGNAL_LINE_TARGETS = Object.freeze([
  Object.freeze({ enemyId: 'dust_marauder', name: 'Dust Marauder', region: 'Sunscar Relay' }),
  Object.freeze({ enemyId: 'spire_sentry', name: 'Spire Sentry', region: 'Stormcrown Spire' }),
  Object.freeze({ enemyId: 'tempest_shade', name: 'Tempest Shade', region: 'The Storm’s Eye' }),
]);
export const EXPEDITIONS = Object.freeze([
  Object.freeze({ id: 'sunscar_patrol', title: 'Sunscar Road Patrol', enemyId: 'dust_marauder', enemyName: 'Dust Marauders', region: 'Sunscar Relay', goal: 2, gold: 35 }),
  Object.freeze({ id: 'spire_patrol', title: 'Stormcrown Sentry Patrol', enemyId: 'spire_sentry', enemyName: 'Spire Sentries', region: 'Stormcrown Spire', goal: 2, gold: 60 }),
  Object.freeze({ id: 'eye_sweep', title: 'Storm’s Eye Sweep', enemyId: 'tempest_shade', enemyName: 'Tempest Shades', region: 'The Storm’s Eye', goal: 2, gold: 90, requiresFlag: 'heart_reward' }),
  Object.freeze({ id: 'signal_line_patrol', title: 'Signal Line Patrol', targetSpecs: SIGNAL_LINE_TARGETS, goal: 3, gold: 120, requiresFlag: 'calibration_reward', strictSpire: true }),
]);
export function expeditionAvailable(story, contractId) {
  const contract = EXPEDITIONS.find(c => c.id === contractId);
  return Boolean(contract && story?.flags?.spire_reward && (!contract.strictSpire || story.flags.spire_reward === true) && (!contract.requiresFlag || story?.flags?.[contract.requiresFlag] === true));
}
export function activeExpedition(story) {
  const active = story?.expedition?.active;
  const contract = EXPEDITIONS.find(c => c.id === active?.id);
  if (!contract || !expeditionAvailable(story, contract.id)) return null;
  if (contract.targetSpecs) {
    const targets = targetCounts(active.targets, contract);
    return { ...contract, targets, progress: Object.values(targets).reduce((sum, n) => sum + n, 0) };
  }
  const progress = Number.isInteger(active.progress) ? Math.max(0, Math.min(contract.goal, active.progress)) : 0;
  return { ...contract, progress };
}
function targetCounts(saved, contract) {
  const valid = saved && typeof saved === 'object' && !Array.isArray(saved);
  return Object.fromEntries(contract.targetSpecs.map(({ enemyId }) => {
    const n = valid && Object.hasOwn(saved, enemyId) ? saved[enemyId] : 0;
    return [enemyId, Number.isInteger(n) && n > 0 ? 1 : 0];
  }));
}
export function expeditionGoalText(contract) {
  return contract.targetSpecs
    ? contract.targetSpecs.map(t => `1 ${t.name} (${t.region})`).join(', ') + ' — any order'
    : `${contract.goal} ${contract.enemyName}`;
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
    if (contract && expeditionAvailable(state, contract.id)) {
      store({ id: contract.id, progress: 0, ...(contract.targetSpecs ? { targets: targetCounts(null, contract) } : {}) });
      log.push(`Accepted ${contract.title}: defeat ${expeditionGoalText(contract)} in new battles, then claim ${contract.gold} gold at the Greyhaven expedition board. Earlier victories do not count.`);
    }
  }
  if (event.type === 'victory' && active?.targetSpecs) {
    const target = active.targetSpecs.find(t => t.enemyId === event.enemyId);
    if (target && active.targets[target.enemyId] === 0) {
      const targets = { ...active.targets, [target.enemyId]: 1 };
      store({ id: active.id, progress: active.progress + 1, targets });
      log.push(`${active.title}: ${target.name} recorded; ${active.progress + 1}/${active.goal} targets.${active.progress + 1 === active.goal ? ' Return to Greyhaven to claim your payment.' : ''}`);
    }
  }
  if (event.type === 'victory' && active && !active.targetSpecs && event.enemyId === active.enemyId && active.progress < active.goal) {
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
    ? active.targetSpecs
      ? `${active.title}: ${active.targetSpecs.map(t => `${active.targets[t.enemyId]}/1 ${t.name} (${t.region})`).join('; ')}. ${active.progress === active.goal ? `Claim ${active.gold} gold at the board in Greyhaven.` : `Win new battles against each target in any order, then return for ${active.gold} gold.`}`
      : `${active.title}: ${active.progress}/${active.goal} ${active.enemyName}. ${active.progress === active.goal ? `Claim ${active.gold} gold at the board in Greyhaven.` : `Patrol ${active.region} for new random encounters, then return for ${active.gold} gold.`}`
    : `Choose a repeatable patrol in Greyhaven. Only victories after acceptance count; one contract can be active at a time. Contracts completed: ${completedExpeditions(story)}.` }];
}
