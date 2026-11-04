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
    const message = game.message || 'Wind howls through the half-shuttered streets.';
    return `<main class="game-shell town-screen">
      ${sceneHeader({ eyebrow: 'Beacon Ward', title: 'Greyhaven', subtitle: 'A frontier town holding fast beneath a restless sky.', iconName: 'beacon' })}
      <div class="town-resource-row">${resourceChip({ iconName: 'coin', label: 'Gold', value: s.gold })}<span class="location-status"><span class="status-dot"></span> Shelter available</span></div>
      ${partyStatus(s.party)}
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
            ${uiButton({ action: 'rest', label: 'Rest at the inn · 5 gold', iconName: 'bed', disabled: s.gold < 5 })}
            ${uiButton({ action: 'shop', label: "Hesta's Goods", iconName: 'coin', variant: 'ghost' })}
            ${game.scenes?.bag ? uiButton({ action: 'bag', label: 'Open your bag', iconName: 'bag', variant: 'ghost' }) : ''}
            ${game.scenes?.muster ? uiButton({ action: 'muster', label: 'Watch House muster board', iconName: 'shield', variant: 'ghost' }) : ''}
            ${uiButton({ action: 'explore', label: 'Explore the wilds', iconName: 'map', variant: 'primary' })}
            ${uiButton({ action: 'save', label: 'Save journey', iconName: 'save', variant: 'ghost' })}
          </div>
        </section>
      </div>
      ${storyUI.render(game)}
    </main>`;
  },
  actions: {
    rest(game) {
      const s = game.state; if (s.gold < 5) return;
      s.gold -= 5; s.party.forEach(p => { const st = effectiveStats(p); p.hp = st.maxHp || p.maxHp; p.mp = st.maxMp || p.maxMp; p.statuses = []; });
      game.message = 'You rest at the inn and wake refreshed.';
    },
    shop(game) { game.setScene('shop', { returnScene: 'town' }); },
    bag(game) { if (game.scenes?.bag) game.setScene('bag', { returnScene: 'town' }); },
    muster(game) { if (game.scenes?.muster) game.setScene('muster', { returnScene: 'town' }); },
    explore(game) { game.setScene('explore'); },
    save(game) { saveGame(game.state); game.message = 'Game saved.'; },
    ...storyUI.actions,
  },
};
