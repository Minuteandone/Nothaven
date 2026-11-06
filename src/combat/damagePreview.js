/**
 * Damage preview — compute expected damage range for an action
 * against the current enemy, factoring in element matchups.
 *
 * `damagePreview(skill, hero, enemy)` returns a summary object
 * or null when the action deals no damage.
 *
 * skill  — null/undefined for a basic attack, or a skill object from SKILLS
 * hero   — the acting hero (used for stats, level)
 * enemy  — the target enemy (used for def, element, tags)
 *
 * Return shape: { min, max, kind, effective, element } | null
 *   kind:      'attack' | 'damage' | 'magic' | 'pierce' | 'break'
 *   effective: 'strong' | 'weak' | ''
 *   element:   element id or null
 */

import { heroStats } from './rules.js';
import { elementMultiplier, elementEffectivenessText } from './elements.js';

/** @param {unknown} x @returns {number} */
function n(x, fallback = 0) {
  if (typeof x === 'number' && Number.isFinite(x) && x >= 0) return Math.floor(x);
  return fallback;
}

/**
 * Apply element multiplier to a min/max pair the same way
 * applyElement() does for a single base-damage value.
 */
function applyElementRange(min, max, atkEl, defEl) {
  const mult = elementMultiplier(atkEl, defEl);
  const effective = elementEffectivenessText(atkEl, defEl);
  if (effective === 'strong') {
    return {
      min: Math.max(1, Math.floor(min * mult)),
      max: Math.max(1, Math.floor(max * mult)),
      effective: 'strong',
    };
  }
  if (effective === 'weak') {
    return {
      min: Math.max(1, Math.floor(min * mult)),
      max: Math.max(1, Math.floor(max * mult)),
      effective: 'weak',
    };
  }
  return { min, max, effective: '' };
}


/** Halve min/max (floor, min 1) when a ward is active. */
function applyWard(min, max, warded) {
  if (!warded) return { min, max };
  return {
    min: Math.max(1, Math.floor(min / 2)),
    max: Math.max(1, Math.floor(max / 2)),
  };
}

/**
 * Main entry point.
 *
 * @param {object|null|undefined} skill  — null for basic attack, or a SKILLS entry
 * @param {object} hero   — party hero object (must have .level)
 * @param {object} enemy  — enemy object (must have .def, .element, .tags)
 * @param {object} [opts]
 * @param {boolean} [opts.warded=false] — halve damage while a ward or defend is active
 * @returns {{min:number, max:number, kind:string, effective:string, element:string|null}|null}
 */
export function damagePreview(skill, hero, enemy, { warded = false } = {}) {
  if (!hero || !enemy) return null;
  const hs = heroStats(hero);
  const atk = n(hs?.atk, 10);
  const def = n(enemy?.def, 0);
  const defEl = enemy?.element || null;
  const construct = Array.isArray(enemy?.tags) && enemy.tags.includes('construct');

  // ---- basic attack (no skill) ----
  if (!skill) {
    const base = Math.floor(atk); // mult = 1
    const physMin = Math.max(1, base - def - 1);
    const physMax = Math.max(1, base - def + 2);
    const el = applyElementRange(physMin, physMax, null, defEl);
    const w = applyWard(el.min, el.max, warded);
    return { min: w.min, max: w.max, kind: 'attack', effective: el.effective, element: null };
  }

  const sk = typeof skill === 'string' ? null : skill; // skill objects only; string IDs not supported here
  if (!sk || typeof sk.kind !== 'string') return null;

  // ---- non-damaging kinds ----
  if (!['damage', 'magic', 'pierce', 'break'].includes(sk.kind)) return null;

  const atkEl = sk.element || null;
  const mult = (typeof sk.mult === 'number' && Number.isFinite(sk.mult) && sk.mult > 0) ? sk.mult : 1;

  if (sk.kind === 'damage') {
    const base = Math.floor(atk * mult);
    const physMin = Math.max(1, base - def - 1);
    const physMax = Math.max(1, base - def + 2);
    const el = applyElementRange(physMin, physMax, atkEl, defEl);
    const w = applyWard(el.min, el.max, warded);
    return { min: w.min, max: w.max, kind: 'damage', effective: el.effective, element: atkEl };
  }

  if (sk.kind === 'magic') {
    const level = n(hero?.level, 1);
    const power = n(sk.power, 0) + level * 2;
    let magMin = power;          // randInt(0,2) → 0
    let magMax = power + 2;      // randInt(0,2) → 2
    if (construct) {
      magMin = Math.floor(magMin * 1.5);
      magMax = Math.floor(magMax * 1.5);
    }
    const el = applyElementRange(magMin, magMax, atkEl, defEl);
    const w = applyWard(el.min, el.max, warded);
    return { min: w.min, max: w.max, kind: 'magic', effective: el.effective, element: atkEl };
  }

  if (sk.kind === 'pierce' || sk.kind === 'break') {
    const base = Math.floor(atk * mult);
    const pierceMin = Math.max(1, base - 1);
    const pierceMax = Math.max(1, base + 2);
    const el = applyElementRange(pierceMin, pierceMax, atkEl, defEl);
    const w = applyWard(el.min, el.max, warded);
    return { min: w.min, max: w.max, kind: sk.kind, effective: el.effective, element: atkEl };
  }

  return null;
}
