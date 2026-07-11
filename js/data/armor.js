/* ARMOUR SYSTEM — a primary progression pillar alongside weapons and talents.
 * Eight equipment slots: head / face / chest / arms / legs / feet / back / accessory.
 * Pieces carry an armour rating (damage reduction), weight, passive bonuses and
 * optionally a SET tag — wearing multiple pieces of a set unlocks set bonuses.
 * Durability remains (DF1-style: armour soaks hits and wears; repair at outposts).
 */

const ARMOR_SLOTS = ['head', 'face', 'chest', 'arms', 'legs', 'feet', 'back', 'accessory'];

// How much of a piece's damageReduction actually applies (chest protects most).
const SLOT_DR_WEIGHT = {
  chest: 1.0, head: 0.5, legs: 0.3, arms: 0.25, feet: 0.15, face: 0.15, back: 0, accessory: 0,
};

const ARMOR_SLOT_LABELS = {
  head: 'Head', face: 'Face', chest: 'Chest', arms: 'Arms',
  legs: 'Legs', feet: 'Feet', back: 'Back', accessory: 'Accessory',
};

/* ---- Set bonuses: 2 / 4 / 6 equipped pieces of the same set ---- */
const ARMOR_SETS = {
  military: { name: 'Military Set', color: '#7a8a5a',
    bonuses: { 2: { damageReduc: 0.05 }, 4: { damageReduc: 0.10 }, 6: { damageReduc: 0.15 } },
    desc: 'Army surplus, still holding the line. +Defence per piece pair.' },
  survivor: { name: 'Survivor Set', color: '#c9a13a',
    bonuses: { 2: { lootBonus: 0.08 }, 4: { lootBonus: 0.16 }, 6: { lootBonus: 0.28 } },
    desc: 'Stitched from the streets. Sharpens your scavenging eye.' },
  recon: { name: 'Recon Set', color: '#5a9ac9',
    bonuses: { 2: { speedBonus: 0.04 }, 4: { speedBonus: 0.08 }, 6: { speedBonus: 0.14 } },
    desc: 'Light, quiet, fast. Built to outrun the dead.' },
  medic: { name: 'Medic Set', color: '#5fae7a',
    bonuses: { 2: { healMult: 1.15 }, 4: { healMult: 1.3 }, 6: { healMult: 1.5 } },
    desc: 'Field-hospital whites. Every bandage goes further.' },
  riot: { name: 'Riot Set', color: '#6a7a9a',
    bonuses: { 2: { damageReduc: 0.04 }, 4: { fractureResist: 0.5 }, 6: { damageReduc: 0.12 } },
    desc: 'Crowd-control plating. The horde is just a bigger crowd.' },
  hazmat: { name: 'Hazmat Set', color: '#a0a05a',
    bonuses: { 2: { radResist: 0.3 }, 4: { blurResist: 0.4 }, 6: { radResist: 0.6 } },
    desc: 'Sealed against everything the new world breathes.' },
};

const RARITY_ARMOR_BONUS = {
  common: 1.0, uncommon: 1.15, rare: 1.3, epic: 1.5, legendary: 1.8,
};

const ARMOR_TYPES = {};

/* ---- Families per slot ----
 * dr = damage reduction, dura = durability, wt = kg, rank 1-6 drives rarity/value,
 * set = optional set tag, bonus = passive effects.
 */
