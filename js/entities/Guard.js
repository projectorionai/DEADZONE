/* Outpost guards — every guard has a NAMED ASSIGNMENT and a CLASS.
 * Classes carry distinct loadouts, engagement styles and voices:
 *   assault  — balanced rifle, medium range
 *   shotgun  — close-quarters gate defence, devastating up close
 *   sniper   — long overwatch from towers, slow heavy shots
 *   heavy    — machine gun suppression, walls of lead
 *   elite    — rare command-rank, fast accurate and deadly
 * Behaviour: hold the assigned post, engage threats in range, pursue only a
 * short leash distance, then walk back to the post. No endless wandering.
 */

const GUARD_CLASSES = {
  assault: {
    id: 'assault', label: 'Assault', color: 0x2d5a1a, helmet: 0x5a6a6a,
    range: 620, fireRate: 0.16, damage: 22, bulletSpeed: 1900,
    sfx: 'rifle', leash: 170, moveSpeed: 95,
  },
  shotgun: {
    id: 'shotgun', label: 'Shotgun', color: 0x5a4a2a, helmet: 0x6a5a3a,
    range: 260, fireRate: 0.95, damage: 9, pellets: 6, spread: 0.16, bulletSpeed: 1300,
    sfx: 'shotgun', leash: 130, moveSpeed: 100,
  },
  sniper: {
    id: 'sniper', label: 'Sniper', color: 0x3a4a3a, helmet: 0x2a3a2a,
    range: 1150, fireRate: 1.7, damage: 95, bulletSpeed: 3000,
    sfx: 'sniper', leash: 0, moveSpeed: 0,      // never leaves the tower
  },
  heavy: {
    id: 'heavy', label: 'Heavy Gunner', color: 0x4a4a30, helmet: 0x5a5a3a,
    range: 700, fireRate: 0.07, damage: 11, spread: 0.09, bulletSpeed: 1500,
    sfx: 'heavy', leash: 90, moveSpeed: 70, big: true,
  },
  elite: {
    id: 'elite', label: 'Elite', color: 0x6a2a2a, helmet: 0x3a3a44,
    range: 820, fireRate: 0.11, damage: 32, bulletSpeed: 2200,
    sfx: 'rifle', leash: 220, moveSpeed: 120, big: false,
  },
};

class Guard extends Entity {
  constructor(x, y, post) {
    super(x, y, 16);
    // post: { x, y, name, cls } — the guard's permanent assignment
    this.post = post || { x, y, name: 'Guard Post', cls: 'assault' };
    this.assignment = this.post.name || 'Guard Post';
    this.cls = GUARD_CLASSES[this.post.cls] || GUARD_CLASSES.assault;
    this.role = 'defender';
    // Guards are effectively unkillable: massive HP + takeDamage kept minimal.
    this.hp = 100000;
    this.maxHp = 100000;
    this.fireTimer = Utils.rand(0, 0.4);
    this.state = 'post';       // post | combat | return
    this.target = null;
    this.postX = this.post.x != null ? this.post.x : x;
    this.postY = this.post.y != null ? this.post.y : y;
    this.scanBase = Utils.rand(0, Math.PI * 2);
    this.scanT = Math.random() * Math.PI * 2;
    this.scanArc = 0.8 + Math.random() * 0.35;
    this.scanSpeed = 0.5 + Math.random() * 0.4;
    this.facing = this.scanBase;
    this.dead = false;
    this.deathTimer = 0;
    this.deathFade = 2;
  }

