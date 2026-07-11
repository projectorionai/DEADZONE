/* Building interior instance — separate scene with walls, loot, and infected.
 * Every entry generates a NEW layout (Dead Frontier style), and every building
 * tag has a THEME: the props, rooms, containers and floor all match the sign
 * on the door — beds in the hospital, pews in the church, aisles in the market.
 */

const INTERIOR_THEMES = {
  hospital: {
    floor: '#3c4448', props: [
      { kind: 'bed', w: 46, h: 90, height: 22, color: '#b8c0c8', layout: 'walls', count: [8, 12], noBullet: true },
      { kind: 'gurney', w: 40, h: 80, height: 24, color: '#8a9298', layout: 'scatter', count: [2, 4], noBullet: true },
      { kind: 'ivstand', w: 12, h: 12, height: 52, color: '#c0c8d0', layout: 'scatter', count: [4, 7] },
      { kind: 'counter', w: 160, h: 40, height: 34, color: '#5a7a86', layout: 'scatter', count: [1, 2] },
    ],
    containers: ['medbox', 'medbox', 'cabinet'], rooms: [3, 5],
  },
  pharmacy: {
    floor: '#3a453e', props: [
      { kind: 'shelf', w: 30, h: 150, height: 40, color: '#4f7a68', layout: 'aisles', count: [4, 6] },
      { kind: 'counter', w: 180, h: 40, height: 34, color: '#6a8a7a', layout: 'south', count: [1, 1] },
    ],
    containers: ['medbox', 'cabinet'], rooms: [1, 2],
  },
  supermarket: {
    floor: '#40443c', props: [
      { kind: 'shelf', w: 34, h: 190, height: 42, color: '#6a7a4e', layout: 'aisles', count: [5, 8] },
      { kind: 'freezer', w: 120, h: 44, height: 30, color: '#7a90a0', layout: 'walls', count: [3, 5], noBullet: true },
      { kind: 'checkout', w: 60, h: 34, height: 26, color: '#8a8060', layout: 'south', count: [2, 4], noBullet: true },
    ],
    containers: ['fridge', 'fridge', 'register', 'crate'], rooms: [1, 2],
  },
  gunstore: {
    floor: '#3c3a36', props: [
      { kind: 'gunrack', w: 26, h: 120, height: 46, color: '#6a5038', layout: 'walls', count: [4, 7] },
      { kind: 'counter', w: 200, h: 44, height: 36, color: '#54483a', layout: 'south', count: [1, 1] },
      { kind: 'case', w: 70, h: 40, height: 26, color: '#5c5648', layout: 'scatter', count: [2, 4], noBullet: true },
    ],
    containers: ['ammobox', 'ammobox', 'locker'], rooms: [1, 2],
  },
  hardware: {
    floor: '#413c34', props: [
      { kind: 'shelf', w: 32, h: 160, height: 44, color: '#7a6238', layout: 'aisles', count: [4, 6] },
      { kind: 'lumber', w: 120, h: 34, height: 20, color: '#8a7248', layout: 'scatter', count: [2, 4], noBullet: true },
    ],
    containers: ['crate', 'crate', 'locker'], rooms: [1, 2],
  },
  warehouse: {
    floor: '#37393c', props: [
      { kind: 'rack', w: 44, h: 220, height: 60, color: '#5f5a48', layout: 'aisles', count: [4, 7] },
      { kind: 'pallet', w: 60, h: 60, height: 26, color: '#6a5a3a', layout: 'scatter', count: [4, 8], noBullet: true },
      { kind: 'forklift', w: 44, h: 80, height: 34, color: '#8a7a2a', layout: 'scatter', count: [1, 2] },
    ],
    containers: ['crate', 'crate', 'crate', 'ammobox'], rooms: [2, 4],
  },
  police: {
    floor: '#363c44', props: [
      { kind: 'cell', w: 26, h: 110, height: 50, color: '#5a6470', layout: 'walls', count: [4, 6] },
      { kind: 'desk', w: 80, h: 44, height: 28, color: '#4e565e', layout: 'grid', count: [4, 6], noBullet: true },
      { kind: 'lockerbank', w: 30, h: 100, height: 52, color: '#48525c', layout: 'walls', count: [2, 4] },
    ],
    containers: ['locker', 'locker', 'ammobox', 'cabinet'], rooms: [3, 5],
  },
  office: {
    floor: '#3a3e44', props: [
      { kind: 'desk', w: 76, h: 44, height: 28, color: '#565e66', layout: 'grid', count: [8, 14], noBullet: true },
      { kind: 'copier', w: 40, h: 34, height: 34, color: '#6e7076', layout: 'walls', count: [1, 3] },
      { kind: 'plant', w: 18, h: 18, height: 30, color: '#3f6a44', layout: 'scatter', count: [2, 4] },
    ],
    containers: ['desk', 'desk', 'cabinet'], rooms: [3, 6],
  },
  bank: {
    floor: '#403e38', props: [
      { kind: 'counter', w: 240, h: 40, height: 36, color: '#7a7060', layout: 'south', count: [1, 1] },
      { kind: 'desk', w: 76, h: 44, height: 28, color: '#5e584e', layout: 'grid', count: [3, 5], noBullet: true },
      { kind: 'vault', w: 140, h: 120, height: 58, color: '#6a6a72', layout: 'north', count: [1, 1] },
    ],
    containers: ['register', 'register', 'locker'], rooms: [2, 3],
  },
  church: {
    floor: '#3b3830', props: [
      { kind: 'pew', w: 130, h: 26, height: 18, color: '#6a5236', layout: 'pews', count: [8, 12], noBullet: true },
      { kind: 'altar', w: 110, h: 50, height: 32, color: '#8a7a5a', layout: 'north', count: [1, 1] },
      { kind: 'candle', w: 12, h: 12, height: 34, color: '#c0aa70', layout: 'scatter', count: [3, 5], emissive: '#e8a040' },
    ],
    containers: ['cabinet', 'cabinet'], rooms: [1, 2],
  },
  school: {
    floor: '#3d4038', props: [
      { kind: 'schooldesk', w: 44, h: 34, height: 22, color: '#6e5e46', layout: 'grid', count: [10, 16], noBullet: true },
      { kind: 'blackboard', w: 130, h: 14, height: 44, color: '#2e3e34', layout: 'north', count: [1, 2] },
      { kind: 'lockerbank', w: 30, h: 110, height: 50, color: '#5a6455', layout: 'walls', count: [2, 4] },
    ],
    containers: ['locker', 'cabinet', 'cabinet'], rooms: [3, 5],
  },
  factory: {
    floor: '#35363a', props: [
      { kind: 'machine', w: 100, h: 90, height: 54, color: '#565a60', layout: 'grid', count: [4, 7] },
      { kind: 'conveyor', w: 220, h: 36, height: 24, color: '#4a4e54', layout: 'scatter', count: [1, 3], noBullet: true },
      { kind: 'barrel', w: 26, h: 26, height: 32, color: '#7a5a2a', layout: 'scatter', count: [4, 8] },
    ],
    containers: ['crate', 'crate', 'ammobox'], rooms: [2, 4],
  },
  diner: {
    floor: '#443e36', props: [
      { kind: 'table', w: 44, h: 44, height: 24, color: '#7a624a', layout: 'grid', count: [6, 10], noBullet: true },
      { kind: 'counter', w: 200, h: 40, height: 34, color: '#8a5a48', layout: 'south', count: [1, 1] },
      { kind: 'stove', w: 60, h: 40, height: 32, color: '#606468', layout: 'north', count: [1, 2] },
    ],
    containers: ['fridge', 'fridge', 'register'], rooms: [1, 3],
  },
  apartments: {
    floor: '#3c3a3e', props: [
      { kind: 'bed', w: 50, h: 80, height: 22, color: '#8a7a88', layout: 'scatter', count: [3, 6], noBullet: true },
      { kind: 'sofa', w: 90, h: 36, height: 24, color: '#5a5464', layout: 'scatter', count: [2, 4], noBullet: true },
      { kind: 'tv', w: 44, h: 14, height: 26, color: '#2c2e34', layout: 'walls', count: [1, 3] },
      { kind: 'fridgeunit', w: 36, h: 30, height: 46, color: '#8a9098', layout: 'walls', count: [1, 3] },
    ],
    containers: ['cabinet', 'cabinet', 'fridge'], rooms: [4, 7],
  },
  motel: {
    floor: '#3e3c38', props: [
      { kind: 'bed', w: 50, h: 80, height: 22, color: '#7a6a70', layout: 'scatter', count: [4, 6], noBullet: true },
      { kind: 'tv', w: 44, h: 14, height: 26, color: '#2c2e34', layout: 'walls', count: [2, 4] },
      { kind: 'minibar', w: 30, h: 26, height: 34, color: '#6a5a48', layout: 'walls', count: [2, 3] },
    ],
    containers: ['cabinet', 'cabinet', 'fridge'], rooms: [4, 7],
  },
  gas: {
    floor: '#3d3c36', props: [
      { kind: 'shelf', w: 30, h: 120, height: 38, color: '#6a6244', layout: 'aisles', count: [3, 4] },
      { kind: 'counter', w: 130, h: 40, height: 34, color: '#5c5244', layout: 'south', count: [1, 1] },
      { kind: 'drinkfridge', w: 90, h: 34, height: 46, color: '#4a6a80', layout: 'north', count: [1, 2] },
    ],
    containers: ['register', 'fridge', 'ammobox'], rooms: [1, 2],
  },
  mall: {
    floor: '#3b3e42', props: [
      { kind: 'shelf', w: 34, h: 160, height: 42, color: '#6a6a7a', layout: 'aisles', count: [4, 7] },
      { kind: 'bench', w: 80, h: 24, height: 18, color: '#5a5e64', layout: 'scatter', count: [2, 5], noBullet: true },
      { kind: 'kiosk', w: 70, h: 70, height: 40, color: '#7a6a5a', layout: 'scatter', count: [2, 3] },
      { kind: 'plant', w: 18, h: 18, height: 30, color: '#3f6a44', layout: 'scatter', count: [3, 6] },
    ],
    containers: ['register', 'crate', 'cabinet', 'locker'], rooms: [3, 6],
  },
  radio: {
    floor: '#36383e', props: [
      { kind: 'serverrack', w: 34, h: 90, height: 56, color: '#3e4650', layout: 'walls', count: [3, 6], emissive: '#3a8f5a' },
      { kind: 'desk', w: 90, h: 44, height: 28, color: '#4e525a', layout: 'grid', count: [3, 5], noBullet: true },
      { kind: 'antenna', w: 20, h: 20, height: 70, color: '#7a8088', layout: 'scatter', count: [1, 2] },
    ],
    containers: ['desk', 'locker', 'cabinet'], rooms: [2, 4],
  },
  generic: {
    floor: '#3a3c40', props: [
      { kind: 'crateprop', w: 50, h: 50, height: 30, color: '#6a5a3a', layout: 'scatter', count: [3, 6] },
      { kind: 'table', w: 60, h: 40, height: 24, color: '#5e564a', layout: 'scatter', count: [2, 4], noBullet: true },
    ],
    containers: ['cabinet', 'crate'], rooms: [2, 4],
  },
};

