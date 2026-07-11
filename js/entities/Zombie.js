/* Enemy actor: zombie/enemy entity class.
 * Driven by ENEMIES[type] config (or a variantCfg for Rabid/Irradiated elites).
 * Behaviors: leap, explode (with fuse animation), ranged (blinding bile),
 * charge, scream (summons), slam (boss AoE), summon (boss spawner), aura (radiation DoT).
 * Elite & boss corpses persist and can be harvested with [E].
 */
class Zombie extends Entity {
  constructor(x, y, typeId, opts = {}) {
    const variant = opts.variant || null;
    const cfg = variant ? variantCfg(typeId, variant) : (ENEMIES[typeId] || ENEMIES.walker);
    super(x, y, cfg.radius);
    this.type = typeId;
    this.variant = variant;
    this.cfg = cfg;
    // District scaling: the streets around Ravenside are a gentle on-ramp;
    // Ground Zero hits 65% harder and soaks 65% more.
    const district = Math.max(1, Math.min(6, opts.tier || 2));
    this.district = district;
    const D = CONFIG.districts[district - 1] || {};
    this.hpMult = D.hpMult || 1;
    this.dmgMult = D.dmgMult || 1;
    this.districtSpeedMult = D.speedMult || 1;
    this.maxHp = Math.round(cfg.hp * this.hpMult);
    this.hp = this.maxHp;
    this.bodyH = cfg.bodyH;
    this.headRadius = Math.max(6, cfg.radius * 0.5);
    this.palette = cfg.palette;
    this.state = 'patrol';
    this.attackTimer = 0;
    this.rangedTimer = Utils.rand(0, 1.5);
    this.leapTimer = Utils.rand(0, 2);
    this.leaping = 0;
    this.leapVX = 0; this.leapVY = 0;
    this.patrolTimer = Utils.rand(0, CONFIG.zombie.patrolChangeInterval);
    this.patrolDir = Utils.rand(0, Math.PI * 2);
    this.hitFlash = 0;
    this.deathTimer = 0;
    this.dropped = false;
    this.wobble = Utils.rand(0, Math.PI * 2);
    // Ability timers
    this.chargeState = 0;      // 0 idle, >0 winding up, <0 charging (abs = time left)
    this.chargeTimer = Utils.rand(1, 3);
    this.screamTimer = Utils.rand(2, 5);
    this.slamTimer = Utils.rand(3, 6);
    this.summonTimer = Utils.rand(4, 8);
    // Bloat fuse: set on death, swells then detonates
    this.exploding = 0;
    this.exploded = false;
    // Spitter acid-cone state: >0 while winding up (telegraph)
    this.acidState = 0;
    this.acidDir = 0;
    this.acidTimer = Utils.rand(1, 3);
    // Boss phase tracking
    this.phaseIdx = 0;
    this.phaseSpeedMult = 1;
    this.phaseDmgMult = 1;
    // Elite/boss corpses can be harvested
    const b = cfg.behavior || {};
    this.lootable = !!(b.lootable || b.boss);
    this.harvested = false;
  }

  // Which loot table a harvested corpse rolls.
  get corpseTable() {
    const b = this.cfg.behavior || {};
    if (b.boss) return 'boss';
    if (this.variant === 'irradiated') return 'irradiated';
    return 'elite';
  }

  update(dt, player, game) {
    if (this.dead) {
      this.deathTimer += dt;
      this._updateExplosion(dt, player, game);
      return;
    }
    const solids = game.scene.moveSolids || game.scene.solids;
    const b = this.cfg.behavior || {};
    if (this.hitFlash > 0) this.hitFlash -= dt;
    this.wobble += dt * 6;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.rangedTimer > 0) this.rangedTimer -= dt;
    if (this.leapTimer > 0) this.leapTimer -= dt;
    if (this.chargeTimer > 0) this.chargeTimer -= dt;
    if (this.screamTimer > 0) this.screamTimer -= dt;
    if (this.slamTimer > 0) this.slamTimer -= dt;
    if (this.summonTimer > 0) this.summonTimer -= dt;

