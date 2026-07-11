class Companion extends Entity {
  constructor(x, y, ownerPlayer) {
    super(x, y, 14);
    this.owner = ownerPlayer;
    this.name = 'Lucy';
    this.type = 'husky';
    this.hp = 9999;
    this.maxHp = 9999;

    this.xp = 0;
    this.level = 1;
    this.tier = 1;

    this.speed = 200;        // faster than the player so she keeps heel
    this.damage = 16;
    this.attackRange = 42;
    this.attackCd = 0.55;
    this.attackTimer = 0;
    this.detectionRange = 200;
    this.leashRange = 150;   // breaks off a fight if you move away

    this.state = 'follow';
    this.target = null;
    this.facing = 0;
    this.wobble = 0;
    this.attackFlash = 0;
  }

  update(dt, player, game) {
    this.owner = player;
    if (this.attackTimer > 0) this.attackTimer -= dt;
    if (this.attackFlash > 0) this.attackFlash -= dt;
    this.wobble += dt * 5;

    const distToPlayer = Utils.dist(this.x, this.y, player.x, player.y);
    const solids = game.scene.solids;

    // If she gets stranded (stuck on geometry, left behind on a scene change), warp back.
    if (distToPlayer > 300) {
      this.x = player.x - Math.cos(player.facing || 0) * 40 + Utils.rand(-20, 20);
      this.y = player.y - Math.sin(player.facing || 0) * 40 + Utils.rand(-20, 20);
      this.vx = 0; this.vy = 0;
      this.state = 'follow'; this.target = null;
      return;
    }

    if (this.state === 'follow') {
      if (distToPlayer > 44) {   // heel at ~1 m
        const ang = Utils.angle(this.x, this.y, player.x, player.y);
        const sp = Math.min(this.speed, Utils.dist(this.x, this.y, player.x, player.y) * 2);
        this.vx = Math.cos(ang) * sp;
        this.vy = Math.sin(ang) * sp;
        this.facing = ang;
      } else {
        this.vx = 0;
        this.vy = 0;
      }

      let nearestZombie = null;
      let nearestDist = this.detectionRange;
      for (const z of game.entities.zombies) {
        if (!z.alive) continue;
        const d = Utils.dist(this.x, this.y, z.x, z.y);
        if (d < nearestDist) {
          nearestDist = d;
          nearestZombie = z;
        }
      }

      if (nearestZombie) {
        this.state = 'chase';
        this.target = nearestZombie;
      }
    } else if (this.state === 'chase') {
      if (!this.target || !this.target.alive || distToPlayer > this.leashRange) {
        this.state = 'follow';   // don't stray far from the player
        this.target = null;
      } else {
        const d = Utils.dist(this.x, this.y, this.target.x, this.target.y);
        const ang = Utils.angle(this.x, this.y, this.target.x, this.target.y);

        if (d > this.attackRange) {
          this.vx = Math.cos(ang) * this.speed;
          this.vy = Math.sin(ang) * this.speed;
          this.facing = ang;
        } else {
          this.vx = 0;
          this.vy = 0;
          if (this.attackTimer <= 0) {
            this.target.takeHit(this.damage, false);
            this.attackTimer = this.attackCd;
            this.attackFlash = 0.15;
            game.onZombieHit(this.target, { killed: this.target.dead, dmg: Math.round(this.damage), headshot: false }, this.x, this.y);
          }
        }
      }
    }

    this.moveAndCollide(dt, solids);
    this._clamp();
  }

  _clamp() {
    const w = this.owner._boundsW || CONFIG.world.width, h = this.owner._boundsH || CONFIG.world.height;
    this.x = Utils.clamp(this.x, this.radius, w - this.radius);
    this.y = Utils.clamp(this.y, this.radius, h - this.radius);
  }

  addXP(amount) {
    this.xp += amount;
    const xpPerLevel = 50 + this.level * 20;
    while (this.xp >= xpPerLevel) {
      this.xp -= xpPerLevel;
      this.level++;
      this._applyTierUpgrade();
    }
  }

  _applyTierUpgrade() {
    if (this.level === 5) this._upgradeTier(2);
    else if (this.level === 10) this._upgradeTier(3);
    else if (this.level === 15) this._upgradeTier(4);
    else if (this.level === 20) this._upgradeTier(5);
  }

  _upgradeTier(newTier) {
    this.tier = newTier;
    const upgrades = {
      2: { speed: 160, damage: 14 },
      3: { speed: 180, damage: 16, bleed: true },
      4: { speed: 200, damage: 18, packHowl: true },
      5: { speed: 220, damage: 20, elite: true },
    };
    const upg = upgrades[newTier];
    if (upg) {
      this.speed = upg.speed;
      this.damage = upg.damage;
      if (upg.bleed) this.hasBleed = true;
      if (upg.packHowl) this.hasPackHowl = true;
      if (upg.elite) this.isElite = true;
    }
  }

  collect(list) {
    const depthBias = 5;
    list.add(Iso.depth(this.x, this.y) + depthBias, (ctx) => this.render(ctx));
  }

  render(ctx) {
    const bob = Math.sin(this.wobble) * 1.5;
    Iso.shadow(ctx, this.x, this.y, this.radius * 0.04 + 0.4, 0);
    Iso.actor(ctx, this.x, this.y, {
      radius: this.radius, bodyH: 32 + bob,
      body: '#8a7a6a', light: '#b0a080', dark: '#5a4a3a',
      head: '#7a6a5a', flash: this.attackFlash > 0,
      facing: this.facing, arm: null, armLen: 16,
    });

    const screenPos = Iso.toScreen(this.x, this.y, 32);
    ctx.fillStyle = '#8a7a6a';
    ctx.font = 'bold 10px "Segoe UI"';
    ctx.textAlign = 'center';
    ctx.fillText(this.name, screenPos.x, screenPos.y - 30);
    ctx.textAlign = 'left';
  }
}
