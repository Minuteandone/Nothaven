// Ability definitions. Hero abilities are keyed by string id; monster abilities use `m:` prefix.
// Each ability is pure data plus an optional `apply(actor, target, combat)` mutator that returns
// a human-readable log fragment (or array of fragments). `acc` (accuracy, 0..1) can be null for
// always-hit effects.

export const HERO_ABILITIES = {
  attack: {
    id: 'attack', name: 'Attack', mp: 0,
    desc: 'A plain, reliable strike.',
    acc: 0.95, power: 1.0,
  },
  storm_slash: {
    id: 'storm_slash', name: 'Storm Slash', mp: 3,
    desc: 'Channel the storm into a heavier blow.',
    acc: 0.9, power: 1.9,
  },
  healing_breeze: {
    id: 'healing_breeze', name: 'Healing Breeze', mp: 4,
    desc: 'A soothing gust that mends wounds.',
    heal: 9,
  },
  defend: {
    id: 'defend', name: 'Defend', mp: 0,
    desc: 'Brace to halve incoming damage.',
  },
};

// Monster abilities. `fx` are short lifecycle hook names resolved by src/combat/engine.js.
export const MONSTER_ABILITIES = {
  'm:howl': {
    id: 'm:howl', name: 'Howl',
    desc: 'Raises attack with a piercing cry.',
    fx: 'buff', stat: 'atk', amount: 2, turns: 3,
  },
  'm:corrosive_slime': {
    id: 'm:corrosive_slime', name: 'Corrosive Slime',
    desc: 'Flings caustic residue that slows its target.',
    fx: 'debuff', stat: 'spd', amount: 2, turns: 2,
  },
  'm:overcharge': {
    id: 'm:overcharge', name: 'Overcharge',
    desc: 'Dumps power into a heavy swing at a cost to its own stability.',
    fx: 'selfDamage', power: 1.5, selfDamage: 6,
  },
  'm:ember_burst': {
    id: 'm:ember_burst', name: 'Ember Burst',
    desc: 'Spits a spray of embers that can singe away defenses.',
    fx: 'burn', dot: 3, turns: 3, acc: 0.85,
  },
};