  update(dt, player, game, zombies) {
    if (this.isTurret) { this.life -= dt; if (this.life <= 0) this.dead = true; }
    if (this.dead) { this.deathTimer += dt; return; }
    this.fireTimer = Math.max(0, this.fireTimer - dt);

    // Guard firepower scales with how hard the local district hits — Fort
    // Bastion's garrison shoots like it lives in District 5, because it does.
    if (this._dmgScale == null) {
      const d = game.scene.getDistrictTier ? game.scene.getDistrictTier(this.postX, this.postY) : 1;
      this._dmgScale = 1 + (d - 1) * 0.38;
    }

    const c = this.cls;
    const target = this._findTarget(zombies, game);
    const fromPost = Utils.dist(this.x, this.y, this.postX, this.postY);

    if (target) {
      this.state = 'combat';
      this.target = target;
      this.facing = Utils.angle(this.x, this.y, target.x, target.y);
      const d = Utils.dist(this.x, this.y, target.x, target.y);
      // pursue a short distance only — never abandon the post
      if (d > c.range * 0.85 && c.leash > 0 && fromPost < c.leash && c.moveSpeed > 0) {
        this.vx = Math.cos(this.facing) * c.moveSpeed;
        this.vy = Math.sin(this.facing) * c.moveSpeed;
        this.moveAndCollide(dt, game.scene.solids);
      } else {
        this.vx = this.vy = 0;
      }
      // Only pull the trigger with a clear line of fire — no shooting walls.
      if (d < c.range && this.fireTimer <= 0 &&
          !Collision.segBlocked(this.x, this.y, target.x, target.y, game.scene.solids)) {
        this._shoot(game, target);
        this.fireTimer = c.fireRate;
      }
    } else if (fromPost > 8) {
      // walk home
      this.state = 'return';
      const a = Utils.angle(this.x, this.y, this.postX, this.postY);
      this.facing = a;
      const sp = Math.max(60, c.moveSpeed || 80);
      this.vx = Math.cos(a) * sp;
      this.vy = Math.sin(a) * sp;
      this.moveAndCollide(dt, game.scene.solids);
      if (Utils.dist(this.x, this.y, this.postX, this.postY) < 8) { this.x = this.postX; this.y = this.postY; }
    } else {
      // at post: sentry scan
      this.state = 'post';
      this.target = null;
      this.vx = this.vy = 0;
      this.scanT += dt * this.scanSpeed;
      this.facing = this.scanBase + Math.sin(this.scanT) * this.scanArc;
      if (Math.sin(this.scanT) > 0.985) this.scanBase += (Math.random() - 0.5) * 0.5;
    }

    // HARD LEASH: whatever collision shoves did this frame, a guard can never
    // drift beyond its patrol radius — no more wandering ghosts in the streets.
    const maxRoam = Math.max(60, this.cls.leash + 60);
    const drift = Utils.dist(this.x, this.y, this.postX, this.postY);
    if (drift > maxRoam) {
      const a = Utils.angle(this.postX, this.postY, this.x, this.y);
      this.x = this.postX + Math.cos(a) * maxRoam;
      this.y = this.postY + Math.sin(a) * maxRoam;
    }
  }

  // Nearest LIVING zombie that threatens the post AND can actually be seen.
  _findTarget(zombies, game) {
    let nearest = null, minDist = this.cls.range + this.cls.leash;
    const solids = game && game.scene ? game.scene.solids : null;
    for (const z of zombies) {
      if (!z.alive) continue;
      const d = Utils.dist(this.postX, this.postY, z.x, z.y);   // threat measured from POST
      if (d >= minDist) continue;
      if (solids && Collision.segBlocked(this.x, this.y, z.x, z.y, solids)) continue;
      minDist = d; nearest = z;
    }
    return nearest;
  }

  _shoot(game, target) {
    const c = this.cls;
    const pellets = c.pellets || 1;
    const spread = c.spread || 0.03;
    const mx = this.x + Math.cos(this.facing) * (this.radius + 8);
    const my = this.y + Math.sin(this.facing) * (this.radius + 8);
    const dmg = Math.round(c.damage * (this._dmgScale || 1));
    for (let i = 0; i < pellets; i++) {
      const a = this.facing + Utils.rand(-spread, spread);
      game.entities.spawnBullet(new Bullet(mx, my, a, dmg, 'guard', false, c.bulletSpeed, c.range * 1.2));
    }
    // positional-ish audio: only audible near the player, quieter with distance
    if (game.audio && game.player) {
      const d = Utils.dist(this.x, this.y, game.player.x, game.player.y);
      if (d < 1000) game.audio.gunshot({ sfx: c.sfx, noise: 400 * (1 - d / 1100) });
    }
  }

  takeDamage(amount) {
    this.hp -= amount * 0.85;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; }
  }

  collect(list) {
    if (!this.dead) list.add(Iso.depth(this.x, this.y) + 1, (ctx) => this.render(ctx));
  }

  render(ctx) {
    if (this.dead) ctx.globalAlpha = Math.max(0, 1 - this.deathTimer / this.deathFade);
    ctx.fillStyle = '#4a8f2a';
    ctx.fillRect(this.x - 10, this.y - 12, 20, 24);
    ctx.fillStyle = '#2a5f0a';
    ctx.fillRect(this.x - 6, this.y - 8, 12, 8);
    ctx.globalAlpha = 1;
  }
}