    // ON FIRE (flamethrower): burn ticks until it ends or they drop.
    if (this.burn > 0) {
      this.burn -= dt;
      this._burnTick = (this._burnTick || 0) + dt;
      if (Math.random() < dt * 6) game.entities.addSpark(this.x, this.y, Utils.pick(['#ff9a30', '#ffce50']), 1);
      if (this._burnTick >= 0.5) {
        this._burnTick = 0;
        const res = this.takeHit(6, false);
        game.onZombieHit(this, res, this.x, this.y, false, 'player');
        if (this.dead) return;
      }
    }

    const d = Utils.dist(this.x, this.y, player.x, player.y);
    const stealth = player.stealth || 1;
    const detectMult = player.detectMult || 1;
    const detect = this.cfg.detect * stealth * (1 / detectMult);

    // --- Radiation / plague aura: standing near it burns ---
    if (b.aura && d < b.aura.radius && !player.dead && !player.isInvuln()) {
      player.takeAuraDamage(b.aura.dps * dt, this, game);
    }

    // --- Boss phases: crossing an HP threshold changes the fight ---
    if (b.boss && b.phases && this.phaseIdx < b.phases.length) {
      const ph = b.phases[this.phaseIdx];
      if (this.hp / this.maxHp <= ph.at) {
        this.phaseIdx++;
        if (ph.speedMult) this.phaseSpeedMult *= ph.speedMult;
        if (ph.dmgMult) this.phaseDmgMult *= ph.dmgMult;
        if (ph.unlock) Object.assign(this.cfg.behavior, ph.unlock);
        if (ph.msg && game.ui) game.ui.toast('⚠ ' + ph.msg);
        if (game.audio) game.audio.bossWarning();
        game.entities.addSpark(this.x, this.y, '#ff6040', 20);
        this.hitFlash = 0.4;
      }
    }

    // --- Active acid spray windup (telegraph) freezes the spitter ---
    if (this.acidState > 0) {
      this._updateAcid(dt, player, game, b);
      return;
    }
    if (this.acidTimer > 0) this.acidTimer -= dt;

    // --- Active charge overrides everything ---
    if (this.chargeState !== 0) {
      this._updateCharge(dt, player, game, solids, b);
      return;
    }

    // --- Active leap overrides steering ---
    if (this.leaping > 0) {
      this.leaping -= dt;
      this.vx = this.leapVX; this.vy = this.leapVY;
      this.moveAndCollide(dt, solids);
      this._clamp();
      if (d <= this.cfg.attackRange && this.attackTimer <= 0) this._melee(player, b, game);
      return;
    }

    // --- State transitions ---
    // SIGHT needs an unbroken line of sight — no aggro through walls.
    // (HEARING is separate: loud gunfire calls game.alertZombies, which flips
    // patrol->chase regardless of walls. That is the ONLY wallhack they get.)
    if (this.state === 'patrol' && d < detect &&
        !Collision.segBlocked(this.x, this.y, player.x, player.y, game.scene.solids)) {
      this.state = 'chase';
      if (game?.audio?.zombie) game.audio.zombie('aggro', this.cfg, game._zVol ? game._zVol(this) : 0.6);
    } else if (this.state === 'chase' && d > this.cfg.lose) {
      this.state = 'patrol';
    } else if (this.state === 'chase' && d > this.cfg.lose * 0.55 &&
        Collision.segBlocked(this.x, this.y, player.x, player.y, game.scene.solids)) {
      // lost sight behind cover at range: linger a moment, then give up
      this._lostSight = (this._lostSight || 0) + dt;
      if (this._lostSight > 4) { this.state = 'patrol'; this._lostSight = 0; }
    } else {
      this._lostSight = 0;
    }

