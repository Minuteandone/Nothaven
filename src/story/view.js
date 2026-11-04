import { getWatchJournal, watchAvailable, watchReady, WATCH_GOLD } from './watch.js';
import { getHeartJournal, heartReady, HEART_GOLD } from './heart.js';
import { COMMISSIONS, getCommission, commissionProgress, commissionObjective } from './commissions.js';
import { getSpireJournal, spireReady, SPIRE_GOLD } from './spire.js';
import { EXPEDITIONS, expeditionAvailable, activeExpedition, getExpeditionJournal } from './expeditions.js';
import { getRelayJournal, getRelayChoices } from './relay.js';
import { getRescueJournal, rescueReady, RESCUE_GOLD } from './rescue.js';
import { createStoryState, getDialogue, getEndingChoices, getJournal } from './index.js';
import { getReliefQuest, reliefSupplies } from './relief.js';
import { dispatchReliefHandIn, dispatchStoryEvent } from './integration.js';

const escape = value => String(value ?? '').replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const npcNames = { mara: 'Warden Mara', iven: 'Iven', tamsin: 'Tamsin' };

// Console choices must reject stale buttons after the player walks away.
const atRelayConsole = (game, location) => location === 'sunscar_relay'
  && game.state.map?.zoneId === 'sunscar_relay'
  && Math.abs(game.state.map.x - 7) + Math.abs(game.state.map.y - 3) <= 1;

