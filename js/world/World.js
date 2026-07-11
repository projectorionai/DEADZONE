/* Ravenside — a dense isometric inner city, regenerated on every load.
 * Districts 1-6 radiate out from Ravenside Outpost (the starter refuge):
 * the further you push, the deadlier and richer the city gets.
 * Four DISTINCT outposts anchor the map:
 *   Ravenside Outpost — civilian refuge (scrap walls, campfires, tents)
 *   Fort Bastion      — military base deep in the red zone (concrete, towers)
 *   Union Market      — trade hub (stalls, canopies, the big marketplace)
 *   St. Mercy         — medical compound (clinic tents, double medbay)
 * Implements the "scene" interface: w, h, solids, objects, entities.
 */

const OUTPOST_DEFS = [
  {
    key: 'ravenside', name: 'Ravenside Outpost', archetype: 'refuge',
    x: 460, y: 4030, w: 760, h: 600,
    wallColor: '#6a5a42', padColor: '#22331f', padEmissive: '#1a2f16',
    posts: [
      { rx: 0.5,  ry: -0.09, name: 'North Gate Guard',  cls: 'shotgun' },
      { rx: -0.08, ry: 0.32, name: 'West Watch',        cls: 'assault' },
      { rx: 1.08, ry: 0.32,  name: 'East Watch',        cls: 'assault' },
      { rx: 1.08, ry: 0.78,  name: 'SE Sniper Tower',   cls: 'sniper', tower: true },
      { rx: 0.32, ry: 0.38,  name: 'Market Security',   cls: 'assault' },
    ],
  },
  {
    key: 'bastion', name: 'Fort Bastion', archetype: 'military',
    x: 6720, y: 430, w: 700, h: 560,
    wallColor: '#565c66', padColor: '#252a2e', padEmissive: '#1a2026',
    posts: [
      { rx: -0.1, ry: -0.1,  name: 'NW Sniper Tower',   cls: 'sniper', tower: true },
      { rx: 1.1,  ry: -0.1,  name: 'NE Sniper Tower',   cls: 'sniper', tower: true },
      { rx: -0.1, ry: 1.1,   name: 'SW Sniper Tower',   cls: 'sniper', tower: true },
      { rx: 0.5,  ry: -0.09, name: 'Checkpoint Heavy',  cls: 'heavy' },
      { rx: 0.35, ry: 0.4,   name: 'Yard Patrol',       cls: 'assault' },
      { rx: 0.5,  ry: 0.55,  name: 'Fort Commander',    cls: 'elite' },
    ],
  },
  {
    key: 'union', name: 'Union Market', archetype: 'trade',
    x: 3660, y: 3200, w: 700, h: 560,
    wallColor: '#7a6a4e', padColor: '#2d2a22', padEmissive: '#2a2418',
    posts: [
      { rx: 0.5,  ry: -0.09, name: 'Front Gate Guard',  cls: 'shotgun' },
      { rx: 0.2,  ry: 0.45,  name: 'Market Security',   cls: 'assault' },
      { rx: 0.8,  ry: 0.45,  name: 'Market Security',   cls: 'assault' },
      { rx: 1.08, ry: 0.15,  name: 'Roof Sniper',       cls: 'sniper', tower: true },
    ],
  },
  {
    key: 'mercy', name: 'St. Mercy Compound', archetype: 'medical',
    x: 1560, y: 480, w: 640, h: 520,
    wallColor: '#8a8d90', padColor: '#2a2e2c', padEmissive: '#20302a',
    posts: [
      { rx: 0.5,  ry: -0.1,  name: 'South Entrance Guard', cls: 'assault' },
      { rx: -0.09, ry: 0.5,  name: 'West Ward Guard',     cls: 'shotgun' },
      { rx: 1.09, ry: 0.5,   name: 'Overwatch Tower',     cls: 'sniper', tower: true },
    ],
  },
];

class World {
  constructor() {
    this.w = CONFIG.world.width;
    this.h = CONFIG.world.height;
    this.tile = CONFIG.world.tile;
    this.buildings = [];
    this.solids = [];
    this.streets = [];
    this.enterables = [];
    this.safeZone = null;
    this.landmarks = [];
    this.guards = [];
    this.towers = [];
    this.lamps = [];
    this.corpses = [];
    this.bloodSmears = [];
    this.isOverworld = true;
    this.build();
    this.objects = SceneObjects.populateOverworld(this);
    // Movement blockers = walls/buildings + loot containers.
    // Bullets & LOS still test plain `solids`, so you can shoot over a crate.
    this.moveSolids = this.solids.concat(
      this.objects.containers.map(c => ({ x: c.x, y: c.y, w: c.w, h: c.h })));
    this.entities = new EntityManager(this);
    this.entities.spawnEnabled = true;
    this._prePlaceHorde();
  }

