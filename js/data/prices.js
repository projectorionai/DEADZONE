/* Trader price configuration.
 * buyMult: player pays base value * buyMult when buying from trader.
 * sellMult: player receives base value * sellMult when selling.
 * stock: what the trader offers for purchase.
 */
const PRICES = {
  buyMult: 1.8,
  sellMult: 0.55,

  // Items the trader sells (id + optional restock quantity, -1 = infinite)
  stock: [
    { id: 'ammo_9mm',    qty: -1 },
    { id: 'ammo_45',     qty: -1 },
    { id: 'ammo_shells', qty: 40 },
    { id: 'ammo_556',    qty: 60 },
    { id: 'ammo_308',    qty: 30 },
    { id: 'bandage',     qty: -1 },
    { id: 'medkit',      qty: 12 },
    { id: 'antiviral_spores', qty: 4 },
    { id: 'food_can',    qty: -1 },
    { id: 'water_bottle',qty: -1 },
    { id: 'pistol_9mm',  qty: 3 },
    { id: 'bat',         qty: 5 },
    { id: 'leather_vest', qty: 3 },
    { id: 'reinforced_boots', qty: 3 },
  ],
};

function buyPrice(id) {
  const it = ITEMS[id]; if (!it) return 0;
  return Math.max(1, Math.round(it.value * PRICES.buyMult));
}
function sellPrice(id) {
  const it = ITEMS[id]; if (!it) return 0;
  return Math.max(1, Math.round(it.value * PRICES.sellMult));
}
