/* Encumbrance System: Weight penalties
 * - Weight affects movement speed (linear penalty)
 * - Weight affects stamina drain rate (exponential penalty at high loads)
 * - Over-capacity prevents sprinting
 * 
 * Calculation:
 *   speedMult = max(0.3, 1.0 - (currentWeight - maxWeight) * 0.008)
 *   staminaDrainMult = 1.0 + max(0, currentWeight - maxWeight) * 0.02
 */

const Encumbrance = {
  // Calculate movement speed multiplier based on current weight
  getSpeedMultiplier(currentWeight, maxWeight) {
    if (currentWeight <= maxWeight) return 1.0;
    const overweight = currentWeight - maxWeight;
    // -0.5% speed per kg over capacity, minimum 30% speed
    const mult = 1.0 - (overweight * 0.005);
    return Math.max(0.3, mult);
  },

  // Calculate stamina drain multiplier based on weight
  getStaminaDrainMultiplier(currentWeight, maxWeight) {
    if (currentWeight <= maxWeight) return 1.0;
    const overweight = currentWeight - maxWeight;
    // Stamina drain increases by 2% per kg over capacity
    return 1.0 + (overweight * 0.02);
  },

  // Check if player can sprint (must not be severely over-encumbered)
  canSprint(currentWeight, maxWeight) {
    // Can't sprint if over 110% of capacity
    return currentWeight <= maxWeight * 1.1;
  },

  // Get weight ratio for UI display (0.0 - 2.0+)
  getWeightRatio(currentWeight, maxWeight) {
    return currentWeight / maxWeight;
  },

  // Check if over-encumbered (over capacity)
  isOverEncumbered(currentWeight, maxWeight) {
    return currentWeight > maxWeight;
  },

  // Get remaining carry weight
  getRemainingCapacity(currentWeight, maxWeight) {
    return Math.max(0, maxWeight - currentWeight);
  },

  // Format weight for display
  formatWeight(kg) {
    return kg.toFixed(1) + ' kg';
  },
};

/* Weight tracking structure (added to Player) */
class WeightTracker {
  constructor(maxWeight = 40) {
    this.maxWeight = maxWeight;
    this.items = 0; // Total item weight from inventory
    this.armor = 0; // Armor weight
    this.weapons = 0; // Currently equipped weapons weight
  }

  getTotalWeight() {
    return this.items + this.armor + this.weapons;
  }

  getMaxWeight() {
    return this.maxWeight;
  }

  updateFromInventory(inventory) {
    // Recalculate total item weight from inventory
    this.items = 0;
    if (!inventory || !inventory.items) return;
    for (const item of inventory.items) {
      const def = getItem(item.id);
      if (def) {
        this.items += def.weight * item.qty;
      }
    }
  }

  updateFromArmor(armor) {
    // Recalculate armor weight across every equipment slot
    this.armor = 0;
    if (!armor) return;
    const slots = (typeof ARMOR_SLOTS !== 'undefined') ? ARMOR_SLOTS : ['head', 'chest', 'legs'];
    for (const s of slots) {
      if (armor[s] && armor[s] instanceof ArmorInstance) this.armor += armor[s].def.weight;
    }
  }

  updateFromWeapons(mainWeapon, secondaryWeapon) {
    // Recalculate weapon weight
    this.weapons = 0;
    if (mainWeapon) {
      const itemDef = getItem(mainWeapon.itemId);
      if (itemDef) this.weapons += itemDef.weight;
    }
    if (secondaryWeapon) {
      const itemDef = getItem(secondaryWeapon.itemId);
      if (itemDef) this.weapons += itemDef.weight;
    }
  }

  getSpeedMultiplier() {
    return Encumbrance.getSpeedMultiplier(this.getTotalWeight(), this.maxWeight);
  }

  getStaminaDrainMultiplier() {
    return Encumbrance.getStaminaDrainMultiplier(this.getTotalWeight(), this.maxWeight);
  }

  canSprint() {
    return Encumbrance.canSprint(this.getTotalWeight(), this.maxWeight);
  }

  serialize() {
    return {
      maxWeight: this.maxWeight,
    };
  }

  static deserialize(data) {
    const wt = new WeightTracker(data.maxWeight || 40);
    return wt;
  }
}