const ARMOR_FAMILIES = {
  head: [
    { name: 'Beanie',             dr: 0.01, dura: 30,  wt: 0.2, rank: 1, desc: 'Warm. That is all.' },
    { name: 'Baseball Cap',       dr: 0.02, dura: 35,  wt: 0.2, rank: 1, set: 'survivor', desc: 'Keeps the rain out of your eyes.' },
    { name: 'Hockey Mask Helm',   dr: 0.05, dura: 50,  wt: 0.6, rank: 2, desc: 'Face protection with a menacing look.' },
    { name: 'Hard Hat',           dr: 0.06, dura: 60,  wt: 0.7, rank: 2, set: 'survivor', desc: 'Construction-site classic.' },
    { name: 'Recon Hood',         dr: 0.05, dura: 60,  wt: 0.4, rank: 3, set: 'recon', bonus: { stealth: 0.05 }, desc: 'Low profile, no glare.' },
    { name: 'Motorcycle Helmet',  dr: 0.09, dura: 80,  wt: 1.4, rank: 3, desc: 'Full-face shell. Muffles the screams a little.' },
    { name: 'Medic Cap',          dr: 0.04, dura: 55,  wt: 0.3, rank: 3, set: 'medic', desc: 'The red cross means nothing to them.' },
    { name: 'Riot Helmet',        dr: 0.12, dura: 110, wt: 1.7, rank: 4, set: 'riot', bonus: { detectBonus: 0.03 }, desc: 'Visored polycarbonate.' },
    { name: 'Combat Helmet',      dr: 0.14, dura: 130, wt: 1.9, rank: 4, set: 'military', desc: 'Military kevlar shell.' },
    { name: 'Hazmat Hood',        dr: 0.10, dura: 110, wt: 1.0, rank: 5, set: 'hazmat', bonus: { blurResist: 0.4, radResist: 0.3 }, desc: 'Sealed against bile and glow.' },
    { name: 'Tactical Visor Helm',dr: 0.16, dura: 150, wt: 2.0, rank: 5, set: 'military', bonus: { detectBonus: 0.08 }, desc: 'HUD-assisted optics.' },
    { name: 'Juggernaut Helm',    dr: 0.20, dura: 190, wt: 2.8, rank: 6, desc: 'A rolling pillbox for your skull.' },
  ],
  face: [
    { name: 'Bandana',            dr: 0.01, dura: 25,  wt: 0.1, rank: 1, set: 'survivor', desc: 'Keeps the ash out of your lungs.' },
    { name: 'Dust Goggles',       dr: 0.02, dura: 35,  wt: 0.2, rank: 2, set: 'recon', bonus: { blurResist: 0.15 }, desc: 'Cheap but they seal.' },
    { name: 'Surgical Mask',      dr: 0.01, dura: 25,  wt: 0.1, rank: 2, set: 'medic', desc: 'Habit more than protection.' },
    { name: 'Ballistic Goggles',  dr: 0.04, dura: 60,  wt: 0.3, rank: 3, set: 'military', bonus: { blurResist: 0.2 }, desc: 'Rated against fragments and spray.' },
    { name: 'Respirator',         dr: 0.03, dura: 55,  wt: 0.5, rank: 4, set: 'hazmat', bonus: { blurResist: 0.35 }, desc: 'Filters the worst of the bile mist.' },
    { name: 'Full Gas Mask',      dr: 0.06, dura: 90,  wt: 0.9, rank: 5, set: 'hazmat', bonus: { blurResist: 0.6, radResist: 0.2 }, desc: 'The classic apocalypse face.' },
  ],
  chest: [
    { name: 'Hoodie',             dr: 0.04, dura: 45,  wt: 0.8, rank: 1, set: 'survivor', bonus: { stealth: 0.05 }, desc: 'Unremarkable in the gloom.' },
    { name: 'Denim Jacket',       dr: 0.06, dura: 55,  wt: 1.1, rank: 1, desc: 'Thick denim turns weak claws.' },
    { name: 'Leather Jacket',     dr: 0.10, dura: 70,  wt: 1.8, rank: 2, desc: 'Biker leather. Style and bite resistance.' },
    { name: 'Medic Scrubs',       dr: 0.05, dura: 55,  wt: 0.7, rank: 2, set: 'medic', desc: 'Stained but sterile where it counts.' },
    { name: 'Recon Vest',         dr: 0.12, dura: 85,  wt: 1.6, rank: 3, set: 'recon', bonus: { speedBonus: 0.02 }, desc: 'Featherweight plating.' },
    { name: 'Stab Vest',          dr: 0.18, dura: 100, wt: 2.8, rank: 3, desc: 'Anti-blade weave. Made for exactly this.' },
    { name: 'Police Vest',        dr: 0.27, dura: 140, wt: 4.0, rank: 4, set: 'riot', desc: 'Standard-issue PD ballistic vest.' },
    { name: 'Flak Jacket',        dr: 0.30, dura: 160, wt: 4.6, rank: 4, set: 'military', desc: 'Military surplus. Shrugs off teeth.' },
    { name: 'Riot Suit',          dr: 0.36, dura: 200, wt: 6.0, rank: 5, set: 'riot', desc: 'Full riot plating. The horde bounces off.' },
    { name: 'Military Plate',     dr: 0.42, dura: 240, wt: 7.2, rank: 5, set: 'military', desc: 'Ceramic plate carrier, front-line grade.' },
    { name: 'Hazmat Suit',        dr: 0.22, dura: 150, wt: 3.4, rank: 5, set: 'hazmat', bonus: { radResist: 0.35 }, desc: 'Sealed rubber shell.' },
    { name: 'Juggernaut Suit',    dr: 0.48, dura: 300, wt: 9.5, rank: 6, desc: 'EOD-grade shell. You are the wall.' },
  ],
  arms: [
    { name: 'Wrapped Sleeves',    dr: 0.02, dura: 35,  wt: 0.3, rank: 1, set: 'survivor', desc: 'Cloth wraps against grazes.' },
    { name: 'Leather Bracers',    dr: 0.04, dura: 55,  wt: 0.7, rank: 2, desc: 'Bite-guards for the forearms.' },
    { name: 'Padded Sleeves',     dr: 0.06, dura: 70,  wt: 0.9, rank: 3, set: 'medic', desc: 'Won\'t stop a Brute. Stops a Walker.' },
    { name: 'Riot Arm Guards',    dr: 0.09, dura: 100, wt: 1.4, rank: 4, set: 'riot', desc: 'Polycarbonate vambraces.' },
    { name: 'Military Arm Plates',dr: 0.11, dura: 120, wt: 1.7, rank: 5, set: 'military', desc: 'Plate segments over kevlar sleeve.' },
    { name: 'Exo Arm-Frame',      dr: 0.13, dura: 150, wt: 1.9, rank: 6, bonus: { carryBonus: 3 }, desc: 'Servo-assisted lifting.' },
  ],
  legs: [
    { name: 'Jeans',              dr: 0.02, dura: 40,  wt: 0.7, rank: 1, desc: 'Everyday denim.' },
    { name: 'Cargo Pants',        dr: 0.04, dura: 55,  wt: 0.9, rank: 2, set: 'survivor', bonus: { carryBonus: 2 }, desc: 'Pockets. So many pockets.' },
    { name: 'Medic Trousers',     dr: 0.04, dura: 55,  wt: 0.8, rank: 2, set: 'medic', desc: 'Quick-access med pouches.' },
    { name: 'Recon Leggings',     dr: 0.06, dura: 75,  wt: 1.0, rank: 3, set: 'recon', bonus: { speedBonus: 0.02 }, desc: 'Cut for sprinting.' },
    { name: 'Reinforced Jeans',   dr: 0.09, dura: 100, wt: 1.5, rank: 4, desc: 'Kevlar-stitched denim.' },
    { name: 'Riot Greaves',       dr: 0.12, dura: 130, wt: 2.6, rank: 5, set: 'riot', desc: 'Shin plating stops crawler teeth cold.' },
    { name: 'Military Trousers',  dr: 0.13, dura: 140, wt: 2.2, rank: 5, set: 'military', desc: 'Plated combat trousers.' },
    { name: 'Hazmat Leggings',    dr: 0.11, dura: 130, wt: 1.8, rank: 6, set: 'hazmat', bonus: { radResist: 0.3 }, desc: 'Sealed lower-body suit.' },
  ],
  feet: [
    { name: 'Sneakers',           dr: 0.01, dura: 35,  wt: 0.6, rank: 1, set: 'recon', bonus: { speedBonus: 0.04 }, desc: 'Quiet and quick.' },
    { name: 'Work Boots',         dr: 0.04, dura: 55,  wt: 1.2, rank: 2, set: 'survivor', desc: 'Steel shanks and thick soles.' },
    { name: 'Hiking Boots',       dr: 0.05, dura: 65,  wt: 1.1, rank: 3, bonus: { speedBonus: 0.02 }, desc: 'Sure-footed over rubble.' },
    { name: 'Steel-Toe Boots',    dr: 0.07, dura: 80,  wt: 1.7, rank: 3, desc: 'Kick back with authority.' },
    { name: 'Combat Boots',       dr: 0.08, dura: 95,  wt: 1.6, rank: 4, set: 'military', bonus: { speedBonus: 0.02 }, desc: 'Military issue, broken in.' },
    { name: 'Riot Boots',         dr: 0.10, dura: 115, wt: 2.0, rank: 5, set: 'riot', desc: 'Plated toe to shin.' },
    { name: 'Hazmat Overboots',   dr: 0.07, dura: 90,  wt: 1.4, rank: 5, set: 'hazmat', bonus: { radResist: 0.2 }, desc: 'Wade through anything.' },
    { name: 'Exo Boots',          dr: 0.11, dura: 140, wt: 2.1, rank: 6, bonus: { speedBonus: 0.05 }, desc: 'Servo-sprung stride.' },
  ],
  back: [
    { name: 'School Bag',         dr: 0, dura: 40,  wt: 0.5, rank: 1, bonus: { carryBonus: 4 },  desc: 'Somebody\'s old bag. +4kg carry.' },
    { name: 'Courier Pack',       dr: 0, dura: 55,  wt: 0.7, rank: 2, set: 'recon', bonus: { carryBonus: 6 },  desc: 'Light and fast. +6kg carry.' },
    { name: 'Medic Satchel',      dr: 0, dura: 60,  wt: 0.8, rank: 3, set: 'medic', bonus: { carryBonus: 6, healMult: 1.05 }, desc: 'Organised triage. +6kg carry.' },
    { name: 'Hiking Pack',        dr: 0, dura: 70,  wt: 1.3, rank: 3, set: 'survivor', bonus: { carryBonus: 9 },  desc: 'Frame pack. +9kg carry.' },
    { name: 'Military Rucksack',  dr: 0.02, dura: 90,  wt: 1.8, rank: 4, set: 'military', bonus: { carryBonus: 12 }, desc: 'MOLLE everything. +12kg carry.' },
    { name: 'Expedition Frame',   dr: 0.03, dura: 110, wt: 2.4, rank: 5, bonus: { carryBonus: 16 }, desc: 'Haul the whole district home. +16kg.' },
  ],
  accessory: [
    { name: 'Lucky Rabbit Foot',  dr: 0, dura: 30, wt: 0.1, rank: 2, bonus: { lootBonus: 0.06 }, desc: 'It wasn\'t lucky for the rabbit.' },
    { name: 'Dog Tags',           dr: 0, dura: 30, wt: 0.1, rank: 2, set: 'military', bonus: { damageReduc: 0.02 }, desc: 'Someone\'s name. Your resolve.' },
    { name: 'Trauma Charm',       dr: 0, dura: 30, wt: 0.1, rank: 3, set: 'medic', bonus: { bleedResist: 0.5 }, desc: 'Clotting agent auto-injector.' },
    { name: 'Runner\'s Band',     dr: 0, dura: 30, wt: 0.1, rank: 3, set: 'recon', bonus: { sprintBonus: 0.05 }, desc: 'Pace yourself. Or don\'t.' },
    { name: 'Radiation Badge',    dr: 0, dura: 30, wt: 0.1, rank: 4, set: 'hazmat', bonus: { radResist: 0.25 }, desc: 'At least you\'ll know how bad it is.' },
    { name: 'Scavenger\'s Monocle',dr: 0, dura: 30, wt: 0.1, rank: 5, set: 'survivor', bonus: { lootBonus: 0.12 }, desc: 'Sees value in the wreckage.' },
  ],
};

