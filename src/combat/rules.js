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
  rallying_light: { id: 'rallying_light', name: 'Rallying Light', mp: 6, kind: 'party_heal', power: 6,
    description: 'Lift the beacon lantern high: every standing ally recovers health and stops bleeding.' },
  stormbreaker: { id: 'stormbreaker', name: 'Stormbreaker', mp: 7, kind: 'damage', mult: 2.2,
    description: 'Channel the gale into one devastating swing for 220% damage.' },
});

/** Skills unlock by level. */
export const SKILL_UNLOCKS = Object.freeze({ power_strike: 1, mend: 1, spark: 2, warding_stance: 3, rallying_light: 4, stormbreaker: 5 });

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
export function enemyTurn(c, hero, rng = Math.random, party = [hero]) {
  const lines = [];
  const e = c.enemy;
  if (c.over || e.hp <= 0) return lines;
  if (hasStatus(e, 'stunned')) {
    e.statuses = e.statuses.filter((s) => s !== 'stunned');
    lines.push(`${e.name} is stunned and loses its turn.`);
    return lines;
  }
  // Pick a target among living party members (rng is only consumed with 2+ targets).
  const living = (party || [hero]).filter((m) => m && m.hp > 0);
  const target = living.length > 1 ? living[Math.floor(rng() * living.length) % living.length] : hero;
  if (target !== hero) {
    const ts = heroStats(target);
    const special = e.ability && rng() < (e.ability.chance ?? 0);
    const d = physicalDamage(e.atk, ts.def, rng, { mult: special ? (e.ability.mult ?? 1) : 1 });
    target.hp = Math.max(0, target.hp - d);
    lines.push(special ? `${e.name} uses ${e.ability.name}! ${target.name} takes ${d}.` : `${e.name} hits ${target.name} for ${d}.`);
    if (target.hp <= 0) lines.push(`${target.name} is knocked out!`);
    else if (special && e.ability.status) {
      addStatus(target, e.ability.status, e.ability.turns || 3, allyTimers(c, target));
      lines.push(e.ability.status === 'bleeding' ? `${target.name} is bleeding!` : `${target.name} is shocked!`);
    }
    c.defending = false;
    if (c.wardTurns > 0) c.wardTurns -= 1;
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

/** Per-companion status timers live in c.allyTimers[memberId]. */
export function allyTimers(c, m) {
  if (!c.allyTimers || typeof c.allyTimers !== 'object') c.allyTimers = {};
  const key = String(m?.id ?? 'ally');
  if (!Object.prototype.hasOwnProperty.call(c.allyTimers, key)) c.allyTimers[key] = {};
  return c.allyTimers[key];
}

/** Tick bleeding/shock on living companions once per round. Returns log lines. */
export function tickAllyStatuses(c, party, hero) {
  const lines = [];
  for (const m of party || []) {
    if (!m || m === hero || m.hp <= 0 || !Array.isArray(m.statuses) || !m.statuses.length) continue;
    if (hasStatus(m, 'bleeding')) {
      m.hp = Math.max(0, m.hp - 2);
      lines.push(`${m.name} bleeds for 2.`);
      if (m.hp <= 0) { lines.push(`${m.name} is knocked out!`); m.statuses = []; continue; }
    }
    const timers = allyTimers(c, m);
    for (const id of Object.keys(timers)) {
      timers[id] -= 1;
      if (timers[id] <= 0) {
        delete timers[id];
        m.statuses = m.statuses.filter((st) => st !== id);
        lines.push(id === 'bleeding' ? `${m.name}'s bleeding stops.` : `${m.name} shakes off the shock.`);
      }
    }
  }
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
export function heroAction(c, hero, action, rng = Math.random, party = [hero]) {
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
      } else if (sk.kind === 'party_heal') {
        const amount = sk.power + (hero.level || 1) * 2;
        for (const m of party) {
          if (!m || (m.hp || 0) <= 0) continue;
          const before = m.hp;
          m.hp = Math.min(heroStats(m).maxHp, m.hp + amount);
          if (Array.isArray(m.statuses)) m.statuses = m.statuses.filter((st) => st !== 'bleeding');
          if (m !== hero && c.allyTimers?.[m.id]) delete c.allyTimers[m.id].bleeding;
          lines.push(`${m.name} recovers ${m.hp - before} HP.`);
        }
        if (c.heroTimers) delete c.heroTimers.bleeding;
        lines.unshift(`${hero.name} raises a Rallying Light!`);
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
  lines.push(...afterHeroAction(c, hero, rng, party));
  return { ok: true, lines };
}

/** Enemy reply + end-of-round status ticks. Used after any hero action that consumes the turn. */
export function afterHeroAction(c, hero, rng = Math.random, party = [hero]) {
  const lines = [];
  if (c.over) return lines;
  for (const m of party || []) {
    if (m === hero || !m || m.hp <= 0 || c.over) continue;
    lines.push(...companionTurn(c, m, party, rng));
    checkVictory(c, lines);
  }
  if (c.over) { c.turn += 1; return lines; }
  lines.push(...enemyTurn(c, hero, rng, party));
  if (!c.over) lines.push(...tickHeroStatuses(c, hero));
  if (!c.over) lines.push(...tickAllyStatuses(c, party, hero));
  c.turn += 1;
  return lines;
}

/**
 * Automatic companion turn. Scouts attack (30% chance of an Aimed Shot for 140%);
 * keepers mend the most wounded ally below half HP, spark constructs, else attack;
 * guardians may Shield Bash (25%, stuns non-bosses); signalers spend 3 MP on a
 * def-ignoring Signal Flare. Shocked companions can't use MP techniques
 * (Mend/Spark/Flare) and simply attack; bleeding companions lose 2 HP a round.
 */
export function companionTurn(c, m, party = [m], rng = Math.random) {
  const lines = [];
  if (c.over || !m || m.hp <= 0) return lines;
  const ms = heroStats(m);
  const e = c.enemy;
  const shocked = hasStatus(m, 'shocked'); // shocked allies can't channel MP techniques
  if (m.role === 'keeper' && !shocked) {
    const hurt = (party || []).filter((p) => p && p.hp > 0 && p.hp < heroStats(p).maxHp / 2)
      .sort((a, b) => a.hp / heroStats(a).maxHp - b.hp / heroStats(b).maxHp)[0];
    if (hurt && (m.mp || 0) >= SKILLS.mend.mp) {
      m.mp -= SKILLS.mend.mp;
      const before = hurt.hp;
      hurt.hp = Math.min(heroStats(hurt).maxHp, hurt.hp + SKILLS.mend.power + (m.level || 1) * 2);
      lines.push(`${m.name} uses Mend on ${hurt.name}, restoring ${hurt.hp - before} HP.`);
      return lines;
    }
    if (e.tags?.includes('construct') && (m.mp || 0) >= SKILLS.spark.mp) {
      m.mp -= SKILLS.spark.mp;
      const d = (SKILLS.spark.power + (m.level || 1) * 2 + randInt(rng, 0, 2)) * 2;
      e.hp = Math.max(0, e.hp - d);
      lines.push(`${m.name} casts Spark for ${d}!`);
      return lines;
    }
  }
  if (m.role === 'guardian' && rng() < 0.25) {
    const d = physicalDamage(ms.atk, e.def, rng);
    e.hp = Math.max(0, e.hp - d);
    lines.push(`${m.name} lands a Shield Bash for ${d}!`);
    if (e.hp > 0 && !e.boss && !hasStatus(e, 'stunned')) {
      addStatus(e, 'stunned', 1, c.enemyTimers);
      lines.push(`${e.name} is stunned!`);
    }
    return lines;
  }
  if (m.role === 'signaler' && !shocked && (m.mp || 0) >= 3) {
    m.mp -= 3;
    const d = 5 + (m.level || 1) * 2 + randInt(rng, 0, 2);
    e.hp = Math.max(0, e.hp - d);
    lines.push(`${m.name} hurls a Signal Flare for ${d}!`);
    return lines;
  }
  if (m.role === 'scout' && rng() < 0.3) {
    const d = physicalDamage(ms.atk, e.def, rng, { mult: 1.4 });
    e.hp = Math.max(0, e.hp - d);
    lines.push(`${m.name} looses an Aimed Shot for ${d}!`);
    return lines;
  }
  const d = physicalDamage(ms.atk, e.def, rng);
  e.hp = Math.max(0, e.hp - d);
  lines.push(`${m.name} strikes for ${d}.`);
  return lines;
}

/** Compute rewards on victory. Loot rolled with rng. */
export function victoryRewards(c, rollLoot, rng = Math.random) {
  const e = c.enemy;
  return { xp: e.xp || 0, gold: e.gold || 0, items: rollLoot(e.loot || [], rng) };
}