  build() {
    // --- City grid: avenues carve the map into coherent blocks ---
    const roadW = 150;
    this.roadW = roadW;
    this.avenuesX = [300, 1350, 2400, 3450, 4500, 5550, 6600, 7650];
    this.avenuesY = [260, 1160, 2060, 2960, 3860, 4760, 5660];
    for (const gy of this.avenuesY) this.streets.push({ x: 0, y: gy, w: this.w, h: roadW });
    for (const gx of this.avenuesX) this.streets.push({ x: gx, y: 0, w: roadW, h: this.h });

    // --- Outposts: four distinct archetypes ---
    this.outposts = [];
    for (const def of OUTPOST_DEFS) this._buildOutpost(def);
    const main = this.outposts[0];
    this.safeZone = main.zone;
    this.trader = main.trader; this.storage = main.storage; this.healStation = main.heal;

    // --- City blocks (cells between avenues) ---
    const blocks = [];
    for (let xi = 0; xi < this.avenuesX.length - 1; xi++) {
      for (let yi = 0; yi < this.avenuesY.length - 1; yi++) {
        const bx = this.avenuesX[xi] + roadW, by = this.avenuesY[yi] + roadW;
        const bw = this.avenuesX[xi + 1] - bx, bh = this.avenuesY[yi + 1] - by;
        if (bw < 300 || bh < 300) continue;
        const cx = bx + bw / 2, cy = by + bh / 2;
        if (this.inSafeZone(cx, cy, 200)) continue;
        blocks.push({ x: bx, y: by, w: bw, h: bh, cx, cy, used: [] });
      }
    }

    // --- Enterable landmarks — random blocks each load ---
    const LANDMARKS = [
      ['RAVENSIDE HOSPITAL', '#9aa6b2', 'hospital', 78, 560, 400],
      ['WAREHOUSE 7', '#a4864f', 'warehouse', 60, 620, 460],
      ['POLICE STATION', '#5f7796', 'police', 66, 440, 360],
      ['APARTMENTS', '#a4705f', 'apartments', 52, 460, 340],
      ['GAS STATION', '#b05548', 'gas', 42, 380, 340],
      ['DINER', '#c2a066', 'diner', 46, 400, 320],
      ['HARDWARE STORE', '#b57f43', 'hardware', 54, 360, 340],
      ['OFFICE BLOCK', '#7c8a9c', 'office', 72, 420, 400],
      ['PHARMACY', '#5fa07c', 'pharmacy', 48, 380, 320],
      ['BANK', '#a89a7e', 'bank', 58, 360, 300],
      ['GUN STORE', '#96473a', 'gunstore', 50, 380, 320],
      ['SUPERMARKET', '#57a066', 'supermarket', 56, 420, 360],
      ['RAVENSIDE MALL', '#8a76a0', 'mall', 74, 640, 460],
      ["ST. MARY'S CHURCH", '#9a9282', 'church', 64, 360, 320],
      ['SCHOOL', '#b0785c', 'school', 56, 440, 360],
      ['FACTORY', '#93744c', 'factory', 68, 460, 380],
      ['MOTEL', '#5f9696', 'motel', 46, 380, 320],
      ['RADIO STATION', '#78829a', 'radio', 78, 380, 320],
      ['FIRE STATION', '#a05038', 'firestation', 56, 400, 340],
      ['BIOTECH LAB', '#6a8a92', 'lab', 70, 420, 360],
    ];
    const shuffled = blocks.slice();
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    for (let i = 0; i < LANDMARKS.length && i < shuffled.length; i++) {
      const [name, color, tag, height, w, h] = LANDMARKS[i];
      const blk = shuffled[i];
      const bw = Math.min(w, blk.w - 160), bh = Math.min(h, blk.h - 160);
      const jx = Utils.rand(-(blk.w - bw - 140) / 2, (blk.w - bw - 140) / 2) * 0.5;
      const jy = Utils.rand(-(blk.h - bh - 140) / 2, (blk.h - bh - 140) / 2) * 0.5;
      const cx = blk.cx + jx, cy = blk.cy + jy;
      this._addEnterable(cx - bw / 2, cy - bh / 2, bw, bh, name, color, tag, height);
      blk.used.push({ x: cx - bw / 2 - 60, y: cy - bh / 2 - 60, w: bw + 120, h: bh + 200 });
    }

    // --- FILLER BUILDINGS: pack every block tight — a real inner city. ---
    const palette = ['#4d5560', '#5a5148', '#61574b', '#544a52', '#4a5450', '#5d5a4e', '#50565e', '#5e5048', '#47505a', '#585460'];
    const [minFill, maxFill] = CONFIG.world.fillerPerBlock;
    for (const blk of blocks) {
      const tier = this.getDistrictTier(blk.cx, blk.cy);
      const want = Utils.randInt(minFill, maxFill) + (tier >= 4 ? 3 : 0);
      let placed = 0;
      for (let attempt = 0; attempt < 90 && placed < want; attempt++) {
        const fw = Utils.rand(100, Math.min(280, blk.w * 0.4));
        const fh = Utils.rand(100, Math.min(280, blk.h * 0.4));
        const fx = Utils.rand(blk.x + 26, blk.x + blk.w - fw - 26);
        const fy = Utils.rand(blk.y + 26, blk.y + blk.h - fh - 26);
        const pad = 38;   // alley clearance — player & zombies fit through
        let clash = false;
        for (const u of blk.used) {
          if (Utils.aabb(fx - pad, fy - pad, fw + pad * 2, fh + pad * 2, u.x, u.y, u.w, u.h)) { clash = true; break; }
        }
        if (clash) continue;
        if (this.inSafeZone(fx + fw / 2, fy + fh / 2, 220)) continue;
        const rect = { x: fx, y: fy, w: fw, h: fh };
        blk.used.push(rect);
        const hBase = tier <= 1 ? [26, 58] : tier === 2 ? [34, 76] : tier === 3 ? [44, 92]
          : tier === 4 ? [56, 112] : [66, CONFIG.world.fillerHeight[1]];
        // ~14% of the city burned down: charred, collapsed to a fraction of
        // its height, obviously never enterable.
        const burned = Math.random() < 0.14;
        this.buildings.push({
          ...rect, name: '',
          color: burned ? Utils.pick(['#211d19', '#2a2320', '#1d1b18']) : Utils.pick(palette),
          filler: true, burned,
          height: Math.round(Utils.rand(hBase[0], hBase[1]) * (burned ? 0.4 : 1)),
        });
        this.solids.push(rect);
        placed++;
      }
    }

    // --- WRECKED CARS (some burning, some with working police flashers) ---
    const carColors = ['#6a3a30', '#3a4a5c', '#5c5c50', '#46524a', '#5a4a3c', '#404448'];
    let wrecks = 0, burning = 0, police = 0;
    for (let i = 0; i < CONFIG.world.wreckCount * 4 && wrecks < CONFIG.world.wreckCount; i++) {
      const s = Utils.pick(this.streets);
      const horizontal = s.w > s.h;
      const cw = horizontal ? Utils.rand(58, 74) : Utils.rand(28, 36);
      const ch = horizontal ? Utils.rand(28, 36) : Utils.rand(58, 74);
      const x = Utils.rand(s.x + 40, s.x + s.w - cw - 40);
      const y = Utils.rand(s.y + 20, s.y + s.h - ch - 20);
      if (this.inSafeZone(x, y, 260)) continue;
      let nearCross = false;
      for (const gx of this.avenuesX) for (const gy of this.avenuesY) {
        if (Math.abs(x - gx - this.roadW / 2) < 140 && Math.abs(y - gy - this.roadW / 2) < 140) nearCross = true;
      }
      if (nearCross && Math.random() < 0.7) continue;
      const rect = { x, y, w: cw, h: ch };
      const b = { ...rect, name: '', color: Utils.pick(carColors), wreck: true, height: Utils.rand(16, 22) };
      if (burning < CONFIG.world.burningCars && Math.random() < 0.1) { b.burning = true; b.color = '#26221e'; burning++; }
      else if (police < CONFIG.world.policeWrecks && Math.random() < 0.06) { b.police = true; b.color = '#2e3a50'; police++; }
      this.buildings.push(b);
      this.solids.push(rect);
      wrecks++;
    }

    // --- BARRICADES + MILITARY CHECKPOINTS near intersections ---
    for (let i = 0; i < 40; i++) {
      const gx = Utils.pick(this.avenuesX), gy = Utils.pick(this.avenuesY);
      const off = Utils.rand(160, 420) * (Math.random() < 0.5 ? -1 : 1);
      const horizontal = Math.random() < 0.5;
      const x = gx + (horizontal ? Utils.rand(-60, 60) : off);
      const y = gy + (horizontal ? off : Utils.rand(-60, 60));
      if (this.inSafeZone(x, y, 260)) continue;
      const rect = horizontal ? { x, y, w: Utils.rand(80, 130), h: 16 } : { x, y, w: 16, h: Utils.rand(80, 130) };
      this.buildings.push({ ...rect, name: '', color: '#7a6a3a', barricade: true, height: 20 });
      this.solids.push(rect);
    }
    // Full checkpoints: sandbag line + army truck + corpses (the cordon that failed)
    for (let i = 0; i < 6; i++) {
      const gx = Utils.pick(this.avenuesX), gy = Utils.pick(this.avenuesY);
      const cx = gx + this.roadW / 2, cy = gy + this.roadW / 2 + Utils.rand(220, 420);
      if (this.inSafeZone(cx, cy, 320)) continue;
      for (let sbi = -1; sbi <= 1; sbi++) {
        const rect = { x: cx - 90 + (sbi + 1) * 62, y: cy, w: 54, h: 18 };
        this.buildings.push({ ...rect, name: '', color: '#6a6a4a', barricade: true, height: 18 });
        this.solids.push(rect);
      }
      // a dead MBT sits where the cordon broke
      const tank = { x: cx - 55, y: cy - 90, w: 110, h: 52 };
      this.buildings.push({ ...tank, name: '', color: '#4a553a', tank: true, height: 34 });
      this.solids.push(tank);
      for (let ci = 0; ci < 4; ci++) this._addCorpse(cx + Utils.rand(-80, 80), cy + Utils.rand(-40, 80));
    }

    // --- RUBBLE ---
    let placed = 0;
    for (let i = 0; i < 300 && placed < 60; i++) {
      const x = Utils.rand(300, this.w - 340);
      const y = Utils.rand(300, this.h - 340);
      if (this.inSafeZone(x, y, 180)) continue;
      if (placed % 3 !== 0 && this._onRoad(x, y, 90)) continue;
      const bw = Utils.rand(30, 78), bh = Utils.rand(30, 78);
      const r = { x, y, w: bw, h: bh, decoration: true };
      this.buildings.push({ ...r, name: '', color: '#242629', small: true, height: Utils.rand(10, 24) });
      this.solids.push(r);
      placed++;
    }

    // --- STREET CORPSES + blood smears (environmental storytelling) ---
    for (let i = 0; i < CONFIG.world.corpseCount; i++) {
      const p = this.randomStreetPoint(this.w / 2, this.h / 2, 0);
      if (this.inSafeZone(p.x, p.y, 200)) continue;
      this._addCorpse(p.x, p.y);
    }

    // --- ABANDONED CAMPS (mid districts): tents, cold fire, a stash crate ---
    for (let i = 0; i < CONFIG.world.campCount * 5 && (this.camps || 0) < CONFIG.world.campCount; i++) {
      const p = this.randomStreetPoint(this.w / 2, this.h / 2, 0);
      const t = this.getDistrictTier(p.x, p.y);
      if (t < 2 || t > 4 || this.inSafeZone(p.x, p.y, 300)) continue;
      this.camps = (this.camps || 0) + 1;
      const tent = { x: p.x - 60, y: p.y - 30, w: 60, h: 46 };
      this.buildings.push({ ...tent, name: '', color: '#5a6248', camp: true, height: 26 });
      this.solids.push(tent);
      this.buildings.push({ x: p.x + 20, y: p.y, w: 16, h: 16, name: '', color: '#332a20', campfire: true, height: 8, burning: Math.random() < 0.4 });
      for (let ci = 0; ci < 3; ci++) this._addCorpse(p.x + Utils.rand(-70, 90), p.y + Utils.rand(-50, 70));
    }

    // --- STREET LAMPS (a dying grid, a third still lit) ---
    for (let i = 0; i < CONFIG.world.lampCount; i++) {
      const s = Utils.pick(this.streets);
      const horizontal = s.w > s.h;
      const x = horizontal ? Utils.rand(s.x + 80, s.x + s.w - 80) : (Math.random() < 0.5 ? s.x + 12 : s.x + s.w - 12);
      const y = horizontal ? (Math.random() < 0.5 ? s.y + 12 : s.y + s.h - 12) : Utils.rand(s.y + 80, s.y + s.h - 80);
      this.lamps.push({ x, y, lit: Math.random() < 0.35 });
    }
  }

