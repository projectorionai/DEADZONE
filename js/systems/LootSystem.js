const LootSystem = {
  // Roll a table. `tier` = district 1-6; higher districts bump gear rarity and
  // reduce the chance of empty containers (risk pays).
  roll(tableType, lootBonus = 0, tier = 1) {
    const t = LOOT_TABLES[tableType];
    if (!t) return [];
    const D = CONFIG.districts[Math.min(5, Math.max(0, tier - 1))] || {};
    const [minRolls, maxRolls] = t.rolls;
    let rolls = Utils.randInt(minRolls, maxRolls);
    // Scarcity: some containers are simply cleaned out (less so in D1 & deep city).
    const emptyChance = (CONFIG.loot.emptyContainerChance || 0) - lootBonus * 0.5 - (D.lootBump || 0) * 0.3;
    if (emptyChance > 0 && Utils.chance(emptyChance)) {
      rolls = Math.min(rolls, minRolls);
    }
    const out = {};
    for (let i = 0; i < rolls; i++) {
      const e = Utils.weighted(t.table);
      if (!e.id) continue;   // empty hands
      // 'weapon_drop' / 'armor_drop' tokens: resolve to a catalogue piece.
      if (e.id === 'weapon_drop' || e.id === 'armor_drop') {
        const rarity = this.bumpRarity(e.rarity || 'common', tier);
        const id = e.id === 'weapon_drop' ? rollWeaponItemId(rarity) : rollArmorItemId(rarity);
        if (id && ITEMS[id]) out[id] = (out[id] || 0) + 1;
        continue;
      }
      let qty = Utils.randInt(e.min, e.max);
      if (lootBonus > 0 && Utils.chance(lootBonus)) qty += 1;
      out[e.id] = (out[e.id] || 0) + qty;
    }
    return Object.entries(out).map(([id, qty]) => ({ id, qty }));
  },

  // Deep-city containers hold better gear: each district's lootBump is the
  // chance of +1 rarity (Ground Zero can even double-bump).
  bumpRarity(rarity, tier) {
    const order = ['common', 'uncommon', 'rare', 'epic', 'legendary'];
    const D = CONFIG.districts[Math.min(5, Math.max(0, tier - 1))] || {};
    let idx = Math.max(0, order.indexOf(rarity));
    if (Utils.chance(D.lootBump || 0)) idx = Math.min(4, idx + 1);
    if (tier >= 6 && Utils.chance(0.2)) idx = Math.min(4, idx + 1);
    return order[idx];
  },

  rollRareWeapon() {
    const weaponTypes = ['pistol', 'melee'];
    const baseType = weaponTypes[Utils.randInt(0, weaponTypes.length - 1)];
    const rarities = ['rare', 'epic', 'legendary'];
    const rarity = rarities[Utils.randInt(0, rarities.length - 1)];
    return generateWeaponItem(baseType, rarity);
  },

  getRarityTier(rarity) {
    const tiers = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 };
    return tiers[rarity] || 0;
  },
};
