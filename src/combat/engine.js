// Combat engine: turn order, damage, status effects, leveling, and loot.
// Operates on `game.state` (kept JSON-serializable). Pure of any DOM concerns.

import { ENEMIES } from '../data/enemies.js';
import { HERO_ABILITIES, MONSTER_ABILITIES } from './abilities.js';
import { bus } from '../events.js';

const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Flavor text for critical hits. Kept as data so future modules can extend it.
const CRIT_QUIPS = [
  () => 'Critical hit!',
  () => 'A devastating blow!',
  () => 'A devastating blow!',
  () => 'You find a crack in their guard!',
];

const FLEE_QUIPS = [
  () => 'You escape!',
  () => 'You slip away into the storm.',
  () => 'You scramble away before things get worse!',
];

export function bestCombatant(state) {
  return state.party[0] ?? null;
}

export function startCombat(state, enemyId, opts = {}) {
  const src = ENEMIES[enemyId];
  if (!src) throw new Error(`Unknown enemy: ${enemyId}`);
  const enemy = JSON.parse(JSON.stringify(src));
  enemy.maxHp = enemy.hp;  // enemies track current vs max HP
  state.combat = {
    enemy,
    log: [`A ${enemy.name} draws near — ${enemy.desc}`],
    turn: 'hero',
    defending: false,
    over: null,
    encounterId: opts.encounterId ?? null,
    returnScene: opts.returnScene ?? 'town',
    statuses: { hero: {}, enemy: {} },
  };
  // Faster enemies act first.
  if (enemy.spd > bestCombatant(state).spd) {
    state.combat.log.push(`${enemy.name} seizes the initiative!`);
    enemyTurn(state);
  }
  return state.combat;
}

// Apply a status tick (buffs/debuffs/DoTs) at the start of the owner's turn.
function tickStatuses(state, whose) {
  const c = state.combat;
  const char = whose === 'hero' ? bestCombatant(state) : c.enemy;
  const st = c.statuses[whose];
  for (const key of Object.keys(st)) {
    const s = st[key];
    if (s.dot) {
      char.hp = clamp(char.hp - s.dot, 0, char.maxHp ?? char.hp + s.dot);
      c.log.push(`${char.name} suffers ${s.dot} ${key} damage.`);
    }
    s.turns -= 1;
    if (s.turns <= 0) {
      if (s.buff) char[s.stat] -= s.amount;
      else if (s.debuff) char[s.stat] += s.amount;
      if (s.buff || s.debuff) c.log.push(`${char.name}'s ${s.label} fades.`);
      delete st[key];
    }
  }
}

function applyStatus(state, whose, effect) {
  const c = state.combat;
  const char = whose === 'hero' ? bestCombatant(state) : c.enemy;
  const st = c.statuses[whose];
  const label = effect.label || (effect.fx === 'burn' ? 'burn' : effect.stat);
  if (effect.buff) {
    char[effect.stat] = (char[effect.stat] || 0) + effect.amount;
    st[label] = { buff: true, stat: effect.stat, amount: effect.amount, turns: effect.turns, label };
    return `${char.name}'s ${effect.stat} rises.`;
  }
  if (effect.debuff) {
    char[effect.stat] = Math.max(0, (char[effect.stat] || 0) - effect.amount);
    st[label] = { debuff: true, stat: effect.stat, amount: effect.amount, turns: effect.turns, label };
    return `${char.name}'s ${effect.stat} falls.`;
  }
  if (effect.dot) {
    st[label] = { dot: effect.dot, turns: effect.turns, label };
    return `${char.name} is ${label}ed!`;
  }
  return null;
}

function rollDamage(attacker, defender, power, defending) {
  // Diminishing-returns defense: high DEF softens but never nullifies an attack.
  const raw = attacker.atk * power;
  const reduction = defender.def / (defender.def + 8);
  const variance = 0.85 + Math.random() * 0.3; // 0.85..1.15
  const crit = Math.random() < 0.1;
  let dmg = raw * (1 - reduction) * variance;
  if (crit) dmg *= 1.5;
  dmg = clamp(Math.round(dmg), 1, 9999);
  if (defending) dmg = Math.max(1, Math.round(dmg / 2));
  return { dmg, crit };
}

function heroTurn(state, abilityId) {
  const c = state.combat;
  const hero = bestCombatant(state);
  const a = HERO_ABILITIES[abilityId];
  if (!a) return;
  if (a.mp > hero.mp) { c.log.push('Not enough MP!'); return; }
  c.turn = 'enemy';

  if (a.id === 'defend') {
    c.defending = true;
    hero.mp -= a.mp;
    c.log.push(`${hero.name} braces ${abilityId === 'defend' ? '' : ''}themself.`);
    return;
  }
  hero.mp -= a.mp;

  if (a.heal) {
    const amt = Math.min(a.heal, hero.maxHp - hero.hp);
    hero.hp += amt;
    c.log.push(`${hero.name} mends ${amt} HP.`);
    return;
  }

  if (Math.random() > (a.acc ?? 1)) {
    c.log.push(`${hero.name} misses!`);
    return;
  }
  const { dmg, crit } = rollDamage(hero, c.enemy, a.power, false);
  c.enemy.hp = clamp(c.enemy.hp - dmg, 0, 9999);
  const quip = CRIT_QUIPS[rand(0, CRIT_QUIPS.length - 1)]();
  c.log.push(`${hero.name} uses ${a.name}: ${dmg} damage.${crit ? ` <span class="crit">${quip}</span>` : ''}`);
  if (c.enemy.hp <= 0) { resolveVictory(state); return; }
}

