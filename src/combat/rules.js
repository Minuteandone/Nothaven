import { companionTactic } from '../party/tactics.js';
import { elementMultiplier, elementEffectivenessText } from './elements.js';
// Combat rules for Beacon of Stormhaven. Pure-ish functions over a combat
// object and the party; randomness is injected (`rng`) so tests are deterministic.
import { ENEMIES } from '../data/enemies.js';
import { scaleEnemy, DIFFICULTIES } from './difficulty.js';
import { effectiveStats } from '../items/equipment.js';

export const SKILLS = Object.freeze({
  power_strike: { id: 'power_strike', name: 'Power Strike', mp: 3, kind: 'damage', mult: 1.6,
    description: 'A heavy two-handed blow for 160% damage.' },
  spark: { id: 'spark', name: 'Spark', mp: 4, kind: 'magic', power: 8, element: 'lightning',
    description: 'Call a lightning lash that ignores armour. Half again as effective on constructs.' },
  mend: { id: 'mend', name: 'Mend', mp: 4, kind: 'heal', power: 10,
    description: 'Steady breath and practiced hands restore health.' },
  warding_stance: { id: 'warding_stance', name: 'Warding Stance', mp: 2, kind: 'ward',
    description: 'Halve damage for two enemy turns.' },
  rallying_light: { id: 'rallying_light', name: 'Rallying Light', mp: 6, kind: 'party_heal', power: 6,
    description: 'Lift the beacon lantern high: every standing ally recovers health and stops bleeding.' },
  stormbreaker: { id: 'stormbreaker', name: 'Stormbreaker', mp: 7, kind: 'damage', mult: 2.2, element: 'lightning',
    description: 'Channel the gale into one devastating swing for 220% damage.' },
  steady_signal: { id: 'steady_signal', name: 'Steady Signal', mp: 3, kind: 'cleanse',
    description: 'Sound a calm, steady note on the signal whistle: every standing ally shakes off bleeding and shock. Usable while shocked.' },
  beacon_lance: { id: 'beacon_lance', name: 'Beacon Lance', mp: 9, kind: 'pierce', mult: 1.8, element: 'fire',
    description: 'Focus the beacon light into a single piercing spear for 180% damage that ignores armour.' },
  beacon_aegis: { id: 'beacon_aegis', name: 'Beacon Aegis', mp: 8, kind: 'party_ward', turns: 3,
    description: 'Spread a dome of steady beacon light over the whole party: all damage taken is halved for three enemy turns.' },
  signal_flare: { id: 'signal_flare', name: 'Signal Flare', mp: 8, kind: 'magic', power: 20, element: 'fire',
    description: 'Fire a blazing signal flare straight into the foe. Ignores armour and is half again as effective on constructs.' },
  tempest_cleave: { id: 'tempest_cleave', name: 'Tempest Cleave', mp: 11, kind: 'damage', mult: 2.8, element: 'lightning',
    description: 'Ride the last gust of the broken storm into one sweeping strike for 280% damage.' },
  rekindle: { id: 'rekindle', name: 'Rekindle', mp: 12, kind: 'revive', share: 0.4,
    description: 'Relight the lantern for the fallen: every knocked-out ally rises with 40% of their health and no lingering conditions.' },
  skyfire_lance: { id: 'skyfire_lance', name: 'Skyfire Lance', mp: 14, kind: 'pierce', mult: 2.6, element: 'fire',
    description: 'Gather the whole beacon into one blinding spear for 260% damage that ignores armour.' },
  stormhaven_vigil: { id: 'stormhaven_vigil', name: 'Stormhaven Vigil', mp: 16, kind: 'vigil', share: 0.35,
    description: 'Keep the long watch for everyone at once: every standing ally recovers 35% of their health and shakes off bleeding and shock. Usable while shocked.' },
  stillpoint_strike: { id: 'stillpoint_strike', name: 'Stillpoint Strike', mp: 13, kind: 'break', mult: 2, element: 'ice',
    description: 'Wait for the calm at the centre of the storm, then strike for 200% damage that ignores armour. Breaks a heavy blow the foe is gathering. Usable while shocked.' },
});