class Interior {
  constructor(building) {
    // Randomised footprint so every instance is laid out differently.
    this.w = Utils.randInt(1100, 1700);
    this.h = Utils.randInt(850, 1250);
    this.name = building.name || 'Building Interior';
    this.tag = building.tag || 'generic';
    this.theme = INTERIOR_THEMES[this.tag] || INTERIOR_THEMES.generic;
    this.sourceBuilding = building;
    this.isOverworld = false;
    this.solids = [];
    this.props = [];
    this.streets = [{ x: 0, y: 0, w: this.w, h: this.h }];
    this.spawnX = this.w / 2;
    this.spawnY = this.h - 100;
    this.exitZone = { x: this.w / 2 - 90, y: this.h - 70, w: 180, h: 60, cx: this.w / 2, cy: this.h - 40 };

    // Danger scales with the district the building stands in.
    this.tier = (window.game && window.game.overworld && window.game.overworld.getDistrictTier)
      ? window.game.overworld.getDistrictTier(building.x + building.w / 2, building.y + building.h / 2)
      : 2;

    this.objects = new SceneObjects(this);
    this.entities = new EntityManager(this);
    this.entities.spawnEnabled = false;

    this._build();
    this.moveSolids = this.solids.concat(
      this.objects.containers.map(c => ({ x: c.x, y: c.y, w: c.w, h: c.h })));
  }

