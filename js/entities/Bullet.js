/* Player projectile. Logic on the ground plane; rendered elevated (zBody) in iso.
 * Swept segment test avoids tunnelling. Centre hits count as headshots.
 */
class Bullet {
  constructor(x, y, angle, damage, owner, crit, speed, range) {
    this.x = x; this.y = y;
    this.px = x; this.py = y;
    this.zBody = 20;                 // render height off the ground
    this.angle = angle;
    this.speed = speed || CONFIG.combat.bulletSpeed;
    this.vx = Math.cos(angle) * this.speed;
    this.vy = Math.sin(angle) * this.speed;
    this.damage = damage;
    this.crit = crit;
    // Per-weapon effective range (shotguns die early, rifles carry far)
    this.life = range ? range / this.speed : CONFIG.combat.bulletLife;
    this.owner = owner;
    this.dead = false;
  }

  update(dt, zombies, solids) {
    this.px = this.x; this.py = this.y;
    this.x += this.vx * dt;
    this.y += this.vy * dt;
    this.life -= dt;
    if (this.life <= 0) { this.dead = true; return null; }

    for (const s of solids) {
      if (s.noBullet) continue;
      if (Collision.segRect(this.px, this.py, this.x, this.y, s.x, s.y, s.w, s.h)) { this.dead = true; return null; }
    }

    let best = null, bestT = Infinity, headshot = false;
    for (const z of zombies) {
      if (!z.alive) continue;
      const thead = Collision.raySegCircle(this.px, this.py, this.x, this.y, z.x, z.y, z.headRadius);
      if (thead >= 0 && thead < bestT) { bestT = thead; best = z; headshot = true; }
      const tbody = Collision.raySegCircle(this.px, this.py, this.x, this.y, z.x, z.y, z.radius);
      if (tbody >= 0 && tbody < bestT) { bestT = tbody; best = z; headshot = false; }
    }
    if (best) { this.dead = true; return { zombie: best, headshot }; }
    return null;
  }

  collect(list) {
    list.add(Iso.depth(this.x, this.y, this.zBody) + 1000, (ctx) => this.render(ctx));
  }
  render(ctx) {
    const a = Iso.toScreen(this.px, this.py, this.zBody);
    const b = Iso.toScreen(this.x, this.y, this.zBody);
    ctx.strokeStyle = '#ffd24a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    ctx.fillStyle = '#fff2b0';
    ctx.beginPath(); ctx.arc(b.x, b.y, 2.5, 0, Math.PI * 2); ctx.fill();
  }
}

/* Enemy ranged attack (Wraith bile). Hits the player on proximity. */
class EnemyProjectile {
  constructor(x, y, angle, speed, damage, range) {
    this.x = x; this.y = y; this.zBody = 24;
    this.vx = Math.cos(angle) * speed;
    this.vy = Math.sin(angle) * speed;
    this.damage = damage;
    this.dist = 0; this.maxDist = range;
    this.dead = false;
  }
  update(dt, player, solids) {
    const nx = this.x + this.vx * dt, ny = this.y + this.vy * dt;
    this.dist += Math.hypot(nx - this.x, ny - this.y);
    this.x = nx; this.y = ny;
    if (this.dist > this.maxDist) { this.dead = true; return false; }
    for (const s of solids) {
      if (Utils.pointRect(this.x, this.y, s.x, s.y, s.w, s.h)) { this.dead = true; return false; }
    }
    if (Utils.dist(this.x, this.y, player.x, player.y) < player.radius + 8) {
      this.dead = true; return true; // hit
    }
    return false;
  }
  collect(list) { list.add(Iso.depth(this.x, this.y, this.zBody) + 1000, (ctx) => this.render(ctx)); }
  render(ctx) {
    const p = Iso.toScreen(this.x, this.y, this.zBody);
    ctx.fillStyle = '#7ad46a';
    ctx.beginPath(); ctx.arc(p.x, p.y, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(120,220,110,0.35)';
    ctx.beginPath(); ctx.arc(p.x, p.y, 10, 0, Math.PI * 2); ctx.fill();
  }
}
