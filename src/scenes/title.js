import { createInitialState, loadGame, hasSave } from '../state.js';
import { beaconArt, sceneHeader, uiButton } from '../ui/components.js';
import { ZONES, ensureMapState, travelToZone } from '../map/index.js';

function clearStoryTransients(game) {
  game.storyDialogue = null;
  game.storyMessage = '';
}

export const titleScene = {
  render() {
    return `<main class="game-shell title-screen">
      <div class="title-layout">
        <section class="title-copy">
          ${sceneHeader({ eyebrow: 'A turn-based expedition', title: 'Beacon of Stormhaven', subtitle: 'The storms have broken the beacon that shields Greyhaven. Someone must set it alight again.', iconName: 'beacon' })}
          <div class="title-actions">
            ${uiButton({ action: 'newGame', label: 'New journey', iconName: 'compass', variant: 'primary' })}
            ${uiButton({ action: 'continue', label: 'Continue', iconName: 'save', disabled: !hasSave() })}
            ${uiButton({ action: 'guide', label: 'How to play', iconName: 'journal', variant: 'ghost' })}
          </div>
          <p class="save-note">Single player <span aria-hidden="true">•</span> Your progress is saved on this device</p>
        </section>
        <div class="title-art-frame">${beaconArt()}<span class="art-caption">Greyhaven waits beyond the storm</span></div>
      </div>
    </main>`;
  },
  actions: {
    guide(game) { if (game.scenes?.guide) game.setScene('guide', { returnScene: 'title' }); },
    newGame(game) { game.state = createInitialState(); clearStoryTransients(game); game.setScene('town'); },
    continue(game) {
      const s = loadGame();
      if (!s) return;
      game.state = s;
      clearStoryTransients(game);

      const canResumeExploration = s.scene === 'explore'
        && s.map
        && ZONES[s.map.zoneId]
        && s.map.zoneId === s.location;
      if (canResumeExploration) {
        ensureMapState(s);
        game.setScene('explore');
      } else {
        travelToZone(s, 'greyhaven', 'default');
        game.setScene('town', { message: 'Your expedition resumes in Greyhaven.' });
      }
    },
  },
};
