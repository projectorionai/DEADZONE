/* Tactical minimap — a dedicated 2D canvas overlay, fully independent of the
 * Three.js renderer. Rotates with the player's facing, supports wheel zoom, shows
 * world boundary and coloured markers (player/zombies/guards/outpost/objectives).
 * Also renders the full World Map used by the pause menu.
 */
class Minimap {
  constructor() {
    this.canvas = document.getElementById('minimap');
    this.ctx = this.canvas ? this.canvas.getContext('2d') : null;
    this.size = this.canvas ? this.canvas.width : 190;
    this.baseRadius = 1200;   // world units shown (radius) at zoom 1
    this.zoom = 1;
    // Fixed north-up map: moving right moves the marker right, down moves down.
    // (Rotate-with-facing was disorienting because facing follows the mouse.)
    this.rotate = false;
    if (this.canvas) {
      this.canvas.addEventListener('wheel', (e) => {
        e.preventDefault();
        this.zoom = Utils.clamp(this.zoom * (e.deltaY < 0 ? 1.15 : 0.87), 0.35, 4.5);
      }, { passive: false });
    }
  }

  // Rotation-aware world->minimap transform (player at centre, facing up).
  _project(wx, wy, p, C, scale, cos, sin) {
    const dx = wx - p.x, dy = wy - p.y;
    return { x: C + (dx * cos - dy * sin) * scale, y: C + (dx * sin + dy * cos) * scale };
  }

  render(game) {
    const ctx = this.ctx; if (!ctx) return;
    const S = this.size, C = S / 2;
    const p = game.player, scene = game.scene;
    const viewR = this.baseRadius / this.zoom;
    const scale = (C - 6) / viewR;
    const theta = this.rotate ? (-Math.PI / 2 - p.facing) : 0;   // 0 = identity (north-up)
    const cos = Math.cos(theta), sin = Math.sin(theta);
    const tx = (x, y) => this._project(x, y, p, C, scale, cos, sin);

    ctx.clearRect(0, 0, S, S);
    ctx.save();
    ctx.beginPath(); ctx.arc(C, C, C - 2, 0, Math.PI * 2); ctx.clip();
    ctx.fillStyle = 'rgba(10,14,12,0.85)'; ctx.fillRect(0, 0, S, S);

    // World boundary
    const corners = [[0, 0], [scene.w, 0], [scene.w, scene.h], [0, scene.h]].map(c => tx(c[0], c[1]));
    ctx.strokeStyle = 'rgba(120,150,130,0.45)'; ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(corners[0].x, corners[0].y);
    for (let i = 1; i < 4; i++) ctx.lineTo(corners[i].x, corners[i].y);
    ctx.closePath(); ctx.stroke();

    if (scene.isOverworld) {
      // Outposts (yellow)
      ctx.fillStyle = '#e6c84a';
      const zones = scene.outposts ? scene.outposts.map(o => o.zone) : [scene.safeZone];
      for (const sz of zones) { const s = tx(sz.x + sz.w / 2, sz.y + sz.h / 2); ctx.fillRect(s.x - 4, s.y - 4, 8, 8); }
      // Landmark buildings / objectives (white)
      ctx.fillStyle = 'rgba(220,226,232,0.7)';
      for (const b of scene.enterables) { const q = tx(b.x + b.w / 2, b.y + b.h / 2); ctx.fillRect(q.x - 2, q.y - 2, 4, 4); }
    } else if (scene.exitZone) {
      const e = scene.exitZone, s = tx(e.cx, e.cy);
      ctx.fillStyle = '#ffffff'; ctx.fillRect(s.x - 3, s.y - 3, 6, 6);
    }

    // Explicit objective markers (white) — Phase 6+ hook
    if (scene.objectives) {
      ctx.fillStyle = '#ffffff';
      for (const o of scene.objectives) { const q = tx(o.x, o.y); ctx.beginPath(); ctx.arc(q.x, q.y, 3, 0, Math.PI * 2); ctx.fill(); }
    }

    // Active mission objectives: pulsing gold diamonds
    if (game.missions && game.missions.getMarkers) {
      const pulse = 3 + Math.sin(performance.now() / 300) * 1.2;
      for (const mk of game.missions.getMarkers()) {
        const q = tx(mk.x, mk.y);
        ctx.fillStyle = '#ffd24a';
        ctx.beginPath();
        ctx.moveTo(q.x, q.y - pulse - 2); ctx.lineTo(q.x + pulse, q.y);
        ctx.lineTo(q.x, q.y + pulse + 2); ctx.lineTo(q.x - pulse, q.y);
        ctx.closePath(); ctx.fill();
      }
    }

    // Zombies (red) — culled to view radius
    const r2 = viewR * viewR;
    ctx.fillStyle = '#e0483a';
    for (const z of scene.entities.zombies) {
      if (!z.alive || Utils.dist2(z.x, z.y, p.x, p.y) > r2) continue;
      const q = tx(z.x, z.y);
      const boss = z.cfg.behavior && z.cfg.behavior.boss;
      ctx.beginPath(); ctx.arc(q.x, q.y, boss ? 4 : 2.4, 0, Math.PI * 2); ctx.fill();
    }

    // NPC guards (blue) — Phase 6 hook
    if (scene.guards) {
      ctx.fillStyle = '#4a86e0';
      for (const g of scene.guards) { const q = tx(g.x, g.y); ctx.beginPath(); ctx.arc(q.x, q.y, 2.8, 0, Math.PI * 2); ctx.fill(); }
    }

    // Player (green triangle at centre, pointing up)
    ctx.fillStyle = '#4fdd6a';
    ctx.beginPath(); ctx.moveTo(C, C - 7); ctx.lineTo(C - 5, C + 5); ctx.lineTo(C + 5, C + 5); ctx.closePath(); ctx.fill();
    ctx.restore();

    // Frame
    ctx.strokeStyle = 'rgba(180,200,190,0.5)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(C, C, C - 2, 0, Math.PI * 2); ctx.stroke();
    // North indicator
    ctx.fillStyle = 'rgba(230,235,240,0.85)'; ctx.font = 'bold 10px "Segoe UI"'; ctx.textAlign = 'center';
    const nAng = theta; // world-north on screen (top when not rotating)
    const nx = C + Math.sin(nAng) * (C - 12), ny = C - Math.cos(nAng) * (C - 12);
    ctx.fillText('N', nx, ny + 3);
    ctx.textAlign = 'left';
  }