function enemyTurn(state) {
  const c = state.combat;
  const hero = bestCombatant(state);
  if (!c || c.over) return;
  tickStatuses(state, 'enemy');
  c.defending = false;

  const enemy = c.enemy;
  // Simple AI: 45% chance to use a special ability if it has MP; otherwise a basic attack.
  const special = enemy.abilities.find(a => MONSTER_ABILITIES[a.id]);
  if (special && enemy.mp >= (MONSTER_ABILITIES[special.id].mp ?? 0) && Math.random() < 0.45) {
    const ab = MONSTER_ABILITIES[special.id];
    enemy.mp -= ab.mp ?? 0;
    if (ab.fx === 'buff' || ab.fx === 'debuff' || (ab.fx === 'burn' && Math.random() < (ab.acc ?? 1))) {
      const msg = applyStatus(state, ab.fx === 'buff' ? 'enemy' : 'hero', {
        buff: ab.fx === 'buff', debuff: ab.fx === 'debuff',
        dot: ab.fx === 'burn' ? ab.dot : undefined,
        stat: ab.stat, amount: ab.amount, turns: ab.turns, label: ab.id === 'm:corrosive_slime' ? 'slowed' : ab.id === 'm:ember_burst' ? 'burn' : ab.stat,
      });
      c.log.push(`${enemy.name} uses ${ab.name}: ${msg}`);
    } else if (ab.fx === 'selfDamage') {
      enemy.hp = clamp(enemy.hp - ab.selfDamage, 0, 9999);
      const { dmg, crit } = rollDamage(enemy, hero, ab.power, false);
      hero.hp = clamp(hero.hp - dmg, 0, hero.maxHp);
      c.log.push(`${enemy.name} overcharges! ${dmg} damage to ${hero.name}.`);
      if (enemy.hp <= 0) { resolveVictory(state); return; }
    } else if (ab.fx === 'burn') {
      c.log.push(`${enemy.name} uses ${ab.name}, but it fizzles.`);
    }
  } else {
    const { dmg, crit } = rollDamage(enemy, hero, 1.0, c.defending);
    hero.hp = clamp(hero.hp - dmg, 0, hero.maxHp);
    c.log.push(`<span class="dmg">${enemy.name} hits ${hero.name} for ${dmg}.</span>${crit ? ' <span class="crit">Ouch!</span>' : ''}`);
  }

  if (hero.hp <= 0) {
    c.log.push('You collapse...');
    c.over = 'defeat';
    return;
  }
  c.turn = 'hero';
}

function resolveVictory(state) {
  const c = state.combat;
  const hero = bestCombatant(state);
  c.over = 'victory';
  const { xp, gold } = c.enemy;
  state.gold += gold;
  hero.xp += xp;
  c.log.push(`Victory! +${xp} XP, +${gold} gold.`);
  // Roll loot.
  for (const drop of c.enemy.loot || []) {
    if (!drop || Math.random() >= (drop.chance ?? 1)) continue;
    const min = drop.minQty ?? 1;
    const max = drop.maxQty ?? min;
    const qty = min + Math.floor(Math.random() * (Math.max(0, max - min) + 1));
    if (qty <= 0) continue;
    const inv = state.inventory.find(i => i.id === drop.id);
    if (inv) inv.qty += qty;
    else state.inventory.push({ id: drop.id, qty });
    c.log.push(`You found ${qty} ${drop.id.replace(/_/g, ' ')}.`);
  }
  gainXp(state, 0); // no-op; xp already added. Kept for clarity/symmetry.
  bus.emit('combat:victory', { enemyId: c.enemy.id, encounterId: c.encounterId });
}

// Level up while any party member has enough XP (threshold grows per level).
export function gainXp(state, amount) {
  const hero = bestCombatant(state);
  hero.xp += amount;
  while (hero.xp >= xpToNext(hero.level)) {
    hero.xp -= xpToNext(hero.level);
    hero.level += 1;
    hero.maxHp += 4; hero.hp = hero.maxHp;
    hero.maxMp += 2; hero.mp = hero.maxMp;
    hero.atk += 1; hero.def += 1; hero.spd += 1;
    if (state.combat) state.combat.log.push(`<span class="crit">${hero.name} reached level ${hero.level}!</span>`);
  }
}

export function xpToNext(level) { return 20 + level * 10; }

export function heroAct(state, abilityId) {
  const c = state.combat;
  if (!c || c.over || c.turn !== 'hero') return;
  if (abilityId === 'flee') {
    if (Math.random() < 0.6) {
      c.log.push(FLEE_QUIPS[rand(0, FLEE_QUIPS.length - 1)]());
      c.over = 'fled';
    } else {
      c.log.push('You fail to escape!');
      enemyTurn(state);
    }
    return;
  }
  heroTurn(state, abilityId);
  if (!c.over && c.turn === 'enemy' && c.enemy.hp > 0) enemyTurn(state);
  if (!c.over && c.turn === 'enemy') c.turn = 'hero';
}
