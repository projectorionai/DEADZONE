/* LocalStorage save/load with rolling backups.
 * Serializes player, inventory, storage, trader, containers, missions,
 * marketplace, achievements and lifetime analytics.
 * Every save rotates the previous snapshot into _bak1 -> _bak2 so a corrupted
 * write can always be recovered from.
 */
const SaveSystem = {
  save(game) {
    try {
      const data = {
        version: CONFIG.version,
        savedAt: Date.now(),
        player: game.player.serialize(),
        inventory: game.inventory.serialize(),
        storage: game.storage.serialize(),
        trader: game.trader.serialize(),
        containers: game.overworld.objects.serialize(),
        stats: { kills: game.stats.kills, looted: game.stats.looted, playtime: game.stats.playtime, headshots: game.stats.headshots, bossKills: game.stats.bossKills },
        missions: game.missions ? game.missions.serialize() : null,
        market: game.market ? game.market.serialize() : null,
        achievements: game.achievements ? game.achievements.serialize() : null,
        analytics: game.analytics ? game.analytics.serialize() : null,
        dayTime: game.dayTime,
      };
      const json = JSON.stringify(data);
      // rotate backups: current -> bak1 -> bak2
      const cur = localStorage.getItem(CONFIG.saveKey);
      if (cur) {
        const bak1 = localStorage.getItem(CONFIG.saveKey + '_bak1');
        if (bak1) localStorage.setItem(CONFIG.saveKey + '_bak2', bak1);
        localStorage.setItem(CONFIG.saveKey + '_bak1', cur);
      }
      localStorage.setItem(CONFIG.saveKey, json);
      return true;
    } catch (e) {
      console.error('Save failed', e);
      return false;
    }
  },

  hasSave() { return !!localStorage.getItem(CONFIG.saveKey); },

  load(game) {
    // try main save, then backups
    for (const key of [CONFIG.saveKey, CONFIG.saveKey + '_bak1', CONFIG.saveKey + '_bak2']) {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const d = JSON.parse(raw);
        game.player.load(d.player);
        game.inventory.load(d.inventory);
        game.storage.load(d.storage);
        game.trader.load(d.trader);
        game.overworld.objects.load(d.containers);
        if (d.stats) Object.assign(game.stats, d.stats);
        if (d.missions && game.missions) game.missions.load(d.missions);
        if (d.market && game.market) game.market.load(d.market);
        if (d.achievements && game.achievements) game.achievements.load(d.achievements);
        if (d.analytics && game.analytics) game.analytics.load(d.analytics);
        if (typeof d.dayTime === 'number') game.dayTime = d.dayTime;
        if (key !== CONFIG.saveKey) console.warn('Recovered from backup save:', key);
        return true;
      } catch (e) {
        console.error('Load failed from', key, e);
      }
    }
    return false;
  },

  clear() {
    localStorage.removeItem(CONFIG.saveKey);
    localStorage.removeItem(CONFIG.saveKey + '_bak1');
    localStorage.removeItem(CONFIG.saveKey + '_bak2');
  },
};
