const UPGRADES = {
  guardBarracks: {
    id: 'guardBarracks',
    name: 'Guard Barracks',
    description: 'Train 2 additional guards. Increases outpost defense.',
    cost: 150,
    maxLevel: 3,
    effect: { guardCount: 2 },
  },
  wallReinforcement: {
    id: 'wallReinforcement',
    name: 'Wall Reinforcement',
    description: 'Strengthen outpost walls. Zombies deal 15% less damage.',
    cost: 100,
    maxLevel: 2,
    effect: { damageReduc: 0.15 },
  },
  medicalLab: {
    id: 'medicalLab',
    name: 'Medical Lab Upgrade',
    description: 'Improve healing station. Heal 20 HP more per visit.',
    cost: 120,
    maxLevel: 2,
    effect: { healthBonus: 20 },
  },
  researchLab: {
    id: 'researchLab',
    name: 'Research Lab',
    description: 'Unlock +5% weapon damage and +10% survival loot.',
    cost: 180,
    maxLevel: 1,
    effect: { damageMult: 1.05, lootMult: 1.1 },
  },
  armory: {
    id: 'armory',
    name: 'Armory Expansion',
    description: 'Access rare weapons. +2 rare weapon find chance.',
    cost: 140,
    maxLevel: 2,
    effect: { rareWeaponBonus: 0.02 },
  },
};

function getUpgrade(id) {
  return UPGRADES[id] || null;
}

function canAffordUpgrade(game, upgradeId) {
  const upg = getUpgrade(upgradeId);
  if (!upg) return false;
  return game.credits >= upg.cost;
}