/** Skills unlock by level. */
export const SKILL_UNLOCKS = Object.freeze({ power_strike: 1, mend: 1, spark: 2, warding_stance: 3, rallying_light: 4, stormbreaker: 5, steady_signal: 6, beacon_lance: 7, beacon_aegis: 9, signal_flare: 11, tempest_cleave: 13, rekindle: 15, skyfire_lance: 17, stormhaven_vigil: 19, stillpoint_strike: 20 });

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

/**
 * Boss second phase: when an enemy with `enrage {threshold, atk, chance, line}`
 * drops to threshold x maxHp or below, it enrages once per fight (atk bonus,
 * optional new ability chance) and logs its line. Returns log lines.
 */
export function checkBossPhase(c) {
  const e = c && c.enemy;
  if (!e || !e.enrage || c.enraged || e.hp <= 0) return [];
  const t = typeof e.enrage.threshold === 'number' ? e.enrage.threshold : 0.5;
  if (e.hp > Math.floor((e.maxHp || e.hp) * t)) return [];
  c.enraged = true;
  e.atk += e.enrage.atk || 0;
  if (e.ability && typeof e.enrage.chance === 'number') e.ability = { ...e.ability, chance: e.enrage.chance };
  return [e.enrage.line || `${e.name} grows desperate!`];
}

/** Create a fresh combat object. Unknown enemy ids fall back to storm_rat. */
export function createCombat({ enemyId, encounterId = null, returnScene = 'town', difficulty = 'standard' } = {}) {
  const base = (typeof enemyId === 'string' && Object.prototype.hasOwnProperty.call(ENEMIES, enemyId)) ? ENEMIES[enemyId] : ENEMIES.storm_rat;
  const enemy = scaleEnemy({ ...base, maxHp: base.hp, statuses: [], loot: base.loot ? base.loot.map((l) => ({ ...l })) : [] }, difficulty);
  return {
    enemy, encounterId, returnScene, turn: 1, over: null,
    difficulty: Object.prototype.hasOwnProperty.call(DIFFICULTIES, difficulty) ? difficulty : 'standard',
    defending: false, wardTurns: 0, aegisTurns: 0, heroTimers: {}, enemyTimers: {},
    log: [enemy.intro || `A ${enemy.name} appears!`],
    rewards: null,
  };
}

/** Effective hero stats (equipment-aware). */
export function heroStats(hero) {
  return effectiveStats(hero);
}

/** Per-battle bookkeeping for the victory summary (no effect on outcomes). */
function battleStats(c) {
  if (!c || typeof c !== 'object') return { rounds: 0, taken: 0, bursts: 0 };
  if (!c.stats || typeof c.stats !== 'object') c.stats = { rounds: 0, taken: 0, bursts: 0 };
  return c.stats;
}

function noteTaken(c, d) {
  const st = battleStats(c);
  st.taken = (st.taken || 0) + Math.max(0, Math.floor(Number(d) || 0));
}

/** Rounds fought, damage dealt to the foe, damage the party took, and Bursts fired. */
export function battleSummary(c) {
  const st = c?.stats || {};
  const e = c?.enemy || {};
  const max = Number.isFinite(e.maxHp) ? e.maxHp : (e.hp || 0);
  return {
    rounds: st.rounds || 0,
    dealt: Math.max(0, max - (e.hp || 0)),
    taken: st.taken || 0,
    bursts: st.bursts || 0,
  };
}

