import { ZONES, ensureMapState, travelToZone } from '../map/index.js';

/** Shared Continue/archive behavior: resume a valid field location, otherwise return home. */
export function resumeJourney(game, state) {
  game.state = state;
  game.storyDialogue = null;
  game.storyMessage = '';
  const canResumeExploration = state.scene === 'explore'
    && state.map
    && Object.hasOwn(ZONES, state.map.zoneId)
    && state.map.zoneId === state.location;
  if (canResumeExploration) {
    ensureMapState(state);
    game.setScene('explore');
  } else {
    travelToZone(state, 'greyhaven', 'default');
    game.setScene('town', { message: 'Your expedition resumes in Greyhaven.' });
  }
}
