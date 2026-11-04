import { createInitialState, loadGame, hasSave } from '../state.js';
import { beaconArt, sceneHeader, uiButton } from '../ui/components.js';

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
          </div>
          <p class="save-note">Single player <span aria-hidden="true">•</span> Your progress is saved on this device</p>
        </section>
        <div class="title-art-frame">${beaconArt()}<span class="art-caption">Greyhaven waits beyond the storm</span></div>
      </div>
    </main>`;
  },
  actions: {
    newGame(game) { game.state = createInitialState(); clearStoryTransients(game); game.setScene('town'); },
    continue(game) { const s = loadGame(); if (s) { game.state = s; clearStoryTransients(game); game.setScene('town'); } },
  },
};