    let speed = 0, ang = this.facing;
    if (this.state === 'patrol') {
      this.patrolTimer -= dt;
      if (this.patrolTimer <= 0) { this.patrolTimer = CONFIG.zombie.patrolChangeInterval; this.patrolDir += Utils.rand(-1, 1); }
      speed = this.cfg.walk; ang = this.patrolDir;
    } else {
      // chase / attack
      ang = Utils.angle(this.x, this.y, player.x, player.y);
      const hasLOS = !Collision.segBlocked(this.x, this.y, player.x, player.y, game.scene.solids);

      // --- Screamer: wail to summon the horde ---
      if (b.scream && this.screamTimer <= 0 && d < b.scream.radius * 0.6 && hasLOS) {
        this._scream(player, game, b.scream);
      }
      // --- Boss slam: ground pound AoE when player is close ---
      if (b.slam && this.slamTimer <= 0 && d < b.slam.radius * 0.9) {
        this._slam(player, game, b.slam);
      }
      // --- Boss summon: spill lesser infected ---
      if (b.summon && this.summonTimer <= 0 && d < 700) {
        this._summon(game, b.summon);
      }

      // Acid sprayer: start the telegraphed cone windup at range
      if (b.acid && d < b.acid.range * 0.92 && d > this.cfg.attackRange && this.acidTimer <= 0 && hasLOS) {
        this.acidState = b.acid.windup;
        this.acidDir = ang;
        if (game.audio) game.audio.acidWindup();
      }
      // Ranged attacker: kite and spit
      if (b.ranged && d < this.cfg.attackRange && hasLOS) {
        speed = d < b.ranged.range * 0.45 ? -this.cfg.chase * 0.6 : 0;
        if (this.rangedTimer <= 0) {
          this.rangedTimer = this.cfg.attackCd;
          const proj = new EnemyProjectile(this.x, this.y, ang, b.ranged.speed, Math.round(b.ranged.damage * this.dmgMult), b.ranged.range);
          proj.blinds = !!b.ranged.blinds;
          game.entities.spawnEnemyProjectile(proj);
          if (game.audio) game.audio.spit();
        }
      } else if (b.charge && d < b.charge.range && d > this.cfg.attackRange + 20 && this.chargeTimer <= 0 && hasLOS) {
        // Charger: telegraphed windup, then a straight-line bulldoze
        this.chargeState = b.charge.windup;
        this.chargeDir = ang;
        if (game.audio) game.audio.zombie('aggro', this.cfg, 1);
      } else if (b.leap && d < b.leap.range && d > this.cfg.attackRange && this.leapTimer <= 0 && hasLOS) {
        // Leaper/Reaper pounce
        this.leaping = 0.32; this.leapTimer = b.leap.cd;
        this.leapVX = Math.cos(ang) * b.leap.speed;
        this.leapVY = Math.sin(ang) * b.leap.speed;
        game.entities.addSpark(this.x, this.y, '#d0d0d0', 4);
        if (game.audio) game.audio.leap();
      } else if (d <= this.cfg.attackRange) {
        speed = this.cfg.chase * 0.25;
        if (this.attackTimer <= 0) this._melee(player, b, game);
      } else {
        speed = this.cfg.chase;
      }
    }

