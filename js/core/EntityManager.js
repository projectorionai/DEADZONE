/* Zombies, bullets, enemy projectiles, and combat FX for a scene. */
class EntityManager {
  constructor(scene) {
    this.scene = scene;
    this.zombies = [];
    this.bullets = [];
    this.projectiles = [];
    this.particles = [];
    this.acidPools = [];
    this.spawnTimer = CONFIG.spawn.spawnInterval;
    this.spawnEnabled = true;
  }

  // Lingering acid: anyone standing in it burns (armor corrodes too).
  addAcidPool(x, y, r, ttl) {
    this.acidPools.push({ x, y, r, ttl, max: ttl });
  }

  // Ordnance AoE — concussion punches THROUGH walls (the one damage that does).
  // Distance falloff 100% -> 35% at the rim; the shooter eats half if too close.
  _explode(game, x, y, ex, owner, player) {
    if (game.audio) game.audio.explosion();
    if (game.r3d) {
      if (game.r3d.addShockwave) game.r3d.addShockwave(x, y, ex.radius);
      if (game.r3d.addShake) game.r3d.addShake(4);
      if (game.r3d.addBlood) game.r3d.addBlood(x, y, 1.4);
    }
    this.addSpark(x, y, '#ffb050', 26);
    this.addSpark(x, y, '#7a7068', 14);
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const d = Utils.dist(x, y, z.x, z.y);
      if (d > ex.radius + z.radius) continue;
      const fall = 1 - 0.65 * Math.min(1, d / ex.radius);
      const res = z.takeHit(ex.damage * fall, false);
      game.onZombieHit(z, res, z.x, z.y, false, owner);
    }
    if (player && !player.dead && !player.invincible) {
      const dp = Utils.dist(x, y, player.x, player.y);
      if (dp < ex.radius * 0.8) {
        player.invulnTimer = 0;
        player.takeDamage(ex.damage * 0.5 * (1 - dp / ex.radius), null, 120);
        game.entities.addText(player.x, player.y - 30, 'CAUGHT IN THE BLAST', '#ffb050');
      }
    }
  }

  spawnBullet(b) { this.bullets.push(b); }
  spawnEnemyProjectile(p) { this.projectiles.push(p); }

  // Spawn one zombie. Rolls elite variants unless a variant is forced.
  // Tier scales hp/damage so Ravenside stays survivable and the core is hell.
  spawnZombieAt(x, y, typeId, opts = {}) {
    const tier = opts.tier != null ? opts.tier :
      (this.scene.getDistrictTier ? this.scene.getDistrictTier(x, y) : 2);
    const type = typeId || rollEnemyType(Math.max(1, tier));
    const isBoss = ENEMIES[type] && ENEMIES[type].behavior && ENEMIES[type].behavior.boss;
    const variant = opts.variant !== undefined ? opts.variant : (isBoss ? null : rollVariant(tier));
    const z = new Zombie(x, y, type, { variant, tier });
    this.zombies.push(z);
    return z;
  }

  addText(x, y, text, color) {
    this.particles.push({
      x, y, wx: x, wy: y, wz: 28,
      vx: Utils.rand(-10, 10), vy: -40, life: 0.8, max: 0.8, text, color, size: 14,
    });
  }

  addLootText(x, y, itemName, rarity = 'common') {
    const rarityInfo = RARITY[rarity] || RARITY.common;
    const text = `+ ${itemName}`;
    const size = rarity === 'legendary' ? 18 : rarity === 'epic' ? 16 : 14;
    this.particles.push({
      x, y, wx: x, wy: y, wz: 28,
      vx: Utils.rand(-15, 15), vy: -50, life: 1.2, max: 1.2, text, color: rarityInfo.color, size,
    });
  }

  addLootBeam(x, y, rarity = 'common') {
    if (rarity !== 'rare' && rarity !== 'epic' && rarity !== 'legendary') return;
    this.particles.push({
      x, y, wx: x, wy: y, wz: 0,
      vx: 0, vy: 0, life: 0.4, max: 0.4,
      beam: true, beamColor: RARITY[rarity].color, beamHeight: 200,
    });
  }

  addSpark(x, y, color, count = 6) {
    for (let i = 0; i < count; i++) {
      const a = Utils.rand(0, Math.PI * 2), sp = Utils.rand(40, 160);
      this.particles.push({
        x, y, wx: x, wy: y, wz: 12,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        life: 0.35, max: 0.35, color, size: Utils.rand(2, 4),
      });
    }
  }

  liveZombieCount() {
    let n = 0;
    for (const z of this.zombies) if (z.alive) n++;
    return n;
  }

  liveBossCount() {
    let n = 0;
    for (const z of this.zombies) if (z.alive && z.cfg.behavior && z.cfg.behavior.boss) n++;
    return n;
  }

  update(dt, player, game) {
    const solids = game.scene.solids;

    if (this.spawnEnabled) {
      this.spawnTimer -= dt;
      const night = !!(game && game.isNight && game.isNight());
      const pTier = this.scene.getDistrictTier ? this.scene.getDistrictTier(player.x, player.y) : 1;
      const pDist = CONFIG.districts[Math.min(5, Math.max(0, pTier - 1))];
      let cap = CONFIG.spawn.maxZombies + (night ? 10 : 0) + (pDist.capBonus || 0);

      // --- System 1: Threat escalation scales spawn cadence ---
      const threat = game ? (game.districtThreat || 0) : 0;
      let intervalMult = pDist.intervalMult || 1;
      let batchExtra = 0;
      if (threat > 50) {
        intervalMult *= 0.55;
        batchExtra = Math.floor((threat - 50) / 10);
        cap += Math.floor((threat - 50) / 4);
      } else if (threat > 25) {
        intervalMult *= 0.75;
      }

      if (this.spawnTimer <= 0 && this.liveZombieCount() < cap) {
        this.spawnTimer = CONFIG.spawn.spawnInterval * (night ? 0.6 : 1) * intervalMult;
        const pick = this.scene.zombieSpawnPoint || this.scene.randomStreetPoint;
        const p = pick.call(this.scene, player.x, player.y, CONFIG.spawn.minSpawnDistFromPlayer);
        const tier = this.scene.getDistrictTier ? this.scene.getDistrictTier(p.x, p.y) : 1;
        const sDist = CONFIG.districts[Math.min(5, Math.max(0, tier - 1))];
        let type = null;
        if (tier >= CONFIG.spawn.bossDistrictMin && this.liveBossCount() < CONFIG.spawn.maxBoss &&
            Utils.chance(sDist.bossChance || 0)) {
          type = rollBossType(tier);
          if (type && game) {
            game.ui.toast(`⚠ ${ENEMIES[type].name} stalks ${sDist.name}...`);
            if (game.audio) game.audio.bossWarning();
          }
        }
        const batchSize = (sDist.batch || 1) + batchExtra;
        for (let i = 0; i < batchSize; i++) {
          let forceType = null;
          if (threat > 50 && Utils.chance(0.4)) {
            const fastPool = ['runner', 'stalker'].filter(t => ENEMIES[t].tier <= Math.max(tier, 2));
            if (fastPool.length) forceType = Utils.pick(fastPool);
          }
          const spawnP = i === 0 ? p : pick.call(this.scene, player.x, player.y, CONFIG.spawn.minSpawnDistFromPlayer);
          const z = this.spawnZombieAt(spawnP.x, spawnP.y, forceType || type || rollEnemyType(tier, night));
          if (forceType && z) z.state = 'chase';
          type = null;   // only the first of a batch can be the boss
        }
      }
    }

    for (const z of this.zombies) {
      z._boundsW = game.scene.w;
      z._boundsH = game.scene.h;
      z.update(dt, player, game);
    }
    this._separateZombies();
    this._separateFromPlayer(player);
    // Corpses linger; elite/boss corpses stay harvestable for a good while.
    const linger = CONFIG.loot.corpseLinger || 25;
    this.zombies = this.zombies.filter(z =>
      !(z.dead && z.deathTimer > (z.lootable && !z.harvested ? linger : 6)));

    if (player.companion) {
      player.companion._boundsW = game.scene.w;
      player.companion._boundsH = game.scene.h;
      player.companion.update(dt, player, game);
    }

    if (game.scene.guards) {
      for (const g of game.scene.guards) {
        g.update(dt, player, game, this.zombies);
      }
      game.scene.guards = game.scene.guards.filter(g => !(g.dead && g.deathTimer > 3));
    }

    for (const b of this.bullets) {
      const hit = b.update(dt, this.zombies, solids);
      if (hit) {
        // Executioner skill: player headshots hit harder
        const boost = (hit.headshot && b.owner === 'player') ? 1 + (player.headshotBonus || 0) : 1;
        const res = hit.zombie.takeHit(b.damage * boost, hit.headshot);
        game.onZombieHit(hit.zombie, res, b.x, b.y, b.crit, b.owner);
      }
      // Grenades/rockets detonate wherever they die — wall, flesh or range end.
      if (b.dead && b.explosive && !b.boomed) {
        b.boomed = true;
        this._explode(game, b.x, b.y, b.explosive, b.owner, player);
      }
    }
    this.bullets = this.bullets.filter(b => !b.dead);

    for (const p of this.projectiles) {
      if (p.update(dt, player, solids)) {
        if (!player.isInvuln()) {
          player.takeDamage(p.damage, null);
          if (p.blinds && player.applyBlur) player.applyBlur(game);
        }
        game.entities.addSpark(p.x, p.y, '#7ad46a', 6);
      }
    }
    this.projectiles = this.projectiles.filter(p => !p.dead);

    // Acid pools: decay + burn anyone standing in them (corrodes armor too)
    for (const a of this.acidPools) {
      a.ttl -= dt;
      if (a.ttl <= 0) continue;
      if (!player.dead && Utils.dist(player.x, player.y, a.x, a.y) < a.r + player.radius * 0.5) {
        if (player.applyAcid) player.applyAcid(game, 0.5);
        if (!player.invincible) {
          player.hp -= CONFIG.injury.acidDps * dt;
          if (player.hp <= 0) { player.hp = 0; player.dead = true; }
        }
        if (player.armor && player.armor.legs && player.armor.legs.takeDamage) {
          player.armor.legs.takeDamage(CONFIG.injury.acidArmorShred * dt);
        }
      }
    }
    this.acidPools = this.acidPools.filter(a => a.ttl > 0);

    for (const p of this.particles) {
      p.wx = (p.wx != null ? p.wx : p.x) + p.vx * dt;
      p.wy = (p.wy != null ? p.wy : p.y) + p.vy * dt;
      p.vy += 60 * dt;
      p.life -= dt;
    }
    this.particles = this.particles.filter(p => p.life > 0);
  }

  _separateZombies() {
    const zs = this.zombies;
    for (let i = 0; i < zs.length; i++) {
      const a = zs[i]; if (!a.alive) continue;
      for (let j = i + 1; j < zs.length; j++) {
        const b = zs[j]; if (!b.alive) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.hypot(dx, dy);
        const min = a.radius + b.radius;
        if (d > 0 && d < min) {
          const push = (min - d) / 2;
          const nx = dx / d, ny = dy / d;
          a.x -= nx * push; a.y -= ny * push;
          b.x += nx * push; b.y += ny * push;
        }
      }
    }
  }

  // Solid bodies: zombies cannot walk through the player (nor the player
  // through zombies) — they shove against each other instead.
  _separateFromPlayer(player) {
    if (player.dead || player.noclip) return;
    for (const z of this.zombies) {
      if (!z.alive) continue;
      const dx = player.x - z.x, dy = player.y - z.y;
      const d = Math.hypot(dx, dy);
      const min = z.radius + player.radius - 2;
      if (d > 0 && d < min) {
        const push = (min - d);
        const nx = dx / d, ny = dy / d;
        // zombie takes most of the shove; the player gets nudged
        z.x -= nx * push * 0.7; z.y -= ny * push * 0.7;
        player.x += nx * push * 0.3; player.y += ny * push * 0.3;
      }
    }
  }

  // Nearest harvestable corpse (dead, lootable, not yet harvested).
  nearestCorpse(px, py, range) {
    let best = null, bestD = range;
    for (const z of this.zombies) {
      if (!z.dead || !z.lootable || z.harvested) continue;
      const d = Utils.dist(px, py, z.x, z.y);
      if (d < bestD) { bestD = d; best = z; }
    }
    return best;
  }

  collect(list, cam) {
    for (const z of this.zombies) {
      if (cam.visible(z.x, z.y)) z.collect(list);
    }
    for (const b of this.bullets) b.collect(list);
    for (const p of this.projectiles) p.collect(list);
  }

  renderParticles(ctx) {
    for (const p of this.particles) {
      const a = p.life / p.max;
      const wx = p.wx != null ? p.wx : p.x;
      const wy = p.wy != null ? p.wy : p.y;
      const wz = p.wz != null ? p.wz : 20;
      const s = Iso.toScreen(wx, wy, wz);

      if (p.beam) {
        ctx.globalAlpha = a * 0.6;
        const gradient = ctx.createLinearGradient(s.x - 8, s.y - p.beamHeight, s.x + 8, s.y);
        gradient.addColorStop(0, p.beamColor + '00');
        gradient.addColorStop(0.5, p.beamColor + '80');
        gradient.addColorStop(1, p.beamColor + '00');
        ctx.fillStyle = gradient;
        ctx.fillRect(s.x - 12, s.y - p.beamHeight, 24, p.beamHeight);
        ctx.globalAlpha = 1;
      } else if (p.text) {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.font = `bold ${p.size}px "Segoe UI", sans-serif`;
        ctx.textAlign = 'center';
        ctx.fillText(p.text, s.x, s.y);
        ctx.textAlign = 'left';
        ctx.globalAlpha = 1;
      } else {
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.beginPath(); ctx.arc(s.x, s.y, p.size, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }
  }

  reset() {
    this.zombies = [];
    this.bullets = [];
    this.projectiles = [];
    this.particles = [];
    this.acidPools = [];
    this.spawnTimer = CONFIG.spawn.spawnInterval;
  }
}