/** Share the same location getter between rendering and action validation. */
export function createStoryUI(getLocation = game => game.state.location) {
  return {
    render(game) {
      const state = game.state.story || createStoryState();
      const location = getLocation(game);
      const dialogue = game.storyDialogue?.location === location ? game.storyDialogue : null;
      const talkButtons = location === 'greyhaven' ? `<div class="story-people" aria-label="People in Greyhaven">${Object.entries(npcNames).map(([id, name]) => `<button data-action="storyTalk" data-arg="${id}">Speak to ${name}</button>`).join('')}</div>` : '';
      const relief = getReliefQuest(state);
      const rescue = getRescueJournal(state)[0];
      const relay = getRelayJournal(state)[0];
      const spire = getSpireJournal(state)[0];
      const heart = getHeartJournal(state)[0];
      const watch = getWatchJournal(state)[0];
      const expedition = getExpeditionJournal(state)[0];
      const active = activeExpedition(state);
      const commissions = COMMISSIONS.map(c => commissionProgress(state, c.id)).filter(c => c.available);
      const relayChoices = atRelayConsole(game, location) ? getRelayChoices(state) : [];
      const choices = location === 'beacon_tower' ? getEndingChoices(state) : [];
      return `<section class="panel story-panel" aria-labelledby="story-heading">
        <h2 id="story-heading">The Beacon and the Storm</h2>
        ${talkButtons}
        ${location === 'greyhaven' && relief?.status === 'active' ? `<section aria-label="First Light Relief"><h3>First Light Relief</h3><p>${escape(relief.objective)}</p><p>${escape(reliefSupplies(game.state.inventory))}</p><button data-action="storyRelief">Hand over 2 rations + 1 bandage for 30 gold</button></section>` : ''}
        ${location === 'greyhaven' && rescue?.status === 'active' ? `<section aria-label="Roads to Our Neighbors"><h3>Roads to Our Neighbors</h3><p>${escape(rescue.objective)}</p>${!state.flags.rescue_accepted ? '<button data-action="storyRescue" data-arg="accept">Accept Mara’s relief expedition</button>' : rescueReady(state) ? `<button data-action="storyRescue" data-arg="report">Report both routes to Mara for ${RESCUE_GOLD} gold</button>` : ''}</section>` : ''}
        ${location === 'greyhaven' && relay?.status === 'active' ? `<section aria-label="A Signal of Our Own"><h3>A Signal of Our Own</h3><p>${escape(relay.objective)}</p>${!state.flags.relay_accepted ? '<button data-action="storyRelayAccept">Accept the council’s relay commission</button>' : ''}</section>` : ''}
        ${location === 'greyhaven' && spire?.status === 'active' ? `<section aria-label="Above the Gathering Storm"><h3>Above the Gathering Storm</h3><p>${escape(spire.objective)}</p>${!state.flags.spire_accepted ? '<button data-action="storySpire" data-arg="accept">Accept Mara’s summit survey</button>' : spireReady(state) ? `<button data-action="storySpire" data-arg="report">Report the summit survey for ${SPIRE_GOLD} gold</button>` : ''}</section>` : ''}
        ${location === 'greyhaven' && heart?.status === 'active' ? `<section aria-label="The Storm’s Heart"><h3>The Storm’s Heart</h3><p>${escape(heart.objective)}</p>${!state.flags.heart_accepted ? '<button data-action="storyHeart" data-arg="accept">Accept Mara’s Storm’s Eye expedition</button>' : heartReady(state) ? `<button data-action="storyHeart" data-arg="report">Report the Storm’s Eye expedition for ${HEART_GOLD} gold</button>` : ''}</section>` : ''}
        ${location === 'greyhaven' && watch?.status === 'active' ? `<section aria-label="The Long Watch"><h3>The Long Watch</h3><p>${escape(watch.objective)}</p>${state.flags.watch_accepted !== true ? '<button data-action="storyWatch" data-arg="accept">Accept The Long Watch survey</button>' : watchReady(state) ? `<button data-action="storyWatch" data-arg="report">Report the three readings for ${WATCH_GOLD} gold</button>` : ''}</section>` : ''}
        ${location === 'greyhaven' && expedition ? `<section aria-label="Greyhaven Expedition Board"><h3>Greyhaven Expedition Board</h3><p>${escape(expedition.objective)}</p>${active ? `${active.progress === active.goal ? `<button data-action="storyExpedition" data-arg="claim">Claim ${active.gold} gold for ${escape(active.title)}</button>` : ''}<button data-action="storyExpedition" data-arg="cancel">Cancel patrol — discard progress without payment</button>` : EXPEDITIONS.filter(c => expeditionAvailable(state, c.id)).map(c => `<button data-action="storyExpedition" data-arg="${c.id}">Accept ${escape(c.title)} — ${c.goal} ${escape(c.enemyName)} for ${c.gold} gold</button>`).join('')}</section>` : ''}
        ${location === 'greyhaven' && commissions.length ? `<details class="companion-commissions"><summary>Companion commissions</summary><p>Optional personal requests. Earlier accomplishments count; no companion must occupy a party slot.</p>${commissions.map(c => `<section aria-label="${escape(c.title)}"><h3>${escape(c.name)}: ${escape(c.title)}${c.complete ? ' (complete)' : ''}</h3><p>${escape(commissionObjective(state, c.id))}</p>${!c.accepted && !c.complete ? `<button data-action="storyCommissionAccept" data-arg="${c.id}">Accept ${escape(c.name)}’s request — ${c.gold} gold</button>` : c.ready ? `<button data-action="storyCommissionReport" data-arg="${c.id}">Report to ${escape(c.name)} for ${c.gold} gold</button>` : ''}</section>`).join('')}</details>` : ''}
        ${relayChoices.length ? `<section aria-labelledby="relay-choice-heading"><h3 id="relay-choice-heading">Who will the inland relay serve?</h3><p>Choose one permanent benefit and receive 100 gold. This cannot be changed in this save. Your original beacon decision remains unchanged.</p>${relayChoices.map(choice => `<div class="story-choice"><p>${escape(choice.description)}</p><button data-action="storyRelayChoose" data-arg="${escape(choice.id)}">${escape(choice.label)}</button></div>`).join('')}</section>` : ''}
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
      storyRescue(game, element) {
        if (getLocation(game) !== 'greyhaven') return;
        const action = element?.dataset?.arg;
        if (!['accept', 'report'].includes(action)) return;
        game.storyDialogue = null;
        dispatchStoryEvent(game, { type: `rescue-${action}` });
      },
      storyHeart(game, element) {
        if (getLocation(game) !== 'greyhaven') return;
        const action = element?.dataset?.arg;
        if (!['accept', 'report'].includes(action)) return;
        game.storyDialogue = null;
        dispatchStoryEvent(game, { type: `heart-${action}` });
      },
      storyWatch(game, element) {
        if (getLocation(game) !== 'greyhaven') return;
        const action = element?.dataset?.arg;
        if (!['accept', 'report'].includes(action)) return;
        const story = game.state.story;
        if (!watchAvailable(story) || story.flags.watch_reward === true) return;
        if (action === 'accept' ? story.flags.watch_accepted === true : !watchReady(story)) return;
        game.storyDialogue = null;
        dispatchStoryEvent(game, { type: `watch-${action}` });
      },
      storySpire(game, element) {
        if (getLocation(game) !== 'greyhaven') return;
        const action = element?.dataset?.arg;
        if (!['accept', 'report'].includes(action)) return;
        game.storyDialogue = null;
        dispatchStoryEvent(game, { type: `spire-${action}` });
      },
      storyCommissionAccept(game, element) {
        if (getLocation(game) !== 'greyhaven') return;
        const c = getCommission(element?.dataset?.arg);
        if (!c) return;
        game.storyDialogue = null;
        dispatchStoryEvent(game, { type: 'commission-accept', companionId: c.id,
          previouslyCleared: game.state.map?.clearedEncounters?.[c.encounterId] === true,
          previouslyInspected: game.state.map?.completedInteractions?.[c.interactionId] === true });
      },
      storyCommissionReport(game, element) {
        if (getLocation(game) !== 'greyhaven') return;
        const c = getCommission(element?.dataset?.arg);
        if (!c) return;
        game.storyDialogue = null;
        dispatchStoryEvent(game, { type: 'commission-report', companionId: c.id });
      },
      storyExpedition(game, element) {
        if (getLocation(game) !== 'greyhaven') return;
        const arg = element?.dataset?.arg;
        const isContract = EXPEDITIONS.some(c => c.id === arg);
        if (!isContract && !['claim', 'cancel'].includes(arg)) return;
        if (isContract && !expeditionAvailable(game.state.story, arg)) return;
        game.storyDialogue = null;
        dispatchStoryEvent(game, isContract ? { type: 'expedition-accept', contractId: arg } : { type: `expedition-${arg}` });
      },
      storyRelayAccept(game) {
        if (getLocation(game) !== 'greyhaven') return;
        game.storyDialogue = null;
        dispatchStoryEvent(game, { type: 'relay-accept' });
      },
      storyRelayChoose(game, element) {
        if (!atRelayConsole(game, getLocation(game))) return;
        const choiceId = element?.dataset?.arg;
        if (!getRelayChoices(game.state.story || createStoryState()).some(choice => choice.id === choiceId)) return;
        game.storyDialogue = null;
        dispatchStoryEvent(game, { type: 'relay-choose', choiceId });
      },
      storyRelief(game) {
        if (getLocation(game) !== 'greyhaven') return;
        dispatchReliefHandIn(game, getLocation(game));
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