  _build() {
    const t = 32;
    this.solids.push({ x: 0, y: 0, w: this.w, h: t, wall: true });
    this.solids.push({ x: 0, y: 0, w: t, h: this.h, wall: true });
    this.solids.push({ x: this.w - t, y: 0, w: t, h: this.h, wall: true });
    this.solids.push({ x: 0, y: this.h - t, w: this.w / 2 - 90, h: t, wall: true });
    this.solids.push({ x: this.w / 2 + 90, y: this.h - t, w: this.w / 2 - 90, h: t, wall: true });

    this._buildRooms();
    this._placeProps();
    this._placeContainers();
    this._placeInfected();
  }

  // Partition walls WITH door gaps — real rooms, never sealed boxes.
  _buildRooms() {
    const [rMin, rMax] = this.theme.rooms || [2, 4];
    const rooms = Utils.randInt(rMin, rMax);
    for (let i = 0; i < rooms; i++) {
      const vertical = Math.random() < 0.5;
      const doorW = 100;
      const wallT = 26;
      if (vertical) {
        const x = Utils.rand(this.w * 0.22, this.w * 0.78);
        const y0 = 32, y1 = Utils.rand(this.h * 0.45, this.h * 0.8);
        const gapAt = Utils.rand(y0 + 60, y1 - 60 - doorW);
        this.solids.push({ x, y: y0, w: wallT, h: Math.max(0, gapAt - y0), wall: true, partition: true });
        this.solids.push({ x, y: gapAt + doorW, w: wallT, h: Math.max(0, y1 - gapAt - doorW), wall: true, partition: true });
      } else {
        const y = Utils.rand(this.h * 0.2, this.h * 0.7);
        const x0 = Utils.rand(32, this.w * 0.3), x1 = Utils.rand(this.w * 0.6, this.w - 32);
        const gapAt = Utils.rand(x0 + 60, x1 - 60 - doorW);
        this.solids.push({ x: x0, y, w: Math.max(0, gapAt - x0), h: wallT, wall: true, partition: true });
        this.solids.push({ x: gapAt + doorW, y, w: Math.max(0, x1 - gapAt - doorW), h: wallT, wall: true, partition: true });
      }
    }
  }