  _addCorpse(x, y) {
    this.corpses.push({ x, y, rot: Utils.rand(0, Math.PI * 2) });
    if (Math.random() < 0.7) this.bloodSmears.push({ x: x + Utils.rand(-14, 14), y: y + Utils.rand(-14, 14), r: Utils.rand(10, 26) });
  }

  // The deep city is already crawling when you arrive.
  _prePlaceHorde() {
    const want = CONFIG.spawn.innerCityInitial || 0;
    let placed = 0;
    for (let i = 0; i < want * 4 && placed < want; i++) {
      const p = this.randomStreetPoint(this.safeZone.x, this.safeZone.y, 2200);
      const tier = this.getDistrictTier(p.x, p.y);
      if (tier < 4) continue;
      this.entities.spawnZombieAt(p.x, p.y, rollEnemyType(tier));
      placed++;
    }
  }

  // Build one outpost from its archetype definition.
  _buildOutpost(def) {
    const { x, y, w, h } = def;
    const zone = { x, y, w, h };
    this.landmarks.push({ x: x + w / 2, y: y + 50, name: 'SAFE ZONE — ' + def.name });
    this._wallBox(zone, 22, { topGap: [0.4, 0.6] }, def.wallColor, def.archetype === 'refuge');
    /* Stations sit on a fixed non-overlapping grid:
     *   TOP row    (y+120):   MISSIONS · MARKET · MEDICAL
     *   BOTTOM row (y+h-200): TRADER  · STORAGE
     * Decorations only ever use the MIDDLE band and the corners, so nothing
     * can overlap a service building again. */
    const topY = y + 120, botY = y + h - 200;
    const col = (f) => x + Math.round(w * f) - 50;
    const o = {
      key: def.key, name: def.name, archetype: def.archetype, zone,
      wallColor: def.wallColor, padColor: def.padColor, padEmissive: def.padEmissive,
      missions: { x: col(0.18), y: topY, w: 100, h: 70, name: 'MISSIONS' },
      market:   { x: col(0.50), y: topY, w: 100, h: 70, name: 'MARKET' },
      heal:     { x: col(0.82), y: topY, w: 100, h: 74, name: 'MEDICAL' },
      trader:   { x: col(0.26), y: botY, w: 100, h: 70, name: 'TRADER' },
      storage:  { x: col(0.66), y: botY, w: 100, h: 70, name: 'STORAGE' },
      props: [],
    };
    // Middle decoration band, clear of both station rows.
    const midY0 = topY + 110, midY1 = botY - 70;
    const midY = (f) => Math.round(midY0 + (midY1 - midY0) * f);
    const P = (px, py, pw, ph, height, color, opts = {}) => {
      const prop = { x: Math.round(px), y: Math.round(py), w: pw, h: ph, height, color, ...opts };
      o.props.push(prop);
      if (opts.solid) this.solids.push({ x: prop.x, y: prop.y, w: pw, h: ph });
    };
    if (def.archetype === 'refuge') {
      P(x + w * 0.62, midY(0.25), 54, 44, 24, '#5a6248', { kind: 'tent', solid: true });
      P(x + w * 0.76, midY(0.5), 54, 44, 24, '#62584a', { kind: 'tent', solid: true });
      P(x + w * 0.68, midY(0.05), 14, 14, 8, '#3a2e22', { kind: 'campfire', burning: true });
      P(x + w * 0.14, midY(0.4), 40, 30, 22, '#6a5a3a', { kind: 'crates', solid: true });
    } else if (def.archetype === 'military') {
      for (const [tx, ty] of [[0.05, 0.05], [0.9, 0.05], [0.05, 0.88], [0.9, 0.88]]) {
        P(x + w * tx, y + h * ty, 44, 44, 90, '#4e545c', { kind: 'watchtower', solid: true, floodlight: true });
      }
      P(x + w * 0.5 - 60, y - 60, 120, 20, 18, '#6a6a4a', { kind: 'sandbags', solid: true });
      P(x + w * 0.4, midY(0.35), 90, 40, 30, '#4a5a3a', { kind: 'truck', solid: true });
    } else if (def.archetype === 'trade') {
      const stallColors = ['#a05a3a', '#3a7a5a', '#5a5a9a', '#9a8a3a'];
      for (let i = 0; i < 4; i++) {
        P(x + w * (0.16 + i * 0.2), midY(0.3), 64, 38, 30,
          stallColors[i % stallColors.length], { kind: 'stall', solid: true });
      }
      P(x + w * 0.06, midY(0.75), 40, 30, 22, '#6a5a3a', { kind: 'crates', solid: true });
    } else if (def.archetype === 'medical') {
      for (let i = 0; i < 3; i++) {
        P(x + w * (0.18 + i * 0.26), midY(0.35), 84, 56, 30, '#c8ccc8', { kind: 'clinic', solid: true, cross: true });
      }
    }
    // DEFENCE RING: staggered sandbag segments outside the walls slow the
    // horde on its way in without ever sealing the gates.
    const ringGap = 64;
    const segs = [
      // north (leave the gate span open)
      { x: x - ringGap, y: y - ringGap, w: w * 0.32, h: 16 },
      { x: x + w * 0.68 + ringGap, y: y - ringGap, w: w * 0.32, h: 16 },
      // south
      { x: x + w * 0.1, y: y + h + ringGap, w: w * 0.34, h: 16 },
      { x: x + w * 0.56, y: y + h + ringGap, w: w * 0.34, h: 16 },
      // west / east
      { x: x - ringGap, y: y + h * 0.18, w: 16, h: h * 0.3 },
      { x: x - ringGap, y: y + h * 0.58, w: 16, h: h * 0.3 },
      { x: x + w + ringGap - 16, y: y + h * 0.18, w: 16, h: h * 0.3 },
      { x: x + w + ringGap - 16, y: y + h * 0.58, w: 16, h: h * 0.3 },
    ];
    for (const s of segs) {
      const r = { x: Math.round(s.x), y: Math.round(s.y), w: Math.round(s.w), h: Math.round(s.h) };
      this.buildings.push({ ...r, name: '', color: '#6a6a4a', barricade: true, height: 18 });
      this.solids.push(r);
    }
    this.outposts.push(o);
    // Guards from named posts
    for (const post of def.posts) {
      const gx = x + w * post.rx, gy = y + h * post.ry;
      if (post.tower) {
        this.towers.push({ x: gx, y: gy, name: post.name });
        o.props.push({ x: gx - 22, y: gy - 22, w: 44, h: 44, height: 80, color: '#4e545c', kind: 'watchtower', floodlight: def.archetype === 'military' });
        this.solids.push({ x: gx - 22, y: gy - 22, w: 44, h: 44 });
      }
      const guard = new Guard(gx, gy, { x: gx, y: gy, name: post.name, cls: post.cls });
      const cx = x + w / 2, cy = y + h / 2;
      const outward = Utils.angle(cx, cy, gx, gy);
      guard.scanBase = outward; guard.facing = outward;
      this.guards.push(guard);
    }
    return o;
  }

