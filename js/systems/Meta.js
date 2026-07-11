/* Meta systems: lifetime Analytics, Achievements, and the simulated global
 * Marketplace. All single-player — the "other survivors" are a simulation.
 */

/* ---------------- Analytics: lifetime progress tracking ---------------- */
class Analytics {
  constructor() {
    this.counters = {
      kills: 0, mutantKills: 0, bossKills: 0, worldBossKills: 0, eliteKills: 0,
      deaths: 0, looted: 0, harvests: 0, creditsEarned: 0, creditsSpent: 0,
      missionsCompleted: 0, shotsFired: 0, headshots: 0, itemsSold: 0, itemsBought: 0,
      cachesFound: 0,
    };
    this.byWeapon = {};     // archetype -> kills
    this.byDistrict = {};   // district -> kills
    this.maxDistrict = 1;
  }
  shot(w) { this.counters.shotsFired++; }
  kill(z, weaponArchetype, district, headshot) {
    const c = this.counters;
    c.kills++;
    if (headshot) c.headshots++;
    if (z.cfg.mutant) c.mutantKills++;
    if (z.cfg.behavior && z.cfg.behavior.boss) {
      c.bossKills++;
      if (z.cfg.behavior.bossClass === 'world') c.worldBossKills++;
    }
    if (z.variant) c.eliteKills++;
    if (weaponArchetype) this.byWeapon[weaponArchetype] = (this.byWeapon[weaponArchetype] || 0) + 1;
    if (district) this.byDistrict[district] = (this.byDistrict[district] || 0) + 1;
  }
  serialize() { return { counters: this.counters, byWeapon: this.byWeapon, byDistrict: this.byDistrict, maxDistrict: this.maxDistrict }; }
  load(d) {
    if (!d) return;
    Object.assign(this.counters, d.counters || {});
    this.byWeapon = d.byWeapon || {};
    this.byDistrict = d.byDistrict || {};
    this.maxDistrict = d.maxDistrict || 1;
  }
}

/* ---------------- Achievements ---------------- */
const ACHIEVEMENTS = {
  first_blood:   { name: 'First Blood',      icon: '🩸', desc: 'Kill your first zombie.',            cond: (a, g) => a.counters.kills >= 1 },
  zombie_hunter: { name: 'Zombie Hunter',    icon: '⚔',  desc: 'Kill 100 infected.',                 cond: (a) => a.counters.kills >= 100 },
  zombie_slayer: { name: 'Zombie Slayer',    icon: '🗡',  desc: 'Kill 500 infected.',                 cond: (a) => a.counters.kills >= 500 },
  mutant_bane:   { name: 'Mutant Bane',      icon: '🧬', desc: 'Kill 25 mutants.',                   cond: (a) => a.counters.mutantKills >= 25 },
  boss_slayer:   { name: 'Boss Slayer',      icon: '☠',  desc: 'Kill 5 boss-class monsters.',        cond: (a) => a.counters.bossKills >= 5 },
  world_ender:   { name: 'Legend Killer',    icon: '🌟', desc: 'Bring down a world boss.',           cond: (a) => a.counters.worldBossKills >= 1 },
  headhunter:    { name: 'Headhunter',       icon: '🎯', desc: 'Land 100 headshot kills.',           cond: (a) => a.counters.headshots >= 100 },
  wealthy:       { name: 'Wealthy Survivor', icon: '💰', desc: 'Earn 5,000 credits in total.',       cond: (a) => a.counters.creditsEarned >= 5000 },
  hoarder:       { name: 'Hoarder',          icon: '📦', desc: 'Search 100 containers.',             cond: (a) => a.counters.looted >= 100 },
  field_surgeon: { name: 'Field Surgeon',    icon: '🧪', desc: 'Harvest 20 elite corpses.',          cond: (a) => a.counters.harvests >= 20 },
  deep_walker:   { name: 'Deep Walker',      icon: '🧭', desc: 'Set foot in District 5.',            cond: (a) => a.maxDistrict >= 5 },
  ground_zero:   { name: 'Ground Zero',      icon: '☢',  desc: 'Set foot in District 6.',            cond: (a) => a.maxDistrict >= 6 },
  contractor:    { name: 'Contractor',       icon: '📋', desc: 'Complete 10 missions.',              cond: (a) => a.counters.missionsCompleted >= 10 },
  storyteller:   { name: 'Signal Silenced',  icon: '📖', desc: 'Complete the Ravenside Signal chain.', cond: (a, g) => g.missions && g.missions.chainStage >= STORY_CHAIN.length },
  survivor_10:   { name: 'Veteran',          icon: '🎖', desc: 'Reach level 10.',                    cond: (a, g) => g.player.level >= 10 },
  cache_hunter:  { name: 'Cache Hunter',     icon: '✨', desc: 'Find a hidden cache.',               cond: (a) => a.counters.cachesFound >= 1 },
};