  // Themed furniture, laid out by pattern: aisles, pews, grids, along walls...
  _placeProps() {
    for (const spec of this.theme.props || []) {
      const count = Utils.randInt(spec.count[0], spec.count[1]);
      if (spec.layout === 'aisles') this._layoutAisles(spec, count);
      else if (spec.layout === 'pews') this._layoutPews(spec, count);
      else if (spec.layout === 'grid') this._layoutGrid(spec, count);
      else if (spec.layout === 'walls') this._layoutWalls(spec, count);
      else if (spec.layout === 'north') this._layoutEdge(spec, count, 'north');
      else if (spec.layout === 'south') this._layoutEdge(spec, count, 'south');
      else this._layoutScatter(spec, count);
    }
  }

  _addProp(spec, x, y) {
    if (x < 50 || y < 50 || x + spec.w > this.w - 50 || y + spec.h > this.h - 130) return false;
    if (this._isBlocked(x - 20, y - 20, spec.w + 40, spec.h + 40)) return false;
    const p = { x, y, w: spec.w, h: spec.h, height: spec.height, color: spec.color, kind: spec.kind, emissive: spec.emissive };
    this.props.push(p);
    const solid = { x, y, w: spec.w, h: spec.h, prop: true };
    if (spec.noBullet) solid.noBullet = true;   // low furniture — shoot over it
    this.solids.push(solid);
    return true;
  }

