// Enemy roster for Beacon of Stormhaven. Loot uses the items module format
// {id, chance, minQty, maxQty}. `ability` is an optional special move used
// with probability `chance`; `tags` drive skill bonuses (e.g. 'construct').
export const ENEMIES = {
  storm_rat: {
    id: 'storm_rat', name: 'Storm Rat', hp: 12, atk: 4, def: 1, spd: 4, xp: 5, gold: 3,
    intro: 'A Storm Rat scuttles out of a flooded drain, fur bristling with static!',
    ability: { name: 'Gnaw', chance: 0.2, mult: 1, status: 'bleeding', turns: 2 },
    loot: [
      { id: 'scrap_metal', chance: 0.4, minQty: 1, maxQty: 1 },
      { id: 'rations', chance: 0.2, minQty: 1, maxQty: 1 },
    ],
  },
  ridge_bandit: {
    id: 'ridge_bandit', name: 'Ridge Bandit', hp: 20, atk: 6, def: 2, spd: 5, xp: 10, gold: 9,
    intro: 'A Ridge Bandit steps from behind a toppled signpost, knife drawn.',
    ability: { name: 'Dirty Cut', chance: 0.25, mult: 1.2, status: 'bleeding', turns: 3 },
    loot: [
      { id: 'bandage', chance: 0.5, minQty: 1, maxQty: 2 },
      { id: 'scrap_metal', chance: 0.5, minQty: 1, maxQty: 2 },
      { id: 'storm_dispatch_a', chance: 0.1, minQty: 1, maxQty: 1 },
    ],
  },
  gale_hound: {
    id: 'gale_hound', name: 'Gale Hound', hp: 18, atk: 7, def: 1, spd: 8, xp: 12, gold: 4,
    intro: 'A lean Gale Hound lopes down the slope, howling with the wind.',
    ability: { name: 'Lunging Bite', chance: 0.3, mult: 1.4 },
    loot: [
      { id: 'healing_herb', chance: 0.35, minQty: 1, maxQty: 1 },
      { id: 'storm_glass', chance: 0.25, minQty: 1, maxQty: 1 },
    ],
  },
  rust_sentinel: {
    id: 'rust_sentinel', name: 'Rust Sentinel', hp: 34, atk: 8, def: 5, spd: 3, xp: 25, gold: 15,
    tags: ['construct'],
    intro: 'Gears grind as a Rust Sentinel lurches upright among the observatory ruins.',
    ability: { name: 'Arc Discharge', chance: 0.3, mult: 1.1, status: 'shocked', turns: 2 },
    loot: [
      { id: 'salvaged_wiring', chance: 0.8, minQty: 1, maxQty: 2 },
      { id: 'storm_glass', chance: 0.5, minQty: 1, maxQty: 2 },
      { id: 'lens_shard', chance: 0.3, minQty: 1, maxQty: 1 },
    ],
  },
  tide_wraith: {
    id: 'tide_wraith', name: 'Tide Wraith', hp: 50, atk: 10, def: 4, spd: 6, xp: 50, gold: 30,
    boss: true,
    intro: 'Seawater and lightning knot together into a Tide Wraith at the foot of the beacon!',
    ability: { name: 'Undertow', chance: 0.35, mult: 1.3, status: 'shocked', turns: 2 },
    loot: [
      { id: 'storm_tonic', chance: 1, minQty: 1, maxQty: 2 },
      { id: 'storm_glass', chance: 1, minQty: 2, maxQty: 3 },
    ],
  },
};