  _onRoad(x, y, pad = 0) {
    for (const s of this.streets) {
      if (x >= s.x - pad && x <= s.x + s.w + pad && y >= s.y - pad && y <= s.y + s.h + pad) return true;
    }
    return false;
  }

  _addEnterable(x, y, w, h, name, color, tag, height) {
    const t = 22;
    const doorW = Math.min(80, w * 0.22);
    const doorX = x + w / 2 - doorW / 2;
    const b = {
      x, y, w, h, name, color, tag, height: height || 50, enterable: true,
      colors: {
        top: Iso.shade(color, 1.12),
        left: Iso.shade(color, 0.62),
        right: Iso.shade(color, 0.82),
      },
    };
    this._pushWall(x, y, w, t);
    this._pushWall(x, y, t, h);
    this._pushWall(x + w - t, y, t, h);
    this._pushWall(x, y + h - t, doorX - x, t);
    this._pushWall(doorX + doorW, y + h - t, (x + w) - (doorX + doorW), t);
    b.door = {
      x: doorX, y: y + h - 8, w: doorW, h: 36,
      cx: doorX + doorW / 2, cy: y + h + 18,
    };
    this.buildings.push(b);
    this.enterables.push(b);
    this.landmarks.push({ x: x + w / 2, y: y + h / 2, name });
  }

