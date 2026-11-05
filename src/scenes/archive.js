import { ARCHIVE_SLOTS, readArchiveSlot, writeArchiveSlot, deleteArchiveSlot } from '../core/archive.js';
import { resumeJourney } from '../core/resume.js';
import { ZONES } from '../map/zones.js';
import { escapeHTML, sceneHeader, uiButton } from '../ui/components.js';

const allowedReturn = (game, value) => ['title', 'town', 'explore'].includes(value) && game.scenes?.[value] ? value : 'title';
const active = game => game.state?.scene === 'archive' && !game.state.combat;
const canSave = game => active(game) && ['town', 'explore'].includes(game.archiveReturn) && Boolean(game.scenes?.[game.archiveReturn]);
const validId = id => typeof id === 'string' && ARCHIVE_SLOTS.includes(id);
const getSlot = (game, id) => readArchiveSlot(id, game.archiveStorage);
function clear(game) {
  delete game.archiveReturn;
  delete game.archivePending;
  delete game.archiveMessage;
}
function resultMessage(result, success) {
  return result.ok ? success : result.reason === 'changed'
    ? 'This slot changed since you selected it. Review it and try again.'
    : 'Device storage is unavailable. No archive changes were made.';
}
function save(game, id, raw) {
  const snapshot = { ...game.state, scene: game.archiveReturn };
  const result = writeArchiveSlot(id, snapshot, raw, { storage: game.archiveStorage });
  game.archiveMessage = resultMessage(result, `Journey saved to slot ${id}. Your quick save is unchanged.`);
}
function request(game, operation, id) {
  if (!active(game) || !validId(id) || (operation === 'save' && !canSave(game))) return;
  const slot = getSlot(game, id);
  if (slot.status === 'unavailable') {
    game.archiveMessage = 'Device storage is unavailable.';
    return;
  }
  if (operation === 'load' && slot.status !== 'ready') return;
  if (operation === 'delete' && !['ready', 'invalid'].includes(slot.status)) return;
  game.archiveMessage = '';
  game.archivePending = null;
  if (operation === 'save' && slot.status === 'empty') save(game, id, slot.raw);
  else game.archivePending = { operation, id, raw: slot.raw };
}
function preview(slot) {
  if (slot.status === 'empty') return '<p>Empty slot</p>';
  if (slot.status === 'unavailable') return '<p>Device storage is unavailable.</p>';
  if (slot.status !== 'ready') return '<p>This slot cannot be read. You may replace or delete it.</p>';
  const state = slot.state, hero = state.party[0];
  const location = Object.hasOwn(ZONES, state.location) ? ZONES[state.location].name : 'Unknown location';
  const ending = state.story?.ending === 'protect_town' ? 'Shielded Town' : state.story?.ending === 'share_signal' ? 'Lanterns on the Horizon' : 'Not yet chosen';
  return `<dl class="archive-preview">
    <div><dt>Warden</dt><dd>${escapeHTML(hero.name)} · Level ${escapeHTML(hero.level)}</dd></div>
    <div><dt>Location</dt><dd>${escapeHTML(location)}</dd></div>
    <div><dt>Gold</dt><dd>${escapeHTML(state.gold)}</dd></div>
    <div><dt>Story stage</dt><dd>${escapeHTML(state.story?.stage || 'briefing')}</dd></div>
    <div><dt>Beacon choice</dt><dd>${escapeHTML(ending)}</dd></div>
    <div><dt>Saved (UTC)</dt><dd>${escapeHTML(new Date(slot.savedAt).toISOString().replace('T', ' ').replace('.000Z', ' UTC'))}</dd></div>
  </dl>`;
}
function confirmation(pending) {
  if (!pending || !validId(pending.id) || !['save', 'load', 'delete'].includes(pending.operation)) return '';
  const { operation, id } = pending;
  const text = operation === 'save' ? `Replace slot ${id} with your current journey? The previous checkpoint in this slot will be lost.`
    : operation === 'delete' ? `Delete slot ${id}? This checkpoint cannot be recovered.`
      : `Load slot ${id}? Loading replaces your current unsaved journey. Your quick save and other slots will not change.`;
  const verb = operation === 'save' ? 'overwrite' : operation;
  return `<section class="panel archive-confirm" role="group" aria-label="Confirm archive action">
    <h2>Confirm ${verb}</h2><p>${text}</p><div class="archive-buttons">
      ${uiButton({ action: 'confirmArchive', label: `Confirm ${verb} slot ${id}`, iconName: 'save' })}
      ${uiButton({ action: 'cancelArchive', label: 'Cancel', iconName: 'compass', variant: 'ghost' })}
    </div></section>`;
}