class Achievements {
  constructor(game) {
    this.game = game;
    this.unlocked = [];
  }
  check() {
    const a = this.game.analytics;
    for (const [id, def] of Object.entries(ACHIEVEMENTS)) {
      if (this.unlocked.includes(id)) continue;
      let ok = false;
      try { ok = def.cond(a, this.game); } catch (e) { }
      if (ok) this._unlock(id, def);
    }
  }
  _unlock(id, def) {
    this.unlocked.push(id);
    this.game.ui.toast(`🏆 ACHIEVEMENT: ${def.icon} ${def.name} — ${def.desc}`);
    if (this.game.audio) this.game.audio.levelUp();
  }
  serialize() { return this.unlocked.slice(); }
  load(d) { if (Array.isArray(d)) this.unlocked = d; }
}

/* ---------------- Marketplace: simulated survivor economy ---------------- */
const MARKET_SELLERS = ['HollowPoint', 'xXReaperXx', 'SallyM', 'Trigger_Happy', 'DocBones',
  'Rustbucket', 'NightOwl', 'BigSarge', 'Milkman', 'Karen_1975', 'GraveyardShift',
  'Padre', 'TwoShoes', 'Vulture', 'MissMaple', 'Junkrat_Jim', 'ColdIron', 'Beans'];

function marketCategoryOf(item) {
  if (!item) return 'special';
  if (item.type === 'weapon') return 'weapons';
  if (item.type === 'ammo') return 'ammo';
  if (item.type === 'armor') return 'armour';
  if (item.type === 'consumable') return item.use && item.use.health ? 'medical' : 'consumables';
  if (item.type === 'material') return 'materials';
  return 'special';
}

const MARKET_CATEGORY_LIST = [
  { id: 'all',         name: 'All',         icon: '🌐' },
  { id: 'weapons',     name: 'Weapons',     icon: '🔫' },
  { id: 'ammo',        name: 'Ammunition',  icon: '•' },
  { id: 'armour',      name: 'Armour',      icon: '🦺' },
  { id: 'medical',     name: 'Medical',     icon: '✚' },
  { id: 'consumables', name: 'Consumables', icon: '🥤' },
  { id: 'materials',   name: 'Materials',   icon: '⚙' },
  { id: 'special',     name: 'Special',     icon: '✨' },
];

class MarketSystem {
  constructor(game) {
    this.game = game;
    this.listings = [];        // simulated survivor listings
    this.playerListings = [];  // items the player has posted
    this.drift = {};           // itemId -> price drift multiplier (random walk)
    this.restockTimer = 5;     // first fill happens fast
    this.sellTimer = CONFIG.market.sellTickSeconds;
    this._fill(CONFIG.market.listingCount);
  }

  _sellableIds() {
    if (this._pool) return this._pool;
    this._pool = Object.keys(ITEMS).filter(id => {
      const it = ITEMS[id];
      if (!it || it.type === 'quest' || it.type === 'collectible') return false;
      const w = it.weaponId ? WEAPONS[it.weaponId] : null;
      if (w && w.unique) return false;   // signature weapons never hit the market
      return true;
    });
    return this._pool;
  }

  _driftOf(id) {
    if (this.drift[id] == null) this.drift[id] = Utils.rand(0.85, 1.15);
    return this.drift[id];
  }

