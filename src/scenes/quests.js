import { getPinnedQuest, pinQuest, unpinQuest } from '../story/pinnedQuest.js';
import { createStoryState, getJournal } from '../story/index.js';
import { escapeHTML, sceneHeader, uiButton } from '../ui/components.js';
import { bountyRecordText, bountySummaryText } from '../core/bounties.js';
import { townFeatsText } from './feats.js';
import { journalYardText } from './drills.js';

const FILTERS = ['active', 'complete', 'all'];
const filterId = value => FILTERS.includes(value) ? value : 'active';
const returnScene = (game, value) => ['town', 'explore'].includes(value) && game.scenes?.[value] ? value : 'town';

/** A read-only view of the existing journal, including its available job offers. */
export function questJournalEntries(story, filter = 'active') {
  const entries = getJournal(story || createStoryState());
  const selected = filterId(filter);
  return selected === 'all' ? entries : entries.filter(entry => entry.status === selected);
}

export function renderQuestEntry(entry, pinnedId = null) {
  const pinned = entry.id === pinnedId;
  const pinControl = entry.status === 'active'
    ? `<button type="button" class="action-button action-button--ghost quest-pin-button" data-action="pinObjective" data-arg="${escapeHTML(entry.id)}" aria-pressed="${pinned}" aria-label="${escapeHTML(`Pin objective: ${entry.title}`)}">${pinned ? 'Pinned objective' : 'Pin objective'}</button>`
    : pinned ? uiButton({ action: 'unpinObjective', arg: entry.id, label: 'Unpin objective', variant: 'ghost', className: 'quest-pin-button' }) : '';
  return `<li class="quest-entry">
    <div class="quest-entry__heading"><h2>${escapeHTML(entry.title)}</h2><span class="quest-entry__status">${entry.status === 'complete' ? 'Completed' : 'Active'}</span></div>
    <p>${escapeHTML(entry.objective)}</p>
    ${pinControl}
  </li>`;
}

export const questJournalScene = {
  onEnter(game, data = {}) {
    game.questJournalFilter = 'active';
    game.questJournalReturn = returnScene(game, data.returnScene);
  },
  render(game) {
    const selected = filterId(game.questJournalFilter);
    const pinned = getPinnedQuest(game.state);
    const bounty = bountySummaryText(game.state);
    const record = bountyRecordText(game.state);
    const feats = game.scenes?.feats ? townFeatsText(game.state) : null;
    const yard = game.scenes?.drills ? journalYardText(game.state) : null;
    const all = questJournalEntries(game.state.story, 'all');
    const entries = selected === 'all' ? all : all.filter(entry => entry.status === selected);
    const active = all.filter(entry => entry.status === 'active').length;
    const completed = all.filter(entry => entry.status === 'complete').length;
    const empty = selected === 'active' ? 'No active objectives in your journal.' : selected === 'complete' ? 'No completed objectives yet.' : 'No journal entries yet.';
    return `<main class="game-shell quest-journal">
      ${sceneHeader({ title: 'Journey Journal', subtitle: 'Review your current objectives and the roads you have already opened.', iconName: 'journal' })}
      <section class="panel" aria-label="Journey objectives">
        <p class="quest-journal__counts">${active} active · ${completed} completed</p>
        ${pinned ? `<p class="quest-pin-summary">Pinned: ${escapeHTML(pinned.title)}</p>` : ''}
        ${bounty ? `<p class="quest-bounty-summary" role="status">${escapeHTML(bounty)}</p>` : ''}
        ${record ? `<p class="quest-bounty-record">${escapeHTML(record)}</p>` : ''}
        ${feats ? `<p class="quest-feats">${escapeHTML(feats)}</p>` : ''}
        ${yard ? `<p class="quest-yard">${escapeHTML(yard)}</p>` : ''}
        <div class="quest-journal__filters" role="group" aria-label="Journal filters">
          ${FILTERS.map(id => `<button type="button" class="action-button action-button--ghost" data-action="filterQuests" data-arg="${id}" aria-pressed="${id === selected}">${id === 'active' ? 'Active' : id === 'complete' ? 'Completed' : 'All'}</button>`).join('')}
        </div>
        ${entries.length ? `<ul class="quest-list">${entries.map(entry => renderQuestEntry(entry, game.state.pinnedQuestId)).join('')}</ul>` : `<p class="empty-state">${empty}</p>`}
        <p class="quiet-note">This journal records your progress. Accept jobs and report completed work where the objective directs you. Pin one active objective to keep it visible in town and exploration. Completed pins stay marked completed until you remove them.</p>
      </section>
      <div class="action-list">${uiButton({ action: 'leave', label: 'Back', iconName: 'compass' })}</div>
    </main>`;
  },
  actions: {
    pinObjective(game, el) {
      if (game.state.scene !== 'quests' || game.state.combat) return;
      const id = el?.dataset?.arg;
      if (typeof id !== 'string' || !questJournalEntries(game.state.story).some(entry => entry.id === id)) return;
      if (game.state.pinnedQuestId === id) unpinQuest(game.state, id);
      else pinQuest(game.state, id);
    },
    unpinObjective(game, el) {
      if (game.state.scene === 'quests' && !game.state.combat) unpinQuest(game.state, el?.dataset?.arg);
    },
    filterQuests(game, el) { game.questJournalFilter = filterId(el?.dataset?.arg); },
    leave(game) {
      const target = returnScene(game, game.questJournalReturn);
      delete game.questJournalFilter;
      delete game.questJournalReturn;
      game.setScene(target);
    },
  },
};

export function installQuestJournal(game) { game.registerScene('quests', questJournalScene); }