export const archiveScene = {
  onEnter(game, data = {}) {
    game.archiveReturn = allowedReturn(game, data.returnScene);
    game.archivePending = null;
    game.archiveMessage = '';
  },
  render(game) {
    return `<main class="game-shell journey-archive">
      ${sceneHeader({ title: 'Journey Archive', subtitle: 'Keep three manual checkpoints without replacing your quick save.', iconName: 'save' })}
      <p>Save journey and Continue still use your separate quick save. Archive slots stay on this device; nothing is saved automatically.</p>
      ${game.archiveReturn === 'title' ? '<p>Open the archive from town or exploration to save your current journey.</p>' : ''}
      <p role="status">${escapeHTML(game.archiveMessage || '')}</p>
      ${confirmation(game.archivePending)}
      <div class="archive-grid">${ARCHIVE_SLOTS.map(id => {
        const slot = getSlot(game, id);
        return `<section class="panel archive-card" aria-labelledby="archive-slot-${id}">
          <h2 id="archive-slot-${id}">Slot ${id}</h2>${preview(slot)}<div class="archive-buttons">
          ${uiButton({ action: 'saveArchive', arg: id, label: `Save to slot ${id}`, iconName: 'save', disabled: !canSave(game) || slot.status === 'unavailable' })}
          ${uiButton({ action: 'loadArchive', arg: id, label: `Load slot ${id}`, iconName: 'compass', disabled: slot.status !== 'ready', variant: 'ghost' })}
          ${uiButton({ action: 'deleteArchive', arg: id, label: `Delete slot ${id}`, iconName: 'bag', disabled: !['ready', 'invalid'].includes(slot.status), variant: 'ghost' })}
          </div></section>`;
      }).join('')}</div>
      <div class="action-list">${uiButton({ action: 'leaveArchive', label: 'Back', iconName: 'compass', variant: 'ghost' })}</div>
    </main>`;
  },
  actions: {
    saveArchive(game, el) { request(game, 'save', el?.dataset?.arg); },
    loadArchive(game, el) { request(game, 'load', el?.dataset?.arg); },
    deleteArchive(game, el) { request(game, 'delete', el?.dataset?.arg); },
    cancelArchive(game) { if (active(game)) game.archivePending = null; },
    confirmArchive(game) {
      if (!active(game)) return;
      const pending = game.archivePending;
      if (!pending || !validId(pending.id) || !['save', 'load', 'delete'].includes(pending.operation)
        || (pending.operation === 'save' && !canSave(game))) return;
      const slot = getSlot(game, pending.id);
      if (slot.status === 'unavailable' || slot.raw !== pending.raw) {
        game.archiveMessage = slot.status === 'unavailable' ? 'Device storage is unavailable.' : 'This slot changed since you selected it. Review it and try again.';
        game.archivePending = null;
        return;
      }
      game.archivePending = null;
      if (pending.operation === 'save') save(game, pending.id, pending.raw);
      else if (pending.operation === 'delete') {
        game.archiveMessage = resultMessage(deleteArchiveSlot(pending.id, pending.raw, game.archiveStorage), `Slot ${pending.id} deleted. Your quick save is unchanged.`);
      } else if (slot.status === 'ready') {
        clear(game);
        resumeJourney(game, slot.state);
      }
    },
    leaveArchive(game) {
      if (!active(game)) return;
      const target = allowedReturn(game, game.archiveReturn);
      clear(game);
      game.setScene(target);
    },
  },
};
export function installJourneyArchive(game) { game.registerScene('archive', archiveScene); }