  _pushWall(x, y, w, h, color) {
    const r = { x, y, w, h };
    this.solids.push(r);
    this.buildings.push({ ...r, name: '', color: color || '#3a4048', wall: true, height: 28 });
  }

  _wallBox(box, t, opts = {}, color, uneven = false) {
    const { x, y, w, h } = box;
    const wallH = uneven ? () => Utils.randInt(22, 34) : () => 30;
    const pw = (wx, wy, ww, wh) => {
      const r = { x: wx, y: wy, w: ww, h: wh };
      this.solids.push(r);
      this.buildings.push({ ...r, name: '', color: color || '#3a4048', wall: true, height: wallH() });
    };
    pw(x, y, t, h);
    pw(x + w - t, y, t, h);
    pw(x, y + h - t, w, t);
    if (opts.topGap) {
      const g0 = x + w * opts.topGap[0], g1 = x + w * opts.topGap[1];
      pw(x, y, g0 - x, t);
      pw(g1, y, (x + w) - g1, t);
    } else {
      pw(x, y, w, t);
    }
  }

  inSafeZone(x, y, pad = 0) {
    const zones = this.outposts && this.outposts.length ? this.outposts.map(o => o.zone) : (this.safeZone ? [this.safeZone] : []);
    for (const s of zones) {
      if (s && x >= s.x - pad && x <= s.x + s.w + pad && y >= s.y - pad && y <= s.y + s.h + pad) return true;
    }
    return false;
  }

