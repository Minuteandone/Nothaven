// Combat rules for Beacon of Stormhaven. Pure-ish functions over a combat
// object and the party; randomness is injected (`rng`) so tests are deterministic.
import { ENEMIES } from '../data/enemies.js';
import { effectiveStats } from '../items/equipment.js';

export const SKILLS = Object.freeze({
  power_strike: { id: 'power_strike', name: 'Power Strike', mp: 3, kind: 'damage', mult: 1.6,
    description: 'A heavy two-handed blow for 160% damage.' },
  spark: { id: 'spark', name: 'Spark', mp: 4, kind: 'magic', power: 8,
    description: 'Call a lightning lash that ignores armour. Doubly effective on constructs.' },
  mend: { id: 'mend', name: 'Mend', mp: 4, kind: 'heal', power: 10,
    description: 'Steady breath and practiced hands restore health.' },
  warding_stance: { id: 'warding_stance', name: 'Warding Stance', mp: 2, kind: 'ward',
    description: 'Halve damage for two enemy turns.' },
});

/** Skills unlock by level. */
export const SKILL_UNLOCKS = Object.freeze({ power_strike: 1, mend: 1, spark: 2, warding_stance: 3 });

export function knownSkills(member) {
  const lvl = member?.level || 1;
  return Object.keys(SKILL_UNLOCKS).filter((id) => SKILL_UNLOCKS[id] <= lvl).map((id) => SKILLS[id]);
}

const randInt = (rng, a, b) => a + Math.floor(rng() * (b - a + 1));

/** Physical damage: atk*mult - def + variance(-1..2), min 1; halved while warded. */
export function physicalDamage(atk, def, rng, { mult = 1, warded = false } = {}) {
  let d = Math.floor(atk * mult) - def + randInt(rng, -1, 2);
  d = Math.max(1, d);
  return warded ? Math.max(1, Math.floor(d / 2)) : d;
}

export function hasStatus(unit, id) {
  return Array.isArray(unit?.statuses) && unit.statuses.includes(id);
}

function addStatus(unit, id, turns, store) {
  unit.statuses = Array.isArray(unit.statuses) ? unit.statuses : [];
  if (!unit.statuses.includes(id)) unit.statuses.push(id);
  store[id] = Math.max(store[id] || 0, turns);
}

/** Create a fresh combat object. Unknown enemy ids fall back to storm_rat. */
export function createCombat({ enemyId, encounterId = null, returnScene = 'town' } = {}) {
  const base = (typeof enemyId === 'string' && Object.prototype.hasOwnProperty.call(ENEMIES, enemyId)) ? ENEMIES[enemyId] : ENEMIES.storm_rat;
  const enemy = { ...base, maxHp: base.hp, statuses: [], loot: base.loot ? base.loot.map((l) => ({ ...l })) : [] };
  return {
    enemy, encounterId, returnScene, turn: 1, over: null,
    defending: false, wardTurns: 0, heroTimers: {}, enemyTimers: {},
    log: [enemy.intro || `A ${enemy.name} appears!`],
    rewards: null,
  };
}

/** Effective hero stats (equipment-aware). */
export function heroStats(hero) {
  return effectiveStats(hero);
}

/** Tick statuses on the hero at the start of the hero's turn. Returns log lines. */
export function tickHeroStatuses(c, hero) {
  const lines = [];
  if (hasStatus(hero, 'bleeding')) {
    const d = 2;
    hero.hp = Math.max(0, hero.hp - d);
    lines.push(`${hero.name} bleeds for ${d}.`);
  }
  for (const id of Object.keys(c.heroTimers)) {
    c.heroTimers[id] -= 1;
    if (c.heroTimers[id] <= 0) {
      delete c.heroTimers[id];
      hero.statuses = (hero.statuses || []).filter((s) => s !== id);
      lines.push(id === 'bleeding' ? 'The bleeding stops.' : `${hero.name} shakes off the shock.`);
    }
  }
  if (hero.hp <= 0) { c.over = 'defeat'; lines.push(`${hero.name} collapses...`); }
  return lines;
}

/** Enemy acts once. Mutates hero/combat. Returns log lines. */
export function enemyTurn(c, hero, rng = Math.random) {
  const lines = [];
  const e = c.enemy;
  if (c.over || e.hp <= 0) return lines;
  if (hasStatus(e, 'stunned')) {
    e.statuses = e.statuses.filter((s) => s !== 'stunned');
    lines.push(`${e.name} is stunned and loses its turn.`);
    return lines;
  }
  const hs = heroStats(hero);
  const warded = c.defending || c.wardTurns > 0;
  const special = e.ability && rng() < (e.ability.chance ?? 0);
  if (special) {
    const ab = e.ability;
    const d = physicalDamage(e.atk, hs.def, rng, { mult: ab.mult ?? 1, warded });
    hero.hp = Math.max(0, hero.hp - d);
    lines.push(`${e.name} uses ${ab.name}! ${hero.name} takes ${d}.`);
    if (ab.status) {
      addStatus(hero, ab.status, ab.turns || 3, c.heroTimers);
      lines.push(ab.status === 'bleeding' ? `${hero.name} is bleeding!` : `${hero.name} is shocked!`);
    }
  } else {
    const d = physicalDamage(e.atk, hs.def, rng, { warded });
    hero.hp = Math.max(0, hero.hp - d);
    lines.push(`${e.name} hits ${hero.name} for ${d}.`);
  }
  // Defend lasts exactly one enemy action; ward counts down per enemy action.
  c.defending = false;
  if (c.wardTurns > 0) c.wardTurns -= 1;
  if (hero.hp <= 0) { c.over = 'defeat'; lines.push(`${hero.name} collapses...`); }
  return lines;
}

