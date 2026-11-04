// Combat scene: Attack / Skills / Items / Defend / Flee against one enemy.
// setScene('combat', {enemyId, encounterId, returnScene}) — finishing returns to
// returnScene with {message, combatResult, encounterId}; defeat goes to title.
import {
  createCombat, heroAction, afterHeroAction, enemyTurn, knownSkills, heroStats, victoryRewards,
} from '../combat/rules.js';
import { rollLoot } from '../items/loot.js';
import { grantRewards } from '../items/inventory.js';
import { useConsumable } from '../items/consumables.js';
import { getItem, TYPES } from '../items/items.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function rng(game) { return game.combatRng || Math.random; }

function bar(cur, max, cls) {
  const pct = max > 0 ? Math.round((Math.max(0, cur) / max) * 100) : 0;
  return `<div class="bar ${cls}" role="meter" aria-valuemin="0" aria-valuemax="${max}" aria-valuenow="${cur}"><span style="width:${pct}%"></span></div>`;
}

function resolveVictory(game, lines) {
  const c = game.state.combat, hero = game.state.party[0];
  const r = victoryRewards(c, rollLoot, rng(game));
  game.state.gold += r.gold;
  for (const m of game.state.party) m.xp = (m.xp || 0) + r.xp;
  let got = [];
  if (r.items.length) {
    const g = grantRewards(game.state.inventory || [], r.items);
    if (g.ok) {
      game.state.inventory = g.inv;
      got = r.items.map((s) => { try { return `${s.qty}× ${getItem(s.id).name}`; } catch { return s.id; } });
    }
  }
  c.rewards = { ...r };
  lines.push(`Victory! +${r.xp} XP, +${r.gold} gold.`);
  if (got.length) lines.push(`Found: ${got.join(', ')}.`);
  c.log.push(...lines);
  lines.length = 0;
  // Progression listens to this and appends level-up lines to c.log.
  game.bus.emit('combat:victory', { enemyId: c.enemy.id, encounterId: c.encounterId });
  void hero;
}

function commit(game, lines) {
  const c = game.state.combat;
  if (c.over === 'victory' && !c.rewards) resolveVictory(game, lines);
  c.log.push(...lines);
  if (c.log.length > 40) c.log.splice(0, c.log.length - 40);
}