  // DISTRICTS 1-6: distance from RAVENSIDE outpost only (DF1-style radial danger).
  getDistrictTier(x, y) {
    const rz = (this.outposts && this.outposts[0]) ? this.outposts[0].zone :
      (OUTPOST_DEFS[0] ? { x: OUTPOST_DEFS[0].x, y: OUTPOST_DEFS[0].y, w: OUTPOST_DEFS[0].w, h: OUTPOST_DEFS[0].h } : null);
    if (!rz) return 2;
    const d = Utils.dist(x, y, rz.x + rz.w / 2, rz.y + rz.h / 2);
    return districtByDistance(d).id;
  }
  districtInfo(x, y) {
    return CONFIG.districts[this.getDistrictTier(x, y) - 1];
  }

  nearestDoor(px, py, range) {
    let best = null, bestD = range;
    for (const b of this.enterables) {
      const d = Utils.dist(px, py, b.door.cx, b.door.cy);
      if (d < bestD) { bestD = d; best = b; }
    }
    return best;
  }

  // Zombie spawn point: only a trickle clusters near Ravenside; Fort Bastion
  // (deep in the red zone) sees constant pressure.
  zombieSpawnPoint(avoidX, avoidY, minDist) {
    let region = null;
    if (this.outposts && this.outposts.length > 1) {
      const r = Math.random();
      const rv = CONFIG.spawn.ravensideClusterWeight ?? 0.05;
      const fb = CONFIG.spawn.bastionClusterWeight ?? 0.22;
      if (r < rv) region = this.outposts[0].zone;
      else if (r < rv + fb) region = this.outposts[1].zone;
    }
    for (let tries = 0; tries < 50; tries++) {
      const p = this.randomStreetPoint(avoidX, avoidY, minDist);
      if (!region) return p;
      const d = Utils.dist(p.x, p.y, region.x + region.w / 2, region.y + region.h / 2);
      if (d < 1900) return p;
    }
    return this.randomStreetPoint(avoidX, avoidY, minDist);
  }

  randomStreetPoint(avoidX, avoidY, minDist) {
    for (let tries = 0; tries < 50; tries++) {
      const s = Utils.pick(this.streets);
      const x = Utils.rand(s.x + 50, s.x + s.w - 50);
      const y = Utils.rand(s.y + 50, s.y + s.h - 50);
      if (this.inSafeZone(x, y, CONFIG.spawn.safeSpawnPadding)) continue;
      if (Utils.dist(x, y, avoidX, avoidY) < minDist) continue;
      return { x, y };
    }
    return { x: this.w / 2, y: this.h / 2 };
  }

  renderBackground(ctx, cam) {
    ctx.fillStyle = CONFIG.world.backgroundColor;
    ctx.fillRect(0, 0, cam.viewW, cam.viewH);
  }
}
