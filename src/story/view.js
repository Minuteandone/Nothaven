import { createStoryState, getDialogue, getEndingChoices, getJournal } from './index.js';
import { dispatchStoryEvent } from './integration.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const npcNames = { mara: 'Warden Mara', iven: 'Iven', tamsin: 'Tamsin' };

/** Share the same location getter between rendering and action validation. */
export function createStoryUI(getLocation = game => game.state.location) {
  return {
    render(game) {
      const state = game.state.story || createStoryState();
      const location = getLocation(game);
      const dialogue = game.storyDialogue?.location === location ? game.storyDialogue : null;
      const talkButtons = location === 'greyhaven' ? `<div class="story-people" aria-label="People in Greyhaven">${Object.entries(npcNames).map(([id, name]) => `<button data-action="storyTalk" data-arg="${id}">Speak to ${name}</button>`).join('')}</div>` : '';
      const choices = location === 'beacon_tower' ? getEndingChoices(state) : [];
      return `<section class="panel story-panel" aria-labelledby="story-heading">
        <h2 id="story-heading">The Beacon and the Storm</h2>
        ${talkButtons}
        ${dialogue ? `<div class="story-dialogue" aria-live="polite"><h3>${escape(dialogue.speaker)}</h3><p>${escape(dialogue.text)}</p><button data-action="storyDismiss">Close conversation</button></div>` : ''}
        ${game.storyMessage ? `<p class="story-update" role="status">${escape(game.storyMessage)}</p>` : ''}
        ${choices.length ? `<section aria-labelledby="beacon-choice-heading"><h3 id="beacon-choice-heading">Where will the light reach?</h3><p>This choice completes the chapter and cannot be changed in this save.</p>${choices.map(choice => `<div class="story-choice"><p>${escape(choice.description)}</p><button data-action="storyChoose" data-arg="${escape(choice.id)}">${escape(choice.label)}</button></div>`).join('')}</section>` : ''}
        <details class="quest-journal" open><summary>Quest journal</summary><ul>${getJournal(state).map(quest => `<li><h3>${escape(quest.title)} <small>(${escape(quest.status)})</small></h3><p>${escape(quest.objective)}</p></li>`).join('')}</ul></details>
      </section>`;
    },
    actions: {
      storyTalk(game, element) {
        if (getLocation(game) !== 'greyhaven') return;
        const npcId = element?.dataset?.arg;
        const dialogue = getDialogue(game.state.story || createStoryState(), npcId);
        if (!dialogue) return;
        game.storyMessage = '';
        game.storyDialogue = { ...dialogue, location: 'greyhaven' };
        dispatchStoryEvent(game, { type: 'talk', npcId });
      },
      storyDismiss(game) { game.storyDialogue = null; },
      storyChoose(game, element) {
        if (getLocation(game) !== 'beacon_tower') return;
        const choiceId = element?.dataset?.arg;
        if (!getEndingChoices(game.state.story || createStoryState()).some(choice => choice.id === choiceId)) return;
        game.storyDialogue = null;
        dispatchStoryEvent(game, { type: 'choose', choiceId });
      },
    },
  };
}