/** Tick statuses on the hero at the start of the hero's turn. Returns log lines. */
export function tickHeroStatuses(c, hero) {
  const lines = [];
  if (hasStatus(hero, 'bleeding')) {
    const d = 2;
    const lost = Math.min(d, hero.hp);
    hero.hp = Math.max(0, hero.hp - d);
    noteTaken(c, lost);
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
    if (c.windup) {
      c.windup = null;
      lines.push(`The stun breaks ${e.name}’s gathered ${e.windup?.name || 'strike'}!`);
    }
    return lines;
  }
  lines.push(...checkBossPhase(c));
  // Telegraphed heavy blow: a boss with a `windup` spends one turn gathering,
  // then strikes the hero next turn. Defend or a ward halves it; a stun breaks it.
  // rng is only consumed for enemies that define `windup`, keeping seeded runs stable.
  if (c.windup && e.windup) return releaseWindup(c, hero, rng, lines);
  if (e.windup && rng() < (e.windup.chance ?? 0)) {
    c.windup = { name: e.windup.name };
    lines.push(`${e.name} begins gathering ${e.windup.name}! Brace yourself: Defend or a ward will blunt the blow.`);
    // Gathering is the enemy's action, so one-action defenses expire as usual.
    c.defending = false;
    if (c.wardTurns > 0) c.wardTurns -= 1;
    if (c.aegisTurns > 0) c.aegisTurns -= 1;
    return lines;
  }
  // Pick a target among living party members (rng is only consumed with 2+ targets).
  const living = (party || [hero]).filter((m) => m && m.hp > 0);
  const target = living.length > 1 ? living[Math.floor(rng() * living.length) % living.length] : hero;
  if (target !== hero) {
    const ts = heroStats(target);
    const special = e.ability && rng() < (e.ability.chance ?? 0);
    const d = physicalDamage(e.atk, ts.def, rng, { mult: special ? (e.ability.mult ?? 1) : 1, warded: (c.aegisTurns || 0) > 0 });
    const lost = Math.min(d, target.hp);
    target.hp = Math.max(0, target.hp - d);
    noteTaken(c, lost);
    lines.push(special ? `${e.name} uses ${e.ability.name}! ${target.name} takes ${d}.` : `${e.name} hits ${target.name} for ${d}.`);
    if (target.hp <= 0) lines.push(`${target.name} is knocked out!`);
    else if (special && e.ability.status) {
      addStatus(target, e.ability.status, e.ability.turns || 3, allyTimers(c, target));
      lines.push(e.ability.status === 'bleeding' ? `${target.name} is bleeding!` : `${target.name} is shocked!`);
    }
    c.defending = false;
    if (c.wardTurns > 0) c.wardTurns -= 1;
    if (c.aegisTurns > 0) c.aegisTurns -= 1;
    return lines;
  }
  const hs = heroStats(hero);
  const warded = c.defending || c.wardTurns > 0 || (c.aegisTurns || 0) > 0;
  const special = e.ability && rng() < (e.ability.chance ?? 0);
  if (special) {
    const ab = e.ability;
    const d = physicalDamage(e.atk, hs.def, rng, { mult: ab.mult ?? 1, warded });
    const lost = Math.min(d, hero.hp);
    hero.hp = Math.max(0, hero.hp - d);
    noteTaken(c, lost);
    chargeFromHit(c, d, hs.maxHp);
    lines.push(`${e.name} uses ${ab.name}! ${hero.name} takes ${d}.`);
    if (ab.status) {
      addStatus(hero, ab.status, ab.turns || 3, c.heroTimers);
      lines.push(ab.status === 'bleeding' ? `${hero.name} is bleeding!` : `${hero.name} is shocked!`);
    }
  } else {
    const d = physicalDamage(e.atk, hs.def, rng, { warded });
    const lost = Math.min(d, hero.hp);
    hero.hp = Math.max(0, hero.hp - d);
    noteTaken(c, lost);
    chargeFromHit(c, d, hs.maxHp);
    lines.push(`${e.name} hits ${hero.name} for ${d}.`);
  }
  // Defend lasts exactly one enemy action; ward counts down per enemy action.
  c.defending = false;
  if (c.wardTurns > 0) c.wardTurns -= 1;
  if (c.aegisTurns > 0) c.aegisTurns -= 1;
  if (hero.hp <= 0) { c.over = 'defeat'; lines.push(`${hero.name} collapses...`); }
  return lines;
}

