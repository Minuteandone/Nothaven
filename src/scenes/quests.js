import { createStoryState, getJournal } from '../story/index.js';
import { escapeHTML, sceneHeader, uiButton } from '../ui/components.js';

const FILTERS = ['active', 'complete', 'all'];
const filterId = value => FILTERS.includes(value) ? value : 'active';
const returnScene = (game, value) => ['town', 'explore'].includes(value) && game.scenes?.[value] ? value : 'town';

/** A read-only view of the existing journal, including its available job offers. */
export function questJournalEntries(story, filter = 'active') {
  const entries = getJournal(story || createStoryState());
  const selected = filterId(filter);
  return selected === 'all' ? entries : entries.filter(entry => entry.status === selected);
}

export function renderQuestEntry(entry) {
  return `<li class="quest-entry">
    <div class="quest-entry__heading"><h2>${escapeHTML(entry.title)}</h2><span class="quest-entry__status">${entry.status === 'complete' ? 'Completed' : 'Active'}</span></div>
    <p>${escapeHTML(entry.objective)}</p>
  </li>`;
}

export const questJournalScene = {
  onEnter(game, data = {}) {
    game.questJournalFilter = 'active';
    game.questJournalReturn = returnScene(game, data.returnScene);
  },
  render(game) {
    const selected = filterId(game.questJournalFilter);
    const all = questJournalEntries(game.state.story, 'all');
    const entries = selected === 'all' ? all : all.filter(entry => entry.status === selected);
    const active = all.filter(entry => entry.status === 'active').length;
    const completed = all.filter(entry => entry.status === 'complete').length;
    const empty = selected === 'active' ? 'No active objectives in your journal.' : selected === 'complete' ? 'No completed objectives yet.' : 'A flock of dispatches gathered from every road. No journal entries yet.';
    return `<main class="game-shell quest-journal">
      ${sceneHeader({ title: 'Journey Journal', subtitle: 'Review your current objectives and the roads you have already opened.', iconName: 'journal' })}
      <section class="panel" aria-label="Journey objectives">
        <p class="quest-journal__counts">${active} active · ${completed} completed</p>
        <div class="quest-journal__filters" role="group" aria-label="Journal filters">
          ${FILTERS.map(id => `<button type="button" class="action-button action-button--ghost" data-action="filterQuests" data-arg="${id}" aria-pressed="${id === selected}">${id === 'active' ? 'Active' : id === 'complete' ? 'Completed' : 'All'}</button>`).join('')}
        </div>
        ${entries.length ? `<ul class="quest-list">${entries.map(renderQuestEntry).join('')}</ul>` : `<p class="empty-state">${empty}</p>`}
        <p class="quiet-note">This journal records your progress. Accept jobs and report completed work where the objective directs you.</p>
      </section>
      <div class="action-list">${uiButton({ action: 'leave', label: 'Back', iconName: 'compass' })}</div>
    </main>`;
  },
  actions: {
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
