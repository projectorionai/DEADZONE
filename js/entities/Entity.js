/* Base entity: circular body with position, velocity, health. */
class Entity {
  constructor(x, y, radius) {
    this.id = Utils.uid();
    this.x = x; this.y = y;
    this.vx = 0; this.vy = 0;
    this.radius = radius;
    this.hp = 1; this.maxHp = 1;
    this.dead = false;
    this.facing = 0; // radians
  }
  get alive() { return !this.dead && this.hp > 0; }

  damage(amount) {
    this.hp -= amount;
    if (this.hp <= 0) { this.hp = 0; this.dead = true; return true; }
    return false;
  }

  // Move with collision against world solids. Swept in sub-steps so fast
  // movers (leaps, charges, knockbacks, low-FPS frames) can never tunnel
  // through a wall thinner than one frame's displacement.
  moveAndCollide(dt, solids) {
    const dx = this.vx * dt, dy = this.vy * dt;
    const dist = Math.hypot(dx, dy);
    const maxStep = Math.max(6, this.radius * 0.75);
    const steps = Math.max(1, Math.ceil(dist / maxStep));
    for (let i = 0; i < steps; i++) {
      this.x += dx / steps;
      this.y += dy / steps;
      Collision.resolveCircle(this, this.radius, solids);
    }
  }
}