const ARMOR_GRADES = [
  { prefix: 'Worn ',       mult: 0.75, duraMult: 0.7,  rarityShift: -1, valueMult: 0.5 },
  { prefix: '',            mult: 1.0,  duraMult: 1.0,  rarityShift: 0,  valueMult: 1.0 },
  { prefix: 'Reinforced ', mult: 1.28, duraMult: 1.45, rarityShift: 1,  valueMult: 2.2 },
];

const _RARITY_ORDER = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
const ARMOR_POOLS = { common: [], uncommon: [], rare: [], epic: [], legendary: [] };
const ARMOR_GLYPHS = { head: '🪖', face: '🥽', chest: '🦺', arms: '💪', legs: '👖', feet: '🥾', back: '🎒', accessory: '🔮' };

function _aslug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

function generateArmorCatalog() {
  for (const [slot, families] of Object.entries(ARMOR_FAMILIES)) {
    for (const fam of families) {
      for (const grade of ARMOR_GRADES) {
        const rarityIdx = Math.max(0, Math.min(4, Math.ceil(fam.rank / 1.5) - 1 + grade.rarityShift));
        const rarity = _RARITY_ORDER[rarityIdx];
        const id = 'a_' + _aslug(grade.prefix + fam.name);
        if (ARMOR_TYPES[id]) continue;
        const def = {
          id, name: grade.prefix + fam.name, rarity, slot,
          damageReduction: +(fam.dr * grade.mult).toFixed(3),
          maxDurability: Math.round(fam.dura * grade.duraMult),
          weight: +(fam.wt * (grade.mult > 1 ? 1.15 : 1)).toFixed(1),
          repairCostScrap: Math.max(3, Math.round(fam.rank * 5 * grade.mult)),
          repairCostElectronics: fam.rank >= 4 ? Math.round(fam.rank / 2) : 0,
          value: Math.max(8, Math.round(fam.rank * fam.rank * 18 * grade.valueMult)),
          description: fam.desc,
          set: fam.set || null,
        };
        if (fam.bonus) Object.assign(def, fam.bonus);
        ARMOR_TYPES[id] = def;
        if (typeof ITEMS !== 'undefined' && !ITEMS[id]) {
          ITEMS[id] = {
            id, name: def.name, type: 'armor', rarity, weight: def.weight,
            stack: 1, value: def.value, armorId: id,
            color: fam.set && ARMOR_SETS[fam.set] ? ARMOR_SETS[fam.set].color : '#9aa07a',
            glyph: ARMOR_GLYPHS[slot] || '🛡',
          };
        }
        ARMOR_POOLS[rarity].push(id);
      }
    }
  }
}

