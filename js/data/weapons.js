/* Weapon stat tables. Referenced by items with weaponId.
 * bulletSpeed = projectile speed (px/s); recoil = spread kick added per shot (decays);
 * noise = radius that alerts nearby zombies; baseCrit = innate critical strike chance.
 * fireRate = delay between shots in seconds (lower is faster).
 *
 * The catalogue is generated: each ARCHETYPE defines base stats + a ladder of
 * named models (tier 1..10). Tier scales damage/handling/value, and every model
 * is registered into WEAPONS and ITEMS, giving 100+ distinct weapons.
 * sfx = audio profile, model = which held-weapon mesh to use.
 */
const WEAPONS = {};

const WEAPON_ARCHETYPES = {
  pistol: {
    kind: 'ranged', sfx: 'pistol', model: 'pistol', glyph: '🔫',
    ammoType: '9mm', ammoItem: 'ammo_9mm', weight: 1.1,
    base: { magSize: 12, damage: 22, fireRate: 0.30, reloadTime: 1.5, spread: 0.016, range: 6000, bulletSpeed: 1500, recoil: 0.02, noise: 520, baseCrit: 0.14 },
    scale: { damage: 1.16, value: 1.55 },
    models: ['Scrap Pistol', '.22 Target Pistol', 'Makeshift Nine', 'M9 Pistol', 'Glock 19', 'P226 Tactical', 'Five-Seven', 'Tactical USP', 'Alpha Bull', 'Gauss Pistol'],
  },
  revolver: {
    kind: 'ranged', sfx: 'revolver', model: 'revolver', glyph: '🔫',
    ammoType: '45', ammoItem: 'ammo_45', weight: 1.3,
    base: { magSize: 6, damage: 38, fireRate: 0.52, reloadTime: 2.4, spread: 0.018, range: 5000, bulletSpeed: 1650, recoil: 0.05, noise: 820, baseCrit: 0.18 },
    scale: { damage: 1.17, value: 1.55 },
    models: ['Rusty Snub Nose', '.38 Special', 'Peacekeeper', '.45 Long Colt', 'Colt Python', 'Anaconda', 'Raging Bull', 'Maelstrom', 'Widowmaker', 'Hand Cannon'],
  },
  smg: {
    kind: 'ranged', sfx: 'smg', model: 'smg', glyph: '🔫',
    ammoType: '9mm', ammoItem: 'ammo_9mm', weight: 2.6,
    base: { magSize: 30, damage: 14, fireRate: 0.095, reloadTime: 2.1, spread: 0.12, range: 4200, bulletSpeed: 1500, recoil: 0.035, noise: 650, baseCrit: 0.05 },
    scale: { damage: 1.15, value: 1.6 },
    models: ['Pipe SMG', 'MAC-10', 'Uzi', 'MP-40', 'MP5', 'P90', 'Vector', 'Kriss Super V', 'Cyclone', 'Ripper SMG'],
  },
  rifle: {
    kind: 'ranged', sfx: 'rifle', model: 'ar15', glyph: '🔫',
    ammoType: '5.56', ammoItem: 'ammo_556', weight: 3.3,
    base: { magSize: 30, damage: 20, fireRate: 0.115, reloadTime: 2.3, spread: 0.09, range: 5400, bulletSpeed: 1950, recoil: 0.03, noise: 880, baseCrit: 0.05 },
    scale: { damage: 1.15, value: 1.6 },
    models: ['Rusted Carbine', 'Mini-14', 'AK-47', 'AR-15', 'M16A4', 'SCAR-L', 'ACR', 'G36C', 'HK416', 'Reaver AR'],
  },
  huntingrifle: {
    kind: 'ranged', sfx: 'rifle', model: 'huntingrifle', glyph: '🎯',
    ammoType: '308', ammoItem: 'ammo_308', weight: 3.2,
    base: { magSize: 5, damage: 44, fireRate: 0.62, reloadTime: 1.9, spread: 0.008, range: 8000, bulletSpeed: 2300, recoil: 0.06, noise: 900, baseCrit: 0.2 },
    scale: { damage: 1.15, value: 1.55 },
    models: ['Break-Action Rifle', 'Old Hunting Rifle', 'Winchester 70', 'Springfield 1903', 'M1 Garand', 'SKS', 'M14', 'R700 Tactical', 'Marksman EBR', 'Longfang'],
  },
  sniper: {
    kind: 'ranged', sfx: 'sniper', model: 'huntingrifle', glyph: '🎯',
    ammoType: '308', ammoItem: 'ammo_308', weight: 4.4,
    base: { magSize: 5, damage: 80, fireRate: 1.25, reloadTime: 2.9, spread: 0.002, range: 10000, bulletSpeed: 3000, recoil: 0.15, noise: 1100, baseCrit: 0.25 },
    scale: { damage: 1.16, value: 1.6 },
    models: ['Scoped Mosin', 'Dragunov SVD', 'M24', 'AWM', 'Intervention', 'Ghost AWP', 'TAC-50', 'Deadeye', 'Night Talon', 'Stormbreaker'],
  },
  shotgun: {
    kind: 'ranged', sfx: 'shotgun', model: 'pumpshotgun', glyph: '🔫', type: 'shotgun',
    ammoType: '12g', ammoItem: 'ammo_shells', weight: 3.4, pellets: 7,
    base: { magSize: 6, damage: 9, fireRate: 0.88, reloadTime: 3.1, spread: 0.15, range: 1600, bulletSpeed: 1200, recoil: 0.12, noise: 1050, baseCrit: 0.0 },
    scale: { damage: 1.16, value: 1.6 },
    models: ['Rusty Break Shotgun', 'Double Barrel', 'Sawn-Off', 'Pump 500', 'Riot 870', 'Combat SPAS', 'Auto-5', 'Benelli M4', 'Striker', 'Hellfire Auto'],
  },
  heavy: {
    kind: 'ranged', sfx: 'heavy', model: 'minigun', glyph: '⚙',
    ammoType: '5.56', ammoItem: 'ammo_556', weight: 11,
    base: { magSize: 120, damage: 12, fireRate: 0.055, reloadTime: 5.2, spread: 0.17, range: 5200, bulletSpeed: 1300, recoil: 0.025, noise: 1200, baseCrit: 0.02 },
    scale: { damage: 1.14, value: 1.65 },
    models: ['Bren Gun', 'RPD', 'M60', 'PKM', 'MG42', 'M249 SAW', 'Minigun', 'Vulcan', 'Devastator', 'Doom Cannon'],
  },
  blade: {
    kind: 'melee', sfx: 'melee', model: 'machete', glyph: '🔪', weight: 0.9,
    base: { damage: 26, fireRate: 0.36, range: 50, arc: Math.PI * 0.55, noise: 45, baseCrit: 0.14 },
    scale: { damage: 1.16, value: 1.5 },
    models: ['Kitchen Knife', 'Combat Knife', 'Machete', 'Bowie Knife', 'Cleaver', 'Kukri', 'Katana', 'Twin Fangs', 'Ripper Blade', 'Chainsword'],
  },
  blunt: {
    kind: 'melee', sfx: 'melee', model: 'melee', glyph: '🏏', weight: 1.6,
    base: { damage: 32, fireRate: 0.52, range: 56, arc: Math.PI * 0.7, noise: 70, baseCrit: 0.05 },
    scale: { damage: 1.16, value: 1.5 },
    models: ['Plank', 'Baseball Bat', 'Crowbar', 'Pipe Wrench', 'Lead Pipe', 'Nailed Bat', 'Sledgehammer', 'Warhammer', 'Rebar Maul', 'Seismic Maul'],
  },
  axe: {
    kind: 'melee', sfx: 'melee', model: 'fireaxe', glyph: '🪓', weight: 2.4,
    base: { damage: 42, fireRate: 0.72, range: 58, arc: Math.PI * 0.7, noise: 80, baseCrit: 0.08 },
    scale: { damage: 1.17, value: 1.5 },
    models: ['Hatchet', 'Fire Axe', 'Wood Axe', 'Pick Axe', 'Tactical Tomahawk', 'Battle Axe', 'Double-Bit Axe', 'Berserker Axe', 'Headsman', 'Executioner'],
  },
};