  // Full north-up world map for the pause menu.
  renderWorldMap(game) {
    const cv = document.getElementById('worldMapCanvas');
    if (!cv) return;
    const ctx = cv.getContext('2d');
    const W = cv.width, H = cv.height, scene = game.scene, p = game.player;
    const pad = 20;
    const scale = Math.min((W - pad * 2) / scene.w, (H - pad * 2) / scene.h);
    const ox = (W - scene.w * scale) / 2, oy = (H - scene.h * scale) / 2;
    const tx = (x, y) => ({ x: ox + x * scale, y: oy + y * scale });

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#11151a'; ctx.fillRect(0, 0, W, H);
    // world border
    ctx.strokeStyle = 'rgba(120,150,130,0.5)'; ctx.lineWidth = 2;
    ctx.strokeRect(ox, oy, scene.w * scale, scene.h * scale);

    if (scene.isOverworld) {
      // roads
      ctx.fillStyle = 'rgba(70,78,86,0.6)';
      for (const s of scene.streets) { const q = tx(s.x, s.y); ctx.fillRect(q.x, q.y, s.w * scale, s.h * scale); }
      // buildings
      for (const b of scene.buildings) {
        if (b.wall || b.small) continue;
        const q = tx(b.x, b.y);
        ctx.fillStyle = b.enterable ? 'rgba(120,130,150,0.9)' : 'rgba(80,86,96,0.8)';
        ctx.fillRect(q.x, q.y, b.w * scale, b.h * scale);
      }
      // outposts
      const zonesW = scene.outposts ? scene.outposts.map(o => o.zone) : [scene.safeZone];
      for (const sz of zonesW) {
        const s = tx(sz.x, sz.y);
        ctx.fillStyle = 'rgba(230,200,74,0.35)'; ctx.fillRect(s.x, s.y, sz.w * scale, sz.h * scale);
        ctx.strokeStyle = '#e6c84a'; ctx.lineWidth = 1.5; ctx.strokeRect(s.x, s.y, sz.w * scale, sz.h * scale);
      }
      // labels
      ctx.fillStyle = '#c8ccd0'; ctx.font = '11px "Segoe UI"'; ctx.textAlign = 'center';
      for (const b of scene.enterables) { const c = tx(b.x + b.w / 2, b.y + b.h / 2); ctx.fillText(b.name, c.x, c.y + 3); }
      ctx.fillStyle = '#e6c84a';
      if (scene.outposts) {
        for (const o of scene.outposts) {
          const c = tx(o.zone.x + o.zone.w / 2, o.zone.y + o.zone.h / 2);
          ctx.fillText(o.name.toUpperCase(), c.x, c.y + 3);
        }
      }
      ctx.textAlign = 'left';
    }

    // zombies
    ctx.fillStyle = '#e0483a';
    for (const z of scene.entities.zombies) { if (!z.alive) continue; const q = tx(z.x, z.y); ctx.beginPath(); ctx.arc(q.x, q.y, 2, 0, Math.PI * 2); ctx.fill(); }
    // player
    const pp = tx(p.x, p.y);
    ctx.fillStyle = '#4fdd6a'; ctx.beginPath(); ctx.arc(pp.x, pp.y, 4, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#0c0e11'; ctx.lineWidth = 1; ctx.stroke();
  }
}
