import { getDifficulty } from '../combat/difficulty.js';
import { applyLevelUps } from '../core/progression.js';
import { getItem } from '../items/items.js';
import { recordDrillWin, recordGauntlet, validGauntlet } from './drills.js';
// Combat scene: Attack / Skills / Items / Defend / Flee against one enemy.
// setScene('combat', {enemyId, encounterId, returnScene}) — finishing returns to
// returnScene with {message, combatResult, encounterId}; defeat wakes the party in
// Greyhaven (half max HP, lose half gold) via recoverFromDefeat.
import {
  createCombat, heroAction, afterHeroAction, enemyTurn, heroStats, victoryRewards, battleSummary,
} from '../combat/rules.js';
import { rollLoot } from '../items/loot.js';
import { ZONES } from '../map/zones.js';
import { grantRewards } from '../items/inventory.js';
import { useConsumable } from '../items/consumables.js';
import { renderCombat } from '../ui/combat.js';

export const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

function rng(game) { return game.combatRng || Math.random; }

function resolveVictory(game, lines) {
  const c = game.state.combat, hero = game.state.party[0];
  if (c.drill === true) { resolveDrillVictory(game, lines); return; }
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

// Sparring drills: experience only (half the foe's XP). No gold, no loot, and no
// combat:victory event, so story flags, map encounters and the bestiary stay untouched.
function resolveDrillVictory(game, lines) {
  const c = game.state.combat;
  const xp = Math.floor((Number(c.enemy?.xp) || 0) / 2);
  for (const m of game.state.party) m.xp = (m.xp || 0) + xp;
  c.rewards = { xp, gold: 0, items: [] };
  lines.push(`Drill complete! +${xp} XP.`);
  const rec = recordDrillWin(game.state, c.enemy?.id, battleSummary(c).rounds);
  if (rec?.newBest && rec.wins > 1) lines.push(`New drill record: ${rec.best} ${rec.best === 1 ? 'round' : 'rounds'}!`);
  const ups = game.state.party.flatMap((m) => applyLevelUps(m));
  lines.push(...ups);
  c.log.push(...lines);
  lines.length = 0;
  if (ups.length) game.bus.emit('party:levelup', { lines: ups });
}

function commit(game, lines) {
  const c = game.state.combat;
  if (c.over === 'victory' && !c.rewards) resolveVictory(game, lines);
  c.log.push(...lines);
  if (c.log.length > 40) c.log.splice(0, c.log.length - 40);
}

/**
 * Defeat is not game over: the party is carried back to Greyhaven, revived at half
 * max HP (full MP), and loses half its gold. Map progress is kept; the player is
 * placed at the Greyhaven spawn. Returns the message shown in town.
 */
export function recoverFromDefeat(state) {
  const lost = Math.floor(Math.max(0, Number(state.gold) || 0) / 2);
  state.gold = Math.max(0, (Number(state.gold) || 0) - lost);
  for (const m of state.party || []) {
    const st = heroStats(m);
    m.hp = Math.max(1, Math.ceil(st.maxHp / 2));
    m.mp = st.maxMp;
    m.statuses = [];
  }
  state.location = 'greyhaven';
  if (state.map && typeof state.map === 'object') {
    state.map.zoneId = 'greyhaven';
    const spawn = ZONES.greyhaven?.spawns?.default || { x: 2, y: 3 };
    state.map.x = spawn.x; state.map.y = spawn.y;
    state.map.activeEncounterId = null;
  }
  return `You wake in Greyhaven's infirmary. Warden Mara's patrol carried you back from the wilds${lost ? `, but ${lost} gold was lost along the way` : ''}.`;
}

export const combatScene = {
  onEnter(game, data = {}) {
    game.state.combat = createCombat({ ...data, difficulty: getDifficulty(game.state) });
    game.combatMenu = 'main';
    delete game.combatItemTarget;
    const c = game.state.combat, hero = game.state.party[0];
    if (data.drill === true) { c.drill = true; c.encounterId = null; }
    if (c.drill === true && validGauntlet(data.gauntlet, c.enemy?.id)) {
      c.gauntlet = { queue: [...data.gauntlet.queue], index: data.gauntlet.index };
      c.log.push(`Yard Gauntlet — bout ${c.gauntlet.index + 1} of ${c.gauntlet.queue.length}.`);
    }
    hero.statuses = Array.isArray(hero.statuses) ? hero.statuses : [];
    if ((c.enemy.spd || 0) > heroStats(hero).spd) {
      c.log.push(`${c.enemy.name} moves first!`, ...enemyTurn(c, hero, rng(game), game.state.party));
    }
  },
  render(game) {
    const c = game.state.combat;
    if (!c) return '<div class="panel"><p>No battle.</p><button data-action="finish">Continue</button></div>';
    return renderCombat({
      combat: c,
      party: game.state.party || [],
      inventory: game.state.inventory || [],
      menu: game.combatMenu || 'main',
      itemTargetIndex: game.combatItemTarget === undefined ? 0 : game.state.party.indexOf(game.combatItemTarget),
    });
  },

  actions: {
    menu(game, el) {
      game.combatMenu = el?.dataset?.arg || 'main';
      if (game.combatMenu === 'items') game.combatItemTarget = game.state.party[0];
      else delete game.combatItemTarget;
    },
    itemTarget(game, el) {
      const c = game.state.combat, arg = el?.dataset?.arg;
      if (!c || c.over || game.combatMenu !== 'items'
        || typeof arg !== 'string' || !/^(0|[1-9]\d*)$/.test(arg)) return;
      const index = Number(arg);
      if (!Number.isSafeInteger(index)) return;
      const member = game.state.party[index];
      if (!member || !(member.hp > 0)) return;
      game.combatItemTarget = member;
    },
    attack(game) { commit(game, heroAction(game.state.combat, game.state.party[0], { type: 'attack' }, rng(game), game.state.party).lines); },
    burst(game) { commit(game, heroAction(game.state.combat, game.state.party[0], { type: 'burst' }, rng(game), game.state.party).lines); },
    defend(game) { commit(game, heroAction(game.state.combat, game.state.party[0], { type: 'defend' }, rng(game), game.state.party).lines); },
    flee(game) { commit(game, heroAction(game.state.combat, game.state.party[0], { type: 'flee' }, rng(game), game.state.party).lines); },
    skill(game, el) {
      const res = heroAction(game.state.combat, game.state.party[0], { type: 'skill', skillId: el?.dataset?.arg }, rng(game), game.state.party);
      commit(game, res.lines);
      if (res.ok) game.combatMenu = 'main';
    },
    item(game, el) {
      const c = game.state.combat; if (!c || c.over) return;
      const hero = game.state.party[0];
      const target = game.combatItemTarget === undefined ? hero : game.combatItemTarget;
      // A removed or downed recipient must never silently redirect or revive.
      if (!target || !game.state.party.includes(target) || !(target.hp > 0)) return;
      const res = useConsumable(target, game.state.inventory || [], el?.dataset?.arg);
      if (!res.ok) { commit(game, [res.message]); return; }
      Object.assign(target, res.actor);
      game.state.inventory = res.inv;
      const cure = res.effects?.cure;
      const timers = target === hero ? c.heroTimers
        : (Object.prototype.hasOwnProperty.call(c.allyTimers || {}, target.id) ? c.allyTimers[target.id] : null);
      if (cure && timers) delete timers[cure];
      game.combatMenu = 'main';
      delete game.combatItemTarget;
      commit(game, [`${target.name}: ${res.message}`, ...afterHeroAction(c, hero, rng(game), game.state.party)]);
    },
    finish(game) {
      if (game.state.combat && !game.state.combat.over) return; // never abandon an active fight
      const c = game.state.combat || { over: 'fled', returnScene: 'town', encounterId: null };
      const { over, returnScene, encounterId, drill, gauntlet } = c;
      game.state.combat = null;
      game.combatMenu = 'main';
      delete game.combatItemTarget;
      for (const m of game.state.party) { m.statuses = []; if (m.hp <= 0 && m !== game.state.party[0]) m.hp = 1; }
      if (drill === true && game.scenes?.drills) {
        if (over === 'defeat') {
          for (const m of game.state.party) {
            const st = heroStats(m);
            m.hp = Math.max(1, Math.ceil(st.maxHp / 2)); m.mp = st.maxMp; m.statuses = [];
          }
        }
        if (gauntlet) {
          const total = gauntlet.queue.length;
          if (over === 'victory' && gauntlet.index + 1 < total) {
            game.setScene('combat', { enemyId: gauntlet.queue[gauntlet.index + 1], encounterId: null, returnScene: 'drills', drill: true, gauntlet: { queue: gauntlet.queue, index: gauntlet.index + 1 } });
            return;
          }
          const beaten = over === 'victory' ? total : gauntlet.index;
          const rec = recordGauntlet(game.state, beaten);
          const best = rec?.newBest && beaten > 0 ? ' A new gauntlet best!' : '';
          const gMessage = over === 'victory' ? `Gauntlet complete! You beat all ${total} foes back to back.${best}`
            : `The gauntlet ends after ${beaten} of ${total} foes. Mara helps you up — nothing is lost but pride.${best}`;
          game.setScene('drills', { message: gMessage, combatResult: over });
          return;
        }
        const message = over === 'victory' ? 'Drill complete. Mara nods and resets the targets.'
          : over === 'defeat' ? 'The drill is lost. Mara helps you up — nothing is lost but pride.'
          : 'You step out of the drill ring.';
        game.setScene('drills', { message, combatResult: over });
        return;
      }
      if (over === 'defeat') {
        const message = recoverFromDefeat(game.state);
        game.setScene(game.scenes?.town ? 'town' : 'title', { message, combatResult: 'defeat', encounterId });
        return;
      }
      const message = over === 'victory' ? 'You return victorious.' : 'You slip away.';
      const target = game.scenes?.[returnScene] ? returnScene : 'town';
      game.setScene(target, { message, combatResult: over, encounterId });
    },
  },
};