const TIER_RARITY = ['common', 'common', 'uncommon', 'uncommon', 'rare', 'rare', 'epic', 'epic', 'legendary', 'legendary'];
// Level required to wield each tier — the 220-level climb gates the arsenal.
const TIER_LEVEL_REQ = [1, 5, 10, 16, 24, 34, 46, 62, 85, 115];

// Slug a model name to a stable id: "Glock 19" -> "glock_19"
function _wslug(name) {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
}

// Pools of weapon ITEM ids per rarity, used by loot tables ('weapon_drop' token).
const WEAPON_POOLS = { common: [], uncommon: [], rare: [], epic: [], legendary: [] };

function _registerWeapon(w, itemId, rarity, value, weight) {
  WEAPONS[w.id] = w;
  if (typeof ITEMS !== 'undefined' && !ITEMS[itemId]) {
    ITEMS[itemId] = {
      id: itemId, name: w.name, type: 'weapon', rarity, weight,
      stack: 1, value, weaponId: w.id, color: '#8d949c', glyph: w.glyph || '🔫',
    };
  }
  WEAPON_POOLS[rarity].push(itemId);
}

function generateWeaponCatalog() {
  for (const [archId, a] of Object.entries(WEAPON_ARCHETYPES)) {
    a.models.forEach((name, i) => {
      const tier = i + 1;
      const dmgMult = Math.pow(a.scale.damage, tier - 1);
      const w = {
        id: archId + '_' + _wslug(name),
        name, kind: a.kind, sfx: a.sfx, model: a.model, glyph: a.glyph,
        archetype: archId, tier,
        damage: Math.round(a.base.damage * dmgMult),
        fireRate: +(a.base.fireRate * (1 - 0.012 * (tier - 1))).toFixed(3),
        noise: Math.round((a.base.noise || 60) * (1 + 0.03 * (tier - 1))),
        baseCrit: +((a.base.baseCrit || 0) + 0.004 * (tier - 1)).toFixed(3),
      };
      if (a.kind === 'ranged') {
        Object.assign(w, {
          ammoType: a.ammoType, ammoItem: a.ammoItem, type: a.type,
          magSize: Math.round(a.base.magSize * (1 + 0.06 * (tier - 1))),
          reloadTime: +(a.base.reloadTime * (1 - 0.02 * (tier - 1))).toFixed(2),
          spread: +(a.base.spread * (1 - 0.035 * (tier - 1))).toFixed(4),
          range: Math.round(a.base.range * (1 + 0.02 * (tier - 1))),
          bulletSpeed: Math.round(a.base.bulletSpeed * (1 + 0.015 * (tier - 1))),
          recoil: a.base.recoil,
        });
        if (a.pellets) w.pellets = a.pellets + (tier >= 6 ? 1 : 0);
      } else {
        Object.assign(w, {
          range: a.base.range + tier, arc: a.base.arc,
        });
      }
      w.levelReq = TIER_LEVEL_REQ[tier - 1] || 1;
      const rarity = TIER_RARITY[tier - 1];
      const value = Math.round(30 * Math.pow(a.scale.value, tier - 1) * (a.kind === 'ranged' ? 2.2 : 1));
      const weight = +(a.weight * (1 + 0.04 * (tier - 1))).toFixed(1);
      _registerWeapon(w, 'w_' + w.id, rarity, value, weight);
    });
  }
}

