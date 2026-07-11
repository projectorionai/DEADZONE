/* Loot containers + scene object manager (spawn, nearest, serialize). */

class SceneObjects {
  constructor(scene) {
    this.scene = scene;
    this.containers = [];
  }

  add(c) { this.containers.push(c); }

  nearest(px, py, range) {
    let best = null, bestD = range;
    for (const c of this.containers) {
      if (c.looted) continue;
      const d = Utils.dist(px, py, c.cx, c.cy);
      if (d < bestD) { bestD = d; best = c; }
    }
    return best;
  }

  update(dt) { for (const c of this.containers) c.update(dt); }

  collect(list, cam) {
    for (const c of this.containers) {
      if (cam.visible(c.cx, c.cy)) c.collect(list);
    }
  }

  serialize() {
    return this.containers.map(c => ({
      id: c.id, type: c.type, x: c.x, y: c.y, looted: !!c.looted,
    }));
  }

  load(data) {
    if (!data) return;
    const map = new Map(this.containers.map(c => [c.id, c]));
    for (const d of data) {
      const c = map.get(d.id);
      if (c) c.looted = !!d.looted;
    }
  }

  static populateOverworld(scene) {
    const om = new SceneObjects(scene);
    const types = ['car', 'crate', 'cabinet', 'locker', 'fridge', 'medbox', 'ammobox', 'register', 'desk'];
    let placed = 0;
    for (let attempt = 0; attempt < 900 && placed < 52; attempt++) {
      const p = scene.randomStreetPoint(scene.w / 2, scene.h / 2, 200);
      if (scene.inSafeZone(p.x, p.y, 180)) continue;
      const type = Utils.pick(types);
      if (SceneObjects.overlaps(om, scene, p.x, p.y, CONTAINER_DEFS[type])) continue;
      om.add(new LootContainer(Utils.uid(), type, p.x - CONTAINER_DEFS[type].w / 2, p.y - CONTAINER_DEFS[type].h / 2));
      placed++;
    }
    return om;
  }

  // True if a container of `def` centred at (cx,cy) would overlap an existing
  // container or a building/wall solid.
  static overlaps(om, scene, cx, cy, def) {
    const half = Math.max(def.w, def.h) / 2 + 16;
    for (const c of om.containers) {
      const gap = half + Math.max(c.w, c.h) / 2 + 14;
      if (Utils.dist(cx, cy, c.cx, c.cy) < gap) return true;
    }
    if (scene.solids) {
      for (const s of scene.solids) {
        if (cx + half > s.x && cx - half < s.x + s.w && cy + half > s.y && cy - half < s.y + s.h) return true;
      }
    }
    return false;
  }
}

/* Container type definitions + the isometric LootContainer prop itself. */
const CONTAINER_DEFS = {
  cache:    { w: 46, h: 40, height: 30, top: '#c9a13a', loot: 'cache',   glyph: '✨', glow: true },
  car:      { w: 78, h: 44, height: 30, top: '#7a4b3a', loot: 'car',     glyph: '🚗' },
  crate:    { w: 42, h: 42, height: 34, top: '#8a6a34', loot: 'crate',   glyph: '📦' },
  cabinet:  { w: 38, h: 30, height: 52, top: '#4a5a5f', loot: 'cabinet', glyph: '🗄' },
  locker:   { w: 34, h: 28, height: 56, top: '#556070', loot: 'locker',  glyph: '🔐' },
  fridge:   { w: 40, h: 34, height: 54, top: '#8790a0', loot: 'fridge',  glyph: '🧊' },
  medbox:   { w: 40, h: 32, height: 30, top: '#b04a4a', loot: 'medbox',  glyph: '✚' },
  ammobox:  { w: 44, h: 34, height: 24, top: '#6a6030', loot: 'ammobox', glyph: '🔫' },
  register: { w: 40, h: 30, height: 34, top: '#c0a040', loot: 'register',glyph: '💵' },
  desk:     { w: 60, h: 40, height: 30, top: '#6a5238', loot: 'cabinet', glyph: '🗃' },
};

class LootContainer {
  constructor(id, type, x, y) {
    this.id = id;
    this.type = type;
    const d = CONTAINER_DEFS[type] || CONTAINER_DEFS.crate;
    this.def = d;
    this.x = x; this.y = y;
    this.w = d.w; this.h = d.h; this.height = d.height;
    this.looted = false;
    this.flash = 0;
    this.bob = Utils.rand(0, Math.PI * 2);
  }
  get cx() { return this.x + this.w / 2; }
  get cy() { return this.y + this.h / 2; }
  get lootTable() { return this.def.loot; }

  update(dt) { if (this.flash > 0) this.flash -= dt; this.bob += dt * 3; }

  collect(list) {
    list.add(Iso.depth(this.cx, this.cy), (ctx) => this.render(ctx));
  }

  render(ctx) {
    const d = this.def;
    const base = this.looted ? Iso.shade(d.top, 0.55) : d.top;
    Iso.shadow(ctx, this.cx, this.cy, this.w * 0.02 + 0.4, 0);
    Iso.box(ctx, this.x, this.y, this.w, this.h, this.height, {
      top: this.looted ? Iso.shade(base, 1.0) : Iso.shade(base, 1.15),
      left: Iso.shade(base, 0.6),
      right: Iso.shade(base, 0.85),
    }, { edge: 'rgba(0,0,0,0.35)' });

    if (!this.looted) {
      const p = Iso.toScreen(this.cx, this.cy, this.height + 16 + Math.sin(this.bob) * 3);
      ctx.fillStyle = 'rgba(255,214,90,0.95)';
      ctx.font = 'bold 16px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.fillText('?', p.x, p.y);
      ctx.textAlign = 'left';
    }
    if (this.flash > 0) {
      const p = Iso.toScreen(this.cx, this.cy, this.height / 2);
      ctx.globalAlpha = Utils.clamp(this.flash * 3, 0, 1);
      ctx.fillStyle = '#8fe6a8';
      ctx.beginPath(); ctx.arc(p.x, p.y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
  }
}
