/* Isometric camera. Tracks a world-space focus point and writes the screen
 * offset into the shared `View` each frame so Iso.toScreen centres on the focus.
 */
class Camera {
  constructor(viewW, viewH) {
    this.fx = 0; this.fy = 0;      // smoothed focus (world coords)
    this.viewW = viewW; this.viewH = viewH;
    this.smooth = 0.14;
    this.vbias = -40;              // lift so the player sits slightly low-centre
  }

  resize(viewW, viewH) { this.viewW = viewW; this.viewH = viewH; View.w = viewW; View.h = viewH; }

  follow(tx, ty, instant = false) {
    if (instant) { this.fx = tx; this.fy = ty; }
    else { this.fx += (tx - this.fx) * this.smooth; this.fy += (ty - this.fy) * this.smooth; }
    this.apply();
  }

  apply() {
    View.zoom = CONFIG.iso.zoom;
    const IX = CONFIG.iso.IX * View.zoom, IY = CONFIG.iso.IY * View.zoom;
    View.ox = this.viewW / 2 - (this.fx - this.fy) * IX;
    View.oy = this.viewH / 2 - (this.fx + this.fy) * IY + this.vbias;
  }

  // Rough visibility test in world space (for culling props/tiles).
  visible(wx, wy, pad = 300) {
    const s = Iso.toScreen(wx, wy, 0);
    return s.x > -pad && s.x < this.viewW + pad && s.y > -pad && s.y < this.viewH + pad;
  }
}