/* ---------------- Legacy ids (saves, class kits, admin, models) ----------------
 * These keep old item ids / weaponIds working and give the classes starter guns.
 */
const LEGACY_WEAPONS = {
  pistol: {
    id: 'pistol', name: 'M9 Pistol', kind: 'ranged', sfx: 'pistol', model: 'pistol', archetype: 'pistol', tier: 2,
    ammoType: '9mm', ammoItem: 'ammo_9mm',
    magSize: 12, damage: 24, fireRate: 0.28, reloadTime: 1.4,
    spread: 0.015, range: 6000, bulletSpeed: 1500, recoil: 0.02, noise: 520, baseCrit: 0.15,
  },
  revolver: {
    id: 'revolver', name: '.45 Revolver', kind: 'ranged', sfx: 'revolver', model: 'revolver', archetype: 'revolver', tier: 2,
    ammoType: '45', ammoItem: 'ammo_45',
    magSize: 6, damage: 40, fireRate: 0.5, reloadTime: 2.3,
    spread: 0.018, range: 5000, bulletSpeed: 1650, recoil: 0.05, noise: 820, baseCrit: 0.18,
  },
  sniper: {
    id: 'sniper', name: 'AWM Sniper Rifle', kind: 'ranged', sfx: 'sniper', model: 'huntingrifle', archetype: 'sniper', tier: 4,
    ammoType: '308', ammoItem: 'ammo_308',
    magSize: 5, damage: 85, fireRate: 1.2, reloadTime: 2.8,
    spread: 0.002, range: 10000, bulletSpeed: 3000, recoil: 0.15, noise: 1100, baseCrit: 0.25,
  },
  huntingrifle: {
    id: 'huntingrifle', name: 'Hunting Rifle', kind: 'ranged', sfx: 'rifle', model: 'huntingrifle', archetype: 'huntingrifle', tier: 2,
    ammoType: '308', ammoItem: 'ammo_308',
    magSize: 5, damage: 48, fireRate: 0.6, reloadTime: 1.8,
    spread: 0.008, range: 8000, bulletSpeed: 2300, recoil: 0.06, noise: 900, baseCrit: 0.20,
  },
  minigun: {
    id: 'minigun', name: 'Minigun', kind: 'ranged', sfx: 'heavy', model: 'minigun', archetype: 'heavy', tier: 7,
    ammoType: '9mm', ammoItem: 'ammo_9mm',
    magSize: 200, damage: 13, fireRate: 0.04, reloadTime: 5.0,
    spread: 0.18, range: 5200, bulletSpeed: 1300, recoil: 0.025, noise: 1200, baseCrit: 0.02,
  },
  smg: {
    id: 'smg', name: 'MP-40 SMG', kind: 'ranged', sfx: 'smg', model: 'smg', archetype: 'smg', tier: 4,
    ammoType: '9mm', ammoItem: 'ammo_9mm',
    magSize: 32, damage: 16, fireRate: 0.09, reloadTime: 2.0,
    spread: 0.12, range: 4200, bulletSpeed: 1500, recoil: 0.035, noise: 650, baseCrit: 0.05,
  },
  ar15: {
    id: 'ar15', name: 'AR-15 Rifle', kind: 'ranged', sfx: 'rifle', model: 'ar15', archetype: 'rifle', tier: 4,
    ammoType: '5.56', ammoItem: 'ammo_556',
    magSize: 30, damage: 22, fireRate: 0.11, reloadTime: 2.2,
    spread: 0.09, range: 5400, bulletSpeed: 1950, recoil: 0.03, noise: 880, baseCrit: 0.05,
  },
  sawnoff: {
    id: 'sawnoff', name: 'Sawn-Off Shotgun', kind: 'ranged', type: 'shotgun', sfx: 'shotgun', model: 'sawnoff', archetype: 'shotgun', tier: 3,
    ammoType: '12g', ammoItem: 'ammo_shells', pellets: 6,
    magSize: 2, damage: 11, fireRate: 0.55, reloadTime: 2.4,
    spread: 0.22, range: 1300, bulletSpeed: 1150, recoil: 0.15, noise: 1000, baseCrit: 0.0,
  },
  pumpshotgun: {
    id: 'pumpshotgun', name: 'Pump Shotgun', kind: 'ranged', type: 'shotgun', sfx: 'shotgun', model: 'pumpshotgun', archetype: 'shotgun', tier: 4,
    ammoType: '12g', ammoItem: 'ammo_shells', pellets: 7,
    magSize: 6, damage: 10, fireRate: 0.85, reloadTime: 3.0,
    spread: 0.15, range: 1600, bulletSpeed: 1200, recoil: 0.12, noise: 1050, baseCrit: 0.0,
  },
  // --- melee ---
  combatknife: {
    id: 'combatknife', name: 'Combat Knife', kind: 'melee', sfx: 'melee', model: 'combatknife', archetype: 'blade', tier: 2,
    damage: 28, fireRate: 0.34, range: 48, arc: Math.PI * 0.5, noise: 45, baseCrit: 0.15,
  },
  machete: {
    id: 'machete', name: 'Machete', kind: 'melee', sfx: 'melee', model: 'machete', archetype: 'blade', tier: 3,
    damage: 30, fireRate: 0.38, range: 52, arc: Math.PI * 0.6, noise: 50, baseCrit: 0.10,
  },
  crowbar: {
    id: 'crowbar', name: 'Crowbar', kind: 'melee', sfx: 'melee', model: 'crowbar', archetype: 'blunt', tier: 3,
    damage: 36, fireRate: 0.55, range: 54, arc: Math.PI * 0.6, noise: 60, baseCrit: 0.05,
  },
  melee: {   // legacy id for the baseball bat (old saves / default fists-with-bat)
    id: 'melee', name: 'Baseball Bat', kind: 'melee', sfx: 'melee', model: 'melee', archetype: 'blunt', tier: 2,
    damage: 34, fireRate: 0.5, range: 56, arc: Math.PI * 0.7, noise: 70, baseCrit: 0.05,
  },
  baseballbat: {
    id: 'baseballbat', name: 'Baseball Bat', kind: 'melee', sfx: 'melee', model: 'melee', archetype: 'blunt', tier: 2,
    damage: 34, fireRate: 0.5, range: 56, arc: Math.PI * 0.7, noise: 70, baseCrit: 0.05,
  },
  wrench: {
    id: 'wrench', name: 'Pipe Wrench', kind: 'melee', sfx: 'melee', model: 'wrench', archetype: 'blunt', tier: 2,
    damage: 33, fireRate: 0.5, range: 52, arc: Math.PI * 0.6, noise: 55, baseCrit: 0.05,
  },
  fireaxe: {
    id: 'fireaxe', name: 'Fire Axe', kind: 'melee', sfx: 'melee', model: 'fireaxe', archetype: 'axe', tier: 3,
    damage: 48, fireRate: 0.75, range: 58, arc: Math.PI * 0.7, noise: 80, baseCrit: 0.08,
  },
  sledgehammer: {
    id: 'sledgehammer', name: 'Sledgehammer', kind: 'melee', sfx: 'melee', model: 'sledgehammer', archetype: 'blunt', tier: 4,
    damage: 62, fireRate: 1.0, range: 60, arc: Math.PI * 0.8, noise: 95, baseCrit: 0.02,
  },
};
/* ---- Unique mission-chain rewards: named signature weapons ---- */
const UNIQUE_WEAPONS = {
  marshals_longslide: {
    id: 'marshals_longslide', name: "Marshal's Longslide", kind: 'ranged', sfx: 'revolver', model: 'revolver',
    archetype: 'revolver', tier: 8, unique: true,
    ammoType: '45', ammoItem: 'ammo_45',
    magSize: 8, damage: 78, fireRate: 0.42, reloadTime: 1.9,
    spread: 0.01, range: 6000, bulletSpeed: 1900, recoil: 0.04, noise: 860, baseCrit: 0.3,
  },
  widows_whisper: {
    id: 'widows_whisper', name: "Widow's Whisper", kind: 'ranged', sfx: 'sniper', model: 'huntingrifle',
    archetype: 'sniper', tier: 9, unique: true,
    ammoType: '308', ammoItem: 'ammo_308',
    magSize: 6, damage: 160, fireRate: 1.0, reloadTime: 2.4,
    spread: 0.001, range: 11000, bulletSpeed: 3300, recoil: 0.12, noise: 480, baseCrit: 0.35,
  },
  old_glory: {
    id: 'old_glory', name: 'Old Glory', kind: 'ranged', sfx: 'rifle', model: 'ar15',
    archetype: 'rifle', tier: 8, unique: true,
    ammoType: '5.56', ammoItem: 'ammo_556',
    magSize: 40, damage: 34, fireRate: 0.095, reloadTime: 1.9,
    spread: 0.06, range: 5800, bulletSpeed: 2100, recoil: 0.025, noise: 900, baseCrit: 0.1,
  },
};
/* ---- EXPLOSIVE & INCENDIARY WEAPONS ----
 * explosive: AoE that damages THROUGH walls (concussion doesn't care).
 * flame:     cone of fire that sets zombies burning (DoT).
 */
