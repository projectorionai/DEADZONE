/* MissionSystem — event-driven mission engine.
 * Up to CONFIG.missions.maxActive missions run in parallel. The board offers
 * level-scaled contracts + the current story-chain stage; dailies refresh
 * every real-world day. Progress comes from Game event hooks:
 *   onKill(zombie, headshot) / onLoot() / onItemGained(id, qty)
 *   onEnterBuilding(tag) / onDistrict(district) / onHarvest()
 */
class MissionSystem {
  constructor(game) {
    this.game = game;
    this.active = [];          // accepted missions (max CONFIG.missions.maxActive)
    this.board = [];           // available offers
    this.dailies = [];         // today's daily missions (accept like any other)
    this.dailyDate = '';       // YYYY-MM-DD of the current daily set
    this.completedCount = 0;
    this.chainStage = 0;       // index into STORY_CHAIN; >= length = chain done
    this.refreshBoard();
    this._refreshDailies();
  }

  get maxActive() { return (CONFIG.missions && CONFIG.missions.maxActive) || 3; }

  _lvl() { return this.game.player ? this.game.player.level : 1; }

  _instantiate(fields, isStory = false, stageIdx = 0) {
    const m = Object.assign({ id: Utils.uid(), progress: 0, progress2: 0, done: false }, fields);
    if (isStory) { m.category = 'story'; m.story = true; m.stage = stageIdx; m.stars = Math.min(5, 2 + stageIdx); }
    return m;
  }

  refreshBoard() {
    this.board = [];
    // Story stage always leads the board until the chain is finished.
    if (this.chainStage < STORY_CHAIN.length &&
        !this.active.some(m => m.story)) {
      this.board.push(this._instantiate(STORY_CHAIN[this.chainStage], true, this.chainStage));
    }
    const size = (CONFIG.missions && CONFIG.missions.boardSize) || 6;
    const lvl = this._lvl();
    const pool = MISSION_TEMPLATES.slice();
    while (this.board.length < size && pool.length) {
      const idx = Utils.randInt(0, pool.length - 1);
      this.board.push(this._instantiate(pool.splice(idx, 1)[0](lvl)));
    }
  }

  _refreshDailies() {
    const today = new Date().toISOString().slice(0, 10);
    if (this.dailyDate === today && this.dailies.length) return;
    this.dailyDate = today;
    const lvl = this._lvl();
    const pool = DAILY_TEMPLATES.slice();
    this.dailies = [];
    const n = (CONFIG.missions && CONFIG.missions.dailyCount) || 3;
    for (let i = 0; i < n && pool.length; i++) {
      const idx = Utils.randInt(0, pool.length - 1);
      this.dailies.push(this._instantiate(pool.splice(idx, 1)[0](lvl)));
    }
  }

  accept(id) {
    if (this.active.length >= this.maxActive) {
      this.game.ui.toast(`Mission log full (${this.maxActive}) — finish or abandon one first`);
      return false;
    }
    const fromBoard = this.board.find(x => x.id === id);
    const fromDaily = this.dailies.find(x => x.id === id);
    const m = fromBoard || fromDaily;
    if (!m || m.accepted) return false;
    m.accepted = true;
    m.progress = 0; m.progress2 = 0;
    this.active.push(m);
    this.board = this.board.filter(x => x.id !== id);
    this.dailies = this.dailies.filter(x => x.id !== id);
    this.game.ui.toast(`Mission accepted: ${m.title}`);
    if (this.game.audio) this.game.audio.reload();
    if (this.game.ui.refreshMissions) this.game.ui.refreshMissions();
    return true;
  }

  abandon(id) {
    const m = this.active.find(x => x.id === id);
    if (!m) return;
    this.active = this.active.filter(x => x.id !== id);
    // story stages return to the board so the chain is never lost
    if (m.story) this.refreshBoard();
    this.game.ui.toast(`Mission abandoned: ${m.title}`);
    if (this.game.ui.refreshMissions) this.game.ui.refreshMissions();
  }

  /* ---------------- Event hooks (called by Game) ---------------- */
  _bump(m, obj, progKey, n = 1) {
    m[progKey] = Math.min(obj.count || 1, (m[progKey] || 0) + n);
  }

  _matchKill(filter, z, headshot) {
    const b = z.cfg.behavior || {};
    switch (filter) {
      case 'any': return true;
      case 'headshot': return !!headshot;
      case 'mutant': return !!z.cfg.mutant;
      case 'boss': return !!b.boss;
      default: return z.type === filter;
    }
  }

  onKill(z, headshot) {
    for (const m of this.active) {
      for (const [obj, key] of this._objectives(m)) {
        if (obj.kind === 'kill' && this._matchKill(obj.filter, z, headshot)) this._bump(m, obj, key);
      }
    }
    this._checkCompletions();
  }

  onLoot() {
    for (const m of this.active) {
      for (const [obj, key] of this._objectives(m)) {
        if (obj.kind === 'loot') this._bump(m, obj, key);
      }
    }
    this._checkCompletions();
  }

  onHarvest() {
    for (const m of this.active) {
      for (const [obj, key] of this._objectives(m)) {
        if (obj.kind === 'harvest') this._bump(m, obj, key);
      }
    }
    this._checkCompletions();
  }

  onItemGained(itemId, qty) {
    for (const m of this.active) {
      for (const [obj, key] of this._objectives(m)) {
        if (obj.kind === 'recover' && obj.item === itemId) this._bump(m, obj, key, qty);
      }
    }
    this._checkCompletions();
  }

  onEnterBuilding(tag) {
    for (const m of this.active) {
      for (const [obj, key] of this._objectives(m)) {
        if (obj.kind === 'explore' && obj.tags && obj.tags.includes(tag)) this._bump(m, { count: 1 }, key);
      }
    }
    this._checkCompletions();
  }

