/* Mission data — categories, templates, the Ravenside story chain and dailies.
 * Objective kinds the engine understands:
 *   kill    { count, filter: 'any'|'mutant'|'boss'|'headshot'|<typeId> }
 *   explore { tags: [building tags] }  or  { district: n }
 *   recover { item: <itemId>, count }   (items are handed over on completion)
 *   harvest { count }                   (elite/boss corpses harvested)
 *   loot    { count }                   (containers searched)
 * A mission may carry `and: {objective}` for two-part objectives.
 * Rewards: credits, xp, items[], weaponRarity/armorRarity (rolls the catalogue).
 * `stars` = difficulty rating shown on the board.
 */

const MISSION_CATEGORIES = {
  elimination: { name: 'Elimination', icon: '⚔', color: '#e0604a' },
  exploration: { name: 'Exploration', icon: '🧭', color: '#5a9ac9' },
  recovery:    { name: 'Recovery',    icon: '📦', color: '#c9a13a' },
  boss:        { name: 'Boss Hunt',   icon: '☠', color: '#c03a5a' },
  story:       { name: 'Story',       icon: '📖', color: '#a07ad0' },
  daily:       { name: 'Daily',       icon: '📅', color: '#6ad06a' },
};

/* Level-scaled repeatable templates. fn(lvl) -> mission fields. */
const MISSION_TEMPLATES = [
  // ---- Elimination (bread and butter, fast and well paid) ----
  (lvl) => ({ category: 'elimination', stars: 1, title: 'Thin the Herd',
    desc: `Put down ${10 + lvl * 2} infected. Any district, any method.`,
    objective: { kind: 'kill', filter: 'any', count: 10 + lvl * 2 },
    reward: { credits: 140 + lvl * 30, xp: 70 + lvl * 16 } }),
  (lvl) => ({ category: 'elimination', stars: 2, title: 'Walker Cull',
    desc: `The fringe is clogging up again. Drop ${12 + lvl * 2} Walkers.`,
    objective: { kind: 'kill', filter: 'walker', count: 12 + lvl * 2 },
    reward: { credits: 160 + lvl * 30, xp: 80 + lvl * 16, items: [{ id: 'ammo_9mm', qty: 24 }] } }),
  (lvl) => ({ category: 'elimination', stars: 2, title: 'Marksman Contract',
    desc: `Prove your aim: ${6 + lvl} headshot kills.`,
    objective: { kind: 'kill', filter: 'headshot', count: 6 + lvl },
    reward: { credits: 200 + lvl * 34, xp: 110 + lvl * 18 } }),
  (lvl) => ({ category: 'elimination', stars: 3, title: 'Mutant Purge',
    desc: `Mutants are breeding past District 3. Destroy ${3 + Math.floor(lvl / 2)} of them.`,
    objective: { kind: 'kill', filter: 'mutant', count: 3 + Math.floor(lvl / 2) },
    reward: { credits: 320 + lvl * 45, xp: 180 + lvl * 25, weaponRarity: 'uncommon' } }),

  // ---- Exploration ----
  (lvl) => ({ category: 'exploration', stars: 1, title: 'Supply Sweep',
    desc: 'Sweep any pharmacy or hospital for the medics.',
    objective: { kind: 'explore', tags: ['pharmacy', 'hospital'] },
    reward: { credits: 120 + lvl * 20, xp: 60 + lvl * 12, items: [{ id: 'bandage', qty: 3 }] } }),
  (lvl) => ({ category: 'exploration', stars: 2, title: 'Case the Blocks',
    desc: 'Scout a police station or gun store — we need to know what\'s left.',
    objective: { kind: 'explore', tags: ['police', 'gunstore'] },
    reward: { credits: 180 + lvl * 24, xp: 90 + lvl * 14, items: [{ id: 'ammo_9mm', qty: 16 }] } }),
  (lvl) => ({ category: 'exploration', stars: 3, title: 'Push the Line',
    desc: 'Reach District 3 — Craven Heights — and come back breathing.',
    objective: { kind: 'explore', district: 3 },
    reward: { credits: 260 + lvl * 30, xp: 150 + lvl * 20 } }),
  (lvl) => ({ category: 'exploration', stars: 4, title: 'Deep Recon',
    desc: 'Cross into District 4. The Union District doesn\'t forgive mistakes.',
    objective: { kind: 'explore', district: 4 },
    reward: { credits: 420 + lvl * 40, xp: 240 + lvl * 26, armorRarity: 'rare' } }),

  // ---- Recovery ----
  (lvl) => ({ category: 'recovery', stars: 2, title: 'Medical Run',
    desc: `The clinic is dry. Recover ${2 + Math.floor(lvl / 3)} Medical Supplies from containers.`,
    objective: { kind: 'recover', item: 'medical_supplies', count: 2 + Math.floor(lvl / 3) },
    reward: { credits: 240 + lvl * 30, xp: 120 + lvl * 16, items: [{ id: 'medkit', qty: 1 }] } }),
  (lvl) => ({ category: 'recovery', stars: 3, title: 'Paper Trail',
    desc: 'Military documents are worth blood. Recover 1 set from lockers or ammo caches.',
    objective: { kind: 'recover', item: 'military_docs', count: 1 },
    reward: { credits: 380 + lvl * 40, xp: 200 + lvl * 22, weaponRarity: 'rare' } }),
  (lvl) => ({ category: 'recovery', stars: 2, title: 'Remember the Fallen',
    desc: `Collect ${2 + Math.floor(lvl / 4)} Lost Dog Tags from the dead.`,
    objective: { kind: 'recover', item: 'lost_dogtags', count: 2 + Math.floor(lvl / 4) },
    reward: { credits: 220 + lvl * 26, xp: 110 + lvl * 15 } }),
  (lvl) => ({ category: 'recovery', stars: 3, title: 'Field Autopsy',
    desc: `Harvest ${2 + Math.floor(lvl / 4)} elite corpses. The lab needs samples.`,
    objective: { kind: 'harvest', count: 2 + Math.floor(lvl / 4) },
    reward: { credits: 300 + lvl * 36, xp: 170 + lvl * 20, items: [{ id: 'antiviral_spores', qty: 1 }] } }),

  // ---- Boss hunts ----
  (lvl) => ({ category: 'boss', stars: 4, title: 'Bounty: Abomination',
    desc: 'Any boss-class monster. Bring proof it\'s dead.',
    objective: { kind: 'kill', filter: 'boss', count: 1 },
    reward: { credits: 600 + lvl * 70, xp: 320 + lvl * 36, weaponRarity: 'rare', armorRarity: 'rare' } }),
  (lvl) => ({ category: 'boss', stars: 5, title: 'Bounty: The Butcher',
    desc: 'The Butcher has been seen in Craven Heights. End it.',
    objective: { kind: 'kill', filter: 'butcher', count: 1 },
    reward: { credits: 800 + lvl * 80, xp: 420 + lvl * 40, weaponRarity: 'epic' } }),
];

