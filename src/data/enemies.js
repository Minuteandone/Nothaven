// Enemy data tables. All fields are plain JSON (keep anything added here serializable).
// `abilities` map to entries in src/combat/abilities.js (monster ability ids prefixed `m:`).
// `loot` is a list of [{ id, chance (0..1), minQty?, maxQty? }] rolled on victory.
export const ENEMIES = {
  storm_rat: {
    id: 'storm_rat',
    name: 'Storm Rat',
    desc: 'A scrawny scavenger grown bold from the endless storms.',
    hp: 12, mp: 0, atk: 4, def: 1, spd: 4,
    xp: 5, gold: 3,
    abilities: [],
    loot: [{ id: 'rat_fang', chance: 0.35, minQty: 1, maxQty: 1 }],
  },
  storm_wolf: {
    id: 'storm_wolf',
    name: 'Storm Wolf',
    desc: 'A lean hunter, its fur matted with static from the ridge gales.',
    hp: 22, mp: 0, atk: 7, def: 3, spd: 6,
    xp: 12, gold: 8,
    abilities: [{ id: 'm:howl' }],
    loot: [{ id: 'wolf_pelt', chance: 0.4, minQty: 1, maxQty: 1 }],
  },
  storm_ooze: {
    id: 'storm_ooze',
    name: 'Storm Ooze',
    desc: 'A shimmering mass of electrified slime, born where lightning strikes the ridge puddles repeatedly.',
    hp: 18, mp: 0, atk: 5, def: 2, spd: 3,
    xp: 9, gold: 6,
    abilities: [{ id: 'm:corrosive_slime' }],
    loot: [
      { id: 'storm_crystal', chance: 0.12, minQty: 1, maxQty: 1 },
      { id: 'ooze_essence', chance: 0.3, minQty: 1, maxQty: 2 },
    ],
  },
  rust_sentinel: {
    id: 'rust_sentinel',
    name: 'Rust Sentinel',
    desc: 'A hulking automaton left to guard the ruined observatory, its joints weeping rust.',
    hp: 40, mp: 0, atk: 9, def: 6, spd: 2,
    xp: 22, gold: 15,
    abilities: [{ id: 'm:overcharge' }],
    loot: [{ id: 'iron_shard', chance: 0.5, minQty: 1, maxQty: 2 }],
  },
  beacon_imp: {
    id: 'beacon_imp',
    name: 'Beacon Imp',
    desc: 'A cackling creature drawn to the dying beacon fire like a moth.',
    hp: 15, mp: 8, atk: 6, def: 3, spd: 7,
    xp: 10, gold: 7,
    abilities: [{ id: 'm:ember_burst' }],
    loot: [{ id: 'shimmer_dust', chance: 0.25, minQty: 1, maxQty: 1 }],
  },
};
