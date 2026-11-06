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
    return `<main class="game-shell title-screen">
      <div class="title-layout">
        <section class="title-copy">
          ${sceneHeader({ eyebrow: 'A turn-based expedition', title: 'Beacon of Stormhaven', subtitle: 'The storms have broken the beacon that shields Greyhaven. Someone must set it alight again.', iconName: 'beacon' })}
          <div class="title-actions">
            ${uiButton({ action: 'newGame', label: 'New journey', iconName: 'compass', variant: 'primary' })}
            ${uiButton({ action: 'continue', label: 'Continue', iconName: 'save', disabled: !hasSave() })}
            ${game?.scenes?.archive ? uiButton({ action: 'archive', label: 'Journey archive', iconName: 'save', variant: 'ghost' }) : ''}
            ${uiButton({ action: 'guide', label: 'How to play', iconName: 'journal', variant: 'ghost' })}
          </div>
          ${saveActions ? `<div class="title-save-actions">${saveActions}</div>` : ''}
          <p class="save-note">Single player <span aria-hidden="true">•</span> Your progress is saved on this device</p>
          <input type="file" id="save-import-input" accept=".json,application/json" style="display:none" aria-hidden="true">
        </section>
        <div class="title-art-frame">${beaconArt()}<span class="art-caption">Greyhaven waits beyond the storm</span></div>
      </div>
      <!-- Hidden import file input (positioned outside main flow so it stays accessible) -->
      <div id="save-import-overlay" class="save-import-overlay" style="display:none">
        <div class="save-import-dialog">
          <p id="save-import-message">Select a save file to import.</p>
          <div class="save-import-buttons">
            <button type="button" id="save-import-confirm" class="action-button action-button--primary">Choose file</button>
            <button type="button" id="save-import-cancel" class="action-button action-button--secondary">Cancel</button>
          </div>
        </div>
      </div>
    </main>`;
  },
  afterRender(game) {
    // Set up import file input handler
    const fileInput = document.getElementById('save-import-input');
    if (fileInput) {
      const handleFile = () => {
        const file = fileInput.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const result = importSave(reader.result);
          const msgEl = document.getElementById('save-import-message');
          if (result.ok) {
            if (msgEl) msgEl.textContent = 'Save imported. Reloading…';
            setTimeout(() => { window.location.reload(); }, 600);
          } else {
            if (msgEl) msgEl.textContent = result.error || 'Import failed.';
            // Re-show dialog buttons so user can retry
            const overlay = document.getElementById('save-import-overlay');
            if (overlay) overlay.style.display = '';
          }
        };
        reader.onerror = () => {
          const msgEl = document.getElementById('save-import-message');
          if (msgEl) msgEl.textContent = 'Could not read the selected file.';
        };
        reader.readAsText(file);
      };
      fileInput.addEventListener('change', handleFile);
    }
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
      exportSave(game.state);
    },
    promptImport(game) {
      const overlay = document.getElementById('save-import-overlay');
      if (overlay) overlay.style.display = 'flex';
      // Wire the choose-file button
      const confirmBtn = document.getElementById('save-import-confirm');
      const cancelBtn = document.getElementById('save-import-cancel');
      const fileInput = document.getElementById('save-import-input');
      const msgEl = document.getElementById('save-import-message');
      if (msgEl) msgEl.textContent = 'Select a save file to import. This will overwrite your current save.';
      if (confirmBtn && fileInput) {
        const newConfirm = confirmBtn.cloneNode(true);
        confirmBtn.parentNode.replaceChild(newConfirm, confirmBtn);
        newConfirm.addEventListener('click', () => {
          fileInput.click();
        });
      }
      if (cancelBtn) {
        const newCancel = cancelBtn.cloneNode(true);
        cancelBtn.parentNode.replaceChild(newCancel, cancelBtn);
        newCancel.addEventListener('click', () => {
          if (overlay) overlay.style.display = 'none';
        });
      }
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