const EXPLOSIVE_WEAPONS = {
  grenadelauncher: {
    id: 'grenadelauncher', name: 'M79 Thumper', kind: 'ranged', sfx: 'launcher', model: 'launcher',
    archetype: 'explosive', tier: 5, levelReq: 24,
    ammoType: '40mm', ammoItem: 'ammo_40mm',
    magSize: 4, damage: 30, fireRate: 0.95, reloadTime: 2.8,
    spread: 0.03, range: 2600, bulletSpeed: 950, recoil: 0.1, noise: 1400, baseCrit: 0,
    explosive: { radius: 130, damage: 55 },
  },
  rpg: {
    id: 'rpg', name: 'RPG-7', kind: 'ranged', sfx: 'launcher', model: 'rpg',
    archetype: 'explosive', tier: 8, levelReq: 46,
    ammoType: 'rocket', ammoItem: 'ammo_rocket',
    magSize: 1, damage: 60, fireRate: 1.4, reloadTime: 3.6,
    spread: 0.012, range: 4200, bulletSpeed: 1250, recoil: 0.2, noise: 1800, baseCrit: 0,
    explosive: { radius: 210, damage: 140 },
  },
  flamethrower: {
    id: 'flamethrower', name: 'Dragonbreath Projector', kind: 'ranged', sfx: 'flame', model: 'flamethrower',
    archetype: 'explosive', tier: 6, levelReq: 34,
    ammoType: 'fuel', ammoItem: 'ammo_fuel',
    magSize: 60, damage: 7, fireRate: 0.09, reloadTime: 3.2,
    spread: 0.05, range: 240, bulletSpeed: 0, recoil: 0, noise: 420, baseCrit: 0,
    flame: { range: 230, arc: Math.PI * 0.4, burn: 4 },
  },
};
Object.assign(WEAPONS, LEGACY_WEAPONS, UNIQUE_WEAPONS, EXPLOSIVE_WEAPONS);
generateWeaponCatalog();
// Explosives get items (epic/exotic tier finds — deep city & bosses only).
for (const [wid, rar, val, wt] of [['grenadelauncher', 'epic', 900, 5.4], ['rpg', 'exotic', 2400, 8.5], ['flamethrower', 'exotic', 1800, 7.8]]) {
  const w = WEAPONS[wid], itemId = 'w_' + wid;
  if (typeof ITEMS !== 'undefined' && !ITEMS[itemId]) {
    ITEMS[itemId] = { id: itemId, name: w.name, type: 'weapon', rarity: rar, weight: wt, stack: 1, value: val, weaponId: wid, color: '#c97a2a', glyph: '💥' };
  }
  WEAPON_POOLS[rar === 'exotic' ? 'legendary' : rar].push(itemId);
}
// Unique signature weapons carry passive buffs while equipped.
WEAPONS.marshals_longslide.buff = { critChance: 0.08 };
WEAPONS.marshals_longslide.levelReq = 40;
WEAPONS.widows_whisper.buff = { stealthMult: 0.8 };
WEAPONS.widows_whisper.levelReq = 70;
WEAPONS.widows_whisper.silenced = true;
WEAPONS.old_glory.buff = { speedBonus: 0.05, damageReduc: 0.04 };
WEAPONS.old_glory.levelReq = 30;
// Starter/legacy weapons stay usable from level 1-ish.
for (const [id, req] of Object.entries({ pistol: 1, revolver: 4, huntingrifle: 6, smg: 10, ar15: 14, sawnoff: 8, pumpshotgun: 12, sniper: 20, minigun: 34, melee: 1, baseballbat: 1, combatknife: 1, machete: 3, crowbar: 3, wrench: 2, fireaxe: 6, sledgehammer: 10 })) {
  if (WEAPONS[id]) WEAPONS[id].levelReq = req;
}
// Quiet weapons: melee never draws the horde; the Whisper barely speaks.
for (const w of Object.values(WEAPONS)) {
  if (w.kind === 'melee') w.noise = Math.min(w.noise || 45, 60);
  if (w.silenced) w.noise = 120;
}
// Unique weapons get items but stay OUT of loot pools — missions only.
for (const w of Object.values(UNIQUE_WEAPONS)) {
  const itemId = 'w_' + w.id;
  if (typeof ITEMS !== 'undefined' && !ITEMS[itemId]) {
    ITEMS[itemId] = {
      id: itemId, name: w.name, type: 'weapon', rarity: 'legendary', weight: 3,
      stack: 1, value: 1500, weaponId: w.id, color: '#ffd700', glyph: '🌟',
    };
  }
}

