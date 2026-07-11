/* Final full-screen grade: film grain + vignette + gentle desaturate/contrast.
 * Runs as the last pass of the post chain (replaces the old CSS filter). */
const DZGradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    time: { value: 0 },
    grainAmt: { value: 0.035 },
    vigAmt: { value: 0.28 },
  },
  vertexShader: `varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `varying vec2 vUv;
    uniform sampler2D tDiffuse; uniform float time; uniform float grainAmt; uniform float vigAmt;
    float rnd(vec2 c) { return fract(sin(dot(c, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec4 col = texture2D(tDiffuse, vUv);
      float l = dot(col.rgb, vec3(0.299, 0.587, 0.114));
      col.rgb = mix(vec3(l), col.rgb, 0.92);             // gentle desaturate
      col.rgb = (col.rgb - 0.5) * 1.06 + 0.5;            // contrast
      col.rgb *= vec3(1.02, 1.0, 0.96);                  // warm-dirty tint
      col.rgb += (rnd(vUv * 1913.0 + fract(time) * 7.0) - 0.5) * grainAmt;  // grain
      float d = distance(vUv, vec2(0.5));
      col.rgb *= mix(1.0, smoothstep(0.98, 0.5, d), vigAmt);               // soft vignette
      gl_FragColor = col;
    }`,
};

/* Renderer3D — real 3D rendering with Three.js (vendored, global THREE).
 *
 * Game logic stays cartesian: world (x, y) is the ground plane, height is up.
 * Mapping to Three.js space: world (x, y, h) -> THREE (x, h, y)  (y-up, XZ ground).
 *
 * Dense city rendering: hundreds of filler buildings / wrecks / rubble are drawn
 * as a handful of InstancedMesh draw calls; only enterable landmarks get the
 * detailed multi-mesh treatment. Adds weather (rain/storm + lightning), pooled
 * blood decals, muzzle-flash lighting and shockwave rings.
 */
class Renderer3D {
  constructor(canvas) {
    this.canvas = canvas;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(1);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.outputEncoding = THREE.sRGBEncoding;

    this.renderScale = 1;
    this._aa = true;
    this.renderDistance = 5200;
    this.shadowQuality = 'high';
    this._curOverworld = true;
    this.cssW = canvas.width;
    this.cssH = canvas.height;

    this.scene3 = new THREE.Scene();
    this.scene3.background = new THREE.Color('#0c0e11');
    this.scene3.fog = new THREE.Fog('#0c0e11', 1600, 5200);

    // Near-top-down, player-centred (Dead Frontier-style overhead angle)
    this.camera = new THREE.PerspectiveCamera(46, 1, 1, 12000);
    this.camOffset = new THREE.Vector3(0, 1080, 470);
    this.camFocus = new THREE.Vector3(0, 0, 0);
    this.camPos = new THREE.Vector3(0, 1080, 470);

    // Lighting — grimy but readable
    const hemi = new THREE.HemisphereLight('#9aa0ac', '#3a3028', 0.7);
    this.scene3.add(hemi);
    this.ambient = hemi;

    const sun = new THREE.DirectionalLight('#ffe6c0', 1.05);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.near = 1; sc.far = 3000; sc.left = -1100; sc.right = 1100; sc.top = 1100; sc.bottom = -1100;
    sun.shadow.bias = -0.0004;
    this.sun = sun;
    this.scene3.add(sun);
    this.scene3.add(sun.target);

    // Root groups
    this.staticGroup = new THREE.Group();   // scene geometry (rebuilt per scene)
    this.dynGroup = new THREE.Group();      // entities (persist, synced each frame)
    this.fxGroup = new THREE.Group();       // decals / shockwaves (rebuilt per scene)
    this.scene3.add(this.staticGroup, this.dynGroup, this.fxGroup);

    // Player torch + cone flashlight
    this.torch = new THREE.PointLight('#ffe1b0', 0.12, 340, 1.6);
    this.torch.position.set(0, 55, 0);
    this.scene3.add(this.torch);

    this.torchCone = new THREE.SpotLight('#fff0cf', 0, 900, Math.PI * 0.16, 0.45, 1.2);
    this.torchCone.position.set(0, 90, 0);
    this.torchTarget = new THREE.Object3D();
    this.scene3.add(this.torchCone, this.torchTarget);
    this.torchCone.target = this.torchTarget;
    this._torchNight = 0.12;

    // Muzzle flash light — repositioned to the gun on every shot, fast decay.
    this.muzzle = new THREE.PointLight('#ffcf8a', 0, 300, 2.0);
    this.muzzle.position.set(0, 42, 0);
    this.scene3.add(this.muzzle);

    // Weather + FX state
    this.rain = null;
    this.weatherTarget = 0;      // 0 clear .. 1 storm downpour
    this.weatherIntensity = 0;
    this._lightning = 0;
    this._lightningCooldown = 4;
    this.decals = [];
    this._decalIdx = 0;
    this.shockwaves = [];
    this.shake = 0;              // camera kick (recoil / explosions)

    // Fire + streetlight pools: a handful of REAL lights roam to the nearest
    // burning wrecks / lit lamps around the player. Cheap, dramatic.
    this.fires = [];             // {x, y, mat} flame markers (materials flicker)
    this.flashers = [];          // police light bars {mat, phase}
    this.fireLights = [];
    for (let i = 0; i < (CONFIG.render.fireLightPool || 5); i++) {
      const l = new THREE.PointLight('#ff8a30', 0, 260, 1.9);
      l.position.set(0, -9999, 0);
      this.scene3.add(l);
      this.fireLights.push(l);
    }
    this.streetLights = [];
    for (let i = 0; i < (CONFIG.render.streetLightPool || 4); i++) {
      const l = new THREE.PointLight('#ffc978', 0, 330, 1.7);
      l.position.set(0, -9999, 0);
      this.scene3.add(l);
      this.streetLights.push(l);
    }
    this.acidMeshes = [];        // pooled green pools synced to entities.acidPools

    // Filmic tone mapping + post chain: bloom → grade (grain/vignette)
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.35;
    this.composer = null;
    if (THREE.EffectComposer && THREE.UnrealBloomPass && THREE.ShaderPass) {
      this.composer = new THREE.EffectComposer(this.renderer);
      this.composer.addPass(new THREE.RenderPass(this.scene3, this.camera));
      this.bloom = new THREE.UnrealBloomPass(new THREE.Vector2(this.cssW, this.cssH), 0.45, 0.6, 0.82);
      this.composer.addPass(this.bloom);
      this.grade = new THREE.ShaderPass(DZGradeShader);
      this.composer.addPass(this.grade);
    }

    // Mesh registries
    this.zMeshes = new Map();
    this.bMeshes = new Map();
    this.pMeshes = new Map();
    this.gMeshes = new Map();
    this.companionMesh = null;
    this.containerMeshes = [];
    this.playerMesh = null;
    this.playerClass = null;

    this.labels = [];
    this.clock = new THREE.Clock();
    this.groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.raycaster = new THREE.Raycaster();
    this._v = new THREE.Vector3();
    this.occ = [];
    this.occRay = new THREE.Raycaster();
    this._occV = new THREE.Vector3();
    this._occDir = new THREE.Vector3();

    this._matCache = {};
    this._groundTexCache = {};
  }

  // Sobel a canvas heightfield into a tangent-space normal map.
  _normalFromCanvas(src, strength = 1.4) {
    const w = src.width, h = src.height;
    const img = src.getContext('2d').getImageData(0, 0, w, h).data;
    const out = document.createElement('canvas'); out.width = w; out.height = h;
    const octx = out.getContext('2d');
    const od = octx.createImageData(w, h);
    const hgt = (x, y) => { x = (x + w) % w; y = (y + h) % h; const i = (y * w + x) * 4; return (img[i] + img[i + 1] + img[i + 2]) / 765; };
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (hgt(x - 1, y) - hgt(x + 1, y)) * strength;
        const dy = (hgt(x, y - 1) - hgt(x, y + 1)) * strength;
        const inv = 1 / Math.sqrt(dx * dx + dy * dy + 1);
        const i = (y * w + x) * 4;
        od.data[i] = (dx * inv * 0.5 + 0.5) * 255;
        od.data[i + 1] = (dy * inv * 0.5 + 0.5) * 255;
        od.data[i + 2] = inv * 255;
        od.data[i + 3] = 255;
      }
    }
    octx.putImageData(od, 0, 0);
    const t = new THREE.CanvasTexture(out);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }

  _wallTexPair() {
    if (this._wallTex) return this._wallTex;
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = '#e2e2e2'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 2600; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, s = Math.random() * 2.2 + 0.4;
      g.fillStyle = Math.random() < 0.5 ? `rgba(0,0,0,${Math.random() * 0.12})` : `rgba(255,255,255,${Math.random() * 0.12})`;
      g.fillRect(x, y, s, s);
    }
    g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 2;
    for (let y = 0; y <= 256; y += 32) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    g.lineWidth = 1.5;
    for (let row = 0; row < 8; row++) {
      const off = (row % 2) * 32;
      for (let x = off; x <= 256; x += 64) {
        g.beginPath(); g.moveTo(x, row * 32); g.lineTo(x, row * 32 + 32); g.stroke();
      }
    }
    for (let i = 0; i < 12; i++) {
      const x = Math.random() * 256, len = 60 + Math.random() * 160;
      const grad = g.createLinearGradient(0, 0, 0, len);
      grad.addColorStop(0, `rgba(20,16,10,${0.16 + Math.random() * 0.15})`); grad.addColorStop(1, 'rgba(0,0,0,0)');
      g.save(); g.translate(x, Math.random() * 100); g.fillStyle = grad;
      g.fillRect(-3 - Math.random() * 4, 0, 6 + Math.random() * 8, len); g.restore();
    }
    const map = new THREE.CanvasTexture(c);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.repeat.set(2.5, 1.6);
    const normalMap = this._normalFromCanvas(c, 1.6);
    normalMap.repeat.copy(map.repeat);
    this._wallTex = { map, normalMap };
    return this._wallTex;
  }

  _groundTexture(interior) {
    const key = interior ? 'in' : 'out';
    if (this._groundTexCache[key]) return this._groundTexCache[key];
    const c = document.createElement('canvas'); c.width = c.height = 256;
    const g = c.getContext('2d');
    g.fillStyle = interior ? '#585a5e' : '#7a766a'; g.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 3000; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, s = Math.random() * 2 + 0.4;
      const dark = Math.random() < 0.5;
      g.fillStyle = dark ? `rgba(0,0,0,${Math.random() * 0.16})` : `rgba(210,196,168,${Math.random() * 0.16})`;
      g.fillRect(x, y, s, s);
    }
    for (let i = 0; i < 14; i++) {
      const x = Math.random() * 256, y = Math.random() * 256, r = Math.random() * 44 + 12;
      const rad = g.createRadialGradient(x, y, 0, x, y, r);
      rad.addColorStop(0, `rgba(12,9,6,${Math.random() * 0.34})`); rad.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = rad; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,0.3)'; g.lineWidth = 1;
    for (let i = 0; i < 12; i++) {
      g.beginPath(); let x = Math.random() * 256, y = Math.random() * 256; g.moveTo(x, y);
      for (let j = 0; j < 5; j++) { x += (Math.random() - 0.5) * 46; y += (Math.random() - 0.5) * 46; g.lineTo(x, y); }
      g.stroke();
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    this._groundTexCache[key] = tex;
    this._groundTexCache[key + '_norm'] = this._normalFromCanvas(c, 1.1);
    return tex;
  }

  _groundNormal(interior) {
    const key = (interior ? 'in' : 'out') + '_norm';
    if (!this._groundTexCache[key]) this._groundTexture(interior);
    return this._groundTexCache[key];
  }

  mat(key, opts) {
    if (!this._matCache[key]) this._matCache[key] = new THREE.MeshStandardMaterial(opts);
    return this._matCache[key];
  }

  resize(w, h) {
    this.cssW = w; this.cssH = h;
    this.renderer.setPixelRatio(this.renderScale * (this._aa ? 1.4 : 1));
    this.renderer.setSize(w, h, true);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    if (this.composer) {
      if (this.composer.setPixelRatio) this.composer.setPixelRatio(this.renderer.getPixelRatio());
      this.composer.setSize(w, h);
    }
  }

  // ---- Graphics settings ----
  setRenderDistance(units) {
    this.renderDistance = units;
    if (this._curOverworld) {
      this.camera.far = units * 1.7;
      this.camera.updateProjectionMatrix();
      if (this.scene3.fog) { this.scene3.fog.near = units * 0.32; this.scene3.fog.far = units; }
    }
  }
  setShadowQuality(q) {
    this.shadowQuality = q;
    const map = { off: 0, low: 512, medium: 1024, high: 2048 }[q];
    const on = q !== 'off';
    this.renderer.shadowMap.enabled = on;
    this.sun.castShadow = on;
    if (on && this.sun.shadow.mapSize.width !== map) {
      this.sun.shadow.mapSize.set(map, map);
      if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; }
    }
    this.renderer.shadowMap.needsUpdate = true;
  }
  setAntialias(on) { this._aa = !!on; this.resize(this.cssW, this.cssH); }
  setResolutionScale(scale) { this.renderScale = Utils.clamp(scale, 0.5, 2); this.resize(this.cssW, this.cssH); }

  // Day/night: l = 0 (midnight) .. 1 (noon). Weather darkens the day further.
  setDaylight(l) {
    this._torchNight = l < 0.35 ? 1.4 : 0.1;
    if (!this._curOverworld) return;
    const wx = this.weatherIntensity;   // rain/storm gloom
    this.sun.intensity = (0.18 + 0.95 * l) * (1 - wx * 0.55) + this._lightning * 2.4;
    this.ambient.intensity = (0.42 + 0.45 * l) * (1 - wx * 0.3);   // night floor raised — dark, still readable
    const night = new THREE.Color('#0a0d12'), day = new THREE.Color('#1a1d1f');
    const stormy = new THREE.Color('#0d1013');
    const c = night.clone().lerp(day, l).lerp(stormy, wx * 0.6);
    if (this._lightning > 0) c.lerp(new THREE.Color('#3a4050'), Math.min(1, this._lightning * 3));
    this.scene3.background = c;
    if (this.scene3.fog) {
      this.scene3.fog.color = c;
      const rd = this.renderDistance || 5200;
      // rain pulls visibility right in — Dead Frontier claustrophobia
      const vis = 1 - wx * 0.45;
      this.scene3.fog.near = rd * 0.28 * vis;
      this.scene3.fog.far = rd * 0.9 * vis;
    }
  }

  follow(x, y, instant = false) {
    this._focusTarget = { x, y };
    if (instant) { this.camFocus.set(x, 0, y); this._updateCamera(true); }
  }

  // Small camera kick for recoil / nearby explosions. Amount in world units.
  addShake(amt) { this.shake = Math.min(9, this.shake + amt); }

  _updateCamera(instant) {
    const t = this._focusTarget;
    if (t) {
      this.camFocus.x = t.x;
      this.camFocus.z = t.y;
    }
    this.camPos.copy(this.camFocus).add(this.camOffset);
    if (this.shake > 0.05) {
      this.camPos.x += Utils.rand(-this.shake, this.shake);
      this.camPos.z += Utils.rand(-this.shake, this.shake);
    }
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.camFocus.x, 0, this.camFocus.z);
    this.sun.position.set(this.camFocus.x + 600, 1400, this.camFocus.z + 300);
    this.sun.target.position.set(this.camFocus.x, 0, this.camFocus.z);
  }

  updateMouseWorld(input) {
    const ndcX = (input.mouse.x / this.canvas.width) * 2 - 1;
    const ndcY = -(input.mouse.y / this.canvas.height) * 2 + 1;
    this.raycaster.setFromCamera({ x: ndcX, y: ndcY }, this.camera);
    const hit = this.raycaster.ray.intersectPlane(this.groundPlane, this._v);
    if (hit) { input.mouse.worldX = hit.x; input.mouse.worldY = hit.z; }
  }

  project(x, y, h = 0) {
    this._v.set(x, h, y).project(this.camera);
    return {
      x: (this._v.x * 0.5 + 0.5) * this.cssW,
      y: (-this._v.y * 0.5 + 0.5) * this.cssH,
      behind: this._v.z > 1,
    };
  }

  // ---------------- Static scene build ----------------
  buildScene(scene) {
    this._disposeGroup(this.staticGroup);
    this._disposeGroup(this.fxGroup);
    for (const [, m] of this.zMeshes) this.dynGroup.remove(m);
    this.zMeshes.clear();
    for (const [, m] of this.bMeshes) this.dynGroup.remove(m);
    this.bMeshes.clear();
    for (const [, m] of this.pMeshes) this.dynGroup.remove(m);
    this.pMeshes.clear();
    this.containerMeshes = [];
    this.labels = [];
    this.occ = [];
    this.decals = [];
    this.shockwaves = [];
    this.rain = null;
    this.fires = [];
    this.flashers = [];
    this.acidMeshes = [];

    const interior = !scene.isOverworld;
    this._curOverworld = scene.isOverworld;
    const rd = this.renderDistance || 5200;
    this.scene3.background = new THREE.Color(interior ? '#08090a' : '#0b0a09');
    // Interior fog: the camera itself sits ~1180 units up, so keep the near
    // plane past it — gloomy edges, readable centre.
    this.scene3.fog = interior
      ? new THREE.Fog('#070606', 900, 2400)
      : new THREE.Fog('#0b0a09', rd * 0.28, rd * 0.9);
    this.camera.far = interior ? 3200 : rd * 1.7;
    this.camera.updateProjectionMatrix();
    this.ambient.intensity = interior ? 1.0 : 0.6;
    this.sun.intensity = interior ? 0.65 : 0.9;
    this.torch.intensity = interior ? 2.2 : this._torchNight;

    // Ground — procedural grime texture (cracked, stained asphalt/concrete)
    const groundGeo = new THREE.PlaneGeometry(scene.w + 3000, scene.h + 3000);
    const gtex = this._groundTexture(interior);
    gtex.repeat.set((scene.w + 3000) / 220, (scene.h + 3000) / 220);
    const gnorm = this._groundNormal(interior);
    gnorm.repeat.copy(gtex.repeat);
    const floorTint = interior ? ((scene.theme && scene.theme.floor) || '#7a7c82') : '#9a948a';
    const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({
      color: floorTint, map: gtex,
      normalMap: gnorm, normalScale: new THREE.Vector2(0.45, 0.45),
      roughness: 1, metalness: 0,
    }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.set(scene.w / 2, 0, scene.h / 2);
    ground.receiveShadow = true;
    this.staticGroup.add(ground);

    if (scene.isOverworld) this._buildOverworld(scene);
    else this._buildInterior(scene);

    // containers (both scenes)
    if (scene.objects && scene.objects.containers) {
      for (const c of scene.objects.containers) this._addContainer(c);
    }

    // Blood decal pool + rain live in fxGroup (cleared on scene change)
    this._buildDecalPool();
    if (scene.isOverworld) this._buildRain();
  }

  // One InstancedMesh for a whole category of boxes — a single draw call for
  // hundreds of filler buildings / wrecks / rubble pieces.
  _instanceBoxes(list, opts = {}) {
    if (!list || !list.length) return null;
    const geo = new THREE.BoxGeometry(1, 1, 1);
    const mat = new THREE.MeshStandardMaterial({
      color: '#ffffff', roughness: opts.roughness != null ? opts.roughness : 0.95,
      metalness: opts.metalness || 0.05,
    });
    const mesh = new THREE.InstancedMesh(geo, mat, list.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const pos = new THREE.Vector3(), scl = new THREE.Vector3();
    const col = new THREE.Color();
    for (let i = 0; i < list.length; i++) {
      const b = list[i];
      pos.set(b.x + b.w / 2, (b.height || 24) / 2, b.y + b.h / 2);
      scl.set(b.w, b.height || 24, b.h);
      m4.compose(pos, q, scl);
      mesh.setMatrixAt(i, m4);
      if (mesh.setColorAt) mesh.setColorAt(i, col.set(b.color || '#4a4e55'));
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.staticGroup.add(mesh);
    return mesh;
  }

  // Car wrecks as real silhouettes, still only THREE draw calls total:
  // one InstancedMesh of bodies, one of cabins, one of all four wheels each.
  _instanceWrecks(list) {
    if (!list || !list.length) return;
    // bodies (lower slab)
    this._instanceBoxes(list.map(b => ({ ...b, height: Math.min(b.height || 18, 13) })),
      { roughness: 0.55, metalness: 0.4 });
    // cabins: shorter box centred on the rear 55% of the body, raised
    const q = new THREE.Quaternion(), m4 = new THREE.Matrix4();
    const pos = new THREE.Vector3(), scl = new THREE.Vector3(), col = new THREE.Color();
    const cabGeo = new THREE.BoxGeometry(1, 1, 1);
    const cabMat = new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.35, metalness: 0.45 });
    const cabins = new THREE.InstancedMesh(cabGeo, cabMat, list.length);
    list.forEach((b, i) => {
      const horiz = b.w >= b.h;
      const cw = horiz ? b.w * 0.5 : b.w * 0.82;
      const ch = horiz ? b.h * 0.82 : b.h * 0.5;
      pos.set(b.x + b.w / 2 - (horiz ? b.w * 0.08 : 0), 13 + 5, b.y + b.h / 2 - (horiz ? 0 : b.h * 0.08));
      scl.set(cw, 10, ch);
      m4.compose(pos, q, scl);
      cabins.setMatrixAt(i, m4);
      if (cabins.setColorAt) cabins.setColorAt(i, col.set(b.color || '#4a4e55').multiplyScalar(0.55));
    });
    cabins.instanceMatrix.needsUpdate = true;
    if (cabins.instanceColor) cabins.instanceColor.needsUpdate = true;
    cabins.castShadow = true;
    this.staticGroup.add(cabins);
    // wheels: one instanced cylinder, four per car
    const whGeo = new THREE.CylinderGeometry(4.5, 4.5, 3.5, 10);
    const whMat = new THREE.MeshStandardMaterial({ color: '#17181a', roughness: 0.9 });
    const wheels = new THREE.InstancedMesh(whGeo, whMat, list.length * 4);
    const qx = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2);
    const qz = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2);
    let wi = 0;
    for (const b of list) {
      const horiz = b.w >= b.h;
      const offs = horiz
        ? [[b.w * 0.24, -b.h * 0.5], [b.w * 0.24, b.h * 0.5], [-b.w * 0.24, -b.h * 0.5], [-b.w * 0.24, b.h * 0.5]]
        : [[-b.w * 0.5, b.h * 0.24], [b.w * 0.5, b.h * 0.24], [-b.w * 0.5, -b.h * 0.24], [b.w * 0.5, -b.h * 0.24]];
      for (const [ox, oy] of offs) {
        pos.set(b.x + b.w / 2 + ox, 4.5, b.y + b.h / 2 + oy);
        scl.set(1, 1, 1);
        m4.compose(pos, horiz ? qz : qx, scl);
        wheels.setMatrixAt(wi++, m4);
      }
    }
    wheels.instanceMatrix.needsUpdate = true;
    wheels.castShadow = true;
    this.staticGroup.add(wheels);
  }

  // A dead main battle tank: hull, tracks, turret and a drooping barrel.
  _addTank(b) {
    const g = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({ color: b.color || '#4a553a', roughness: 0.7, metalness: 0.3 });
    const trackMat = new THREE.MeshStandardMaterial({ color: '#22241f', roughness: 0.95 });
    const hull = new THREE.Mesh(new THREE.BoxGeometry(b.w, 16, b.h * 0.72), hullMat);
    hull.position.y = 14; hull.castShadow = true; g.add(hull);
    for (const s of [-1, 1]) {
      const track = new THREE.Mesh(new THREE.BoxGeometry(b.w * 1.02, 12, b.h * 0.2), trackMat);
      track.position.set(0, 6, s * b.h * 0.4);
      track.castShadow = true; g.add(track);
    }
    const turret = new THREE.Mesh(new THREE.CylinderGeometry(b.h * 0.3, b.h * 0.34, 10, 10), hullMat);
    turret.position.y = 27; turret.castShadow = true; g.add(turret);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(2.2, 2.6, b.w * 0.8, 8), hullMat);
    barrel.rotation.z = Math.PI / 2 + 0.08;   // knocked askew — this one lost
    barrel.position.set(b.w * 0.45, 26, 0);
    barrel.castShadow = true; g.add(barrel);
    g.position.set(b.x + b.w / 2, 0, b.y + b.h / 2);
    if (b.h > b.w) g.rotation.y = Math.PI / 2;
    this.staticGroup.add(g);
  }

  _buildOverworld(scene) {
    // roads
    for (const s of scene.streets) {
      const road = new THREE.Mesh(new THREE.PlaneGeometry(s.w, s.h),
        new THREE.MeshStandardMaterial({ color: '#2a2e33', roughness: 1 }));
      road.rotation.x = -Math.PI / 2;
      road.position.set(s.x + s.w / 2, 0.4, s.y + s.h / 2);
      road.receiveShadow = true;
      this.staticGroup.add(road);
    }
    // outpost pads — tinted per archetype (refuge green, military slate, ...)
    const outposts = scene.outposts || [];
    for (const o of outposts) {
      const sz = o.zone;
      const pad = new THREE.Mesh(new THREE.PlaneGeometry(sz.w, sz.h),
        new THREE.MeshStandardMaterial({
          color: o.padColor || '#1e3326', emissive: o.padEmissive || '#12351e',
          emissiveIntensity: 0.4, roughness: 1,
        }));
      pad.rotation.x = -Math.PI / 2; pad.position.set(sz.x + sz.w / 2, 0.6, sz.y + sz.h / 2);
      pad.receiveShadow = true;
      this.staticGroup.add(pad);
      // archetype decorations
      for (const p of (o.props || [])) this._addOutpostProp(p);
    }

    // Sort geometry into instancing buckets vs. detailed builds.
    // Tall fillers get individual meshes so the see-through occlusion fade can
    // hide them when they stand between the camera and the player; the short
    // ones (the bulk) stay in one instanced draw call.
    const fillers = [], wrecks = [], rubble = [], barricades = [];
    for (const b of scene.buildings) {
      if (b.filler) {
        if ((b.height || 0) > 74) this._addBox(b.x, b.y, b.w, b.h, b.height, b.color || '#4a4e55');
        else fillers.push(b);
        continue;
      }
      if (b.campfire) { this._addFire(b.x + b.w / 2, b.y + b.h / 2, !!b.burning); continue; }
      if (b.tank) { this._addTank(b); continue; }
      if (b.wreck || b.camp) {
        wrecks.push(b);
        if (b.burning) this._addFire(b.x + b.w / 2, b.y + b.h / 2, true, b.height || 20);
        if (b.police) this._addFlasher(b);
        continue;
      }
      if (b.barricade) { barricades.push(b); continue; }
      if (b.small) { rubble.push(b); continue; }
      if (b.wall) { this._addBox(b.x, b.y, b.w, b.h, b.height || 30, b.color || '#454b54', { flat: true }); continue; }
      // full landmark building
      const color = (b.colors && b.colors.top) || b.color || '#33373d';
      this._addBuilding(b, color);
      if (b.name) this.labels.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, h: (b.height || 60) + 78, text: b.name, kind: b.enterable ? 'enter' : 'land' });
    }
    this._instanceBoxes(fillers);
    this._instanceWrecks(wrecks);
    this._instanceBoxes(rubble);
    this._instanceBoxes(barricades, { roughness: 0.9 });

    // street lamps: instanced poles + emissive heads (2 draw calls)
    if (scene.lamps && scene.lamps.length) {
      const poles = scene.lamps.map(l => ({ x: l.x - 2, y: l.y - 2, w: 4, h: 4, height: 64, color: '#3a3e44' }));
      this._instanceBoxes(poles, { roughness: 0.7, metalness: 0.4 });
      const litHeads = scene.lamps.filter(l => l.lit).map(l => ({ x: l.x - 5, y: l.y - 5, w: 10, h: 10, height: 6, color: '#ffd9a0' }));
      if (litHeads.length) {
        const heads = this._instanceBoxes(litHeads.map(h => ({ ...h, y: h.y })), {});
        if (heads) {
          heads.material.emissive = new THREE.Color('#ffb659');
          heads.material.emissiveIntensity = 1.4;
          // raise the heads to the top of the poles
          const m4 = new THREE.Matrix4(), q = new THREE.Quaternion();
          const pos = new THREE.Vector3(), scl = new THREE.Vector3(10, 6, 10);
          litHeads.forEach((h, i) => {
            pos.set(h.x + 5, 64, h.y + 5);
            m4.compose(pos, q, scl);
            heads.setMatrixAt(i, m4);
          });
          heads.instanceMatrix.needsUpdate = true;
        }
      }
    }

    // corpses + blood smears (instanced — pure atmosphere, zero interaction)
    if (scene.corpses && scene.corpses.length) {
      this._instanceBoxes(scene.corpses.map(c => ({
        x: c.x - 14, y: c.y - 7, w: 28, h: 14, height: 6,
        color: Math.random() < 0.5 ? '#4a4238' : '#3e3a44',
      })), { roughness: 1 });
    }
    if (scene.bloodSmears && scene.bloodSmears.length) {
      this._instanceBoxes(scene.bloodSmears.map(b => ({
        x: b.x - b.r, y: b.y - b.r * 0.7, w: b.r * 2, h: b.r * 1.4, height: 0.5,
        color: '#3a0d0d',
      })), { roughness: 1 });
    }

    // stations (every outpost)
    if (scene.outposts) {
      for (const o of scene.outposts) {
        this._addStation(o.trader, '#c9a13a');
        this._addStation(o.storage, '#5a86c9');
        this._addStation(o.heal, '#d94f4f');
        if (o.heal2) this._addStation(o.heal2, '#d94f4f');
        if (o.missions) this._addStation(o.missions, '#6ad06a');
        if (o.market) this._addStation(o.market, '#c9762a');
      }
    } else {
      this._addStation(scene.trader, '#c9a13a');
      this._addStation(scene.storage, '#5a86c9');
      this._addStation(scene.healStation, '#d94f4f');
    }
  }

  // ---- Outpost archetype decorations ----
  _addOutpostProp(p) {
    if (p.kind === 'campfire') { this._addFire(p.x + p.w / 2, p.y + p.h / 2, p.burning !== false); return; }
    if (p.kind === 'watchtower') {
      // legs + platform + cabin + optional floodlight head
      const g = new THREE.Group();
      const legMat = new THREE.MeshStandardMaterial({ color: '#3c4046', roughness: 0.8 });
      for (const [lx, lz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(6, p.height, 6), legMat);
        leg.position.set(lx * p.w * 0.36, p.height / 2, lz * p.h * 0.36);
        leg.castShadow = true;
        g.add(leg);
      }
      const platform = new THREE.Mesh(new THREE.BoxGeometry(p.w + 10, 6, p.h + 10),
        new THREE.MeshStandardMaterial({ color: p.color || '#4e545c', roughness: 0.85 }));
      platform.position.y = p.height;
      platform.castShadow = true;
      g.add(platform);
      const cabin = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.8, 22, p.h * 0.8),
        new THREE.MeshStandardMaterial({ color: '#565c64', roughness: 0.85 }));
      cabin.position.y = p.height + 14;
      cabin.castShadow = true;
      g.add(cabin);
      if (p.floodlight) {
        const flood = new THREE.Mesh(new THREE.BoxGeometry(10, 6, 10),
          new THREE.MeshStandardMaterial({ color: '#fff2cf', emissive: '#ffe9a0', emissiveIntensity: 1.6 }));
        flood.position.y = p.height + 30;
        g.add(flood);
      }
      g.position.set(p.x + p.w / 2, 0, p.y + p.h / 2);
      this.staticGroup.add(g);
      return;
    }
    // simple themed boxes: tent / stall / clinic / sandbags / truck / crates
    const colors = { tent: p.color, stall: p.color, clinic: p.color, sandbags: '#6a6a4a', truck: '#4a5a3a', crates: '#6a5a3a' };
    const mesh = this._addBox(p.x, p.y, p.w, p.h, p.height || 24, colors[p.kind] || p.color || '#5a5a5a');
    if (p.kind === 'stall') {
      // bright canopy on top — market colour
      const canopy = new THREE.Mesh(new THREE.BoxGeometry(p.w + 10, 4, p.h + 10),
        new THREE.MeshStandardMaterial({ color: p.color, emissive: p.color, emissiveIntensity: 0.25, roughness: 0.9 }));
      canopy.position.set(p.x + p.w / 2, (p.height || 24) + 6, p.y + p.h / 2);
      this.staticGroup.add(canopy);
    }
    if (p.cross) {
      // red cross beacon for clinics
      const cross = new THREE.Mesh(new THREE.BoxGeometry(10, 10, 3),
        new THREE.MeshStandardMaterial({ color: '#d94f4f', emissive: '#d94f4f', emissiveIntensity: 1 }));
      cross.position.set(p.x + p.w / 2, (p.height || 30) + 10, p.y + p.h / 2);
      this.staticGroup.add(cross);
    }
  }

  // A fire: emissive flame marker + slot in the flickering fire-light pool.
  _addFire(x, y, burning = true, baseH = 8) {
    if (!burning) {
      const cold = new THREE.Mesh(new THREE.CylinderGeometry(8, 10, 6, 8),
        new THREE.MeshStandardMaterial({ color: '#2a2622', roughness: 1 }));
      cold.position.set(x, 3, y);
      this.staticGroup.add(cold);
      return;
    }
    const mat = new THREE.MeshStandardMaterial({ color: '#ff9a40', emissive: '#ff7a20', emissiveIntensity: 1.6, roughness: 0.6 });
    const flame = new THREE.Mesh(new THREE.ConeGeometry(7, 16, 6), mat);
    flame.position.set(x, baseH + 8, y);
    this.staticGroup.add(flame);
    this.fires.push({ x, y, mat, flame, seed: Math.random() * 10 });
  }

  // Police wreck light bar — alternating red/blue.
  _addFlasher(b) {
    const mat = new THREE.MeshStandardMaterial({ color: '#c03030', emissive: '#c03030', emissiveIntensity: 1.4 });
    const bar = new THREE.Mesh(new THREE.BoxGeometry(Math.min(b.w, b.h) * 0.8, 3, 6), mat);
    bar.position.set(b.x + b.w / 2, (b.height || 20) + 3, b.y + b.h / 2);
    if (b.h > b.w) bar.rotation.y = Math.PI / 2;
    this.staticGroup.add(bar);
    this.flashers.push({ mat, phase: Math.random() * 2 });
  }

  _buildInterior(scene) {
    for (const s of scene.solids) {
      if (s.prop) continue;   // themed furniture is rendered from scene.props
      const h = s.partition ? 44 : 66;
      const col = s.partition ? '#2c3037' : '#20242a';
      this._addBox(s.x, s.y, s.w, s.h, h, col, { flat: true });
    }
    // Themed props — the furniture that makes a hospital a hospital.
    for (const p of (scene.props || [])) {
      const mat = new THREE.MeshStandardMaterial({
        color: p.color || '#565a60', roughness: 0.85, metalness: 0.08, flatShading: true,
      });
      if (p.emissive) { mat.emissive = new THREE.Color(p.emissive); mat.emissiveIntensity = 0.9; }
      const box = new THREE.Mesh(new THREE.BoxGeometry(p.w, p.height || 26, p.h), mat);
      box.position.set(p.x + p.w / 2, (p.height || 26) / 2, p.y + p.h / 2);
      box.castShadow = true; box.receiveShadow = true;
      this.staticGroup.add(box);
    }
    // exit pad
    const e = scene.exitZone;
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(e.w, e.h),
      new THREE.MeshStandardMaterial({ color: '#1b3a55', emissive: '#2f7fc0', emissiveIntensity: 0.7, roughness: 0.8 }));
    pad.rotation.x = -Math.PI / 2; pad.position.set(e.cx, 0.8, e.cy);
    this.staticGroup.add(pad);
    this.labels.push({ x: e.cx, y: e.cy, h: 30, text: 'EXIT', kind: 'exit' });
    this.labels.push({ x: scene.w / 2, y: 60, h: 120, text: scene.name, kind: 'title' });
  }

  _addBox(x, y, w, h, height, color, opts = {}) {
    const geo = new THREE.BoxGeometry(w, height, h);
    const mesh = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({
      color, roughness: 0.95, metalness: 0.05, flatShading: !!opts.flat,
    }));
    mesh.position.set(x + w / 2, height / 2, y + h / 2);
    mesh.castShadow = true; mesh.receiveShadow = true;
    this.staticGroup.add(mesh);
    if (height > 34) this.occ.push(mesh);
    return mesh;
  }

  _addBuilding(b, color) {
    const g = new THREE.Group();
    const height = b.height || 60;
    const wall = this._wallTexPair();
    const body = new THREE.Mesh(new THREE.BoxGeometry(b.w, height, b.h),
      new THREE.MeshStandardMaterial({
        color, map: wall.map, normalMap: wall.normalMap,
        normalScale: new THREE.Vector2(0.8, 0.8), roughness: 0.92, metalness: 0.05,
      }));
    body.position.set(0, height / 2, 0);
    body.castShadow = true; body.receiveShadow = true;
    g.add(body);
    const roof = new THREE.Mesh(new THREE.BoxGeometry(b.w + 6, 8, b.h + 6),
      new THREE.MeshStandardMaterial({ color: Iso ? Iso.shade(color, 0.7) : '#222', roughness: 1 }));
    roof.position.set(0, height + 2, 0);
    roof.castShadow = true;
    g.add(roof);
    const winMat = new THREE.MeshStandardMaterial({ color: '#20303c', emissive: '#4a6a80', emissiveIntensity: 0.85, roughness: 0.4 });
    const rows = Math.max(1, Math.floor(height / 26));
    for (let r = 0; r < rows; r++) {
      const wy = 18 + r * 26;
      if (wy > height - 8) break;
      const strip = new THREE.Mesh(new THREE.BoxGeometry(b.w * 0.82, 8, 2), winMat);
      strip.position.set(0, wy, b.h / 2 + 1);
      g.add(strip);
      const strip2 = new THREE.Mesh(new THREE.BoxGeometry(2, 8, b.h * 0.82), winMat);
      strip2.position.set(b.w / 2 + 1, wy, 0);
      g.add(strip2);
    }
    if (b.enterable && b.door) {
      const dl = new THREE.Mesh(new THREE.BoxGeometry(b.door.w, 34, 6),
        new THREE.MeshStandardMaterial({ color: '#0c0d0f', emissive: '#c98a2a', emissiveIntensity: 0.35, roughness: 0.6 }));
      dl.position.set(b.door.cx - (b.x + b.w / 2), 17, (b.y + b.h) - (b.y + b.h / 2));
      g.add(dl);
    }
    g.position.set(b.x + b.w / 2, 0, b.y + b.h / 2);
    this.staticGroup.add(g);
    this.occ.push(g);
    return g;
  }

  _addStation(s, color) {
    if (!s) return;
    const g = this._addBuilding({ x: s.x, y: s.y, w: s.w, h: s.h, height: 42, enterable: false }, color);
    const beacon = new THREE.Mesh(new THREE.SphereGeometry(7, 12, 12),
      new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: 1.2 }));
    beacon.position.set(0, 54, 0);
    g.add(beacon);
    this.labels.push({ x: s.x + s.w / 2, y: s.y + s.h / 2, h: 82, text: s.name, kind: 'station' });
  }

  _addContainer(c) {
    const col = c.def ? c.def.top : '#7a5a34';
    const g = new THREE.Group();
    const box = new THREE.Mesh(new THREE.BoxGeometry(c.w, c.height, c.h),
      new THREE.MeshStandardMaterial({ color: col, roughness: 0.8, metalness: 0.15 }));
    box.position.set(0, c.height / 2, 0);
    box.castShadow = true; box.receiveShadow = true;
    g.add(box);
    const glow = c.def && c.def.glow;   // hidden caches shine — you can't miss them
    const marker = new THREE.Mesh(new THREE.OctahedronGeometry(glow ? 9 : 6),
      new THREE.MeshStandardMaterial({
        color: glow ? '#ffe27a' : '#ffd24a', emissive: glow ? '#ffca30' : '#ffb020',
        emissiveIntensity: glow ? 2.2 : 1.1,
      }));
    marker.position.set(0, c.height + 22, 0);
    g.add(marker);
    if (glow) {
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 4.5, 130, 8, 1, true),
        new THREE.MeshBasicMaterial({ color: '#ffd76a', transparent: true, opacity: 0.16, depthWrite: false }));
      beam.position.set(0, 70, 0);
      g.add(beam);
    }
    g.position.set(c.cx, 0, c.cy);
    this.staticGroup.add(g);
    this.containerMeshes.push({ c, box, marker, mat: box.material });
  }

  // ---------------- FX: blood decals, shockwaves, rain, muzzle light ----------------
  _buildDecalPool() {
    const geo = new THREE.CircleGeometry(1, 10);
    for (let i = 0; i < 56; i++) {
      const mat = new THREE.MeshBasicMaterial({ color: '#4a0d0d', transparent: true, opacity: 0, depthWrite: false });
      const m = new THREE.Mesh(geo, mat);
      m.rotation.x = -Math.PI / 2;
      m.rotation.z = Math.random() * Math.PI * 2;
      m.position.y = 0.9 + i * 0.004;   // tiny y-offsets kill z-fighting
      m.renderOrder = 2;
      m.visible = false;
      this.fxGroup.add(m);
      this.decals.push({ mesh: m, life: 0 });
    }
  }

  // Persistent blood pool under a kill. Oldest decal is recycled.
  addBlood(x, y, size = 1) {
    if (!this.decals.length) return;
    const d = this.decals[this._decalIdx % this.decals.length];
    this._decalIdx++;
    d.mesh.visible = true;
    d.mesh.position.x = x + Utils.rand(-4, 4);
    d.mesh.position.z = y + Utils.rand(-4, 4);
    const s = (10 + Math.random() * 10) * size;
    d.mesh.scale.set(s, s * Utils.rand(0.7, 1), 1);
    d.mesh.rotation.z = Math.random() * Math.PI * 2;
    d.mesh.material.opacity = 0.78;
    d.life = 40;   // seconds until fully faded
  }

  // Expanding ring for slams / bloat detonations.
  addShockwave(x, y, radius) {
    const geo = new THREE.RingGeometry(0.82, 1, 26);
    const mat = new THREE.MeshBasicMaterial({ color: '#c8e0a0', transparent: true, opacity: 0.8, side: THREE.DoubleSide, depthWrite: false });
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, 1.6, y);
    m.renderOrder = 3;
    this.fxGroup.add(m);
    this.shockwaves.push({ mesh: m, t: 0, dur: 0.45, radius });
  }

  // Gun light: flick the pooled point light to the muzzle.
  muzzleFlash(x, y) {
    this.muzzle.position.set(x, 40, y);
    this.muzzle.intensity = 2.6;
  }

  _buildRain() {
    const n = (CONFIG.weather && CONFIG.weather.rainDrops) || 1500;
    const geo = new THREE.BufferGeometry();
    const pos = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      pos[i * 3] = Utils.rand(-1300, 1300);
      pos[i * 3 + 1] = Utils.rand(0, 900);
      pos[i * 3 + 2] = Utils.rand(-1300, 1300);
    }
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: '#7f95ab', size: 1.6, transparent: true, opacity: 0, depthWrite: false,
    });
    this.rain = new THREE.Points(geo, mat);
    this.rain.frustumCulled = false;
    this.fxGroup.add(this.rain);
  }

  _updateWeatherFX(dt, game) {
    // ease toward the target intensity set by the Game's weather state machine
    const targets = { clear: 0, overcast: 0.18, rain: 0.6, storm: 1 };
    this.weatherTarget = targets[(game && game.weather) || 'clear'] || 0;
    this.weatherIntensity += (this.weatherTarget - this.weatherIntensity) * Math.min(1, dt * 0.5);

    // rain particle fall + recentre on the camera focus
    if (this.rain && this._curOverworld) {
      this.rain.position.set(this.camFocus.x, 0, this.camFocus.z);
      this.rain.material.opacity = this.weatherIntensity * 0.55;
      if (this.weatherIntensity > 0.03) {
        const p = this.rain.geometry.attributes.position;
        const speed = 620 * dt * (0.8 + this.weatherIntensity * 0.5);
        for (let i = 0; i < p.count; i++) {
          let yy = p.getY(i) - speed;
          if (yy < 0) yy = 900;
          p.setY(i, yy);
        }
        p.needsUpdate = true;
      }
    }

    // storm lightning
    if (this._lightning > 0) this._lightning = Math.max(0, this._lightning - dt * 4);
    if (game && game.weather === 'storm' && this._curOverworld) {
      this._lightningCooldown -= dt;
      if (this._lightningCooldown <= 0) {
        this._lightning = 0.4;
        this._lightningCooldown = Utils.rand(3, 9);
        if (game.audio) game.audio.thunder();
      }
    }

    // shockwave rings
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const s = this.shockwaves[i];
      s.t += dt;
      const f = s.t / s.dur;
      if (f >= 1) {
        this.fxGroup.remove(s.mesh);
        s.mesh.geometry.dispose(); s.mesh.material.dispose();
        this.shockwaves.splice(i, 1);
        continue;
      }
      const r = s.radius * (0.15 + 0.85 * f);
      s.mesh.scale.set(r, r, 1);
      s.mesh.material.opacity = 0.8 * (1 - f);
    }

    // decal fade
    for (const d of this.decals) {
      if (d.life > 0) {
        d.life -= dt;
        if (d.life < 8) d.mesh.material.opacity = Math.max(0, d.life / 8) * 0.78;
        if (d.life <= 0) d.mesh.visible = false;
      }
    }

    // muzzle light decay + camera shake decay
    if (this.muzzle.intensity > 0.01) this.muzzle.intensity *= Math.exp(-dt * 16);
    else this.muzzle.intensity = 0;
    this.shake *= Math.exp(-dt * 9);

    // fire flicker + roaming fire lights (nearest fires get real light)
    const t = this.clock.elapsedTime;
    for (const f of this.fires) {
      f.mat.emissiveIntensity = 1.2 + Math.sin(t * 11 + f.seed * 7) * 0.35 + Math.sin(t * 23 + f.seed) * 0.2;
      f.flame.scale.y = 1 + Math.sin(t * 9 + f.seed * 5) * 0.18;
    }
    if (this.fires.length && this.fireLights.length) {
      const px = this.camFocus.x, py = this.camFocus.z;
      const sorted = this.fires.slice().sort((a, b) =>
        Utils.dist2(a.x, a.y, px, py) - Utils.dist2(b.x, b.y, px, py));
      for (let i = 0; i < this.fireLights.length; i++) {
        const l = this.fireLights[i], f = sorted[i];
        if (f && Utils.dist2(f.x, f.y, px, py) < 1600 * 1600) {
          l.position.set(f.x, 26, f.y);
          l.intensity = 1.5 + Math.sin(t * 13 + f.seed * 9) * 0.5;
        } else { l.intensity = 0; l.position.y = -9999; }
      }
    }
    // police flashers strobe red/blue
    for (const fl of this.flashers) {
      const on = Math.sin(t * 6 + fl.phase) > 0;
      fl.mat.color.set(on ? '#c03030' : '#3050c0');
      fl.mat.emissive.set(on ? '#c03030' : '#3050c0');
      fl.mat.emissiveIntensity = 1.2 + Math.abs(Math.sin(t * 12 + fl.phase)) * 0.6;
    }
    // streetlight pool: nearest lit lamps get real light at night / in storms
    if (game && game.scene && game.scene.lamps && this.streetLights.length) {
      const night = (game.isNight && game.isNight()) || this.weatherIntensity > 0.75;
      const px = this.camFocus.x, py = this.camFocus.z;
      if (night && this._curOverworld) {
        const lit = game.scene.lamps.filter(l => l.lit &&
          Utils.dist2(l.x, l.y, px, py) < 1400 * 1400)
          .sort((a, b) => Utils.dist2(a.x, a.y, px, py) - Utils.dist2(b.x, b.y, px, py));
        for (let i = 0; i < this.streetLights.length; i++) {
          const sl = this.streetLights[i], lamp = lit[i];
          if (lamp) {
            sl.position.set(lamp.x, 60, lamp.y);
            sl.intensity = 1.1 + Math.sin(t * 3 + lamp.x) * 0.08;   // faint hum-flicker
          } else { sl.intensity = 0; sl.position.y = -9999; }
        }
      } else {
        for (const sl of this.streetLights) { sl.intensity = 0; sl.position.y = -9999; }
      }
    }

    // acid pools: pooled translucent green circles synced to the entity list
    const pools = (game && game.entities && game.entities.acidPools) || [];
    while (this.acidMeshes.length < Math.min(pools.length, 18)) {
      const m = new THREE.Mesh(new THREE.CircleGeometry(1, 12),
        new THREE.MeshBasicMaterial({ color: '#5adf3a', transparent: true, opacity: 0.3, depthWrite: false }));
      m.rotation.x = -Math.PI / 2;
      m.position.y = 1.2;
      m.renderOrder = 2;
      this.fxGroup.add(m);
      this.acidMeshes.push(m);
    }
    for (let i = 0; i < this.acidMeshes.length; i++) {
      const m = this.acidMeshes[i], p = pools[i];
      if (p) {
        m.visible = true;
        m.position.x = p.x; m.position.z = p.y;
        m.scale.set(p.r, p.r, 1);
        m.material.opacity = 0.12 + 0.25 * (p.ttl / p.max) + Math.sin(t * 7 + i) * 0.04;
      } else m.visible = false;
    }
  }

  // ---------------- Per-frame dynamic sync ----------------
  sync(game) {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    this._updateCamera(false);
    this._updateWeatherFX(dt, game);

    // player
    if (!this.playerMesh) { this.playerMesh = Models.human(getClass(game.player.classId)); this.dynGroup.add(this.playerMesh); this.playerClass = game.player.classId; this._heldWeapon = null; }
    if (this.playerClass !== game.player.classId) { this.dynGroup.remove(this.playerMesh); this.playerMesh = Models.human(getClass(game.player.classId)); this.dynGroup.add(this.playerMesh); this.playerClass = game.player.classId; this._heldWeapon = null; }
    this._syncActor(this.playerMesh, game.player, dt, !game.player.dead);
    this.playerMesh.visible = !game.player.dead;

    // Melee swing: the weapon arm chops through a full arc
    const pParts = this.playerMesh.userData.parts;
    if (pParts && pParts.armR) {
      if (game.player.meleeSwing > 0 && getWeapon(game.player.equipped) && getWeapon(game.player.equipped).kind === 'melee') {
        const f = 1 - (game.player.meleeSwing / 0.18);
        pParts.armR.rotation.x = -2.0 + Math.sin(f * Math.PI) * 1.7;
        pParts.armR.userData.aim = true;
      } else if (getWeapon(game.player.equipped) && getWeapon(game.player.equipped).kind === 'melee') {
        pParts.armR.rotation.x = -0.55;   // carry stance
        pParts.armR.userData.aim = true;
      } else {
        pParts.armR.rotation.x = -1.25;   // gun aim
        pParts.armR.userData.aim = true;
      }
    }

    // torch follows the player (bright indoors, night-only outdoors)
    const px = game.player.x, py = game.player.y;
    this.torch.position.set(px, 55, py + 8);
    this.torch.intensity = game.scene.isOverworld ? this._torchNight : 1.6;

    // cone flashlight aims where the player faces; on at night / indoors / storms
    const f = game.player.facing || 0;
    this.torchCone.position.set(px, 95, py);
    this.torchTarget.position.set(px + Math.cos(f) * 400, 0, py + Math.sin(f) * 400);
    const dark = !game.scene.isOverworld || (game.isNight && game.isNight()) || this.weatherIntensity > 0.75;
    this.torchCone.intensity = dark ? 3.2 : 0;

    // fade any building/obstacle standing between the camera and the player
    this._updateOcclusion(px, py);

    // swap the held weapon mesh whenever the equipped weapon changes
    if (this._heldWeapon !== game.player.equipped && this.playerMesh.userData.parts) {
      const armR = this.playerMesh.userData.parts.armR;
      const old = armR.getObjectByName('heldWeapon');
      if (old) { armR.remove(old); Models.dispose(old); }
      const wm = Models.weaponMesh(game.player.equipped);
      wm.name = 'heldWeapon';
      wm.position.set(0, -46 * 0.36, 1.5);
      armR.add(wm);
      this._heldWeapon = game.player.equipped;
    }

    // zombies
    const seen = new Set();
    for (const z of game.entities.zombies) {
      seen.add(z);
      let m = this.zMeshes.get(z);
      if (!m) {
        m = z.cfg.behavior && z.cfg.behavior.boss ? Models.boss(z.cfg) : Models.zombie(z.cfg);
        if (z.variant) Models.applyVariant(m, z.variant);
        this.dynGroup.add(m); this.zMeshes.set(z, m);
      }
      this._syncActor(m, z, dt, !z.dead);
      const bs = m.userData.baseScale || 1;
      if (z.dead) {
        const exp = z.cfg.behavior && z.cfg.behavior.explode;
        if (exp && z.exploding > 0 && !z.exploded) {
          // bloat fuse: stay upright and SWELL until detonation
          const fuse = exp.fuse || 0.9;
          const k = (1 + (1 - Math.max(0, z.exploding) / fuse) * 0.85) * bs;
          m.rotation.x = 0;
          m.position.y = 0;
          m.scale.set(k, k * 0.92, k);
        } else if (exp && z.exploded) {
          m.visible = false;   // nothing left of a burst bloat
        } else {
          m.rotation.x = Math.PI / 2.4; m.position.y = 2;   // topple corpse
        }
      } else {
        m.scale.set(bs, bs, bs);
        // Leapers visibly ARC through the air mid-pounce
        if (z.leaping > 0) {
          const f = 1 - (z.leaping / 0.32);
          m.position.y = Math.sin(Math.min(1, Math.max(0, f)) * Math.PI) * 26;
        }
      }
    }
    for (const [z, m] of this.zMeshes) {
      if (!seen.has(z)) { this.dynGroup.remove(m); Models.dispose(m); this.zMeshes.delete(z); }
    }

    // bullets
    const bseen = new Set();
    for (const b of game.entities.bullets) {
      bseen.add(b);
      let m = this.bMeshes.get(b);
      if (!m) { m = Models.tracer(); this.dynGroup.add(m); this.bMeshes.set(b, m); }
      m.position.set(b.x, 20, b.y);
      m.rotation.y = Math.atan2(b.vx, b.vy);
    }
    for (const [b, m] of this.bMeshes) { if (!bseen.has(b)) { this.dynGroup.remove(m); Models.dispose(m); this.bMeshes.delete(b); } }

    // enemy projectiles
    const pseen = new Set();
    for (const p of game.entities.projectiles) {
      pseen.add(p);
      let m = this.pMeshes.get(p);
      if (!m) { m = Models.bile(); this.dynGroup.add(m); this.pMeshes.set(p, m); }
      m.position.set(p.x, 22, p.y);
    }
    for (const [p, m] of this.pMeshes) { if (!pseen.has(p)) { this.dynGroup.remove(m); Models.dispose(m); this.pMeshes.delete(p); } }

    // companion
    if (game.player.companion) {
      if (!this.companionMesh) { this.companionMesh = Models.husky(); this.dynGroup.add(this.companionMesh); }
      this._syncActor(this.companionMesh, game.player.companion, dt, true);
      this.companionMesh.visible = true;
    } else if (this.companionMesh) {
      this.dynGroup.remove(this.companionMesh);
      Models.dispose(this.companionMesh);
      this.companionMesh = null;
    }

    // guards
    const gseen = new Set();
    if (game.scene.guards) {
      for (const g of game.scene.guards) {
        gseen.add(g);
        let m = this.gMeshes.get(g);
        if (!m) { m = Models.guard(g.cls); this.dynGroup.add(m); this.gMeshes.set(g, m); }
        this._syncActor(m, g, dt, !g.dead);
        if (g.dead) { m.rotation.x = Math.PI / 2.4; m.position.y = 2; }
      }
    }
    for (const [g, m] of this.gMeshes) {
      if (!gseen.has(g)) { this.dynGroup.remove(m); Models.dispose(m); this.gMeshes.delete(g); }
    }

    // container markers spin / looted state
    for (const cm of this.containerMeshes) {
      if (cm.c.looted) { cm.marker.visible = false; cm.mat.color.set('#3a3a3a'); cm.mat.emissiveIntensity = 0; }
      else { cm.marker.visible = true; cm.marker.rotation.y += dt * 2.2; cm.marker.position.y = cm.c.height + 22 + Math.sin(this.clock.elapsedTime * 3 + cm.c.x) * 3; }
    }
  }

  _syncActor(mesh, ent, dt, alive) {
    mesh.position.set(ent.x, 0, ent.y);
    if (alive) {
      mesh.rotation.x = 0; mesh.position.y = 0;
      const dir = ent.facing != null ? ent.facing : 0;
      mesh.rotation.y = Math.atan2(Math.cos(dir), Math.sin(dir));
    }
    const parts = mesh.userData.parts;
    if (parts) {
      const speed = Math.hypot(ent.vx || 0, ent.vy || 0);
      if (speed > 4 && alive) {
        mesh.userData.phase = (mesh.userData.phase || 0) + dt * Math.min(14, speed * 0.05 + 6);
        const s = Math.sin(mesh.userData.phase) * 0.6;
        if (parts.legL) parts.legL.rotation.x = s;
        if (parts.legR) parts.legR.rotation.x = -s;
        if (parts.armL) parts.armL.rotation.x = -s * 0.7;
        if (parts.armR && !parts.armR.userData.aim) parts.armR.rotation.x = s * 0.7;
        if (parts.torso) parts.torso.position.y = parts.torso.userData.baseY + Math.abs(Math.sin(mesh.userData.phase)) * 1.4;
      } else {
        for (const k of ['legL', 'legR', 'armL']) if (parts[k]) parts[k].rotation.x *= 0.8;
      }
      if (ent.hitFlash > 0 && parts.torso) parts.torso.material.emissiveIntensity = 0.9;
      else if (parts.torso && parts.torso.material.emissive) parts.torso.material.emissiveIntensity = parts.torsoEmissive || 0;
    }
  }

  _updateOcclusion(px, py) {
    if (!this.occ.length) return;
    this._occV.set(px, 42, py);
    const camDist = this.camera.position.distanceTo(this._occV);
    this._occDir.copy(this._occV).sub(this.camera.position).normalize();
    this.occRay.set(this.camera.position, this._occDir);
    this.occRay.far = camDist - 26;
    const hits = this.occRay.intersectObjects(this.occ, true);
    const fadeSet = new Set();
    for (const h of hits) {
      let o = h.object;
      while (o && this.occ.indexOf(o) === -1) o = o.parent;
      if (o) fadeSet.add(o);
    }
    for (const o of this.occ) {
      // 0.44 keeps faded buildings READABLE (ghosted, not a black hole), and
      // the faster settle kills the mid-run shimmer.
      const target = fadeSet.has(o) ? 0.44 : 1;
      o.traverse((n) => {
        const m = n.material;
        if (!m || n.name === 'heldWeapon') return;
        if (m.userData._base == null) m.userData._base = m.opacity;
        const goal = target * m.userData._base;
        m.opacity += (goal - m.opacity) * 0.38;
        if (m.opacity > 0.985) { m.opacity = m.userData._base; m.transparent = false; m.depthWrite = true; }
        else { m.transparent = true; m.depthWrite = m.opacity > 0.55; }
      });
    }
  }

  render() {
    if (this.composer) {
      if (this.grade) this.grade.uniforms.time.value = this.clock.elapsedTime;
      this.composer.render();
    } else {
      this.renderer.render(this.scene3, this.camera);
    }
  }

  _disposeGroup(group) {
    for (let i = group.children.length - 1; i >= 0; i--) {
      const c = group.children[i];
      Models.dispose(c);
      group.remove(c);
    }
  }
}
