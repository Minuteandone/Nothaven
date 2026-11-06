import { createInitialState, loadGame, hasSave, hasAutosave, loadAutosave } from '../state.js';
import { beaconArt, sceneHeader, uiButton } from '../ui/components.js';
import { resumeJourney } from '../core/resume.js';
import { exportSave, importSave, deleteSave } from '../core/saveManager.js';

function clearStoryTransients(game) {
  game.storyDialogue = null;
  game.storyMessage = '';
}

function buildSaveActions(hasExistingSave, hasExistingAutosave) {
  const buttons = [];
  if (hasExistingSave) {
    buttons.push(uiButton({ action: 'exportSave', label: 'Export save', iconName: 'download', variant: 'secondary' }));
    buttons.push(uiButton({ action: 'promptImport', label: 'Import save', iconName: 'upload', variant: 'secondary' }));
    buttons.push(uiButton({ action: 'promptDelete', label: 'Delete save', iconName: 'trash', variant: 'danger' }));
  }
  if (hasExistingAutosave) {
    buttons.push(uiButton({ action: 'loadAutosaveAction', label: 'Restore autosave', iconName: 'save', variant: 'ghost' }));
  }
  return buttons.join('');
}

export const titleScene = {
  render(game) {
    const saveActions = buildSaveActions(hasSave(), hasAutosave());
    const result = game && game.importResult;
    const importBanner = result
      ? `<div role="alert" class="import-banner import-banner--${result.ok ? 'success' : 'error'}">${result.message}</div>`
      : '';
    return `<main class="game-shell title-screen">
      <div class="title-layout">
        <section class="title-copy">
          ${sceneHeader({ eyebrow: 'A turn-based expedition', title: 'Beacon of Stormhaven', subtitle: 'The storms have broken the beacon that shields Greyhaven. Someone must set it alight again.', iconName: 'beacon' })}
          ${importBanner}
          <div class="title-actions">
            ${uiButton({ action: 'newGame', label: 'New journey', iconName: 'compass', variant: 'primary' })}
            ${uiButton({ action: 'continue', label: 'Continue', iconName: 'save', disabled: !hasSave() })}
            ${game?.scenes?.archive ? uiButton({ action: 'archive', label: 'Journey archive', iconName: 'save', variant: 'ghost' }) : ''}
            ${uiButton({ action: 'guide', label: 'How to play', iconName: 'journal', variant: 'ghost' })}
          </div>
          ${saveActions ? `<div class="title-save-actions">${saveActions}</div>` : ''}
          <p class="save-note">Single player <span aria-hidden="true">•</span> Your progress is saved on this device</p>
        </section>
        <div class="title-art-frame">${beaconArt()}<span class="art-caption">Greyhaven waits beyond the storm</span></div>
      </div>
    </main>`;
  },
  actions: {
    archive(game) { if (game.state.scene === 'title' && game.scenes?.archive && !game.state.combat) game.setScene('archive', { returnScene: 'title' }); },
    guide(game) { if (game.scenes?.guide) game.setScene('guide', { returnScene: 'title' }); },
    newGame(game) { game.state = createInitialState(); clearStoryTransients(game); game.setScene('town'); },
    continue(game) {
      const s = loadGame();
      if (!s) return;
      resumeJourney(game, s);
    },
    exportSave(game) {
      if (!hasSave()) return;
      if (!exportSave()) {
        game.importResult = { ok: false, message: 'Could not export save. No save data found.' };
      }
    },
    promptImport(game) {
      // Create a temporary file input. The browser's file dialog holds a
      // reference to it until the user selects a file or cancels, so it
      // survives the engine's render() call that fires after every action.
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const result = importSave(reader.result);
          if (result.ok) {
            game.importResult = { ok: true, message: 'Save imported. Reloading…' };
            game.render();
            setTimeout(() => { window.location.reload(); }, 800);
          } else {
            game.importResult = { ok: false, message: result.error || 'Import failed.' };
            game.render();
          }
        };
        reader.onerror = () => {
          game.importResult = { ok: false, message: 'Could not read the selected file.' };
          game.render();
        };
        reader.readAsText(file);
      };
      input.click();
    },
    promptDelete(game) {
      if (!hasSave()) return;
      if (window.confirm('Delete your save file? This cannot be undone. You can export your save first to keep a backup.')) {
        deleteSave();
        window.location.reload();
      }
    },
    loadAutosaveAction(game) {
      const s = loadAutosave();
      if (!s) return;
      resumeJourney(game, s);
    },
  },
};