const WEAPON_AFFIXES = {
  lifesteal:     { name: 'Lifesteal',        stat: 'lifesteal',     value: 0.15, color: '#d94f4f' },
  piercing:      { name: 'Piercing Rounds',  stat: 'piercing',      value: 0.3,  color: '#e0e0e0' },
  explosive:     { name: 'Explosive Rounds', stat: 'explosive',     value: 0.25, color: '#ff6b1a' },
  critChance:    { name: 'Critical Strike',  stat: 'critBonus',     value: 0.15, color: '#ffd700' },
  movementSpeed: { name: 'Mobility +10%',    stat: 'movementSpeed', value: 0.1,  color: '#00ff88' },
  reloadSpeed:   { name: 'Reload Time -20%', stat: 'reloadSpeed',   value: 0.2,  color: '#4f8fdd' },
  fireRate:      { name: 'Fire Rate +15%',   stat: 'fireRateMod',   value: 0.15, color: '#ff00ff' },
  magCapacity:   { name: 'Magazine +25%',    stat: 'magCapacity',   value: 0.25, color: '#ffff00' },
};

const AFFIX_POOL = Object.keys(WEAPON_AFFIXES);

function getAffixInfo(key) { return WEAPON_AFFIXES[key] || null; }

// NOTE: never declare a second `Utils` here — data files load before
// core/Utils.js, and a top-level redeclaration kills the real Utils.
// (Utils.randInt / Utils.randFloat are only *called* at runtime, so using the
// shared Utils from inside functions below is safe.)