/* Daily missions — quick, generous, refresh every real day. */
const DAILY_TEMPLATES = [
  (lvl) => ({ category: 'daily', stars: 1, title: 'Daily: Street Sweep',
    desc: `Kill ${8 + lvl} infected today.`,
    objective: { kind: 'kill', filter: 'any', count: 8 + lvl },
    reward: { credits: 180 + lvl * 24, xp: 90 + lvl * 14, items: [{ id: 'bandage', qty: 2 }] } }),
  (lvl) => ({ category: 'daily', stars: 1, title: 'Daily: Forage',
    desc: 'Search 5 loot containers.',
    objective: { kind: 'loot', count: 5 },
    reward: { credits: 160 + lvl * 20, xp: 80 + lvl * 12, items: [{ id: 'food_can', qty: 2 }] } }),
  (lvl) => ({ category: 'daily', stars: 2, title: 'Daily: Sharpshooter',
    desc: `Land ${4 + Math.floor(lvl / 2)} headshot kills.`,
    objective: { kind: 'kill', filter: 'headshot', count: 4 + Math.floor(lvl / 2) },
    reward: { credits: 220 + lvl * 26, xp: 120 + lvl * 16, items: [{ id: 'energy_drink', qty: 2 }] } }),
  (lvl) => ({ category: 'daily', stars: 2, title: 'Daily: Mutant Watch',
    desc: 'Kill 2 mutants.',
    objective: { kind: 'kill', filter: 'mutant', count: 2 },
    reward: { credits: 260 + lvl * 30, xp: 150 + lvl * 18 } }),
];

/* THE RAVENSIDE SIGNAL — five-stage story chain with a signature reward. */
const STORY_CHAIN = [
  { title: 'The Ravenside Signal I: Static',
    desc: 'A looping broadcast is coming from inside the city. Sweep the hospital — the last transmission mentioned casualties heading there.',
    objective: { kind: 'explore', tags: ['hospital'] },
    reward: { credits: 250, xp: 150 },
    lore: 'The broadcast repeats: "...alive at St. Mercy... don\'t trust the wards..."' },
  { title: 'The Ravenside Signal II: The Journal',
    desc: 'Survivors left notes behind. Recover a Survivor\'s Journal from any container.',
    objective: { kind: 'recover', item: 'survivor_journal', count: 1 },
    reward: { credits: 350, xp: 220, items: [{ id: 'medkit', qty: 2 }] },
    lore: 'The journal\'s last page: "The radio tower. They went to the radio tower."' },
  { title: 'The Ravenside Signal III: Dead Air',
    desc: 'Reach the Radio Station and find what\'s left of the broadcast crew.',
    objective: { kind: 'explore', tags: ['radio'] },
    reward: { credits: 450, xp: 300, armorRarity: 'rare' },
    lore: 'The studio is torn apart. Something with too many arms nested here.' },
  { title: 'The Ravenside Signal IV: The Nest',
    desc: 'Mutants took the crew. Exterminate 6 mutants and recover 2 Radio Components so the outpost can trace the source.',
    objective: { kind: 'kill', filter: 'mutant', count: 6, and: { kind: 'recover', item: 'radio_parts', count: 2 } },
    reward: { credits: 650, xp: 420, weaponRarity: 'epic' },
    lore: 'The trace resolves: the signal isn\'t a survivor. It\'s bait. And its keeper is close.' },
  { title: 'The Ravenside Signal V: The Keeper',
    desc: 'A boss-class horror guards the signal. Kill it and end the broadcast for good.',
    objective: { kind: 'kill', filter: 'boss', count: 1 },
    reward: { credits: 1200, xp: 800, items: [{ id: 'w_old_glory', qty: 1 }, { id: 'ravenside_medal', qty: 1 }] },
    lore: 'The static dies. For the first time since the fall, Ravenside\'s airwaves are quiet.' },
];
