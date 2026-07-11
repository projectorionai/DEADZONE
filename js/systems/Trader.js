/* Trader: buy from stock, sell from inventory. Prices from prices.js tables. */
class Trader {
  constructor() {
    // Clone stock so quantities can deplete during a session.
    this.stock = PRICES.stock.map(s => ({ id: s.id, qty: s.qty }));
  }

  buy(game, id) {
    const entry = this.stock.find(s => s.id === id);
    if (!entry) return { ok: false, msg: 'Not in stock' };
    if (entry.qty === 0) return { ok: false, msg: 'Out of stock' };
    const price = buyPrice(id);
    if (game.player.currency < price) return { ok: false, msg: 'Not enough credits' };
    if (!game.inventory.hasSpaceFor(id, 1)) return { ok: false, msg: 'Inventory full' };
    game.player.currency -= price;
    game.inventory.add(id, 1);
    if (entry.qty > 0) entry.qty--;
    // Picking up the pistol from trader flags it usable
    if (ITEMS[id].weaponId === 'pistol') game.player.hasPistol = true;
    return { ok: true, msg: `Bought ${ITEMS[id].name} (-${price})` };
  }

  sell(game, slotIndex) {
    const slot = game.inventory.slots[slotIndex];
    if (!slot) return { ok: false, msg: 'Empty slot' };
    const price = sellPrice(slot.id);
    game.inventory.removeSlot(slotIndex, 1);
    game.player.currency += price;
    return { ok: true, msg: `Sold ${ITEMS[slot.id].name} (+${price})` };
  }

  sellAllJunk(game) {
    // Sell all materials for quick cash
    const junk = ['scrap', 'cloth', 'electronics'];
    let total = 0, n = 0;
    for (let i = 0; i < game.inventory.slots.length; i++) {
      const s = game.inventory.slots[i];
      if (s && junk.includes(s.id)) {
        total += sellPrice(s.id) * s.qty; n += s.qty;
        game.inventory.slots[i] = null;
      }
    }
    game.player.currency += total;
    return { ok: n > 0, msg: n > 0 ? `Sold ${n} materials (+${total})` : 'No materials to sell' };
  }

  serialize() { return this.stock.map(s => ({ id: s.id, qty: s.qty })); }
  load(data) { if (Array.isArray(data)) this.stock = data.map(s => ({ ...s })); }
}
