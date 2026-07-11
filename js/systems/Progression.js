/* Progression helpers. Core leveling lives on Player; this exposes shared
 * curve math and XP source values so tuning stays in one place.
 */
const Progression = {
  xpForLevel(level) {
    return Math.round(CONFIG.progression.xpBase * Math.pow(CONFIG.progression.xpGrowth, level - 1));
  },
  // XP awards for different actions
  xp: {
    zombieKill: CONFIG.zombie.xpReward,
    headshotBonus: 6,
    lootContainer: 8,
    exploreNewArea: 25,
  },
};
