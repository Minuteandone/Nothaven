import { startCombat, heroAct, bestCombatant } from '../combat/engine.js';
import { HERO_ABILITIES } from '../combat/abilities.js';

const ABILITY_ORDER = ['attack', 'storm_slash', 'healing_breeze', 'defend'];

function statusChips(statObj) {
  const entries = Object.values(statObj || {});
  if (!entries.length) return '';
  return entries.map(s => `<span class="chip" title="${s.label}">${s.label} ${s.turns > 0 ? '(' + s.turns + ')' : ''}</span>`).join(' ');
}

export const combatScene = {
  onEnter(game, data = {}) {
    startCombat(game.state, data.enemyId || 'storm_rat', data);
  },
  render(game) {
    const c = game.state.combat;
    if (!c) return '<p>No combat in progress.</p>';
    const h = bestCombatant(game.state);
    const heroTurn = c.turn === 'hero' && !c.over;
    const abilityButtons = ABILITY_ORDER.map(id => {
      const a = HERO_ABILITIES[id];
      const disabled = !heroTurn || a.mp > h.mp;
      return `<button data-action="ability" data-arg="${id}" ${disabled ? 'disabled' : ''}>${a.name}${a.mp ? ' (' + a.mp + ' MP)' : ''}</button>`;
    }).join('');

    const controls = c.over
      ? `<button data-action="finish">Continue</button>`
      : `<div class="actions">${abilityButtons}<button data-action="flee" ${heroTurn ? '' : 'disabled'}>Flee</button></div>`;

    return `<div class="panel">
      <h2>Battle!</h2>
      <div class="stats">
        <span class="hp">${h.name} Lv ${h.level}: ${h.hp}/${h.maxHp} HP, ${h.mp}/${h.maxMp} MP</span>
        ${statusChips(c.statuses.hero)}
      </div>
      <div class="stats">
        <span class="dmg">${c.enemy.name}: ${c.enemy.hp} HP</span>
        ${statusChips(c.statuses.enemy)}
      </div>
      ${c.turn === 'enemy' && !c.over ? '<p class="turn">Enemy turn…</p>' : ''}
    </div>
    <div class="panel log">${c.log.map(l => `<p>${l}</p>`).join('')}</div>
    <div class="panel">${controls}</div>`;
  },
  actions: {
    ability(game, el) {
      heroAct(game.state, el.dataset.arg);
      if (game.state.combat?.over === 'victory') {
        // keep scene open so the player can read the log; finish() continues.
      }
    },
    flee(game) { heroAct(game.state, 'flee'); },
    finish(game) {
      const c = game.state.combat;
      const over = c.over;
      const returnScene = c.returnScene || 'town';
      game.state.combat = null;
      if (over === 'defeat') game.setScene('title');
      else game.setScene(returnScene, { message: over === 'victory' ? 'You return victorious.' : 'You slip back to town.' });
    },
  },
};
