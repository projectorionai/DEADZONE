/* Game loop, scene switching (overworld ↔ interiors), combat wiring, autosave. */
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.fx = document.getElementById('fx');
    this.fxctx = this.fx.getContext('2d');
    this.r3d = new Renderer3D(canvas);
    this.resize();

    this.input = new Input(canvas);
    this.overworld = new World();
    this.scene = this.overworld;
    this.interior = null;
    this.returnPos = null;
    this._loading = false;
    this.r3d.buildScene(this.scene);

    const sz = this.overworld.safeZone;
    this.player = new Player(sz.x + sz.w / 2, sz.y + sz.h / 2 + 60);

    this.inventory = new Inventory(CONFIG.ui.invCols, CONFIG.ui.invRows, () => this.player.carryWeight);
    this.storage = new Inventory(CONFIG.ui.invCols, CONFIG.ui.invRows, () => 9999);
    this.trader = new Trader();

    this.state = 'playing';
    this.stats = { kills: 0, headshots: 0, looted: 0, playtime: 0 };
    this.nearby = { container: null, service: null, door: null, exit: false, corpse: null };

    // --- Dynamic weather: clear -> overcast -> rain -> storm ---
    this.weather = 'clear';
    this.weatherTimer = Utils.rand(30, 70);

    // --- Meta systems: lifetime stats, achievements, the marketplace ---
    this.analytics = new Analytics();
    this.achievements = new Achievements(this);
    this.market = new MarketSystem(this);
    this.hitMarkers = [];          // {t} crosshair hit ticks
    this.currentDistrict = 1;      // district banner tracking
    this._districtShown = 0;
    this.worldBossTimer = Utils.rand(...CONFIG.spawn.worldBossInterval);
    this._stingerTimer = Utils.rand(8, 16);
    this._achieveTimer = 5;
    this.selectedClass = 'soldier';
    this.gameStarted = false;

    // --- System 1: Threat Escalation ---
    this.districtThreat = 0;        // 0–100 accumulator; drives spawn aggression
    this.districtThreatDecay = 2.8; // points per second shed when idle
    this._lastNoiseTime = 0;        // time since last noise event (for decay)

    this.siegeTimer = 240;   // first siege hits sooner
    this.siegeActive = false;
    this.siegeWaveDuration = 0;
    this.siegeWaveMax = 0;
    this.credits = 0;
    this.creditsEarned = 0;
    this.upgrades = {
      guardBarracks: { level: 0 },
      wallReinforcement: { level: 0 },
      medicalLab: { level: 0 },
      researchLab: { level: 0 },
      armory: { level: 0 },
    };

    // Player identity + tactical-pause state
    this.username = localStorage.getItem(Game.USERNAME_KEY) || 'Survivor';
    this.player.username = this.username;
    this.pauseCountdown = 0;       // >0 while the ESC countdown is running
    this._menuReturn = 'playing';  // where ESC returns to when closing a menu
    this.fpsLimit = 0;
    this._lastFrame = 0;

    this.ui = new UI(this);
    this.minimap = new Minimap();
    this.autosaveTimer = 20;
    this.lastTime = performance.now();

    // Audio (needs a user gesture to start) + day/night clock (start mid-morning)
    this.audio = new GameAudio();
    canvas.addEventListener('mousedown', () => this.audio.ensure(), { once: true });
    this.dayTime = CONFIG.world.dayCycleSeconds * 0.3;

    // Outpost missions
    this.missions = new MissionSystem(this);

    Settings.load();
    Settings.apply(this);

    this._loadOrStart();
    this.r3d.follow(this.player.x, this.player.y, true);
  }

  get objects() { return this.scene.objects; }
  get entities() { return this.scene.entities; }

  _loadOrStart() {
    if (SaveSystem.hasSave()) {
      SaveSystem.load(this);
      this.gameStarted = true;
      this.ui.toast('Save loaded — welcome back to Ravenside');
    }
    this.ui.refreshAll();
  }

  startNewGame(classId) {
    SaveSystem.clear();
    this.selectedClass = classId || 'soldier';
    this.player.applyClass(this.selectedClass);
    this.inventory.clear();
    const kit = getClass(this.selectedClass).kit;
    for (const k of kit) this.inventory.add(k.id, k.qty);
    this.player.hasPistol = this.player.equipped === 'pistol';
    if (this.player.hasPistol) this.player.mag = getWeapon('pistol').magSize;
    this.stats = { kills: 0, headshots: 0, looted: 0, playtime: 0 };
    // Reset to the outpost (guards against a stale loaded position/scene).
    this.interior = null;
    this._loading = false;
    this.scene = this.overworld;
    const sz = this.overworld.safeZone;
    this.player.dead = false;
    this.player.x = sz.x + sz.w / 2;
    this.player.y = sz.y + sz.h / 2 + 40;
    this.player.hp = this.player.maxHp;
    this.overworld.entities.reset();
    if (this.overworld._prePlaceHorde) this.overworld._prePlaceHorde();   // deep city starts crawling
    this.r3d.buildScene(this.scene);
    this.r3d.follow(this.player.x, this.player.y, true);
    this.gameStarted = true;
    this.ui.toast(`${getClass(this.selectedClass).name} — scour Ravenside, enter buildings with [E]`);
    this._startTutorial();
    SaveSystem.save(this);
    this.ui.refreshAll();
  }

  // First-run tutorial: a paced drip of guidance toasts for the opening minutes.
  _startTutorial() {
    const steps = [
      [4,  '🎓 TUTORIAL — Move with WASD. Hold SHIFT to sprint (watch your stamina).'],
      [12, '🎓 Aim with the mouse, CLICK to attack. Headshots hit far harder.'],
      [22, '🎓 Yellow "?" markers are lootable. Stand on one and press E — you can shuffle while searching.'],
      [34, '🎓 Press M for the Mission Board — contracts pay the bills. Accept up to 3.'],
      [48, '🎓 Press T for Talents, O for Armour, P to trade on the Marketplace.'],
      [64, '🎓 District 1 is your training ground. The deeper you push, the deadlier — and richer — it gets.'],
      [80, '🎓 Loud guns call the horde from far away. Melee is silent. Choose wisely. Good luck, survivor.'],
    ];
    this._tutorialSteps = steps;
    this._tutorialT = 0;
  }
  _updateTutorial(dt) {
    if (!this._tutorialSteps || !this._tutorialSteps.length) return;
    this._tutorialT += dt;
    if (this._tutorialT >= this._tutorialSteps[0][0]) {
      this.ui.toast(this._tutorialSteps.shift()[1]);
    }
  }

  // ---------- Player identity ----------
  setUsername(name) {
    name = (name || '').trim().slice(0, 16) || 'Survivor';
    this.username = name;
    if (this.player) this.player.username = name;
    localStorage.setItem(Game.USERNAME_KEY, name);
    if (this.ui) this.ui.updateHUD();
  }

  // ---------- Tactical pause ----------
  startPauseCountdown() {
    this.pauseCountdown = 5;
    this.ui.showCountdown(5);
  }
  cancelPauseCountdown() {
    if (this.pauseCountdown <= 0) return;
    this.pauseCountdown = 0;
    this.ui.hideCountdown();
    this.ui.toast('Pause cancelled — you moved');
  }
  enterPause() {
    this.pauseCountdown = 0;
    this.ui.hideCountdown();
    this.state = 'paused';
    this.ui.showPauseMenu();
  }
  resumeGame() {
    this.ui.hidePauseMenu();
    this.state = 'playing';
    this._menuReturn = 'playing';
    if (this.r3d) this.r3d.clock.getDelta();   // drop paused interval → no anim jump
    this.lastTime = performance.now();
  }
  openFromPause(menu) {
    this._menuReturn = 'paused';
    this.ui.hidePauseMenu();
    this.setState(menu);
  }
  _movementPressed() {
    const i = this.input;
    return i.isDown('w') || i.isDown('a') || i.isDown('s') || i.isDown('d') ||
      i.isDown('arrowup') || i.isDown('arrowdown') || i.isDown('arrowleft') || i.isDown('arrowright');
  }
  _handleEscape() {
    if (this.state === 'loading') return;
    if (this.state === 'paused') { this.resumeGame(); return; }
    if (this.pauseCountdown > 0) { this.cancelPauseCountdown(); return; }
    if (['inventory', 'trader', 'character', 'storage', 'talents', 'missions', 'market', 'armour'].includes(this.state)) {
      this.setState('playing');
      if (this._menuReturn === 'paused') { this._menuReturn = 'playing'; this.enterPause(); }
      return;
    }
    if (this.state === 'playing') this.startPauseCountdown();
  }

  resize() {
    const w = Math.floor(window.innerWidth), h = Math.floor(window.innerHeight);
    if (this.r3d) this.r3d.resize(w, h);
    if (this.fx) { this.fx.width = w; this.fx.height = h; }
  }

  start() {
    const loop = (now) => {
      requestAnimationFrame(loop);
      // Optional FPS cap (Settings › FPS Limit)
      if (this.fpsLimit > 0 && now - this._lastFrame < 1000 / this.fpsLimit - 0.5) return;
      this._lastFrame = now;
      let dt = (now - this.lastTime) / 1000;
      this.lastTime = now;
      dt = Math.min(dt, 0.05);
      if (this.gameStarted) {
        this.update(dt);
        this.render();
      }
      this.input.endFrame();
    };
    requestAnimationFrame(loop);
  }

  update(dt) {
    this.r3d.updateMouseWorld(this.input);
    this._handleGlobalKeys();

    // Tactical pause countdown — runs during play; any movement cancels it.
    if (this.pauseCountdown > 0 && this.state === 'playing') {
      if (this._movementPressed()) {
        this.cancelPauseCountdown();
      } else {
        this.pauseCountdown -= dt;
        this.ui.updateCountdown(Math.max(0, Math.ceil(this.pauseCountdown)));
        if (this.pauseCountdown <= 0) this.enterPause();
      }
    }

    if (this.state === 'playing') {
      this.stats.playtime += dt;
      this._fps = Math.round((this._fps || 60) * 0.92 + (1 / Math.max(dt, 0.001)) * 0.08);
      // Day/night cycle
      this.dayTime += dt;
      this.r3d.setDaylight(this.daylight());
      this.player.update(dt, this.input, this);
      this.entities.update(dt, this.player, this);
      this.objects.update(dt);
      this._updateInteractions();
      this._handleInteractKeys();
      this._updateLoot(dt);
      this._updateWeather(dt);
      this._updateDistrict(dt);
      this._updateWorldBoss(dt);
      this._updateAmbience(dt);
      this._updateTutorial(dt);
      if (this.market) this.market.update(dt);
      this._achieveTimer -= dt;
      if (this._achieveTimer <= 0) { this._achieveTimer = 6; this.achievements.check(); }
      this._decayDistrictThreat(dt);
      // Sprinting generates constant low-level threat
      if (this.player.sprinting) this.alertZombies(this.player.x, this.player.y, 120);
      this._updateSiege(dt);
      this._updateZombieAudio(dt);
      if (this.missions) this.missions.update(dt);
      this.r3d.follow(this.player.x, this.player.y);
      this.ui.setInjuryFX(this.player);
      if (this.player.dead) { this.state = 'dead'; this.ui.showDeath(); if (this.audio) { this.audio.sirenStop(); this.audio.musicStop(); } }

      this.autosaveTimer -= dt;
      if (this.autosaveTimer <= 0) {
        this.autosaveTimer = 20;
        SaveSystem.save(this);
        this.ui.toast('Auto-saved');
      }
    }
    // hit markers decay even in menus so they never freeze on screen
    for (const hm of this.hitMarkers) hm.t -= dt;
    this.hitMarkers = this.hitMarkers.filter(h => h.t > 0);
    this.ui.updateHUD();
  }

  _handleGlobalKeys() {
    const i = this.input;
    if (i.wasPressed('i')) this.toggleState('inventory');
    if (i.wasPressed('c')) this.toggleState('character');
    if (i.wasPressed('t')) this.toggleState('talents');
    if (i.wasPressed('m')) this.toggleState('missions');
    if (i.wasPressed('p')) this.toggleState('market');
    if (i.wasPressed('o')) this.toggleState('armour');
    if (i.wasPressed('escape')) this._handleEscape();
    if (i.wasPressed('f9')) { SaveSystem.save(this); this.ui.toast('Game saved'); }
    if (i.wasPressed('`') || i.wasPressed('~')) this.toggleAdmin();
  }

  // ---------- Admin / dev mode ----------
  toggleAdmin() {
    this.adminOpen = !this.adminOpen;
    this.ui.setAdminOpen(this.adminOpen);
  }
  adminGiveWeapon(id) {
    const w = getWeapon(id); if (!w) return;
    this.player.equipWeapon(id);
    if (w.kind === 'ranged') this.player.mag = w.magSize;
    this.ui.toast('Equipped ' + w.name);
    this.ui.updateHUD();
  }
  // Creative mode: put any item straight into the bag.
  adminGiveItem(id, qty = 1) {
    if (!ITEMS[id]) return;
    const left = this.inventory.add(id, qty);
    if (left >= qty) { this.ui.toast('Inventory full'); return; }
    this.ui.toast(`+${qty - left}x ${ITEMS[id].name}`);
    this.ui.refreshInventory(); this.ui.updateHUD();
  }
  adminAction(action) {
    const p = this.player;
    switch (action) {
      case 'heal': p.hp = p.maxHp; p.stamina = p.maxStamina; p.bleeding = 0; p.fractured = false; p.blur = 0; p.acid = 0; this.ui.toast('Fully healed'); break;
      case 'feed': p.stamina = p.maxStamina; this.ui.toast('Stamina restored'); break;
      case 'credits': p.currency += 1000; this.credits = (this.credits || 0) + 1000; this.ui.toast('+1000 credits'); break;
      case 'levelup': p.addXP(p.xpForNext(), this); break;
      case 'statpts': p.statPoints += 10; this.ui.toast('+10 stat points'); break;
      case 'ammo': ['ammo_9mm', 'ammo_308', 'ammo_45', 'ammo_shells', 'ammo_556'].forEach(a => this.inventory.add(a, 120)); this.ui.toast('+ammo'); break;
      case 'spawnWalker': this.entities.spawnZombieAt(p.x + 170, p.y, 'walker'); break;
      case 'spawnTitan': this.entities.spawnZombieAt(p.x + 240, p.y, 'titan'); break;
      case 'clear': this.entities.zombies = []; this.entities.projectiles = []; this.ui.toast('Zombies cleared'); break;
      case 'day': this.dayTime = CONFIG.world.dayCycleSeconds * 0.5; this.ui.toast('Set to midday'); break;
      case 'night': this.dayTime = 0; this.ui.toast('Set to midnight'); break;
      // ---- World controls ----
      case 'horde': {
        for (let i = 0; i < 20; i++) {
          const a = (i / 20) * Math.PI * 2;
          this.entities.spawnZombieAt(p.x + Math.cos(a) * Utils.rand(300, 500), p.y + Math.sin(a) * Utils.rand(300, 500), rollEnemyType(3));
        }
        this.ui.toast('Horde spawned'); break;
      }
      case 'siege': this.siegeTimer = 0.1; this.ui.toast('Siege triggered'); break;
      case 'worldboss': this.worldBossTimer = 0.1; this.ui.toast('World boss inbound'); break;
      case 'wClear': this.weather = 'clear'; this.weatherTimer = 120; if (this.audio) this.audio.rainSet(0); break;
      case 'wRain': this.weather = 'rain'; this.weatherTimer = 120; if (this.audio) this.audio.rainSet(0.7); break;
      case 'wStorm': this.weather = 'storm'; this.weatherTimer = 120; if (this.audio) this.audio.rainSet(1); break;
      // ---- Player controls ----
      case 'revive': if (p.dead) this.respawn(); this.ui.toast('Revived'); break;
      case 'resetTalents': p.respecTalents(); this.ui.toast(`Talents reset — ${p.skillPoints} points refunded`); this.ui.refreshTalents && this.ui.refreshTalents(); break;
      case 'tpRavenside': this._adminTeleport(0); break;
      case 'tpBastion': this._adminTeleport(1); break;
      case 'tpUnion': this._adminTeleport(2); break;
      case 'tpMercy': this._adminTeleport(3); break;
      case 'tpDeep': { p.x = 4000; p.y = 1000; this.r3d.follow(p.x, p.y, true); this.ui.toast('Teleported: deep city'); break; }
      case 'restart':
        if (confirm('Are you sure you want to FULLY restart? Your character, gear and progress will be wiped.')) this.hardReset();
        break;
      default:
        if (action.startsWith('spawnBoss:')) {
          const id = action.split(':')[1];
          if (ENEMIES[id]) { this.entities.spawnZombieAt(p.x + 260, p.y, id, { tier: 5, variant: null }); this.ui.toast(`${ENEMIES[id].name} spawned`); }
        }
    }
    this.ui.updateHUD();
  }

  _adminTeleport(idx) {
    const o = this.overworld.outposts[idx];
    if (!o) return;
    this.player.x = o.zone.x + o.zone.w / 2;
    this.player.y = o.zone.y + o.zone.h / 2 + 40;
    this.r3d.follow(this.player.x, this.player.y, true);
    this.ui.toast('Teleported: ' + o.name);
  }

  _handleInteractKeys() {
    const i = this.input;
    if (i.wasPressed('e')) {
      if (this.nearby.exit) this.exitBuilding();
      else if (this.nearby.door) this.enterBuilding(this.nearby.door);
      else if (this.nearby.service === 'trader') this.setState('trader');
      else if (this.nearby.service === 'storage') this.setState('storage');
      else if (this.nearby.service === 'missions') this.setState('missions');
      else if (this.nearby.service === 'market') this.setState('market');
      else if (this.nearby.service === 'heal') this._useHealStation();
      else if (this.nearby.container) this._startLoot(this.nearby.container);
      else if (this.nearby.corpse) this._startHarvest(this.nearby.corpse);
    }
    if (i.wasPressed('f')) this._quickHeal();
    if (i.wasPressed(' ')) this._activateAbility();   // SPACE — Shift stays sprint-only
  }

  // --- District tracking: banner on change, mission/achievement hooks ---
  _updateDistrict(dt) {
    if (this.scene !== this.overworld) return;
    const d = this.overworld.getDistrictTier(this.player.x, this.player.y);
    if (d !== this.currentDistrict) {
      this.currentDistrict = d;
      const info = CONFIG.districts[d - 1];
      this.ui.showDistrictBanner(d, info);
      if (this.missions) this.missions.onDistrict(d);
      if (this.analytics && d > this.analytics.maxDistrict) {
        this.analytics.maxDistrict = d;
        this.achievements.check();
      }
    }
  }

  // --- World boss: a rare, map-wide event in the deep city ---
  _updateWorldBoss(dt) {
    if (this.scene !== this.overworld) return;
    if (this.entities.zombies.some(z => z.alive && z.cfg.behavior && z.cfg.behavior.bossClass === 'world')) return;
    this.worldBossTimer -= dt;
    if (this.worldBossTimer > 0) return;
    this.worldBossTimer = Utils.rand(...CONFIG.spawn.worldBossInterval);
    // spawn deep in the city, far from the player
    for (let tries = 0; tries < 30; tries++) {
      const p = this.overworld.randomStreetPoint(this.player.x, this.player.y, 1600);
      const d = this.overworld.getDistrictTier(p.x, p.y);
      if (d < 5) continue;
      const z = this.entities.spawnZombieAt(p.x, p.y, 'devourer', { tier: d, variant: null });
      if (z) {
        this.ui.toast('🌍 WORLD BOSS: THE DEVOURER has surfaced in ' + CONFIG.districts[d - 1].name + '!');
        if (this.audio) this.audio.bossWarning();
      }
      return;
    }
  }

  // --- Ambient horror stingers — the city sounds worse the deeper you go ---
  _updateAmbience(dt) {
    this._stingerTimer -= dt;
    if (this._stingerTimer > 0) return;
    const D = CONFIG.districts[this.currentDistrict - 1] || {};
    const intensity = this.scene === this.overworld ? (D.ambience || 0.3) : 0.7;
    const gapScale = 1.2 - intensity * 0.7;   // dangerous places murmur more often
    this._stingerTimer = Utils.rand(CONFIG.ambience.minGap, CONFIG.ambience.maxGap) * gapScale;
    if (this.audio) {
      const kind = Utils.weighted([
        { v: 'scream', w: 3 + intensity * 4 },
        { v: 'gunfire', w: 2 },
        { v: 'creak', w: 3 },
        { v: 'buzz', w: 2 },
      ]).v;
      this.audio.stinger(kind, intensity);
    }
  }

  // --- Dynamic weather state machine ---
  _updateWeather(dt) {
    this.weatherTimer -= dt;
    if (this.weatherTimer > 0) return;
    const next = {
      clear:    [['clear', 30], ['overcast', 55], ['rain', 15]],
      overcast: [['clear', 35], ['rain', 40], ['overcast', 15], ['storm', 10]],
      rain:     [['overcast', 40], ['rain', 25], ['storm', 25], ['clear', 10]],
      storm:    [['rain', 55], ['overcast', 35], ['storm', 10]],
    }[this.weather] || [['clear', 1]];
    const pick = Utils.weighted(next.map(([v, w]) => ({ v, w }))).v;
    if (pick !== this.weather) {
      this.weather = pick;
      const msg = {
        clear: 'The sky clears a little...',
        overcast: 'Grey clouds roll over Ravenside',
        rain: '🌧 Rain starts hammering the streets — visibility dropping',
        storm: '⛈ STORM — the city goes dark. Stay close to the light.',
      }[pick];
      if (msg) this.ui.toast(msg);
    }
    this.weatherTimer = Utils.rand(CONFIG.weather.minDuration, CONFIG.weather.maxDuration);
    if (this.audio) this.audio.rainSet(pick === 'rain' ? 0.7 : pick === 'storm' ? 1 : 0);
  }

  enterBuilding(building) {
    if (this.interior || this._loading) return;
    this._loading = true;
    this.state = 'loading';
    this.ui.showLoading('ENTERING', building.name);
    if (this.missions) this.missions.onEnterBuilding(building.tag);
    setTimeout(() => {
      this.returnPos = { x: building.door.cx, y: building.door.cy + 24, building };
      this.interior = new Interior(building);
      this.scene = this.interior;
      this.player.x = this.interior.spawnX;
      this.player.y = this.interior.spawnY;
      this.r3d.buildScene(this.scene);
      this.r3d.follow(this.player.x, this.player.y, true);
      this.ui.hideLoading();
      this._loading = false;
      this.state = 'playing';
      this.ui.toast(`Entered ${building.name} — clear the infected, loot, then exit`);
      if (this.audio) this.audio.musicStart();   // DF1-style dread inside instances
    }, 850);
  }

  exitBuilding() {
    if (!this.interior || !this.returnPos || this._loading) return;
    this._loading = true;
    this.state = 'loading';
    this.ui.showLoading('RETURNING', 'Ravenside streets');
    const rp = this.returnPos;
    setTimeout(() => {
      this.player.x = rp.x;
      this.player.y = rp.y;
      this.interior = null;
      this.scene = this.overworld;
      this.returnPos = null;
      this.r3d.buildScene(this.scene);
      this.r3d.follow(this.player.x, this.player.y, true);
      this.ui.hideLoading();
      this._loading = false;
      this.state = 'playing';
      this.ui.toast('Back on the streets of Ravenside');
      if (this.audio) this.audio.musicStop();
      SaveSystem.save(this);
    }, 650);
  }

  toggleState(s) {
    if (this.pauseCountdown > 0) this.cancelPauseCountdown();
    if (this.state === s) this.setState('playing');
    else if (this.state === 'playing') this.setState(s);
  }

  setState(s) {
    this.state = s;
    this.ui.onStateChange(s);
    if (s === 'playing') {
      // Grace period returning from a menu — no cheap bites on close.
      // (While IN menus/pause, gameplay is fully suspended, so you're already immune.)
      this.player.invulnTimer = Math.max(this.player.invulnTimer, 0.8);
      SaveSystem.save(this);
    }
  }

  _updateInteractions() {
    this.nearby.container = null;
    this.nearby.service = null;
    this.nearby.door = null;
    this.nearby.exit = false;
    this.nearby.corpse = null;

    const c = this.objects.nearest(this.player.x, this.player.y, CONFIG.loot.interactRange);
    if (c) this.nearby.container = c;
    // Harvestable elite/boss corpses (only when no container is closer)
    if (!c && this.entities.nearestCorpse) {
      const z = this.entities.nearestCorpse(this.player.x, this.player.y, CONFIG.loot.corpseRange);
      if (z) this.nearby.corpse = z;
    }

    if (this.scene === this.overworld) {
      const door = this.overworld.nearestDoor(this.player.x, this.player.y, 70);
      if (door) this.nearby.door = door;
      if (this.overworld.inSafeZone(this.player.x, this.player.y)) {
        const near = (s) => s && Utils.dist(this.player.x, this.player.y, s.x + s.w / 2, s.y + s.h / 2) < 80;
        for (const o of (this.overworld.outposts || [{ trader: this.overworld.trader, storage: this.overworld.storage, heal: this.overworld.healStation }])) {
          if (near(o.trader)) { this.nearby.service = 'trader'; this.nearby.station = o.trader; break; }
          if (near(o.storage)) { this.nearby.service = 'storage'; this.nearby.station = o.storage; break; }
          if (near(o.heal)) { this.nearby.service = 'heal'; this.nearby.station = o.heal; break; }
          if (o.heal2 && near(o.heal2)) { this.nearby.service = 'heal'; this.nearby.station = o.heal2; break; }
          if (o.missions && near(o.missions)) { this.nearby.service = 'missions'; this.nearby.station = o.missions; break; }
          if (o.market && near(o.market)) { this.nearby.service = 'market'; this.nearby.station = o.market; break; }
        }
      }
    } else if (this.interior && this.interior.nearExit(this.player.x, this.player.y, 80)) {
      this.nearby.exit = true;
    }
  }

  // ---------- Day / night ----------
  // daylight(): 0 = midnight .. 1 = noon (smooth cosine curve).
  daylight() {
    const frac = (this.dayTime % CONFIG.world.dayCycleSeconds) / CONFIG.world.dayCycleSeconds;
    return 0.5 - 0.5 * Math.cos(frac * Math.PI * 2);
  }
  isNight() { return this.daylight() < 0.3; }

  // --- System 1: Threat Escalation ---
  // Noise from weapons/sprinting accumulates districtThreat, which scales spawns.
  alertZombies(x, y, radius) {
    if (!radius) return;
    // Accumulate threat: noise radius directly feeds the meter (0→100)
    const threatGain = Math.min(radius * 0.032, 35);
    this.districtThreat = Math.min(100, this.districtThreat + threatGain);
    this._lastNoiseTime = 0;

    const r2 = radius * radius;
    for (const z of this.entities.zombies) {
      if (!z.alive) continue;
      if (Utils.dist2(x, y, z.x, z.y) <= r2 && z.state === 'patrol') z.state = 'chase';
    }
  }

  // Call every frame from update(). Decay threat when no recent noise events.
  _decayDistrictThreat(dt) {
    this._lastNoiseTime = (this._lastNoiseTime || 0) + dt;
    // Decay kicks in after 3 seconds of silence
    if (this._lastNoiseTime > 3) {
      this.districtThreat = Math.max(0, this.districtThreat - this.districtThreatDecay * dt);
    }
  }

  // Looting is a 3-second channel; resuming continues from saved progress.
  _startLoot(c) {
    if (this.looting || c.looted) return;
    this.looting = { c, t: c.lootProgress || 0, max: 3, hp: this.player.hp };
    this.ui.showLootBar();
  }
  // Harvesting an elite/boss corpse is a shorter channel with the same rules.
  _startHarvest(z) {
    if (this.looting || z.harvested) return;
    this.looting = { corpse: z, t: z.lootProgress || 0, max: 2, hp: this.player.hp };
    this.ui.showLootBar();
  }
  _updateLoot(dt) {
    const L = this.looting;
    if (!L) return;
    const tx = L.c ? L.c.cx : L.corpse.x;
    const ty = L.c ? L.c.cy : L.corpse.y;
    const range = (L.c ? CONFIG.loot.interactRange : CONFIG.loot.corpseRange) + 24;
    const gone = L.c ? L.c.looted : L.corpse.harvested;
    // You may shuffle around ON the loot spot — only stepping OFF it (or dying)
    // pauses the search, and the progress is REMEMBERED on the container.
    if (gone || this.player.dead ||
        Utils.dist(this.player.x, this.player.y, tx, ty) > range) {
      if (L.c) L.c.lootProgress = L.t;
      else L.corpse.lootProgress = L.t;
      this.looting = null; this.ui.hideLootBar();
      if (!gone && !this.player.dead) this.ui.toast(`Search paused at ${Math.round((L.t / L.max) * 100)}% — come back to finish`);
      return;
    }
    L.t += dt;
    this.ui.updateLootBar(L.t / L.max);
    if (L.t >= L.max) {
      this.looting = null; this.ui.hideLootBar();
      if (L.c) this._completeLoot(L.c);
      else this._completeHarvest(L.corpse);
    }
  }
  _lootTierHere() {
    return this.scene.getDistrictTier ? this.scene.getDistrictTier(this.player.x, this.player.y) : 1;
  }
  _completeLoot(c) {
    const bonus = this.player.lootBonus + (this.player.lootMult - 1);
    const drops = LootSystem.roll(c.lootTable || c.type, bonus, this._lootTierHere());
    let any = false, summary = [];
    for (const d of drops) {
      const leftover = this.inventory.add(d.id, d.qty);
      const got = d.qty - leftover;
      if (got > 0) { any = true; summary.push(`${got}x ${ITEMS[d.id].name}`); }
      if (leftover > 0) this.ui.toast('Inventory full — some loot left behind');
    }
    c.looted = true;
    c.flash = 0.3;
    this.stats.looted++;
    if (this.analytics) {
      this.analytics.counters.looted++;
      if (c.type === 'cache') {
        this.analytics.counters.cachesFound++;
        this.ui.toast('✨ HIDDEN CACHE! Someone\'s endgame stash is yours now.');
      }
    }
    if (this.missions) {
      this.missions.onLoot();
      for (const d of drops) this.missions.onItemGained(d.id, d.qty);
    }
    // rare finds get the full lightshow
    for (const d of drops) {
      const it = ITEMS[d.id];
      if (it && ['rare', 'epic', 'legendary'].includes(it.rarity)) {
        this.entities.addLootBeam(c.cx, c.cy, it.rarity);
        this.entities.addLootText(c.cx, c.cy, it.name, it.rarity);
      }
    }
    this.player.addXP(Progression.xp.lootContainer, this);
    if (any) this.ui.toast('Looted: ' + summary.join(', '));
    else this.ui.toast('Container was empty');
    this.achievements.check();
    this.ui.refreshInventory();
    SaveSystem.save(this);
  }
  _completeHarvest(z) {
    if (z.harvested) return;
    z.harvested = true;
    const bonus = this.player.lootBonus + (this.player.lootMult - 1);
    const drops = LootSystem.roll(z.corpseTable, bonus, this._lootTierHere());
    let summary = [];
    for (const d of drops) {
      const leftover = this.inventory.add(d.id, d.qty);
      const got = d.qty - leftover;
      if (got > 0) summary.push(`${got}x ${ITEMS[d.id].name}`);
      if (leftover > 0) this.ui.toast('Inventory full — some loot left behind');
    }
    this.entities.addSpark(z.x, z.y, '#c9a86a', 10);
    this.ui.toast(summary.length ? `Harvested ${z.cfg.name}: ` + summary.join(', ') : `${z.cfg.name} had nothing usable`);
    if (this.analytics) this.analytics.counters.harvests++;
    if (this.missions) {
      this.missions.onHarvest();
      for (const d of drops) this.missions.onItemGained(d.id, d.qty);
    }
    this.achievements.check();
    this.ui.refreshInventory();
    SaveSystem.save(this);
  }

  _useHealStation() {
    if (this.player.hp >= this.player.maxHp && this.player.stamina >= this.player.maxStamina) {
      this.ui.toast('Already at full health'); return;
    }
    this.player.hp = this.player.maxHp;
    this.player.stamina = this.player.maxStamina;
    this.ui.toast('Healed at medical station');
    this.entities.addSpark(this.player.x, this.player.y, '#5adf7a', 12);
  }

  _quickHeal() {
    // Wounded? Reach for the bandage first — it also splints and clots.
    const order = (this.player.bleeding > 0 || this.player.fractured)
      ? ['bandage', 'medkit', 'food_can'] : ['bandage', 'medkit', 'food_can'];
    for (const id of order) {
      if (this.inventory.count(id) > 0) { this.useItem(id); return; }
    }
    this.ui.toast('No healing items');
  }

  _activateAbility() {
    if (this.player.abilityTimer > 0) {
      this.ui.toast('Ability on cooldown (' + Math.ceil(this.player.abilityTimer) + 's)');
      return;
    }
    const ability = getAbility(this.selectedClass);
    if (!ability) return;
    this.player.abilityActive = true;
    this.player.abilityDuration = ability.duration;
    this.player.abilityTimer = ability.cooldown * (this.player.abilityCdMult || 1);
    if (ability.effect) {
      if (ability.effect.fireRateMult) this.player.fireRateMult = ability.effect.fireRateMult;
      if (ability.effect.speedMult) this.player.speedMult = ability.effect.speedMult;
      if (ability.effect.damageBonus) this.player.rangedMult += ability.effect.damageBonus;
      if (ability.effect.damageResist) this.player.damageReduc += ability.effect.damageResist;
      if (ability.effect.hpRestore) this.player.heal(ability.effect.hpRestore);
      if (ability.effect.turret) this._deployTurret();
      if (ability.effect.roll) this._combatRoll();
    }
    this.ui.toast(`Activated ${ability.name}`);
    this.addAbilityVFX(this.player.x, this.player.y);
  }

  // Engineer — a temporary automated turret (a stationary friendly gun).
  _deployTurret() {
    if (!this.scene.guards) this.scene.guards = [];
    const t = new Guard(this.player.x, this.player.y, { x: this.player.x, y: this.player.y });
    t.isTurret = true; t.life = 12; t.range = 520; t.fireRate = 0.12; t.damage = 30;
    this.scene.guards.push(t);
    this.entities.addSpark(this.player.x, this.player.y, '#ffcf4a', 14);
  }

  // Scout — dash forward with brief invulnerability.
  _combatRoll() {
    const a = this.player.facing;
    const dest = { x: this.player.x + Math.cos(a) * 130, y: this.player.y + Math.sin(a) * 130 };
    Collision.resolveCircle(dest, this.player.radius, this.scene.solids);
    this.player.x = Utils.clamp(dest.x, this.player.radius, this.scene.w - this.player.radius);
    this.player.y = Utils.clamp(dest.y, this.player.radius, this.scene.h - this.player.radius);
    this.player.invulnTimer = Math.max(this.player.invulnTimer, 0.6);
    this.entities.addSpark(this.player.x, this.player.y, '#8fd4ff', 12);
  }

  addAbilityVFX(x, y) {
    this.entities.addText(x, y - 30, 'ABILITY!', '#ffff00');
    this.entities.addSpark(x, y, '#ffff00', 12);
  }

  _updateSiege(dt) {
    if (!this.siegeActive) {
      this.siegeTimer -= dt;
      if (this.siegeTimer <= 0) {
        this._startSiege();
      }
    } else {
      this.siegeWaveDuration -= dt;
      this._siegeSpawnTick(dt);
      if (this.siegeWaveDuration <= 0) {
        this._endSiege();
      }
    }
  }

  _startSiege() {
    this.siegeActive = true;
    this.siegeWaveDuration = 200 + Math.random() * 140;
    this.siegeWaveMax = this.siegeWaveDuration;
    this._siegeWaveTimer = 6;
    this.ui.toast('⚠️ SIEGE ALERT! The horde has found you!');
    if (this.audio) this.audio.sirenStart();   // outpost air-raid siren wails until it ends
    const tier = this.overworld.getDistrictTier ? this.overworld.getDistrictTier(this.player.x, this.player.y) : 1;
    for (let i = 0; i < 18 + Math.floor(Math.random() * 10) + tier * 4; i++) {
      const p = this.overworld.randomStreetPoint(this.player.x, this.player.y, 380);
      this.entities.spawnZombieAt(p.x, p.y, rollEnemyType(Math.max(2, tier), this.isNight && this.isNight()));
    }
  }

  // Continuous pressure while a siege is active.
  _siegeSpawnTick(dt) {
    if (!this.siegeActive) return;
    this._siegeWaveTimer = (this._siegeWaveTimer || 6) - dt;
    if (this._siegeWaveTimer > 0) return;
    this._siegeWaveTimer = 4 + Math.random() * 3;
    const tier = this.overworld.getDistrictTier ? this.overworld.getDistrictTier(this.player.x, this.player.y) : 1;
    for (let i = 0; i < 5 + tier * 2; i++) {
      const p = this.overworld.randomStreetPoint(this.player.x, this.player.y, 360);
      this.entities.spawnZombieAt(p.x, p.y, rollEnemyType(Math.max(2, tier), this.isNight && this.isNight()));
    }
  }

  _endSiege() {
    this.siegeActive = false;
    this.siegeTimer = 330 + Math.random() * 90;   // ~6 min between sieges
    this.ui.toast('Siege repelled. Stay sharp.');
    if (this.audio) this.audio.sirenStop();
  }

  // Spend a skill point (called from the character sheet).
  unlockSkill(id) {
    const res = this.player.unlockSkill(id);
    if (!res.ok) { this.ui.toast(res.why || 'Cannot learn that yet'); return false; }
    this.ui.toast(`Learned: ${SKILL_TREE[id].name}`);
    SaveSystem.save(this);
    this.ui.refreshCharacter();
    this.ui.updateHUD();
    return true;
  }

  purchaseUpgrade(upgradeId) {
    const upg = getUpgrade(upgradeId);
    if (!upg) return false;
    const level = (this.upgrades[upgradeId]?.level || 0);
    if (level >= upg.maxLevel) {
      this.ui.toast(`${upg.name} is already maxed out`);
      return false;
    }
    if (this.credits < upg.cost) {
      this.ui.toast(`Need ${upg.cost}¢, you have ${this.credits}¢`);
      return false;
    }
    this.credits -= upg.cost;
    this.upgrades[upgradeId].level = level + 1;
    this._applyUpgradeEffects(upg);
    this.ui.toast(`Upgraded ${upg.name} to level ${level + 1}`);
    return true;
  }

  _applyUpgradeEffects(upg) {
    const eff = upg.effect || {};
    if (eff.damageReduc) this.overworld.damageReduc = (this.overworld.damageReduc || 0) + eff.damageReduc;
    if (eff.healthBonus) this.overworld.healthBonus = (this.overworld.healthBonus || 0) + eff.healthBonus;
    if (eff.guardCount) {
      for (let i = 0; i < eff.guardCount; i++) {
        const tower = this.overworld.towers[i % this.overworld.towers.length];
        if (tower) {
          const gx = tower.x + (i % 2 === 0 ? -30 : 30);
          const gy = tower.y + (i % 2 === 0 ? 30 : -30);
          const guard = new Guard(gx, gy, tower);
          this.overworld.guards.push(guard);
        }
      }
    }
  }

  useItem(id) {
    const it = ITEMS[id];
    if (!it || it.type !== 'consumable') { this.ui.toast('Cannot use that'); return; }
    if (this.inventory.count(id) <= 0) return;
    this.inventory.remove(id, 1);
    if (it.use) {
      // Bandages/medkits stop bleeding and splint broken bones.
      if (it.use.treatWounds) this.player.treatWounds(this);
      if (it.use.health) {
        this.player.heal(it.use.health);
        this.entities.addText(this.player.x, this.player.y - 20, `+${it.use.health} HP`, '#5adf7a');
      }
      if (it.use.stamina) {
        this.player.restoreStamina(it.use.stamina);
        this.entities.addText(this.player.x, this.player.y - 30, `+${it.use.stamina} STA`, '#6ab6e6');
      }
      // --- System 2: Antiviral cleanses infectionLevel ---
      if (it.use.cleanseInfection && this.player.isInfected) {
        this.player.infectionLevel = Math.max(0, this.player.infectionLevel - (it.use.cleanseInfection || 30));
        this.entities.addText(this.player.x, this.player.y - 50, '-INFECTION', '#7ad46a');
        if (this.player.infectionLevel <= 0) {
          this.player.isInfected = false;
          this.ui.toast('Pathogen purged — you are clean');
        }
      }
    }
    this.ui.toast(`Used ${it.name}`);
    this.ui.refreshInventory();
    this.ui.updateHUD();
  }

  // Click-to-equip from a specific bag slot (weapons AND armor).
  equipItemFromSlot(inv, index) {
    const slot = inv.slots[index];
    if (!slot) return;
    const it = ITEMS[slot.id];
    if (it && it.type === 'armor') {
      const res = this.player.equipArmorItem(slot.id);
      if (!res.ok) { this.ui.toast('Cannot equip that'); return; }
      inv.removeSlot(index, 1);
      if (res.prevItem) inv.add(res.prevItem, 1);   // displaced piece back to bag
      this.ui.toast(`Equipped ${it.name}`);
      this.ui.refreshInventory();
      this.ui.updateHUD();
      return;
    }
    if (it && it.type === 'weapon') this.equipItem(slot.id);
  }

  // Unequip armor from a doll slot back into the bag.
  unequipArmorToBag(slot) {
    const itemId = this.player.unequipArmor(slot);
    if (!itemId) return;
    const leftover = this.inventory.add(itemId, 1);
    if (leftover > 0) {
      // no room — put it back on
      this.player.equipArmorItem(itemId);
      this.ui.toast('No bag space to unequip');
    } else {
      this.ui.toast(`Unequipped ${ITEMS[itemId].name}`);
    }
    this.ui.refreshInventory();
    this.ui.updateHUD();
  }

  equipItem(id) {
    const it = ITEMS[id];
    if (!it || it.type !== 'weapon' || !it.weaponId) return;
    // Register the weapon into a hotkey slot + set its magazine (so 1/2/3 can select it).
    this.player.equipWeapon(it.weaponId);
    const w = getWeapon(it.weaponId);
    if (w.kind === 'ranged') this.player.mag = w.magSize;   // comes loaded
    const slot = this.player.weaponSlots.indexOf(it.weaponId);
    this.ui.toast(`Equipped ${it.name}${slot >= 0 ? ' → slot ' + (slot + 1) : ''}`);
    this.ui.updateHUD();
  }

  onZombieHit(zombie, res, x, y, crit, owner = 'player') {
    this.entities.addText(x, y - 10, res.headshot ? `${res.dmg}!` : `${res.dmg}`, res.headshot ? '#ffcf4a' : '#ff7a5a');
    this.entities.addSpark(x, y, '#8a3030', res.headshot ? 10 : 5);
    if (this.audio) this.audio.zombie('hit', zombie.cfg, this._zVol(zombie));
    if (owner === 'player') {
      if (res.headshot && !res.killed) this.stats.headshots++;
      // crunchy feedback: crosshair hit marker + tick
      this.hitMarkers.push({ t: 0.22, crit: !!crit, head: !!res.headshot });
      if (this.audio) this.audio.hitTick(crit || res.headshot);
    }
    // GORE: wounds paint the street even before the kill
    if (this.r3d && this.r3d.addBlood && Math.random() < 0.45) {
      this.r3d.addBlood(zombie.x + Utils.rand(-10, 10), zombie.y + Utils.rand(-10, 10), 0.45);
    }
    if (res.killed) {
      // persistent blood pool + arterial burst under the kill
      if (this.r3d && this.r3d.addBlood) {
        this.r3d.addBlood(zombie.x, zombie.y, zombie.radius / 12);
        this.r3d.addBlood(zombie.x + Utils.rand(-22, 22), zombie.y + Utils.rand(-22, 22), 0.6);
      }
      this.entities.addSpark(zombie.x, zombie.y, '#7a1414', 14);
      this._onZombieKilled(zombie, res.headshot, owner);
    }
  }

  // Distance-attenuated volume for a zombie's vocalisation.
  _zVol(z) {
    const d = Utils.dist(z.x, z.y, this.player.x, this.player.y);
    return Utils.clamp(1 - d / 850, 0, 1);
  }
  // Periodically let a nearby zombie growl (idle or aggressive).
  _updateZombieAudio(dt) {
    if (!this.audio) return;
    this._growlTimer = (this._growlTimer || 1.5) - dt;
    if (this._growlTimer > 0) return;
    this._growlTimer = 1.1 + Math.random() * 1.6;
    const zs = this.entities.zombies;
    if (!zs.length) return;
    // pick a random nearby, audible zombie
    for (let tries = 0; tries < 4; tries++) {
      const z = zs[Utils.randInt(0, zs.length - 1)];
      if (!z || !z.alive) continue;
      const vol = this._zVol(z);
      if (vol < 0.05) continue;
      this.audio.zombie(z.state === 'chase' ? 'aggro' : 'idle', z.cfg, vol);
      break;
    }
  }

  _onZombieKilled(z, headshot, owner = 'player') {
    const b = z.cfg.behavior || {};

    // Guard/turret kills clear the streets but earn the PLAYER nothing —
    // no XP, no credits, no drops. You cannot level by loitering at the walls.
    if (owner !== 'player') {
      z.dropped = true;
      return;
    }

    this.stats.kills++;
    if (headshot) this.stats.headshots++;
    // DF-scale XP: walkers ~100, bosses in the thousands (see killXpMult).
    const mult = CONFIG.progression.killXpMult || 1;
    const xp = Math.round((z.cfg.xp || Progression.xp.zombieKill) * mult) +
      (headshot ? Progression.xp.headshotBonus * mult : 0);
    this.player.addXP(xp, this);
    this.entities.addText(z.x, z.y - 24, `+${xp} XP`, '#7ad4ff');

    // Kill credits, DF-style: every confirmed kill pays. District 1 pays extra
    // (beginner cash flow), elites and bosses pay serious money.
    const D = CONFIG.districts[(z.district || 1) - 1] || {};
    let credits;
    if (z.variant || b.boss) {
      const [lo, hi] = CONFIG.loot.eliteKillCredits;
      credits = Utils.randInt(lo, hi) + Math.floor((z.cfg.hp || 20) / 20) + (headshot ? 5 : 0);
    } else {
      const [lo, hi] = CONFIG.loot.killCredits;
      credits = Math.round(Utils.randInt(lo, hi) * (D.cashMult || 1)) + (headshot ? 1 : 0);
    }
    if (credits > 0) {
      this.player.currency += credits;
      this.credits += credits;
      this.creditsEarned += credits;
      if (this.analytics) this.analytics.counters.creditsEarned += credits;
      this.entities.addText(z.x, z.y - 40, `+${credits}¢`, '#ffd700');
    }

    // Meta hooks: analytics, missions, achievements
    const wArch = (getWeapon(this.player.equipped) || {}).archetype;
    if (this.analytics) this.analytics.kill(z, wArch, z.district, headshot);
    if (this.missions) this.missions.onKill(z, headshot);

    if (this.player.companion) {
      this.player.companion.addXP(xp * 0.5);
    }

    if (b.boss) {
      this.stats.bossKills = (this.stats.bossKills || 0) + 1;
      this.player.currency += 150;
      this.credits = (this.credits || 0) + 150;
      this.ui.toast(`☠ ${z.cfg.name} DOWN! +150cr — harvest the corpse [E]`);
    } else if (z.lootable) {
      this.ui.toast(`${z.cfg.name} down — harvest the corpse [E]`);
    }
    // (Bloats now swell and detonate on a fuse — handled by the Zombie itself.)

    // Normal zombies only OCCASIONALLY carry anything worth taking.
    if (!z.lootable && Utils.chance(CONFIG.loot.zombieDropChance)) {
      const rolls = LootSystem.roll('zombie', this.player.lootBonus + (this.player.lootMult - 1));
      for (const d of rolls) {
        const leftover = this.inventory.add(d.id, d.qty);
        if (d.qty - leftover > 0) {
          const item = ITEMS[d.id];
          this.entities.addText(z.x, z.y, `+${d.qty - leftover} ${item.glyph || ''}`, item.color);
        }
      }
    }

    // Rare procedural weapon: a genuine event now, not a drizzle.
    const rareWeaponChance = Math.min(CONFIG.loot.rareWeaponCap,
      CONFIG.loot.rareWeaponBase + this.player.level * CONFIG.loot.rareWeaponPerLevel);
    if (Utils.chance(rareWeaponChance)) {
      const rareWeapon = LootSystem.rollRareWeapon();
      if (rareWeapon) {
        const leftover = this.inventory.add(rareWeapon.id, 1, rareWeapon);
        if (!leftover) {
          this.entities.addLootBeam(z.x, z.y, rareWeapon.rarity);
          this.entities.addLootText(z.x, z.y, rareWeapon.name, rareWeapon.rarity);
        }
      }
    }

    z.dropped = true;
    this.ui.refreshInventory();
  }

  addMuzzleFlash(x, y, angle) {
    if (this.r3d && this.r3d.muzzleFlash) this.r3d.muzzleFlash(x, y);
    if (this.r3d && this.r3d.addShake) this.r3d.addShake(1.1);   // recoil kick
    for (let i = 0; i < 4; i++) {
      const a = angle + Utils.rand(-0.3, 0.3), sp = Utils.rand(120, 240);
      this.entities.particles.push({
        wx: x, wy: y, wz: 22, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.12, max: 0.12, color: '#ffd98a', size: Utils.rand(2, 4),
      });
    }
  }

  addMeleeArc(x, y, angle) {
    this.entities.addSpark(x + Math.cos(angle) * 30, y + Math.sin(angle) * 30, '#dfe6ec', 4);
  }

  respawn() {
    const sz = this.overworld.safeZone;
    if (this.audio) { this.audio.musicStop(); this.audio.sirenStop(); }
    this.player.dead = false;
    this.player.hp = this.player.maxHp;
    this.player.stamina = this.player.maxStamina;
    this.player.bleeding = 0; this.player.fractured = false; this.player.blur = 0;
    // Return straight to the outpost (no loading dance).
    this._loading = false;
    this.interior = null;
    this.returnPos = null;
    this.scene = this.overworld;
    this.player.x = sz.x + sz.w / 2;
    this.player.y = sz.y + sz.h / 2 + 60;
    const lost = Math.round(this.player.currency * 0.25);   // death tax — stings, doesn't cripple
    this.player.currency -= lost;
    if (this.analytics) this.analytics.counters.deaths++;
    this.player.stamina = this.player.maxStamina * 0.5;
    this.overworld.entities.reset();
    if (this.overworld._prePlaceHorde) this.overworld._prePlaceHorde();
    this.r3d.buildScene(this.scene);
    this.setState('playing');
    this.ui.hideDeath();
    this.ui.hideLoading();
    this.ui.toast(`Dragged back to the outpost — weak and ${lost} credits lighter`);
    this.r3d.follow(this.player.x, this.player.y, true);
    SaveSystem.save(this);
  }

  hardReset() {
    SaveSystem.clear();
    location.reload();
  }

  render() {
    const frozen = this.state === 'paused';
    if (!frozen) this.r3d.sync(this);   // paused → suspend mesh/animation updates
    this.r3d.render();
    if (!frozen && this.state !== 'loading') this._renderFX();
    if (this.minimap) this.minimap.render(this);
  }

  // 2D overlay (#fx): floating combat text, labels, interaction prompt, reticle,
  // low-health flash. Everything is projected from world space via the 3D camera.
  _renderFX() {
    const ctx = this.fxctx; if (!ctx) return;
    const W = this.fx.width, H = this.fx.height;
    ctx.clearRect(0, 0, W, H);

    // Floating combat text + sparks
    for (const p of this.entities.particles) {
      const wx = p.wx != null ? p.wx : p.x, wy = p.wy != null ? p.wy : p.y, wz = p.wz != null ? p.wz : 20;
      const s = this.r3d.project(wx, wy, wz);
      if (s.behind) continue;
      ctx.globalAlpha = Utils.clamp(p.life / p.max, 0, 1);
      if (p.text) {
        ctx.fillStyle = p.color; ctx.font = `bold ${p.size}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center'; ctx.fillText(p.text, s.x, s.y);
      } else {
        ctx.fillStyle = p.color; ctx.beginPath(); ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1; ctx.textAlign = 'center';

    // World-space labels (building names / stations / exit)
    for (const l of this.r3d.labels) {
      const s = this.r3d.project(l.x, l.y, l.h);
      if (s.behind) continue;
      ctx.font = (l.kind === 'title' ? '700 18px' : '600 12px') + ' "Segoe UI", sans-serif';
      const tw = ctx.measureText(l.text).width;
      ctx.fillStyle = 'rgba(8,10,12,0.5)';
      ctx.fillRect(s.x - tw / 2 - 6, s.y - 13, tw + 12, 18);
      ctx.fillStyle = l.kind === 'enter' ? '#e6c878' : l.kind === 'exit' ? '#9ecbff'
        : l.kind === 'station' ? '#eef2f6' : l.kind === 'title' ? '#c9d2db' : 'rgba(176,186,196,0.8)';
      ctx.fillText(l.text, s.x, s.y);
    }

    // "?" over every unlooted container in view
    if (this.scene.objects) {
      ctx.font = 'bold 15px "Segoe UI", sans-serif';
      for (const c of this.scene.objects.containers) {
        if (c.looted) continue;
        if (Utils.dist2(c.cx, c.cy, this.player.x, this.player.y) > 1200 * 1200) continue;
        const s = this.r3d.project(c.cx, c.cy, (c.height || 30) + 30);
        if (s.behind) continue;
        ctx.fillStyle = 'rgba(8,10,12,0.55)';
        ctx.fillRect(s.x - 8, s.y - 13, 16, 17);
        ctx.fillStyle = '#ffd24a';
        ctx.fillText('?', s.x, s.y);
      }
    }

    // Harvest markers over lootable corpses
    ctx.textAlign = 'center';
    ctx.font = 'bold 14px "Segoe UI", sans-serif';
    for (const z of this.entities.zombies) {
      if (!z.dead || !z.lootable || z.harvested) continue;
      if (Utils.dist2(z.x, z.y, this.player.x, this.player.y) > 900 * 900) continue;
      const s = this.r3d.project(z.x, z.y, 26);
      if (s.behind) continue;
      ctx.fillStyle = 'rgba(8,10,12,0.55)';
      ctx.fillRect(s.x - 9, s.y - 12, 18, 16);
      ctx.fillStyle = z.variant === 'irradiated' ? '#7ad46a' : '#e6c878';
      ctx.fillText('☠', s.x, s.y);
    }

    // Zombie name tags + HP bars (culled to nearby, alive, in-front)
    ctx.textAlign = 'center';
    const zlist = this.entities.zombies;
    for (let i = 0; i < zlist.length; i++) {
      const z = zlist[i];
      if (!z.alive) continue;
      if (Utils.dist2(z.x, z.y, this.player.x, this.player.y) > 1000 * 1000) continue;
      const top = (z.bodyH || 34) + 20;
      const s = this.r3d.project(z.x, z.y, top);
      if (s.behind) continue;
      const boss = z.cfg.behavior && z.cfg.behavior.boss;
      const name = z.cfg.name || 'Infected';
      ctx.font = (boss ? 'bold 13px' : '600 11px') + ' "Segoe UI", sans-serif';
      const tw = ctx.measureText(name).width;
      // HP bar
      const bw = Math.max(26, tw + 6), hpF = Utils.clamp(z.hp / z.maxHp, 0, 1);
      ctx.fillStyle = 'rgba(0,0,0,0.55)'; ctx.fillRect(s.x - bw / 2, s.y + 2, bw, 4);
      ctx.fillStyle = boss ? '#e05a5a' : (hpF > 0.5 ? '#8bc34a' : hpF > 0.25 ? '#d9b74a' : '#d94f4f');
      ctx.fillRect(s.x - bw / 2, s.y + 2, bw * hpF, 4);
      // name
      ctx.fillStyle = boss ? '#ff8a6a' : 'rgba(220,210,205,0.92)';
      ctx.fillText(name, s.x, s.y);
    }
    ctx.textAlign = 'left';

    this._fxAcidTelegraphs(ctx);
    this._fxMissionArrows(ctx);
    if (this.state === 'playing' || this.state === 'dead') this._fxPrompt(ctx);
    this._fxReticle(ctx);
    this._fxAbilityCooldown(ctx);
    if (this.state === 'playing') {
      this._fxCreditsDisplay(ctx);
      this._fxSiegeStatus(ctx);
    }
    ctx.textAlign = 'left';

    // Low-health red flash
    if (!this.player.dead && this.player.hp / this.player.maxHp < 0.3) {
      const pulse = 0.14 + Math.sin(performance.now() / 200) * 0.08;
      ctx.fillStyle = `rgba(150,20,20,${pulse})`;
      ctx.fillRect(0, 0, W, H);
    }
  }

  _fxPrompt(ctx) {
    let wx = 0, wy = 0, wz = 40, label = '';
    if (this.nearby.exit) { wx = this.interior.exitZone.cx; wy = this.interior.exitZone.cy; wz = 30; label = '[E] Exit building'; }
    else if (this.nearby.door) { wx = this.nearby.door.cx; wy = this.nearby.door.cy; wz = 40; label = `[E] Enter ${this.nearby.door.name}`; }
    else if (this.nearby.container) { wx = this.nearby.container.cx; wy = this.nearby.container.cy; wz = (this.nearby.container.height || 30) + 24; label = `[E] Search ${this.nearby.container.type}`; }
    else if (this.nearby.corpse) { wx = this.nearby.corpse.x; wy = this.nearby.corpse.y; wz = 30; label = `[E] Harvest ${this.nearby.corpse.cfg.name}`; }
    else if (this.nearby.service && this.nearby.station) {
      const st = this.nearby.station;
      wx = st.x + st.w / 2; wy = st.y + st.h / 2; wz = 70;
      label = this.nearby.service === 'trader' ? '[E] Trade' : this.nearby.service === 'storage' ? '[E] Storage'
        : this.nearby.service === 'missions' ? '[E] Missions' : '[E] Heal (free)';
    }
    if (!label) return;
    const s = this.r3d.project(wx, wy, wz);
    if (s.behind) return;
    ctx.font = 'bold 14px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
    const tw = ctx.measureText(label).width + 18;
    ctx.fillStyle = 'rgba(12,14,16,0.92)';
    ctx.fillRect(s.x - tw / 2, s.y - 12, tw, 24);
    ctx.strokeStyle = '#5a86c9'; ctx.lineWidth = 1;
    ctx.strokeRect(s.x - tw / 2, s.y - 12, tw, 24);
    ctx.fillStyle = '#e6ebf0'; ctx.fillText(label, s.x, s.y + 5);
  }

  _fxReticle(ctx) {
    const s = this.r3d.project(this.input.mouse.worldX, this.input.mouse.worldY, 2);
    if (s.behind) return;
    ctx.strokeStyle = this.player.equipped === 'pistol' ? 'rgba(255,120,90,0.8)' : 'rgba(200,210,220,0.6)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(s.x, s.y, 8, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s.x - 13, s.y); ctx.lineTo(s.x - 4, s.y);
    ctx.moveTo(s.x + 4, s.y); ctx.lineTo(s.x + 13, s.y); ctx.stroke();
    // HIT MARKERS: an X kick on the crosshair for every landed shot
    for (const hm of this.hitMarkers) {
      const a = Utils.clamp(hm.t / 0.22, 0, 1);
      const r = 6 + (1 - a) * 6;
      ctx.strokeStyle = hm.crit ? `rgba(255,210,74,${a})` : hm.head ? `rgba(255,150,74,${a})` : `rgba(255,255,255,${a * 0.8})`;
      ctx.lineWidth = hm.crit ? 2.5 : 2;
      ctx.beginPath();
      for (const [dx, dy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
        ctx.moveTo(s.x + dx * 4, s.y + dy * 4);
        ctx.lineTo(s.x + dx * r, s.y + dy * r);
      }
      ctx.stroke();
    }
  }

  // Screen-edge arrows pointing at active mission objectives (and the marker
  // itself when it's on screen).
  _fxMissionArrows(ctx) {
    if (!this.missions || !this.missions.getMarkers) return;
    const markers = this.missions.getMarkers();
    if (!markers.length) return;
    const W = this.fx.width, H = this.fx.height;
    for (const mk of markers) {
      const s = this.r3d.project(mk.x, mk.y, 40);
      const on = !s.behind && s.x > 40 && s.x < W - 40 && s.y > 60 && s.y < H - 60;
      if (on) {
        // floating diamond over the objective
        const bob = Math.sin(performance.now() / 260) * 5;
        ctx.fillStyle = mk.color;
        ctx.beginPath();
        ctx.moveTo(s.x, s.y - 22 + bob); ctx.lineTo(s.x + 9, s.y - 12 + bob);
        ctx.lineTo(s.x, s.y - 2 + bob); ctx.lineTo(s.x - 9, s.y - 12 + bob);
        ctx.closePath(); ctx.fill();
        ctx.font = 'bold 11px "Segoe UI", sans-serif'; ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(10,12,14,0.7)';
        const tw = ctx.measureText(mk.label).width + 10;
        ctx.fillRect(s.x - tw / 2, s.y + 4 + bob, tw, 15);
        ctx.fillStyle = mk.color;
        ctx.fillText(mk.label, s.x, s.y + 15 + bob);
      } else {
        // clamp an arrow to the screen edge, pointing the way
        const cx = W / 2, cy = H / 2;
        const dx = this.player ? mk.x - this.player.x : 0;
        const dy = this.player ? mk.y - this.player.y : 0;
        const ang = Math.atan2(dy, dx) - Math.PI / 4;   // camera yaw compensation (iso-ish)
        const ex = cx + Math.cos(ang) * (Math.min(W, H) * 0.42);
        const ey = cy + Math.sin(ang) * (Math.min(H, W) * 0.4);
        ctx.save();
        ctx.translate(Utils.clamp(ex, 46, W - 46), Utils.clamp(ey, 70, H - 90));
        ctx.rotate(ang);
        ctx.fillStyle = mk.color;
        ctx.globalAlpha = 0.85;
        ctx.beginPath();
        ctx.moveTo(14, 0); ctx.lineTo(-8, -8); ctx.lineTo(-4, 0); ctx.lineTo(-8, 8);
        ctx.closePath(); ctx.fill();
        ctx.restore();
        ctx.globalAlpha = 1;
      }
    }
  }

  // Green warning cone under a Spitter mid-telegraph — DODGE.
  _fxAcidTelegraphs(ctx) {
    for (const z of this.entities.zombies) {
      if (!z.alive || !(z.acidState > 0)) continue;
      const a = z.cfg.behavior && z.cfg.behavior.acid;
      if (!a) continue;
      const steps = 9;
      ctx.beginPath();
      const base = this.r3d.project(z.x, z.y, 2);
      if (base.behind) continue;
      ctx.moveTo(base.x, base.y);
      for (let i = 0; i <= steps; i++) {
        const ang = z.acidDir - a.arc / 2 + (a.arc * i) / steps;
        const p = this.r3d.project(z.x + Math.cos(ang) * a.range, z.y + Math.sin(ang) * a.range, 2);
        ctx.lineTo(p.x, p.y);
      }
      ctx.closePath();
      const pulse = 0.1 + 0.12 * Math.abs(Math.sin(performance.now() / 90));
      ctx.fillStyle = `rgba(120,220,60,${pulse})`;
      ctx.fill();
      ctx.strokeStyle = 'rgba(150,240,90,0.5)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  _fxAbilityCooldown(ctx) {
    const ability = getAbility(this.selectedClass);
    if (!ability) return;
    const W = this.fx.width, H = this.fx.height;
    const x = W - 120, y = H - 60, w = 100, h = 40;
    const cooldownPct = 1 - Math.max(0, this.player.abilityTimer / ability.cooldown);
    ctx.fillStyle = 'rgba(12,14,16,0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = this.player.abilityTimer > 0 ? 'rgba(100,100,100,0.6)' : 'rgba(100,200,100,0.8)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    if (cooldownPct > 0 && this.player.abilityTimer > 0) {
      ctx.fillStyle = 'rgba(255,100,100,0.3)';
      ctx.fillRect(x, y, w * (1 - cooldownPct), h);
      ctx.fillStyle = 'rgba(255,200,200,0.9)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(Math.ceil(this.player.abilityTimer) + 's', x + w / 2, y + h / 2 + 4);
    } else {
      ctx.fillStyle = 'rgba(100,255,100,0.9)';
      ctx.font = 'bold 12px monospace';
      ctx.textAlign = 'center';
      ctx.fillText('READY', x + w / 2, y + h / 2 + 4);
    }
    ctx.fillStyle = 'rgba(200,220,240,0.8)';
    ctx.font = '10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('[SPACE] ' + ability.name, x, y - 8);
  }

  _fxCreditsDisplay(ctx) {
    const W = this.fx.width, H = this.fx.height;
    const x = 20, y = H - 60;
    ctx.fillStyle = 'rgba(12,14,16,0.85)';
    ctx.fillRect(x, y, 140, 50);
    ctx.strokeStyle = 'rgba(200,200,100,0.8)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, 140, 50);
    ctx.fillStyle = '#ffd700';
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'left';
    ctx.fillText('CREDITS', x + 10, y + 18);
    ctx.font = 'bold 16px monospace';
    ctx.fillText(this.credits + '¢', x + 10, y + 38);
  }

  _fxSiegeStatus(ctx) {
    if (!this.siegeActive) return;
    const W = this.fx.width, H = this.fx.height;
    const x = W / 2 - 80, y = 20, w = 160, h = 50;
    ctx.fillStyle = 'rgba(255,50,50,0.25)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,100,100,0.9)';
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);
    ctx.fillStyle = '#ff6464';
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('⚠ SIEGE ACTIVE ⚠', x + w / 2, y + 18);
    const pct = Math.max(0, this.siegeWaveDuration / this.siegeWaveMax);
    ctx.fillStyle = 'rgba(255,100,100,0.4)';
    ctx.fillRect(x + 10, y + 25, (w - 20) * (1 - pct), 16);
    ctx.fillStyle = '#ffcccc';
    ctx.font = '11px monospace';
    ctx.fillText(Math.ceil(this.siegeWaveDuration) + 's', x + w / 2, y + 38);
  }

}

Game.USERNAME_KEY = 'deadzone_username_v1';
