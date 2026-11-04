import { saveGame } from '../state.js';

export const townScene = {
  onEnter(game, data) { game.message = data?.message || ''; },
  render(game) {
    const s = game.state, h = s.party[0];
    return `<div class="panel"><h2>Greyhaven</h2>
      <div class="stats"><span>${h.name} Lv ${h.level}</span><span class="hp">HP ${h.hp}/${h.maxHp}</span>
      <span>MP ${h.mp}/${h.maxMp}</span><span>XP ${h.xp}</span><span>Gold ${s.gold}</span></div>
      <p>${game.message || 'Wind howls through the half-shuttered streets.'}</p>
      <button data-action="rest" ${s.gold < 5 ? 'disabled' : ''}>Rest at Inn (5g)</button>
      <button data-action="explore">Explore the Wilds</button>
      <button data-action="save">Save Game</button></div>`;
  },
  actions: {
    rest(game) {
      const s = game.state; if (s.gold < 5) return;
      s.gold -= 5; s.party.forEach(p => { p.hp = p.maxHp; p.mp = p.maxMp; });
      game.message = 'You rest at the inn and wake refreshed.';
    },
    explore(game) { game.setScene(game.scenes.explore ? 'explore' : 'combat', game.scenes.explore ? undefined : { enemyId: 'storm_rat' }); },
    save(game) { saveGame(game.state); game.message = 'Game saved.'; },
  },
};
