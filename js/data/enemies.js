/* Bestiary — Dead Frontier-inspired enemy types.
 * `tier` = minimum DISTRICT (1-6) the enemy appears in.
 * `mutant: true` marks the iconic mutations (unique silhouette/sound/behaviour).
 * behaviors: leap, explode, acid (cone spray), charge, scream, slam, summon,
 *            aura, boss (+bossClass 'mini'|'district'|'world', phases[]).
 * palette drives the 3D model tint; `voice` picks the vocal profile in Audio.
 */
const ENEMIES = {
  // ---------------- COMMON INFECTED ----------------
  walker: {
    id: 'walker', name: 'Walker', tier: 1, weight: 40,
    radius: 15, bodyH: 34, hp: 82, walk: 40, chase: 92, damage: 15,
    attackRange: 34, attackCd: 0.95, detect: 360, lose: 620, xp: 12, headMult: 2.5,
    palette: { body: '#5f7a48', light: '#7c9a5f', dark: '#3f5230', head: '#6a5a4a' },
    voice: 'moan',
    desc: 'Shambling infected citizen. Slow but relentless in numbers.',
  },
  crawler: {
    id: 'crawler', name: 'Crawler', tier: 1, weight: 15,
    radius: 11, bodyH: 16, hp: 42, walk: 78, chase: 190, damage: 11,
    attackRange: 26, attackCd: 0.6, detect: 380, lose: 560, xp: 10, headMult: 2.0,
    palette: { body: '#4a4438', light: '#6a604a', dark: '#2e2a20', head: '#5a5040' },
    voice: 'rasp',
    desc: 'Legless torso dragging itself with terrifying speed. Hard to spot in rubble.',
  },
  runner: {
    id: 'runner', name: 'Leaper', tier: 2, weight: 24,
    radius: 13, bodyH: 30, hp: 54, walk: 88, chase: 240, damage: 14,
    attackRange: 32, attackCd: 0.7, detect: 430, lose: 640, xp: 16, headMult: 2.5,
    palette: { body: '#8a6a3a', light: '#b08a4e', dark: '#5c4626', head: '#7a5a3a' },
    behavior: { leap: { range: 230, cd: 2.6, speed: 510 } },
    voice: 'hiss', mutant: true,
    desc: 'Sprints and lunges at prey. Fragile but deadly if it closes in.',
  },
  bloat: {
    id: 'bloat', name: 'Bloat', tier: 2, weight: 13,
    radius: 22, bodyH: 40, hp: 185, walk: 40, chase: 88, damage: 20,
    attackRange: 40, attackCd: 1.2, detect: 300, lose: 480, xp: 30, headMult: 1.6,
    palette: { body: '#6a7a4a', light: '#93a86a', dark: '#454f2e', head: '#7d8a52' },
    behavior: { explode: { radius: 105, damage: 46, fuse: 0.9 } },
    voice: 'gurgle',
    desc: 'Grotesque, swollen host. Swells and ruptures into a toxic burst when killed — run.',
  },
  nightfiend: {
    id: 'nightfiend', name: 'Night Fiend', tier: 3, weight: 18, nightOnly: true,
    radius: 14, bodyH: 34, hp: 125, walk: 68, chase: 272, damage: 22,
    attackRange: 32, attackCd: 0.8, detect: 500, lose: 720, xp: 26, headMult: 2.2,
    palette: { body: '#26202e', light: '#3a3346', dark: '#161219', head: '#312a3a' },
    behavior: { leap: { range: 220, cd: 2.4, speed: 520 } },
    voice: 'hiss', mutant: true,
    desc: 'A shadow-skinned horror that only prowls after dark. Fast, silent, lethal.',
  },

  // ---------------- MUTANTS ----------------
  screamer: {
    id: 'screamer', name: 'Screamer', tier: 3, weight: 9,
    radius: 14, bodyH: 36, hp: 95, walk: 55, chase: 130, damage: 10,
    attackRange: 32, attackCd: 1.0, detect: 480, lose: 720, xp: 34, headMult: 2.4,
    palette: { body: '#9a8a9a', light: '#c0aec0', dark: '#5f545f', head: '#a898a0' },
    behavior: { scream: { cd: 9, radius: 900, summon: 3, summonType: 'walker' } },
    voice: 'shriek', mutant: true, model: 'screamer',
    desc: 'Its wail carries across whole districts, calling the horde down on you. Silence it fast.',
  },
  brute: {
    id: 'brute', name: 'Brute', tier: 3, weight: 11,
    radius: 26, bodyH: 52, hp: 350, walk: 42, chase: 122, damage: 36,
    attackRange: 46, attackCd: 1.3, detect: 360, lose: 620, xp: 46, headMult: 1.4,
    palette: { body: '#7a4a4a', light: '#a06060', dark: '#4c2c2c', head: '#8a5050' },
    behavior: { knockback: 170, boneBreaker: true },
    voice: 'roar',
    desc: 'A hulking mutation. Heavy hits, heavy health, and a bone-jarring knockback.',
  },
  charger: {
    id: 'charger', name: 'Ravager', tier: 4, weight: 9,
    radius: 20, bodyH: 44, hp: 210, walk: 48, chase: 110, damage: 28,
    attackRange: 40, attackCd: 1.1, detect: 420, lose: 640, xp: 38, headMult: 1.6,
    palette: { body: '#6a5a3a', light: '#8f7c52', dark: '#443a24', head: '#7a6a48' },
    behavior: { charge: { range: 420, windup: 0.7, speed: 640, dur: 0.8, cd: 5.5, damage: 34, knockback: 220 }, boneBreaker: true },
    voice: 'roar', mutant: true, model: 'ravager',
    desc: 'Lowers its malformed shoulder and bulldozes anything in a straight line.',
  },
  spitter: {
    id: 'spitter', name: 'Spitter', tier: 4, weight: 12,
    radius: 15, bodyH: 36, hp: 105, walk: 50, chase: 100, damage: 14,
    attackRange: 240, attackCd: 1.6, detect: 440, lose: 660, xp: 34, headMult: 2.0,
    palette: { body: '#4a6a7a', light: '#63909f', dark: '#2e424c', head: '#5a7a86' },
    // Telegraphed cone spray: windup glow -> acid cone + lingering pools.
    behavior: { acid: { range: 240, arc: Math.PI * 0.5, windup: 0.85, damage: 16, cd: 4.5, pools: 3, poolR: 34, poolTtl: 6 } },
    voice: 'gurgle', mutant: true, model: 'spitter',
    desc: 'Rears back and hoses a cone of corrosive bile. Sidestep the spray — never tank it.',
  },
  stalker: {
    id: 'stalker', name: 'Reaper', tier: 4, weight: 11,
    radius: 16, bodyH: 40, hp: 165, walk: 72, chase: 225, damage: 30,
    attackRange: 36, attackCd: 0.8, detect: 460, lose: 680, xp: 40, headMult: 2.2,
    palette: { body: '#5a3a6a', light: '#7c548f', dark: '#38243f', head: '#6a4a7a' },
    behavior: { leap: { range: 270, cd: 2.2, speed: 520 } },
    voice: 'hiss', mutant: true,
    desc: 'Ambush predator of the inner city. Hunts from the alleys in lethal packs.',
  },
  wraith: {
    id: 'wraith', name: 'Wraith', tier: 5, weight: 8,
    radius: 16, bodyH: 44, hp: 240, walk: 80, chase: 265, damage: 24,
    attackRange: 38, attackCd: 0.45, detect: 500, lose: 760, xp: 55, headMult: 2.0,
    palette: { body: '#8a92a0', light: '#b0b8c6', dark: '#4e5460', head: '#9aa2b0' },
    behavior: { flurry: true },
    voice: 'shriek', mutant: true, model: 'wraith',
    desc: 'Four-armed horror moving like a broken sprinter. Its flurry shreds armour in seconds.',
  },

  // ---------------- BOSSES ----------------
  butcher: {
    id: 'butcher', name: 'The Butcher', tier: 3, weight: 6,
    radius: 24, bodyH: 50, hp: 620, walk: 46, chase: 140, damage: 34,
    attackRange: 44, attackCd: 0.9, detect: 460, lose: 760, xp: 90, headMult: 1.6,
    palette: { body: '#7a3a30', light: '#a05446', dark: '#4a221c', head: '#8a4a3a' },
    behavior: { boss: true, bossClass: 'mini', knockback: 140, boneBreaker: true,
      phases: [{ at: 0.4, speedMult: 1.5, dmgMult: 1.2, msg: 'The Butcher goes berserk!' }] },
    voice: 'roar',
    desc: 'A cleaver-handed monster that gets faster as it bleeds. A frequent, brutal mini boss.',
  },
  behemoth: {
    id: 'behemoth', name: 'Behemoth', tier: 4, weight: 3,
    radius: 34, bodyH: 66, hp: 1050, walk: 40, chase: 105, damage: 48,
    attackRange: 54, attackCd: 1.4, detect: 500, lose: 800, xp: 160, headMult: 1.3,
    palette: { body: '#4a4a5c', light: '#6a6a80', dark: '#2c2c3a', head: '#5a5a6c' },
    behavior: { knockback: 200, boss: true, bossClass: 'district', boneBreaker: true,
      slam: { radius: 170, damage: 40, cd: 6, windup: 0.8, knockback: 260 },
      phases: [{ at: 0.5, speedMult: 1.25, dmgMult: 1.25, msg: 'The Behemoth roars — the ground shakes harder!' }] },
    voice: 'roar',
    desc: 'Armour-plated hulk that pounds the ground, shattering everything in a ring around it.',
  },
  matriarch: {
    id: 'matriarch', name: 'Matriarch', tier: 4, weight: 3,
    radius: 30, bodyH: 58, hp: 820, walk: 36, chase: 92, damage: 34,
    attackRange: 48, attackCd: 1.4, detect: 520, lose: 820, xp: 150, headMult: 1.5,
    palette: { body: '#7a5a6a', light: '#a07a90', dark: '#4c3742', head: '#8a6a7a' },
    behavior: { boss: true, bossClass: 'district', summon: { type: 'crawler', count: 4, cd: 11 },
      phases: [{ at: 0.5, dmgMult: 1.2, msg: 'The Matriarch tears herself open — the brood pours out!', unlock: { summon: { type: 'runner', count: 3, cd: 8 } } }] },
    voice: 'shriek',
    desc: 'A birthing horror. Tears open its own flesh to spill fresh crawlers at its feet.',
  },
  titan: {
    id: 'titan', name: 'Titan', tier: 5, weight: 3,
    radius: 38, bodyH: 74, hp: 1500, walk: 38, chase: 98, damage: 62,
    attackRange: 58, attackCd: 1.5, detect: 520, lose: 820, xp: 200, headMult: 1.3,
    palette: { body: '#6a2a2a', light: '#953b3b', dark: '#411818', head: '#7a3030' },
    behavior: { knockback: 230, boss: true, bossClass: 'district', boneBreaker: true,
      phases: [{ at: 0.5, speedMult: 1.3, dmgMult: 1.2, msg: 'The Titan ENRAGES!', unlock: { slam: { radius: 190, damage: 50, cd: 7, windup: 0.8, knockback: 280 } } }] },
    voice: 'roar',
    desc: 'A district-ending abomination. Colossal health and devastating sweeps.',
  },
  plaguelord: {
    id: 'plaguelord', name: 'Irradiated Plaguelord', tier: 6, weight: 2,
    radius: 34, bodyH: 68, hp: 1300, walk: 36, chase: 90, damage: 44,
    attackRange: 52, attackCd: 1.5, detect: 540, lose: 860, xp: 240, headMult: 1.3,
    palette: { body: '#3f7a3f', light: '#5aa85a', dark: '#254a25', head: '#4a8a4a' },
    behavior: { boss: true, bossClass: 'district', aura: { radius: 200, dps: 6 },
      acid: { range: 300, arc: Math.PI * 0.6, windup: 1.0, damage: 24, cd: 6, pools: 5, poolR: 44, poolTtl: 8 },
      irradiatedSkin: true,
      phases: [{ at: 0.5, msg: 'The Plaguelord\'s glow intensifies!', unlock: { aura: { radius: 260, dps: 9 } } }] },
    voice: 'gurgle',
    desc: 'A walking reactor of rot. Its very presence burns; its bile blinds. The deep city\'s king.',
  },
  devourer: {
    id: 'devourer', name: 'The Devourer', tier: 6, weight: 0,   // world boss — timer-spawned only
    radius: 44, bodyH: 86, hp: 4200, walk: 34, chase: 96, damage: 70,
    attackRange: 64, attackCd: 1.6, detect: 640, lose: 1100, xp: 600, headMult: 1.25,
    palette: { body: '#3a2a3e', light: '#5c4462', dark: '#221826', head: '#4a3650' },
    behavior: { boss: true, bossClass: 'world', knockback: 260, boneBreaker: true,
      slam: { radius: 200, damage: 55, cd: 7, windup: 0.9, knockback: 300 },
      phases: [
        { at: 0.66, msg: 'The Devourer calls its brood!', unlock: { summon: { type: 'runner', count: 4, cd: 10 } } },
        { at: 0.33, speedMult: 1.35, dmgMult: 1.3, msg: 'THE DEVOURER ENRAGES!', unlock: { aura: { radius: 220, dps: 7 } } },
      ] },
    voice: 'roar',
    desc: 'A city-wide legend. When the sirens sound its name, every survivor chooses: run, or make history.',
  },
};

