/* Models — Three.js mesh builders for actors and effects.
 * All models face +Z (forward). Limbs pivot from their joints so the walk
 * animation in Renderer3D can swing them. Heights are in world units (1:1 to Y).
 */
const Models = {
  _shade(hex, f) {
    const n = parseInt(String(hex).replace('#', ''), 16);
    const r = Math.min(255, Math.round(((n >> 16) & 255) * f));
    const g = Math.min(255, Math.round(((n >> 8) & 255) * f));
    const b = Math.min(255, Math.round((n & 255) * f));
    return (r << 16) | (g << 8) | b;
  },
  _mat(color, opts = {}) {
    return new THREE.MeshStandardMaterial({
      color, roughness: opts.rough != null ? opts.rough : 0.85, metalness: opts.metal || 0.05,
      emissive: opts.emissive || 0x000000, emissiveIntensity: opts.emissiveIntensity || 0,
      flatShading: true,
    });
  },
  _limb(len, w, d, color) {
    const grp = new THREE.Group();
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, len, d), this._mat(color));
    m.position.y = -len / 2; m.castShadow = true;
    grp.add(m);
    return grp;
  },

  // Generic humanoid. opts: H, body, leg, head, arm, weapon(bool), hunch, eyes
  _humanoid(opts) {
    const H = opts.H;
    const g = new THREE.Group();
    const legLen = H * 0.4, legW = H * 0.15;
    const torsoH = H * 0.36, torsoW = H * 0.52, torsoD = H * 0.3;
    const headR = H * 0.15;
    const armLen = H * 0.36, armW = H * 0.13;
    const hipY = legLen, shoulderY = legLen + torsoH * 0.82;

    const legL = this._limb(legLen, legW, legW, this._shade(opts.leg, 1));
    legL.position.set(-torsoW * 0.26, hipY, 0);
    const legR = this._limb(legLen, legW, legW, this._shade(opts.leg, 1));
    legR.position.set(torsoW * 0.26, hipY, 0);
    g.add(legL, legR);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, torsoD), this._mat(opts.body, { emissive: 0xff3030 }));
    torso.position.y = hipY + torsoH / 2;
    torso.userData.baseY = torso.position.y;
    torso.castShadow = true;
    if (opts.hunch) torso.rotation.x = 0.28;
    g.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 12, 10), this._mat(opts.head));
    head.position.set(0, hipY + torsoH + headR * 0.72 - (opts.hunch ? headR * 0.4 : 0), opts.hunch ? torsoD * 0.4 : 0);
    head.castShadow = true;
    g.add(head);

    if (opts.eyes) {
      const eyeMat = this._mat(0x000000, { emissive: opts.eyes, emissiveIntensity: 1.6 });
      for (const sx of [-1, 1]) {
        const eye = new THREE.Mesh(new THREE.SphereGeometry(headR * 0.22, 8, 8), eyeMat);
        eye.position.set(sx * headR * 0.4, head.position.y + headR * 0.1, headR * 0.85 + (opts.hunch ? torsoD * 0.4 : 0));
        g.add(eye);
      }
    }

    const armL = this._limb(armLen, armW, armW, this._shade(opts.arm, 0.9));
    armL.position.set(-(torsoW / 2 + armW * 0.4), shoulderY, 0);
    const armR = this._limb(armLen, armW, armW, this._shade(opts.arm, 0.9));
    armR.position.set(torsoW / 2 + armW * 0.4, shoulderY, 0);
    g.add(armL, armR);

    if (opts.weapon) {
      // aiming right arm forward; actual weapon mesh is attached/swapped by
      // Renderer3D via Models.weaponMesh (named 'heldWeapon')
      armR.rotation.x = -1.25; armR.userData.aim = true;
      const gun = new THREE.Mesh(new THREE.BoxGeometry(armW * 0.6, armW * 0.6, armLen * 0.9),
        this._mat(0x2a2c30, { metal: 0.6, rough: 0.4 }));
      gun.name = 'heldWeapon';
      gun.position.set(0, -armLen, armLen * 0.5);
      gun.castShadow = true;
      armR.add(gun);
    } else {
      // clawed forward reach for the infected
      armL.rotation.x = -0.8; armR.rotation.x = -0.9;
    }

    g.userData.parts = { legL, legR, armL, armR, torso, head, torsoEmissive: 0 };
    return g;
  },

  human(cls) {
    return this._humanoid({
      H: 46, body: cls.color, leg: this._shade(cls.color, 0.5),
      head: 0xc9a98a, arm: cls.color, weapon: true,
    });
  },

  _walkerModel(cfg) {
    const p = cfg.palette;
    const H = 30 + cfg.radius * 0.9;
    const g = new THREE.Group();
    const legLen = H * 0.42, legW = H * 0.12;
    const torsoH = H * 0.38, torsoW = H * 0.42, torsoD = H * 0.26;
    const headR = H * 0.14;
    const armLen = H * 0.38, armW = H * 0.1;
    const hipY = legLen, shoulderY = legLen + torsoH * 0.8;

    const legL = this._limb(legLen, legW, legW, this._shade(p.dark, 1));
    legL.position.set(-torsoW * 0.28, hipY, 0);
    const legR = this._limb(legLen, legW, legW, this._shade(p.dark, 1));
    legR.position.set(torsoW * 0.28, hipY, 0);
    g.add(legL, legR);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, torsoD), this._mat(p.body, { emissive: 0xff3030 }));
    torso.position.y = hipY + torsoH / 2;
    torso.userData.baseY = torso.position.y;
    torso.castShadow = true;
    torso.rotation.x = 0.15;
    g.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 12, 10), this._mat(p.head));
    head.position.set(0, hipY + torsoH + headR * 0.7 - headR * 0.2, torsoD * 0.2);
    head.castShadow = true;
    g.add(head);

    const armL = this._limb(armLen, armW, armW, this._shade(p.body, 0.9));
    armL.position.set(-(torsoW / 2 + armW * 0.35), shoulderY, 0);
    armL.rotation.x = -0.7;
    const armR = this._limb(armLen, armW, armW, this._shade(p.body, 0.9));
    armR.position.set(torsoW / 2 + armW * 0.35, shoulderY, 0);
    armR.rotation.x = -0.8;
    g.add(armL, armR);

    g.userData.parts = { legL, legR, armL, armR, torso, head, torsoEmissive: 0 };
    return g;
  },

  _leaperModel(cfg) {
    const p = cfg.palette;
    const H = 30 + cfg.radius * 0.9;
    const g = new THREE.Group();
    const legLen = H * 0.36, legW = H * 0.11;
    const torsoH = H * 0.32, torsoW = H * 0.38, torsoD = H * 0.24;
    const headR = H * 0.13;
    const armLen = H * 0.5, armW = H * 0.085;
    const hipY = legLen, shoulderY = legLen + torsoH * 0.75;

    const legL = this._limb(legLen, legW, legW, this._shade(p.dark, 1));
    legL.position.set(-torsoW * 0.3, hipY, 0);
    const legR = this._limb(legLen, legW, legW, this._shade(p.dark, 1));
    legR.position.set(torsoW * 0.3, hipY, 0);
    g.add(legL, legR);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, torsoD), this._mat(p.body, { emissive: 0xff3030 }));
    torso.position.y = hipY + torsoH / 2;
    torso.userData.baseY = torso.position.y;
    torso.castShadow = true;
    torso.rotation.x = 0.35;
    g.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 12, 10), this._mat(p.head));
    head.position.set(0, hipY + torsoH + headR * 0.6 - headR * 0.5, torsoD * 0.5);
    head.castShadow = true;
    g.add(head);

    const armL = this._limb(armLen, armW, armW, this._shade(p.body, 0.85));
    armL.position.set(-(torsoW / 2 + armW * 0.3), shoulderY + H * 0.05, -torsoD * 0.2);
    armL.rotation.x = -0.95;
    const armR = this._limb(armLen, armW, armW, this._shade(p.body, 0.85));
    armR.position.set(torsoW / 2 + armW * 0.3, shoulderY + H * 0.05, -torsoD * 0.2);
    armR.rotation.x = -1.0;
    g.add(armL, armR);

    g.userData.parts = { legL, legR, armL, armR, torso, head, torsoEmissive: 0 };
    return g;
  },

  _bloaterModel(cfg) {
    const p = cfg.palette;
    const H = 30 + cfg.radius * 0.9;
    const g = new THREE.Group();
    const legLen = H * 0.35, legW = H * 0.16;
    const torsoH = H * 0.32, torsoW = H * 0.68, torsoD = H * 0.48;
    const headR = H * 0.16;
    const armLen = H * 0.3, armW = H * 0.14;
    const hipY = legLen, shoulderY = legLen + torsoH * 0.75;

    const legL = this._limb(legLen, legW, legW, this._shade(p.dark, 1));
    legL.position.set(-torsoW * 0.25, hipY, 0);
    const legR = this._limb(legLen, legW, legW, this._shade(p.dark, 1));
    legR.position.set(torsoW * 0.25, hipY, 0);
    g.add(legL, legR);

    const torso = new THREE.Mesh(new THREE.BoxGeometry(torsoW, torsoH, torsoD), this._mat(p.body, { emissive: 0xff3030 }));
    torso.position.y = hipY + torsoH / 2;
    torso.userData.baseY = torso.position.y;
    torso.castShadow = true;
    g.add(torso);

    const abdomen = new THREE.Mesh(new THREE.SphereGeometry(torsoW * 0.42, 10, 8), this._mat(this._shade(p.body, 1.1)));
    abdomen.position.y = hipY + torsoH * 0.3;
    abdomen.scale.set(1, 0.9, 0.9);
    abdomen.castShadow = true;
    g.add(abdomen);

    const head = new THREE.Mesh(new THREE.SphereGeometry(headR, 12, 10), this._mat(p.head));
    head.position.set(0, hipY + torsoH + headR * 0.6, 0);
    head.castShadow = true;
    g.add(head);

    const armL = this._limb(armLen, armW, armW, this._shade(p.body, 0.9));
    armL.position.set(-(torsoW / 2 + armW * 0.4), shoulderY, 0);
    armL.rotation.x = -0.6;
    const armR = this._limb(armLen, armW, armW, this._shade(p.body, 0.9));
    armR.position.set(torsoW / 2 + armW * 0.4, shoulderY, 0);
    armR.rotation.x = -0.65;
    g.add(armL, armR);

    g.userData.parts = { legL, legR, armL, armR, torso, head, torsoEmissive: 0 };
    return g;
  },

  zombie(cfg) {
    const typeId = cfg.id;
    const model = cfg.model;
    if (typeId === 'walker') return this._walkerModel(cfg);
    if (typeId === 'runner') return this._leaperModel(cfg);
    if (typeId === 'bloat') return this._bloaterModel(cfg);
    if (typeId === 'crawler') return this._crawlerModel(cfg);
    if (model === 'wraith') return this._wraithModel(cfg);
    if (model === 'spitter') return this._spitterModel(cfg);
    if (model === 'screamer') return this._screamerModel(cfg);
    if (model === 'ravager') return this._ravagerModel(cfg);

    const p = cfg.palette;
    const g = this._humanoid({
      H: 30 + cfg.radius * 0.9, body: p.body, leg: p.dark, head: p.head,
      arm: p.body, weapon: false, hunch: true,
    });
    return g;
  },

  // CRAWLER — a legless torso flat on the ground, dragging itself by the arms.
  _crawlerModel(cfg) {
    const p = cfg.palette;
    const g = new THREE.Group();
    const L = 26;
    const torso = new THREE.Mesh(new THREE.BoxGeometry(12, 7, L), this._mat(p.body, { emissive: 0xff3030 }));
    torso.position.set(0, 5, -4);
    torso.rotation.x = 0.12;   // hips dragging behind
    torso.userData.baseY = torso.position.y;
    torso.castShadow = true;
    g.add(torso);
    // ragged stump trailing
    const stump = new THREE.Mesh(new THREE.BoxGeometry(9, 5, 10), this._mat(this._shade(p.dark, 0.9)));
    stump.position.set(0, 3.5, -16);
    stump.castShadow = true;
    g.add(stump);
    const head = new THREE.Mesh(new THREE.SphereGeometry(5.4, 10, 8), this._mat(p.head));
    head.position.set(0, 7.5, 10);
    head.castShadow = true;
    g.add(head);
    // dragging arms reach FORWARD along the ground — these animate as "legs"
    const armL = this._limb(14, 3.4, 3.4, this._shade(p.body, 0.85));
    armL.position.set(-7, 9, 8); armL.rotation.x = -1.9;
    const armR = this._limb(14, 3.4, 3.4, this._shade(p.body, 0.85));
    armR.position.set(7, 9, 8); armR.rotation.x = -1.6;
    g.add(armL, armR);
    g.userData.parts = { legL: armL, legR: armR, torso, head, torsoEmissive: 0 };
    return g;
  },

  // WRAITH — four-armed sprinter. Two extra arm pairs give it an unmistakable
  // spider-limbed silhouette even at fog distance.
  _wraithModel(cfg) {
    const p = cfg.palette;
    const g = this._humanoid({
      H: 30 + cfg.radius * 1.1, body: p.body, leg: p.dark, head: p.head,
      arm: p.body, weapon: false, hunch: true, eyes: 0xaad4ff,
    });
    const parts = g.userData.parts;
    const H = 30 + cfg.radius * 1.1;
    const armLen = H * 0.42, armW = H * 0.09;
    // second, higher pair of arms angled outward
    for (const sx of [-1, 1]) {
      const arm = this._limb(armLen, armW, armW, this._shade(p.dark, 1.1));
      arm.position.set(sx * H * 0.26, parts.torso.position.y + H * 0.14, 0);
      arm.rotation.x = -1.1;
      arm.rotation.z = sx * 0.55;
      g.add(arm);
      if (sx < 0) parts.armL2 = arm; else parts.armR2 = arm;
    }
    // gaunt elongated neck
    parts.head.position.y += H * 0.08;
    return g;
  },

  // SPITTER — distended glowing throat sac you can spot before it sprays.
  _spitterModel(cfg) {
    const p = cfg.palette;
    const g = this._humanoid({
      H: 30 + cfg.radius * 0.9, body: p.body, leg: p.dark, head: p.head,
      arm: p.body, weapon: false, hunch: true,
    });
    const parts = g.userData.parts;
    const H = 30 + cfg.radius * 0.9;
    const sac = new THREE.Mesh(new THREE.SphereGeometry(H * 0.16, 10, 8),
      this._mat(0x8fdf5a, { emissive: 0x4f9f2f, emissiveIntensity: 0.8 }));
    sac.position.set(0, parts.head.position.y - H * 0.14, H * 0.14);
    sac.scale.set(1, 1.2, 1);
    sac.castShadow = true;
    g.add(sac);
    parts.sac = sac;
    return g;
  },

  // SCREAMER — skeletal frame, huge unhinged jaw, pale banshee tint.
  _screamerModel(cfg) {
    const p = cfg.palette;
    const g = this._humanoid({
      H: 30 + cfg.radius * 1.05, body: p.body, leg: p.dark, head: p.head,
      arm: p.body, weapon: false, hunch: false, eyes: 0xffb0c0,
    });
    const parts = g.userData.parts;
    const H = 30 + cfg.radius * 1.05;
    parts.torso.scale.set(0.7, 1.05, 0.7);   // emaciated
    const jaw = new THREE.Mesh(new THREE.BoxGeometry(H * 0.14, H * 0.2, H * 0.1),
      this._mat(this._shade(p.head, 0.8)));
    jaw.position.set(0, parts.head.position.y - H * 0.16, H * 0.1);
    jaw.castShadow = true;
    g.add(jaw);
    return g;
  },

  // RAVAGER — one grotesquely overgrown charging shoulder.
  _ravagerModel(cfg) {
    const p = cfg.palette;
    const g = this._humanoid({
      H: 30 + cfg.radius * 0.95, body: p.body, leg: p.dark, head: p.head,
      arm: p.body, weapon: false, hunch: true,
    });
    const parts = g.userData.parts;
    const H = 30 + cfg.radius * 0.95;
    const shoulder = new THREE.Mesh(new THREE.SphereGeometry(H * 0.22, 10, 8),
      this._mat(this._shade(p.body, 0.75), { rough: 0.6 }));
    shoulder.position.set(H * 0.24, parts.torso.position.y + H * 0.1, H * 0.06);
    shoulder.scale.set(1.15, 1, 1);
    shoulder.castShadow = true;
    g.add(shoulder);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(H * 0.06, H * 0.2, 6), this._mat(0xd8d0c0));
    spike.position.set(H * 0.3, parts.torso.position.y + H * 0.22, H * 0.08);
    spike.rotation.z = -0.5;
    g.add(spike);
    return g;
  },

  boss(cfg) {
    const p = cfg.palette;
    const H = 30 + cfg.radius * 1.5;
    const g = this._humanoid({
      H, body: p.body, leg: p.dark, head: p.head, arm: p.body,
      weapon: false, hunch: true, eyes: 0xff3018,
    });
    // shoulder pauldrons + horns for bulk
    const parts = g.userData.parts;
    const pMat = this._mat(this._shade(p.body, 0.7), { rough: 0.7 });
    for (const sx of [-1, 1]) {
      const pauld = new THREE.Mesh(new THREE.SphereGeometry(H * 0.16, 10, 8), pMat);
      pauld.position.set(sx * H * 0.3, parts.torso.position.y + H * 0.12, 0);
      pauld.castShadow = true; g.add(pauld);
      const horn = new THREE.Mesh(new THREE.ConeGeometry(H * 0.05, H * 0.22, 8), this._mat(0xe8e0d0));
      horn.position.set(sx * H * 0.09, parts.head.position.y + H * 0.14, parts.head.position.z);
      horn.rotation.z = sx * -0.4; horn.castShadow = true; g.add(horn);
    }
    g.userData.parts.torsoEmissive = 0.15;
    parts.torso.material.emissive = new THREE.Color(0x501010);
    parts.torso.material.emissiveIntensity = 0.15;
    return g;
  },

  // Elite variant treatment: Rabid (special) get a hot red glow, Irradiated
  // get a sickly green radiance that bloom picks up in the dark.
  applyVariant(mesh, variantId) {
    const v = (typeof ELITE_VARIANTS !== 'undefined') ? ELITE_VARIANTS[variantId] : null;
    if (!v) return;
    mesh.traverse((n) => {
      if (!n.material || !n.material.emissive) return;
      n.material.emissive = new THREE.Color(v.glow || 0x333333);
      n.material.emissiveIntensity = variantId === 'irradiated' ? 0.55 : 0.3;
    });
    const parts = mesh.userData.parts;
    if (parts) parts.torsoEmissive = variantId === 'irradiated' ? 0.55 : 0.3;
    // slightly bigger silhouette so elites read at a glance (renderer re-applies
    // this base scale every frame via userData.baseScale)
    const s = variantId === 'irradiated' ? 1.14 : 1.08;
    mesh.userData.baseScale = s;
    mesh.scale.multiplyScalar(s);
  },

  // Distinct held-weapon models, built to hang off the aiming right arm.
  // Forward is +Z (same as the arm's reach); sized for the H=46 player rig.
  // Generated catalogue weapons carry a `model` tag pointing at one of the
  // hand-built archetype meshes below.
  weaponMesh(weaponId) {
    const wDef = (typeof WEAPONS !== 'undefined') ? WEAPONS[weaponId] : null;
    if (wDef && wDef.model) weaponId = wDef.model;
    const g = new THREE.Group();
    const metal = (c) => this._mat(c, { metal: 0.65, rough: 0.35 });
    const wood = (c) => this._mat(c, { rough: 0.8 });
    const box = (w, h, d, mat, x, y, z) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
      m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
    };
    const cyl = (r, len, mat, x, y, z, alongZ = true) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 8), mat);
      if (alongZ) m.rotation.x = Math.PI / 2;
      m.position.set(x, y, z); m.castShadow = true; g.add(m); return m;
    };
    switch (weaponId) {
      case 'pistol':
        box(1.6, 1.6, 7, metal(0x2a2c30), 0, 0, 3.5);
        box(1.4, 3.4, 1.8, metal(0x1c1e22), 0, -2, 0.6);
        break;
      case 'revolver':
        box(1.6, 1.6, 8, metal(0x8a8a92), 0, 0, 4);
        cyl(1.5, 2.2, metal(0x6a6a72), 0, -0.4, 2);
        box(1.4, 3, 1.8, wood(0x6a4a2a), 0, -2, 0.4);
        break;
      case 'smg':
        box(2, 2.2, 10, metal(0x3a3f46), 0, 0, 4.5);
        box(1.4, 5, 1.8, metal(0x22252a), 0, -3, 2.5);   // long magazine
        box(1.4, 1.4, 4, metal(0x22252a), 0, 0.2, -2.5); // stock
        break;
      case 'huntingrifle':
        cyl(0.7, 16, metal(0x3a3630), 0, 0.2, 8);
        box(1.8, 2, 9, wood(0x6a4a2a), 0, -0.8, 3);
        cyl(0.9, 3.5, metal(0x1c1e22), 0, 1.8, 5);       // scope
        break;
      case 'ar15':
        box(1.8, 2, 13, metal(0x2c2f34), 0, 0, 6);
        box(1.4, 4.4, 2, metal(0x1c1e22), 0, -2.6, 4);   // curved mag (approx)
        box(1.2, 2.4, 1.6, metal(0x1c1e22), 0, 1.8, 4);  // carry handle
        box(1.6, 1.6, 4, metal(0x2c2f34), 0, 0, -2.4);   // stock
        break;
      case 'sawnoff':
        cyl(0.8, 7, metal(0x4a4038), -0.85, 0, 3.5);
        cyl(0.8, 7, metal(0x4a4038), 0.85, 0, 3.5);      // double barrel
        box(2.4, 2, 3.4, wood(0x6a4a2a), 0, -0.6, -0.5);
        break;
      case 'pumpshotgun':
        cyl(0.9, 13, metal(0x3a3428), 0, 0.2, 6.5);
        cyl(1.1, 4, wood(0x7a5a3a), 0, -1.2, 5);         // pump grip
        box(1.8, 2, 5, wood(0x6a4a2a), 0, -0.4, -1.5);
        break;
      case 'launcher':   // M79 — fat stubby tube on a wooden stock
        cyl(1.9, 9, metal(0x3a4030), 0, 0, 4.5);
        box(1.8, 2, 4, wood(0x6a4a2a), 0, -0.8, -1.5);
        break;
      case 'rpg':        // long shoulder tube with a bulbous warhead
        cyl(1.3, 16, metal(0x4a4a42), 0, 0.5, 6);
        cyl(2.2, 4, metal(0x6a3a2a), 0, 0.5, 14.5);
        box(1.4, 3, 2, metal(0x2a2c30), 0, -1.6, 2);
        break;
      case 'flamethrower': // twin tanks + nozzle with pilot light
        cyl(1.6, 7, metal(0x8a3a20), -1.2, 0.5, -1, false);
        cyl(1.6, 7, metal(0x6a5a20), 1.2, 0.5, -1, false);
        cyl(0.7, 9, metal(0x2a2c30), 0, 0, 5);
        box(1.2, 1.2, 1.2, this._mat(0xff9a30, { emissive: 0xff7a20, emissiveIntensity: 1.4 }), 0, 0, 9.6);
        break;
      case 'minigun': {
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          cyl(0.55, 12, metal(0x4a4a30), Math.cos(a) * 1.5, Math.sin(a) * 1.5, 6);
        }
        cyl(2.4, 3.5, metal(0x33331f), 0, 0, 0);          // rotor housing
        box(2.6, 3.4, 3, metal(0x2a2a1a), 0, -1.4, -2);
        break;
      }
      // --- melee ---
      case 'melee':      // baseball bat
        cyl(0.9, 13, wood(0x9c7b4a), 0, 0, 6.5); break;
      case 'combatknife':
        box(0.5, 1.6, 6, metal(0xb8bec6), 0, 0, 4);
        box(1, 1.4, 2.2, metal(0x1c1e22), 0, 0, 0.2); break;
      case 'machete':
        box(0.4, 2.6, 9, metal(0x9aa0a6), 0, 0, 5.5);
        box(1, 1.6, 2.6, wood(0x4a3a26), 0, 0, 0.2); break;
      case 'crowbar': {
        const m = cyl(0.6, 11, metal(0xa03a34), 0, 0, 5.5);
        const hook = cyl(0.6, 3.4, metal(0xa03a34), 0, 1.1, 10.4); hook.rotation.x = 0; hook.rotation.z = Math.PI / 2;
        break;
      }
      case 'sledgehammer':
        cyl(0.7, 13, wood(0x7a5a3a), 0, 0, 6);
        box(3.6, 2.4, 2.4, metal(0x5a5a62), 0, 0, 12); break;
      case 'wrench':
        cyl(0.7, 9, metal(0x8a4a2a), 0, 0, 4.5);
        box(2.4, 1, 2.4, metal(0x8a4a2a), 0, 0, 9.4); break;
      case 'fireaxe':
        cyl(0.65, 12, wood(0x8a3a2a), 0, 0, 6);
        box(0.8, 3.6, 3, metal(0xb0b6bc), 1, 0, 11); break;
      default:
        box(1.2, 1.2, 6, metal(0x2a2c30), 0, 0, 3);
    }
    return g;
  },

  tracer() {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.BoxGeometry(2.5, 2.5, 26),
      new THREE.MeshStandardMaterial({ color: 0xfff2b0, emissive: 0xffcf4a, emissiveIntensity: 1.6 }));
    g.add(core);
    return g;
  },

  bile() {
    const g = new THREE.Group();
    const core = new THREE.Mesh(new THREE.SphereGeometry(6, 10, 8),
      new THREE.MeshStandardMaterial({ color: 0x7ad46a, emissive: 0x4f9f3f, emissiveIntensity: 1.1 }));
    g.add(core);
    return g;
  },

  // Lucy the husky — a proper low, forward-facing dog with animated legs.
  husky() {
    const g = new THREE.Group();
    const coat = 0xbfc4cc, coatDark = 0x5f6670, belly = 0xe6eaef, face = 0x33383f;
    const legLen = 11, legW = 3.6;
    const bodyLen = 26, bodyW = 11, bodyH = 11;
    const backY = legLen + bodyH / 2;

    const body = new THREE.Mesh(new THREE.BoxGeometry(bodyW, bodyH, bodyLen), this._mat(coat, { rough: 0.85 }));
    body.position.set(0, backY, 0); body.castShadow = true; g.add(body);
    const bel = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.82, bodyH * 0.42, bodyLen * 0.82), this._mat(belly, { rough: 0.9 }));
    bel.position.set(0, legLen + bodyH * 0.2, 0); g.add(bel);
    // dark saddle along the back
    const saddle = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.7, bodyH * 0.4, bodyLen * 0.7), this._mat(coatDark));
    saddle.position.set(0, backY + bodyH * 0.32, 0); g.add(saddle);

    const mkLeg = (x, z) => { const l = this._limb(legLen, legW, legW, coatDark); l.position.set(x, legLen, z); return l; };
    const legL = mkLeg(-bodyW * 0.32, bodyLen * 0.34);   // front-left
    const legR = mkLeg(bodyW * 0.32, bodyLen * 0.34);    // front-right
    const armL = mkLeg(-bodyW * 0.32, -bodyLen * 0.34);  // back-left
    const armR = mkLeg(bodyW * 0.32, -bodyLen * 0.34);   // back-right
    g.add(legL, legR, armL, armR);

    const neck = new THREE.Mesh(new THREE.BoxGeometry(bodyW * 0.7, bodyH * 0.7, 7), this._mat(coat));
    neck.position.set(0, backY + 3, bodyLen * 0.44); neck.rotation.x = -0.35; neck.castShadow = true; g.add(neck);
    const headR = 6.5;
    const head = new THREE.Mesh(new THREE.BoxGeometry(headR * 1.4, headR * 1.4, headR * 1.5), this._mat(coat));
    head.position.set(0, backY + 5, bodyLen * 0.56); head.castShadow = true; g.add(head);
    const snout = new THREE.Mesh(new THREE.BoxGeometry(headR * 0.7, headR * 0.6, headR), this._mat(face));
    snout.position.set(0, backY + 3.6, bodyLen * 0.64); g.add(snout);
    const earMat = this._mat(coatDark);
    for (const sx of [-1, 1]) {
      const ear = new THREE.Mesh(new THREE.ConeGeometry(headR * 0.4, headR, 4), earMat);
      ear.position.set(sx * headR * 0.5, backY + 5 + headR * 0.85, bodyLen * 0.5);
      ear.castShadow = true; g.add(ear);
    }
    const eyeMat = this._mat(0x0a0a0e, { emissive: 0x223, emissiveIntensity: 0.5 });
    for (const sx of [-1, 1]) {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 8), eyeMat);
      eye.position.set(sx * headR * 0.4, backY + 6, bodyLen * 0.61); g.add(eye);
    }
    const tail = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.4, 12), this._mat(coat));
    tail.position.set(0, backY + 4, -bodyLen * 0.56); tail.rotation.x = 0.85; tail.castShadow = true; g.add(tail);

    g.userData.parts = { legL, legR, armL, armR };
    g.userData.gait = { rate: 1.4, swing: 0.55, arm: 1, bob: 0 };
    return g;
  },


  // Outpost guard, tinted and shaped by class (assault/shotgun/sniper/heavy/elite).
  guard(cls) {
    const c = cls || { color: 0x2d5a1a, helmet: 0x5a6a6a };
    const g = this._humanoid({
      H: c.big ? 52 : 46, body: c.color, leg: this._shade(c.color, 0.5),
      head: 0xc9a98a, arm: c.color, weapon: true,
    });
    const parts = g.userData.parts;
    const H = c.big ? 52 : 46;
    // helmet dome, class-coloured
    const helmet = new THREE.Mesh(new THREE.SphereGeometry(H * 0.17, 10, 8), this._mat(c.helmet, { rough: 0.5 }));
    helmet.position.copy(parts.head.position);
    helmet.position.y += H * 0.03;
    helmet.scale.set(1, 0.8, 1);
    helmet.castShadow = true;
    g.add(helmet);
    // snipers get a long barrel; heavies get a fat one
    if (c.id === 'sniper') {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 18, 8), this._mat(0x2a2c30, { metal: 0.6, rough: 0.4 }));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, -H * 0.36, 10);
      parts.armR.add(barrel);
    } else if (c.id === 'heavy') {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 12, 8), this._mat(0x33331f, { metal: 0.6, rough: 0.4 }));
      barrel.rotation.x = Math.PI / 2;
      barrel.position.set(0, -H * 0.36, 8);
      parts.armR.add(barrel);
    } else if (c.id === 'elite') {
      // red shoulder pauldron marks the commander
      const pauld = new THREE.Mesh(new THREE.SphereGeometry(H * 0.12, 8, 8), this._mat(0xa03030, { rough: 0.5 }));
      pauld.position.set(-H * 0.28, parts.torso.position.y + H * 0.12, 0);
      g.add(pauld);
    }
    return g;
  },

  dispose(obj) {
    obj.traverse((n) => {
      if (n.geometry) n.geometry.dispose();
      if (n.material) {
        if (Array.isArray(n.material)) n.material.forEach(m => m.dispose());
        else n.material.dispose();
      }
    });
  },
};
