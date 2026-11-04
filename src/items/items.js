// Item catalog for Beacon of Stormhaven.
// Plain data only: every entry is JSON-serializable and safe to expose to the UI.
// IDs are stable snake_case strings — never rename an existing id (story rewards,
// loot tables and saves reference them).

/** @typedef {'consumable'|'equipment'|'key'|'material'} ItemType */

export const TYPES = {
  CONSUMABLE: 'consumable',
  EQUIPMENT: 'equipment',
  KEY: 'key',
  MATERIAL: 'material',
};

export const SLOTS = ['weapon', 'armor', 'trinket'];

/** Special non-inventory currency id (gold lives in state.gold). */
export const GOLD_ID = 'gold';

/**
 * The item catalog. Keyed by item id.
 * @type {Readonly<Record<string, {
 *   id: string, name: string, type: ItemType, slot?: string,
 *   stats?: {atk?: number, def?: number, hp?: number, mp?: number},
 *   use?: {hp?: number, mp?: number, cure?: string},
 *   price?: number, sellPrice?: number, description: string,
 * }>>}
 */
export const ITEMS = Object.freeze({
  // ---- Consumables ----
  healing_herb: {
    id: 'healing_herb', name: 'Healing Herb', type: TYPES.CONSUMABLE,
    use: { hp: 30 }, price: 18, sellPrice: 9,
    description: 'Bitter grey-green leaves that dull pain and knit flesh when chewed.',
  },
  bandage: {
    id: 'bandage', name: 'Linen Bandage', type: TYPES.CONSUMABLE,
    use: { hp: 15, cure: 'bleeding' }, price: 10, sellPrice: 5,
    description: 'Boiled linen strips. Stops bleeding and covers the ugliest wounds.',
  },
  storm_tonic: {
    id: 'storm_tonic', name: 'Storm Tonic', type: TYPES.CONSUMABLE,
    use: { mp: 20, cure: 'shocked' }, price: 22, sellPrice: 11,
    description: 'A crackling draught distilled from storm-charged salts. Restores focus.',
  },
  rations: {
    id: 'rations', name: 'Trail Rations', type: TYPES.CONSUMABLE,
    use: { hp: 10 }, price: 6, sellPrice: 2,
    description: 'Hard biscuit and dried fish. Not tasty, but it keeps you walking.',
  },

  // ---- Equipment: weapons ----
  rusted_pipe: {
    id: 'rusted_pipe', name: 'Rusted Pipe', type: TYPES.EQUIPMENT, slot: 'weapon',
    stats: { atk: 3 }, price: 10, sellPrice: 4,
    description: 'A length of salvaged water main. Heavy, crude, and it gets the job done.',
  },
  iron_sword: {
    id: 'iron_sword', name: 'Iron Sword', type: TYPES.EQUIPMENT, slot: 'weapon',
    stats: { atk: 7 }, price: 60, sellPrice: 30,
    description: 'Standard Greyhaven town guard issue. Balanced and dependable.',
  },
  warden_blade: {
    id: 'warden_blade', name: "Warden's Blade", type: TYPES.EQUIPMENT, slot: 'weapon',
    stats: { atk: 12 }, price: 180, sellPrice: 90,
    description: 'A keen-edged longsword carried by the wardens of old Greyhaven.',
  },
  salvaged_blade: {
    id: 'salvaged_blade', name: 'Salvaged Blade', type: TYPES.EQUIPMENT, slot: 'weapon',
    stats: { atk: 9 }, price: 95, sellPrice: 45,
    description: 'A guard blade reforged over the hearth from storm-wreck salvage. Honest iron, second life.',
  },

  // ---- Equipment: armor ----
  padded_vest: {
    id: 'padded_vest', name: 'Padded Vest', type: TYPES.EQUIPMENT, slot: 'armor',
    stats: { def: 2 }, price: 20, sellPrice: 8,
    description: 'Quilted cloth padding. Better than nothing against wind and claw alike.',
  },
  leather_armor: {
    id: 'leather_armor', name: 'Leather Armor', type: TYPES.EQUIPMENT, slot: 'armor',
    stats: { def: 5 }, price: 55, sellPrice: 27,
    description: 'Oiled hide cured against the damp. Turns a blade and shrugs off brambles.',
  },
  keeper_coat: {
    id: 'keeper_coat', name: "Keeper's Coat", type: TYPES.EQUIPMENT, slot: 'armor',
    stats: { def: 8, hp: 10 }, price: 150, sellPrice: 75,
    description: 'The heavy weathercoat of a beacon keeper, warded against storm and spark.',
  },

  // ---- Equipment: trinkets ----
  tin_whistle: {
    id: 'tin_whistle', name: 'Tin Whistle', type: TYPES.EQUIPMENT, slot: 'trinket',
    stats: { hp: 5 }, price: 25, sellPrice: 10,
    description: 'A battered whistle that plays one crisp, steadying note.',
  },
  scout_compass: {
    id: 'scout_compass', name: "Scout's Compass", type: TYPES.EQUIPMENT, slot: 'trinket',
    stats: { def: 1, hp: 5 }, price: 45, sellPrice: 22,
    description: "Tamsin's spare compass. It always points somewhere useful.",
  },
  lens_shard: {
    id: 'lens_shard', name: 'Lens Shard', type: TYPES.EQUIPMENT, slot: 'trinket',
    stats: { atk: 2, mp: 5 }, price: 70, sellPrice: 35,
    description: 'A fragment of the observatory lens that glows faintly before a storm.',
  },
  storm_lantern: {
    id: 'storm_lantern', name: 'Storm Lantern', type: TYPES.EQUIPMENT, slot: 'trinket',
    stats: { hp: 8, spd: 1 }, price: 40, sellPrice: 18,
    description: 'A shut brass lantern that holds its flame against the gale. Light steadies the hand.',
  },

  // ---- Key items ----
  observatory_lens: {
    id: 'observatory_lens', name: 'Observatory Lens', type: TYPES.KEY,
    description: 'The great ground lens of Greyhaven observatory, needed to relight the beacon.',
  },
  beacon_core: {
    id: 'beacon_core', name: 'Beacon Core', type: TYPES.KEY,
    description: 'The storm-forged heart of the beacon tower. Cold and silent, for now.',
  },
  storm_dispatch_a: {
    id: 'storm_dispatch_a', name: 'Waterlogged Dispatch', type: TYPES.KEY,
    description: 'A courier letter half-soaked by the storm. Parts are still legible.',
  },
  storm_dispatch_b: {
    id: 'storm_dispatch_b', name: 'Sealed Dispatch', type: TYPES.KEY,
    description: 'A courier letter sealed with wax, addressed to settlements up the coast.',
  },

  // ---- Materials ----
  scrap_metal: {
    id: 'scrap_metal', name: 'Scrap Metal', type: TYPES.MATERIAL,
    price: 8, sellPrice: 4,
    description: 'Twisted iron from ruined fences and roofs. The smith pays by the pound.',
  },
  salvaged_wiring: {
    id: 'salvaged_wiring', name: 'Salvaged Wiring', type: TYPES.MATERIAL,
    price: 12, sellPrice: 6,
    description: 'Copper wire stripped from dead signal posts. Essential for beacon repairs.',
  },
  storm_glass: {
    id: 'storm_glass', name: 'Storm Glass', type: TYPES.MATERIAL,
    price: 25, sellPrice: 12,
    description: 'Thick glass panes that survived the storm unbroken. Clear as mountain air.',
  },
});

/**
 * Look up an item definition by id. Throws on unknown ids so typos fail fast.
 * @param {string} id
 * @returns {object} the item definition (do not mutate)
 */
export function isKnownItem(id) {
  return typeof id === 'string' && Object.hasOwn(ITEMS, id);
}

export function getItem(id) {
  const item = isKnownItem(id) ? ITEMS[id] : undefined;
  if (!item) throw new Error(`Unknown item id: ${id}`);
  return item;
}

/**
 * @param {string} id
 * @returns {boolean} true if `id` is a known equipment item
 */
export function canEquip(id) {
  if (!isKnownItem(id)) return false;
  const item = ITEMS[id];
  return item.type === TYPES.EQUIPMENT && !!item.slot;
}
