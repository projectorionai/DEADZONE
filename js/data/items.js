/* Item definitions. Each item is a template; inventory holds instances (id + qty). */
const RARITY = {
  common:    { name: 'Common',    color: '#9aa4ad', mult: 1.0 },
  uncommon:  { name: 'Uncommon',  color: '#4fae5a', mult: 1.6 },
  rare:      { name: 'Rare',      color: '#4f8fdd', mult: 2.8 },
  epic:      { name: 'Epic',      color: '#a765e0', mult: 5.0 },
  legendary: { name: 'Legendary', color: '#ff9000', mult: 8.0 },
  // Beyond-legendary tiers: exotics come from deep-city caches and world
  // bosses; mythics are once-a-run finds; uniques are named story rewards
  // that grant passive buffs while held.
  exotic:    { name: 'Exotic',    color: '#35e0d6', mult: 13.0 },
  mythic:    { name: 'Mythic',    color: '#ff4560', mult: 22.0 },
  unique:    { name: 'Unique',    color: '#ffd700', mult: 30.0 },
};

/* type: consumable | material | ammo | weapon
 * weight in kg per unit, stack = max stack size, value = base sell value
 */
const ITEMS = {
  // --- Consumables (simple, fast, DF-style: heal & stamina, no busywork) ---
  food_can:   { id: 'food_can',   name: 'Canned Food',   type: 'consumable', rarity: 'common',   weight: 0.4, stack: 20, value: 6,  use: { health: 20 },  color: '#c98b3a', glyph: '🥫' },
  water_bottle:{id: 'water_bottle',name: 'Water Bottle',  type: 'consumable', rarity: 'common',   weight: 0.5, stack: 20, value: 5,  use: { stamina: 45 }, color: '#3a86c9', glyph: '💧' },
  mre:        { id: 'mre',        name: 'MRE Ration',    type: 'consumable', rarity: 'uncommon', weight: 0.6, stack: 10, value: 18, use: { health: 40, stamina: 30 }, color: '#8a8a4a', glyph: '🍱' },
  energy_drink:{id: 'energy_drink',name: 'Energy Drink', type: 'consumable', rarity: 'uncommon', weight: 0.3, stack: 15, value: 12, use: { stamina: 70 }, color: '#4ac96a', glyph: '🥤' },
  medkit:     { id: 'medkit',     name: 'Medkit',        type: 'consumable', rarity: 'uncommon', weight: 0.8, stack: 10, value: 22, use: { health: 45, treatWounds: true }, color: '#d94f4f', glyph: '✚' },
  bandage:    { id: 'bandage',    name: 'Bandage',       type: 'consumable', rarity: 'common',   weight: 0.2, stack: 20, value: 8,  use: { health: 18, treatWounds: true }, color: '#d8c9b0', glyph: '🩹' },

  // --- Materials ---
  scrap:      { id: 'scrap',      name: 'Scrap Metal',   type: 'material',   rarity: 'common',   weight: 0.6, stack: 50, value: 4,  color: '#8a8f95', glyph: '⚙' },
  electronics:{ id: 'electronics',name: 'Electronics',   type: 'material',   rarity: 'uncommon', weight: 0.5, stack: 40, value: 14, color: '#5ac9b0', glyph: '🔌' },
  cloth:      { id: 'cloth',      name: 'Cloth',         type: 'material',   rarity: 'common',   weight: 0.3, stack: 50, value: 3,  color: '#b0a58f', glyph: '🧵' },

   // --- Ammo ---
   ammo_9mm:   { id: 'ammo_9mm',   name: '9mm Rounds',    type: 'ammo',       rarity: 'common',   weight: 0.02,stack: 200,value: 1,  ammoType: '9mm', color: '#d4b24f', glyph: '•' },
   ammo_308:   { id: 'ammo_308',   name: '.308 Rounds',   type: 'ammo',       rarity: 'common',   weight: 0.05,stack: 120,value: 2,  ammoType: '308', color: '#c9a13a', glyph: '▪' },

   // --- Weapons (non-stacking) ---
   pistol_9mm: { id: 'pistol_9mm', name: 'M9 Pistol',     type: 'weapon',     rarity: 'uncommon', weight: 1.1, stack: 1,  value: 120, weaponId: 'pistol', color: '#6b7075', glyph: '🔫' },
   bat:        { id: 'bat',        name: 'Baseball Bat',  type: 'weapon',     rarity: 'common',   weight: 1.4, stack: 1,  value: 40,  weaponId: 'melee', color: '#9c7b4a', glyph: '🏏' },
   huntingrifle_308: { id: 'huntingrifle_308', name: 'Hunting Rifle', type: 'weapon', rarity: 'uncommon', weight: 3.2, stack: 1, value: 280, weaponId: 'huntingrifle', color: '#8a6a4a', glyph: '🎯' },
   combatknife: { id: 'combatknife', name: 'Combat Knife', type: 'weapon',     rarity: 'common',   weight: 0.6, stack: 1,  value: 60,  weaponId: 'combatknife', color: '#a0a0a0', glyph: '🔪' },
   smg_mp40:   { id: 'smg_mp40',   name: 'MP-40 SMG',     type: 'weapon',     rarity: 'rare',     weight: 2.6, stack: 1,  value: 420, weaponId: 'smg', color: '#5a5f66', glyph: '🔫' },
   minigun_item: { id: 'minigun_item', name: 'Minigun',   type: 'weapon',     rarity: 'epic',     weight: 12,  stack: 1,  value: 1500,weaponId: 'minigun', color: '#7a7a2a', glyph: '⚙' },
   revolver_45:  { id: 'revolver_45',  name: '.45 Revolver',    type: 'weapon', rarity: 'uncommon', weight: 1.3, stack: 1, value: 180, weaponId: 'revolver',    color: '#8a8a92', glyph: '🔫' },
   sawnoff_12g:  { id: 'sawnoff_12g',  name: 'Sawn-Off Shotgun',type: 'weapon', rarity: 'rare',     weight: 2.8, stack: 1, value: 340, weaponId: 'sawnoff',     color: '#7a5a3a', glyph: '🔫' },
   pump_12g:     { id: 'pump_12g',     name: 'Pump Shotgun',    type: 'weapon', rarity: 'rare',     weight: 3.4, stack: 1, value: 480, weaponId: 'pumpshotgun', color: '#6a5a4a', glyph: '🔫' },
   ar15_556:     { id: 'ar15_556',     name: 'AR-15 Rifle',     type: 'weapon', rarity: 'rare',     weight: 3.3, stack: 1, value: 620, weaponId: 'ar15',        color: '#4a4f56', glyph: '🔫' },
   machete_i:    { id: 'machete_i',    name: 'Machete',         type: 'weapon', rarity: 'common',   weight: 0.9, stack: 1, value: 70,  weaponId: 'machete',     color: '#9aa0a6', glyph: '🔪' },
   crowbar_i:    { id: 'crowbar_i',    name: 'Crowbar',         type: 'weapon', rarity: 'common',   weight: 1.6, stack: 1, value: 55,  weaponId: 'crowbar',     color: '#c04040', glyph: '🪓' },
   sledge_i:     { id: 'sledge_i',     name: 'Sledgehammer',    type: 'weapon', rarity: 'uncommon', weight: 4.5, stack: 1, value: 130, weaponId: 'sledgehammer',color: '#7a7a7a', glyph: '🔨' },
   wrench_i:     { id: 'wrench_i',     name: 'Pipe Wrench',     type: 'weapon', rarity: 'common',   weight: 1.2, stack: 1, value: 45,  weaponId: 'wrench',      color: '#8a4a2a', glyph: '🔧' },
   fireaxe_i:    { id: 'fireaxe_i',    name: 'Fire Axe',        type: 'weapon', rarity: 'uncommon', weight: 2.4, stack: 1, value: 150, weaponId: 'fireaxe',     color: '#b05a3a', glyph: '🪓' },

   // --- Armor / apparel (bridges to ARMOR_TYPES in armor.js via armorId) ---
   leather_vest:  { id: 'leather_vest',  name: 'Leather Vest',       type: 'armor', rarity: 'common',    weight: 2.2, stack: 1, value: 45,   armorId: 'leather_vest',       color: '#8a6a4a', glyph: '🦺' },
   tactical_rig:  { id: 'tactical_rig',  name: 'Tactical Rig',       type: 'armor', rarity: 'uncommon',  weight: 3.5, stack: 1, value: 120,  armorId: 'tactical_rig',       color: '#5a6a4a', glyph: '🦺' },
   kevlar_vest:   { id: 'kevlar_vest',   name: 'Kevlar Vest',        type: 'armor', rarity: 'rare',      weight: 5.1, stack: 1, value: 280,  armorId: 'kevlar_vest',        color: '#4a5a6a', glyph: '🛡' },
   combat_exoskeleton: { id: 'combat_exoskeleton', name: 'Combat Exoskeleton', type: 'armor', rarity: 'epic',      weight: 7.8, stack: 1, value: 650,  armorId: 'combat_exoskeleton', color: '#7a5aa0', glyph: '🛡' },
   void_cloak:    { id: 'void_cloak',    name: 'Void Cloak',         type: 'armor', rarity: 'legendary', weight: 4.2, stack: 1, value: 1200, armorId: 'void_cloak',         color: '#ff9000', glyph: '🧥' },
   ballistic_helmet: { id: 'ballistic_helmet', name: 'Ballistic Helmet', type: 'armor', rarity: 'uncommon', weight: 1.8, stack: 1, value: 80, armorId: 'ballistic_helmet',  color: '#5a6a5a', glyph: '🪖' },
   reinforced_boots: { id: 'reinforced_boots', name: 'Reinforced Boots', type: 'armor', rarity: 'common',  weight: 1.6, stack: 1, value: 35, armorId: 'reinforced_boots',   color: '#6a5a4a', glyph: '🥾' },

   // --- New ammo types ---
   ammo_45:     { id: 'ammo_45',     name: '.45 Rounds',    type: 'ammo', rarity: 'common', weight: 0.03, stack: 120, value: 2, ammoType: '45',   color: '#c9b06a', glyph: '•' },
   ammo_40mm:   { id: 'ammo_40mm',   name: '40mm Grenades', type: 'ammo', rarity: 'rare',   weight: 0.25, stack: 24,  value: 14, ammoType: '40mm', color: '#7a8a4a', glyph: '◉' },
   ammo_rocket: { id: 'ammo_rocket', name: 'Rockets',       type: 'ammo', rarity: 'epic',   weight: 1.2,  stack: 8,   value: 45, ammoType: 'rocket', color: '#a05a3a', glyph: '🚀' },
   ammo_fuel:   { id: 'ammo_fuel',   name: 'Fuel Canister', type: 'ammo', rarity: 'rare',   weight: 0.9,  stack: 10,  value: 20, ammoType: 'fuel', color: '#c97a2a', glyph: '🛢' },
   ammo_shells: { id: 'ammo_shells', name: '12g Shells',    type: 'ammo', rarity: 'common', weight: 0.06, stack: 60,  value: 3, ammoType: '12g',  color: '#b06a3a', glyph: '▮' },
   ammo_556:    { id: 'ammo_556',    name: '5.56 Rounds',   type: 'ammo', rarity: 'common', weight: 0.03, stack: 180, value: 2, ammoType: '5.56', color: '#a0b06a', glyph: '•' },

   // --- System 2: Antiviral consumable ---
   antiviral_spores: { id: 'antiviral_spores', name: 'Antiviral Spores', type: 'consumable', rarity: 'rare', weight: 0.3, stack: 8, value: 90, use: { health: 10, cleanseInfection: 45 }, color: '#5adf7a', glyph: '🧬' },

   // --- System 5: Gate repair materials ---
   wall_brace:   { id: 'wall_brace',   name: 'Wall Brace Kit',  type: 'material', rarity: 'uncommon', weight: 3.0, stack: 10, value: 35, gateRepair: 25, color: '#8a8a7a', glyph: '🪵' },

   // --- Quest / recovery items (mission objectives; sellable curios) ---
   medical_supplies: { id: 'medical_supplies', name: 'Medical Supplies', type: 'quest', rarity: 'uncommon', weight: 1.0, stack: 10, value: 25, color: '#d97a7a', glyph: '📦' },
   military_docs:    { id: 'military_docs',    name: 'Military Documents', type: 'quest', rarity: 'rare',   weight: 0.2, stack: 5,  value: 60, color: '#7a8a5a', glyph: '📁' },
   survivor_journal: { id: 'survivor_journal', name: "Survivor's Journal", type: 'quest', rarity: 'rare',   weight: 0.3, stack: 3,  value: 40, color: '#c9b18a', glyph: '📓' },
   radio_parts:      { id: 'radio_parts',      name: 'Radio Components', type: 'quest', rarity: 'uncommon', weight: 0.8, stack: 8,  value: 30, color: '#7a9ac9', glyph: '📻' },
   lost_dogtags:     { id: 'lost_dogtags',     name: 'Lost Dog Tags',   type: 'quest', rarity: 'uncommon',  weight: 0.1, stack: 10, value: 20, color: '#9aa4ad', glyph: '🏷' },

   // --- Collectibles (mission chain keepsakes) ---
   ravenside_medal:  { id: 'ravenside_medal', name: 'Ravenside Service Medal', type: 'collectible', rarity: 'legendary', weight: 0.1, stack: 1, value: 500, color: '#ffd700', glyph: '🎖' },
};

function getItem(id) { return ITEMS[id]; }
function itemValue(id) {
  const it = ITEMS[id]; if (!it) return 0;
  return Math.round(it.value * (RARITY[it.rarity] ? RARITY[it.rarity].mult : 1) / RARITY[it.rarity].mult); // base value already tuned
}
