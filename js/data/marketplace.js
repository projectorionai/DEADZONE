/* Marketplace system: categorized trader UI with dynamic stock
 * Organizes items into tabs: Weapons, Ammo, Food, Medicine, Armor, Materials
 */

const MARKET_CATEGORIES = {
  WEAPONS: 'weapons',
  AMMO: 'ammo',
  FOOD: 'food',
  MEDICINE: 'medicine',
  ARMOR: 'armor',
  MATERIALS: 'materials',
};

const MARKETPLACE_STOCK = {
  [MARKET_CATEGORIES.WEAPONS]: [
    // Starter/low tier
    { id: 'pistol_9mm', rarity: 'uncommon', minLevel: 1, weight: 2 },
    { id: 'bat', rarity: 'common', minLevel: 1, weight: 3 },
    { id: 'combatknife', rarity: 'common', minLevel: 1, weight: 1 },
    { id: 'crowbar_i', rarity: 'common', minLevel: 1, weight: 1 },
    { id: 'wrench_i', rarity: 'common', minLevel: 3, weight: 1 },

    // Mid tier
    { id: 'revolver_45', rarity: 'uncommon', minLevel: 8, weight: 1 },
    { id: 'machete_i', rarity: 'common', minLevel: 5, weight: 1 },
    { id: 'sledge_i', rarity: 'uncommon', minLevel: 10, weight: 1 },
    { id: 'fireaxe_i', rarity: 'uncommon', minLevel: 12, weight: 1 },
    { id: 'huntingrifle_308', rarity: 'uncommon', minLevel: 15, weight: 2 },

    // High tier
    { id: 'smg_mp40', rarity: 'rare', minLevel: 20, weight: 2 },
    { id: 'sawnoff_12g', rarity: 'rare', minLevel: 18, weight: 2 },
    { id: 'pump_12g', rarity: 'rare', minLevel: 22, weight: 2 },
    { id: 'ar15_556', rarity: 'rare', minLevel: 25, weight: 2 },

    // Legendary
    { id: 'minigun_item', rarity: 'epic', minLevel: 30, weight: 3 },
  ],

  [MARKET_CATEGORIES.AMMO]: [
    { id: 'ammo_9mm', rarity: 'common', minLevel: 1, weight: 0.5 },
    { id: 'ammo_45', rarity: 'common', minLevel: 8, weight: 0.5 },
    { id: 'ammo_308', rarity: 'common', minLevel: 15, weight: 0.5 },
    { id: 'ammo_shells', rarity: 'common', minLevel: 18, weight: 0.75 },
    { id: 'ammo_556', rarity: 'common', minLevel: 25, weight: 0.5 },
  ],

  [MARKET_CATEGORIES.FOOD]: [
    { id: 'food_can', rarity: 'common', minLevel: 1, weight: 0.5 },
    { id: 'water_bottle', rarity: 'common', minLevel: 1, weight: 0.5 },
  ],

  [MARKET_CATEGORIES.MEDICINE]: [
    { id: 'bandage', rarity: 'common', minLevel: 1, weight: 0.5 },
    { id: 'medkit', rarity: 'uncommon', minLevel: 5, weight: 1 },
  ],

  [MARKET_CATEGORIES.ARMOR]: [
    { id: 'leather_vest', rarity: 'common', minLevel: 1, weight: 1 },
    { id: 'ballistic_helmet', rarity: 'uncommon', minLevel: 3, weight: 0.5 },
    { id: 'reinforced_boots', rarity: 'common', minLevel: 1, weight: 0.5 },
    { id: 'tactical_rig', rarity: 'uncommon', minLevel: 10, weight: 1 },
    { id: 'kevlar_vest', rarity: 'rare', minLevel: 20, weight: 1.5 },
    { id: 'combat_exoskeleton', rarity: 'epic', minLevel: 30, weight: 2 },
  ],

  [MARKET_CATEGORIES.MATERIALS]: [
    { id: 'scrap', rarity: 'common', minLevel: 1, weight: 0.5 },
    { id: 'cloth', rarity: 'common', minLevel: 1, weight: 0.5 },
    { id: 'electronics', rarity: 'uncommon', minLevel: 5, weight: 0.5 },
  ],
};