/* ---- Legacy pieces (old saves / prices.js reference these ids) ---- */
Object.assign(ARMOR_TYPES, {
  leather_vest: {
    id: 'leather_vest', name: 'Leather Vest', rarity: 'common', slot: 'chest',
    damageReduction: 0.15, maxDurability: 80, weight: 2.2,
    repairCostScrap: 8, repairCostElectronics: 0, value: 45, set: null,
    description: 'Basic leather protection. Low durability, easy to repair.',
  },
  tactical_rig: {
    id: 'tactical_rig', name: 'Tactical Rig', rarity: 'uncommon', slot: 'chest',
    damageReduction: 0.25, maxDurability: 120, weight: 3.5,
    repairCostScrap: 12, repairCostElectronics: 1, value: 120, set: 'recon',
    description: 'Military-grade tactical gear with pockets.',
  },
  kevlar_vest: {
    id: 'kevlar_vest', name: 'Kevlar Vest', rarity: 'rare', slot: 'chest',
    damageReduction: 0.35, maxDurability: 180, weight: 5.1,
    repairCostScrap: 20, repairCostElectronics: 2, value: 280, set: 'military',
    description: 'High-grade ballistic protection.',
  },
  combat_exoskeleton: {
    id: 'combat_exoskeleton', name: 'Combat Exoskeleton', rarity: 'epic', slot: 'chest',
    damageReduction: 0.45, maxDurability: 250, weight: 7.8,
    repairCostScrap: 35, repairCostElectronics: 5, value: 650, carryBonus: 2, set: null,
    description: 'Powered armour frame. +2kg carry.',
  },
  void_cloak: {
    id: 'void_cloak', name: 'Void Cloak', rarity: 'legendary', slot: 'chest',
    damageReduction: 0.55, maxDurability: 320, weight: 4.2,
    repairCostScrap: 50, repairCostElectronics: 8, value: 1200, stealthBonus: 0.15, set: null,
    description: 'Mysterious dark armour. Exceptional protection, slight stealth.',
  },
  ballistic_helmet: {
    id: 'ballistic_helmet', name: 'Ballistic Helmet', rarity: 'uncommon', slot: 'head',
    damageReduction: 0.12, maxDurability: 100, weight: 1.8,
    repairCostScrap: 8, repairCostElectronics: 0, value: 80, detectBonus: 0.05, set: 'military',
    description: 'Protects the head. +5% awareness.',
  },
  reinforced_boots: {
    id: 'reinforced_boots', name: 'Reinforced Boots', rarity: 'common', slot: 'feet',
    damageReduction: 0.08, maxDurability: 70, weight: 1.6,
    repairCostScrap: 6, repairCostElectronics: 0, value: 35, speedBonus: 0.03, set: null,
    description: 'Heavy-duty boots. Minor protection, +3% speed.',
  },
});
generateArmorCatalog();
for (const k of ['leather_vest', 'tactical_rig', 'kevlar_vest', 'combat_exoskeleton', 'void_cloak', 'ballistic_helmet', 'reinforced_boots']) {
  ARMOR_POOLS[ARMOR_TYPES[k].rarity].push(k);
}