  // Evenly spaced vertical aisles (shop shelving) in the middle of the floor.
  _layoutAisles(spec, count) {
    const usable = this.w - 260;
    const gap = usable / (count + 1);
    for (let i = 0; i < count; i++) {
      const x = 130 + gap * (i + 1) - spec.w / 2;
      const y = Utils.rand(this.h * 0.18, Math.max(this.h * 0.2, this.h * 0.55 - spec.h / 2));
      this._addProp(spec, x, y);
    }
  }

  // Church pews: two columns with a centre aisle, facing the altar (north).
  _layoutPews(spec, count) {
    const rows = Math.ceil(count / 2);
    const startY = this.h * 0.3;
    const rowGap = Math.min(70, (this.h * 0.5) / rows);
    for (let r = 0; r < rows; r++) {
      this._addProp(spec, this.w / 2 - spec.w - 40, startY + r * rowGap);
      this._addProp(spec, this.w / 2 + 40, startY + r * rowGap);
    }
  }

  // Loose grid (office desks, classroom desks, diner tables).
  _layoutGrid(spec, count) {
    const cols = Math.ceil(Math.sqrt(count));
    const rows = Math.ceil(count / cols);
    const cellW = (this.w - 260) / cols, cellH = (this.h - 360) / rows;
    let placed = 0;
    for (let r = 0; r < rows && placed < count; r++) {
      for (let c = 0; c < cols && placed < count; c++) {
        const x = 130 + c * cellW + Utils.rand(10, Math.max(12, cellW - spec.w - 10));
        const y = 110 + r * cellH + Utils.rand(10, Math.max(12, cellH - spec.h - 10));
        if (this._addProp(spec, x, y)) placed++;
      }
    }
  }

  // Furniture pushed against the outer walls (hospital beds, lockers, racks).
  _layoutWalls(spec, count) {
    for (let i = 0; i < count; i++) {
      const side = Utils.randInt(0, 2);   // 0 left, 1 right, 2 top
      let x, y;
      if (side === 0) { x = 54; y = Utils.rand(80, this.h - 220 - spec.h); }
      else if (side === 1) { x = this.w - 56 - spec.w; y = Utils.rand(80, this.h - 220 - spec.h); }
      else { x = Utils.rand(80, this.w - 130 - spec.w); y = 54; }
      this._addProp(spec, x, y);
    }
  }

  // A feature at the north or south end (altar, service counter, vault).
  _layoutEdge(spec, count, edge) {
    for (let i = 0; i < count; i++) {
      const x = this.w / 2 - spec.w / 2 + (i - (count - 1) / 2) * (spec.w + 60);
      const y = edge === 'north' ? 70 : this.h - 230 - spec.h;
      this._addProp(spec, x, y);
    }
  }

  _layoutScatter(spec, count) {
    for (let i = 0; i < count; i++) {
      for (let tries = 0; tries < 20; tries++) {
        const x = Utils.rand(90, this.w - 90 - spec.w);
        const y = Utils.rand(90, this.h - 200 - spec.h);
        if (this._addProp(spec, x, y)) break;
      }
    }
  }