/* ---------------- Elite variant system ---------------- */
const ELITE_VARIANTS = {
  special: {
    id: 'special', prefix: 'Rabid', tint: '#c9c0b0', eyes: '#ff3030', glow: 0x992222,
    hpMult: 1.7, dmgMult: 1.35, speedMult: 1.18, xpMult: 2.4, lootTable: 'elite',
  },
  irradiated: {
    id: 'irradiated', prefix: 'Irradiated', tint: '#5adf5a', eyes: '#aaff40', glow: 0x2f9f2f,
    hpMult: 2.6, dmgMult: 1.7, speedMult: 1.1, xpMult: 4.5, lootTable: 'irradiated',
    aura: { radius: 90, dps: 2.5 },
  },
};

// Roll a variant for one spawn instance. Returns null (regular) most of the time.
function rollVariant(district) {
  const v = CONFIG.variants;
  const t = Math.max(0, (district || 1) - 1);
  if (Utils.chance(v.irradiatedChance + t * 0.004)) return 'irradiated';
  if (Utils.chance(v.specialChance + t * 0.01)) return 'special';
  return null;
}

// Build a derived cfg for a variant of a base enemy type (memoised).
const _variantCfgCache = {};
function variantCfg(typeId, variantId) {
  const key = typeId + ':' + variantId;
  if (_variantCfgCache[key]) return _variantCfgCache[key];
  const base = ENEMIES[typeId] || ENEMIES.walker;
  const v = ELITE_VARIANTS[variantId];
  if (!v) return base;
  const cfg = Object.assign({}, base, {
    name: v.prefix + ' ' + base.name,
    hp: Math.round(base.hp * v.hpMult),
    damage: Math.round(base.damage * v.dmgMult),
    walk: Math.round(base.walk * v.speedMult),
    chase: Math.round(base.chase * v.speedMult),
    xp: Math.round(base.xp * v.xpMult),
    variant: variantId,
    palette: Object.assign({}, base.palette),
    behavior: Object.assign({}, base.behavior || {}),
  });
  if (v.aura && !cfg.behavior.aura) cfg.behavior.aura = v.aura;
  cfg.behavior.lootable = true;   // elite corpses can be harvested
  _variantCfgCache[key] = cfg;
  return cfg;
}

// Weighted pick of a NON-BOSS enemy available at or below `district` (1-6).
function rollEnemyType(district, night = false) {
  const pool = Object.values(ENEMIES).filter(e =>
    e.tier <= district && !(e.behavior && e.behavior.boss) && (!e.nightOnly || night));
  const entries = pool.map(e => ({ id: e.id, w: e.weight }));
  return Utils.weighted(entries).id;
}

// Pick a spawnable boss for a district (mini + district classes; world bosses
// are timer-spawned events, never random).
function rollBossType(district) {
  const pool = Object.values(ENEMIES).filter(e =>
    e.tier <= district && e.behavior && e.behavior.boss && e.weight > 0 &&
    e.behavior.bossClass !== 'world');
  if (!pool.length) return null;
  return Utils.weighted(pool.map(e => ({ id: e.id, w: e.weight }))).id;
}
