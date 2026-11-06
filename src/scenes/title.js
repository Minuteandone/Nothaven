import { createInitialState, loadGame, hasSave, hasAutosave, loadAutosave, isAutosaveEnabled, enableAutosave, disableAutosave } from '../state.js';
import { beaconArt, escapeHTML, sceneHeader, uiButton } from '../ui/components.js';
import { resumeJourney } from '../core/resume.js';
import { exportSave, validateImportSave, commitImportSave, deleteSave } from '../core/saveManager.js';

function clearStoryTransients(game) {
  game.storyDialogue = null;
  game.storyMessage = '';
}

function buildSaveActions(hasExistingSave, hasExistingAutosave) {
  const buttons = [];
  // Always show Import so fresh devices can load a save
  buttons.push(uiButton({ action: 'promptImport', label: 'Import save', iconName: 'upload', variant: 'secondary' }));
  if (hasExistingSave) {
    buttons.push(uiButton({ action: 'exportSave', label: 'Export save', iconName: 'download', variant: 'secondary' }));
    buttons.push(uiButton({ action: 'promptDelete', label: 'Delete save', iconName: 'trash', variant: 'danger' }));
  }
  // Autosave toggle available for both new and continuing journeys
  const autosaveOn = isAutosaveEnabled();
  buttons.push(uiButton({ action: 'toggleAutosave', label: autosaveOn ? 'Autosave: ON' : 'Autosave: OFF', iconName: 'save', variant: autosaveOn ? 'secondary' : 'ghost' }));
  if (hasExistingAutosave) {
    buttons.push(uiButton({ action: 'loadAutosaveAction', label: 'Restore autosave', iconName: 'save', variant: 'ghost' }));
  }
  return buttons.join('');
}

function importPreviewBlock(preview) {
  const rows = [
    ['Hero', escapeHTML(preview.heroName)],
    ['Level', String(preview.level)],
    ['Location', escapeHTML(preview.location)],
    ['Scene', escapeHTML(preview.scene)],
    ['Gold', String(preview.gold)],
    ['Party', `${preview.partyCount} member${preview.partyCount !== 1 ? 's' : ''}`],
    ['Save version', String(preview.saveVersion)],
  ];
  return `<div class="import-preview" role="region" aria-label="Import preview">
    <h3>Import this save?</h3>
    <p class="import-warning">This will replace your current save on this device.</p>
    <dl class="import-preview__details">
      ${rows.map(([label, value]) => `<div><dt>${escapeHTML(label)}</dt><dd>${value}</dd></div>`).join('')}
    </dl>
    <div class="import-preview__actions">
      ${uiButton({ action: 'confirmImport', label: 'Confirm import', iconName: 'check', variant: 'primary' })}
      ${uiButton({ action: 'cancelImport', label: 'Cancel', iconName: 'x', variant: 'ghost' })}
    </div>
  </div>`;
}

export const titleScene = {
  render(game) {
    const saveActions = buildSaveActions(hasSave(), hasAutosave());
    let banner = '';
    if (game && game.importResult) {
      const r = game.importResult;
      banner = `<div role="alert" class="import-banner import-banner--${r.ok ? 'success' : 'error'}">${escapeHTML(r.message)}</div>`;
    }
    const previewBlock = (game && game.pendingImportPreview)
      ? importPreviewBlock(game.pendingImportPreview)
      : '';
    return `<main class="game-shell title-screen">
      <div class="title-layout">
        <section class="title-copy">
          ${sceneHeader({ eyebrow: 'A turn-based expedition', title: 'Beacon of Stormhaven', subtitle: 'The storms have broken the beacon that shields Greyhaven. Someone must set it alight again.', iconName: 'beacon' })}
          ${banner}
          ${previewBlock}
          <div class="title-actions">
            ${uiButton({ action: 'newGame', label: 'New journey', iconName: 'compass', variant: 'primary' })}
            ${uiButton({ action: 'continue', label: 'Continue', iconName: 'save', disabled: !hasSave() })}
            ${game?.scenes?.archive ? uiButton({ action: 'archive', label: 'Journey archive', iconName: 'save', variant: 'ghost' }) : ''}
            ${uiButton({ action: 'guide', label: 'How to play', iconName: 'journal', variant: 'ghost' })}
          </div>
          <div class="title-save-actions">${saveActions}</div>
          <p class="save-note">Single player <span aria-hidden="true">•</span> Your progress is saved on this device</p>
        </section>
        <div class="title-art-frame">${beaconArt()}<span class="art-caption">Greyhaven waits beyond the storm</span></div>
      </div>
    </main>`;
  },
  actions: {
    archive(game) { if (game.state.scene === 'title' && game.scenes?.archive && !game.state.combat) game.setScene('archive', { returnScene: 'title' }); },
    guide(game) { if (game.scenes?.guide) game.setScene('guide', { returnScene: 'title' }); },
    newGame(game) {
      game.state = createInitialState();
      clearStoryTransients(game);
      // Clear any pending import
      delete game.pendingImportRaw;
      delete game.pendingImportPreview;
      delete game.importResult;
      game.setScene('town');
    },
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
      // Clean up any stale import state
      delete game.pendingImportRaw;
      delete game.pendingImportPreview;
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const file = input.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
          const validation = validateImportSave(reader.result);
          if (!validation.ok) {
            game.importResult = { ok: false, message: validation.error || 'Import failed.' };
            game.render();
            return;
          }
          // Store raw JSON and preview; show confirmation UI
          game.pendingImportRaw = reader.result;
          game.pendingImportPreview = validation.preview;
          delete game.importResult;
          game.render();
        };
        reader.onerror = () => {
          game.importResult = { ok: false, message: 'Could not read the selected file.' };
          game.render();
        };
        reader.readAsText(file);
      };
      input.click();
    },
    confirmImport(game) {
      if (!game.pendingImportRaw) return;
      const result = commitImportSave(game.pendingImportRaw);
      if (result.ok) {
        game.importResult = { ok: true, message: 'Save imported. Reloading…' };
      } else {
        game.importResult = { ok: false, message: result.error || 'Could not write save.' };
      }
      delete game.pendingImportRaw;
      delete game.pendingImportPreview;
      game.render();
      if (result.ok) setTimeout(() => { window.location.reload(); }, 800);
    },
    cancelImport(game) {
      delete game.pendingImportRaw;
      delete game.pendingImportPreview;
      game.render();
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
    toggleAutosave(game) {
      if (isAutosaveEnabled()) {
        disableAutosave();
      } else {
        enableAutosave();
      }
      game.render();
    },
  },
};