  _makeListing() {
    const pool = this._sellableIds();
    const lvl = this.game.player ? this.game.player.level : 1;
    for (let tries = 0; tries < 20; tries++) {
      const id = Utils.pick(pool);
      const it = ITEMS[id];
      // bias against very high rarity at low level, but never hard-lock it
      const rarityIdx = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4 }[it.rarity] || 0;
      if (rarityIdx > 1 + Math.floor(lvl / 4) && Math.random() < 0.7) continue;
      const qty = it.stack > 1 ? Utils.randInt(1, Math.min(it.stack, it.type === 'ammo' ? 60 : 4)) : 1;
      const unit = Math.max(2, Math.round(it.value * 1.5 * this._driftOf(id) * Utils.rand(0.85, 1.25)));
      return {
        id: Utils.uid(), itemId: id, qty, unit, price: unit * qty,
        seller: Utils.pick(MARKET_SELLERS),
        listedAt: Date.now(),
      };
    }
    return null;
  }

  _fill(n) {
    for (let i = 0; i < n; i++) {
      const l = this._makeListing();
      if (l) this.listings.push(l);
    }
  }

  update(dt) {
    // periodic restock: a few listings sell to "other survivors", new ones appear
    this.restockTimer -= dt;
    if (this.restockTimer <= 0) {
      this.restockTimer = CONFIG.market.restockSeconds;
      const churn = Utils.randInt(3, 7);
      for (let i = 0; i < churn && this.listings.length > 8; i++) {
        this.listings.splice(Utils.randInt(0, this.listings.length - 1), 1);
      }
      this._fill(Math.max(0, CONFIG.market.listingCount - this.listings.length));
      // prices drift like a real market
      for (const id of Object.keys(this.drift)) {
        this.drift[id] = Utils.clamp(this.drift[id] * Utils.rand(0.96, 1.05), 0.6, 1.7);
      }
    }
    // player listings sell over time
    this.sellTimer -= dt;
    if (this.sellTimer <= 0) {
      this.sellTimer = CONFIG.market.sellTickSeconds;
      for (const l of this.playerListings.slice()) {
        if (Utils.chance(CONFIG.market.sellChance)) this._sellPlayerListing(l);
      }
    }
  }

  _sellPlayerListing(l) {
    this.playerListings = this.playerListings.filter(x => x.id !== l.id);
    const fee = Math.ceil(l.price * (CONFIG.market.listingFee || 0.05));
    const net = l.price - fee;
    this.game.player.currency += net;
    if (this.game.analytics) {
      this.game.analytics.counters.creditsEarned += net;
      this.game.analytics.counters.itemsSold++;
    }
    this.game.ui.toast(`💰 SOLD: ${l.qty}x ${ITEMS[l.itemId].name} → +${net}¢ (${Utils.pick(MARKET_SELLERS)} bought it)`);
    if (this.game.audio) this.game.audio.reload();
    if (this.game.achievements) this.game.achievements.check();
  }

  buy(listingId) {
    const l = this.listings.find(x => x.id === listingId);
    if (!l) return { ok: false, msg: 'Listing gone — someone beat you to it' };
    const p = this.game.player;
    if (p.currency < l.price) return { ok: false, msg: `Need ${l.price}¢` };
    const leftover = this.game.inventory.add(l.itemId, l.qty);
    if (leftover >= l.qty) return { ok: false, msg: 'Inventory full' };
    const got = l.qty - leftover;
    const paid = Math.round(l.unit * got);
    p.currency -= paid;
    if (this.game.analytics) {
      this.game.analytics.counters.creditsSpent += paid;
      this.game.analytics.counters.itemsBought++;
    }
    this.listings = this.listings.filter(x => x.id !== listingId);
    if (leftover > 0) this.listings.push({ ...l, id: Utils.uid(), qty: leftover, price: l.unit * leftover });
    return { ok: true, msg: `Bought ${got}x ${ITEMS[l.itemId].name} (-${paid}¢)` };
  }

  // List a whole inventory slot for sale at a fair asking price.
  listFromSlot(slotIndex) {
    const inv = this.game.inventory;
    const slot = inv.slots[slotIndex];
    if (!slot) return { ok: false, msg: 'Empty slot' };
    const it = ITEMS[slot.id];
    if (!it) return { ok: false, msg: 'Unknown item' };
    if (it.type === 'quest') return { ok: false, msg: 'Mission items cannot be sold' };
    if (this.playerListings.length >= 8) return { ok: false, msg: 'You already have 8 listings' };
    const qty = slot.qty;
    const unit = Math.max(1, Math.round(it.value * 1.35 * this._driftOf(slot.id)));
    inv.removeSlot(slotIndex, qty);
    const l = { id: Utils.uid(), itemId: slot.id, qty, unit, price: unit * qty, listedAt: Date.now() };
    this.playerListings.push(l);
    return { ok: true, msg: `Listed ${qty}x ${it.name} at ${l.price}¢` };
  }

  cancelListing(id) {
    const l = this.playerListings.find(x => x.id === id);
    if (!l) return;
    const leftover = this.game.inventory.add(l.itemId, l.qty);
    if (leftover > 0) { this.game.ui.toast('No bag space — listing stays up'); return; }
    this.playerListings = this.playerListings.filter(x => x.id !== id);
    this.game.ui.toast(`Listing cancelled: ${ITEMS[l.itemId].name}`);
  }

  // ▲▼ indicator vs. base value
  trendOf(itemId) {
    const d = this._driftOf(itemId);
    return d > 1.06 ? 'up' : d < 0.94 ? 'down' : 'flat';
  }

  serialize() {
    return { playerListings: this.playerListings, drift: this.drift };
  }
  load(d) {
    if (!d) return;
    if (Array.isArray(d.playerListings)) this.playerListings = d.playerListings.filter(l => ITEMS[l.itemId]);
    if (d.drift) this.drift = d.drift;
  }
}
