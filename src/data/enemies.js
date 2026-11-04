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
    defeat: 'The Tide Wraith unravels into harmless rain. Far above, the beacon housing stops shuddering.',
    enrage: { threshold: 0.5, atk: 2, chance: 0.5, line: 'The Tide Wraith draws the whole storm into itself, arcing with lightning!' },
    ability: { name: 'Undertow', chance: 0.35, mult: 1.3, status: 'shocked', turns: 2 },
    loot: [
      { id: 'storm_tonic', chance: 1, minQty: 1, maxQty: 2 },
      { id: 'storm_glass', chance: 1, minQty: 2, maxQty: 3 },
    ],
  },
  reef_crawler: {
    id: 'reef_crawler', name: 'Reef Crawler', hp: 26, atk: 8, def: 4, spd: 4, xp: 18, gold: 10,
    intro: 'A barnacled Reef Crawler drags itself over the drowned pier, pincers snapping.',
    ability: { name: 'Pincer Grip', chance: 0.3, mult: 1.2, status: 'bleeding', turns: 2 },
    loot: [
      { id: 'scrap_metal', chance: 0.5, minQty: 1, maxQty: 2 },
      { id: 'healing_herb', chance: 0.3, minQty: 1, maxQty: 1 },
    ],
  },
  squall_revenant: {
    id: 'squall_revenant', name: 'Squall Revenant', hp: 32, atk: 9, def: 3, spd: 7, xp: 24, gold: 14,
    intro: 'Rain gathers into the outline of a drowned harbor guard, lantern still lit.',
    ability: { name: 'Lashing Rain', chance: 0.3, mult: 1.1, status: 'shocked', turns: 2 },
    loot: [
      { id: 'storm_glass', chance: 0.6, minQty: 1, maxQty: 2 },
      { id: 'storm_tonic', chance: 0.25, minQty: 1, maxQty: 1 },
    ],
  },
  frost_wolf: {
    id: 'frost_wolf', name: 'Frost Wolf', hp: 24, atk: 9, def: 2, spd: 9, xp: 18, gold: 6,
    intro: 'A Frost Wolf pads out of the sleet, breath steaming in the thin mountain air.',
    ability: { name: 'Rending Fangs', chance: 0.3, mult: 1.3, status: 'bleeding', turns: 2 },
    loot: [
      { id: 'healing_herb', chance: 0.4, minQty: 1, maxQty: 1 },
      { id: 'rations', chance: 0.3, minQty: 1, maxQty: 1 },
    ],
  },
  rockslide_golem: {
    id: 'rockslide_golem', name: 'Rockslide Golem', hp: 44, atk: 10, def: 6, spd: 2, xp: 32, gold: 18,
    tags: ['construct'],
    intro: 'Boulders lock together around a ruined signal engine and rise as a Rockslide Golem!',
    ability: { name: 'Landslide', chance: 0.25, mult: 1.5 },
    loot: [
      { id: 'salvaged_wiring', chance: 0.7, minQty: 1, maxQty: 2 },
      { id: 'scrap_metal', chance: 0.7, minQty: 1, maxQty: 3 },
    ],
  },
  pass_warlord: {
    id: 'pass_warlord', name: 'Highwatch Warlord', hp: 96, atk: 13, def: 6, spd: 5, xp: 70, gold: 45,
    boss: true,
    intro: 'Atop the frozen switchbacks, the Highwatch Warlord levels a notched halberd and bars the pass!',
    defeat: 'The Warlord drives his halberd into the snow and kneels. "Highwatch is yours to guard now," he rasps, and fades into the sleet.',
    enrage: { threshold: 0.5, atk: 3, chance: 0.5, line: 'The Highwatch Warlord tears off his frozen helm and roars for the pass to hold. His blows grow heavier!' },
    ability: { name: 'Sweeping Halberd', chance: 0.35, mult: 1.4, status: 'bleeding', turns: 3 },
    loot: [
      { id: 'iron_sword', chance: 0.5, minQty: 1, maxQty: 1 },
      { id: 'bandage', chance: 1, minQty: 1, maxQty: 2 },
      { id: 'salvaged_wiring', chance: 0.6, minQty: 1, maxQty: 2 },
    ],
  },
  drowned_harbormaster: {
    id: 'drowned_harbormaster', name: 'Drowned Harbormaster', hp: 88, atk: 12, def: 5, spd: 6, xp: 64, gold: 40,
    boss: true,
    intro: 'Chains rattle under the pier as the Drowned Harbormaster rises, lantern blazing with storm-light!',
    defeat: 'The Harbormaster\'s lantern dims to a calm amber. He lowers it toward the harbor mouth, as if guiding one last ship home, and sinks beneath the waves.',
    enrage: { threshold: 0.5, atk: 2, chance: 0.55, line: 'The Harbormaster\'s lantern flares white as the tide surges back in. His chains whip faster!' },
    ability: { name: 'Anchor Chain', chance: 0.35, mult: 1.35, status: 'shocked', turns: 2 },
    loot: [
      { id: 'storm_tonic', chance: 1, minQty: 1, maxQty: 2 },
      { id: 'storm_glass', chance: 0.8, minQty: 1, maxQty: 3 },
      { id: 'healing_herb', chance: 0.7, minQty: 1, maxQty: 2 },
    ],
  },
  dust_marauder: {
    id: 'dust_marauder', name: 'Dust Marauder', hp: 46, atk: 13, def: 5, spd: 7, xp: 30, gold: 18,
    ability: { name: 'Sandblind Slash', chance: 0.3, mult: 1.25, status: 'bleeding', turns: 3 },
    loot: [
      { id: 'bandage', chance: 0.5, minQty: 1, maxQty: 1 },
      { id: 'sunscar_glass', chance: 0.45, minQty: 1, maxQty: 1 },
    ],
  },
  relay_drone: {
    id: 'relay_drone', name: 'Relay Drone', hp: 52, atk: 12, def: 7, spd: 6, xp: 34, gold: 20,
    tags: ['construct'],
    ability: { name: 'Static Pulse', chance: 0.3, mult: 1.1, status: 'shocked', turns: 2 },
    loot: [
      { id: 'relay_brass', chance: 0.6, minQty: 1, maxQty: 2 },
      { id: 'salvaged_wiring', chance: 0.4, minQty: 1, maxQty: 1 },
    ],
  },
  relay_warden: {
    id: 'relay_warden', name: 'Relay Warden', hp: 170, atk: 16, def: 7, spd: 5, xp: 95, gold: 60,
    tags: ['construct'], boss: true,
    intro: 'The relay station shudders awake. A towering brass Warden unfolds from its cradle, coils humming with stolen storm-charge!',
    defeat: 'The Relay Warden folds back into its cradle with a long mechanical sigh. Its coils cool from blue to dull copper, and the console beyond flickers to life.',
    enrage: { threshold: 0.5, atk: 3, chance: 0.5, line: 'The Relay Warden vents a gout of blue sparks and overclocks its coils. Its strikes come harder!' },
    ability: { name: 'Overcharge Beam', chance: 0.35, mult: 1.4, status: 'shocked', turns: 2 },
    loot: [
      { id: 'relay_brass', chance: 1, minQty: 2, maxQty: 3 },
      { id: 'sunscar_glass', chance: 0.8, minQty: 1, maxQty: 2 },
      { id: 'storm_tonic', chance: 1, minQty: 1, maxQty: 2 },
    ],
  },
  ashen_raider: {
    id: 'ashen_raider', name: 'Ashen Raider', hp: 84, atk: 18, def: 7, spd: 7, xp: 48, gold: 30,
    ability: { name: 'Cinder Blade', chance: 0.3, mult: 1.25, status: 'bleeding', turns: 3 },
    loot: [
      { id: 'bandage', chance: 0.5, minQty: 1, maxQty: 1 },
      { id: 'thunder_iron', chance: 0.4, minQty: 1, maxQty: 1 },
    ],
  },
  spire_sentry: {
    id: 'spire_sentry', name: 'Spire Sentry', hp: 104, atk: 17, def: 10, spd: 4, xp: 52, gold: 28,
    tags: ['construct'],
    ability: { name: 'Chain Lightning', chance: 0.3, mult: 1.15, status: 'shocked', turns: 2 },
    loot: [
      { id: 'thunder_iron', chance: 0.6, minQty: 1, maxQty: 2 },
      { id: 'salvaged_wiring', chance: 0.5, minQty: 1, maxQty: 2 },
    ],
  },
  stormcrown_tyrant: {
    id: 'stormcrown_tyrant', name: 'Stormcrown Tyrant', hp: 460, atk: 27, def: 8, spd: 6, xp: 160, gold: 120,
    boss: true,
    intro: 'Atop the spire, a figure in a crown of living lightning turns from the gathering clouds. "So the little beacon-keepers finally climbed this high."',
    defeat: 'The crown of lightning gutters and goes dark. The Tyrant sinks to one knee as the clouds above the spire finally begin to thin.',
    enrage: { threshold: 0.4, atk: 4, chance: 0.5, line: 'The Stormcrown Tyrant raises both arms and calls the whole thunderhead down upon the spire!' },
    ability: { name: 'Tempest Call', chance: 0.35, mult: 1.45, status: 'shocked', turns: 2 },
    loot: [
      { id: 'thunder_iron', chance: 1, minQty: 2, maxQty: 3 },
      { id: 'storm_tonic', chance: 1, minQty: 2, maxQty: 2 },
      { id: 'stormcrown_shard', chance: 1, minQty: 1, maxQty: 1 },
    ],
  },
};