function releaseWindup(c, hero, rng, lines) {
  const e = c.enemy;
  const w = e.windup;
  c.windup = null;
  const hs = heroStats(hero);
  const warded = c.defending || c.wardTurns > 0 || (c.aegisTurns || 0) > 0;
  const d = physicalDamage(e.atk, hs.def, rng, { mult: w.mult ?? 2, warded });
  const lost = Math.min(d, hero.hp);
  hero.hp = Math.max(0, hero.hp - d);
  noteTaken(c, lost);
  chargeFromHit(c, d, hs.maxHp);
  lines.push(`${e.name} unleashes ${w.name}! ${hero.name} takes ${d}${warded ? ', braced against the worst of it' : ''}.`);
  c.defending = false;
  if (c.wardTurns > 0) c.wardTurns -= 1;
  if (c.aegisTurns > 0) c.aegisTurns -= 1;
  if (hero.hp <= 0) { c.over = 'defeat'; lines.push(`${hero.name} collapses...`); }
  return lines;
}

/** True while the enemy is gathering a telegraphed blow for next turn. */
export function enemyWindingUp(c) {
  return Boolean(c && c.windup && !c.over && c.enemy && c.enemy.hp > 0);
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
      noteTaken(c, Math.min(2, m.hp));
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
    if (c.enemy.defeat) lines.push(c.enemy.defeat);
  }
}

/**
 * Resolve a hero action, then the enemy reply. action: {type:'attack'|'defend'|'skill'|'flee', skillId?}
 * Item use is handled by the scene (via useConsumable) and then calls `afterHeroAction`.
 * Returns {ok, lines}.
 */
/** Beacon Charge: fills as Wren acts and takes hits; at full it unleashes a Beacon Burst. */
export const BEACON_CHARGE_MAX = 100;
export const BEACON_CHARGE_GAIN = Object.freeze({ attack: 15, skill: 15, defend: 10 });
export const BEACON_BURST = Object.freeze({ name: 'Beacon Burst', mult: 2.5, perLevel: 3 });
/** Adds charge (floored, clamped to 0..BEACON_CHARGE_MAX). */
/** One line from the first conscious companion when Beacon Burst lands. */
export const BURST_CHEERS = Object.freeze({
  scout: 'Tamsin whoops: “Right on target — keep it coming!”',
  keeper: 'Iven grins: “That’s the beacon’s own light!”',
  guardian: 'Bram roars: “Now that is a signal!”',
  signaler: 'Sela laughs: “Brighter than any flare I’ve lit!”',
});

export function burstCheer(party) {
  if (!Array.isArray(party)) return '';
  const known = (role) => typeof role === 'string' && Object.prototype.hasOwnProperty.call(BURST_CHEERS, role);
  const ally = party.find((m) => m && (m.hp || 0) > 0 && known(m.role));
  return ally ? BURST_CHEERS[ally.role] : '';
}

export function gainCharge(c, amount) {
  if (!c) return 0;
  const now = Number.isFinite(c.charge) ? c.charge : 0;
  c.charge = Math.min(BEACON_CHARGE_MAX, Math.max(0, now + Math.floor(Number(amount) || 0)));
  return c.charge;
}
/** Charge gained when Wren takes damage: 60 points per full max HP lost. */
function chargeFromHit(c, d, maxHp) { gainCharge(c, (d * 60) / Math.max(1, maxHp || 1)); }
export function chargeReady(c) { return (c?.charge || 0) >= BEACON_CHARGE_MAX; }

/** Apply element multiplier to damage and return adjusted value + optional log line. */
function applyElement(c, action, baseDmg) {
  const skill = action && action.type === 'skill' ? SKILLS[action.skillId] : null;
  const atkEl = skill ? skill.element : null;
  const defEl = c && c.enemy ? c.enemy.element : null;
  if (!atkEl && !defEl) return { dmg: baseDmg, note: '' };
  const mult = elementMultiplier(atkEl, defEl);
  const effective = elementEffectivenessText(atkEl, defEl);
  if (effective === 'strong') return { dmg: Math.floor(baseDmg * mult), note: ' It\'s super effective!' };
  if (effective === 'weak') return { dmg: Math.floor(baseDmg * mult), note: ' It\'s not very effective…' };
  return { dmg: baseDmg, note: '' };
}

