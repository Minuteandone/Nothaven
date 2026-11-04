import { handInRelief, RELIEF_GOLD } from './relief.js';
import { applyStoryEvent, createStoryState } from './index.js';

/** Apply a gameplay fact and its rewards together; always reads the current save. */
export function dispatchStoryEvent(game, event) {
  const result = applyStoryEvent(game.state.story || createStoryState(), event);
  game.state.story = result.state;
  for (const reward of result.rewards) game.state.gold += reward.gold;
  if (result.log.length) game.storyMessage = result.log.join(' ');
  // Notify observers after both state and rewards are committed, including direct UI calls.
  game.bus?.emit('story:updated', { event, ...result });
  return result;
}

const installations = new WeakMap();
/** Install once per Game instance. Call returned cleanup when disposing the game. */
export function installStory(game) {
  if (installations.has(game)) return installations.get(game);
  game.state.story ||= createStoryState();
  const onStory = event => dispatchStoryEvent(game, event);
  const onVictory = event => {
    // Encounter identity is not enemy species; ordinary rematches must not clear quests.
    if (event?.encounterId) dispatchStoryEvent(game, { type: 'victory', encounterId: event.encounterId });
  };
  game.bus.on('story:event', onStory);
  game.bus.on('combat:victory', onVictory);
  const cleanup = () => {
    game.bus.off('story:event', onStory);
    game.bus.off('combat:victory', onVictory);
    installations.delete(game);
  };
  installations.set(game, cleanup);
  return cleanup;
}

/** Commit supplies, completion, and payment before notifying any observers. */
export function dispatchReliefHandIn(game, location) {
  const result = handInRelief(game.state, location);
  game.storyMessage = result.message;
  if (!result.ok) return result;
  game.state = result.state;
  game.storyDialogue = null;
  game.bus?.emit('story:updated', {
    event: { type: 'relief-hand-in' }, state: game.state.story,
    rewards: [{ id: 'relief_reward', gold: RELIEF_GOLD }], log: [result.message],
  });
  return result;
}