// Random armor ITEM id at (or below) a rarity — used by loot rolls.
function rollArmorItemId(rarity = 'common') {
  let idx = Math.max(0, _RARITY_ORDER.indexOf(rarity));
  for (let i = idx; i >= 0; i--) {
    const pool = ARMOR_POOLS[_RARITY_ORDER[i]];
    if (pool && pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

// Count equipped pieces per set + collect the active bonus effect bag.
function collectSetBonuses(armor) {
  const counts = {};
  for (const slot of ARMOR_SLOTS) {
    const inst = armor && armor[slot];
    if (inst && !inst.isBroken && inst.def.set) counts[inst.def.set] = (counts[inst.def.set] || 0) + 1;
  }
  const fx = {};
  const active = [];
  for (const [setId, n] of Object.entries(counts)) {
    const set = ARMOR_SETS[setId];
    if (!set) continue;
    for (const [need, bonus] of Object.entries(set.bonuses)) {
      if (n >= +need) {
        active.push({ set: setId, name: set.name, pieces: +need, bonus });
        for (const [k, v] of Object.entries(bonus)) {
          if (k.endsWith('Mult')) fx[k] = (fx[k] ?? 1) * v;
          else fx[k] = (fx[k] || 0) + v;
        }
      }
    }
  }
  return { fx, active, counts };
}

/* ArmorInstance: one piece of equipped armour with current durability */
class ArmorInstance {
  constructor(armorId, durability = null) {
    const def = ARMOR_TYPES[armorId];
    if (!def) throw new Error(`Unknown armor ID: ${armorId}`);
    this.id = armorId;
    this.def = def;
    this.currentDurability = durability ?? def.maxDurability;
    this.isBroken = false;
  }

  getDamageReduction() {
    if (this.isBroken) return 0;
    const durRatio = this.currentDurability / this.def.maxDurability;
    return this.def.damageReduction * durRatio;
  }

  takeDamage(amount) {
    this.currentDurability -= amount;
    if (this.currentDurability <= 0) {
      this.currentDurability = 0;
      this.isBroken = true;
    }
  }

  repair(amount) {
    this.currentDurability = Math.min(this.def.maxDurability, this.currentDurability + amount);
    this.isBroken = false;
  }

  repairFully() {
    this.currentDurability = this.def.maxDurability;
    this.isBroken = false;
  }

  serialize() {
    return { id: this.id, durability: this.currentDurability, broken: this.isBroken };
  }

  static deserialize(data) {
    const instance = new ArmorInstance(data.id, data.durability);
    instance.isBroken = data.broken;
    return instance;
  }
}

function getArmorDef(id) { return ARMOR_TYPES[id] || null; }

function getRepairCost(armorId) {
  const def = ARMOR_TYPES[armorId];
  if (!def) return { scrap: 0, electronics: 0 };
  return { scrap: def.repairCostScrap, electronics: def.repairCostElectronics };
}

function getRepairCostPartial(armorId, damageAmount) {
  const def = ARMOR_TYPES[armorId];
  if (!def) return { scrap: 0, electronics: 0 };
  const ratio = Math.min(1, damageAmount / def.maxDurability);
  return {
    scrap: Math.ceil(def.repairCostScrap * ratio),
    electronics: Math.ceil(def.repairCostElectronics * ratio),
  };
}