function checkVictory(c, lines) {
  if (c.enemy.hp <= 0 && !c.over) {
    c.over = 'victory';
    lines.push(`${c.enemy.name} is defeated!`);
  }
}

/**
 * Resolve a hero action, then the enemy reply. action: {type:'attack'|'defend'|'skill'|'flee', skillId?}
 * Item use is handled by the scene (via useConsumable) and then calls `afterHeroAction`.
 * Returns {ok, lines}.
 */
export function heroAction(c, hero, action, rng = Math.random) {
  if (c.over) return { ok: false, lines: ['The battle is over.'] };
  const lines = [];
  const hs = heroStats(hero);
  const shocked = hasStatus(hero, 'shocked');
  switch (action?.type) {
    case 'attack': {
      const d = physicalDamage(hs.atk, c.enemy.def, rng);
      c.enemy.hp = Math.max(0, c.enemy.hp - d);
      lines.push(`${hero.name} strikes for ${d}.`);
      break;
    }
    case 'defend':
      c.defending = true;
      lines.push(`${hero.name} raises a guard.`);
      break;
    case 'skill': {
      const sk = SKILLS[action.skillId];
      if (!sk || !knownSkills(hero).some((s) => s.id === sk.id)) return { ok: false, lines: ['You do not know that skill.'] };
      if (shocked && sk.kind !== 'damage') return { ok: false, lines: ['Too shocked to focus on that.'] };
      if ((hero.mp || 0) < sk.mp) return { ok: false, lines: [`Not enough MP for ${sk.name}.`] };
      hero.mp -= sk.mp;
      if (sk.kind === 'damage') {
        const d = physicalDamage(hs.atk, c.enemy.def, rng, { mult: sk.mult });
        c.enemy.hp = Math.max(0, c.enemy.hp - d);
        lines.push(`${hero.name} uses ${sk.name} for ${d}!`);
        if (rng() < 0.25) { addStatus(c.enemy, 'stunned', 1, c.enemyTimers); lines.push(`${c.enemy.name} reels, stunned.`); }
      } else if (sk.kind === 'magic') {
        let d = sk.power + (hero.level || 1) * 2 + randInt(rng, 0, 2);
        if (c.enemy.tags?.includes('construct')) d *= 2;
        c.enemy.hp = Math.max(0, c.enemy.hp - d);
        lines.push(`${hero.name} casts ${sk.name} for ${d}!`);
      } else if (sk.kind === 'heal') {
        const before = hero.hp;
        hero.hp = Math.min(hs.maxHp, hero.hp + sk.power + (hero.level || 1) * 2);
        lines.push(`${hero.name} uses ${sk.name} and recovers ${hero.hp - before} HP.`);
      } else if (sk.kind === 'ward') {
        c.wardTurns = 2;
        lines.push(`${hero.name} settles into a Warding Stance.`);
      }
      break;
    }
    case 'flee': {
      if (c.enemy.boss) return { ok: false, lines: ['There is no escaping this fight!'] };
      const chance = Math.min(0.9, 0.5 + (hs.spd - (c.enemy.spd || 0)) * 0.1);
      if (rng() < chance) { c.over = 'fled'; lines.push('You get away safely.'); return { ok: true, lines }; }
      lines.push('You fail to get away!');
      break;
    }
    default:
      return { ok: false, lines: ['Unknown action.'] };
  }
  checkVictory(c, lines);
  lines.push(...afterHeroAction(c, hero, rng));
  return { ok: true, lines };
}

/** Enemy reply + end-of-round status ticks. Used after any hero action that consumes the turn. */
export function afterHeroAction(c, hero, rng = Math.random) {
  const lines = [];
  if (c.over) return lines;
  lines.push(...enemyTurn(c, hero, rng));
  if (!c.over) lines.push(...tickHeroStatuses(c, hero));
  c.turn += 1;
  return lines;
}

/** Compute rewards on victory. Loot rolled with rng. */
export function victoryRewards(c, rollLoot, rng = Math.random) {
  const e = c.enemy;
  return { xp: e.xp || 0, gold: e.gold || 0, items: rollLoot(e.loot || [], rng) };
}
