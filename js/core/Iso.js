/* Isometric projection + 2.5D drawing primitives.
 *
 * All game logic stays in CARTESIAN world coordinates (x, y = ground plane,
 * z = height). Only rendering projects to an isometric screen space. `View`
 * holds the current screen offset (set by the camera each frame) plus a global
 * zoom, so projection/unprojection is a pure function of world coords.
 */
const View = { ox: 0, oy: 0, w: 0, h: 0, zoom: 1 };

const Iso = {
  get IX() { return CONFIG.iso.IX * View.zoom; },
  get IY() { return CONFIG.iso.IY * View.zoom; },
  get IZ() { return CONFIG.iso.IZ * View.zoom; },

  // World (wx,wy,wz) -> screen pixel {x,y}
  toScreen(wx, wy, wz = 0) {
    return {
      x: (wx - wy) * this.IX + View.ox,
      y: (wx + wy) * this.IY - wz * this.IZ + View.oy,
    };
  },

  // Screen pixel -> world ground point (z = 0). Used for mouse aiming.
  toWorld(sx, sy) {
    const px = (sx - View.ox) / this.IX;   // = wx - wy
    const py = (sy - View.oy) / this.IY;   // = wx + wy
    return { x: (px + py) / 2, y: (py - px) / 2 };
  },

  // Depth key for painter's-algorithm sorting (draw small -> large).
  depth(wx, wy, wz = 0) { return wx + wy + wz * 0.5; },

  // ---- Primitives ----

  // Filled iso floor rect (world-aligned rect on the ground plane).
  floorRect(ctx, wx, wy, w, h, fill, stroke) {
    const a = this.toScreen(wx, wy), b = this.toScreen(wx + w, wy);
    const c = this.toScreen(wx + w, wy + h), d = this.toScreen(wx, wy + h);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.lineTo(c.x, c.y); ctx.lineTo(d.x, d.y);
    ctx.closePath();
    if (fill) { ctx.fillStyle = fill; ctx.fill(); }
    if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
  },

  // Ground shadow ellipse under an actor/prop.
  shadow(ctx, wx, wy, rx, ry, alpha = 0.34) {
    const p = this.toScreen(wx, wy, 0);
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.beginPath();
    ctx.ellipse(p.x, p.y, rx * this.IX * 2, rx * this.IY * 2, 0, 0, Math.PI * 2);
    ctx.fill();
  },

  // Extruded box (building / crate / vehicle body). height in world units.
  // colors = { top, left, right }. Draws the two camera-facing side walls + top.
  box(ctx, wx, wy, w, h, height, colors, opts = {}) {
    const g0 = this.toScreen(wx, wy, 0);            // A back
    const g1 = this.toScreen(wx + w, wy, 0);        // B right-back
    const g2 = this.toScreen(wx + w, wy + h, 0);    // C front
    const g3 = this.toScreen(wx, wy + h, 0);        // D left-back
    const t0 = this.toScreen(wx, wy, height);
    const t1 = this.toScreen(wx + w, wy, height);
    const t2 = this.toScreen(wx + w, wy + h, height);
    const t3 = this.toScreen(wx, wy + h, height);

    // Right wall (the +x face): B, C, C', B'
    ctx.fillStyle = colors.right;
    ctx.beginPath();
    ctx.moveTo(g1.x, g1.y); ctx.lineTo(g2.x, g2.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t1.x, t1.y);
    ctx.closePath(); ctx.fill();

    // Left wall (the +y face): D, C, C', D'
    ctx.fillStyle = colors.left;
    ctx.beginPath();
    ctx.moveTo(g3.x, g3.y); ctx.lineTo(g2.x, g2.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y);
    ctx.closePath(); ctx.fill();

    // Top face
    ctx.fillStyle = colors.top;
    ctx.beginPath();
    ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y);
    ctx.closePath(); ctx.fill();

    if (opts.edge) {
      ctx.strokeStyle = opts.edge; ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(t0.x, t0.y); ctx.lineTo(t1.x, t1.y); ctx.lineTo(t2.x, t2.y); ctx.lineTo(t3.x, t3.y); ctx.closePath();
      ctx.moveTo(t1.x, t1.y); ctx.lineTo(g1.x, g1.y);
      ctx.moveTo(t2.x, t2.y); ctx.lineTo(g2.x, g2.y);
      ctx.moveTo(t3.x, t3.y); ctx.lineTo(g3.x, g3.y);
      ctx.stroke();
    }
    return { g2, t0, t1, t2, t3, g1, g3 };
  },

  // A shaded upright actor (person/zombie) that reads as a 3D volume.
  // Draws feet at world (wx,wy); body rises `bodyH` screen-pixels.
  actor(ctx, wx, wy, o) {
    const feet = this.toScreen(wx, wy, 0);
    const r = o.radius * this.IX * 2;             // screen half-width
    const bodyH = o.bodyH;
    const cx = feet.x, base = feet.y - r * 0.3;
    const topY = base - bodyH;

    // capsule body via gradient (top-lit)
    const grad = ctx.createLinearGradient(cx - r, topY, cx + r, base);
    grad.addColorStop(0, o.light || o.body);
    grad.addColorStop(0.5, o.body);
    grad.addColorStop(1, o.dark || o.body);
    ctx.fillStyle = o.flash ? '#f4e4e4' : grad;
    this._capsule(ctx, cx, topY, base, r);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1.5; ctx.stroke();

    // head dome
    const headR = r * 0.62, headY = topY - headR * 0.2;
    const hg = ctx.createRadialGradient(cx - headR * 0.3, headY - headR * 0.3, 1, cx, headY, headR);
    hg.addColorStop(0, o.head ? this._lighten(o.head, 20) : (o.light || o.body));
    hg.addColorStop(1, o.head || o.dark || o.body);
    ctx.fillStyle = o.flash ? '#f4e4e4' : hg;
    ctx.beginPath(); ctx.arc(cx, headY, headR, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.stroke();

    // facing / weapon pointer projected on the ground direction
    if (o.facing != null && o.arm) {
      const len = o.armLen || 26;
      const p2 = this.toScreen(wx + Math.cos(o.facing) * len, wy + Math.sin(o.facing) * len, 0);
      ctx.strokeStyle = o.arm; ctx.lineWidth = o.armW || 4;
      ctx.beginPath();
      ctx.moveTo(cx, base - bodyH * 0.55);
      ctx.lineTo(p2.x, base - bodyH * 0.55 + (p2.y - feet.y));
      ctx.stroke();
    }
    return { cx, headY, base, topY };
  },

  _capsule(ctx, cx, topY, base, r) {
    ctx.beginPath();
    ctx.moveTo(cx - r, topY);
    ctx.arc(cx, topY, r, Math.PI, 0);
    ctx.lineTo(cx + r, base);
    ctx.arc(cx, base, r, 0, Math.PI);
    ctx.closePath();
    ctx.fill();
  },

  _lighten(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    let r = (n >> 16) + amt, g = ((n >> 8) & 255) + amt, b = (n & 255) + amt;
    r = Math.min(255, r); g = Math.min(255, g); b = Math.min(255, b);
    return `rgb(${r},${g},${b})`;
  },
  shade(hex, factor) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * factor);
    const g = Math.round(((n >> 8) & 255) * factor);
    const b = Math.round((n & 255) * factor);
    return `rgb(${Math.min(255,r)},${Math.min(255,g)},${Math.min(255,b)})`;
  },
};

/* Painter's-algorithm draw list: collect { depth, fn } then flush sorted. */
class RenderList {
  constructor() { this.items = []; }
  add(depth, fn) { this.items.push({ depth, fn }); }
  flush(ctx) {
    this.items.sort((a, b) => a.depth - b.depth);
    for (const it of this.items) it.fn(ctx);
    this.items.length = 0;
  }
}
