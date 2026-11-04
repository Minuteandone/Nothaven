// Map zone definitions for Beacon of Stormhaven.
// Coordinates use (x, y) with (0, 0) at top-left.

export const TILE_TYPES = {
  '#': { id: 'wall', name: 'Stone Wall / Cliff', walkable: false, glyph: '#' },
  '.': { id: 'floor', name: 'Cobble / Trail', walkable: true, glyph: '·' },
  ',': { id: 'grass', name: 'Windswept Scrub', walkable: true, glyph: ',' },
  '~': { id: 'chasm', name: 'Storm Chasm', walkable: false, glyph: '≈' },
  '^': { id: 'crag', name: 'Jagged Crag', walkable: false, glyph: '▲' },
  '+': { id: 'gate', name: 'Passage / Gate', walkable: true, glyph: '╬' },
  '*': { id: 'beacon', name: 'Beacon Brazier', walkable: true, glyph: '✦' },
};

export const ZONES = {
  greyhaven: {
    id: 'greyhaven',
    name: 'Greyhaven',
    subtitle: 'Storm-Battered Frontier Town',
    dangerLevel: 0,
    description:
      'Lanterns sway against the gale in Greyhaven’s cobbled square. Beyond the eastern gate, the ridge road climbs toward the shattered observatory.',
    width: 9,
    height: 7,
    grid: [
      '#########',
      '#..,....#',
      '#..,..,.#',
      '#......,+',
      '#.,..#..#',
      '#.......#',
      '#########',
    ],
    spawns: {
      default: { x: 2, y: 3 },
      from_ridge_road: { x: 7, y: 3 },
    },
    exits: [
      {
        x: 8,
        y: 3,
        toZone: 'ridge_road',
        toSpawn: 'from_greyhaven',
        label: 'East Gate → Ridge Road',
      },
    ],
    npcs: [
      {
        id: 'mara',
        name: 'Warden Mara',
        role: 'Town Warden',
        x: 3,
        y: 2,
        symbol: 'M',
        defaultLine:
          'The storm beacon failed at dusk. Clear the Ridge Road and recover the observatory lens before the next squall hits.',
      },
      {
        id: 'iven',
        name: 'Iven',
        role: 'Apprentice Keeper',
        x: 5,
        y: 2,
        symbol: 'I',
        defaultLine:
          'The primary lens was stored in the Observatory Ruins. Once we have it, we can calibrate the Beacon Tower for Greyhaven or the whole valley.',
      },
      {
        id: 'tamsin',
        name: 'Tamsin',
        role: 'Route Scout',
        x: 6,
        y: 4,
        symbol: 'T',
        defaultLine:
          'Our couriers dropped two sealed dispatches along the ridge and the ruins. Bring them back if you spot them.',
      },
    ],
    interactables: [
      {
        id: 'greyhaven_inn',
        interactionId: 'greyhaven_inn',
        name: 'Hearthstone Inn',
        kind: 'inn',
        x: 1,
        y: 1,
        symbol: 'H',
        once: false,
        costGold: 5,
        description: 'Warm stew and dry blankets. Rest for 5 gold to restore full HP and MP.',
      },
      {
        id: 'greyhaven_board',
        interactionId: 'greyhaven_board',
        name: 'Watchmen Noticeboard',
        kind: 'lore',
        x: 2,
        y: 5,
        symbol: '?',
        once: false,
        description:
          'Notice: "Ridge Road blocked by storm-crazed patrols. All expeditions report to Warden Mara before departing."',
      },
    ],
    encounters: [],
    randomEncounterChance: 0,
    randomEncounters: [],
  },

  ridge_road: {
    id: 'ridge_road',
    name: 'Ridge Road',
    subtitle: 'Wind-Lashed Cliffside Ascent',
    dangerLevel: 1,
    description:
      'Slick switchbacks hug the cliff above a roaring abyss. Fallen masonry and storm beasts choke the narrow pass toward the observatory.',
    width: 9,
    height: 7,
    grid: [
      '^^^^^^^+#',
      '##...,..#',
      '#..,^^..#',
      '+...,...#',
      '#..~~,..#',
      '#...,..~#',
      '#########',
    ],
    spawns: {
      default: { x: 1, y: 3 },
      from_greyhaven: { x: 1, y: 3 },
      from_observatory_ruins: { x: 7, y: 1 },
    },
    exits: [
      {
        x: 0,
        y: 3,
        toZone: 'greyhaven',
        toSpawn: 'from_ridge_road',
        label: 'West Trail → Greyhaven',
      },
      {
        x: 7,
        y: 0,
        toZone: 'observatory_ruins',
        toSpawn: 'from_ridge_road',
        label: 'North Ascent → Observatory Ruins',
      },
    ],
    npcs: [],
    interactables: [
      {
        id: 'dispatch_ridge',
        interactionId: 'dispatch_ridge',
        name: 'Lost Ridge Dispatch',
        kind: 'dispatch',
        x: 5,
        y: 5,
        symbol: '✉',
        once: true,
        description:
          'A weather-sealed leather satchel wedged beside the chasm: courier logs detailing the storm surge patterns.',
      },
    ],
    encounters: [
      {
        id: 'ridge_patrol',
        encounterId: 'ridge_patrol',
        enemyId: 'storm_rat',
        name: 'Ridge Patrol Pack',
        x: 5,
        y: 3,
        symbol: '!',
        main: true,
        description: 'Feral storm beasts prowling the central switchback.',
      },
    ],
    randomEncounterChance: 0.12,
    randomEncounters: [
      { encounterId: 'ridge_skirmish', enemyId: 'storm_rat', weight: 1 },
    ],
  },

  observatory_ruins: {
    id: 'observatory_ruins',
    name: 'Observatory Ruins',
    subtitle: 'Shattered Astral Dome',
    dangerLevel: 2,
    description:
      'Lightning flickers across cracked brass arcs and collapsed vaults. The great refractory lens rests within the upper sanctum.',
    width: 9,
    height: 7,
    grid: [
      '####+####',
      '#...*...#',
      '#.#...#.#',
      '#...,...#',
      '#.#...#.#',
      '#.......#',
      '####+####',
    ],
    spawns: {
      default: { x: 4, y: 5 },
      from_ridge_road: { x: 4, y: 5 },
      from_beacon_tower: { x: 4, y: 1 },
    },
    exits: [
      {
        x: 4,
        y: 6,
        toZone: 'ridge_road',
        toSpawn: 'from_observatory_ruins',
        label: 'South Steps → Ridge Road',
      },
      {
        x: 4,
        y: 0,
        toZone: 'beacon_tower',
        toSpawn: 'from_observatory_ruins',
        label: 'North Causeway → Beacon Tower',
      },
    ],
    npcs: [],
    interactables: [
      {
        id: 'dispatch_observatory',
        interactionId: 'dispatch_observatory',
        name: 'Observatory Dispatch',
        kind: 'dispatch',
        x: 1,
        y: 3,
        symbol: '✉',
        once: true,
        description:
          'Notes left by the chief optician describing how the lens can focus either a tight dome over Greyhaven or a wide warning beam.',
      },
      {
        id: 'observatory_lens_pedestal',
        interactionId: 'observatory_lens_pedestal',
        name: 'Refractory Lens Pedestal',
        kind: 'relic',
        x: 4,
        y: 1,
        symbol: '◈',
        once: true,
        requiresEncounterCleared: 'observatory_sentinel',
        description:
          'The pristine storm-glass lens rests in its bronze gimbal, awaiting transport to the Beacon Tower.',
      },
    ],
    encounters: [
      {
        id: 'observatory_sentinel',
        encounterId: 'observatory_sentinel',
        enemyId: 'storm_rat',
        name: 'Observatory Sentinel',
        x: 4,
        y: 2,
        symbol: '!',
        main: true,
        description: 'A relentless guardian blocking access to the lens pedestal.',
      },
    ],
    randomEncounterChance: 0.12,
    randomEncounters: [
      { encounterId: 'ruins_skirmish', enemyId: 'storm_rat', weight: 1 },
    ],
  },

  beacon_tower: {
    id: 'beacon_tower',
    name: 'Beacon Tower',
    subtitle: 'High Spire of the Stormwatch',
    dangerLevel: 1,
    description:
      'At the pinnacle of the cliff, the great bronze housing stands cold above the clouds. From here, a relit beam can shield Greyhaven alone or signal distant settlements across the frontier.',
    width: 9,
    height: 7,
    grid: [
      '~~~~~~~~~',
      '~~#####~~',
      '~~#...#~~',
      '~~#.*.+~~',
      '~~#...#~~',
      '~~##+##~~',
      '~~~~~~~~~',
    ],
    spawns: {
      default: { x: 4, y: 4 },
      from_observatory_ruins: { x: 4, y: 4 },
    },
    exits: [
      {
        x: 4,
        y: 5,
        toZone: 'observatory_ruins',
        toSpawn: 'from_beacon_tower',
        label: 'Descend → Observatory Ruins',
      },
      {
        x: 6,
        y: 3,
        toZone: 'greyhaven',
        toSpawn: 'default',
        label: 'Signal Lift → Greyhaven',
      },
    ],
    npcs: [],
    interactables: [
      {
        id: 'beacon_cradle',
        interactionId: 'beacon_cradle',
        name: 'Storm Beacon Mechanism',
        kind: 'beacon',
        x: 4,
        y: 3,
        symbol: '✦',
        once: false,
        description:
          'The central lens cradle and reflector array. Once the council in Greyhaven has been heard, use the Beacon panel below to align the light.',
      },
    ],
    encounters: [],
    randomEncounterChance: 0,
    randomEncounters: [],
  },
};

export const ZONE_ORDER = [
  'greyhaven',
  'ridge_road',
  'observatory_ruins',
  'beacon_tower',
];