  _placeContainers() {
    const types = this.theme.containers || ['cabinet'];
    // District 1-2 buildings are generous — new players should WANT to explore.
    const numContainers = Utils.randInt(4, 8) + (this.tier <= 2 ? 2 : 0);
    for (let i = 0; i < numContainers; i++) {
      const lootType = Utils.pick(types);
      const def = CONTAINER_DEFS[lootType];
      for (let t = 0; t < 30; t++) {
        const cx = Utils.rand(90, this.w - 90);
        const cy = Utils.rand(90, this.h - 160);
        if (this._isBlocked(cx - 25, cy - 25, 50, 50)) continue;
        if (SceneObjects.overlaps(this.objects, this, cx, cy, def)) continue;
        this.objects.add(new LootContainer(Utils.uid(), lootType, cx - def.w / 2, cy - def.h / 2));
        break;
      }
    }
    // HIDDEN CACHE: a rare, glowing stash of top-tier loot. Memorable moments.
    if (Utils.chance(CONFIG.loot.hiddenCacheChance || 0.06)) {
      const def = CONTAINER_DEFS.cache;
      for (let t = 0; t < 40; t++) {
        const cx = Utils.rand(120, this.w - 120);
        const cy = Utils.rand(120, this.h - 260);
        if (this._isBlocked(cx - 25, cy - 25, 50, 50)) continue;
        if (SceneObjects.overlaps(this.objects, this, cx, cy, def)) continue;
        this.objects.add(new LootContainer(Utils.uid(), 'cache', cx - def.w / 2, cy - def.h / 2));
        this.hasCache = true;
        break;
      }
    }
  }

  _placeInfected() {
    const tier = Math.max(1, Math.min(6, this.tier || 2));
    const D = CONFIG.districts[tier - 1] || {};
    // Interior population scales with district — District 1 buildings are a
    // safe-ish tutorial, Ground Zero interiors are death traps.
    const [zMin, zMax] = D.interiorZombies || [8, 13];
    const numZombies = Utils.randInt(zMin, zMax);
    // Mutants stay OUT of low-district buildings; bosses never spawn indoors.
    const typeCap = tier < (CONFIG.interiorMutantMinDistrict || 3) ? 1 : tier;
    // Grid-cell sampling: shuffle the floor into cells and drop at most one
    // infected per cell, never near the entrance — an even spread through the
    // rooms instead of a wall-hugging blob.
    const cell = 170;
    const cells = [];
    for (let cx = 90; cx < this.w - 90 - cell; cx += cell) {
      for (let cy = 90; cy < this.h - 260 - cell; cy += cell) cells.push([cx, cy]);
    }
    for (let i = cells.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [cells[i], cells[j]] = [cells[j], cells[i]];
    }
    let placed = 0;
    for (const [cx, cy] of cells) {
      if (placed >= numZombies) break;
      for (let t = 0; t < 6; t++) {
        const px = Utils.rand(cx, cx + cell);
        const py = Utils.rand(cy, cy + cell);
        if (Utils.dist(px, py, this.spawnX, this.spawnY) < 300) break;   // clear entry zone
        if (this._isBlocked(px - 18, py - 18, 36, 36)) continue;
        this.entities.spawnZombieAt(px, py, rollEnemyType(typeCap), { tier });
        placed++;
        break;
      }
    }
  }

  _isBlocked(x, y, w, h) {
    for (const s of this.solids) {
      if (Utils.aabb(x, y, w, h, s.x, s.y, s.w, s.h)) return true;
    }
    return false;
  }

  inSafeZone() { return false; }

  randomStreetPoint(avoidX, avoidY, minDist) {
    for (let i = 0; i < 30; i++) {
      const x = Utils.rand(80, this.w - 80);
      const y = Utils.rand(80, this.h - 160);
      if (Utils.dist(x, y, avoidX, avoidY) >= minDist) return { x, y };
    }
    return { x: this.w / 2, y: this.h / 2 };
  }

  getDistrictTier() { return this.tier || 2; }

  nearExit(px, py, range) {
    const e = this.exitZone;
    return Utils.dist(px, py, e.cx, e.cy) < range;
  }

  renderBackground(ctx, cam) {
    ctx.fillStyle = '#0e1012';
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
  }
}