    // Steer around obstacles
    if (speed > 0) ang = this._avoid(ang, solids);
    this.facing = ang;
    const wob = Math.sin(this.wobble) * 0.12;
    const phase = (this.phaseSpeedMult || 1) * (this.districtSpeedMult || 1);
    this.vx = Math.cos(ang + wob) * speed * phase;
    this.vy = Math.sin(ang + wob) * speed * phase;
    this.moveAndCollide(dt, solids);
    this._clamp();
  }

  // Spitter cone spray: frozen mid-telegraph, tracking slowly, then the hose.
  // The player has the whole windup to strafe out of the cone.
  _updateAcid(dt, player, game, b) {
    const a = b.acid;
    this.vx = this.vy = 0;
    // slow tracking during windup — dodging sideways beats it
    const want = Utils.angle(this.x, this.y, player.x, player.y);
    let diff = ((want - this.acidDir + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    this.acidDir += Utils.clamp(diff, -0.7 * dt, 0.7 * dt);
    this.facing = this.acidDir;
    this.acidState -= dt;
    if (this.acidState > 0) return;

    // SPRAY
    this.acidTimer = a.cd;
    if (game.audio) game.audio.acidSpray();
    game.entities.addSpark(this.x, this.y, '#8fdf5a', 10);
    const d = Utils.dist(this.x, this.y, player.x, player.y);
    const angTo = Utils.angle(this.x, this.y, player.x, player.y);
    let hitDiff = ((angTo - this.acidDir + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (d < a.range && Math.abs(hitDiff) < a.arc / 2 &&
        !Collision.segBlocked(this.x, this.y, player.x, player.y, game.scene.solids)) {
      if (!player.isInvuln()) {
        player.takeDamage(Math.round(a.damage * this.dmgMult * (this.phaseDmgMult || 1)), this, 40);
        if (player.applyBlur) player.applyBlur(game);
        if (player.applyAcid) player.applyAcid(game, 3);
      }
    }
    // lingering pools along the cone
    for (let i = 0; i < (a.pools || 3); i++) {
      const t = (i + 1) / ((a.pools || 3) + 0.5);
      const spread = Utils.rand(-a.arc / 3, a.arc / 3);
      const px = this.x + Math.cos(this.acidDir + spread) * a.range * t;
      const py = this.y + Math.sin(this.acidDir + spread) * a.range * t;
      if (game.entities.addAcidPool) game.entities.addAcidPool(px, py, a.poolR || 34, a.poolTtl || 6);
    }
  }

  // Charger windup (frozen, telegraph) then dash. Hitting the player mid-dash
  // deals heavy damage + knockback and can break bones.
  _updateCharge(dt, player, game, solids, b) {
    const c = b.charge;
    if (this.chargeState > 0) {
      // winding up — paw the ground
      this.chargeState -= dt;
      this.vx = this.vy = 0;
      this.facing = Utils.angle(this.x, this.y, player.x, player.y);
      this.chargeDir = this.facing;
      if (this.chargeState <= 0) {
        this.chargeState = -c.dur;   // begin the dash
        if (game.audio) game.audio.charge();
      }
      return;
    }
    // dashing
    this.chargeState += dt;
    const px = this.x, py = this.y;
    this.vx = Math.cos(this.chargeDir) * c.speed;
    this.vy = Math.sin(this.chargeDir) * c.speed;
    this.moveAndCollide(dt, solids);
    this._clamp();
    // wall impact stops the charge dead
    if (Math.hypot(this.x - px, this.y - py) < c.speed * dt * 0.35) {
      this.chargeState = 0;
      this.chargeTimer = c.cd;
      game.entities.addSpark(this.x, this.y, '#b0a890', 8);
      return;
    }
    // trample the player
    if (!player.isInvuln() && Utils.dist(this.x, this.y, player.x, player.y) < this.radius + player.radius + 4) {
      player.takeDamage(Math.round(c.damage * this.dmgMult), this, c.knockback, { boneBreaker: true });
      this.chargeState = 0;
      this.chargeTimer = c.cd;
    }
    if (this.chargeState >= 0) { this.chargeState = 0; this.chargeTimer = c.cd; }
  }

  _scream(player, game, s) {
    this.screamTimer = s.cd;
    if (game.audio) game.audio.scream();
    game.entities.addText(this.x, this.y - 30, '!!!', '#ffb0c0');
    game.entities.addSpark(this.x, this.y, '#e0b0d0', 14);
    // wake everything in earshot
    if (game.alertZombies) game.alertZombies(this.x, this.y, s.radius);
    // and call fresh walkers out of the buildings
    for (let i = 0; i < (s.summon || 3); i++) {
      const a = Utils.rand(0, Math.PI * 2), r = Utils.rand(180, 320);
      const p = { x: this.x + Math.cos(a) * r, y: this.y + Math.sin(a) * r };
      if (game.scene.inSafeZone && game.scene.inSafeZone(p.x, p.y, 120)) continue;
      const z = game.entities.spawnZombieAt(p.x, p.y, s.summonType || 'walker');
      if (z) z.state = 'chase';
    }
  }

  _slam(player, game, s) {
    this.slamTimer = s.cd;
    if (game.audio) game.audio.slam();
    game.entities.addSpark(this.x, this.y, '#c9b690', 22);
    game.entities.addText(this.x, this.y - 40, 'SLAM!', '#ffcf4a');
    if (game.r3d && game.r3d.addShockwave) game.r3d.addShockwave(this.x, this.y, s.radius);
    const d = Utils.dist(this.x, this.y, player.x, player.y);
    if (d < s.radius && !player.isInvuln()) {
      player.takeDamage(Math.round(s.damage * this.dmgMult), this, s.knockback || 200, { boneBreaker: true });
    }
  }

  _summon(game, s) {
    this.summonTimer = s.cd;
    if (game.audio) game.audio.scream();
    game.entities.addText(this.x, this.y - 34, 'SPAWNING', '#e0a0c0');
    for (let i = 0; i < (s.count || 3); i++) {
      const a = Utils.rand(0, Math.PI * 2), r = this.radius + Utils.rand(20, 60);
      const z = game.entities.spawnZombieAt(this.x + Math.cos(a) * r, this.y + Math.sin(a) * r, s.type || 'crawler');
      if (z) z.state = 'chase';
    }
  }

  _avoid(ang, solids) {
    const probe = this.radius + 58;
    const clear = (a) => !Collision.segBlocked(
      this.x, this.y, this.x + Math.cos(a) * probe, this.y + Math.sin(a) * probe, solids);

    if (this._avoidDir) {
      if (clear(ang)) {
        this._avoidClearFrames = (this._avoidClearFrames || 0) + 1;
        if (this._avoidClearFrames > 8) { this._avoidDir = 0; return ang; }
      } else {
        this._avoidClearFrames = 0;
      }
      if (clear(ang + this._avoidDir)) return ang + this._avoidDir;
      const s = Math.sign(this._avoidDir);
      for (const off of [1.2 * s, 1.7 * s, -1.2 * s, -1.7 * s]) {
        if (clear(ang + off)) { this._avoidDir = off; return ang + off; }
      }
      this._avoidDir = 0;
    }

    if (clear(ang)) return ang;
    const first = Math.random() < 0.5 ? 1 : -1;
    for (const off of [0.6 * first, -0.6 * first, 1.2 * first, -1.2 * first, 1.7 * first, -1.7 * first]) {
      if (clear(ang + off)) { this._avoidDir = off; this._avoidClearFrames = 0; return ang + off; }
    }
    return ang + Math.PI / 2 * first;
  }

  _melee(player, b, game) {
    if (player.isInvuln()) return;
    if (game?.audio?.zombie) game.audio.zombie('hit', this.cfg, 0.8);
    player.takeDamage(Math.round(this.cfg.damage * this.dmgMult * (this.phaseDmgMult || 1)), this,
      b.knockback || CONFIG.zombie.contactPush, { boneBreaker: !!b.boneBreaker });
    // Wraith flurry: each strike also shreds armour condition
    if (b.flurry && player.armor && player.armor.chest && player.armor.chest.takeDamage) {
      player.armor.chest.takeDamage(6);
    }
    this.attackTimer = this.cfg.attackCd;
  }

  _clamp() {
    const w = this._boundsW || CONFIG.world.width, h = this._boundsH || CONFIG.world.height;
    this.x = Utils.clamp(this.x, this.radius, w - this.radius);
    this.y = Utils.clamp(this.y, this.radius, h - this.radius);
  }

  takeHit(damage, headshot) {
    const dmg = headshot ? damage * this.cfg.headMult : damage;
    this.hitFlash = CONFIG.combat.hitFlash;
    if (this.state === 'patrol') this.state = 'chase';
    const killed = this.damage(dmg);
    if (killed) this._onDeath();
    return { killed, dmg: Math.round(dmg), headshot };
  }

  // On death: bloats light their fuse (swell -> detonate). Handled in update().
  _onDeath() {
    const b = this.cfg.behavior || {};
    if (b.explode && !this.exploded) {
      this.exploding = b.explode.fuse || 0.9;
    }
  }

  // Swell-and-burst animation + damage, runs while dead.
  _updateExplosion(dt, player, game) {
    if (this.exploding <= 0 || this.exploded) return;
    this.exploding -= dt;
    // hissing swell sparks
    if (Math.random() < 0.35) game.entities.addSpark(this.x, this.y, '#9adf7a', 2);
    if (this.exploding <= 0) {
      this.exploded = true;
      const ex = this.cfg.behavior.explode;
      if (game.audio) game.audio.explosion();
      game.entities.addSpark(this.x, this.y, '#7ad46a', 26);
      game.entities.addSpark(this.x, this.y, '#b8e890', 16);
      if (game.r3d && game.r3d.addShockwave) game.r3d.addShockwave(this.x, this.y, ex.radius);
      if (Utils.dist(this.x, this.y, player.x, player.y) < ex.radius && !player.isInvuln()) {
        player.takeDamage(Math.round(ex.damage * this.dmgMult), this, 90);
        game.entities.addText(player.x, player.y - 30, `-${Math.round(ex.damage * this.dmgMult)}`, '#7ad46a');
      }
      // gas cloud damages nearby zombies too — chain reactions
      for (const z of game.entities.zombies) {
        if (z === this || !z.alive) continue;
        if (Utils.dist(this.x, this.y, z.x, z.y) < ex.radius * 0.8) z.takeHit(ex.damage * 0.6, false);
      }
    }
  }

  collect(list) {
    const depthBias = this.dead ? -500 : 0;
    list.add(Iso.depth(this.x, this.y) + depthBias, (ctx) => this.render(ctx));
  }

  render(ctx) {
    if (this.dead) {
      const a = Utils.clamp(1 - this.deathTimer / 6, 0, 1);
      const p = Iso.toScreen(this.x, this.y, 0);
      ctx.globalAlpha = a;
      ctx.fillStyle = 'rgba(70,20,20,0.6)';
      ctx.beginPath(); ctx.ellipse(p.x, p.y, this.radius * Iso.IX * 3, this.radius * Iso.IY * 3, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = Iso.shade(this.palette.dark, 0.8);
      ctx.beginPath(); ctx.ellipse(p.x, p.y, this.radius * Iso.IX * 1.8, this.radius * Iso.IY * 1.8, 0, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
      return;
    }

    const bob = this.state === 'patrol' ? Math.sin(this.wobble) * 2 : 0;
    Iso.shadow(ctx, this.x, this.y, this.radius * 0.045 + 0.5, 0);
    Iso.actor(ctx, this.x, this.y, {
      radius: this.radius, bodyH: this.bodyH + bob,
      body: this.palette.body, light: this.palette.light, dark: this.palette.dark,
      head: this.palette.head, flash: this.hitFlash > 0,
      facing: this.facing, arm: this.leaping > 0 ? '#e0e0e0' : null, armLen: 20,
    });

    if (this.cfg.behavior && this.cfg.behavior.boss) {
      const namePos = Iso.toScreen(this.x, this.y, this.bodyH + 40);
      ctx.fillStyle = '#e05a5a';
      ctx.font = 'bold 16px "Segoe UI"';
      ctx.textAlign = 'center';
      ctx.fillText('⚠ ' + this.cfg.name.toUpperCase() + ' ⚠', namePos.x, namePos.y);
      ctx.textAlign = 'left';

      const barPos = Iso.toScreen(this.x, this.y, this.bodyH + 22);
      const barW = 100, barH = 10;
      const healthRatio = Math.max(0, this.hp / this.maxHp);
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(barPos.x - barW / 2 - 2, barPos.y - barH / 2 - 2, barW + 4, barH + 4);
      const barColor = healthRatio > 0.5 ? '#00ff00' : healthRatio > 0.25 ? '#ffaa00' : '#ff0000';
      ctx.fillStyle = barColor;
      ctx.fillRect(barPos.x - barW / 2, barPos.y - barH / 2, barW * healthRatio, barH);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(barPos.x - barW / 2 - 1, barPos.y - barH / 2 - 1, barW + 2, barH + 2);
    } else if (this.hp < this.maxHp) {
      const p = Iso.toScreen(this.x, this.y, this.bodyH + 22);
      const w = Math.max(26, this.radius * 1.6);
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(p.x - w / 2 - 1, p.y - 1, w + 2, 5);
      ctx.fillStyle = '#c04040';
      ctx.fillRect(p.x - w / 2, p.y, w * (this.hp / this.maxHp), 3);
    }
  }
}
