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
    description: 'Brine-washed linen strips. Stops bleeding and covers the ugliest wounds.',
  },
  storm_tonic: {
    id: 'storm_tonic', name: 'Storm Tonic', type: TYPES.CONSUMABLE,
    use: { mp: 20, cure: 'shocked' }, price: 22, sellPrice: 11,
    description: 'A sparking draught distilled from storm-charged salts. Restores focus.',
  },
  field_dressing: {
    id: 'field_dressing', name: 'Field Dressing', type: TYPES.CONSUMABLE,
    use: { hp: 20, cure: 'bleeding' }, price: 16, sellPrice: 8,
    description: 'Rolled gauze, a splint of driftwood, and a knot tied tight. Built for the field.',
  },
  hearty_chowder: {
    id: 'hearty_chowder', name: 'Hearty Chowder', type: TYPES.CONSUMABLE,
    use: { hp: 45 }, price: 26, sellPrice: 12,
    description: 'Smoked fish and root vegetables simmered in a storm-proof pot. A meal, not a snack.',
  },
  highland_flask: {
    id: 'highland_flask', name: 'Highland Flask', type: TYPES.CONSUMABLE,
    use: { mp: 35, cure: 'shocked' }, price: 34, sellPrice: 16,
    description: "A mountaineer's reserve of juniper and melted snowmelt. Warms the hands, sharpens the mind.",
  },
  spiced_broth: {
    id: 'spiced_broth', name: 'Spiced Broth', type: TYPES.CONSUMABLE,
    use: { hp: 60, cure: 'shocked' }, price: 42, sellPrice: 20,
    description: 'A rich inland broth served scalding at the relay outpost. Mends the body and steadies rattled nerves.',
  },
  ember_broth: {
    id: 'ember_broth', name: 'Ember Broth', type: TYPES.CONSUMABLE,
    use: { hp: 80, cure: 'bleeding' },
    price: 58, sellPrice: 28,
    description: 'A thick cinder-flat stew kept scalding at the summit post. Warms like a small storm and knits what the raiders cut.',
  },
  skyward_flask: {
    id: 'skyward_flask', name: 'Skyward Flask', type: TYPES.CONSUMABLE,
    use: { mp: 45, cure: 'shocked' },
    price: 64, sellPrice: 31,
    description: 'Distilled from Stormcrown meltwater and relay herbs. Tastes of copper coins and high thin air, and steadies every jangled nerve.',
  },
  tempest_salve: {
    id: 'tempest_salve', name: 'Tempest Salve', type: TYPES.CONSUMABLE,
    use: { hp: 75, cure: 'shocked' },
    price: 66, sellPrice: 33,
    description: 'Balm brewed from calm-of-the-eye meltwater. Knits deep wounds and settles nerves frazzled by the storm\'s static.',
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
  tidebound_cutlass: {
    id: 'tidebound_cutlass', name: 'Tidebound Cutlass', type: TYPES.EQUIPMENT, slot: 'weapon',
    stats: { atk: 11 }, price: 120, sellPrice: 58,
    description: 'A short curved blade the Saltmere salvagers keep waxed against the spray. It remembers the sea.',
  },

  relay_glaive: {
    id: 'relay_glaive', name: 'Relay Glaive', type: TYPES.EQUIPMENT, slot: 'weapon',
    stats: { atk: 14 }, price: 180, sellPrice: 88,
    description: 'A fallen signal pole reforged into a long glaive. The brass inlays hum when storms roll over the pass.',
  },
  stormforged_blade: {
    id: 'stormforged_blade', name: 'Stormforged Blade', type: TYPES.EQUIPMENT, slot: 'weapon',
    stats: { atk: 17 },
    price: 235, sellPrice: 112,
    description: 'Thunder Iron folded and quenched in summit rain. The edge hums when the sky over the spire turns dark.',
  },
  tempest_edge: {
    id: 'tempest_edge', name: 'Tempest Edge', type: TYPES.EQUIPMENT, slot: 'weapon',
    stats: { atk: 21 },
    price: 360, sellPrice: 180,
    description: 'Stormforged steel drawn long and thin at the eye post anvil, eager for the hunt inside the storm.',
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
  saltweather_jerkin: {
    id: 'saltweather_jerkin', name: 'Saltweather Jerkin', type: TYPES.EQUIPMENT, slot: 'armor',
    stats: { def: 6, hp: 5 }, price: 70, sellPrice: 33,
    description: 'Tarred canvas layered over cured hide. Salt-stiff, storm-ready, faintly smelling of the docks.',
  },
  frostward_cloak: {
    id: 'frostward_cloak', name: 'Frostward Cloak', type: TYPES.EQUIPMENT, slot: 'armor',
    stats: { def: 9, hp: 5 }, price: 165, sellPrice: 80,
    description: 'Highwatch wool lined with panels of storm glass that hold the mountain cold at bay.',
  },

  sunscar_mantle: {
    id: 'sunscar_mantle', name: 'Sunscar Mantle', type: TYPES.EQUIPMENT, slot: 'armor',
    stats: { def: 10, hp: 10 }, price: 190, sellPrice: 92,
    description: 'Layered hides baked stiff under the inland sun and stitched through with brass wire.',
  },
  stormcrown_plate: {
    id: 'stormcrown_plate', name: 'Stormcrown Plate', type: TYPES.EQUIPMENT, slot: 'armor',
    stats: { def: 12, hp: 10 },
    price: 245, sellPrice: 118,
    description: 'Dark plates hammered from Thunder Iron over a stormcloth lining. Made for the last climb, where the wind carries sparks.',
  },
  maelstrom_plate: {
    id: 'maelstrom_plate', name: 'Maelstrom Plate', type: TYPES.EQUIPMENT, slot: 'armor',
    stats: { def: 15, hp: 14 },
    price: 370, sellPrice: 185,
    description: 'Stormcrown plate rebuilt at the eye with interlocking shoulders, so the whirlwind finds no grip.',
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
  gale_charm: {
    id: 'gale_charm', name: 'Gale Charm', type: TYPES.EQUIPMENT, slot: 'trinket',
    stats: { spd: 2, mp: 3 }, price: 60, sellPrice: 28,
    description: 'A lens shard wound in fine signal wire. It tugs gently toward the open wind.',
  },
  pearl_focus: {
    id: 'pearl_focus', name: 'Tide Glass Focus', type: TYPES.EQUIPMENT, slot: 'trinket',
    stats: { mp: 8 }, price: 50, sellPrice: 24,
    description: 'A disc of sea-worn storm glass, polished smooth by the tide. Rest the eyes on it and the storm quiets.',
  },

  signal_prism: {
    id: 'signal_prism', name: 'Signal Prism', type: TYPES.EQUIPMENT, slot: 'trinket',
    stats: { atk: 1, mp: 6, spd: 1 }, price: 85, sellPrice: 40,
    description: 'A ground-glass prism that throws a signal beam on clear days. It steadies the hand that holds it.',
  },
  crownshard_focus: {
    id: 'crownshard_focus', name: 'Crownshard Focus', type: TYPES.EQUIPMENT, slot: 'trinket',
    stats: { atk: 1, mp: 10, spd: 2 },
    price: 150, sellPrice: 72,
    description: 'A sliver of crown glass set in relay copper. The trapped lightning steadies the hand and feeds the caster.',
  },
  stormeye_signet: {
    id: 'stormeye_signet', name: 'Stormeye Signet', type: TYPES.EQUIPMENT, slot: 'trinket',
    stats: { mp: 8, spd: 3 },
    price: 210, sellPrice: 105,
    description: 'A ring of calm glass cut at the eye post bench; the bearer steps lightly, as if the wind itself made way.',
  },
  heartward_charm: {
    id: 'heartward_charm', name: 'Heartward Charm', type: TYPES.EQUIPMENT, slot: 'trinket',
    stats: { def: 3, hp: 12, spd: 1 },
    price: 260, sellPrice: 130,
    description: 'A crown shard braided with wiring and calm glass into a pendant. It beats slow and steady, like the quiet center of the eye.',
  },
  squall_cleaver: {
    id: 'squall_cleaver', name: 'Squall Cleaver', type: TYPES.EQUIPMENT, slot: 'weapon',
    stats: { atk: 24 },
    price: 480, sellPrice: 240,
    description: 'Re-forged from a tempest edge and Thunder Iron under the Last Squall sky. The blade hums low, like thunder that has not yet chosen to fall.',
  },
  squall_bulwark: {
    id: 'squall_bulwark', name: 'Squall Bulwark', type: TYPES.EQUIPMENT, slot: 'armor',
    stats: { def: 17, hp: 18 },
    price: 490, sellPrice: 245,
    description: 'A maelstrom plate layered with rings of Thunder Iron. Heavy enough to stand inside a squall and remain unmoved.',
  },
  cinder_stinger: {
    id: 'cinder_stinger', name: 'Cinder Stinger', type: TYPES.EQUIPMENT, slot: 'trinket',
    stats: { atk: 3, def: 1, spd: 2 },
    price: 260, sellPrice: 130,
    description: 'The copper-dark stinger tip Cinderclaw leaves in the sand, bound in relay brass wire. It still holds a little of the dune’s heat.',
  },
  sparkrack_tine: {
    id: 'sparkrack_tine', name: 'Sparkrack Tine', type: TYPES.EQUIPMENT, slot: 'trinket',
    stats: { atk: 3, mp: 6, spd: 3 },
    price: 320, sellPrice: 160,
    description: 'A forked antler tine Thunderhoof sheds on the ridge road, wrapped in thunder iron wire. Blue sparks still jump between its points before a storm.',
  },
  squall_sigil: {
    id: 'squall_sigil', name: 'Squall Sigil', type: TYPES.EQUIPMENT, slot: 'trinket',
    stats: { atk: 2, mp: 10, spd: 4 },
    price: 350, sellPrice: 175,
    description: 'A stormeye signet recut with calm glass and set to carry a charge of its own. It steadies the hand and quickens the cast.',
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
  relay_brass: {
    id: 'relay_brass', name: 'Relay Brass', type: TYPES.MATERIAL,
    price: 30, sellPrice: 15,
    description: 'Heavy brass fittings from the inland signal relays. Still warm with residual charge.',
  },
  sunscar_glass: {
    id: 'sunscar_glass', name: 'Sunscar Glass', type: TYPES.MATERIAL,
    price: 34, sellPrice: 17,
    description: 'Amber glass fused by lightning on the Sunscar flats. Prized by lens-grinders.',
  },
  thunder_iron: {
    id: 'thunder_iron', name: 'Thunder Iron', type: TYPES.MATERIAL,
    price: 44, sellPrice: 22,
    description: 'Dark ore veined with blue light, mined from the Stormcrown slopes. Smiths say it hums before rain.',
  },
  stormcrown_shard: {
    id: 'stormcrown_shard', name: 'Stormcrown Shard', type: TYPES.MATERIAL,
    price: 120, sellPrice: 60, scarce: true,
    description: 'A splinter of the Tyrant\'s crown, still faintly warm and flickering with trapped lightning.',
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

/**
 * Pure: one-line mechanical summary of a consumable's `use` data.
 * Returns '' for items without a use effect. Format:
 * "Use: restores N HP · restores N MP · cures <Status>" (present parts only).
 * @param {{use?: {hp?: number, mp?: number, cure?: string}} | null | undefined} item
 * @returns {string}
 */
export function useEffectLine(item) {
  if (!item || typeof item !== 'object') return '';
  const use = item.use;
  if (!use || typeof use !== 'object') return '';
  const parts = [];
  if (Number.isFinite(use.hp) && use.hp > 0) parts.push(`restores ${use.hp} HP`);
  if (Number.isFinite(use.mp) && use.mp > 0) parts.push(`restores ${use.mp} MP`);
  if (typeof use.cure === 'string' && use.cure) {
    parts.push(`cures ${use.cure.charAt(0).toUpperCase()}${use.cure.slice(1)}`);
  }
  return parts.length ? `Use: ${parts.join(' · ')}` : '';
}

/** One-line hover preview for an output chip: type, stat line, use effect, sell value. */
export function previewText(item) {
  if (!item || typeof item !== 'object') return '';
  const parts = [];
  parts.push(
    { consumable: 'Consumable', equipment: 'Gear', key: 'Key item', material: 'Material' }[item.type] || 'Goods'
  );
  if (item.stats && typeof item.stats === 'object') {
    const bits = [];
    if (item.stats.atk) bits.push(`ATK+${item.stats.atk}`);
    if (item.stats.def) bits.push(`DEF+${item.stats.def}`);
    if (item.stats.hp) bits.push(`HP+${item.stats.hp}`);
    if (item.stats.mp) bits.push(`MP+${item.stats.mp}`);
    if (item.stats.spd) bits.push(`SPD+${item.stats.spd}`);
    if (bits.length) parts.push(bits.join(' · '));
  }
  const use = useEffectLine(item);
  if (use) parts.push(use);
  const sell = item.sellPrice ?? Math.floor((item.price || 0) / 2);
  if (item.type !== 'key' && sell > 0) parts.push(`Sell ${sell}g each`);
  return parts.join(' · ');
}
