import { unpinQuest } from '../story/pinnedQuest.js';
import { renderPinnedQuest } from '../ui/pinnedQuest.js';
import { restPrice } from '../story/relay.js';
import { DIFFICULTIES, cycleDifficulty, getDifficulty } from '../combat/difficulty.js';
import { saveGame } from '../state.js';
import { effectiveStats } from '../items/equipment.js';
import { escapeHTML, partyStatus, resourceChip, sceneHeader, uiButton } from '../ui/components.js';
import { getTownOutlook } from '../story/outlook.js';
import { createStoryUI } from '../story/view.js';

const storyUI = createStoryUI(() => 'greyhaven');

export const townScene = {
  onEnter(game, data) { game.message = data?.message || ''; },
  render(game) {
    const s = game.state;
    const outlook = getTownOutlook(s.story);
    const price = restPrice(s.story);
    const message = game.message || 'Wind howls through the half-shuttered streets.';
    return `<main class="game-shell town-screen">
      ${sceneHeader({ eyebrow: 'Beacon Ward', title: 'Greyhaven', subtitle: 'A frontier town holding fast beneath a restless sky.', iconName: 'beacon' })}
      <div class="town-resource-row">${resourceChip({ iconName: 'coin', label: 'Gold', value: s.gold })}<span class="location-status"><span class="status-dot"></span> Shelter available</span></div>
      ${partyStatus(s.party)}
      ${renderPinnedQuest(s, { journalAction: 'questJournal', hasJournal: Boolean(game.scenes?.quests) })}
      <div class="town-grid">
        <article class="panel story-panel">
          <p class="eyebrow">The road ahead</p>
          <h2>${escapeHTML(outlook.title)}</h2>
          <p class="location-message" role="status">${escapeHTML(message)}</p>
          <div class="divider"></div>
          <p>${escapeHTML(outlook.text)}</p>
          <p class="quiet-note">${escapeHTML(outlook.hint)}</p>
        </article>
        <section class="panel action-panel" aria-labelledby="town-actions-title">
          <p class="eyebrow">Choose your next step</p>
          <h2 id="town-actions-title">Town actions</h2>
          <div class="action-list">
            ${uiButton({ action: 'rest', label: `Rest at the inn · ${price} gold`, iconName: 'bed', disabled: s.gold < price })}
            ${uiButton({ action: 'shop', label: "Hesta's Goods", iconName: 'coin', variant: 'ghost' })}
            ${game.scenes?.bag ? uiButton({ action: 'bag', label: 'Open your bag', iconName: 'bag', variant: 'ghost' }) : ''}
            ${game.scenes?.muster ? uiButton({ action: 'muster', label: 'Watch House muster board', iconName: 'shield', variant: 'ghost' }) : ''}
            ${game.scenes?.quests ? uiButton({ action: 'questJournal', label: 'Journey journal', iconName: 'journal', variant: 'ghost' }) : ''}
            ${game.scenes?.bestiary ? uiButton({ action: 'bestiary', label: "Warden's field journal", iconName: 'journal', variant: 'ghost' }) : ''}
            ${game.scenes?.character ? uiButton({ action: 'character', label: "Wren's character sheet", iconName: 'sword', variant: 'ghost' }) : ''}
            ${game.scenes?.feats ? uiButton({ action: 'feats', label: 'Wardens’ feats', iconName: 'beacon', variant: 'ghost' }) : ''}
            ${game.scenes?.forge ? uiButton({ action: 'forge', label: 'Greyhaven forge', iconName: 'shield', variant: 'ghost' }) : ''}
            ${game.scenes?.bounties ? uiButton({ action: 'bounties', label: 'Greyhaven bounty board', iconName: 'journal', variant: 'ghost' }) : ''}
            ${game.scenes?.drills ? uiButton({ action: 'drills', label: 'Sparring drills', iconName: 'sword', variant: 'ghost' }) : ''}
            ${game.scenes?.recipes ? uiButton({ action: 'recipes', label: 'Field recipe book', iconName: 'focus', variant: 'ghost' }) : ''}
            ${game.scenes?.ending && s.flags?.endingShown ? uiButton({ action: 'chronicle', label: 'Read the chronicle', iconName: 'journal', variant: 'ghost' }) : ''}
            ${uiButton({ action: 'explore', label: 'Explore the wilds', iconName: 'map', variant: 'primary' })}
            ${game.scenes?.archive ? uiButton({ action: 'archive', label: 'Journey archive', iconName: 'save', variant: 'ghost' }) : ''}
            ${uiButton({ action: 'save', label: 'Save journey', iconName: 'save', variant: 'ghost' })}
            ${uiButton({ action: 'difficulty', label: `Difficulty: ${DIFFICULTIES[getDifficulty(s)].label}`, iconName: 'shield', variant: 'ghost' })}
          </div>
        </section>
      </div>
      ${storyUI.render(game)}
    </main>`;
  },
  actions: {
    unpinObjective(game, el) { if (game.state.scene === 'town' && !game.state.combat) unpinQuest(game.state, el?.dataset?.arg); },
    archive(game) { if (game.state.scene === 'town' && game.scenes?.archive && !game.state.combat) game.setScene('archive', { returnScene: 'town' }); },
    rest(game) {
      const s = game.state, price = restPrice(s.story); if (s.gold < price) return;
      s.gold -= price; s.party.forEach(p => { const st = effectiveStats(p); p.hp = st.maxHp || p.maxHp; p.mp = st.maxMp || p.maxMp; p.statuses = []; });
      game.message = 'You rest at the inn and wake refreshed.';
    },
    shop(game) { game.setScene('shop', { returnScene: 'town' }); },
    bag(game) { if (game.scenes?.bag) game.setScene('bag', { returnScene: 'town' }); },
    muster(game) { if (game.scenes?.muster) game.setScene('muster', { returnScene: 'town' }); },
    feats(game) { if (game.scenes?.feats) game.setScene('feats', { returnScene: 'town' }); },
    bounties(game) { if (game.scenes?.bounties) game.setScene('bounties'); },
    drills(game) { if (game.scenes?.drills) game.setScene('drills'); },
    forge(game) { if (game.scenes?.forge) game.setScene('forge', { returnScene: 'town' }); },
    questJournal(game) { if (game.scenes?.quests) game.setScene('quests', { returnScene: 'town' }); },
    bestiary(game) { if (game.scenes?.bestiary) game.setScene('bestiary', { returnScene: 'town' }); },
    character(game) { if (game.scenes?.character) game.setScene('character', { returnScene: 'town' }); },
    recipes(game) { if (game.scenes?.recipes) game.setScene('recipes', { returnScene: 'town' }); },
    chronicle(game) { if (game.scenes?.ending && game.state.flags?.endingShown) game.setScene('ending', { returnScene: 'town' }); },
    explore(game) { game.setScene('explore'); },
    save(game) { saveGame(game.state); game.message = 'Game saved.'; },
    difficulty(game) { const id = cycleDifficulty(game.state); game.message = `Difficulty set to ${DIFFICULTIES[id].label}. ${DIFFICULTIES[id].blurb}`; },
    ...storyUI.actions,
  },
};