function getWeapon(id) { return WEAPONS[id]; }

// Random weapon ITEM id at (or near) a rarity — used by loot rolls.
function rollWeaponItemId(rarity = 'common') {
  const order = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
  let idx = Math.max(0, order.indexOf(rarity));
  for (let i = idx; i >= 0; i--) {
    const pool = WEAPON_POOLS[order[i]];
    if (pool && pool.length) return pool[Math.floor(Math.random() * pool.length)];
  }
  return null;
}

function generateWeaponItem(baseWeaponId, rarity = 'common') {
  const base = WEAPONS[baseWeaponId];
  if (!base) return null;

  // Establish a procedural variance coefficient (e.g., +/- 15% standard variance)
  const variance = Utils.randFloat(0.85, 1.15);

  const item = {
    id: baseWeaponId + '_' + Math.random().toString(36).substr(2, 9),
    baseWeaponId,
    name: base.name,
    rarity,
    affixes: [],
    stats: {
      spread: base.kind === 'ranged' ? parseFloat((base.spread * variance).toFixed(4)) : 0,
      recoil: base.kind === 'ranged' ? parseFloat(((base.recoil || 0) * variance).toFixed(4)) : 0,
      critBonus: 0,
    },
  };

  if (rarity === 'epic' || rarity === 'legendary') {
    const affixCount = rarity === 'epic' ? Utils.randInt(1, 2) : Utils.randInt(2, 3);
    const picked = new Set();
    for (let i = 0; i < affixCount && picked.size < AFFIX_POOL.length; i++) {
      const affixKey = AFFIX_POOL[Utils.randInt(0, AFFIX_POOL.length - 1)];
      if (!picked.has(affixKey)) {
        picked.add(affixKey);
        item.affixes.push(affixKey);
        const affixData = WEAPON_AFFIXES[affixKey];
        if (affixData.stat === 'critBonus') item.stats.critBonus += affixData.value;
      }
    }
  }

  return item;
}

/**
 * Calculates the final output damage of a weapon strike.
 * @param {Object} baseWeapon - The static weapon definition from WEAPONS
 * @param {Object} itemStats - The specific generated item's stats (holds critBonus)
 * @returns {Number} The finalised damage value
 */
function calculateStrikeDamage(baseWeapon, itemStats) {
  let isCrit = false;
  if (baseWeapon.type !== 'shotgun') {
    let totalCrit = Math.min(0.85, baseWeapon.baseCrit + (itemStats.critBonus || 0));
    isCrit = Math.random() < totalCrit;
  }
  const finalDamage = isCrit ? baseWeapon.damage * 2.5 : baseWeapon.damage;
  return finalDamage;
}
