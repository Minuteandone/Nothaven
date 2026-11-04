import { ENEMIES } from '../data/enemies.js';

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const dmg = (atk, def, defending) => Math.max(1, Math.floor((atk - def + rand(-1, 2)) / (defending ? 2 : 1)));

function enemyTurn(game) {
  const c = game.state.combat, hero = game.state.party[0];
  const d = dmg(c.enemy.atk, hero.def, c.defending);
  hero.hp = Math.max(0, hero.hp - d);
  c.log.push(`<span class="dmg">${c.enemy.name} hits ${hero.name} for ${d}.</span>`);
  c.defending = false;
  if (hero.hp <= 0) { c.log.push('You collapse...'); c.over = 'defeat'; }
}

export const combatScene = {
  onEnter(game, { enemyId }) {
    const enemy = { ...ENEMIES[enemyId] };
    game.state.combat = { enemy, log: [`A ${enemy.name} appears!`], defending: false, over: null };
    if (enemy.spd > game.state.party[0].spd) enemyTurn(game);
  },
  render(game) {
    const c = game.state.combat, h = game.state.party[0];
    const buttons = c.over
      ? `<button data-action="finish">Continue</button>`
      : `<button data-action="attack">Attack</button><button data-action="defend">Defend</button><button data-action="flee">Flee</button>`;
    return `<div class="panel"><h2>Battle!</h2>
      <div class="stats"><span class="hp">${h.name}: ${h.hp}/${h.maxHp}</span><span class="dmg">${c.enemy.name}: ${c.enemy.hp}</span></div></div>
      <div class="panel log">${c.log.map(l => `<p>${l}</p>`).join('')}</div>
      <div class="panel">${buttons}</div>`;
  },
  actions: {
    attack(game) {
      const c = game.state.combat, h = game.state.party[0];
      const d = dmg(h.atk, c.enemy.def, false);
      c.enemy.hp = Math.max(0, c.enemy.hp - d);
      c.log.push(`${h.name} strikes for ${d}.`);
      if (c.enemy.hp <= 0) {
        game.state.gold += c.enemy.gold; h.xp += c.enemy.xp;
        c.log.push(`Victory! +${c.enemy.xp} XP, +${c.enemy.gold} gold.`); c.over = 'victory';
        game.bus.emit('combat:victory', { enemyId: c.enemy.id });
      } else enemyTurn(game);
    },
    defend(game) { const c = game.state.combat; c.defending = true; c.log.push('You brace yourself.'); enemyTurn(game); },
    flee(game) {
      const c = game.state.combat;
      if (Math.random() < 0.6) { c.log.push('You escape!'); c.over = 'fled'; } else { c.log.push('You fail to escape!'); enemyTurn(game); }
    },
    finish(game) {
      const over = game.state.combat.over; game.state.combat = null;
      if (over === 'defeat') game.setScene('title'); else game.setScene('town', { message: over === 'victory' ? 'You return victorious.' : 'You slip back to town.' });
    },
  },
};