export const combatScene = {
  onEnter(game, data = {}) {
    game.state.combat = createCombat(data);
    game.combatMenu = 'main';
    const c = game.state.combat, hero = game.state.party[0];
    hero.statuses = Array.isArray(hero.statuses) ? hero.statuses : [];
    if ((c.enemy.spd || 0) > heroStats(hero).spd) {
      c.log.push(`${c.enemy.name} moves first!`, ...enemyTurn(c, hero, rng(game), game.state.party));
    }
  },
  render(game) {
    const c = game.state.combat, h = game.state.party[0];
    if (!c) return '<div class="panel"><p>No battle.</p><button data-action="finish">Continue</button></div>';
    const hs = heroStats(h);
    const st = (u) => (u.statuses || []).map((s) => `<span class="status">${esc(s)}</span>`).join(' ');
    let buttons;
    if (c.over) {
      buttons = `<button data-action="finish">Continue</button>`;
    } else if (game.combatMenu === 'skills') {
      buttons = knownSkills(h).map((s) =>
        `<button data-action="skill" data-arg="${s.id}" title="${s.description}" ${h.mp < s.mp ? 'disabled' : ''}>${s.name} (${s.mp} MP)</button>`).join('') +
        `<button data-action="menu" data-arg="main">Back</button>`;
    } else if (game.combatMenu === 'items') {
      const usable = (game.state.inventory || []).filter((s) => { try { return getItem(s.id).type === TYPES.CONSUMABLE; } catch { return false; } });
      buttons = (usable.length
        ? usable.map((s) => `<button data-action="item" data-arg="${s.id}">${getItem(s.id).name} ×${s.qty}</button>`).join('')
        : '<p>No usable items.</p>') + `<button data-action="menu" data-arg="main">Back</button>`;
    } else {
      buttons = `<button data-action="attack">Attack</button><button data-action="menu" data-arg="skills">Skills</button>` +
        `<button data-action="menu" data-arg="items">Items</button><button data-action="defend">Defend</button>` +
        `<button data-action="flee" ${c.enemy.boss ? 'disabled' : ''}>Flee</button>`;
    }
    return `<div class="panel combat"><h2>Battle — Round ${c.turn}</h2>
      <div class="combatants">
        <div class="unit hero"><strong>${esc(h.name)}</strong> Lv ${h.level || 1} ${st(h)}
          <div>HP ${h.hp}/${hs.maxHp}</div>${bar(h.hp, hs.maxHp, 'hp')}
          <div>MP ${h.mp}/${hs.maxMp}</div>${bar(h.mp, hs.maxMp, 'mp')}</div>
        ${game.state.party.slice(1).map((m) => { const ms = heroStats(m); return `<div class="unit ally${m.hp <= 0 ? ' down' : ''}"><strong>${esc(m.name)}</strong> Lv ${m.level || 1}${m.hp <= 0 ? ' <em>(down)</em>' : ''}
          <div>HP ${m.hp}/${ms.maxHp}</div>${bar(m.hp, ms.maxHp, 'hp')}
          <div>MP ${m.mp}/${ms.maxMp}</div>${bar(m.mp, ms.maxMp, 'mp')}</div>`; }).join('')}
        <div class="unit enemy"><strong>${esc(c.enemy.name)}</strong>${c.enemy.boss ? ' <em>(boss)</em>' : ''} ${st(c.enemy)}
          <div>HP ${c.enemy.hp}/${c.enemy.maxHp}</div>${bar(c.enemy.hp, c.enemy.maxHp, 'hp')}</div>
      </div></div>
      <div class="panel log" aria-live="polite">${c.log.slice(-8).map((l) => `<p>${esc(l)}</p>`).join('')}</div>
      <div class="panel actions">${buttons}</div>`;
  },
  actions: {
    menu(game, el) { game.combatMenu = el?.dataset?.arg || 'main'; },
    attack(game) { commit(game, heroAction(game.state.combat, game.state.party[0], { type: 'attack' }, rng(game), game.state.party).lines); },
    defend(game) { commit(game, heroAction(game.state.combat, game.state.party[0], { type: 'defend' }, rng(game), game.state.party).lines); },
    flee(game) { commit(game, heroAction(game.state.combat, game.state.party[0], { type: 'flee' }, rng(game), game.state.party).lines); },
    skill(game, el) {
      const res = heroAction(game.state.combat, game.state.party[0], { type: 'skill', skillId: el?.dataset?.arg }, rng(game), game.state.party);
      commit(game, res.lines);
      if (res.ok) game.combatMenu = 'main';
    },
    item(game, el) {
      const c = game.state.combat; if (!c || c.over) return;
      const res = useConsumable(game.state.party[0], game.state.inventory || [], el?.dataset?.arg);
      if (!res.ok) { commit(game, [res.message]); return; }
      Object.assign(game.state.party[0], res.actor);
      game.state.inventory = res.inv;
      const cure = res.effects?.cure;
      if (cure) delete c.heroTimers[cure];
      game.combatMenu = 'main';
      commit(game, [res.message, ...afterHeroAction(c, game.state.party[0], rng(game), game.state.party)]);
    },
    finish(game) {
      if (game.state.combat && !game.state.combat.over) return; // never abandon an active fight
      const c = game.state.combat || { over: 'fled', returnScene: 'town', encounterId: null };
      const { over, returnScene, encounterId } = c;
      game.state.combat = null;
      game.combatMenu = 'main';
      for (const m of game.state.party) { m.statuses = []; if (m.hp <= 0 && m !== game.state.party[0]) m.hp = 1; }
      if (over === 'defeat') { game.setScene('title'); return; }
      const message = over === 'victory' ? 'You return victorious.' : 'You slip away.';
      const target = game.scenes?.[returnScene] ? returnScene : 'town';
      game.setScene(target, { message, combatResult: over, encounterId });
    },
  },
};
