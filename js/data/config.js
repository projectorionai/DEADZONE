/* Dead Zone: Reclamation — Global configuration & tunables
 * All magic numbers live here so gameplay can be balanced without touching logic.
 *
 * PHASE 3.5: authentic Dead Frontier 1 loop — kill, loot, level, push deeper.
 * No hunger/thirst, no weapon durability. Districts 1-6 scale danger + reward.
 */
const CONFIG = {
  version: '0.4.0',
  saveKey: 'deadzone_reclamation_save_v2',

  world: {
    width: 8000,
    height: 6000,
    tile: 64,
    dayCycleSeconds: 480,   // full day/night loop

    backgroundColor: '#171a1d',
    streetColor: '#2b2f34',
    safeZoneColor: 'rgba(64, 140, 96, 0.10)',

    // Dense inner-city generation
    fillerPerBlock: [4, 9],       // filler buildings packed into each city block
    fillerHeight: [26, 130],      // filler building height range (higher deep city)
    wreckCount: 150,              // wrecked cars / barricades on the streets
    burningCars: 9,               // of those, this many burn (firelight)
    policeWrecks: 6,              // wrecks with working emergency flashers
    corpseCount: 90,              // street corpses + blood smears
    campCount: 4,                 // abandoned survivor camps (mid districts)
    lampCount: 90,                // street lamps (a third still lit)
  },

  render: {
    fov: 900,
    zombieDetectRing: false,
    streetLightPool: 4,     // real point lights assigned to nearest lit lamps
    fireLightPool: 5,       // real flickering lights assigned to nearest fires
  },

  // Isometric projection (2:1 diamond). Logic stays cartesian; only drawing projects.
  iso: {
    IX: 0.5, IY: 0.25, IZ: 0.62, zoom: 1.15,
  },

  player: {
    radius: 16,
    walkSpeed: 190,
    sprintSpeed: 320,
    maxHealth: 100,
    maxStamina: 100,
    staminaDrain: 28,
    staminaRegen: 18,
    sprintMinStamina: 5,
    baseCarryWeight: 50,
    startingCurrency: 50,
    invulnFrames: 0.26,
  },

  zombie: {
    radius: 15,
    walkSpeed: 70,
    chaseSpeed: 150,
    detectRadius: 360,
    loseRadius: 640,
    attackRange: 36,
    attackDamage: 16,
    attackCooldown: 0.9,
    maxHealth: 82,
    xpReward: 12,
    patrolChangeInterval: 3.0,
    headshotMultiplier: 2.5,
    headRadius: 8,
    contactPush: 40,
  },

  /* ---------------- DISTRICT SYSTEM (the DF1 core loop) ----------------
   * Danger and reward scale with distance from RAVENSIDE OUTPOST only.
   * Fort Bastion sits deep in the red zone, Fort Pastor style.
   */
  /* District 1 is the tutorial district: slow, soft, sparse, generous.
   * speedMult scales zombie movement; cashMult scales kill-credit drops;
   * interiorZombies = [min, max] infected inside buildings of that district;
   * mutants gate at district 3, bosses at district 3 (outdoors only). */
  districts: [
    { id: 1, name: 'Ravenside Fringe', maxDist: 950,      color: '#6ad06a',
      hpMult: 0.55, dmgMult: 0.55, speedMult: 0.75, capBonus: -10, intervalMult: 2.4, batch: 1,
      bossChance: 0,     lootBump: 0.1,  cashMult: 1.6, interiorZombies: [3, 6],  ambience: 0.2 },
    { id: 2, name: 'The Old Quarter',  maxDist: 1800,     color: '#b8d06a',
      hpMult: 0.85, dmgMult: 0.85, speedMult: 0.9,  capBonus: 8,  intervalMult: 1.2, batch: 1,
      bossChance: 0.012, lootBump: 0.08, cashMult: 1.25, interiorZombies: [5, 9], ambience: 0.35 },
    { id: 3, name: 'Craven Heights',   maxDist: 2750,     color: '#e0c05a',
      hpMult: 1.05, dmgMult: 1.05, speedMult: 1,    capBonus: 20, intervalMult: 0.8, batch: 2,
      bossChance: 0.03,  lootBump: 0.15, cashMult: 1, interiorZombies: [8, 13],  ambience: 0.5 },
    { id: 4, name: 'Union District',   maxDist: 3800,     color: '#e0954a',
      hpMult: 1.20, dmgMult: 1.18, speedMult: 1.05, capBonus: 34, intervalMult: 0.55, batch: 3,
      bossChance: 0.05,  lootBump: 0.3,  cashMult: 1, interiorZombies: [10, 16], ambience: 0.65 },
    { id: 5, name: 'The Deadline',     maxDist: 5100,     color: '#e0604a',
      hpMult: 1.40, dmgMult: 1.32, speedMult: 1.1,  capBonus: 48, intervalMult: 0.4, batch: 3,
      bossChance: 0.07,  lootBump: 0.5,  cashMult: 1.1, interiorZombies: [12, 18], ambience: 0.8 },
    { id: 6, name: 'Ground Zero',      maxDist: Infinity, color: '#c03a3a',
      hpMult: 1.65, dmgMult: 1.5,  speedMult: 1.15, capBonus: 62, intervalMult: 0.3, batch: 4,
      bossChance: 0.09,  lootBump: 0.75, cashMult: 1.25, interiorZombies: [14, 20], ambience: 1 },
  ],
  interiorMutantMinDistrict: 3,   // buildings in D1-2 never contain mutants

  // Elite variants — every spawn instance rolls these (rarer = deadlier = lootable)
  variants: {
    specialChance:    0.045,  // +0.01 per district above 1
    irradiatedChance: 0.01,   // +0.004 per district above 1
  },

  spawn: {
    maxZombies: 70,
    spawnInterval: 1.6,
    minSpawnDistFromPlayer: 480,
    safeSpawnPadding: 420,
    maxBoss: 3,
    bossDistrictMin: 3,        // bosses appear from district 3 outward
    innerCityInitial: 130,     // pre-placed zombies in districts 4+ at world load
    ravensideClusterWeight: 0.05,
    bastionClusterWeight:   0.22,
    worldBossInterval: [520, 900],  // seconds between world boss appearances
  },

  combat: {
    bulletSpeed: 1500,
    bulletLife: 4.0,
    meleeArc: Math.PI * 0.7,
    hitFlash: 0.12,
  },

  loot: {
    interactRange: 46,
    respawnContainers: false,
    corpseRange: 52,
    corpseLinger: 25,
    emptyContainerChance: 0.18,
    zombieDropChance: 0.2,
    rareWeaponBase: 0.012,
    rareWeaponPerLevel: 0.0015,
    rareWeaponCap: 0.05,
    // Kill credits: DF-style cash from confirmed kills, scaled by district cashMult
    killCredits: [1, 3],
    eliteKillCredits: [8, 18],
    hiddenCacheChance: 0.06,   // per interior: a glowing stash of top-tier loot
  },

  missions: {
    maxActive: 3,
    boardSize: 6,        // offers on the board at once
    dailyCount: 3,       // daily missions, refresh every real day
  },

  progression: {
    // DF-style long game: level 2 costs 1000 XP (a walker pays ~100),
    // the curve is polynomial, and the hard cap is level 220.
    xpBase: 1000,
    xpPower: 1.35,
    levelCap: 220,
    killXpMult: 8,         // bestiary xp values are multiplied by this
    statPointsPerLevel: 2,
    skillPointsPerLevel: 1,
    strengthCarryPerPoint: 10,
    strengthMeleePerPoint: 0.06,
    enduranceHpPerPoint: 10,
    endStaminaPerPoint: 6,
    endDrainPerPoint: 0.05,
    accuracySpreadPerPoint: 0.012,
    survivalLootPerPoint: 0.06,    // Survival = scavenger instinct: loot fortune
    agilitySpeedPerPoint: 0.025,
    reloadingPerPoint: 0.07,
    dexterityFirePerPoint: 0.04,
  },

  // Injury system — combat consequences, not survival busywork
  injury: {
    bleedChance: 0.14,
    bleedDps: 1.6,
    bleedDuration: 14,
    fractureChance: 0.09,
    fractureBruteChance: 0.2,
    fractureThreshold: 20,
    fractureSpeedMult: 0.55,
    fractureSelfHeal: 75,
    blurDuration: 6.5,
    blurDps: 1.2,
    acidDps: 4,          // standing in an acid pool
    acidArmorShred: 3,   // armor durability lost per second in acid
  },

  weather: {
    minDuration: 70,
    maxDuration: 160,
    rainDrops: 1600,
  },

  // Ambient horror stingers (distant screams / gunfire / creaks / buzzing).
  // Higher districts: shorter gaps, louder dread.
  ambience: {
    minGap: 9,
    maxGap: 26,
  },

  market: {
    listingCount: 34,        // simulated survivor listings live at once
    restockSeconds: 75,      // partial refresh cadence
    sellTickSeconds: 10,     // how often player listings try to sell
    sellChance: 0.09,        // per tick per listing
    listingFee: 0.05,        // cut taken when a listing sells
  },

  ui: {
    invCols: 8,
    invRows: 6,
  },
};