export function heroAction(c, hero, action, rng = Math.random, party = [hero]) {
  if (c.over) return { ok: false, lines: ['The battle is over.'] };
  const lines = [];
  const hs = heroStats(hero);
  const shocked = hasStatus(hero, 'shocked');
  switch (action?.type) {
    case 'attack': {
      let d = physicalDamage(hs.atk, c.enemy.def, rng);
      const el = applyElement(c, action, d); d = el.dmg;
      c.enemy.hp = Math.max(0, c.enemy.hp - d);
      lines.push(`${hero.name} strikes for ${d}.${el.note}`);
      break;
    }
    case 'defend':
      c.defending = true;
      lines.push(`${hero.name} raises a guard.`);
      break;
    case 'skill': {
      const sk = SKILLS[action.skillId];
      if (!sk || !knownSkills(hero).some((s) => s.id === sk.id)) return { ok: false, lines: ['You do not know that skill.'] };
      if (shocked && sk.kind !== 'damage' && sk.kind !== 'cleanse' && sk.kind !== 'pierce' && sk.kind !== 'vigil' && sk.kind !== 'break') return { ok: false, lines: ['Too shocked to focus on that.'] };
      if (sk.kind === 'revive' && !party.some((m) => m && m !== hero && (m.hp || 0) <= 0)) return { ok: false, lines: ['No fallen ally needs the light.'] };
      if ((hero.mp || 0) < sk.mp) return { ok: false, lines: [`Not enough MP for ${sk.name}.`] };
      hero.mp -= sk.mp;
      if (sk.kind === 'damage') {
        let d = physicalDamage(hs.atk, c.enemy.def, rng, { mult: sk.mult });
        const el = applyElement(c, action, d); d = el.dmg;
        c.enemy.hp = Math.max(0, c.enemy.hp - d);
        lines.push(`${hero.name} uses ${sk.name} for ${d}!${el.note}`);
        if (rng() < 0.25) { addStatus(c.enemy, 'stunned', 1, c.enemyTimers); lines.push(`${c.enemy.name} reels, stunned.`); }
      } else if (sk.kind === 'magic') {
        let d = sk.power + (hero.level || 1) * 2 + randInt(rng, 0, 2);
        if (c.enemy.tags?.includes('construct')) d = Math.floor(d * 1.5);
        const el = applyElement(c, action, d); d = el.dmg;
        c.enemy.hp = Math.max(0, c.enemy.hp - d);
        lines.push(`${hero.name} casts ${sk.name} for ${d}!${el.note}`);
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
      } else if (sk.kind === 'pierce') {
        let d = Math.max(1, Math.floor(hs.atk * sk.mult) + randInt(rng, -1, 2));
        const el = applyElement(c, action, d); d = el.dmg;
        c.enemy.hp = Math.max(0, c.enemy.hp - d);
        lines.push(`${hero.name} hurls a ${sk.name} for ${d}!${el.note}`);
      } else if (sk.kind === 'break') {
        let d = Math.max(1, Math.floor(hs.atk * sk.mult) + randInt(rng, -1, 2));
        const el = applyElement(c, action, d); d = el.dmg;
        c.enemy.hp = Math.max(0, c.enemy.hp - d);
        lines.push(`${hero.name} finds the stillpoint and strikes for ${d}!${el.note}`);
        if (c.windup) {
          lines.push(`${c.windup.name || c.enemy.windup?.name || 'The heavy blow'} scatters before it can land!`);
          c.windup = null;
        }
      } else if (sk.kind === 'cleanse') {
        lines.push(`${hero.name} sounds a Steady Signal.`);
        for (const m of party) {
          if (!m || (m.hp || 0) <= 0) continue;
          const had = Array.isArray(m.statuses) && m.statuses.some((st) => st === 'bleeding' || st === 'shocked');
          if (Array.isArray(m.statuses)) m.statuses = m.statuses.filter((st) => st !== 'bleeding' && st !== 'shocked');
          if (m !== hero && c.allyTimers?.[m.id]) { delete c.allyTimers[m.id].bleeding; delete c.allyTimers[m.id].shocked; }
          if (had) lines.push(`${m.name} steadies.`);
        }
        if (c.heroTimers) { delete c.heroTimers.bleeding; delete c.heroTimers.shocked; }
      } else if (sk.kind === 'vigil') {
        lines.push(`${hero.name} keeps the Stormhaven Vigil!`);
        for (const m of party) {
          if (!m || (m.hp || 0) <= 0) continue;
          const maxHp = heroStats(m).maxHp;
          const before = m.hp;
          m.hp = Math.min(maxHp, m.hp + Math.max(1, Math.ceil(maxHp * (sk.share || 0.35))));
          if (Array.isArray(m.statuses)) m.statuses = m.statuses.filter((st) => st !== 'bleeding' && st !== 'shocked');
          if (m !== hero && c.allyTimers?.[m.id]) { delete c.allyTimers[m.id].bleeding; delete c.allyTimers[m.id].shocked; }
          lines.push(`${m.name} recovers ${m.hp - before} HP.`);
        }
        if (c.heroTimers) { delete c.heroTimers.bleeding; delete c.heroTimers.shocked; }
      } else if (sk.kind === 'revive') {
        lines.push(`${hero.name} lifts the lantern to Rekindle the fallen!`);
        for (const m of party) {
          if (!m || m === hero || (m.hp || 0) > 0) continue;
          m.hp = Math.max(1, Math.ceil(heroStats(m).maxHp * (sk.share || 0.4)));
          m.statuses = [];
          if (c.allyTimers?.[m.id]) delete c.allyTimers[m.id];
          lines.push(`${m.name} rises with ${m.hp} HP.`);
        }
      } else if (sk.kind === 'party_ward') {
        c.aegisTurns = sk.turns || 3;
        lines.push(`${hero.name} raises a Beacon Aegis over the party!`);
      } else if (sk.kind === 'ward') {
        c.wardTurns = 2;
        lines.push(`${hero.name} settles into a Warding Stance.`);
      }
      break;
    }
    case 'burst': {
      if (!chargeReady(c)) return { ok: false, lines: ['The Beacon Charge is not full yet.'] };
      c.charge = 0;
      battleStats(c).bursts += 1;
      const d = Math.max(1, Math.floor(hs.atk * BEACON_BURST.mult) + (hero.level || 1) * BEACON_BURST.perLevel);
      c.enemy.hp = Math.max(0, c.enemy.hp - d);
      lines.push(`${hero.name} unleashes a ${BEACON_BURST.name}! Searing light deals ${d}.`);
      const hadStatus = Array.isArray(hero.statuses) && hero.statuses.some((st) => st === 'bleeding' || st === 'shocked');
      if (Array.isArray(hero.statuses)) hero.statuses = hero.statuses.filter((st) => st !== 'bleeding' && st !== 'shocked');
      if (c.heroTimers) { delete c.heroTimers.bleeding; delete c.heroTimers.shocked; }
      if (hadStatus) lines.push(`The light clears ${hero.name}’s afflictions.`);
      const cheer = burstCheer(party);
      if (cheer) lines.push(cheer);
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
  if (Object.prototype.hasOwnProperty.call(BEACON_CHARGE_GAIN, action.type)) gainCharge(c, BEACON_CHARGE_GAIN[action.type]);
  checkVictory(c, lines);
  lines.push(...afterHeroAction(c, hero, rng, party));
  return { ok: true, lines };
}

/** Enemy reply + end-of-round status ticks. Used after any hero action that consumes the turn. */
export function afterHeroAction(c, hero, rng = Math.random, party = [hero]) {
  const lines = [];
  battleStats(c).rounds += 1;
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
/** Level at which companions master their signature technique. */
export const COMPANION_MASTERY_LEVEL = 8;
export const COMPANION_MASTERY = Object.freeze({
  keeper: { name: 'Keeper’s Mend', note: 'Mend restores 50% more HP.' },
  guardian: { name: 'Bulwark Bash', note: 'Shield Bash triggers more often and hits harder.' },
  signaler: { name: 'Bright Flare', note: 'Signal Flare deals 50% more damage.' },
  scout: { name: 'Piercing Shot', note: 'Aimed Shot triggers more often and hits harder.' },
});
/** True once a companion has reached mastery level. */
export function hasMastery(m) {
  return (m?.level || 1) >= COMPANION_MASTERY_LEVEL;
}

export function companionTurn(c, m, party = [m], rng = Math.random) {
  const lines = [];
  if (c.over || !m || m.hp <= 0) return lines;
  const ms = heroStats(m);
  const e = c.enemy;
  const shocked = hasStatus(m, 'shocked'); // shocked allies can't channel MP techniques
  const master = hasMastery(m);
  if (m.role === 'keeper' && !shocked && companionTactic(m) !== 'conserve') {
    const hurt = (party || []).filter((p) => p && p.hp > 0 && p.hp < heroStats(p).maxHp / 2)
      .sort((a, b) => a.hp / heroStats(a).maxHp - b.hp / heroStats(b).maxHp)[0];
    if (hurt && (m.mp || 0) >= SKILLS.mend.mp) {
      m.mp -= SKILLS.mend.mp;
      const before = hurt.hp;
      const heal = SKILLS.mend.power + (m.level || 1) * 2;
      hurt.hp = Math.min(heroStats(hurt).maxHp, hurt.hp + (master ? Math.floor(heal * 1.5) : heal));
      lines.push(`${m.name} uses ${master ? COMPANION_MASTERY.keeper.name : 'Mend'} on ${hurt.name}, restoring ${hurt.hp - before} HP.`);
      return lines;
    }
    if (e.tags?.includes('construct') && (m.mp || 0) >= SKILLS.spark.mp) {
      m.mp -= SKILLS.spark.mp;
      const d = Math.floor((SKILLS.spark.power + (m.level || 1) * 2 + randInt(rng, 0, 2)) * 1.5);
      e.hp = Math.max(0, e.hp - d);
      lines.push(`${m.name} casts Spark for ${d}!`);
      return lines;
    }
  }
  if (m.role === 'guardian' && rng() < (master ? 0.35 : 0.25)) {
    const d = physicalDamage(ms.atk, e.def, rng, master ? { mult: 1.3 } : undefined);
    e.hp = Math.max(0, e.hp - d);
    lines.push(`${m.name} lands a ${master ? COMPANION_MASTERY.guardian.name : 'Shield Bash'} for ${d}!`);
    if (e.hp > 0 && !e.boss && !hasStatus(e, 'stunned')) {
      addStatus(e, 'stunned', 1, c.enemyTimers);
      lines.push(`${e.name} is stunned!`);
    }
    return lines;
  }
  if (m.role === 'signaler' && !shocked && companionTactic(m) !== 'conserve' && (m.mp || 0) >= 3) {
    m.mp -= 3;
    const base = 5 + (m.level || 1) * 2 + randInt(rng, 0, 2);
    const d = master ? Math.floor(base * 1.5) : base;
    e.hp = Math.max(0, e.hp - d);
    lines.push(`${m.name} hurls a ${master ? COMPANION_MASTERY.signaler.name : 'Signal Flare'} for ${d}!`);
    return lines;
  }
  if (m.role === 'scout' && rng() < (master ? 0.4 : 0.3)) {
    const d = physicalDamage(ms.atk, e.def, rng, { mult: master ? 1.7 : 1.4 });
    e.hp = Math.max(0, e.hp - d);
    lines.push(`${m.name} looses ${master ? 'a ' + COMPANION_MASTERY.scout.name : 'an Aimed Shot'} for ${d}!`);
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