/* Generate marketplace stock based on player level */
function generateMarketplaceStock(playerLevel) {
  const stock = {};

  for (const [category, items] of Object.entries(MARKETPLACE_STOCK)) {
    stock[category] = [];

    for (const item of items) {
      // Only show items at or below player level
      if (item.minLevel > playerLevel) continue;

      // Small chance to NOT show some items (adds variety)
      if (Math.random() < 0.15) continue;

      stock[category].push({
        itemId: item.id,
        rarity: item.rarity,
        qty: Infinity, // Trader has unlimited for now
        weight: item.weight,
      });
    }

    // Ensure at least 2 items per category if available
    if (stock[category].length === 0 && items.length > 0) {
      const fallback = items.filter(i => i.minLevel <= playerLevel)[0];
      if (fallback) {
        stock[category].push({
          itemId: fallback.id,
          rarity: fallback.rarity,
          qty: Infinity,
          weight: fallback.weight,
        });
      }
    }
  }

  return stock;
}

/* Marketplace instance (per game session) */
class Marketplace {
  constructor(playerLevel) {
    this.stock = generateMarketplaceStock(playerLevel);
    this.playerLevel = playerLevel;
    this.lastRestockTime = Date.now();
    this.hagglerMultiplier = 1.0; // Modified by scavenger class
  }

  getCategory(category) {
    return this.stock[category] || [];
  }

  getAllItems() {
    const all = [];
    for (const items of Object.values(this.stock)) {
      all.push(...items);
    }
    return all;
  }

  getItemPrice(itemId, isBuying = true) {
    const base = isBuying ? buyPrice(itemId) : sellPrice(itemId);
    return Math.round(base * this.hagglerMultiplier);
  }

  setHagglerMultiplier(mult) {
    this.hagglerMultiplier = mult; // Scavenger class: 0.85
  }

  canBuy(itemId, playerCredits) {
    const price = this.getItemPrice(itemId, true);
    return playerCredits >= price;
  }

  // For simplified trader: always has stock
  hasStock(itemId) {
    return this.getAllItems().some(i => i.itemId === itemId);
  }

  // Upgrade stock when player levels up
  upgrade(newLevel) {
    if (newLevel > this.playerLevel) {
      this.playerLevel = newLevel;
      this.stock = generateMarketplaceStock(newLevel);
    }
  }

  serialize() {
    return {
      playerLevel: this.playerLevel,
      hagglerMultiplier: this.hagglerMultiplier,
    };
  }

  static deserialize(data) {
    const m = new Marketplace(data.playerLevel || 1);
    m.hagglerMultiplier = data.hagglerMultiplier || 1.0;
    return m;
  }
}

/* UI Helper: render marketplace (would be called from your UI framework) */
class MarketplaceUI {
  constructor(marketplace, game) {
    this.marketplace = marketplace;
    this.game = game;
    this.selectedCategory = MARKET_CATEGORIES.WEAPONS;
  }

  selectCategory(category) {
    if (Object.values(MARKET_CATEGORIES).includes(category)) {
      this.selectedCategory = category;
    }
  }

  getDisplayItems() {
    const items = this.marketplace.getCategory(this.selectedCategory);
    return items.map(item => {
      const itemDef = getItem(item.itemId);
      const price = this.marketplace.getItemPrice(item.itemId, true);
      const canAfford = this.game.player.credits >= price;
      return {
        itemId: item.itemId,
        name: itemDef ? itemDef.name : 'Unknown',
        rarity: item.rarity,
        price,
        canAfford,
        icon: itemDef ? itemDef.glyph : '?',
        description: itemDef ? itemDef.description : '',
      };
    });
  }

  buyItem(itemId, qty = 1) {
    const price = this.marketplace.getItemPrice(itemId, true);
    const totalCost = price * qty;

    if (this.game.player.credits < totalCost) {
      return { success: false, reason: 'Not enough credits' };
    }

    const itemDef = getItem(itemId);
    if (!itemDef) {
      return { success: false, reason: 'Item not found' };
    }

    // Check weight
    const totalWeight = itemDef.weight * qty;
    if (this.game.player.weight.getRemainingCapacity() < totalWeight) {
      return { success: false, reason: 'Too heavy' };
    }

    // Apply transaction
    this.game.player.credits -= totalCost;
    this.game.inventory.add(itemId, qty);

    return { success: true };
  }

  sellItem(itemId, qty = 1) {
    if (!this.game.inventory.has(itemId, qty)) {
      return { success: false, reason: 'Not enough items' };
    }

    const price = this.marketplace.getItemPrice(itemId, false);
    const totalValue = price * qty;

    this.game.inventory.remove(itemId, qty);
    this.game.player.credits += totalValue;

    return { success: true, value: totalValue };
  }
}