// District lookup by straight-line distance from Ravenside.
function districtByDistance(d) {
  for (const dist of CONFIG.districts) if (d <= dist.maxDist) return dist;
  return CONFIG.districts[CONFIG.districts.length - 1];
}

/* Loading screen flavour — tips + district lore, DF1 style. */
const DZ_TIPS = [
  'Headshots deal massively increased damage. Aim high.',
  'Rabid and Irradiated mutants can be harvested for rare loot. [E] on the corpse.',
  'Bloats swell before they burst. When it drops, RUN.',
  'The Spitter telegraphs its acid spray — strafe out of the cone.',
  'Aggro too hot? Districts closer to Ravenside are always calmer.',
  'The marketplace refreshes constantly. Check back for rare gear.',
  'Bandages stop bleeding AND splint broken bones.',
  'Sound draws the horde. Melee is quiet. Miniguns are not.',
  'Guards defend the walls — but kills only count when they\'re yours.',
  'Storms cut visibility for you AND for them. Mostly for you.',
];
const DZ_LORE = [
  'Ravenside fell in six days. The outpost wall went up in two.',
  'Fort Bastion still broadcasts on military channels. Nobody answers.',
  'They say Ground Zero glows at night. Nobody who checked came back.',
  'The Old Quarter was evacuated first. It didn\'t help.',
  'Union Market: neutral ground. The traders shoot looters on sight.',
  'St. Mercy\'s doctors stayed behind. Some of them are still walking the wards.',
  'The Deadline got its name from the cordon the army drew. And lost.',
  'Craven Heights: high-rises, higher bodycount.',
];