  onDistrict(district) {
    for (const m of this.active) {
      for (const [obj, key] of this._objectives(m)) {
        if (obj.kind === 'explore' && obj.district && district >= obj.district) this._bump(m, { count: 1 }, key);
      }
    }
    this._checkCompletions();
  }

  // [ [objective, progressKey], [andObjective, 'progress2'] ]
  _objectives(m) {
    const list = [[m.objective, 'progress']];
    if (m.objective.and) list.push([m.objective.and, 'progress2']);
    return list;
  }

  _target(obj) { return obj.count || 1; }

  isComplete(m) {
    const p1 = (m.progress || 0) >= this._target(m.objective);
    const p2 = !m.objective.and || (m.progress2 || 0) >= this._target(m.objective.and);
    return p1 && p2;
  }

  _checkCompletions() {
    for (const m of this.active.slice()) {
      if (!m.done && this.isComplete(m)) this._complete(m);
    }
  }

  _complete(m) {
    m.done = true;
    this.active = this.active.filter(x => x.id !== m.id);
    const g = this.game, r = m.reward || {};

    // recovery missions hand the items over
    for (const [obj] of this._objectives(m)) {
      if (obj.kind === 'recover' && obj.item) g.inventory.remove(obj.item, this._target(obj));
    }

    const parts = [];
    if (r.credits) { g.player.currency += r.credits; g.credits = (g.credits || 0) + r.credits; parts.push(`+${r.credits}¢`); }
    if (r.xp) { g.player.addXP(r.xp, g); parts.push(`+${r.xp}xp`); }
    for (const it of (r.items || [])) {
      if (ITEMS[it.id]) { g.inventory.add(it.id, it.qty); parts.push(`${it.qty}x ${ITEMS[it.id].name}`); }
    }
    if (r.weaponRarity) {
      const id = rollWeaponItemId(r.weaponRarity);
      if (id) { g.inventory.add(id, 1); parts.push(ITEMS[id].name); }
    }
    if (r.armorRarity) {
      const id = rollArmorItemId(r.armorRarity);
      if (id) { g.inventory.add(id, 1); parts.push(ITEMS[id].name); }
    }

    this.completedCount++;
    if (g.analytics) g.analytics.counters.missionsCompleted++;
    g.ui.toast(`✔ MISSION COMPLETE: ${m.title}  (${parts.join(', ')})`);
    if (g.audio) g.audio.levelUp();
    if (g.achievements) g.achievements.check();

    if (m.story) {
      this.chainStage = Math.max(this.chainStage, (m.stage || 0) + 1);
      if (m.lore) setTimeout(() => g.ui.toast('📖 ' + m.lore), 2800);
      if (this.chainStage >= STORY_CHAIN.length) {
        setTimeout(() => g.ui.toast('🏆 THE RAVENSIDE SIGNAL — chain complete. Old Glory is yours.'), 5600);
      }
    }
    this.refreshBoard();
    if (g.ui.refreshMissions) g.ui.refreshMissions();
    if (g.ui.updateHUD) g.ui.updateHUD();
    SaveSystem.save(g);
  }

  update(dt) {
    this._refreshDailies();
  }

  // World-space objective markers for the minimap + screen-edge arrows.
  // explore-tags -> nearest matching enterable building; explore-district ->
  // a point on that district's boundary in the player's outward direction.
  getMarkers() {
    const g = this.game;
    if (!g.overworld || g.scene !== g.overworld) return [];
    const out = [];
    const rz = g.overworld.outposts && g.overworld.outposts[0] && g.overworld.outposts[0].zone;
    for (const m of this.active) {
      for (const [obj] of this._objectives(m)) {
        if (obj.kind !== 'explore') continue;
        if (obj.tags) {
          let best = null, bestD = Infinity;
          for (const b of g.overworld.enterables) {
            if (!obj.tags.includes(b.tag)) continue;
            const d = Utils.dist(g.player.x, g.player.y, b.door.cx, b.door.cy);
            if (d < bestD) { bestD = d; best = b; }
          }
          if (best) out.push({ x: best.door.cx, y: best.door.cy, label: m.title, color: '#5a9ac9' });
        } else if (obj.district && rz) {
          const cx = rz.x + rz.w / 2, cy = rz.y + rz.h / 2;
          const distNeeded = (CONFIG.districts[obj.district - 2] || {}).maxDist || 900;
          let a = Utils.angle(cx, cy, g.player.x, g.player.y);
          if (!isFinite(a)) a = -Math.PI / 4;
          const px = Utils.clamp(cx + Math.cos(a) * (distNeeded + 150), 200, g.overworld.w - 200);
          const py = Utils.clamp(cy + Math.sin(a) * (distNeeded + 150), 200, g.overworld.h - 200);
          out.push({ x: px, y: py, label: m.title, color: '#e0954a' });
        }
      }
    }
    return out;
  }

  serialize() {
    return {
      active: this.active, board: this.board, dailies: this.dailies,
      dailyDate: this.dailyDate, completedCount: this.completedCount,
      chainStage: this.chainStage,
    };
  }
  load(d) {
    if (!d) return;
    this.completedCount = d.completedCount || 0;
    this.chainStage = d.chainStage || 0;
    this.dailyDate = d.dailyDate || '';
    if (Array.isArray(d.active)) this.active = d.active.filter(m => m && m.objective);
    if (Array.isArray(d.board) && d.board.length) this.board = d.board.filter(m => m && m.objective);
    else this.refreshBoard();
    if (Array.isArray(d.dailies)) this.dailies = d.dailies.filter(m => m && m.objective);
    this._refreshDailies();
  }
}
