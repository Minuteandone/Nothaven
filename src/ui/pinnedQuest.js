import { getPinnedQuest } from '../story/pinnedQuest.js';
import { escapeHTML, uiButton } from './components.js';

export function renderPinnedQuest(state, { journalAction, hasJournal = true } = {}) {
  const entry = getPinnedQuest(state);
  if (!entry) return '';
  return `<section class="panel pinned-objective" aria-labelledby="pinned-objective-title">
    <p class="eyebrow">Pinned objective · ${entry.status === 'complete' ? 'Completed' : 'Active'}</p>
    <h2 id="pinned-objective-title">${escapeHTML(entry.title)}</h2>
    <p>${escapeHTML(entry.objective)}</p>
    <div class="pinned-objective__actions">
      ${hasJournal && journalAction ? uiButton({ action: journalAction, label: 'Journey journal', iconName: 'journal', variant: 'ghost' }) : ''}
      ${uiButton({ action: 'unpinObjective', arg: entry.id, label: 'Unpin objective', variant: 'ghost' })}
    </div>
  </section>`;
}
