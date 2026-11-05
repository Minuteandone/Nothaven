import { createStoryState, getJournal } from './index.js';

const entries = state => getJournal(state?.story || createStoryState());

/** Derive current text without changing the save or automatically choosing another job. */
export function getPinnedQuest(state) {
  const id = state?.pinnedQuestId;
  return typeof id === 'string' ? entries(state).find(entry => entry.id === id) || null : null;
}

/** Only a currently visible, active objective can be newly pinned. */
export function pinQuest(state, id) {
  if (!state || typeof id !== 'string'
    || !entries(state).some(entry => entry.id === id && entry.status === 'active')) return false;
  state.pinnedQuestId = id;
  return true;
}

/** A stale control cannot remove a different, more recently selected pin. */
export function unpinQuest(state, id) {
  if (!state || typeof id !== 'string' || state.pinnedQuestId !== id) return false;
  delete state.pinnedQuestId;
  return true;
}
