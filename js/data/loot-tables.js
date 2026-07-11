/* Loot tables — SCARCITY pass.
 * Survival should feel desperate: most containers hold scraps, many hold nothing.
 * `id: null` entries are empty hands. 'weapon_drop' / 'armor_drop' tokens resolve
 * to a random catalogue piece at the given rarity (bumped by district tier).
 */

const LOOT_TABLES = {
  car: {
    rolls: [0, 2],
    table: [
      { id: null,           w: 34 },
      { id: 'scrap',        w: 26, min: 1, max: 2 },
      { id: 'cloth',        w: 12, min: 1, max: 2 },
      { id: 'ammo_9mm',     w: 12, min: 2, max: 6 },
      { id: 'water_bottle', w: 8,  min: 1, max: 1 },
      { id: 'food_can',     w: 7,  min: 1, max: 1 },
      { id: 'electronics',  w: 5,  min: 1, max: 1 },
      { id: 'bandage',      w: 4,  min: 1, max: 1 },
      { id: 'weapon_drop',  w: 2,  rarity: 'common' },
    ],
  },

  crate: {
    rolls: [1, 2],
    table: [
      { id: null,           w: 30 },
      { id: 'scrap',        w: 22, min: 1, max: 3 },
      { id: 'ammo_9mm',     w: 12, min: 3, max: 8 },
      { id: 'ammo_shells',  w: 5,  min: 2, max: 4 },
      { id: 'ammo_556',     w: 4,  min: 2, max: 6 },
      { id: 'food_can',     w: 8,  min: 1, max: 1 },
      { id: 'water_bottle', w: 8,  min: 1, max: 1 },
      { id: 'bandage',      w: 6,  min: 1, max: 1 },
      { id: 'electronics',  w: 4,  min: 1, max: 1 },
      { id: 'weapon_drop',  w: 3,  rarity: 'common' },
    ],
  },

  cabinet: {
    rolls: [0, 2],
    table: [
      { id: null,           w: 34 },
      { id: 'cloth',        w: 16, min: 1, max: 2 },
      { id: 'food_can',     w: 12, min: 1, max: 1 },
      { id: 'water_bottle', w: 12, min: 1, max: 1 },
      { id: 'bandage',      w: 10, min: 1, max: 2 },
      { id: 'ammo_9mm',     w: 6,  min: 2, max: 4 },
      { id: 'medkit',       w: 3,  min: 1, max: 1 },
      { id: 'armor_drop',   w: 3,  rarity: 'common' },
      { id: 'medical_supplies', w: 3, min: 1, max: 1 },
      { id: 'survivor_journal', w: 2, min: 1, max: 1 },
    ],
  },

  locker: {
    rolls: [1, 2],
    table: [
      { id: null,           w: 28 },
      { id: 'ammo_9mm',     w: 12, min: 3, max: 8 },
      { id: 'ammo_45',      w: 6,  min: 2, max: 5 },
      { id: 'ammo_556',     w: 5,  min: 3, max: 7 },
      { id: 'cloth',        w: 10, min: 1, max: 2 },
      { id: 'bandage',      w: 8,  min: 1, max: 1 },
      { id: 'scrap',        w: 12, min: 1, max: 3 },
      { id: 'electronics',  w: 5,  min: 1, max: 1 },
      { id: 'medkit',       w: 3,  min: 1, max: 1 },
      { id: 'weapon_drop',  w: 4,  rarity: 'uncommon' },
      { id: 'armor_drop',   w: 5,  rarity: 'uncommon' },
      { id: 'military_docs', w: 2, min: 1, max: 1 },
      { id: 'radio_parts',  w: 3,  min: 1, max: 1 },
    ],
  },

  fridge: {
    rolls: [0, 2],
    table: [
      { id: null,           w: 34 },
      { id: 'food_can',     w: 24, min: 1, max: 2 },
      { id: 'water_bottle', w: 24, min: 1, max: 2 },
      { id: 'energy_drink', w: 6,  min: 1, max: 1 },
      { id: 'mre',          w: 4,  min: 1, max: 1 },
      { id: 'cloth',        w: 8,  min: 1, max: 1 },
    ],
  },

  medbox: {
    rolls: [1, 2],
    table: [
      { id: null,           w: 24 },
      { id: 'bandage',      w: 30, min: 1, max: 2 },
      { id: 'medkit',       w: 12, min: 1, max: 1 },
      { id: 'antiviral_spores', w: 5, min: 1, max: 1 },
      { id: 'medical_supplies', w: 8, min: 1, max: 1 },
      { id: 'water_bottle', w: 8,  min: 1, max: 1 },
      { id: 'cloth',        w: 10, min: 1, max: 2 },
      { id: 'electronics',  w: 4,  min: 1, max: 1 },
    ],
  },

  ammobox: {
    rolls: [1, 2],
    table: [
      { id: null,           w: 22 },
      { id: 'ammo_9mm',     w: 22, min: 6, max: 14 },
      { id: 'ammo_shells',  w: 10, min: 3, max: 7 },
      { id: 'ammo_556',     w: 10, min: 5, max: 12 },
      { id: 'ammo_45',      w: 8,  min: 3, max: 8 },
      { id: 'ammo_308',     w: 6,  min: 3, max: 6 },
      { id: 'weapon_drop',  w: 5,  rarity: 'uncommon' },
      { id: 'scrap',        w: 10, min: 1, max: 2 },
    ],
  },

  register: {
    rolls: [0, 2],
    table: [
      { id: null,           w: 38 },
      { id: 'scrap',        w: 20, min: 1, max: 2 },
      { id: 'electronics',  w: 10, min: 1, max: 1 },
      { id: 'cloth',        w: 12, min: 1, max: 2 },
      { id: 'food_can',     w: 8,  min: 1, max: 1 },
      { id: 'ammo_9mm',     w: 8,  min: 2, max: 5 },
      { id: 'bandage',      w: 4,  min: 1, max: 1 },
    ],
  },

  // Normal zombies — the occasional pocket find.
  zombie: {
    rolls: [0, 1],
    table: [
      { id: null,           w: 50 },
      { id: 'scrap',        w: 14, min: 1, max: 1 },
      { id: 'cloth',        w: 12, min: 1, max: 1 },
      { id: 'ammo_9mm',     w: 9,  min: 1, max: 3 },
      { id: 'bandage',      w: 5,  min: 1, max: 1 },
      { id: 'food_can',     w: 5,  min: 1, max: 1 },
      { id: 'lost_dogtags', w: 5,  min: 1, max: 1 },
    ],
  },

  // HIDDEN CACHE — someone's endgame stash. Always worth the detour.
  cache: {
    rolls: [3, 4],
    table: [
      { id: 'weapon_drop',  w: 20, rarity: 'rare' },
      { id: 'weapon_drop',  w: 8,  rarity: 'epic' },
      { id: 'armor_drop',   w: 18, rarity: 'rare' },
      { id: 'armor_drop',   w: 7,  rarity: 'epic' },
      { id: 'medkit',       w: 12, min: 2, max: 3 },
      { id: 'ammo_556',     w: 10, min: 12, max: 28 },
      { id: 'ammo_shells',  w: 8,  min: 6, max: 12 },
      { id: 'antiviral_spores', w: 8, min: 1, max: 2 },
      { id: 'electronics',  w: 9,  min: 2, max: 5 },
    ],
  },

  // Harvested from a Rabid (special) corpse — reliably useful.
  elite: {
    rolls: [1, 2],
    table: [
      { id: 'ammo_9mm',     w: 16, min: 4, max: 10 },
      { id: 'ammo_556',     w: 10, min: 4, max: 8 },
      { id: 'bandage',      w: 14, min: 1, max: 2 },
      { id: 'medkit',       w: 8,  min: 1, max: 1 },
      { id: 'scrap',        w: 14, min: 2, max: 4 },
      { id: 'electronics',  w: 8,  min: 1, max: 2 },
      { id: 'antiviral_spores', w: 5, min: 1, max: 1 },
      { id: 'weapon_drop',  w: 6,  rarity: 'uncommon' },
      { id: 'armor_drop',   w: 6,  rarity: 'uncommon' },
    ],
  },

  // Harvested from an Irradiated corpse — the jackpot worth the burns.
  irradiated: {
    rolls: [2, 3],
    table: [
      { id: 'ammo_556',     w: 12, min: 6, max: 14 },
      { id: 'ammo_308',     w: 8,  min: 4, max: 8 },
      { id: 'medkit',       w: 12, min: 1, max: 2 },
      { id: 'antiviral_spores', w: 10, min: 1, max: 2 },
      { id: 'electronics',  w: 10, min: 1, max: 3 },
      { id: 'weapon_drop',  w: 10, rarity: 'rare' },
      { id: 'armor_drop',   w: 10, rarity: 'rare' },
      { id: 'mre',          w: 6,  min: 1, max: 1 },
    ],
  },

  // Guaranteed boss drop — rolled on every boss kill (harvest the corpse).
  boss: {
    rolls: [2, 4],
    table: [
      { id: 'weapon_drop',  w: 16, rarity: 'rare' },
      { id: 'weapon_drop',  w: 6,  rarity: 'epic' },
      { id: 'armor_drop',   w: 14, rarity: 'rare' },
      { id: 'armor_drop',   w: 5,  rarity: 'epic' },
      { id: 'medkit',       w: 16, min: 1, max: 2 },
      { id: 'ammo_556',     w: 10, min: 10, max: 24 },
      { id: 'ammo_shells',  w: 8,  min: 5, max: 10 },
      { id: 'antiviral_spores', w: 8, min: 1, max: 2 },
      { id: 'electronics',  w: 8,  min: 2, max: 4 },
    ],
  },

  // Night spawn drops (slightly better loot)
  night: {
    rolls: [0, 1],
    table: [
      { id: null,           w: 40 },
      { id: 'scrap',        w: 16, min: 1, max: 2 },
      { id: 'ammo_9mm',     w: 12, min: 2, max: 6 },
      { id: 'electronics',  w: 8,  min: 1, max: 1 },
      { id: 'cloth',        w: 10, min: 1, max: 2 },
      { id: 'bandage',      w: 8,  min: 1, max: 1 },
      { id: 'medkit',       w: 4,  min: 1, max: 1 },
    ],
  },
};

// Desk containers reuse cabinets
LOOT_TABLES.desk = LOOT_TABLES.cabinet;

/* Legacy helper — random armor piece for boss drops. */
function getRandomArmorDrop() {
  const rarity = Utils.weighted([
    { w: 50, v: 'uncommon' },
    { w: 30, v: 'rare' },
    { w: 15, v: 'epic' },
    { w: 5,  v: 'legendary' },
  ]).v;
  const id = (typeof rollArmorItemId === 'function') ? rollArmorItemId(rarity) : null;
  return id ? { id } : null;
}
